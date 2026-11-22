import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { miniPack } from "../../../frontend/src/core/content/__fixtures__/mini-pack";
import { PACK_TABLES } from "../../../frontend/src/core/content/types";
import { removedIds, verifyN4AgainstDataset, verifyPack } from "./verify-packs";

const contentDir = fileURLToPath(new URL("../../content/n4/", import.meta.url));
const datasetDir = fileURLToPath(
  new URL("../../dataset_n4_minnanihongo/jsonl/", import.meta.url),
);
const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "verify-packs-"));
  dirs.push(dir);
  return dir;
}
function filename(table: string): string {
  return table === "verbPairs" ? "verb-pairs.json" : `${table}.json`;
}
function writeMiniPack(dir: string): void {
  const manifest = structuredClone(miniPack.manifest);
  for (const table of PACK_TABLES) {
    const bytes = JSON.stringify(miniPack[table], null, 1);
    writeFileSync(join(dir, filename(table)), bytes);
    manifest.sha256[table] = createHash("sha256").update(bytes).digest("hex");
  }
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
}
function n4Copy(): string {
  const dir = tempDir();
  cpSync(contentDir, dir, { recursive: true });
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("verifyPack", () => {
  it("accepts a valid indexed pack and detects altered file bytes", () => {
    const dir = tempDir();
    writeMiniPack(dir);
    expect(verifyPack(dir, { level: "n4", version: "1.0.0" })).toEqual([]);
    const path = join(dir, "vocabulary.json");
    writeFileSync(path, `${readFileSync(path, "utf8")} `);
    expect(
      verifyPack(dir, { level: "n4", version: "1.0.0" }).join(" "),
    ).toMatch(/vocabulary.*(sha256|digest|hash)/i);
  });

  it("rejects wrong indexed identity, invalid schema and missing files", () => {
    const dir = tempDir();
    writeMiniPack(dir);
    expect(
      verifyPack(dir, { level: "n3", version: "2.0.0" }).join(" "),
    ).toMatch(/level/i);
    expect(
      verifyPack(dir, { level: "n4", version: "2.0.0" }).join(" "),
    ).toMatch(/version/i);
    writeFileSync(join(dir, "kanji.json"), "{}");
    expect(
      verifyPack(dir, { level: "n4", version: "1.0.0" }).join(" "),
    ).toMatch(/kanji/i);
    rmSync(join(dir, "reading.json"));
    expect(
      verifyPack(dir, { level: "n4", version: "1.0.0" }).join(" "),
    ).toMatch(/reading/i);
  });

  it("accepts a valid pack for another indexed level", () => {
    const dir = tempDir();
    writeMiniPack(dir);
    const path = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.level = "n3";
    writeFileSync(path, JSON.stringify(manifest));
    expect(verifyPack(dir, { level: "n3", version: "1.0.0" })).toEqual([]);
  });

  it("rejects invalid schema even if the bytes match the manifest", () => {
    const dir = tempDir();
    writeMiniPack(dir);
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(join(dir, "kanji.json"), "{}");
    manifest.sha256.kanji = createHash("sha256").update("{}").digest("hex");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(
      verifyPack(dir, { level: "n4", version: "1.0.0" }).join(" "),
    ).toMatch(/schema.*kanji/i);
  });
});

describe("verifyN4AgainstDataset", () => {
  it("accepts the real N4 content and all dataset references", () => {
    expect(verifyN4AgainstDataset(n4Copy(), datasetDir)).toEqual([]);
  });

  it("matches all compound IDs to the first raw row for each exact word", () => {
    const raw = readFileSync(join(datasetDir, "tu_ghep_kanji.jsonl"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    const firstIds = new Map<string, string>();
    for (const row of raw)
      if (!firstIds.has(row.compound))
        firstIds.set(row.compound, `compound-${row.id}`);
    const compounds = JSON.parse(
      readFileSync(join(contentDir, "compounds.json"), "utf8"),
    );
    expect(raw).toHaveLength(403);
    expect(firstIds.size).toBe(388);
    expect(compounds).toHaveLength(388);
    for (const row of compounds) expect(row.id).toBe(firstIds.get(row.word));
  });

  it.each(["replacement", "swap"])(
    "detects compound ID %s with unchanged words and coverage",
    (change) => {
      const dir = n4Copy();
      const path = join(dir, "compounds.json");
      const rows = JSON.parse(readFileSync(path, "utf8"));
      const firstId = rows[0].id;
      if (change === "swap")
        [rows[0].id, rows[1].id] = [rows[1].id, rows[0].id];
      else rows[0].id = "compound-replacement";
      writeFileSync(path, JSON.stringify(rows));
      const errors = verifyN4AgainstDataset(dir, datasetDir).join(" ");
      expect(errors).toContain(rows[0].word);
      expect(errors).toContain(firstId);
      expect(errors).toContain(rows[0].id);
    },
  );

  it("requires each original reading ID while allowing additions", () => {
    const dir = n4Copy();
    const path = join(dir, "reading.json");
    const rows = JSON.parse(readFileSync(path, "utf8"));
    rows[0].id = "reading-replacement";
    writeFileSync(path, JSON.stringify(rows));
    expect(verifyN4AgainstDataset(dir, datasetDir).join(" ")).toContain(
      "reading-01",
    );
    rows[0].id = "reading-01";
    rows.push({ ...rows[0], id: "reading-extra" });
    writeFileSync(path, JSON.stringify(rows));
    expect(verifyN4AgainstDataset(dir, datasetDir)).toEqual([]);
  });

  it("rejects a swap of IDs between two original reading passages", () => {
    const dir = n4Copy();
    const path = join(dir, "reading.json");
    const rows = JSON.parse(readFileSync(path, "utf8"));
    [rows[0].id, rows[1].id] = [rows[1].id, rows[0].id];
    writeFileSync(path, JSON.stringify(rows));
    expect(verifyN4AgainstDataset(dir, datasetDir).join(" ")).toContain(
      "reading-01",
    );
  });

  it("reports missing counts and missing word/kanji pairs", () => {
    const dir = n4Copy();
    const path = join(dir, "compounds.json");
    const compounds = JSON.parse(readFileSync(path, "utf8"));
    compounds.splice(0, 1);
    writeFileSync(path, JSON.stringify(compounds));
    const errors = verifyN4AgainstDataset(dir, datasetDir).join(" ");
    expect(errors).toMatch(/compounds/i);
    expect(errors).toMatch(/tu_ghep_kanji/);
    expect(errors).toContain("悪口");
  });

  it("rejects an incomplete or malformed reference dataset", () => {
    const data = tempDir();
    writeFileSync(
      join(data, "tu_ghep_kanji.jsonl"),
      '{"compound":"悪口","kanji_id":"K-60AA"}\n',
    );
    expect(verifyN4AgainstDataset(n4Copy(), data).join(" ")).toMatch(/403/);
    writeFileSync(join(data, "tu_ghep_kanji.jsonl"), "{bad json}\n");
    expect(verifyN4AgainstDataset(n4Copy(), data).join(" ")).toMatch(
      /tu_ghep_kanji/,
    );
  });

  it.each([
    "vocabulary",
    "kanji",
    "grammar",
    "comparisons",
    "conjugations",
    "keigo",
    "verbPairs",
  ])("detects same-count ID replacement in %s", (table) => {
    const dir = n4Copy();
    const path = join(dir, filename(table));
    const rows = JSON.parse(readFileSync(path, "utf8"));
    const missingId = rows[0].id;
    rows[0].id = "replacement-id";
    writeFileSync(path, JSON.stringify(rows));
    const errors = verifyN4AgainstDataset(dir, datasetDir).join(" ");
    expect(errors).toContain(missingId);
    expect(errors).toContain("replacement-id");
  });

  it("detects replacement of a supplementary vocabulary ID", () => {
    const dir = n4Copy();
    const path = join(dir, "vocabulary.json");
    const rows = JSON.parse(readFileSync(path, "utf8"));
    const row = rows.find(
      (entry: { id: string }) => entry.id === "vocab-TV-TVN001",
    );
    row.id = "replacement-id";
    writeFileSync(path, JSON.stringify(rows));
    const errors = verifyN4AgainstDataset(dir, datasetDir).join(" ");
    expect(errors).toContain("vocab-TV-TVN001");
    expect(errors).toContain("replacement-id");
  });
});

describe("removedIds", () => {
  it("finds IDs removed from any table in previous table order", () => {
    const previous = tempDir();
    const next = tempDir();
    writeMiniPack(previous);
    writeMiniPack(next);
    writeFileSync(join(next, "vocabulary.json"), "[]");
    writeFileSync(join(next, "verb-pairs.json"), "[]");
    expect(removedIds(previous, next)).toEqual(["vocab-1", "verbpair-1"]);
  });
});

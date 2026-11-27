import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildComparisonLinks } from "../../../frontend/src/core/content/comparisonLinks";
import {
  type GrammarComparison,
  type GrammarPattern,
  type Level,
  PACK_TABLES,
} from "../../../frontend/src/core/content/types";
import { validatePack } from "../../../frontend/src/core/content/validate";
import {
  buildPack,
  formatComparisonLinkReport,
  writeIndex,
} from "./build-packs";
import { buildPacks } from "./packs";

const contentDir = fileURLToPath(new URL("../../content/n4/", import.meta.url));
const dirs: string[] = [];
function temporaryDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pack-build-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("buildPack", () => {
  it("builds the real N4 tables deterministically and hashes the published bytes", () => {
    const out = temporaryDir();
    const first = buildPack("n4", contentDir, out, "1.0.0");
    const packDir = join(out, "n4", "1.0.0");
    const manifestBytes = readFileSync(join(packDir, "manifest.json"));
    const tables: Record<string, unknown> = {};
    for (const table of PACK_TABLES) {
      const filename =
        table === "verbPairs" ? "verb-pairs.json" : `${table}.json`;
      const bytes = readFileSync(join(packDir, filename));
      expect(first.sha256[table]).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
      expect(bytes.equals(readFileSync(join(contentDir, filename)))).toBe(true);
      tables[table] = JSON.parse(bytes.toString("utf8"));
    }
    expect(first.counts.vocabulary).toBe(1182);
    expect(validatePack({ manifest: first, ...tables }).ok).toBe(true);
    expect(JSON.parse(manifestBytes.toString("utf8"))).toEqual(first);
    expect(buildPack("n4", contentDir, out, "1.0.0")).toEqual(first);
    expect(readFileSync(join(packDir, "manifest.json"))).toEqual(manifestBytes);
    const vocabulary = join(packDir, "vocabulary.json");
    writeFileSync(
      vocabulary,
      Buffer.concat([readFileSync(vocabulary), Buffer.from(" ")]),
    );
    expect(
      createHash("sha256").update(readFileSync(vocabulary)).digest("hex"),
    ).not.toBe(first.sha256.vocabulary);
    expect(buildPack("n4", contentDir, out, "1.0.0")).toEqual(first);
    expect(readFileSync(vocabulary)).toEqual(
      readFileSync(join(contentDir, "vocabulary.json")),
    );
  });

  it("rejects changed content for an existing version before writing and permits a new version", () => {
    const out = temporaryDir();
    const input = temporaryDir();
    cpSync(contentDir, input, { recursive: true });
    buildPack("n4", contentDir, out, "1.0.0");
    const packDir = join(out, "n4", "1.0.0");
    const before = new Map(
      [
        ...PACK_TABLES.map((table) =>
          table === "verbPairs" ? "verb-pairs.json" : `${table}.json`,
        ),
        "manifest.json",
      ].map((name) => [name, readFileSync(join(packDir, name))]),
    );
    const path = join(input, "vocabulary.json");
    writeFileSync(path, `${readFileSync(path, "utf8")} `);
    expect(() => buildPack("n4", input, out, "1.0.0")).toThrow(
      /bump.*version/i,
    );
    for (const [name, bytes] of before)
      expect(readFileSync(join(packDir, name))).toEqual(bytes);
    expect(buildPack("n4", input, out, "1.0.1").version).toBe("1.0.1");
  });

  it("does not overwrite a pack whose existing manifest is malformed", () => {
    const out = temporaryDir();
    buildPack("n4", contentDir, out, "1.0.0");
    const packDir = join(out, "n4", "1.0.0");
    const path = join(packDir, "manifest.json");
    writeFileSync(path, "{bad json}");
    expect(() => buildPack("n4", contentDir, out, "1.0.0")).toThrow();
    expect(readFileSync(path, "utf8")).toBe("{bad json}");
  });

  it("rejects invalid content without publishing or overwriting an existing pack", () => {
    const out = temporaryDir();
    const input = temporaryDir();
    cpSync(contentDir, input, { recursive: true });
    buildPack("n4", contentDir, out, "1.0.0");
    const manifest = join(out, "n4", "1.0.0", "manifest.json");
    const before = readFileSync(manifest);
    writeFileSync(join(input, "vocabulary.json"), '[{"id":"bad"}]');
    expect(() => buildPack("n4", input, out, "1.0.0")).toThrow();
    expect(readFileSync(manifest)).toEqual(before);
    expect(() => buildPack("n4", input, out, "1.0.1")).toThrow();
    expect(existsSync(join(out, "n4", "1.0.1"))).toBe(false);
  });

  it.each(["../escape", "1.0.0/escape", "1.0.0\\escape", "", "CON", "1.0.0."])(
    "rejects unsafe or invalid version %s",
    (version) => {
      const out = temporaryDir();
      expect(() => buildPack("n4", contentDir, out, version)).toThrow();
      expect(existsSync(join(out, "n4"))).toBe(false);
    },
  );

  it("rejects invalid levels before constructing paths", () => {
    const out = temporaryDir();
    expect(() =>
      buildPack("../escape" as Level, contentDir, out, "1.0.0"),
    ).toThrow();
    expect(existsSync(join(out, "escape"))).toBe(false);
  });
});

describe("writeIndex", () => {
  it("writes portable paths for valid entries", () => {
    const out = temporaryDir();
    writeIndex(out, [
      { level: "n4", version: "1.0.0" },
      { level: "n3", version: "1.2.3-rc.1+build.001" },
    ]);
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual({
      levels: [
        { level: "n4", version: "1.0.0", path: "n4/1.0.0" },
        {
          level: "n3",
          version: "1.2.3-rc.1+build.001",
          path: "n3/1.2.3-rc.1+build.001",
        },
      ],
    });
  });

  it("rejects unsafe entries without changing the published index", () => {
    const out = temporaryDir();
    writeIndex(out, [{ level: "n4", version: "1.0.0" }]);
    const index = join(out, "index.json");
    const before = readFileSync(index);
    expect(() =>
      writeIndex(out, [{ level: "n4", version: "../bad" }]),
    ).toThrow();
    expect(() =>
      writeIndex(out, [{ level: "../bad" as Level, version: "1.0.0" }]),
    ).toThrow();
    expect(readFileSync(index)).toEqual(before);
  });
});

describe("formatComparisonLinkReport", () => {
  const comparisons = JSON.parse(
    readFileSync(join(contentDir, "comparisons.json"), "utf8"),
  ) as GrammarComparison[];
  const grammar = JSON.parse(
    readFileSync(join(contentDir, "grammar.json"), "utf8"),
  ) as GrammarPattern[];

  it("returns null when every comparison part is matched", () => {
    const report = buildComparisonLinks(
      [
        {
          id: "c-1",
          group: "Nhóm khớp",
          patterns: "～んですか",
          distinction: "",
          whenToUse: "",
          exampleJa: "",
          exampleVi: "",
        },
      ],
      grammar,
    );
    expect(formatComparisonLinkReport("n4", report)).toBeNull();
  });

  it("formats matched/unmatched counts and lists each unmatched part", () => {
    const report = buildComparisonLinks(comparisons, grammar);
    const formatted = formatComparisonLinkReport("n4", report);
    expect(formatted).not.toBeNull();
    expect(formatted).toContain("n4");
    expect(formatted).toContain("comparison-SS001");
    expect(formatted).toContain("～ですか・ますか");
    expect(formatted).toContain("comparison-SS006");
    expect(formatted).toContain("だけ");
  });

  it("prints unmatched comparison parts during buildPacks without failing or mutating pack output", () => {
    const root = temporaryDir();
    cpSync(
      fileURLToPath(new URL("../../content", import.meta.url)),
      join(root, "infra/content"),
      { recursive: true },
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      buildPacks(root, false);
      const output = [
        ...logSpy.mock.calls.map((args) => args.join(" ")),
        ...warnSpy.mock.calls.map((args) => args.join(" ")),
      ].join("\n");
      expect(output).toContain("comparison-SS001");
      expect(output).toContain("～ですか・ますか");
      const n4Version = readFileSync(
        join(contentDir, "VERSION"),
        "utf8",
      ).trim();
      expect(
        readFileSync(
          join(root, `infra/packs/n4/${n4Version}/comparisons.json`),
        ),
      ).toEqual(readFileSync(join(contentDir, "comparisons.json")));
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

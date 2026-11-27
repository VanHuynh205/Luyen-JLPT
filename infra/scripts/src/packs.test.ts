import {
  appendFileSync,
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
import { afterEach, beforeEach, expect, it } from "vitest";
import { buildPack } from "./build-packs";
import { buildPacks, verifyPacks } from "./packs";

const infra = fileURLToPath(new URL("../../", import.meta.url));
const n4Version = readFileSync(
  join(infra, "content/n4/VERSION"),
  "utf8",
).trim();
const published = "frontend/public/packs";
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jlpt-release-"));
  for (const dir of ["content", "dataset_n4_minnanihongo/jsonl"]) {
    cpSync(join(infra, dir), join(root, "infra", dir), { recursive: true });
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it("publishes N4 from VERSION and includes the N3 sample only while enabled", () => {
  writeFileSync(join(root, "infra/content/n4/VERSION"), "1.2.3\n");
  buildPacks(root, true);
  verifyPacks(root);
  for (const dir of ["infra/packs", published]) {
    const manifest = JSON.parse(
      readFileSync(join(root, dir, "n3/1.0.0/manifest.json"), "utf8"),
    );
    expect(Object.values(manifest.counts)).toEqual(Array(9).fill(2));
    writeFileSync(join(root, dir, "n3/1.0.0/local-note.txt"), "keep");
    expect(existsSync(join(root, dir, "n4/1.2.3/verb-pairs.json"))).toBe(true);
  }
  buildPacks(root, false);
  verifyPacks(root);
  for (const dir of ["infra/packs", published]) {
    expect(
      JSON.parse(readFileSync(join(root, dir, "index.json"), "utf8")),
    ).toEqual({
      levels: [{ level: "n4", version: "1.2.3", path: "n4/1.2.3" }],
    });
    expect(existsSync(join(root, dir, "n3/1.0.0/vocabulary.json"))).toBe(false);
    expect(existsSync(join(root, dir, "n3/1.0.0/local-note.txt"))).toBe(true);
  }
});

it("reports a removed reading ID from the supplied previous release", () => {
  buildPacks(root, false);
  const baseline = join(root, "baseline");
  const content = join(root, "previous-content");
  cpSync(join(root, "infra/content/n4"), content, { recursive: true });
  const reading = join(content, "reading.json");
  const rows = JSON.parse(readFileSync(reading, "utf8"));
  rows[0].id = "reading-retired";
  writeFileSync(reading, JSON.stringify(rows));
  buildPack("n4", content, baseline, "0.9.0");
  expect(() => verifyPacks(root, join(baseline, "n4/0.9.0"))).toThrow(
    /Removed N4 IDs: reading-retired/,
  );
});

it("rejects a changed public file and an index that points outside the release", () => {
  buildPacks(root, false);
  appendFileSync(join(root, published, `n4/${n4Version}/grammar.json`), " ");
  expect(() => verifyPacks(root)).toThrow(/grammar/);
  buildPacks(root, false);
  writeFileSync(
    join(root, "infra/packs/index.json"),
    JSON.stringify({
      levels: [{ level: "n4", version: n4Version, path: "../../content/n4" }],
    }),
  );
  expect(() => verifyPacks(root)).toThrow(/index/);
});

it("rejects a stale pack after a source field changes without changing IDs", () => {
  buildPacks(root, false);
  const path = join(root, "infra/content/n4/grammar.json");
  const grammar = JSON.parse(readFileSync(path, "utf8"));
  grammar[0].meaning = "Nghĩa đã hiệu đính";
  writeFileSync(path, JSON.stringify(grammar));
  expect(() => verifyPacks(root)).toThrow(/grammar.json/);
});

it("detects same-version content changes against a supplied release on a clean build", () => {
  buildPacks(root, false);
  const previous = join(root, "prior-release");
  cpSync(join(root, `infra/packs/n4/${n4Version}`), previous, {
    recursive: true,
  });
  for (const dir of ["infra/packs", published])
    rmSync(join(root, dir), { recursive: true });
  appendFileSync(join(root, "infra/content/n4/grammar.json"), " ");
  buildPacks(root, false);
  expect(() => verifyPacks(root, previous)).toThrow(/version/i);
});

it("protects the published version even if the intermediate output is missing", () => {
  buildPacks(root, false);
  const file = join(root, published, `n4/${n4Version}/grammar.json`);
  const before = readFileSync(file);
  rmSync(join(root, "infra/packs"), { recursive: true });
  appendFileSync(join(root, "infra/content/n4/grammar.json"), " ");
  expect(() => buildPacks(root, false)).toThrow(/version/i);
  expect(readFileSync(file)).toEqual(before);
  expect(
    existsSync(join(root, `infra/packs/n4/${n4Version}/manifest.json`)),
  ).toBe(false);
});

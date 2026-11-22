import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { importDatasetTables } from "./import-dataset";

const sourceDir = fileURLToPath(
  new URL("../../dataset_n4_minnanihongo/jsonl/", import.meta.url),
);
const tempDirs: string[] = [];
function temporaryDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "dataset-import-"));
  tempDirs.push(dir);
  return dir;
}

const fixtures = {
  so_sanh: {
    id: "SS900",
    group: "group",
    patterns: "pattern",
    distinction_vi: "distinction",
    when_to_use_vi: "when",
    example_ja: "例",
    example_vi: "example",
  },
  cach_chia: {
    id: "C900",
    ten_vi: "name",
    label_ja: "形",
    recognition_vi: "recognition",
    v_group_1: "one",
    v_group_2: "two",
    v_group_3: "three",
    examples_g1: "ex1",
    examples_g2: "ex2",
    examples_g3: "ex3",
    a_i: "i",
    a_na: "na",
    n: "noun",
    exceptions_vi: "exceptions",
  },
  kinh_ngu: {
    id: "KG900",
    plain_ja: "行く",
    plain_hiragana: "いく",
    sonkeigo: null,
    sonkeigo_masu: "masu",
    kenjogo_i: null,
    kenjogo_ii: "ii",
    teineigo: "teinei",
    recognition_vi: "recognition",
    example_ja: "例",
    example_vi: "example",
  },
  tu_dong_tha_dong: {
    id: "TD900",
    tadong_ja: "開ける",
    tadong_hiragana: "あける",
    tudong_ja: "開く",
    tudong_hiragana: "あく",
    meaning_vi: "open",
  },
};

function writeFixtures(dir: string): void {
  for (const [name, row] of Object.entries(fixtures)) {
    writeFileSync(
      join(dir, `${name}.jsonl`),
      `${JSON.stringify({ ...row, image_ids: [], reference_ids: [], origin: "ignored" })}\n`,
    );
  }
}

function read(dir: string, file: string): unknown[] {
  return JSON.parse(readFileSync(join(dir, file), "utf8"));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("importDatasetTables", () => {
  it("imports the real dataset with its counts and original Japanese text", () => {
    const out = temporaryDir();
    importDatasetTables(sourceDir, out, "");
    const comparisons = read(out, "comparisons.json");
    expect(comparisons).toHaveLength(27);
    expect(comparisons[0]).toMatchObject({
      id: "comparison-SS001",
      patterns: "～んですか／～ですか・ますか",
    });
    expect(read(out, "conjugations.json")).toHaveLength(22);
    const keigo = read(out, "keigo.json");
    expect(keigo).toHaveLength(17);
    expect(keigo).toEqual(
      expect.arrayContaining([expect.objectContaining({ sonkeigo: "" })]),
    );
    const pairs = read(out, "verb-pairs.json");
    expect(pairs).toHaveLength(12);
    expect(pairs[0]).toMatchObject({
      id: "verbpair-TD001",
      transitiveJa: "電気をつける",
      intransitiveJa: "電気がつく",
    });
  });

  it("maps every field from another dataset with the supplied prefix and converts null", () => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    importDatasetTables(source, out, "n3-");
    expect(read(out, "comparisons.json")).toEqual([
      {
        id: "n3-comparison-SS900",
        group: "group",
        patterns: "pattern",
        distinction: "distinction",
        whenToUse: "when",
        exampleJa: "例",
        exampleVi: "example",
      },
    ]);
    expect(read(out, "conjugations.json")).toEqual([
      {
        id: "n3-conjugation-C900",
        name: "name",
        labelJa: "形",
        recognition: "recognition",
        group1: "one",
        group2: "two",
        group3: "three",
        examplesG1: "ex1",
        examplesG2: "ex2",
        examplesG3: "ex3",
        adjI: "i",
        adjNa: "na",
        noun: "noun",
        exceptions: "exceptions",
      },
    ]);
    expect(read(out, "keigo.json")).toEqual([
      {
        id: "n3-keigo-KG900",
        plainJa: "行く",
        plainKana: "いく",
        sonkeigo: "",
        sonkeigoMasu: "masu",
        kenjogoI: "",
        kenjogoII: "ii",
        teineigo: "teinei",
        recognition: "recognition",
        exampleJa: "例",
        exampleVi: "example",
      },
    ]);
    expect(read(out, "verb-pairs.json")).toEqual([
      {
        id: "n3-verbpair-TD900",
        transitiveJa: "開ける",
        transitiveKana: "あける",
        intransitiveJa: "開く",
        intransitiveKana: "あく",
        meaning: "open",
      },
    ]);
  });

  it.each(
    Object.entries(fixtures).flatMap(([file, row]) =>
      Object.keys(row).map((field) => [file, field]),
    ),
  )("rejects missing or misspelled required field %s.%s", (file, field) => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    const row: Record<string, unknown> = {
      ...fixtures[file as keyof typeof fixtures],
    };
    row[`${field}_typo`] = row[field];
    delete row[field];
    writeFileSync(join(source, `${file}.jsonl`), JSON.stringify(row));
    expect(() => importDatasetTables(source, out, "")).toThrow();
  });

  it.each([null, 12, [], {}])("rejects an invalid id: %j", (id) => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    writeFileSync(
      join(source, "so_sanh.jsonl"),
      JSON.stringify({ ...fixtures.so_sanh, id }),
    );
    expect(() => importDatasetTables(source, out, "")).toThrow();
  });

  it("rejects a duplicate generated ID before writing any table", () => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    const row = JSON.stringify(fixtures.tu_dong_tha_dong);
    writeFileSync(join(source, "tu_dong_tha_dong.jsonl"), `${row}\n${row}\n`);
    expect(() => importDatasetTables(source, out, "n3-")).toThrow(
      /duplicate id/i,
    );
    expect(() => read(out, "comparisons.json")).toThrow(/ENOENT/);
  });

  it("counts the level prefix in the 128-character ID limit", () => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    const prefix = "n3-";
    const id = "x".repeat(128 - `${prefix}comparison-`.length);
    const file = join(source, "so_sanh.jsonl");
    writeFileSync(file, JSON.stringify({ ...fixtures.so_sanh, id }));
    importDatasetTables(source, out, prefix);
    const previous = read(out, "comparisons.json");
    writeFileSync(file, JSON.stringify({ ...fixtures.so_sanh, id: `${id}x` }));
    expect(() => importDatasetTables(source, out, prefix)).toThrow(/128/);
    expect(read(out, "comparisons.json")).toEqual(previous);
  });

  it("reports unmapped source columns instead of dropping new content", () => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    writeFileSync(
      join(source, "so_sanh.jsonl"),
      JSON.stringify({ ...fixtures.so_sanh, new_example_ja: "例" }),
    );
    expect(() => importDatasetTables(source, out, "")).toThrow(
      /new_example_ja/,
    );
  });

  it("rejects non-string field values", () => {
    const source = temporaryDir();
    const out = temporaryDir();
    writeFixtures(source);
    writeFileSync(
      join(source, "kinh_ngu.jsonl"),
      JSON.stringify({ ...fixtures.kinh_ngu, sonkeigo: 42 }),
    );
    expect(() => importDatasetTables(source, out, "")).toThrow();
  });

  it.each(["not json", "null", "[]", "42", '{"id":1}'])(
    "rejects malformed row %s without changing previously published files",
    (row) => {
      const source = temporaryDir();
      const out = temporaryDir();
      writeFixtures(source);
      for (const file of [
        "comparisons.json",
        "conjugations.json",
        "keigo.json",
        "verb-pairs.json",
      ]) {
        writeFileSync(join(out, file), "previous");
      }
      writeFileSync(join(source, "tu_dong_tha_dong.jsonl"), row);
      expect(() => importDatasetTables(source, out, "")).toThrow();
      for (const file of [
        "comparisons.json",
        "conjugations.json",
        "keigo.json",
        "verb-pairs.json",
      ]) {
        expect(readFileSync(join(out, file), "utf8")).toBe("previous");
      }
    },
  );
});

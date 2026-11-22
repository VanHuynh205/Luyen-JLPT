import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ConjugationRule,
  GrammarComparison,
  KeigoEntry,
  PackTable,
  VerbPair,
} from "../../../frontend/src/core/content/types";
import { writeTable } from "./write-table";

const comparisons = {
  group: "group",
  patterns: "patterns",
  distinction: "distinction_vi",
  whenToUse: "when_to_use_vi",
  exampleJa: "example_ja",
  exampleVi: "example_vi",
} satisfies Record<Exclude<keyof GrammarComparison, "id">, string>;
const conjugations = {
  name: "ten_vi",
  labelJa: "label_ja",
  recognition: "recognition_vi",
  group1: "v_group_1",
  group2: "v_group_2",
  group3: "v_group_3",
  examplesG1: "examples_g1",
  examplesG2: "examples_g2",
  examplesG3: "examples_g3",
  adjI: "a_i",
  adjNa: "a_na",
  noun: "n",
  exceptions: "exceptions_vi",
} satisfies Record<Exclude<keyof ConjugationRule, "id">, string>;
const keigo = {
  plainJa: "plain_ja",
  plainKana: "plain_hiragana",
  sonkeigo: "sonkeigo",
  sonkeigoMasu: "sonkeigo_masu",
  kenjogoI: "kenjogo_i",
  kenjogoII: "kenjogo_ii",
  teineigo: "teineigo",
  recognition: "recognition_vi",
  exampleJa: "example_ja",
  exampleVi: "example_vi",
} satisfies Record<Exclude<keyof KeigoEntry, "id">, string>;
const verbPairs = {
  transitiveJa: "tadong_ja",
  transitiveKana: "tadong_hiragana",
  intransitiveJa: "tudong_ja",
  intransitiveKana: "tudong_hiragana",
  meaning: "meaning_vi",
} satisfies Record<Exclude<keyof VerbPair, "id">, string>;

export function importDatasetTables(
  jsonlDir: string,
  outDir: string,
  idPrefix: string,
): void {
  const tables: {
    source: string;
    table: PackTable;
    id: string;
    fields: Record<string, string>;
  }[] = [
    {
      source: "so_sanh",
      table: "comparisons",
      id: "comparison",
      fields: comparisons,
    },
    {
      source: "cach_chia",
      table: "conjugations",
      id: "conjugation",
      fields: conjugations,
    },
    { source: "kinh_ngu", table: "keigo", id: "keigo", fields: keigo },
    {
      source: "tu_dong_tha_dong",
      table: "verbPairs",
      id: "verbpair",
      fields: verbPairs,
    },
  ];

  const parsed = tables.map(({ source, table, id, fields }) => {
    const file = join(jsonlDir, `${source}.jsonl`);
    const fieldEntries = Object.entries(fields);
    const allowed = new Set([
      "id",
      "origin",
      "image_ids",
      "reference_ids",
      ...Object.values(fields),
    ]);
    const seenIds = new Set<string>();
    const rows = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line, index) => {
        if (!line.trim()) return [];
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          throw new Error(`${file}:${index + 1}: invalid JSON`);
        }
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error(`${file}:${index + 1}: expected an object`);
        }
        const row = raw as Record<string, unknown>;
        if (typeof row.id !== "string" || !row.id.trim()) {
          throw new Error(`${file}:${index + 1}: invalid id`);
        }
        const contentId = `${idPrefix}${id}-${row.id}`;
        if (contentId.length > 128) {
          throw new Error(`${file}:${index + 1}: id exceeds 128 characters`);
        }
        if (seenIds.has(contentId)) {
          throw new Error(`${file}:${index + 1}: duplicate id ${contentId}`);
        }
        seenIds.add(contentId);
        const unknown = Object.keys(row).find((key) => !allowed.has(key));
        if (unknown !== undefined) {
          throw new Error(
            `${file}:${index + 1}: unmapped source field ${unknown}`,
          );
        }
        const result: Record<string, string> = { id: contentId };
        for (const [target, sourceField] of fieldEntries) {
          const value = row[sourceField];
          if (value !== null && typeof value !== "string") {
            throw new Error(`${file}:${index + 1}: invalid ${sourceField}`);
          }
          result[target] = value ?? "";
        }
        return [result];
      });
    return { table, rows };
  });

  for (const { table, rows } of parsed) writeTable(outDir, table, rows);
}

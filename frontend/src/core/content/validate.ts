import type { Result } from "../result";
import {
  type ContentPack,
  LEVELS,
  PACK_TABLES,
  type PackError,
  type PackTable,
} from "./types";

const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/;
const SHA256 = /^[a-f\d]{64}$/i;

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Row {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isVersion(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = SEMVER.exec(value);
  return (
    match !== null && !match[1]?.split(".").some((part) => /^0\d+$/.test(part))
  );
}

function allItems(
  value: unknown,
  predicate: (item: unknown) => boolean,
): boolean {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (!predicate(item)) return false;
  }
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return allItems(value, (item) => typeof item === "string");
}

function hasStrings(row: Row, ...fields: string[]): boolean {
  return fields.every((field) => typeof row[field] === "string");
}

function hasOptionalStrings(row: Row, ...fields: string[]): boolean {
  return fields.every(
    (field) => row[field] === undefined || typeof row[field] === "string",
  );
}

function isQuestion(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStrings(value, "question", "explanation") &&
    isStringArray(value.choices) &&
    typeof value.answerIndex === "number" &&
    Number.isSafeInteger(value.answerIndex) &&
    value.answerIndex >= 0 &&
    value.answerIndex < value.choices.length
  );
}

const rowChecks: Record<PackTable, (row: Row) => boolean> = {
  vocabulary: (row) =>
    hasStrings(row, "word", "reading", "meaning") &&
    Number.isSafeInteger(row.lesson) &&
    ["từ chính", "hội thoại", "đọc", "ghi tay"].some(
      (section) => section === row.section,
    ) &&
    hasOptionalStrings(row, "hanViet", "context", "note", "wordType"),
  kanji: (row) =>
    hasStrings(row, "kanji", "hanViet", "meaning") &&
    isStringArray(row.onyomi) &&
    isStringArray(row.kunyomi) &&
    isStringArray(row.lessons),
  compounds: (row) =>
    hasStrings(row, "word", "reading", "hanViet", "meaning") &&
    isStringArray(row.kanjiIds) &&
    isStringArray(row.lessons) &&
    allItems(
      row.components,
      (item) =>
        isRecord(item) && hasStrings(item, "kanji", "hanViet", "meaning"),
    ),
  grammar: (row) =>
    hasStrings(row, "pattern", "meaning", "usage") &&
    Number.isSafeInteger(row.lesson) &&
    isRecord(row.connections) &&
    hasOptionalStrings(row.connections, "v", "aI", "aNa", "n") &&
    allItems(
      row.examples,
      (item) =>
        isRecord(item) &&
        hasStrings(item, "japanese", "meaning") &&
        hasOptionalStrings(item, "reading"),
    ) &&
    (row.quiz === undefined || allItems(row.quiz, isQuestion)),
  comparisons: (row) =>
    hasStrings(
      row,
      "group",
      "patterns",
      "distinction",
      "whenToUse",
      "exampleJa",
      "exampleVi",
    ),
  conjugations: (row) =>
    hasStrings(
      row,
      "name",
      "labelJa",
      "recognition",
      "group1",
      "group2",
      "group3",
      "examplesG1",
      "examplesG2",
      "examplesG3",
      "adjI",
      "adjNa",
      "noun",
      "exceptions",
    ),
  keigo: (row) =>
    hasStrings(
      row,
      "plainJa",
      "plainKana",
      "sonkeigo",
      "sonkeigoMasu",
      "kenjogoI",
      "kenjogoII",
      "teineigo",
      "recognition",
      "exampleJa",
      "exampleVi",
    ),
  verbPairs: (row) =>
    hasStrings(
      row,
      "transitiveJa",
      "transitiveKana",
      "intransitiveJa",
      "intransitiveKana",
      "meaning",
    ),
  reading: (row) =>
    hasStrings(row, "title", "text", "translation") &&
    (row.length === "short" || row.length === "medium") &&
    allItems(
      row.vocabulary,
      (item) =>
        isRecord(item) && hasStrings(item, "word", "reading", "meaning"),
    ) &&
    allItems(row.questions, isQuestion),
};

function failure(
  code: PackError["code"],
  detail: string,
): Result<never, PackError> {
  return { ok: false, error: { code, detail } };
}

export function validatePack(raw: unknown): Result<ContentPack, PackError> {
  if (!isRecord(raw)) return failure("schema", "pack");

  const { manifest } = raw;
  if (!isRecord(manifest)) return failure("schema", "manifest");
  const { level, version, counts, sha256 } = manifest;
  if (!LEVELS.some((item) => item === level)) {
    return failure("schema", "manifest.level");
  }
  if (!isVersion(version)) return failure("schema", "manifest.version");
  if (!isRecord(counts)) return failure("schema", "manifest.counts");
  if (!isRecord(sha256)) return failure("schema", "manifest.sha256");

  const ids = new Set<string>();
  for (const table of PACK_TABLES) {
    const entries = raw[table];
    const count = counts[table];
    const digest = sha256[table];
    if (!Array.isArray(entries)) return failure("schema", table);
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      return failure("schema", `manifest.counts.${table}`);
    }
    if (typeof digest !== "string" || !SHA256.test(digest)) {
      return failure("schema", `manifest.sha256.${table}`);
    }
    if (entries.length !== count) {
      return failure(
        "count-mismatch",
        `${table}: ${entries.length} !== ${count}`,
      );
    }
    for (let index = 0; index < entries.length; index++) {
      const entry: unknown = entries[index];
      const path = `${table}[${index}]`;
      if (!isRecord(entry)) return failure("schema", path);
      const { id } = entry;
      if (typeof id !== "string" || id.length < 1 || id.length > 128) {
        return failure("schema", `${path}.id`);
      }
      if (ids.has(id)) return failure("duplicate-id", `${path}.id`);
      if (!rowChecks[table](entry)) return failure("schema", path);
      ids.add(id);
    }
  }

  return { ok: true, value: raw as unknown as ContentPack };
}

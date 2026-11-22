import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Level,
  PACK_TABLES,
  type PackTable,
} from "../../../frontend/src/core/content/types";
import { validatePack } from "../../../frontend/src/core/content/validate";
import { tableFilename } from "./write-table";

function readJson(dir: string, filename: string): unknown {
  return JSON.parse(readFileSync(join(dir, filename), "utf8"));
}

export function verifyPack(
  packDir: string,
  expected: { level: Level; version: string },
): string[] {
  const errors: string[] = [];
  const pack: Record<string, unknown> = {};
  try {
    pack.manifest = readJson(packDir, "manifest.json");
  } catch (error) {
    return [`manifest.json: ${String(error)}`];
  }
  const manifest = pack.manifest;
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    const fields = manifest as Record<string, unknown>;
    if (fields.level !== expected.level)
      errors.push("manifest.level does not match index");
    if (fields.version !== expected.version)
      errors.push("manifest.version does not match index");
  }
  for (const table of PACK_TABLES) {
    const filename = tableFilename(table);
    try {
      const bytes = readFileSync(join(packDir, filename));
      const digest = createHash("sha256").update(bytes).digest("hex");
      const hashes =
        manifest && typeof manifest === "object" && "sha256" in manifest
          ? manifest.sha256
          : undefined;
      if (
        !hashes ||
        typeof hashes !== "object" ||
        !(table in hashes) ||
        hashes[table as keyof typeof hashes] !== digest
      ) {
        errors.push(`${filename}: sha256 mismatch`);
      }
      pack[table] = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      errors.push(`${filename}: ${String(error)}`);
    }
  }
  const result = validatePack(pack);
  if (!result.ok) errors.push(`${result.error.code}: ${result.error.detail}`);
  return errors;
}

const n4Tables = [
  { table: "vocabulary", source: "tu_vung", prefix: "vocab-", count: 1182 },
  { table: "kanji", source: "kanji", prefix: "kanji-", count: 118 },
  { table: "grammar", source: "ngu_phap", prefix: "grammar-", count: 148 },
  { table: "comparisons", source: "so_sanh", prefix: "comparison-", count: 27 },
  {
    table: "conjugations",
    source: "cach_chia",
    prefix: "conjugation-",
    count: 22,
  },
  { table: "keigo", source: "kinh_ngu", prefix: "keigo-", count: 17 },
  {
    table: "verbPairs",
    source: "tu_dong_tha_dong",
    prefix: "verbpair-",
    count: 12,
  },
] as const satisfies readonly {
  table: PackTable;
  source: string;
  prefix: string;
  count: number;
}[];

const originalReadings = new Map([
  ["reading-01", "Lời nhắn gửi đồng nghiệp — 田中さんへのメモ"],
  ["reading-02", "Thông báo của thư viện — 図書館からのお知らせ"],
  ["reading-03", "Tôi bắt đầu nấu ăn — 料理を始めました"],
  ["reading-04", "Lớp học bị hủy — 授業のお知らせ"],
  ["reading-05", "Tàu điện ở Nhật — 日本の電車"],
  ["reading-06", "Tuyển nhân viên làm thêm — アルバイト募集"],
  ["reading-07", "Ngày tôi bị lạc đường — 道に迷った日"],
  ["reading-08", "Vì sức khỏe của bố — 父の健康"],
]);

function readRows(dir: string, filename: string): Record<string, unknown>[] {
  const rows = readJson(dir, filename);
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    throw new Error(`${filename}: expected array of objects`);
  }
  return rows;
}

function readJsonLines(dir: string, source: string): Record<string, unknown>[] {
  const filename = `${source}.jsonl`;
  return readFileSync(join(dir, filename), "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) => {
      if (!line.trim()) return [];
      try {
        const row: unknown = JSON.parse(line);
        if (!row || typeof row !== "object" || Array.isArray(row))
          throw new Error("expected object");
        return [row as Record<string, unknown>];
      } catch (error) {
        throw new Error(`${filename}:${index + 1}: ${String(error)}`);
      }
    });
}

export function verifyN4AgainstDataset(
  packDir: string,
  datasetDir: string,
): string[] {
  const errors: string[] = [];
  for (const { table, source, prefix, count } of n4Tables) {
    try {
      const rows = readRows(packDir, tableFilename(table));
      const raw = readJsonLines(datasetDir, source);
      if (rows.length !== count)
        errors.push(`${table}: expected ${count}, got ${rows.length}`);
      if (raw.length !== count)
        errors.push(`${source}: expected ${count}, got ${raw.length}`);
      if (raw.some((row) => typeof row.id !== "string" || !row.id))
        throw new Error(`${source}: invalid id`);
      if (rows.some((row) => typeof row.id !== "string" || !row.id))
        throw new Error(`${table}: invalid id`);
      const expectedIds = new Set(
        raw.map(
          (row) =>
            `${prefix}${table === "vocabulary" && String(row.id).startsWith("TVN") ? "TV-" : ""}${row.id}`,
        ),
      );
      const actualIds = new Set(rows.map((row) => row.id as string));
      if (expectedIds.size !== raw.length)
        errors.push(`${source}: duplicate IDs`);
      if (actualIds.size !== rows.length)
        errors.push(`${table}: duplicate IDs`);
      for (const id of expectedIds)
        if (!actualIds.has(id)) errors.push(`${table}: missing ${id}`);
      for (const id of actualIds)
        if (!expectedIds.has(id)) errors.push(`${table}: unexpected ${id}`);
    } catch (error) {
      errors.push(`${table}/${source}: ${String(error)}`);
    }
  }
  try {
    const compounds = readRows(packDir, tableFilename("compounds"));
    if (compounds.length !== 388)
      errors.push(`compounds: expected 388, got ${compounds.length}`);
    const raw = readJsonLines(datasetDir, "tu_ghep_kanji");
    if (raw.length !== 403)
      errors.push(`tu_ghep_kanji: expected 403, got ${raw.length}`);
    const firstIds = new Map<string, string>();
    for (const row of raw) {
      if (
        typeof row.compound !== "string" ||
        typeof row.kanji_id !== "string" ||
        typeof row.id !== "string" ||
        !row.id
      ) {
        errors.push("tu_ghep_kanji: invalid id, compound or kanji_id");
      } else {
        if (!firstIds.has(row.compound))
          firstIds.set(row.compound, `compound-${row.id}`);
        if (
          !compounds.some(
            (entry) =>
              entry.word === row.compound &&
              Array.isArray(entry.kanjiIds) &&
              entry.kanjiIds.includes(`kanji-${row.kanji_id}`),
          )
        )
          errors.push(
            `tu_ghep_kanji: missing ${row.compound} / ${row.kanji_id}`,
          );
      }
    }
    const seenWords = new Set<unknown>();
    for (const entry of compounds) {
      const expected =
        typeof entry.word === "string" ? firstIds.get(entry.word) : undefined;
      if (expected === undefined || entry.id !== expected)
        errors.push(
          `compounds: ${String(entry.word)} expected ${String(expected)}, got ${String(entry.id)}`,
        );
      if (seenWords.has(entry.word))
        errors.push(`compounds: duplicate word ${String(entry.word)}`);
      seenWords.add(entry.word);
    }
  } catch (error) {
    errors.push(`tu_ghep_kanji/compounds: ${String(error)}`);
  }
  try {
    const readings = readRows(packDir, tableFilename("reading"));
    const ids = new Set(readings.map((row) => row.id));
    for (const [id, title] of originalReadings) {
      if (!ids.has(id)) errors.push(`reading: missing ${id}`);
      if (
        readings.some(
          (row) =>
            typeof row.id === "string" &&
            originalReadings.has(row.id) &&
            row.id !== id &&
            row.title === title,
        )
      ) {
        errors.push(
          `reading: original title for ${id} assigned to another original ID`,
        );
      }
    }
  } catch (error) {
    errors.push(`reading: ${String(error)}`);
  }
  return errors;
}

export function removedIds(prevPackDir: string, nextPackDir: string): string[] {
  const ids = (dir: string) =>
    PACK_TABLES.flatMap((table) =>
      readRows(dir, tableFilename(table)).map((row) => {
        if (typeof row.id !== "string" || !row.id)
          throw new Error(`${table}: invalid id`);
        return row.id;
      }),
    );
  const previous = ids(prevPackDir);
  const next = new Set(ids(nextPackDir));
  return previous.filter((id) => !next.has(id));
}

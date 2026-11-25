import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ComparisonLinkReport } from "../../../frontend/src/core/content/comparisonLinks";
import {
  LEVELS,
  type Level,
  PACK_TABLES,
  type PackManifest,
  type PackTable,
} from "../../../frontend/src/core/content/types";
import {
  isVersion,
  validatePack,
} from "../../../frontend/src/core/content/validate";
import { tableFilename } from "./write-table";

function checkPack(pack: unknown): void {
  const result = validatePack(pack);
  if (!result.ok) throw new Error(`Invalid pack: ${result.error.detail}`);
}

function checkMetadata(level: Level, version: string): void {
  if (!LEVELS.includes(level) || !isVersion(version)) {
    throw new Error("Invalid pack level or version");
  }
}

export function buildPack(
  level: Level,
  contentDir: string,
  outDir: string,
  version: string,
  mirrorDir?: string,
): PackManifest {
  checkMetadata(level, version);
  const bytes = new Map<PackTable, Buffer>();
  const tables: Record<string, unknown> = {};
  const counts = {} as Record<PackTable, number>;
  const sha256 = {} as Record<PackTable, string>;
  for (const table of PACK_TABLES) {
    const data = readFileSync(join(contentDir, tableFilename(table)));
    const rows: unknown = JSON.parse(data.toString("utf8"));
    bytes.set(table, data);
    tables[table] = rows;
    counts[table] = Array.isArray(rows) ? rows.length : 0;
    sha256[table] = createHash("sha256").update(data).digest("hex");
  }
  const manifest: PackManifest = { level, version, counts, sha256 };
  checkPack({ ...tables, manifest });

  const destinations = [outDir, ...(mirrorDir ? [mirrorDir] : [])].map((dir) =>
    join(dir, level, version),
  );
  for (const packDir of destinations) {
    try {
      const previous: unknown = JSON.parse(
        readFileSync(join(packDir, "manifest.json"), "utf8"),
      );
      if (!isDeepStrictEqual(previous, manifest))
        throw new Error(
          `Pack content already exists for ${level}/${version}; bump the version`,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const packDir of destinations) {
    mkdirSync(packDir, { recursive: true });
    for (const [table, data] of bytes)
      writeFileSync(join(packDir, tableFilename(table)), data);
    writeFileSync(
      join(packDir, "manifest.json"),
      JSON.stringify(manifest, null, 1),
      "utf8",
    );
  }
  return manifest;
}

export function writeIndex(
  outDir: string,
  entries: { level: Level; version: string }[],
): void {
  const levels = entries.map(({ level, version }) => {
    checkMetadata(level, version);
    return { level, version, path: `${level}/${version}` };
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify({ levels }, null, 1),
    "utf8",
  );
}

export function formatComparisonLinkReport(
  level: Level,
  report: ComparisonLinkReport,
): string | null {
  if (report.unmatched.length === 0) return null;
  let totalParts = 0;
  for (const parts of report.partsByComparisonId.values()) {
    totalParts += parts.length;
  }
  const matchedParts = totalParts - report.unmatched.length;
  const lines = [
    `[packs] ${level} comparison links: ${matchedParts}/${totalParts} parts matched, ${report.unmatched.length} unmatched:`,
    ...report.unmatched.map(
      ({ comparisonId, group, part }) =>
        `  - ${comparisonId} (${group}): ${part}`,
    ),
  ];
  return lines.join("\n");
}

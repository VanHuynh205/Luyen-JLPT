import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackTable } from "../../../frontend/src/core/content/types";

export function tableFilename(table: PackTable): string {
  return table === "verbPairs" ? "verb-pairs.json" : `${table}.json`;
}

export function writeTable(
  outDir: string,
  table: PackTable,
  rows: readonly unknown[],
): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, tableFilename(table)),
    JSON.stringify(rows, null, 1),
    "utf8",
  );
}

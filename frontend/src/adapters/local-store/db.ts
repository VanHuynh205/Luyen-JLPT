import Dexie, { type Table } from "dexie";
import type { ContentPack, Level } from "../../core/content/types";
import type { ProgressKind, ProgressRow } from "../../core/progress";
import type { Cursor, OutboxEntry } from "../../core/sync";

type PackRow = {
  level: Level;
  version: string;
  pack: ContentPack;
  checksum: string;
};
type Setting = { key: string; value: unknown };

export const db = new Dexie("luyen-jlpt") as Dexie & {
  packs: Table<PackRow, [Level, string]>;
  settings: Table<Setting, string>;
  progress: Table<ProgressRow, [string, Level, ProgressKind, string]>;
  progressOutbox: Table<OutboxEntry, string>;
  progressCursors: Table<
    { owner: string; kind: ProgressKind; cursor: Cursor },
    [string, ProgressKind]
  >;
};

db.version(1).stores({ packs: "[level+version]", settings: "key" });
db.version(2).stores({
  progress: "[owner+level+kind+id], [owner+level], [owner+kind+id], owner",
  progressOutbox: "opId, owner",
  progressCursors: "[owner+kind]",
});

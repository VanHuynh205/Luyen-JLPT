import Dexie, { type Table } from "dexie";
import type { ContentPack, Level } from "../../core/content/types";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamSectionAttemptSummary,
  ExamSectionKey,
} from "../../core/exam/types";
import type { ProgressKind, ProgressRow } from "../../core/progress";
import type { Cursor, OutboxEntry } from "../../core/sync";

export interface ActiveExamDraft {
  owner: string;
  level: Level;
  examId: string;
  attemptId: string;
  activeIndex: number;
  answers: Record<string, number>;
  startedAtMs: Partial<Record<ExamSectionKey, number>>;
  deadlineMs: Partial<Record<ExamSectionKey, number>>;
  listeningScriptMode: boolean;
  savedAt: string;
}

type PackRow = {
  level: Level;
  version: string;
  pack: ContentPack;
  checksum: string;
};
type Setting = { key: string; value: unknown };
type ExamPackRow = {
  level: Level;
  id: string;
  exam: ExamDocument;
  sha256: string;
};

// Reserved AD-14 v4 store row shapes (fully modeled in Epic 8-11)
type SrsCardPlaceholder = {
  owner: string;
  level: Level;
  cardType: string;
  itemId: string;
  dueAt: string;
  [key: string]: unknown;
};
type SrsReviewPlaceholder = {
  id: string;
  owner: string;
  level: Level;
  cardType: string;
  itemId: string;
  reviewedAt: string;
  [key: string]: unknown;
};
type ExtensionPackPlaceholder = {
  packId: string;
  entryKey: string;
  [key: string]: unknown;
};
type UserMnemonicPlaceholder = {
  owner: string;
  level: Level;
  kanjiId: string;
  [key: string]: unknown;
};
type NotebookPlaceholder = {
  id: string;
  owner: string;
  updatedAt: string;
  [key: string]: unknown;
};
type NotebookItemPlaceholder = {
  id: string;
  owner: string;
  notebookId: string;
  itemType: string;
  [key: string]: unknown;
};

type LegacyExamAttemptRow = Omit<
  ExamAttemptRecord,
  "status" | "attemptNumber" | "startedAt" | "updatedAt" | "sections"
> & {
  status?: ExamAttemptRecord["status"];
  attemptNumber?: number;
  startedAt?: string;
  updatedAt?: string;
  sections?: Array<
    Omit<ExamSectionAttemptSummary, "submittedAt"> & {
      submittedAt?: string | null;
    }
  >;
};

function compareIsoAscending(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (
    Number.isFinite(leftMs) &&
    Number.isFinite(rightMs) &&
    leftMs !== rightMs
  ) {
    return leftMs < rightMs ? -1 : 1;
  }
  return left.localeCompare(right);
}

export const db = new Dexie("luyen-jlpt") as Dexie & {
  packs: Table<PackRow, [Level, string]>;
  settings: Table<Setting, string>;
  progress: Table<ProgressRow, [string, Level, ProgressKind, string]>;
  progressOutbox: Table<OutboxEntry, string>;
  progressCursors: Table<
    { owner: string; kind: ProgressKind; cursor: Cursor },
    [string, ProgressKind]
  >;
  examAttempts: Table<ExamAttemptRecord, string>;
  examPacks: Table<ExamPackRow, [Level, string]>;
  activeExamDrafts: Table<ActiveExamDraft, [string, Level, string]>;
  srsCards: Table<SrsCardPlaceholder, [string, Level, string, string]>;
  srsReviews: Table<SrsReviewPlaceholder, string>;
  extensionPacks: Table<ExtensionPackPlaceholder, [string, string]>;
  userMnemonics: Table<UserMnemonicPlaceholder, [string, Level, string]>;
  notebooks: Table<NotebookPlaceholder, string>;
  notebookItems: Table<NotebookItemPlaceholder, string>;
};

db.version(1).stores({ packs: "[level+version]", settings: "key" });
db.version(2).stores({
  progress: "[owner+level+kind+id], [owner+level], [owner+kind+id], owner",
  progressOutbox: "opId, owner",
  progressCursors: "[owner+kind]",
});
db.version(3).stores({
  examAttempts: "id, [owner+level], [owner+level+examId], completedAt",
  examPacks: "[level+id]",
});
db.version(4)
  .stores({
    packs: "[level+version]",
    settings: "key",
    progress: "[owner+level+kind+id], [owner+level], [owner+kind+id], owner",
    progressOutbox: "opId, owner",
    progressCursors: "[owner+kind]",
    examPacks: "[level+id]",
    examAttempts:
      "id, owner, [owner+level], [owner+level+examId], [owner+level+examId+status], completedAt",
    activeExamDrafts: "[owner+level+examId], owner",
    srsCards:
      "[owner+level+cardType+itemId], [owner+level+dueAt], [owner+level], owner",
    srsReviews:
      "id, [owner+level+reviewedAt], [owner+level+cardType+itemId], owner",
    extensionPacks: "[packId+entryKey], packId, entryKey",
    userMnemonics: "[owner+level+kanjiId], owner, [owner+level]",
    notebooks: "id, owner, [owner+updatedAt]",
    notebookItems:
      "id, owner, [owner+notebookId], [owner+notebookId+itemType], [owner+itemType]",
  })
  .upgrade(async (tx) => {
    const table = tx.table<LegacyExamAttemptRow, string>("examAttempts");
    const rows = await table.toArray();
    if (rows.length === 0) return;

    const groups = new Map<string, LegacyExamAttemptRow[]>();
    for (const row of rows) {
      const key = `${row.owner}\0${row.level}\0${row.examId}`;
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }

    const migrated: ExamAttemptRecord[] = [];
    for (const groupRows of groups.values()) {
      groupRows.sort((left, right) => {
        const leftTs =
          left.completedAt ?? left.updatedAt ?? left.startedAt ?? "";
        const rightTs =
          right.completedAt ?? right.updatedAt ?? right.startedAt ?? "";
        return (
          compareIsoAscending(leftTs, rightTs) ||
          left.id.localeCompare(right.id)
        );
      });

      let nextAttemptNumber = 1;
      for (const row of groupRows) {
        const fallbackTimestamp =
          row.completedAt ??
          row.updatedAt ??
          row.startedAt ??
          new Date().toISOString();
        const status = row.status ?? "completed";
        const attemptNumber =
          typeof row.attemptNumber === "number" &&
          Number.isInteger(row.attemptNumber) &&
          row.attemptNumber >= nextAttemptNumber
            ? row.attemptNumber
            : nextAttemptNumber;
        nextAttemptNumber = attemptNumber + 1;

        migrated.push({
          ...row,
          status,
          attemptNumber,
          startedAt: row.startedAt ?? fallbackTimestamp,
          completedAt:
            status === "completed"
              ? (row.completedAt ?? fallbackTimestamp)
              : null,
          updatedAt: row.updatedAt ?? fallbackTimestamp,
          sections: (row.sections ?? []).map((section) => ({
            ...section,
            submittedAt:
              section.submittedAt !== undefined
                ? section.submittedAt
                : section.status === "pending"
                  ? null
                  : fallbackTimestamp,
          })),
        });
      }
    }

    await table.bulkPut(migrated);
  });

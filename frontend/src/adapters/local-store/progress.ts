import { mergeExamAttempts } from "../../core/exam/engine";
import {
  EXAM_SECTION_KEYS,
  type ExamAttemptRecord,
} from "../../core/exam/types";
import {
  GUEST_OWNER,
  type KanjiQuizInput,
  PROGRESS_KINDS,
  type ProgressKind,
  type ProgressRow,
  type ProgressScope,
  type ReadingAttemptInput,
  isState,
  summarizeProgress,
  timestampKey,
  toKanjiResult,
  validateProgressRow,
} from "../../core/progress";
import type { Cursor, PulledRow } from "../../core/sync";
import { type ActiveExamDraft, db } from "./db";
import { fromExamProgressRow, toExamProgressRow } from "./exams";
import { isOwnerRetired, ownerRetirementKey } from "./retirement";

function newProgressId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10),
  ]
    .map((part) => part.join(""))
    .join("-");
}

function rowKey(
  row: ProgressRow,
): [string, ProgressScope["level"], ProgressKind, string] {
  return [row.owner, row.level, row.kind, row.id];
}

function getPrevious(row: ProgressRow) {
  return isState(row)
    ? db.progress.get(rowKey(row))
    : db.progress
        .where("[owner+kind+id]")
        .equals([row.owner, row.kind, row.id])
        .first();
}

async function queue(row: ProgressRow) {
  if (row.owner !== GUEST_OWNER) {
    await db.progressOutbox.add({
      opId: newProgressId(),
      owner: row.owner,
      row,
    });
  }
}

async function write(row: ProgressRow) {
  validateProgressRow(row);
  return db.transaction(
    "rw",
    db.progress,
    db.progressOutbox,
    db.settings,
    async () => {
      if (await isOwnerRetired(row.owner)) throw new Error("Owner is retired");
      const previous = await getPrevious(row);
      if (previous) {
        if (!isState(row)) {
          if (previous.level !== row.level)
            throw new Error("Progress attempt belongs to a different level");
          return previous;
        }
        if (timestampKey(row.updatedAt) <= timestampKey(previous.updatedAt)) {
          row.updatedAt = new Date(
            Date.parse(previous.updatedAt) + 1,
          ).toISOString();
        }
      }
      await db.progress.put(row);
      await queue(row);
      return row;
    },
  );
}

function shouldClearDraftAfterPull(
  draft: ActiveExamDraft,
  existing: ExamAttemptRecord | undefined,
  merged: ExamAttemptRecord,
): boolean {
  if (draft.attemptId !== merged.id) return false;
  if (merged.status === "completed") return true;

  const activeKey = EXAM_SECTION_KEYS[draft.activeIndex];
  const mergedActive = merged.sections.find((s) => s.key === activeKey);
  if (mergedActive && mergedActive.status !== "pending") {
    return true;
  }

  if (existing) {
    for (const mergedSec of merged.sections) {
      if (mergedSec.status === "pending") continue;
      const prevSec = existing.sections.find((s) => s.key === mergedSec.key);
      if (!prevSec || prevSec.status === "pending") {
        return true;
      }
    }
  }
  return false;
}

export const progressStore = {
  async setCardStatus(scope: ProgressScope, itemId: string, known: boolean) {
    await write({
      ...scope,
      kind: "card_status",
      id: itemId,
      known,
      updatedAt: new Date().toISOString(),
    });
  },

  async setGrammarLearned(
    scope: ProgressScope,
    itemId: string,
    learned: boolean,
  ) {
    await write({
      ...scope,
      kind: "grammar_learned",
      id: itemId,
      learned,
      updatedAt: new Date().toISOString(),
    });
  },

  async recordKanjiQuiz(
    scope: ProgressScope,
    { mode, score, total, wrongItemIds, id = newProgressId() }: KanjiQuizInput,
  ) {
    const attempt = await write({
      ...scope,
      kind: "kanji_quiz_attempts",
      id,
      mode,
      score,
      total,
      wrongItemIds,
      updatedAt: new Date().toISOString(),
    });
    if (attempt.kind !== "kanji_quiz_attempts")
      throw new Error("Unexpected progress attempt");
    return toKanjiResult(attempt);
  },

  async recordReadingAttempt(
    scope: ProgressScope,
    { passageId, score, total, id = newProgressId() }: ReadingAttemptInput,
  ) {
    const attempt = await write({
      ...scope,
      kind: "reading_attempts",
      id,
      passageId,
      score,
      total,
      updatedAt: new Date().toISOString(),
    });
    const results = (await progressStore.getSummary(scope)).readingResults;
    return results.find(
      (result) =>
        attempt.kind === "reading_attempts" &&
        result.passageId === attempt.passageId,
    )!;
  },

  async getSummary({ owner, level }: ProgressScope) {
    return summarizeProgress(
      await db.progress.where("[owner+level]").equals([owner, level]).toArray(),
    );
  },

  async hasGuestProgress() {
    const [progressCount, examCount, draftCount] = await Promise.all([
      db.progress.where("owner").equals(GUEST_OWNER).count(),
      db.examAttempts.where("owner").equals(GUEST_OWNER).count(),
      db.activeExamDrafts.where("owner").equals(GUEST_OWNER).count(),
    ]);
    return progressCount + examCount + draftCount > 0;
  },

  isRetired: isOwnerRetired,

  async purgeOwner(owner: string) {
    if (!owner || owner === GUEST_OWNER) return;
    await db.transaction(
      "rw",
      [
        db.progress,
        db.progressOutbox,
        db.progressCursors,
        db.examAttempts,
        db.activeExamDrafts,
        db.srsCards,
        db.srsReviews,
        db.notebooks,
        db.notebookItems,
        db.userMnemonics,
        db.settings,
      ],
      async () => {
        await db.settings.put({ key: ownerRetirementKey(owner), value: true });
        await db.settings.delete(`level:${owner}`);
        await db.progress.where("owner").equals(owner).delete();
        await db.progressOutbox.where("owner").equals(owner).delete();
        await db.progressCursors.bulkDelete(
          PROGRESS_KINDS.map((kind) => [owner, kind]),
        );
        await db.examAttempts.where("owner").equals(owner).delete();
        await db.activeExamDrafts.where("owner").equals(owner).delete();
        await db.srsCards.where("owner").equals(owner).delete();
        await db.srsReviews.where("owner").equals(owner).delete();
        await db.notebooks.where("owner").equals(owner).delete();
        await db.notebookItems.where("owner").equals(owner).delete();
        await db.userMnemonics.where("owner").equals(owner).delete();
      },
    );
  },

  async mergeGuest(owner: string, consent: boolean) {
    if (!consent || !owner || owner === GUEST_OWNER) return false;
    return db.transaction(
      "rw",
      [
        db.progress,
        db.progressOutbox,
        db.examAttempts,
        db.activeExamDrafts,
        db.settings,
      ],
      async () => {
        if (await isOwnerRetired(owner)) return false;

        const guest = db.progress.where("owner").equals(GUEST_OWNER);
        const rows = await guest.toArray();
        for (const source of rows) {
          const row = { ...source, owner };
          const previous = await getPrevious(row);
          if (
            previous &&
            (!isState(row) ||
              timestampKey(previous.updatedAt) >= timestampKey(row.updatedAt))
          )
            continue;
          await db.progress.put(row);
          await queue(row);
        }
        await guest.delete();

        const guestAttempts = await db.examAttempts
          .where("owner")
          .equals(GUEST_OWNER)
          .toArray();
        guestAttempts.sort(
          (left, right) =>
            timestampKey(left.startedAt).localeCompare(
              timestampKey(right.startedAt),
            ) ||
            left.attemptNumber - right.attemptNumber ||
            left.id.localeCompare(right.id),
        );

        const migratedInProgressIds = new Set<string>();
        for (const source of guestAttempts) {
          const existingSameId = await db.examAttempts.get(source.id);
          if (existingSameId && existingSameId.owner === owner) continue;

          const ownerExamAttempts = await db.examAttempts
            .where("[owner+level+examId]")
            .equals([owner, source.level, source.examId])
            .toArray();
          const hasOwnerInProgress = ownerExamAttempts.some(
            (attempt) => attempt.status === "in_progress",
          );
          if (source.status === "in_progress" && hasOwnerInProgress) {
            continue;
          }

          let maxAttemptNumber = 0;
          for (const attempt of ownerExamAttempts) {
            if (attempt.attemptNumber > maxAttemptNumber) {
              maxAttemptNumber = attempt.attemptNumber;
            }
          }
          const migrated: ExamAttemptRecord = {
            ...source,
            owner,
            attemptNumber: maxAttemptNumber + 1,
          };
          const progressRow = toExamProgressRow(migrated);
          validateProgressRow(progressRow);
          await db.examAttempts.put(migrated);
          await queue(progressRow);
          if (migrated.status === "in_progress") {
            migratedInProgressIds.add(migrated.id);
          }
        }
        await db.examAttempts.where("owner").equals(GUEST_OWNER).delete();

        const guestDrafts = await db.activeExamDrafts
          .where("owner")
          .equals(GUEST_OWNER)
          .toArray();
        for (const draft of guestDrafts) {
          const existingDraft = await db.activeExamDrafts.get([
            owner,
            draft.level,
            draft.examId,
          ]);
          if (existingDraft) continue;
          const activeOwnerAttempts = await db.examAttempts
            .where("[owner+level+examId+status]")
            .equals([owner, draft.level, draft.examId, "in_progress"])
            .toArray();
          const conflictsWithOtherActive = activeOwnerAttempts.some(
            (attempt) =>
              attempt.id !== draft.attemptId &&
              !migratedInProgressIds.has(draft.attemptId),
          );
          if (conflictsWithOtherActive) continue;
          await db.activeExamDrafts.put({ ...draft, owner });
        }
        await db.activeExamDrafts.where("owner").equals(GUEST_OWNER).delete();

        return (
          rows.length > 0 || guestAttempts.length > 0 || guestDrafts.length > 0
        );
      },
    );
  },

  listPending(owner: string, limit: number) {
    return db.progressOutbox
      .where("owner")
      .equals(owner)
      .limit(limit)
      .toArray();
  },

  async acknowledge(owner: string, opIds: string[]) {
    await db.progressOutbox
      .where("opId")
      .anyOf(opIds)
      .and((entry) => entry.owner === owner)
      .delete();
  },

  async getCursor(owner: string, kind: ProgressKind) {
    return (await db.progressCursors.get([owner, kind]))?.cursor ?? null;
  },

  async applyPulledPage(
    owner: string,
    kind: ProgressKind,
    after: Cursor | null,
    page: PulledRow[],
  ) {
    if (!page.length) return false;
    return db.transaction(
      "rw",
      [
        db.progress,
        db.progressCursors,
        db.examAttempts,
        db.activeExamDrafts,
        db.settings,
      ],
      async () => {
        if (await isOwnerRetired(owner))
          throw new DOMException("Owner is retired", "AbortError");
        const current = await progressStore.getCursor(owner, kind);
        if (
          current?.serverUpdatedAt !== after?.serverUpdatedAt ||
          current?.id !== after?.id
        )
          return false;
        for (const { row } of page) {
          if (row.owner !== owner || row.kind !== kind)
            throw new Error("Progress page scope mismatch");
          validateProgressRow(row);
          if (row.kind === "exam_attempts") {
            const incoming = fromExamProgressRow(row);
            const existing = await db.examAttempts.get(incoming.id);
            const merged = existing
              ? mergeExamAttempts(existing, incoming)
              : incoming;
            await db.examAttempts.put(merged);
            const draft = await db.activeExamDrafts.get([
              merged.owner,
              merged.level,
              merged.examId,
            ]);
            if (draft && shouldClearDraftAfterPull(draft, existing, merged)) {
              await db.activeExamDrafts.delete([
                merged.owner,
                merged.level,
                merged.examId,
              ]);
            }
            continue;
          }
          const previous = await getPrevious(row);
          if (previous && previous.level !== row.level)
            await db.progress.delete(rowKey(previous));
          if (
            !previous ||
            !isState(row) ||
            timestampKey(row.updatedAt) >= timestampKey(previous.updatedAt)
          ) {
            await db.progress.put(row);
          }
        }
        await db.progressCursors.put({
          owner,
          kind,
          cursor: page[page.length - 1].cursor,
        });
        return true;
      },
    );
  },
};

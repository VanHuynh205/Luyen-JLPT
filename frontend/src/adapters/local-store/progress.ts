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
import { db } from "./db";
import { isOwnerRetired, ownerRetirementKey } from "./retirement";

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
      opId: crypto.randomUUID(),
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
    {
      mode,
      score,
      total,
      wrongItemIds,
      id = crypto.randomUUID(),
    }: KanjiQuizInput,
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
    { passageId, score, total, id = crypto.randomUUID() }: ReadingAttemptInput,
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
    return (await db.progress.where("owner").equals(GUEST_OWNER).count()) > 0;
  },

  isRetired: isOwnerRetired,

  async purgeOwner(owner: string) {
    if (!owner || owner === GUEST_OWNER) return;
    await db.transaction(
      "rw",
      db.progress,
      db.progressOutbox,
      db.progressCursors,
      db.settings,
      async () => {
        await db.settings.put({ key: ownerRetirementKey(owner), value: true });
        await db.settings.delete(`level:${owner}`);
        await db.progress.where("owner").equals(owner).delete();
        await db.progressOutbox.where("owner").equals(owner).delete();
        await db.progressCursors.bulkDelete(
          PROGRESS_KINDS.map((kind) => [owner, kind]),
        );
      },
    );
  },

  async mergeGuest(owner: string, consent: boolean) {
    if (!consent || !owner || owner === GUEST_OWNER) return false;
    return db.transaction(
      "rw",
      db.progress,
      db.progressOutbox,
      db.settings,
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
        return rows.length > 0;
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
      db.progress,
      db.progressCursors,
      db.settings,
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

import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ExamAttemptRecord } from "../../core/exam/types";
import { db } from "./db";
import { examStore } from "./exams";
import { progressStore } from "./progress";

const guest = { owner: "guest", level: "n4" } as const;
const account = { owner: "account", level: "n4" } as const;
const id = "9fef9a7e-181c-45e6-be34-7a6b567a019f";

beforeEach(() => db.open());
afterEach(() => db.delete());

it("can save an attempt and queue its UUID on an older webview", async () => {
  vi.stubGlobal("crypto", {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  });
  try {
    await progressStore.recordReadingAttempt(account, {
      passageId: "reading",
      score: 1,
      total: 2,
    });
    const [entry] = await progressStore.listPending(account.owner, 10);
    const uuid =
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
    expect(entry.opId).toMatch(uuid);
    expect(entry.row.id).toMatch(uuid);
    expect(entry.opId).not.toBe(entry.row.id);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("merges across levels only with consent and queues for the consenting account", async () => {
  await progressStore.setCardStatus(guest, "same-id", true);
  await progressStore.setCardStatus(
    { ...guest, level: "n3" },
    "same-id",
    false,
  );
  expect(await progressStore.mergeGuest(account.owner, false)).toBe(false);
  expect((await progressStore.getSummary(account)).flashcards).toEqual([]);
  expect(await progressStore.listPending(guest.owner, 10)).toEqual([]);

  expect(await progressStore.mergeGuest(account.owner, true)).toBe(true);
  expect(await progressStore.hasGuestProgress()).toBe(false);
  expect((await progressStore.getSummary(account)).knownFlashcardCount).toBe(
    1n,
  );
  expect(
    (await progressStore.getSummary({ ...account, level: "n3" })).flashcards,
  ).toEqual([{ cardId: "same-id", known: false }]);
  expect(
    (await progressStore.getSummary({ ...account, owner: "other" })).flashcards,
  ).toEqual([]);
  expect(await progressStore.listPending(account.owner, 10)).toHaveLength(2);
  expect(await progressStore.mergeGuest("other", true)).toBe(false);
});

it("keeps attempts immutable, derives summaries, and rejects invalid scores", async () => {
  const attempt = { id, passageId: "reading", score: 1, total: 2 };
  await progressStore.recordReadingAttempt(account, attempt);
  await progressStore.recordReadingAttempt(account, { ...attempt, score: 2 });
  await expect(
    progressStore.recordReadingAttempt({ ...account, level: "n3" }, attempt),
  ).rejects.toThrow("different level");
  await progressStore.recordReadingAttempt(account, {
    ...attempt,
    id: undefined,
    score: 0,
  });
  await expect(
    progressStore.recordReadingAttempt(account, { ...attempt, score: 3 }),
  ).rejects.toThrow();
  expect((await progressStore.getSummary(account)).readingResults).toEqual([
    expect.objectContaining({
      passageId: "reading",
      attempts: 2n,
      bestScore: 1n,
    }),
  ]);
  expect(await progressStore.listPending(account.owner, 10)).toHaveLength(2);
});

it("purges only the requested owner's progress, queue, cursors and preference", async () => {
  await progressStore.setGrammarLearned(account, "grammar", true);
  await progressStore.setGrammarLearned(guest, "grammar", true);
  const cursor = { id: "item", serverUpdatedAt: "2026-11-22T01:00:00Z" };
  await db.progressCursors.bulkPut([
    { owner: account.owner, kind: "card_status", cursor },
    { owner: "other", kind: "card_status", cursor },
  ]);
  await db.settings.bulkPut([
    { key: `level:${account.owner}`, value: { level: "n3", pending: true } },
    { key: "level:other", value: { level: "n4", pending: false } },
    { key: "level", value: "n3" },
  ]);
  await progressStore.purgeOwner(account.owner);
  await progressStore.purgeOwner(account.owner);
  await progressStore.purgeOwner(guest.owner);
  expect(await db.settings.get(`level:${account.owner}`)).toBeUndefined();
  expect((await db.settings.get("level:other"))?.value).toEqual({
    level: "n4",
    pending: false,
  });
  expect((await db.settings.get("level"))?.value).toBe("n3");
  expect(await progressStore.listPending(account.owner, 10)).toEqual([]);
  expect((await progressStore.getSummary(account)).learnedGrammarIds).toEqual(
    [],
  );
  expect((await progressStore.getSummary(guest)).learnedGrammarIds).toEqual([
    "grammar",
  ]);
  expect(
    await progressStore.getCursor(account.owner, "card_status"),
  ).toBeNull();
  expect(await progressStore.getCursor("other", "card_status")).toEqual(cursor);
});

it("rejects a late first page without restoring progress or a cursor", async () => {
  const kind = "card_status";
  const after = await progressStore.getCursor(account.owner, kind);
  expect(after).toBeNull();
  const updatedAt = "2026-11-22T01:00:00Z";
  const cursor = { id: "card", serverUpdatedAt: updatedAt };
  await progressStore.purgeOwner(account.owner);
  await expect(
    progressStore.applyPulledPage(account.owner, kind, after, [
      {
        row: { ...account, kind, id: cursor.id, known: true, updatedAt },
        cursor,
      },
    ]),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(await db.progress.where("owner").equals(account.owner).count()).toBe(
    0,
  );
  expect(await db.progressCursors.get([account.owner, kind])).toBeUndefined();
});

it("fences stale writes and guest merge on a second connection", async () => {
  vi.resetModules();
  const { db: otherTabDb } = await import("./db");
  const { progressStore: otherTabStore } = await import("./progress");
  expect(otherTabDb).not.toBe(db);
  await otherTabDb.open();
  try {
    await otherTabStore.setCardStatus(account, "old-card", true);
    await progressStore.setCardStatus(guest, "guest-card", true);
    await progressStore.purgeOwner(account.owner);

    await expect(
      otherTabStore.setCardStatus(account, "late-card", true),
    ).rejects.toThrow("Owner is retired");
    expect(await otherTabStore.mergeGuest(account.owner, true)).toBe(false);
    expect(await otherTabStore.isRetired(account.owner)).toBe(true);
    expect(await otherTabStore.isRetired(guest.owner)).toBe(false);
    expect(await otherTabStore.isRetired("other")).toBe(false);
    expect((await otherTabStore.getSummary(account)).flashcards).toEqual([]);
    expect(await otherTabStore.listPending(account.owner, 10)).toEqual([]);
    expect(await otherTabStore.hasGuestProgress()).toBe(true);
  } finally {
    otherTabDb.close();
  }
});

it("rolls back retirement if purge cannot remove a cursor", async () => {
  const kind = "card_status";
  const cursor = { id: "card", serverUpdatedAt: "2026-11-22T01:00:00Z" };
  const preference = { key: `level:${account.owner}`, value: "n3" };
  await db.settings.put(preference);
  await db.progressCursors.put({ owner: account.owner, kind, cursor });
  await progressStore.setCardStatus(account, cursor.id, true);
  const fail = () => {
    throw new Error("cursor unavailable");
  };
  db.progressCursors.hook("deleting", fail);
  try {
    await expect(progressStore.purgeOwner(account.owner)).rejects.toThrow(
      "cursor unavailable",
    );
    expect(await progressStore.isRetired(account.owner)).toBe(false);
    expect(await db.settings.get(preference.key)).toEqual(preference);
    expect((await progressStore.getSummary(account)).flashcards).toHaveLength(
      1,
    );
    expect(await progressStore.listPending(account.owner, 10)).toHaveLength(1);
    expect(await progressStore.getCursor(account.owner, kind)).toEqual(cursor);
  } finally {
    db.progressCursors.hook("deleting").unsubscribe(fail);
  }
  await progressStore.purgeOwner(account.owner);
  expect(await progressStore.isRetired(account.owner)).toBe(true);
});

it("rolls back the local write when its outbox entry cannot be written", async () => {
  await db.open();
  const outbox = db.table("progressOutbox");
  const fail = () => {
    throw new Error("outbox unavailable");
  };
  outbox.hook("creating", fail);
  try {
    await expect(
      progressStore.setGrammarLearned(account, "grammar", true),
    ).rejects.toThrow("outbox unavailable");
    expect((await progressStore.getSummary(account)).learnedGrammarIds).toEqual(
      [],
    );
  } finally {
    outbox.hook("creating").unsubscribe(fail);
  }
});

it("wipes all owner-scoped v4 tables in purgeOwner while preserving ownerB (SEC-T04)", async () => {
  const attemptA: ExamAttemptRecord = {
    id: "66666666-6666-4666-8666-666666666666",
    owner: "ownerA",
    level: "n4",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T08:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:10:00.000Z",
    totalScore: 1,
    totalQuestions: 2,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 300,
        submittedAt: "2026-11-27T08:10:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { q1: 0 },
  };
  const attemptB: ExamAttemptRecord = {
    ...attemptA,
    id: "77777777-7777-4777-8777-777777777777",
    owner: "ownerB",
  };

  await examStore.saveAttemptProgress(attemptA);
  await examStore.saveAttemptProgress(attemptB);
  await examStore.saveDraft({
    owner: "ownerA",
    level: "n4",
    examId: "n4-2024-12",
    attemptId: attemptA.id,
    activeIndex: 1,
    answers: { q2: 1 },
    startedAtMs: { grammar_reading: 1_700_000_000_000 },
    deadlineMs: { grammar_reading: 1_700_003_300_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:12:00.000Z",
  });
  await examStore.saveDraft({
    owner: "ownerB",
    level: "n4",
    examId: "n4-2024-12",
    attemptId: attemptB.id,
    activeIndex: 1,
    answers: { q2: 2 },
    startedAtMs: { grammar_reading: 1_700_000_000_000 },
    deadlineMs: { grammar_reading: 1_700_003_300_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:12:00.000Z",
  });
  await db.srsCards.bulkPut([
    {
      owner: "ownerA",
      level: "n4",
      cardType: "vocab",
      itemId: "v1",
      dueAt: "2026-11-28T00:00:00.000Z",
    },
    {
      owner: "ownerB",
      level: "n4",
      cardType: "vocab",
      itemId: "v1",
      dueAt: "2026-11-28T00:00:00.000Z",
    },
  ]);
  await db.srsReviews.bulkPut([
    {
      id: "rA",
      owner: "ownerA",
      level: "n4",
      cardType: "vocab",
      itemId: "v1",
      reviewedAt: "2026-11-27T08:00:00.000Z",
    },
    {
      id: "rB",
      owner: "ownerB",
      level: "n4",
      cardType: "vocab",
      itemId: "v1",
      reviewedAt: "2026-11-27T08:00:00.000Z",
    },
  ]);
  await db.userMnemonics.bulkPut([
    { owner: "ownerA", level: "n4", kanjiId: "k1" },
    { owner: "ownerB", level: "n4", kanjiId: "k1" },
  ]);
  await db.notebooks.bulkPut([
    { id: "nA", owner: "ownerA", updatedAt: "2026-11-27T08:00:00.000Z" },
    { id: "nB", owner: "ownerB", updatedAt: "2026-11-27T08:00:00.000Z" },
  ]);
  await db.notebookItems.bulkPut([
    { id: "niA", owner: "ownerA", notebookId: "nA", itemType: "vocab" },
    { id: "niB", owner: "ownerB", notebookId: "nB", itemType: "vocab" },
  ]);

  await progressStore.purgeOwner("ownerA");

  expect(await examStore.listAttempts("ownerA", "n4")).toEqual([]);
  expect(await examStore.loadDraft("ownerA", "n4", "n4-2024-12")).toBeNull();
  expect(await progressStore.listPending("ownerA", 10)).toEqual([]);
  expect(await db.srsCards.where("owner").equals("ownerA").count()).toBe(0);
  expect(await db.srsReviews.where("owner").equals("ownerA").count()).toBe(0);
  expect(await db.userMnemonics.where("owner").equals("ownerA").count()).toBe(
    0,
  );
  expect(await db.notebooks.where("owner").equals("ownerA").count()).toBe(0);
  expect(await db.notebookItems.where("owner").equals("ownerA").count()).toBe(
    0,
  );

  expect(await examStore.listAttempts("ownerB", "n4")).toHaveLength(1);
  expect(
    await examStore.loadDraft("ownerB", "n4", "n4-2024-12"),
  ).not.toBeNull();
  expect(await progressStore.listPending("ownerB", 10)).toHaveLength(1);
  expect(await db.srsCards.where("owner").equals("ownerB").count()).toBe(1);
  expect(await db.srsReviews.where("owner").equals("ownerB").count()).toBe(1);
  expect(await db.userMnemonics.where("owner").equals("ownerB").count()).toBe(
    1,
  );
  expect(await db.notebooks.where("owner").equals("ownerB").count()).toBe(1);
  expect(await db.notebookItems.where("owner").equals("ownerB").count()).toBe(
    1,
  );
});

it("merges guest examAttempts into signed-in account and queues them to progressOutbox", async () => {
  const guestAttemptId = "88888888-8888-4888-8888-888888888888";
  await examStore.saveAttemptProgress({
    id: guestAttemptId,
    owner: "guest",
    level: "n4",
    examId: "n4-2024-12",
    status: "completed",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:00:00.000Z",
    completedAt: "2026-11-27T07:30:00.000Z",
    updatedAt: "2026-11-27T07:30:00.000Z",
    totalScore: 1,
    totalQuestions: 1,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 300,
        submittedAt: "2026-11-27T07:10:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-27T07:20:00.000Z",
      },
      {
        key: "listening",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-27T07:30:00.000Z",
      },
    ],
    answers: { q1: 0 },
  });

  expect(await progressStore.hasGuestProgress()).toBe(true);
  expect(await progressStore.mergeGuest(account.owner, true)).toBe(true);
  expect(await progressStore.hasGuestProgress()).toBe(false);
  expect(await examStore.listAttempts("guest", "n4")).toEqual([]);

  const migrated = await examStore.listAttempts(account.owner, "n4");
  expect(migrated).toHaveLength(1);
  expect(migrated[0].id).toBe(guestAttemptId);
  expect(migrated[0].owner).toBe(account.owner);

  const pending = await progressStore.listPending(account.owner, 10);
  expect(pending).toHaveLength(1);
  expect(pending[0].row.kind).toBe("exam_attempts");
  expect(pending[0].row.id).toBe(guestAttemptId);
});

it("preserves target owner in_progress attempt on guest merge and assigns next attemptNumber for completed guest attempts", async () => {
  const targetActiveId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const guestActiveId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const guestDoneId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  await examStore.saveAttemptProgress({
    id: targetActiveId,
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T07:05:00.000Z",
    totalScore: 1,
    totalQuestions: 2,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 200,
        submittedAt: "2026-11-27T07:05:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { q1: 0 },
  });

  await examStore.saveAttemptProgress({
    id: guestActiveId,
    owner: "guest",
    level: "n4",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:10:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T07:15:00.000Z",
    totalScore: 0,
    totalQuestions: 2,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 0,
        total: 1,
        elapsedSeconds: 100,
        submittedAt: "2026-11-27T07:15:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { q1: 1 },
  });

  await examStore.saveAttemptProgress({
    id: guestDoneId,
    owner: "guest",
    level: "n4",
    examId: "n4-2024-12",
    status: "completed",
    attemptNumber: 1,
    startedAt: "2026-11-27T06:00:00.000Z",
    completedAt: "2026-11-27T06:30:00.000Z",
    updatedAt: "2026-11-27T06:30:00.000Z",
    totalScore: 1,
    totalQuestions: 1,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 300,
        submittedAt: "2026-11-27T06:10:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-27T06:20:00.000Z",
      },
      {
        key: "listening",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-27T06:30:00.000Z",
      },
    ],
    answers: { q1: 0 },
  });

  await progressStore.mergeGuest(account.owner, true);
  const active = await examStore.getActiveAttempt(
    account.owner,
    "n4",
    "n4-2024-12",
  );
  expect(active?.id).toBe(targetActiveId);

  const all = await examStore.listAttempts(account.owner, "n4", "n4-2024-12");
  expect(all).toHaveLength(2);
  const doneAttempt = all.find((a) => a.id === guestDoneId);
  expect(doneAttempt?.attemptNumber).toBe(2);
  expect(all.some((a) => a.id === guestActiveId)).toBe(false);
});

it("applies pulled exam_attempts via mergeExamAttempts and clears stale activeExamDraft when section locks remotely", async () => {
  const attemptId = "99999999-9999-4999-8999-999999999999";
  await examStore.saveAttemptProgress({
    id: attemptId,
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T08:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:05:00.000Z",
    totalScore: 1,
    totalQuestions: 2,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 200,
        submittedAt: "2026-11-27T08:05:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { q1: 0 },
  });
  await examStore.saveDraft({
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-12",
    attemptId,
    activeIndex: 1,
    answers: { q2: 2 },
    startedAtMs: { grammar_reading: 1_700_000_000_000 },
    deadlineMs: { grammar_reading: 1_700_003_300_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:06:00.000Z",
  });

  const applied = await progressStore.applyPulledPage(
    account.owner,
    "exam_attempts",
    null,
    [
      {
        cursor: {
          serverUpdatedAt: "2026-11-27T08:15:00.000Z",
          id: attemptId,
        },
        row: {
          kind: "exam_attempts",
          id: attemptId,
          owner: account.owner,
          level: "n4",
          examId: "n4-2024-12",
          status: "in_progress",
          attemptNumber: 1,
          startedAt: "2026-11-27T08:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-11-27T08:15:00.000Z",
          totalScore: 1,
          totalQuestions: 2,
          sections: [
            {
              key: "vocab",
              status: "pending",
              score: 0,
              total: 1,
              elapsedSeconds: 0,
              submittedAt: null,
            },
            {
              key: "grammar_reading",
              status: "submitted",
              score: 1,
              total: 1,
              elapsedSeconds: 600,
              submittedAt: "2026-11-27T08:15:00.000Z",
            },
            {
              key: "listening",
              status: "pending",
              score: 0,
              total: 0,
              elapsedSeconds: 0,
              submittedAt: null,
            },
          ],
          answers: { q2: 1 },
        },
      },
    ],
  );

  expect(applied).toBe(true);
  const merged = await examStore.getActiveAttempt(
    account.owner,
    "n4",
    "n4-2024-12",
  );
  expect(merged?.totalScore).toBe(2);
  expect(merged?.sections[0].status).toBe("submitted");
  expect(merged?.sections[1].status).toBe("submitted");
  expect(
    await examStore.loadDraft(account.owner, "n4", "n4-2024-12"),
  ).toBeNull();
});

it("reconciles stale cross-UUID in_progress attempts and bound drafts on pull while preserving unrelated attempts", async () => {
  const uuidB = "11111111-1111-4111-8111-11111111111b";
  const uuidA = "11111111-1111-4111-8111-11111111111a";
  const otherExamDoneId = "22222222-2222-4222-8222-222222222222";
  const otherOwnerActiveId = "33333333-3333-4333-8333-333333333333";

  const makeInProgress = (
    attemptId: string,
    owner: string,
    examId: string,
    attemptNumber: number,
  ): ExamAttemptRecord => ({
    id: attemptId,
    owner,
    level: "n4",
    examId,
    status: "in_progress",
    attemptNumber,
    startedAt: "2026-11-27T08:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:05:00.000Z",
    totalScore: 0,
    totalQuestions: 2,
    sections: [
      {
        key: "vocab",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 1,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: {},
  });

  // Stale local in_progress attempt uuidB + bound draft for account on n4-2024-12
  await examStore.saveAttemptProgress(
    makeInProgress(uuidB, account.owner, "n4-2024-12", 1),
  );
  await examStore.saveDraft({
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-12",
    attemptId: uuidB,
    activeIndex: 0,
    answers: { q1: 1 },
    startedAtMs: { vocab: 1_700_000_000_000 },
    deadlineMs: { vocab: 1_700_001_500_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:05:00.000Z",
  });

  // Unrelated completed attempt on another exam for account
  await examStore.saveAttemptProgress({
    id: otherExamDoneId,
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-07",
    status: "completed",
    attemptNumber: 1,
    startedAt: "2026-11-26T08:00:00.000Z",
    completedAt: "2026-11-26T08:30:00.000Z",
    updatedAt: "2026-11-26T08:30:00.000Z",
    totalScore: 1,
    totalQuestions: 1,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 1,
        total: 1,
        elapsedSeconds: 120,
        submittedAt: "2026-11-26T08:10:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-26T08:20:00.000Z",
      },
      {
        key: "listening",
        status: "skipped",
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: "2026-11-26T08:30:00.000Z",
      },
    ],
    answers: { q1: 0 },
  });

  // Other owner's in_progress attempt + draft on the same exam
  await examStore.saveAttemptProgress(
    makeInProgress(otherOwnerActiveId, "other-owner", "n4-2024-12", 1),
  );
  await examStore.saveDraft({
    owner: "other-owner",
    level: "n4",
    examId: "n4-2024-12",
    attemptId: otherOwnerActiveId,
    activeIndex: 0,
    answers: {},
    startedAtMs: { vocab: 1_700_000_000_000 },
    deadlineMs: { vocab: 1_700_001_500_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:05:00.000Z",
  });

  // 1) Remote pulls uuidA (in_progress, attemptNumber 1) -> deletes stale uuidB and its draft
  const appliedInProgress = await progressStore.applyPulledPage(
    account.owner,
    "exam_attempts",
    null,
    [
      {
        cursor: { serverUpdatedAt: "2026-11-27T08:10:00.000Z", id: uuidA },
        row: {
          kind: "exam_attempts",
          ...makeInProgress(uuidA, account.owner, "n4-2024-12", 1),
          updatedAt: "2026-11-27T08:10:00.000Z",
        },
      },
    ],
  );
  expect(appliedInProgress).toBe(true);
  expect(await db.examAttempts.get(uuidB)).toBeUndefined();
  expect(await db.examAttempts.get(uuidA)).toMatchObject({
    id: uuidA,
    status: "in_progress",
  });
  expect(
    await examStore.loadDraft(account.owner, "n4", "n4-2024-12"),
  ).toBeNull();
  expect(await db.examAttempts.get(otherExamDoneId)).toBeDefined();
  expect(await db.examAttempts.get(otherOwnerActiveId)).toBeDefined();
  expect(
    await examStore.loadDraft("other-owner", "n4", "n4-2024-12"),
  ).not.toBeNull();

  // 2) Re-seed stale local uuidC (in_progress, attemptNumber 1) + draft, and newer uuidD (in_progress, attemptNumber 2)
  const uuidC = "44444444-4444-4444-8444-44444444444c";
  const uuidD = "55555555-5555-4555-8555-55555555555d";
  const uuidDone = "44444444-4444-4444-8444-44444444444a";
  await db.examAttempts.delete(uuidA);
  await examStore.saveAttemptProgress(
    makeInProgress(uuidC, account.owner, "n4-2024-12", 1),
  );
  await examStore.saveDraft({
    owner: account.owner,
    level: "n4",
    examId: "n4-2024-12",
    attemptId: uuidC,
    activeIndex: 0,
    answers: { q1: 2 },
    startedAtMs: { vocab: 1_700_000_000_000 },
    deadlineMs: { vocab: 1_700_001_500_000 },
    listeningScriptMode: false,
    savedAt: "2026-11-27T08:11:00.000Z",
  });
  await examStore.saveAttemptProgress(
    makeInProgress(uuidD, account.owner, "n4-2024-12", 2),
  );

  // Remote pulls uuidDone (completed, attemptNumber 1) -> deletes uuidC & draft, keeps newer uuidD
  const appliedCompleted = await progressStore.applyPulledPage(
    account.owner,
    "exam_attempts",
    { serverUpdatedAt: "2026-11-27T08:10:00.000Z", id: uuidA },
    [
      {
        cursor: { serverUpdatedAt: "2026-11-27T08:20:00.000Z", id: uuidDone },
        row: {
          kind: "exam_attempts",
          id: uuidDone,
          owner: account.owner,
          level: "n4",
          examId: "n4-2024-12",
          status: "completed",
          attemptNumber: 1,
          startedAt: "2026-11-27T08:00:00.000Z",
          completedAt: "2026-11-27T08:20:00.000Z",
          updatedAt: "2026-11-27T08:20:00.000Z",
          totalScore: 2,
          totalQuestions: 2,
          sections: [
            {
              key: "vocab",
              status: "submitted",
              score: 1,
              total: 1,
              elapsedSeconds: 100,
              submittedAt: "2026-11-27T08:10:00.000Z",
            },
            {
              key: "grammar_reading",
              status: "submitted",
              score: 1,
              total: 1,
              elapsedSeconds: 100,
              submittedAt: "2026-11-27T08:15:00.000Z",
            },
            {
              key: "listening",
              status: "skipped",
              score: 0,
              total: 0,
              elapsedSeconds: 0,
              submittedAt: "2026-11-27T08:20:00.000Z",
            },
          ],
          answers: { q1: 0, q2: 0 },
        },
      },
    ],
  );
  expect(appliedCompleted).toBe(true);
  expect(await db.examAttempts.get(uuidC)).toBeUndefined();
  expect(await db.examAttempts.get(uuidDone)).toMatchObject({
    id: uuidDone,
    status: "completed",
  });
  expect(await db.examAttempts.get(uuidD)).toMatchObject({
    id: uuidD,
    status: "in_progress",
    attemptNumber: 2,
  });
  expect(
    await examStore.loadDraft(account.owner, "n4", "n4-2024-12"),
  ).toBeNull();
});

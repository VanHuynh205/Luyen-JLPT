import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "./db";
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

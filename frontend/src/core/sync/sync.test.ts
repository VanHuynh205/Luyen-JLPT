import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type ProgressRemote, createProgressSync } from ".";
import { db } from "../../adapters/local-store/db";
import { progressStore } from "../../adapters/local-store/progress";

const scope = { owner: "signed-in", level: "n4" } as const;
const newer = "2026-11-22T01:00:00.123457Z";
const older = "2026-11-22T01:00:00.123456Z";

beforeEach(() => db.open());
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await db.delete();
});

it("reports synced only after a complete pull, even after the outbox drains", async () => {
  const onComplete = vi.fn();
  const pull = vi.fn<ProgressRemote["pull"]>().mockResolvedValue([]);
  const sync = createProgressSync({
    owner: scope.owner,
    store: progressStore,
    remote: { push: async () => {}, pull },
    onComplete,
  });
  await sync.syncNow();
  expect(onComplete).toHaveBeenCalledTimes(1);

  pull.mockRejectedValueOnce(new Error("pull failed"));
  await progressStore.setCardStatus(scope, "card", true);
  onComplete.mockClear();
  await expect(sync.syncNow()).rejects.toThrow("pull failed");
  expect(await progressStore.listPending(scope.owner, 10)).toHaveLength(0);
  expect(onComplete).not.toHaveBeenCalled();

  await sync.syncNow();
  expect(onComplete).toHaveBeenCalledTimes(1);
});

it("preserves pending writes offline and retries the same operation on reconnect", async () => {
  const window = new EventTarget();
  const navigator = { onLine: false };
  vi.stubGlobal("window", window);
  vi.stubGlobal("navigator", navigator);
  const sent: string[] = [];
  const remote: ProgressRemote = {
    push: async (_owner, entries) => {
      sent.push(...entries.map((entry) => entry.opId));
      if (sent.length === 1) throw new Error("response lost");
    },
    pull: async () => [],
  };
  const sync = createProgressSync({
    owner: scope.owner,
    store: progressStore,
    remote,
  });
  await progressStore.setCardStatus(scope, "card", true);
  await progressStore.setCardStatus(
    { ...scope, owner: "other" },
    "card",
    false,
  );
  sync.start();
  try {
    await sync.syncNow();
    expect(sent).toEqual([]);
    navigator.onLine = true;
    window.dispatchEvent(new Event("online"));
    await expect(sync.syncNow()).rejects.toThrow("response lost");
    expect(await progressStore.listPending(scope.owner, 10)).toHaveLength(1);
    window.dispatchEvent(new Event("online"));
    await sync.syncNow();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBe(sent[1]);
    expect(await progressStore.listPending(scope.owner, 10)).toEqual([]);
    expect(await progressStore.listPending("other", 10)).toHaveLength(1);
  } finally {
    await sync.stop();
  }
});

it("paginates tied timestamps, rejects mismatched owners and commits the cursor with data", async () => {
  const remote: ProgressRemote = {
    push: async () => {},
    pull: async (owner, kind, after) => {
      if (kind !== "grammar_learned") return [];
      const ids = ["a", "b", "c"];
      const id = ids[after ? ids.indexOf(after.id) + 1 : 0];
      if (!id) return [];
      return [
        {
          cursor: { id, serverUpdatedAt: newer },
          row: {
            ...scope,
            owner: id === "c" ? "other" : owner,
            kind,
            id,
            learned: true,
            updatedAt: older,
          },
        },
      ];
    },
  };
  const sync = createProgressSync({
    owner: scope.owner,
    store: progressStore,
    remote,
    pageSize: 1,
  });
  await expect(sync.syncNow()).rejects.toThrow("scope mismatch");
  expect(
    (await progressStore.getSummary(scope)).learnedGrammarIds.sort(),
  ).toEqual(["a", "b"]);
  expect(
    (await progressStore.getCursor(scope.owner, "grammar_learned"))?.id,
  ).toBe("b");
  expect(await progressStore.getCursor("other", "grammar_learned")).toBeNull();
});

it("flushes a new write on the next 10-second tick without a network event", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const pushed = Promise.withResolvers<void>();
  const remote: ProgressRemote = {
    push: vi.fn(async () => pushed.resolve()),
    pull: async () => [],
  };
  const sync = createProgressSync({
    owner: scope.owner,
    store: progressStore,
    remote,
  });
  sync.start();
  try {
    await sync.syncNow();
    await progressStore.setCardStatus(scope, "card", true);
    await vi.advanceTimersByTimeAsync(10_000);
    await pushed.promise;
    await sync.syncNow();
    expect(remote.push).toHaveBeenCalledOnce();
    expect(await progressStore.listPending(scope.owner, 10)).toEqual([]);
  } finally {
    await sync.stop();
  }
});

it("does not apply an old owner's outstanding pull once sync stops", async () => {
  const entered = Promise.withResolvers<void>();
  const response =
    Promise.withResolvers<Awaited<ReturnType<ProgressRemote["pull"]>>>();
  const remote: ProgressRemote = {
    push: async () => {},
    pull: async () => {
      entered.resolve();
      return response.promise;
    },
  };
  const sync = createProgressSync({
    owner: scope.owner,
    store: progressStore,
    remote,
  });
  const running = sync.syncNow();
  const cancelled = expect(running).rejects.toThrow();
  await entered.promise;
  const stopped = sync.stop();
  response.resolve([
    {
      cursor: { id: "card", serverUpdatedAt: newer },
      row: {
        ...scope,
        kind: "card_status",
        id: "card",
        known: true,
        updatedAt: older,
      },
    },
  ]);
  await stopped;
  await cancelled;
  expect((await progressStore.getSummary(scope)).flashcards).toEqual([]);
  expect(await progressStore.getCursor(scope.owner, "card_status")).toBeNull();
});

it("keeps a newer LWW tombstone and reconciles a server-authoritative timestamp tie", async () => {
  const kind = "grammar_learned";
  const base = { ...scope, kind, id: "grammar" } as const;
  const first = { id: "grammar", serverUpdatedAt: older };
  const second = { id: "grammar", serverUpdatedAt: newer };
  await db.progress.put({ ...base, learned: false, updatedAt: newer });
  await progressStore.applyPulledPage(scope.owner, kind, null, [
    { row: { ...base, learned: true, updatedAt: older }, cursor: first },
  ]);
  expect((await progressStore.getSummary(scope)).learnedGrammarIds).toEqual([]);
  await progressStore.applyPulledPage(scope.owner, kind, first, [
    { row: { ...base, learned: true, updatedAt: newer }, cursor: second },
  ]);
  expect((await progressStore.getSummary(scope)).learnedGrammarIds).toEqual([
    "grammar",
  ]);
});

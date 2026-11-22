import "fake-indexeddb/auto";
import { db } from "@/adapters/local-store/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readLevelPreference,
  saveLevelPreference,
  syncLevelPreference,
} from "./levelPreference";

beforeEach(() => db.open());
afterEach(() => db.delete());

it("keeps the legacy guest choice separate from each account", async () => {
  await db.settings.put({ key: "level", value: "n3" });
  await saveLevelPreference("owner-a", "n5");
  expect(await readLevelPreference()).toEqual({ level: "n3", pending: false });
  expect(await readLevelPreference("owner-a")).toEqual({
    level: "n5",
    pending: true,
  });
  expect(await readLevelPreference("owner-b")).toBeUndefined();
});

it("restores the profile without overwriting a newer local choice", async () => {
  const signal = new AbortController().signal;
  const profile = { read: async () => "n3", write: vi.fn() };
  await syncLevelPreference("owner-a", profile, signal);
  expect(await readLevelPreference("owner-a")).toEqual({
    level: "n3",
    pending: false,
  });

  const response = Promise.withResolvers<string>();
  const requested = Promise.withResolvers<void>();
  const syncing = syncLevelPreference(
    "owner-a",
    {
      ...profile,
      read: () => {
        requested.resolve();
        return response.promise;
      },
    },
    signal,
  );
  await requested.promise;
  await saveLevelPreference("owner-a", "n4");
  response.resolve("n5");
  await syncing;
  expect(await readLevelPreference("owner-a")).toEqual({
    level: "n4",
    pending: true,
  });
  expect(profile.write).not.toHaveBeenCalled();
});

it("retries failed updates and leaves a newer choice queued during an older update", async () => {
  const signal = new AbortController().signal;
  const read = vi.fn(async () => "n4");
  const write = vi.fn().mockRejectedValueOnce(new Error("offline"));
  await saveLevelPreference("owner-a", "n3");
  await expect(
    syncLevelPreference("owner-a", { read, write }, signal),
  ).rejects.toThrow("offline");
  expect((await readLevelPreference("owner-a"))?.pending).toBe(true);

  write.mockImplementationOnce(() => saveLevelPreference("owner-a", "n5"));
  await syncLevelPreference("owner-a", { read, write }, signal);
  expect(await readLevelPreference("owner-a")).toEqual({
    level: "n5",
    pending: true,
  });
  await syncLevelPreference("owner-a", { read, write }, signal);
  expect(write.mock.calls.map(([level]) => level)).toEqual(["n3", "n3", "n5"]);
  expect(await readLevelPreference("owner-a")).toEqual({
    level: "n5",
    pending: false,
  });
  expect(read).not.toHaveBeenCalled();
});

it("leaves an interrupted write queued for a later signed-in session", async () => {
  const controller = new AbortController();
  await saveLevelPreference("owner-a", "n3");
  await expect(
    syncLevelPreference(
      "owner-a",
      { read: vi.fn(), write: async () => controller.abort() },
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect((await readLevelPreference("owner-a"))?.pending).toBe(true);
});

it.each([false, true])(
  "does not recreate a retired owner's preference (pending: %s)",
  async (pending) => {
    const owner = "owner-a";
    const signal = new AbortController().signal;
    if (pending) await saveLevelPreference(owner, "n3");
    const response = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const wait = async () => {
      started.resolve();
      await response.promise;
    };
    const profile = {
      read: vi.fn(async () => {
        await wait();
        return "n3";
      }),
      write: vi.fn(wait),
    };
    const syncing = syncLevelPreference(owner, profile, signal);
    await started.promise;
    await db.transaction("rw", db.settings, async () => {
      await db.settings.put({ key: `retired:${owner}`, value: true });
      await db.settings.delete(`level:${owner}`);
    });
    response.resolve();
    await expect(syncing).resolves.toBe(false);
    await expect(saveLevelPreference(owner, "n4")).rejects.toThrow("retired");
    await expect(syncLevelPreference(owner, profile, signal)).resolves.toBe(
      false,
    );
    expect(
      profile.read.mock.calls.length + profile.write.mock.calls.length,
    ).toBe(1);
    expect(await readLevelPreference(owner)).toBeUndefined();
  },
);

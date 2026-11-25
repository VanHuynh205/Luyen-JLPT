import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { miniPack } from "../../core/content/__fixtures__/mini-pack";
import { db } from "./db";

afterEach(() => db.delete());

it("persists versions independently and keeps the selected level under its own key", async () => {
  await db.open();
  expect(db.name).toBe("luyen-jlpt");
  expect(db.verno).toBe(3);
  const next = structuredClone(miniPack);
  next.manifest.version = "1.1.0";
  for (const pack of [miniPack, next]) {
    const { level, version } = pack.manifest;
    const checksum = createHash("sha256")
      .update(JSON.stringify(pack))
      .digest("hex");
    await db.packs.put({ level, version, pack, checksum });
  }
  await db.settings.put({ key: "level", value: "n3" });
  db.close();
  await db.open();
  expect((await db.packs.get(["n4", "1.0.0"]))?.pack).toEqual(miniPack);
  expect((await db.packs.get(["n4", "1.1.0"]))?.pack).toEqual(next);
  expect(await db.settings.get("level")).toEqual({ key: "level", value: "n3" });
});

it("keeps version-one pack data and preferences when upgrading for progress", async () => {
  const previous = new Dexie(db.name);
  previous.version(1).stores({ packs: "[level+version]", settings: "key" });
  try {
    await previous.table("settings").put({ key: "level", value: "n3" });
    await previous
      .table("packs")
      .put({ level: "n4", version: "1.0.0", checksum: "test", pack: miniPack });
  } finally {
    previous.close();
  }
  await db.open();
  expect(await db.settings.get("level")).toEqual({ key: "level", value: "n3" });
  expect((await db.packs.get(["n4", "1.0.0"]))?.pack).toEqual(miniPack);
  expect(await db.progress.count()).toBe(0);
  expect(await db.examAttempts.count()).toBe(0);
  expect(await db.examPacks.count()).toBe(0);
});

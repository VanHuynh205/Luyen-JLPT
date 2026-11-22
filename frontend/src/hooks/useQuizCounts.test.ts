import "fake-indexeddb/auto";
import { db } from "@/adapters/local-store/db";
import { KanjiQuizMode } from "@/core/progress/types";
import { beforeEach, describe, expect, it } from "vitest";
import { loadQuizCounts, saveQuizCounts } from "./useQuizCounts";

const defaults = {
  [KanjiQuizMode.single]: 10,
  [KanjiQuizMode.compound]: 10,
  [KanjiQuizMode.mixed]: 10,
};

describe("kanji quiz counts storage", () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it("returns 10 for every mode when nothing is saved", async () => {
    expect(await loadQuizCounts()).toEqual(defaults);
  });

  it("reads back the counts saved for each mode", async () => {
    const counts = {
      [KanjiQuizMode.single]: 20,
      [KanjiQuizMode.compound]: 388,
      [KanjiQuizMode.mixed]: 50,
    };
    await saveQuizCounts(counts);
    expect(await loadQuizCounts()).toEqual(counts);
  });

  it("falls back to 10 for a mode whose saved value is invalid", async () => {
    await db.settings.put({
      key: "kanjiQuizCounts",
      value: { single: "20", compound: -5, mixed: 30.5 },
    });
    expect(await loadQuizCounts()).toEqual({
      ...defaults,
      [KanjiQuizMode.mixed]: 31,
    });
  });

  it("ignores a saved value that is not an object", async () => {
    await db.settings.put({ key: "kanjiQuizCounts", value: 42 });
    expect(await loadQuizCounts()).toEqual(defaults);
  });
});

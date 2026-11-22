import { expect, it } from "vitest";
import { type ProgressRow, summarizeProgress, timestampKey } from ".";
import { KanjiQuizMode } from "./types";

it("compares offset timestamps without truncating PostgreSQL microseconds", () => {
  const earlier = timestampKey("2026-11-22T08:00:00.123456+07:00");
  const later = timestampKey("2026-11-22T01:00:00.123457Z");
  expect(earlier).toBe("2026-11-22T01:00:00.123456Z");
  expect(earlier < later).toBe(true);
  expect(() => timestampKey("not a timestamp")).toThrow();
});

it("shows perfect Kanji attempts and separates the latest and best reading scores", () => {
  const earlier = "2026-11-22T01:00:00.123456Z";
  const newer = "2026-11-22T01:00:00.123457Z";
  const scope = { owner: "learner", level: "n3" } as const;
  const rows: ProgressRow[] = [
    {
      ...scope,
      id: "first",
      kind: "reading_attempts",
      passageId: "passage",
      score: 4,
      total: 4,
      updatedAt: earlier,
    },
    {
      ...scope,
      id: "second",
      kind: "reading_attempts",
      passageId: "passage",
      score: 1,
      total: 4,
      updatedAt: newer,
    },
    {
      ...scope,
      id: "quiz",
      kind: "kanji_quiz_attempts",
      mode: KanjiQuizMode.mixed,
      score: 5,
      total: 5,
      wrongItemIds: [],
      updatedAt: earlier,
    },
  ];
  const summary = summarizeProgress(rows);
  expect(summary.readingResults[0]).toMatchObject({
    attempts: 2n,
    bestScore: 4n,
    lastScore: 1n,
    lastAttemptAt: 1_795_309_200_123_457_000n,
  });
  expect(summary.recentKanjiResults[0]).toMatchObject({
    id: "quiz",
    score: 5n,
    takenAt: 1_795_309_200_123_456_000n,
  });
});

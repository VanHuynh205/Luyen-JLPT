import { expect, it } from "vitest";
import {
  PROGRESS_KINDS,
  type ProgressRow,
  summarizeProgress,
  timestampKey,
  validateProgressRow,
} from ".";
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

it("validates exam_attempts rows and rejects prototype pollution or oversized answers", () => {
  expect(PROGRESS_KINDS).toContain("exam_attempts");
  const validExamRow: ProgressRow = {
    owner: "learner",
    level: "n4",
    id: "bb08258f-378c-4052-9f95-2cab971b8cd4",
    kind: "exam_attempts",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:45:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:00:00.000Z",
    totalScore: 24,
    totalQuestions: 85,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 24,
        total: 28,
        elapsedSeconds: 900,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-1": 2 },
  };

  expect(() => validateProgressRow(validExamRow)).not.toThrow();

  const protoAnswers = JSON.parse('{"__proto__": 1}') as Record<string, number>;
  expect(() =>
    validateProgressRow({ ...validExamRow, answers: protoAnswers }),
  ).toThrow();
  expect(() =>
    validateProgressRow({ ...validExamRow, answers: { constructor: 0 } }),
  ).toThrow();
  expect(() =>
    validateProgressRow({ ...validExamRow, answers: { prototype: 0 } }),
  ).toThrow();
  expect(() =>
    validateProgressRow({ ...validExamRow, answers: { "q-1": 4 } }),
  ).toThrow();
  expect(() =>
    validateProgressRow({ ...validExamRow, totalScore: 86 }),
  ).toThrow();
  expect(() =>
    validateProgressRow({
      ...validExamRow,
      status: "completed",
      completedAt: null,
    }),
  ).toThrow();
  expect(() =>
    validateProgressRow({ ...validExamRow, examId: "../escape" }),
  ).toThrow();

  const hugeAnswers: Record<string, number> = {};
  for (let i = 0; i < 6000; i++) {
    hugeAnswers[`question-padding-${i}`] = i % 4;
  }
  expect(() =>
    validateProgressRow({ ...validExamRow, answers: hugeAnswers }),
  ).toThrow();
});

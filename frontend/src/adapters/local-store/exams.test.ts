import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamIndex,
} from "../../core/exam/types";
import { db } from "./db";
import { examStore } from "./exams";
import { progressStore } from "./progress";

function sampleExam(id = "n4-2024-12"): ExamDocument {
  return {
    id,
    level: "n4",
    year: 2024,
    month: 12,
    code: "2024-12",
    title: "Đề N4 12/2024",
    answerSourceSummary: "official_key",
    hasListeningScript: false,
    hasSourceAudio: false,
    sections: [
      {
        key: "vocab",
        title: "Từ vựng",
        titleJa: "文字・語彙",
        durationSeconds: 1500,
        audioAvailable: false,
        groups: [
          {
            id: "v1",
            label: "問題1",
            instructionJa: "ja",
            instructionVi: "vi",
            questions: [
              {
                id: `${id}-q1`,
                number: 1,
                prompt: "学校",
                promptRuby: "{学校|がっこう}",
                choices: ["がっこう", "かっこう", "がくこう", "かくこう"],
                answerIndex: 0,
                answerSource: "official_key",
                translation: "Trường học",
                explanation: "学校 đọc là がっこう.",
              },
            ],
          },
        ],
      },
      {
        key: "grammar_reading",
        title: "Ngữ pháp & Đọc hiểu",
        titleJa: "文法・読解",
        durationSeconds: 3300,
        audioAvailable: false,
        groups: [],
      },
      {
        key: "listening",
        title: "Nghe hiểu",
        titleJa: "聴解",
        durationSeconds: 2100,
        audioAvailable: false,
        groups: [],
      },
    ],
  };
}

function sampleIndex(): ExamIndex {
  return {
    level: "n4",
    version: "1.0.0",
    exams: [
      {
        id: "n4-2024-12",
        level: "n4",
        year: 2024,
        month: 12,
        code: "2024-12",
        title: "Đề N4 12/2024",
        answerSourceSummary: "official_key",
        hasListeningScript: false,
        hasSourceAudio: false,
        questionCounts: { vocab: 1, grammar_reading: 0, listening: 0 },
        totalQuestions: 1,
        totalDurationSeconds: 6900,
        sha256: "a".repeat(64),
      },
    ],
  };
}

beforeEach(() => db.open());
afterEach(() => db.delete());

describe("examStore", () => {
  it("records attempts scoped by owner and level, sorted newest first", async () => {
    const older = await examStore.recordAttempt({
      owner: "guest",
      level: "n4",
      examId: "n4-2024-12",
      completedAt: "2026-11-25T10:00:00.000Z",
      totalScore: 1,
      totalQuestions: 1,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 1,
          total: 1,
          elapsedSeconds: 300,
        },
        {
          key: "grammar_reading",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
      ],
      answers: { "n4-2024-12-q1": 0 },
    });
    const newer = await examStore.recordAttempt({
      owner: "guest",
      level: "n4",
      examId: "n4-2024-07",
      completedAt: "2026-11-25T12:00:00.000Z",
      totalScore: 0,
      totalQuestions: 1,
      sections: [
        {
          key: "vocab",
          status: "timed_out",
          score: 0,
          total: 1,
          elapsedSeconds: 1500,
        },
        {
          key: "grammar_reading",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
      ],
      answers: {},
    });
    await examStore.recordAttempt({
      owner: "other-user",
      level: "n4",
      examId: "n4-2024-12",
      completedAt: "2026-11-25T13:00:00.000Z",
      totalScore: 1,
      totalQuestions: 1,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 1,
          total: 1,
          elapsedSeconds: 100,
        },
        {
          key: "grammar_reading",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
      ],
      answers: { "n4-2024-12-q1": 0 },
    });

    expect(older.id).toBeTruthy();
    const list = await examStore.listAttempts("guest", "n4");
    expect(list.map((a) => a.id)).toEqual([newer.id, older.id]);

    const filtered = await examStore.listAttempts("guest", "n4", "n4-2024-12");
    expect(filtered.map((a) => a.id)).toEqual([older.id]);
  });

  it("rejects invalid attempt inputs and retired owners", async () => {
    await expect(
      examStore.recordAttempt({
        owner: "guest",
        level: "n4",
        examId: "n4-2024-12",
        totalScore: 5,
        totalQuestions: 1,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 5,
            total: 1,
            elapsedSeconds: 10,
          },
          {
            key: "grammar_reading",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: {},
      }),
    ).rejects.toThrow();

    await expect(
      examStore.recordAttempt({
        owner: "guest",
        level: "n4",
        examId: "n4-2024-12",
        totalScore: 1,
        totalQuestions: 1,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 1,
            total: 1,
            elapsedSeconds: 10,
          },
          {
            key: "grammar_reading",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: { q1: 9 },
      }),
    ).rejects.toThrow();

    await progressStore.purgeOwner("retired-account");
    await expect(
      examStore.recordAttempt({
        owner: "retired-account",
        level: "n4",
        examId: "n4-2024-12",
        totalScore: 0,
        totalQuestions: 0,
        sections: [
          {
            key: "vocab",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "grammar_reading",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: {},
      }),
    ).rejects.toThrow(/retired/i);
  });

  it("caches and validates exam documents with optional sha256 check", async () => {
    const exam = sampleExam();
    const sha = "a".repeat(64);
    await examStore.cacheExam(exam, sha);

    expect(await examStore.getCachedExam("n4", exam.id)).toEqual(exam);
    expect(await examStore.getCachedExam("n4", exam.id, sha)).toEqual(exam);
    expect(
      await examStore.getCachedExam("n4", exam.id, "b".repeat(64)),
    ).toBeNull();
    expect(await examStore.getCachedExam("n4", "missing")).toBeNull();
  });

  it("caches and validates exam index per level", async () => {
    const index = sampleIndex();
    await examStore.cacheIndex(index);
    expect(await examStore.getCachedIndex("n4")).toEqual(index);
    expect(await examStore.getCachedIndex("n3")).toBeNull();

    await db.settings.put({ key: "examIndex:n4", value: { broken: true } });
    expect(await examStore.getCachedIndex("n4")).toBeNull();
  });

  it("upgrades legacy v3 examAttempts records to v4 with status=completed and sequential attemptNumber (Review Focus #3)", async () => {
    db.close();
    await Dexie.delete("luyen-jlpt");

    const legacyDb = new Dexie("luyen-jlpt");
    legacyDb.version(1).stores({ packs: "[level+version]", settings: "key" });
    legacyDb.version(2).stores({
      progress: "[owner+level+kind+id], [owner+level], [owner+kind+id], owner",
      progressOutbox: "opId, owner",
      progressCursors: "[owner+kind]",
    });
    legacyDb.version(3).stores({
      examAttempts: "id, [owner+level], [owner+level+examId], completedAt",
      examPacks: "[level+id]",
    });
    await legacyDb.open();

    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    await legacyDb.table("examAttempts").bulkPut([
      {
        id: id2,
        owner: "u1",
        level: "n4",
        examId: "n4-2024-12",
        completedAt: "2026-11-26T10:00:00.000Z",
        totalScore: 2,
        totalQuestions: 2,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 2,
            total: 2,
            elapsedSeconds: 400,
          },
          {
            key: "grammar_reading",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: { q1: 0, q2: 1 },
      },
      {
        id: id1,
        owner: "u1",
        level: "n4",
        examId: "n4-2024-12",
        completedAt: "2026-11-25T10:00:00.000Z",
        totalScore: 1,
        totalQuestions: 2,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 1,
            total: 2,
            elapsedSeconds: 500,
          },
          {
            key: "grammar_reading",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: { q1: 0 },
      },
    ]);
    legacyDb.close();

    await db.open();
    expect(db.verno).toBe(4);
    const attempts = await examStore.listAttempts("u1", "n4", "n4-2024-12");
    expect(attempts).toHaveLength(2);
    const older = attempts.find((a) => a.id === id1);
    const newer = attempts.find((a) => a.id === id2);
    expect(older).toMatchObject({
      id: id1,
      status: "completed",
      attemptNumber: 1,
      startedAt: "2026-11-25T10:00:00.000Z",
      updatedAt: "2026-11-25T10:00:00.000Z",
      completedAt: "2026-11-25T10:00:00.000Z",
    });
    expect(
      older?.sections.every((s) => s.submittedAt === older.completedAt),
    ).toBe(true);
    expect(newer).toMatchObject({
      id: id2,
      status: "completed",
      attemptNumber: 2,
      startedAt: "2026-11-26T10:00:00.000Z",
      updatedAt: "2026-11-26T10:00:00.000Z",
      completedAt: "2026-11-26T10:00:00.000Z",
    });
  });

  it("persists and restores activeExamDraft with answers and deadlineMs across reload (Review Focus #2)", async () => {
    const attemptId = "33333333-3333-4333-8333-333333333333";
    await examStore.saveDraft({
      owner: "u1",
      level: "n4",
      examId: "n4-2013-07",
      attemptId,
      activeIndex: 1,
      answers: { "q-29": 1 },
      startedAtMs: { grammar_reading: 1_700_000_000_000 },
      deadlineMs: { grammar_reading: 1_700_003_300_000 },
      listeningScriptMode: false,
      savedAt: "2026-11-27T08:00:00.000Z",
    });
    const restored = await examStore.loadDraft("u1", "n4", "n4-2013-07");
    expect(restored?.answers["q-29"]).toBe(1);
    expect(restored?.deadlineMs.grammar_reading).toBe(1_700_003_300_000);
    expect(restored?.activeIndex).toBe(1);

    await examStore.clearDraft("u1", "n4", "n4-2013-07");
    expect(await examStore.loadDraft("u1", "n4", "n4-2013-07")).toBeNull();
  });

  it("saves in_progress section progress, enqueues to progressOutbox for signed-in owners, and clears draft on completion", async () => {
    const attemptId = "44444444-4444-4444-8444-444444444444";
    const part1: ExamAttemptRecord = {
      id: attemptId,
      owner: "u1",
      level: "n4",
      examId: "n4-2013-07",
      status: "in_progress",
      attemptNumber: 1,
      startedAt: "2026-11-27T08:00:00.000Z",
      completedAt: null,
      updatedAt: "2026-11-27T08:10:00.000Z",
      totalScore: 1,
      totalQuestions: 3,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 1,
          total: 1,
          elapsedSeconds: 600,
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
          total: 1,
          elapsedSeconds: 0,
          submittedAt: null,
        },
      ],
      answers: { q1: 0 },
    };

    await examStore.saveDraft({
      owner: "u1",
      level: "n4",
      examId: "n4-2013-07",
      attemptId,
      activeIndex: 1,
      answers: { q1: 0, q2: 2 },
      startedAtMs: { grammar_reading: 1_700_000_000_000 },
      deadlineMs: { grammar_reading: 1_700_003_300_000 },
      listeningScriptMode: false,
      savedAt: "2026-11-27T08:11:00.000Z",
    });

    const saved = await examStore.saveAttemptProgress(part1);
    expect(saved.status).toBe("in_progress");
    expect(await examStore.getActiveAttempt("u1", "n4", "n4-2013-07")).toEqual(
      saved,
    );
    expect(await examStore.nextAttemptNumber("u1", "n4", "n4-2013-07")).toBe(2);

    const outboxAfterPart1 = await progressStore.listPending("u1", 10);
    expect(outboxAfterPart1).toHaveLength(1);
    expect(outboxAfterPart1[0].row.kind).toBe("exam_attempts");
    expect(outboxAfterPart1[0].row.id).toBe(attemptId);
    expect(await examStore.loadDraft("u1", "n4", "n4-2013-07")).not.toBeNull();

    const completed: ExamAttemptRecord = {
      ...part1,
      status: "completed",
      completedAt: "2026-11-27T08:40:00.000Z",
      updatedAt: "2026-11-27T08:40:00.000Z",
      totalScore: 2,
      sections: [
        part1.sections[0],
        {
          key: "grammar_reading",
          status: "submitted",
          score: 1,
          total: 1,
          elapsedSeconds: 1200,
          submittedAt: "2026-11-27T08:30:00.000Z",
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 1,
          elapsedSeconds: 0,
          submittedAt: "2026-11-27T08:40:00.000Z",
        },
      ],
      answers: { q1: 0, q2: 1 },
    };

    const finished = await examStore.saveAttemptProgress(completed);
    expect(finished.status).toBe("completed");
    expect(
      await examStore.getActiveAttempt("u1", "n4", "n4-2013-07"),
    ).toBeNull();
    expect(await examStore.loadDraft("u1", "n4", "n4-2013-07")).toBeNull();
    expect(await progressStore.listPending("u1", 10)).toHaveLength(2);
  });

  it("does not enqueue guest exam attempts to progressOutbox", async () => {
    const guestAttempt: ExamAttemptRecord = {
      id: "55555555-5555-4555-8555-555555555555",
      owner: "guest",
      level: "n4",
      examId: "n4-2013-07",
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
          elapsedSeconds: 200,
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
    await examStore.saveAttemptProgress(guestAttempt);
    expect(await progressStore.listPending("guest", 10)).toEqual([]);
  });
});

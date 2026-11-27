import { describe, expect, it } from "vitest";
import {
  EXAM_SECTION_DURATIONS,
  buildExamAttemptSnapshot,
  canAccessSection,
  computeRemainingSeconds,
  countSectionQuestions,
  formatCountdown,
  gradeSection,
  isSectionLocked,
  listSectionQuestions,
  mergeExamAttempts,
  summarizeExamAttempt,
} from "./engine";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamQuestion,
  ExamSection,
  ExamSectionAttemptSummary,
} from "./types";

function question(
  id: string,
  number: number,
  answerIndex: 0 | 1 | 2 | 3,
): ExamQuestion {
  return {
    id,
    number,
    prompt: `Q${number}`,
    promptRuby: `Q${number}`,
    choices: ["A", "B", "C", "D"],
    answerIndex,
    answerSource: "official_key",
    translation: `T${number}`,
    explanation: `E${number}`,
  };
}

function makeExam(): ExamDocument {
  const vocab: ExamSection = {
    key: "vocab",
    title: "Từ vựng",
    titleJa: "文字・語彙",
    durationSeconds: EXAM_SECTION_DURATIONS.vocab,
    audioAvailable: false,
    groups: [
      {
        id: "v1",
        label: "問題1",
        instructionJa: "ja",
        instructionVi: "vi",
        questions: [question("q1", 1, 0), question("q2", 2, 2)],
      },
      {
        id: "v2",
        label: "問題2",
        instructionJa: "ja",
        instructionVi: "vi",
        questions: [question("q3", 3, 1)],
      },
    ],
  };
  const grammarReading: ExamSection = {
    key: "grammar_reading",
    title: "Ngữ pháp & Đọc hiểu",
    titleJa: "文法・読解",
    durationSeconds: EXAM_SECTION_DURATIONS.grammar_reading,
    audioAvailable: false,
    groups: [
      {
        id: "g1",
        label: "問題1",
        instructionJa: "ja",
        instructionVi: "vi",
        questions: [question("q4", 1, 3)],
      },
    ],
  };
  const listening: ExamSection = {
    key: "listening",
    title: "Nghe hiểu",
    titleJa: "聴解",
    durationSeconds: EXAM_SECTION_DURATIONS.listening,
    audioAvailable: false,
    groups: [],
  };
  return {
    id: "n4-2024-12",
    level: "n4",
    year: 2024,
    month: 12,
    code: "2024-12",
    title: "Đề N4 12/2024",
    answerSourceSummary: "official_key",
    hasListeningScript: false,
    hasSourceAudio: false,
    sections: [vocab, grammarReading, listening],
  };
}

describe("exam engine", () => {
  it("defines standard JLPT N4 section durations", () => {
    expect(EXAM_SECTION_DURATIONS).toEqual({
      vocab: 1500,
      grammar_reading: 3300,
      listening: 2100,
    });
  });

  it("lists and counts questions across groups", () => {
    const exam = makeExam();
    expect(listSectionQuestions(exam.sections[0]).map((q) => q.id)).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    expect(countSectionQuestions(exam.sections[0])).toBe(3);
    expect(countSectionQuestions(exam.sections[2])).toBe(0);
  });

  it("grades a section against user answers", () => {
    const exam = makeExam();
    expect(
      gradeSection(exam.sections[0], {
        q1: 0,
        q2: 1,
        unrelated: 0,
      }),
    ).toEqual({ score: 1, total: 3, answered: 2 });
  });

  it("enforces sequential section access and locking", () => {
    expect(isSectionLocked("submitted")).toBe(true);
    expect(isSectionLocked("timed_out")).toBe(true);
    expect(isSectionLocked("skipped")).toBe(true);
    expect(isSectionLocked("locked")).toBe(false);
    expect(isSectionLocked("ready")).toBe(false);
    expect(isSectionLocked("in_progress")).toBe(false);

    expect(canAccessSection(["ready", "locked", "locked"], 0)).toBe(true);
    expect(canAccessSection(["ready", "locked", "locked"], 1)).toBe(false);
    expect(canAccessSection(["in_progress", "locked", "locked"], 1)).toBe(
      false,
    );
    expect(canAccessSection(["submitted", "ready", "locked"], 1)).toBe(true);
    expect(canAccessSection(["timed_out", "ready", "locked"], 1)).toBe(true);
    expect(canAccessSection(["skipped", "ready", "locked"], 1)).toBe(true);
    expect(canAccessSection(["submitted", "ready", "locked"], 2)).toBe(false);
    expect(canAccessSection(["submitted", "submitted", "ready"], 2)).toBe(true);
    expect(canAccessSection(["ready", "locked", "locked"], -1)).toBe(false);
    expect(canAccessSection(["ready", "locked", "locked"], 3)).toBe(false);
  });

  it("computes remaining seconds clamped at zero and formats MM:SS", () => {
    expect(computeRemainingSeconds(10_000, 10_000)).toBe(0);
    expect(computeRemainingSeconds(10_000, 12_500)).toBe(0);
    expect(computeRemainingSeconds(10_000, 9_500)).toBe(1);
    expect(computeRemainingSeconds(1_500_000, 0)).toBe(1500);

    expect(formatCountdown(1500)).toBe("25:00");
    expect(formatCountdown(309)).toBe("05:09");
    expect(formatCountdown(5)).toBe("00:05");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-42)).toBe("00:00");
  });

  it("summarizes an exam attempt cleanly", () => {
    const exam = makeExam();
    const record = summarizeExamAttempt({
      id: "attempt-1",
      owner: "guest",
      exam,
      answers: { q1: 0, q2: 2, q4: 0, foreign: 1 },
      sectionMeta: {
        vocab: { status: "submitted", elapsedSeconds: 900 },
        grammar_reading: { status: "timed_out", elapsedSeconds: 3300 },
        listening: { status: "skipped", elapsedSeconds: 0 },
      },
      completedAt: "2026-11-25T12:00:00.000Z",
    });

    expect(record).toEqual({
      id: "attempt-1",
      owner: "guest",
      level: "n4",
      examId: "n4-2024-12",
      status: "completed",
      attemptNumber: 1,
      startedAt: "2026-11-25T12:00:00.000Z",
      completedAt: "2026-11-25T12:00:00.000Z",
      updatedAt: "2026-11-25T12:00:00.000Z",
      totalScore: 2,
      totalQuestions: 4,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 2,
          total: 3,
          elapsedSeconds: 900,
          submittedAt: "2026-11-25T12:00:00.000Z",
        },
        {
          key: "grammar_reading",
          status: "timed_out",
          score: 0,
          total: 1,
          elapsedSeconds: 3300,
          submittedAt: "2026-11-25T12:00:00.000Z",
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
          submittedAt: "2026-11-25T12:00:00.000Z",
        },
      ],
      answers: { q1: 0, q2: 2, q4: 0 },
    });
  });

  it("builds a partial in_progress snapshot when sections remain pending", () => {
    const exam = makeExam();
    const snapshot = buildExamAttemptSnapshot({
      id: "attempt-partial",
      owner: "user-1",
      exam,
      attemptNumber: 2,
      startedAt: "2026-11-27T07:45:00.000Z",
      updatedAt: "2026-11-27T08:00:00.000Z",
      answers: { q1: 0, q2: 2, q4: 3, foreign: 1 },
      sectionMeta: {
        vocab: {
          status: "submitted",
          elapsedSeconds: 900,
          submittedAt: "2026-11-27T08:00:00.000Z",
        },
      },
    });

    expect(snapshot).toEqual({
      id: "attempt-partial",
      owner: "user-1",
      level: "n4",
      examId: "n4-2024-12",
      status: "in_progress",
      attemptNumber: 2,
      startedAt: "2026-11-27T07:45:00.000Z",
      completedAt: null,
      updatedAt: "2026-11-27T08:00:00.000Z",
      totalScore: 2,
      totalQuestions: 4,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 2,
          total: 3,
          elapsedSeconds: 900,
          submittedAt: "2026-11-27T08:00:00.000Z",
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
      answers: { q1: 0, q2: 2 },
    });
  });

  it("preserves submitted section 1 when merging a newer-clock stale pending snapshot (Review Focus #1)", () => {
    const makeSnapshot = (opts: {
      updatedAt: string;
      vocab: Omit<ExamSectionAttemptSummary, "key">;
      grammar_reading: Omit<ExamSectionAttemptSummary, "key">;
      listening: Omit<ExamSectionAttemptSummary, "key">;
      answers: Record<string, number>;
      status?: "in_progress" | "completed";
      completedAt?: string | null;
    }): ExamAttemptRecord => ({
      id: "attempt-sync-1",
      owner: "user-1",
      level: "n4",
      examId: "n4-2024-12",
      status: opts.status ?? "in_progress",
      attemptNumber: 1,
      startedAt: "2026-11-27T07:45:00.000Z",
      completedAt: opts.completedAt ?? null,
      updatedAt: opts.updatedAt,
      totalScore:
        opts.vocab.score + opts.grammar_reading.score + opts.listening.score,
      totalQuestions:
        opts.vocab.total + opts.grammar_reading.total + opts.listening.total,
      sections: [
        { key: "vocab", ...opts.vocab },
        { key: "grammar_reading", ...opts.grammar_reading },
        { key: "listening", ...opts.listening },
      ],
      answers: opts.answers,
    });

    const local = makeSnapshot({
      updatedAt: "2026-11-27T08:00:00.000Z",
      vocab: {
        status: "submitted",
        score: 24,
        total: 28,
        elapsedSeconds: 900,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      grammar_reading: {
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      listening: {
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      answers: { "q-1": 2 },
    });
    const staleRemote = makeSnapshot({
      updatedAt: "2026-11-27T08:05:00.000Z",
      vocab: {
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      grammar_reading: {
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      listening: {
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      answers: {},
    });

    const merged = mergeExamAttempts(local, staleRemote);
    expect(merged.sections[0].status).toBe("submitted");
    expect(merged.sections[0].score).toBe(24);
    expect(merged.answers["q-1"]).toBe(2);
    expect(merged.totalScore).toBe(24);
    expect(merged.status).toBe("in_progress");
    expect(merged.completedAt).toBeNull();
  });

  it("transitions attempt status to completed once all 3 sections are locked and keeps completed immutable", () => {
    const base: ExamAttemptRecord = {
      id: "attempt-sync-2",
      owner: "user-1",
      level: "n4",
      examId: "n4-2024-12",
      status: "in_progress",
      attemptNumber: 1,
      startedAt: "2026-11-27T07:45:00.000Z",
      completedAt: null,
      updatedAt: "2026-11-27T08:10:00.000Z",
      totalScore: 40,
      totalQuestions: 85,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 20,
          total: 28,
          elapsedSeconds: 900,
          submittedAt: "2026-11-27T08:00:00.000Z",
        },
        {
          key: "grammar_reading",
          status: "timed_out",
          score: 20,
          total: 29,
          elapsedSeconds: 3300,
          submittedAt: "2026-11-27T08:10:00.000Z",
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
      answers: { "q-1": 1, "q-2": 3 },
    };

    const finishListening: ExamAttemptRecord = {
      ...base,
      updatedAt: "2026-11-27T08:20:00.000Z",
      sections: [
        base.sections[0],
        base.sections[1],
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 28,
          elapsedSeconds: 0,
          submittedAt: "2026-11-27T08:20:00.000Z",
        },
      ],
      answers: { "q-1": 1, "q-2": 3 },
    };

    const completed = mergeExamAttempts(base, finishListening);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-11-27T08:20:00.000Z");
    expect(completed.totalScore).toBe(40);

    const tamperAttempt: ExamAttemptRecord = {
      ...completed,
      updatedAt: "2026-11-27T09:00:00.000Z",
      totalScore: 85,
      sections: completed.sections.map((s) => ({
        ...s,
        status: "submitted",
        score: s.total,
      })),
      answers: { "q-1": 0 },
    };

    const immutable = mergeExamAttempts(completed, tamperAttempt);
    expect(immutable).toEqual(completed);
  });
});

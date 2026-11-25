import { describe, expect, it } from "vitest";
import {
  EXAM_SECTION_DURATIONS,
  canAccessSection,
  computeRemainingSeconds,
  countSectionQuestions,
  formatCountdown,
  gradeSection,
  isSectionLocked,
  listSectionQuestions,
  summarizeExamAttempt,
} from "./engine";
import type { ExamDocument, ExamQuestion, ExamSection } from "./types";

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
      completedAt: "2026-11-25T12:00:00.000Z",
      totalScore: 2,
      totalQuestions: 4,
      sections: [
        {
          key: "vocab",
          status: "submitted",
          score: 2,
          total: 3,
          elapsedSeconds: 900,
        },
        {
          key: "grammar_reading",
          status: "timed_out",
          score: 0,
          total: 1,
          elapsedSeconds: 3300,
        },
        {
          key: "listening",
          status: "skipped",
          score: 0,
          total: 0,
          elapsedSeconds: 0,
        },
      ],
      answers: { q1: 0, q2: 2, q4: 0 },
    });
  });
});

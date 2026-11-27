import { describe, expect, it } from "vitest";
import { computeJlptScore } from "./scoring";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamQuestion,
  ExamQuestionGroup,
  ExamSection,
} from "./types";

function makeQuestions(
  prefix: string,
  count: number,
  startNumber = 1,
): ExamQuestion[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}-${idx + 1}`,
    number: startNumber + idx,
    prompt: `Q${startNumber + idx}`,
    promptRuby: `Q${startNumber + idx}`,
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    answerSource: "official_key",
    translation: `T${startNumber + idx}`,
    explanation: `E${startNumber + idx}`,
  }));
}

function makeGroup(
  id: string,
  label: string,
  prefix: string,
  count: number,
  startNumber = 1,
): ExamQuestionGroup {
  return {
    id,
    label,
    instructionJa: "ja",
    instructionVi: "vi",
    questions: makeQuestions(prefix, count, startNumber),
  };
}

function makeN4Exam(withListening = true): ExamDocument {
  const vocab: ExamSection = {
    key: "vocab",
    title: "Từ vựng & Chữ Hán",
    titleJa: "文字・語彙",
    durationSeconds: 1500,
    audioAvailable: false,
    groups: [
      makeGroup("v-m1", "問題1 — Cách đọc chữ Hán", "v1", 14, 1),
      makeGroup("v-m2", "問題2 — Chọn chữ Hán đúng", "v2", 14, 15),
    ],
  };
  const grammarReading: ExamSection = {
    key: "grammar_reading",
    title: "Ngữ pháp & Đọc hiểu",
    titleJa: "文法・読解",
    durationSeconds: 3300,
    audioAvailable: false,
    groups: [
      makeGroup("g-m1", "問題1 — Chọn ngữ pháp đúng", "g1", 20, 1),
      makeGroup("g-m5", "問題5 — Đọc hiểu trung bình", "g5", 9, 21),
    ],
  };
  const listening: ExamSection = {
    key: "listening",
    title: "Nghe hiểu",
    titleJa: "聴解",
    durationSeconds: 2100,
    audioAvailable: false,
    groups: withListening
      ? [makeGroup("l-m1", "問題1 — Hiểu nhiệm vụ", "l1", 28, 1)]
      : [],
  };
  return {
    id: "n4-2024-07",
    level: "n4",
    year: 2024,
    month: 7,
    code: "2024-07",
    title: "Đề thi JLPT N4 — Tháng 7/2024",
    answerSourceSummary: "official_key",
    hasListeningScript: withListening,
    hasSourceAudio: false,
    sections: [vocab, grammarReading, listening],
  };
}

function attemptWith(
  vocabScore: number,
  vocabTotal: number,
  grScore: number,
  grTotal: number,
  listeningScore: number,
  listeningTotal: number,
  answers: Record<string, number> = {},
): ExamAttemptRecord {
  const ts = "2026-11-27T08:30:00.000Z";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner: "guest",
    level: "n4",
    examId: "n4-2024-07",
    status: "completed",
    attemptNumber: 1,
    startedAt: "2026-11-27T08:00:00.000Z",
    completedAt: ts,
    updatedAt: ts,
    totalScore: vocabScore + grScore + listeningScore,
    totalQuestions: vocabTotal + grTotal + listeningTotal,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: vocabScore,
        total: vocabTotal,
        elapsedSeconds: 900,
        submittedAt: ts,
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: grScore,
        total: grTotal,
        elapsedSeconds: 2000,
        submittedAt: ts,
      },
      {
        key: "listening",
        status: "submitted",
        score: listeningScore,
        total: listeningTotal,
        elapsedSeconds: 1200,
        submittedAt: ts,
      },
    ],
    answers,
  };
}

function attemptWithSkippedListening(
  vocabScore: number,
  vocabTotal: number,
  grScore: number,
  grTotal: number,
): ExamAttemptRecord {
  const ts = "2026-11-27T08:30:00.000Z";
  return {
    id: "22222222-2222-4222-8222-222222222222",
    owner: "guest",
    level: "n4",
    examId: "n4-2024-07",
    status: "completed",
    attemptNumber: 1,
    startedAt: "2026-11-27T08:00:00.000Z",
    completedAt: ts,
    updatedAt: ts,
    totalScore: vocabScore + grScore,
    totalQuestions: vocabTotal + grTotal + 28,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: vocabScore,
        total: vocabTotal,
        elapsedSeconds: 900,
        submittedAt: ts,
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: grScore,
        total: grTotal,
        elapsedSeconds: 2000,
        submittedAt: ts,
      },
      {
        key: "listening",
        status: "skipped",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: ts,
      },
    ],
    answers: {},
  };
}

describe("computeJlptScore", () => {
  it("detects pass when total >= 90 and both cutoffs met (38/120 and 19/60)", () => {
    const report = computeJlptScore(
      attemptWith(20, 28, 22, 29, 14, 28),
      makeN4Exam(),
    );
    expect(report.totalMax).toBe(180);
    expect(report.passThreshold).toBe(90);
    expect(report.languageReadingMax).toBe(120);
    expect(report.languageReadingCutoff).toBe(38);
    expect(report.listeningMax).toBe(60);
    expect(report.listeningCutoff).toBe(19);
    expect(report.languageReadingScaled).toBeGreaterThanOrEqual(38);
    expect(report.listeningScaled).toBeGreaterThanOrEqual(19);
    expect(report.totalScaled).toBeGreaterThanOrEqual(90);
    expect(report.listeningSkipped).toBe(false);
    expect(report.passed).toBe(true);
    expect(report.failedByCutoff).toBe("none");
  });

  it("flags listening cutoff failure even when total >= 90", () => {
    const report = computeJlptScore(
      attemptWith(28, 28, 29, 29, 5, 28),
      makeN4Exam(),
    );
    expect(report.totalScaled).toBeGreaterThanOrEqual(90);
    expect(report.listeningScaled).toBeLessThan(19);
    expect(report.passed).toBe(false);
    expect(report.failedByCutoff).toBe("listening");
    expect(report.verdictVi).toContain("liệt phần Nghe hiểu");
  });

  it("flags language_reading cutoff failure even when listening is perfect and total >= 90", () => {
    const report = computeJlptScore(
      attemptWith(8, 28, 9, 29, 28, 28),
      makeN4Exam(),
    );
    expect(report.languageReadingScaled).toBeLessThan(38);
    expect(report.listeningScaled).toBe(60);
    expect(report.totalScaled).toBeGreaterThanOrEqual(90);
    expect(report.passed).toBe(false);
    expect(report.failedByCutoff).toBe("language_reading");
  });

  it("flags both cutoffs when both language_reading and listening fail", () => {
    const report = computeJlptScore(
      attemptWith(5, 28, 5, 29, 3, 28),
      makeN4Exam(),
    );
    expect(report.passed).toBe(false);
    expect(report.failedByCutoff).toBe("both");
  });

  it("fails on total < 90 even when both section cutoffs are passed", () => {
    // 22/57 * 120 = 46 (>=38), 10/28 * 60 = 21 (>=19), total = 67 (<90)
    const report = computeJlptScore(
      attemptWith(11, 28, 11, 29, 10, 28),
      makeN4Exam(),
    );
    expect(report.languageReadingScaled).toBeGreaterThanOrEqual(38);
    expect(report.listeningScaled).toBeGreaterThanOrEqual(19);
    expect(report.totalScaled).toBeLessThan(90);
    expect(report.failedByCutoff).toBe("none");
    expect(report.passed).toBe(false);
  });

  it("marks listeningSkipped honestly without inflating total score", () => {
    const report = computeJlptScore(
      attemptWithSkippedListening(28, 28, 29, 29),
      makeN4Exam(),
    );
    expect(report.listeningSkipped).toBe(true);
    expect(report.listeningScaled).toBe(0);
    expect(report.totalScaled).toBe(120);
    expect(report.passed).toBe(false);
  });

  it("identifies the weakest Mondai group across attempted sections and ignores skipped sections", () => {
    const exam = makeN4Exam();
    const answers: Record<string, number> = {};
    // Make v1 all right (0 missed), v2 2 missed, g1 1 missed, g5 6 missed
    for (let i = 1; i <= 14; i++) answers[`v1-${i}`] = 0;
    for (let i = 1; i <= 12; i++) answers[`v2-${i}`] = 0;
    answers["v2-13"] = 1;
    answers["v2-14"] = 2;
    for (let i = 1; i <= 19; i++) answers[`g1-${i}`] = 0;
    answers["g1-20"] = 1;
    for (let i = 1; i <= 3; i++) answers[`g5-${i}`] = 0;
    // g5-4..9 left blank -> 6 missed

    const attempt = attemptWithSkippedListening(26, 28, 22, 29);
    attempt.answers = answers;

    const report = computeJlptScore(attempt, exam);
    expect(report.weakestGroup).toEqual({
      label: "問題5 — Đọc hiểu trung bình",
      sectionTitle: "Ngữ pháp & Đọc hiểu",
      missedCount: 6,
    });
  });

  it("returns weakestGroup = null when all attempted sections have 100% correct answers", () => {
    const exam = makeN4Exam(false);
    const answers: Record<string, number> = {};
    for (let i = 1; i <= 14; i++) answers[`v1-${i}`] = 0;
    for (let i = 1; i <= 14; i++) answers[`v2-${i}`] = 0;
    for (let i = 1; i <= 20; i++) answers[`g1-${i}`] = 0;
    for (let i = 1; i <= 9; i++) answers[`g5-${i}`] = 0;

    const attempt = attemptWithSkippedListening(28, 28, 29, 29);
    attempt.sections[2].total = 0;
    attempt.totalQuestions = 57;
    attempt.answers = answers;

    const report = computeJlptScore(attempt, exam);
    expect(report.weakestGroup).toBeNull();
  });
});

import { countSectionQuestions } from "./engine";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamSectionAttemptSummary,
  ExamSectionKey,
} from "./types";

export interface JlptScoreReport {
  totalScaled: number;
  totalMax: 180;
  passThreshold: 90;
  languageReadingScaled: number;
  languageReadingMax: 120;
  languageReadingCutoff: 38;
  listeningScaled: number;
  listeningMax: 60;
  listeningCutoff: 19;
  listeningSkipped: boolean;
  passed: boolean;
  failedByCutoff: "none" | "language_reading" | "listening" | "both";
  verdictVi: string;
  weakestGroup: {
    label: string;
    sectionTitle: string;
    missedCount: number;
  } | null;
}

const TOTAL_MAX = 180 as const;
const PASS_THRESHOLD = 90 as const;
const LR_MAX = 120 as const;
const LR_CUTOFF = 38 as const;
const LISTENING_MAX = 60 as const;
const LISTENING_CUTOFF = 19 as const;

function scalePoints(score: number, total: number, maxScaled: number): number {
  if (total <= 0 || score <= 0) return 0;
  return Math.min(
    maxScaled,
    Math.max(0, Math.round((score / total) * maxScaled)),
  );
}

function isAttemptedSection(
  summary: ExamSectionAttemptSummary | undefined,
): boolean {
  return summary?.status === "submitted" || summary?.status === "timed_out";
}

function findWeakestGroup(
  attempt: ExamAttemptRecord,
  exam: ExamDocument,
  summaryByKey: ReadonlyMap<ExamSectionKey, ExamSectionAttemptSummary>,
): JlptScoreReport["weakestGroup"] {
  let weakest: {
    label: string;
    sectionTitle: string;
    missedCount: number;
    missRate: number;
  } | null = null;

  for (const section of exam.sections) {
    if (!isAttemptedSection(summaryByKey.get(section.key))) continue;
    for (const group of section.groups) {
      if (group.questions.length === 0) continue;
      let missedCount = 0;
      for (const question of group.questions) {
        if (attempt.answers[question.id] !== question.answerIndex) {
          missedCount += 1;
        }
      }
      if (missedCount === 0) continue;
      const missRate = missedCount / group.questions.length;
      if (
        !weakest ||
        missedCount > weakest.missedCount ||
        (missedCount === weakest.missedCount && missRate > weakest.missRate)
      ) {
        weakest = {
          label: group.label,
          sectionTitle: section.title,
          missedCount,
          missRate,
        };
      }
    }
  }

  return weakest
    ? {
        label: weakest.label,
        sectionTitle: weakest.sectionTitle,
        missedCount: weakest.missedCount,
      }
    : null;
}

function buildVerdictVi(params: {
  passed: boolean;
  listeningSkipped: boolean;
  failedByCutoff: JlptScoreReport["failedByCutoff"];
  totalScaled: number;
  languageReadingScaled: number;
}): string {
  const {
    passed,
    listeningSkipped,
    failedByCutoff,
    totalScaled,
    languageReadingScaled,
  } = params;

  if (passed) {
    return "Đạt chuẩn đỗ JLPT (tổng điểm từ 90/180 trở lên và vượt qua cả hai ngưỡng điểm liệt).";
  }

  if (listeningSkipped) {
    if (failedByCutoff === "language_reading") {
      return "Chưa làm phần Nghe hiểu và phần Kiến thức ngôn ngữ · Đọc hiểu dưới ngưỡng liệt (38/120).";
    }
    if (totalScaled >= PASS_THRESHOLD) {
      return "Đủ mốc tổng điểm nhưng chưa làm phần Nghe hiểu nên chưa đủ điều kiện đỗ JLPT.";
    }
    return `Chưa làm phần Nghe hiểu; phần Kiến thức ngôn ngữ · Đọc hiểu đạt ${languageReadingScaled}/120.`;
  }

  if (failedByCutoff === "both") {
    return "Chưa đạt do bị điểm liệt cả hai phần (Kiến thức ngôn ngữ · Đọc hiểu < 38/120 và Nghe hiểu < 19/60).";
  }

  if (failedByCutoff === "language_reading") {
    return totalScaled >= PASS_THRESHOLD
      ? "Đủ tổng điểm nhưng bị liệt phần Kiến thức ngôn ngữ · Đọc hiểu (< 38/120)."
      : "Chưa đạt: tổng điểm dưới 90/180 và bị liệt phần Kiến thức ngôn ngữ · Đọc hiểu (< 38/120).";
  }

  if (failedByCutoff === "listening") {
    return totalScaled >= PASS_THRESHOLD
      ? "Đủ tổng điểm nhưng bị liệt phần Nghe hiểu (< 19/60)."
      : "Chưa đạt: tổng điểm dưới 90/180 và bị liệt phần Nghe hiểu (< 19/60).";
  }

  return `Chưa đạt tổng điểm tối thiểu 90/180 (còn thiếu ${PASS_THRESHOLD - totalScaled} điểm).`;
}

export function computeJlptScore(
  attempt: ExamAttemptRecord,
  exam: ExamDocument,
): JlptScoreReport {
  const summaryByKey = new Map(attempt.sections.map((s) => [s.key, s]));
  const examSectionByKey = new Map(exam.sections.map((s) => [s.key, s]));

  const sectionScoreAndTotal = (key: ExamSectionKey) => {
    const summary = summaryByKey.get(key);
    const examSec = examSectionByKey.get(key);
    const total =
      summary?.total ?? (examSec ? countSectionQuestions(examSec) : 0);
    const score = isAttemptedSection(summary) ? (summary?.score ?? 0) : 0;
    return { summary, score, total };
  };

  const vocab = sectionScoreAndTotal("vocab");
  const grammarReading = sectionScoreAndTotal("grammar_reading");
  const listening = sectionScoreAndTotal("listening");

  const languageReadingScaled = scalePoints(
    vocab.score + grammarReading.score,
    vocab.total + grammarReading.total,
    LR_MAX,
  );

  const listeningSkipped =
    !isAttemptedSection(listening.summary) || listening.total === 0;
  const listeningScaled = listeningSkipped
    ? 0
    : scalePoints(listening.score, listening.total, LISTENING_MAX);
  const totalScaled = languageReadingScaled + listeningScaled;

  const lrFailed = languageReadingScaled < LR_CUTOFF;
  const listeningFailed =
    !listeningSkipped && listeningScaled < LISTENING_CUTOFF;

  let failedByCutoff: JlptScoreReport["failedByCutoff"] = "none";
  if (lrFailed && listeningFailed) {
    failedByCutoff = "both";
  } else if (lrFailed) {
    failedByCutoff = "language_reading";
  } else if (listeningFailed) {
    failedByCutoff = "listening";
  }

  const passed =
    !listeningSkipped &&
    failedByCutoff === "none" &&
    totalScaled >= PASS_THRESHOLD;

  return {
    totalScaled,
    totalMax: TOTAL_MAX,
    passThreshold: PASS_THRESHOLD,
    languageReadingScaled,
    languageReadingMax: LR_MAX,
    languageReadingCutoff: LR_CUTOFF,
    listeningScaled,
    listeningMax: LISTENING_MAX,
    listeningCutoff: LISTENING_CUTOFF,
    listeningSkipped,
    passed,
    failedByCutoff,
    verdictVi: buildVerdictVi({
      passed,
      listeningSkipped,
      failedByCutoff,
      totalScaled,
      languageReadingScaled,
    }),
    weakestGroup: findWeakestGroup(attempt, exam, summaryByKey),
  };
}

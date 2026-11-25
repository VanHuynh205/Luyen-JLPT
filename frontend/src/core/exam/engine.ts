import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamQuestion,
  ExamSection,
  ExamSectionAttemptSummary,
  ExamSectionKey,
  ExamSectionStatus,
} from "./types";

export const EXAM_SECTION_DURATIONS: Record<ExamSectionKey, number> = {
  vocab: 1500,
  grammar_reading: 3300,
  listening: 2100,
};

export function listSectionQuestions(section: ExamSection): ExamQuestion[] {
  return section.groups.flatMap((group) => group.questions);
}

export function countSectionQuestions(section: ExamSection): number {
  let count = 0;
  for (const group of section.groups) {
    count += group.questions.length;
  }
  return count;
}

export function gradeSection(
  section: ExamSection,
  answers: Readonly<Record<string, number>>,
): { score: number; total: number; answered: number } {
  const questions = listSectionQuestions(section);
  let score = 0;
  let answered = 0;
  for (const question of questions) {
    if (!Object.prototype.hasOwnProperty.call(answers, question.id)) continue;
    const chosen = answers[question.id];
    if (typeof chosen !== "number") continue;
    answered += 1;
    if (chosen === question.answerIndex) score += 1;
  }
  return { score, total: questions.length, answered };
}

export function isSectionLocked(status: ExamSectionStatus): boolean {
  return (
    status === "submitted" || status === "timed_out" || status === "skipped"
  );
}

export function canAccessSection(
  statuses: readonly ExamSectionStatus[],
  index: number,
): boolean {
  if (index < 0 || index >= statuses.length) return false;
  if (index === 0) return true;
  return isSectionLocked(statuses[index - 1]);
}

export function computeRemainingSeconds(
  deadlineMs: number,
  nowMs: number,
): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function formatCountdown(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export interface SummarizeExamAttemptInput {
  id: string;
  owner: string;
  exam: ExamDocument;
  answers: Readonly<Record<string, number>>;
  sectionMeta: Partial<
    Record<
      ExamSectionKey,
      { status: ExamSectionAttemptSummary["status"]; elapsedSeconds: number }
    >
  >;
  completedAt?: string;
}

export function summarizeExamAttempt({
  id,
  owner,
  exam,
  answers,
  sectionMeta,
  completedAt = new Date().toISOString(),
}: SummarizeExamAttemptInput): ExamAttemptRecord {
  const filteredAnswers: Record<string, number> = {};
  const sections: ExamSectionAttemptSummary[] = [];
  let totalScore = 0;
  let totalQuestions = 0;

  for (const section of exam.sections) {
    const questions = listSectionQuestions(section);
    for (const q of questions) {
      if (!Object.prototype.hasOwnProperty.call(answers, q.id)) continue;
      const chosen = answers[q.id];
      if (
        Number.isInteger(chosen) &&
        chosen >= 0 &&
        chosen < q.choices.length
      ) {
        filteredAnswers[q.id] = chosen;
      }
    }
    const meta = sectionMeta[section.key];
    const status = meta?.status ?? "skipped";
    const elapsedSeconds = Number.isFinite(meta?.elapsedSeconds)
      ? Math.max(0, Math.floor(meta?.elapsedSeconds ?? 0))
      : 0;
    const graded = gradeSection(section, filteredAnswers);
    const score = status === "skipped" ? 0 : graded.score;
    sections.push({
      key: section.key,
      status,
      score,
      total: graded.total,
      elapsedSeconds,
    });
    totalScore += score;
    totalQuestions += graded.total;
  }

  return {
    id,
    owner,
    level: exam.level,
    examId: exam.id,
    completedAt,
    totalScore,
    totalQuestions,
    sections,
    answers: filteredAnswers,
  };
}

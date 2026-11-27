import type {
  ExamAttemptRecord,
  ExamAttemptStatus,
  ExamDocument,
  ExamQuestion,
  ExamSection,
  ExamSectionAttemptStatus,
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

const FORBIDDEN_ANSWER_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function isFinalAttemptSectionStatus(
  status: ExamSectionAttemptStatus,
): boolean {
  return (
    status === "submitted" || status === "timed_out" || status === "skipped"
  );
}

function compareIso(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (
    Number.isFinite(leftMs) &&
    Number.isFinite(rightMs) &&
    leftMs !== rightMs
  ) {
    return leftMs < rightMs ? -1 : 1;
  }
  return left.localeCompare(right);
}

function copySafeAnswers(
  ...sources: ReadonlyArray<Readonly<Record<string, number>>>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (FORBIDDEN_ANSWER_KEYS.has(key)) continue;
      const value = source[key];
      if (Number.isInteger(value) && value >= 0 && value <= 3) {
        result[key] = value;
      }
    }
  }
  return result;
}

export interface ExamSectionMetaInput {
  status: ExamSectionAttemptStatus;
  elapsedSeconds: number;
  submittedAt?: string | null;
}

export interface BuildExamAttemptInput {
  id: string;
  owner: string;
  exam: ExamDocument;
  answers: Readonly<Record<string, number>>;
  sectionMeta: Partial<Record<ExamSectionKey, ExamSectionMetaInput>>;
  attemptNumber?: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export function buildExamAttemptSnapshot({
  id,
  owner,
  exam,
  answers,
  sectionMeta,
  attemptNumber = 1,
  startedAt,
  updatedAt,
  completedAt,
}: BuildExamAttemptInput): ExamAttemptRecord {
  const now = updatedAt ?? completedAt ?? new Date().toISOString();
  const effectiveStartedAt = startedAt ?? now;
  const effectiveAttemptNumber =
    Number.isInteger(attemptNumber) && attemptNumber >= 1 ? attemptNumber : 1;

  const filteredAnswers: Record<string, number> = {};
  const sections: ExamSectionAttemptSummary[] = [];
  let totalScore = 0;
  let totalQuestions = 0;

  for (const section of exam.sections) {
    const meta = sectionMeta[section.key];
    const status: ExamSectionAttemptStatus = meta?.status ?? "pending";
    const questions = listSectionQuestions(section);
    if (status !== "pending") {
      for (const q of questions) {
        if (
          FORBIDDEN_ANSWER_KEYS.has(q.id) ||
          !Object.prototype.hasOwnProperty.call(answers, q.id)
        )
          continue;
        const chosen = answers[q.id];
        if (
          Number.isInteger(chosen) &&
          chosen >= 0 &&
          chosen < q.choices.length &&
          chosen <= 3
        ) {
          filteredAnswers[q.id] = chosen;
        }
      }
    }

    const elapsedSeconds =
      status === "pending"
        ? 0
        : Number.isFinite(meta?.elapsedSeconds)
          ? Math.max(0, Math.floor(meta?.elapsedSeconds ?? 0))
          : 0;
    const graded = gradeSection(section, filteredAnswers);
    const score =
      status === "pending" || status === "skipped" ? 0 : graded.score;
    const submittedAt =
      status === "pending" ? null : (meta?.submittedAt ?? now);

    sections.push({
      key: section.key,
      status,
      score,
      total: graded.total,
      elapsedSeconds,
      submittedAt,
    });
    totalScore += score;
    totalQuestions += graded.total;
  }

  const allLocked =
    sections.length > 0 &&
    sections.every((s) => isFinalAttemptSectionStatus(s.status));
  const status: ExamAttemptStatus = allLocked ? "completed" : "in_progress";

  return {
    id,
    owner,
    level: exam.level,
    examId: exam.id,
    status,
    attemptNumber: effectiveAttemptNumber,
    startedAt: effectiveStartedAt,
    completedAt: status === "completed" ? (completedAt ?? now) : null,
    updatedAt: now,
    totalScore,
    totalQuestions,
    sections,
    answers: filteredAnswers,
  };
}

export function mergeExamAttempts(
  local: ExamAttemptRecord,
  incoming: ExamAttemptRecord,
): ExamAttemptRecord {
  if (
    local.id !== incoming.id ||
    local.owner !== incoming.owner ||
    local.level !== incoming.level ||
    local.examId !== incoming.examId
  ) {
    throw new Error("Cannot merge different exam attempts");
  }

  if (local.status === "completed") {
    return {
      ...local,
      sections: local.sections.map((section) => ({ ...section })),
      answers: copySafeAnswers(local.answers),
    };
  }

  const incomingByKey = new Map(
    incoming.sections.map((section) => [section.key, section]),
  );
  const mergedSections: ExamSectionAttemptSummary[] = local.sections.map(
    (localSec) => {
      const incSec = incomingByKey.get(localSec.key);
      if (!incSec) return { ...localSec };
      const localLocked = isFinalAttemptSectionStatus(localSec.status);
      const incLocked = isFinalAttemptSectionStatus(incSec.status);
      if (localLocked && !incLocked) return { ...localSec };
      if (!localLocked && incLocked) return { ...incSec };
      if (localLocked && incLocked) {
        if (
          localSec.submittedAt &&
          incSec.submittedAt &&
          compareIso(incSec.submittedAt, localSec.submittedAt) < 0
        ) {
          return { ...incSec };
        }
        return { ...localSec };
      }
      return compareIso(incoming.updatedAt, local.updatedAt) > 0
        ? { ...incSec }
        : { ...localSec };
    },
  );

  for (const incSec of incoming.sections) {
    if (!mergedSections.some((sec) => sec.key === incSec.key)) {
      mergedSections.push({ ...incSec });
    }
  }

  const mergedAnswers = copySafeAnswers(incoming.answers, local.answers);
  const totalScore = mergedSections.reduce((sum, sec) => sum + sec.score, 0);
  const totalQuestions = mergedSections.reduce(
    (sum, sec) => sum + sec.total,
    0,
  );
  const allLocked =
    mergedSections.length > 0 &&
    mergedSections.every((sec) => isFinalAttemptSectionStatus(sec.status));
  const status: ExamAttemptStatus = allLocked ? "completed" : "in_progress";
  const startedAt =
    compareIso(local.startedAt, incoming.startedAt) <= 0
      ? local.startedAt
      : incoming.startedAt;
  const updatedAt =
    compareIso(local.updatedAt, incoming.updatedAt) >= 0
      ? local.updatedAt
      : incoming.updatedAt;

  let completedAt: string | null = null;
  if (status === "completed") {
    const latestSubmitted = mergedSections
      .map((sec) => sec.submittedAt)
      .filter((ts): ts is string => typeof ts === "string" && ts.length > 0)
      .sort(compareIso)
      .at(-1);
    completedAt =
      local.completedAt ?? incoming.completedAt ?? latestSubmitted ?? updatedAt;
  }

  return {
    id: local.id,
    owner: local.owner,
    level: local.level,
    examId: local.examId,
    status,
    attemptNumber: Math.min(local.attemptNumber, incoming.attemptNumber),
    startedAt,
    completedAt,
    updatedAt,
    totalScore,
    totalQuestions,
    sections: mergedSections,
    answers: mergedAnswers,
  };
}

export interface SummarizeExamAttemptInput {
  id: string;
  owner: string;
  exam: ExamDocument;
  answers: Readonly<Record<string, number>>;
  sectionMeta: Partial<Record<ExamSectionKey, ExamSectionMetaInput>>;
  attemptNumber?: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export function summarizeExamAttempt({
  id,
  owner,
  exam,
  answers,
  sectionMeta,
  attemptNumber = 1,
  startedAt,
  updatedAt,
  completedAt = new Date().toISOString(),
}: SummarizeExamAttemptInput): ExamAttemptRecord {
  const filledMeta: Partial<Record<ExamSectionKey, ExamSectionMetaInput>> = {};
  for (const section of exam.sections) {
    const meta = sectionMeta[section.key];
    filledMeta[section.key] = meta ?? {
      status: "skipped",
      elapsedSeconds: 0,
      submittedAt: completedAt,
    };
  }
  return buildExamAttemptSnapshot({
    id,
    owner,
    exam,
    answers,
    sectionMeta: filledMeta,
    attemptNumber,
    startedAt: startedAt ?? completedAt,
    updatedAt: updatedAt ?? completedAt,
    completedAt,
  });
}

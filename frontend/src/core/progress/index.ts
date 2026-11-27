import { LEVELS, type Level } from "../content/types";
import {
  EXAM_SECTION_KEYS,
  type ExamAttemptStatus,
  type ExamSectionAttemptStatus,
  type ExamSectionAttemptSummary,
} from "../exam/types";
import {
  KanjiQuizMode,
  type KanjiQuizResult,
  type ProgressSummary,
  type ReadingResult,
} from "./types";

const EXAM_SECTION_STATUSES: readonly ExamSectionAttemptStatus[] = [
  "pending",
  "submitted",
  "timed_out",
  "skipped",
];
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_EXAM_ANSWERS_BYTES = 65_536;
const MAX_EXAM_SECTIONS_BYTES = 16_384;
const textEncoder = new TextEncoder();

export const GUEST_OWNER = "guest";

export type ProgressScope = { owner: string; level: Level };
export type KanjiQuizInput = {
  id?: string;
  mode: KanjiQuizMode;
  score: number;
  total: number;
  wrongItemIds: string[];
};
export type ReadingAttemptInput = {
  id?: string;
  passageId: string;
  score: number;
  total: number;
};
export type ExamAttemptProgressInput = {
  id?: string;
  examId: string;
  status: ExamAttemptStatus;
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  totalScore: number;
  totalQuestions: number;
  sections: ExamSectionAttemptSummary[];
  answers: Record<string, number>;
};

type Base = ProgressScope & { id: string; updatedAt: string };
export type ProgressRow = Base &
  (
    | { kind: "card_status"; known: boolean }
    | { kind: "grammar_learned"; learned: boolean }
    | ({ kind: "kanji_quiz_attempts" } & Omit<KanjiQuizInput, "id">)
    | ({ kind: "reading_attempts" } & Omit<ReadingAttemptInput, "id">)
    | ({ kind: "exam_attempts" } & Omit<ExamAttemptProgressInput, "id">)
  );

export type ProgressKind = ProgressRow["kind"];
export const PROGRESS_KINDS: readonly ProgressKind[] = [
  "card_status",
  "grammar_learned",
  "kanji_quiz_attempts",
  "reading_attempts",
  "exam_attempts",
];

export function isState(row: ProgressRow) {
  return row.kind === "card_status" || row.kind === "grammar_learned";
}

export function timestampKey(value: string): string {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) throw new Error("Invalid progress timestamp");
  return `${new Date(value).toISOString().slice(0, 19)}.${(match[2] ?? "").padEnd(6, "0")}Z`;
}

function timestampNanoseconds(value: string) {
  const time = timestampKey(value);
  return (
    BigInt(Date.parse(time)) * 1_000_000n + BigInt(time.slice(-4, -1)) * 1_000n
  );
}

export function validateProgressRow(row: ProgressRow) {
  const itemId = (value: unknown) =>
    typeof value === "string" &&
    value.length > 0 &&
    [...value].length <= 128 &&
    !value.includes("\0");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (
    typeof row.owner !== "string" ||
    !row.owner ||
    !LEVELS.includes(row.level)
  )
    throw new Error("Invalid progress scope");
  timestampKey(row.updatedAt);
  if (row.kind === "card_status" || row.kind === "grammar_learned") {
    if (
      !itemId(row.id) ||
      typeof (row.kind === "card_status" ? row.known : row.learned) !==
        "boolean"
    ) {
      throw new Error("Invalid progress state");
    }
    return;
  }
  if (row.kind === "exam_attempts") {
    if (
      !uuid.test(row.id) ||
      !itemId(row.examId) ||
      row.examId.includes("/") ||
      row.examId.includes("..") ||
      (row.status !== "in_progress" && row.status !== "completed") ||
      !Number.isInteger(row.attemptNumber) ||
      row.attemptNumber < 1 ||
      row.attemptNumber > 10_000 ||
      !Number.isInteger(row.totalQuestions) ||
      row.totalQuestions < 1 ||
      row.totalQuestions > 1000 ||
      !Number.isInteger(row.totalScore) ||
      row.totalScore < 0 ||
      row.totalScore > row.totalQuestions
    ) {
      throw new Error("Invalid exam attempt");
    }
    timestampKey(row.startedAt);
    if (row.status === "completed") {
      if (typeof row.completedAt !== "string") {
        throw new Error("Completed exam attempt requires completedAt");
      }
      timestampKey(row.completedAt);
    } else if (row.completedAt !== null) {
      throw new Error("In-progress exam attempt must have null completedAt");
    }
    if (
      !Array.isArray(row.sections) ||
      row.sections.length < 1 ||
      row.sections.length > 10 ||
      textEncoder.encode(JSON.stringify(row.sections)).byteLength >
        MAX_EXAM_SECTIONS_BYTES
    ) {
      throw new Error("Invalid exam attempt sections");
    }
    const seenKeys = new Set<string>();
    for (const section of row.sections) {
      if (
        !section ||
        typeof section !== "object" ||
        Array.isArray(section) ||
        !EXAM_SECTION_KEYS.includes(section.key) ||
        seenKeys.has(section.key) ||
        !EXAM_SECTION_STATUSES.includes(section.status) ||
        !Number.isInteger(section.total) ||
        section.total < 0 ||
        section.total > 1000 ||
        !Number.isInteger(section.score) ||
        section.score < 0 ||
        section.score > section.total ||
        !Number.isSafeInteger(section.elapsedSeconds) ||
        section.elapsedSeconds < 0
      ) {
        throw new Error("Invalid exam section summary");
      }
      if (section.submittedAt !== null) {
        if (typeof section.submittedAt !== "string" || !section.submittedAt) {
          throw new Error("Invalid exam section submittedAt");
        }
        timestampKey(section.submittedAt);
      }
      seenKeys.add(section.key);
    }
    if (
      typeof row.answers !== "object" ||
      row.answers === null ||
      Array.isArray(row.answers)
    ) {
      throw new Error("Invalid exam attempt answers");
    }
    for (const key of Object.keys(row.answers)) {
      if (FORBIDDEN_KEYS.has(key) || !itemId(key)) {
        throw new Error("Invalid exam answer key");
      }
      const value = row.answers[key];
      if (!Number.isInteger(value) || value < 0 || value > 3) {
        throw new Error("Invalid exam answer choice");
      }
    }
    if (
      textEncoder.encode(JSON.stringify(row.answers)).byteLength >
      MAX_EXAM_ANSWERS_BYTES
    ) {
      throw new Error("Exam attempt answers exceed size limit");
    }
    return;
  }
  if (
    !uuid.test(row.id) ||
    !Number.isInteger(row.score) ||
    !Number.isInteger(row.total) ||
    row.total < 1 ||
    row.total > 1000 ||
    row.score < 0 ||
    row.score > row.total
  ) {
    throw new Error("Invalid progress attempt");
  }
  if (
    row.kind === "reading_attempts"
      ? !itemId(row.passageId)
      : !Object.values(KanjiQuizMode).includes(row.mode) ||
        !Array.isArray(row.wrongItemIds) ||
        row.wrongItemIds.length > row.total ||
        !row.wrongItemIds.every(itemId)
  ) {
    throw new Error("Invalid progress attempt details");
  }
}

export function toKanjiResult(
  row: Extract<ProgressRow, { kind: "kanji_quiz_attempts" }>,
): KanjiQuizResult {
  return {
    id: row.id,
    mode: row.mode,
    total: BigInt(row.total),
    score: BigInt(row.score),
    wrongItemIds: row.wrongItemIds,
    takenAt: timestampNanoseconds(row.updatedAt),
  };
}

export function summarizeProgress(rows: ProgressRow[]): ProgressSummary {
  const flashcards: ProgressSummary["flashcards"] = [];
  const learnedGrammarIds: string[] = [];
  const recentKanjiResults: KanjiQuizResult[] = [];
  const reading = new Map<string, ReadingResult>();
  let knownFlashcardCount = 0n;
  const sorted = rows.map((row) => ({
    row,
    time: timestampKey(row.updatedAt),
  }));
  sorted.sort(
    (left, right) =>
      right.time.localeCompare(left.time) ||
      right.row.id.localeCompare(left.row.id),
  );

  for (const { row } of sorted) {
    switch (row.kind) {
      case "card_status":
        flashcards.push({ cardId: row.id, known: row.known });
        if (row.known) knownFlashcardCount++;
        break;
      case "grammar_learned":
        if (row.learned) learnedGrammarIds.push(row.id);
        break;
      case "kanji_quiz_attempts":
        recentKanjiResults.push(toKanjiResult(row));
        break;
      case "reading_attempts": {
        const previous = reading.get(row.passageId);
        if (previous) {
          previous.attempts++;
          if (row.score > previous.bestScore)
            previous.bestScore = BigInt(row.score);
        } else {
          reading.set(row.passageId, {
            passageId: row.passageId,
            attempts: 1n,
            lastScore: BigInt(row.score),
            bestScore: BigInt(row.score),
            total: BigInt(row.total),
            lastAttemptAt: timestampNanoseconds(row.updatedAt),
          });
        }
        break;
      }
      case "exam_attempts":
        break;
    }
  }
  return {
    knownFlashcardCount,
    flashcards,
    learnedGrammarIds,
    recentKanjiResults,
    readingResults: [...reading.values()],
  };
}

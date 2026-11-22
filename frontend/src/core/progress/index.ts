import { LEVELS, type Level } from "../content/types";
import {
  KanjiQuizMode,
  type KanjiQuizResult,
  type ProgressSummary,
  type ReadingResult,
} from "./types";

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

type Base = ProgressScope & { id: string; updatedAt: string };
export type ProgressRow = Base &
  (
    | { kind: "card_status"; known: boolean }
    | { kind: "grammar_learned"; learned: boolean }
    | ({ kind: "kanji_quiz_attempts" } & Omit<KanjiQuizInput, "id">)
    | ({ kind: "reading_attempts" } & Omit<ReadingAttemptInput, "id">)
  );

export type ProgressKind = ProgressRow["kind"];
export const PROGRESS_KINDS: readonly ProgressKind[] = [
  "card_status",
  "grammar_learned",
  "kanji_quiz_attempts",
  "reading_attempts",
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

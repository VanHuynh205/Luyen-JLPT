import { LEVELS, type Level } from "../../core/content/types";
import {
  EXAM_SECTION_KEYS,
  type ExamAttemptRecord,
  type ExamDocument,
  type ExamIndex,
} from "../../core/exam/types";
import {
  validateExamDocument,
  validateExamIndex,
} from "../../core/exam/validate";
import { timestampKey } from "../../core/progress";
import { db } from "./db";
import { isOwnerRetired } from "./retirement";

const SHA256 = /^[a-f\d]{64}$/i;
const FINAL_STATUSES = new Set(["submitted", "timed_out", "skipped"]);

export type ExamAttemptInput = Omit<ExamAttemptRecord, "id" | "completedAt"> & {
  id?: string;
  completedAt?: string;
};

function newAttemptId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10),
  ]
    .map((part) => part.join(""))
    .join("-");
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateAttemptRecord(record: ExamAttemptRecord): void {
  if (
    typeof record.id !== "string" ||
    record.id.length < 1 ||
    record.id.length > 128
  ) {
    throw new Error("Invalid exam attempt id");
  }
  if (typeof record.owner !== "string" || !record.owner) {
    throw new Error("Invalid exam attempt owner");
  }
  if (!LEVELS.includes(record.level)) {
    throw new Error("Invalid exam attempt level");
  }
  if (
    typeof record.examId !== "string" ||
    record.examId.length < 1 ||
    record.examId.length > 128
  ) {
    throw new Error("Invalid examId");
  }
  timestampKey(record.completedAt);
  if (
    !isNonNegInt(record.totalQuestions) ||
    !isNonNegInt(record.totalScore) ||
    record.totalScore > record.totalQuestions
  ) {
    throw new Error("Invalid exam attempt score");
  }
  if (
    !Array.isArray(record.sections) ||
    record.sections.length !== EXAM_SECTION_KEYS.length
  ) {
    throw new Error("Invalid exam attempt sections");
  }
  let scoreSum = 0;
  let totalSum = 0;
  for (let i = 0; i < EXAM_SECTION_KEYS.length; i++) {
    const section = record.sections[i];
    if (
      !section ||
      section.key !== EXAM_SECTION_KEYS[i] ||
      !FINAL_STATUSES.has(section.status) ||
      !isNonNegInt(section.score) ||
      !isNonNegInt(section.total) ||
      !isNonNegInt(section.elapsedSeconds) ||
      section.score > section.total
    ) {
      throw new Error(`Invalid exam section summary: ${EXAM_SECTION_KEYS[i]}`);
    }
    scoreSum += section.score;
    totalSum += section.total;
  }
  if (scoreSum !== record.totalScore || totalSum !== record.totalQuestions) {
    throw new Error("Exam attempt totals do not match section summaries");
  }
  if (
    typeof record.answers !== "object" ||
    record.answers === null ||
    Array.isArray(record.answers)
  ) {
    throw new Error("Invalid exam answers");
  }
  for (const [questionId, choice] of Object.entries(record.answers)) {
    if (
      !questionId ||
      questionId.length > 128 ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > 3
    ) {
      throw new Error(`Invalid answer for ${questionId}`);
    }
  }
}

function indexKey(level: Level): string {
  return `examIndex:${level}`;
}

export const examStore = {
  async recordAttempt(input: ExamAttemptInput): Promise<ExamAttemptRecord> {
    const record: ExamAttemptRecord = {
      ...input,
      id: input.id ?? newAttemptId(),
      completedAt: input.completedAt ?? new Date().toISOString(),
    };
    validateAttemptRecord(record);
    return db.transaction("rw", db.examAttempts, db.settings, async () => {
      if (await isOwnerRetired(record.owner)) {
        throw new Error("Owner is retired");
      }
      await db.examAttempts.put(record);
      return record;
    });
  },

  async listAttempts(
    owner: string,
    level: Level,
    examId?: string,
  ): Promise<ExamAttemptRecord[]> {
    const rows = examId
      ? await db.examAttempts
          .where("[owner+level+examId]")
          .equals([owner, level, examId])
          .toArray()
      : await db.examAttempts
          .where("[owner+level]")
          .equals([owner, level])
          .toArray();
    rows.sort(
      (left, right) =>
        timestampKey(right.completedAt).localeCompare(
          timestampKey(left.completedAt),
        ) || right.id.localeCompare(left.id),
    );
    return rows;
  },

  async getCachedExam(
    level: Level,
    id: string,
    expectedSha256?: string,
  ): Promise<ExamDocument | null> {
    const row = await db.examPacks.get([level, id]).catch(() => undefined);
    if (!row) return null;
    if (
      expectedSha256 &&
      row.sha256.toLowerCase() !== expectedSha256.toLowerCase()
    ) {
      return null;
    }
    const result = validateExamDocument(row.exam);
    if (!result.ok) return null;
    if (result.value.level !== level || result.value.id !== id) return null;
    return result.value;
  },

  async cacheExam(exam: ExamDocument, sha256: string): Promise<void> {
    const result = validateExamDocument(exam);
    if (!result.ok) throw new Error(`Invalid exam: ${result.error.detail}`);
    if (!SHA256.test(sha256)) throw new Error("Invalid exam sha256");
    await db.examPacks.put({
      level: result.value.level,
      id: result.value.id,
      exam: result.value,
      sha256: sha256.toLowerCase(),
    });
  },

  async getCachedIndex(level: Level): Promise<ExamIndex | null> {
    const row = await db.settings.get(indexKey(level)).catch(() => undefined);
    if (!row) return null;
    const result = validateExamIndex(row.value);
    if (!result.ok || result.value.level !== level) return null;
    return result.value;
  },

  async cacheIndex(index: ExamIndex): Promise<void> {
    const result = validateExamIndex(index);
    if (!result.ok) {
      throw new Error(`Invalid exam index: ${result.error.detail}`);
    }
    await db.settings.put({
      key: indexKey(result.value.level),
      value: result.value,
    });
  },
};

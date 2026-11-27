import { LEVELS, type Level } from "../../core/content/types";
import { mergeExamAttempts } from "../../core/exam/engine";
import {
  EXAM_SECTION_KEYS,
  type ExamAttemptRecord,
  type ExamDocument,
  type ExamIndex,
  type ExamSectionAttemptSummary,
} from "../../core/exam/types";
import {
  validateExamDocument,
  validateExamIndex,
} from "../../core/exam/validate";
import {
  GUEST_OWNER,
  type ProgressRow,
  timestampKey,
  validateProgressRow,
} from "../../core/progress";
import { type ActiveExamDraft, db } from "./db";
import { isOwnerRetired } from "./retirement";

const SHA256 = /^[a-f\d]{64}$/i;
const FINAL_STATUSES = new Set(["submitted", "timed_out", "skipped"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type ExamAttemptInput = Omit<
  ExamAttemptRecord,
  | "id"
  | "completedAt"
  | "status"
  | "attemptNumber"
  | "startedAt"
  | "updatedAt"
  | "sections"
> & {
  id?: string;
  status?: ExamAttemptRecord["status"];
  attemptNumber?: number;
  startedAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
  sections: Array<
    Omit<ExamSectionAttemptSummary, "submittedAt"> & {
      submittedAt?: string | null;
    }
  >;
};

export function toExamProgressRow(
  record: ExamAttemptRecord,
): Extract<ProgressRow, { kind: "exam_attempts" }> {
  return {
    kind: "exam_attempts",
    id: record.id,
    owner: record.owner,
    level: record.level,
    examId: record.examId,
    status: record.status,
    attemptNumber: record.attemptNumber,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    totalScore: record.totalScore,
    totalQuestions: record.totalQuestions,
    sections: record.sections,
    answers: record.answers,
    updatedAt: record.updatedAt,
  };
}

export function fromExamProgressRow(
  row: Extract<ProgressRow, { kind: "exam_attempts" }>,
): ExamAttemptRecord {
  return {
    id: row.id,
    owner: row.owner,
    level: row.level,
    examId: row.examId,
    status: row.status,
    attemptNumber: row.attemptNumber,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
    totalScore: row.totalScore,
    totalQuestions: row.totalQuestions,
    sections: row.sections,
    answers: row.answers,
  };
}

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

function validateAnswersMap(answers: unknown): void {
  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    throw new Error("Invalid exam answers");
  }
  for (const [questionId, choice] of Object.entries(answers)) {
    if (
      !questionId ||
      questionId.length > 128 ||
      FORBIDDEN_KEYS.has(questionId) ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > 3
    ) {
      throw new Error(`Invalid answer for ${questionId}`);
    }
  }
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
  if (record.status !== "in_progress" && record.status !== "completed") {
    throw new Error("Invalid exam attempt status");
  }
  if (
    !Number.isInteger(record.attemptNumber) ||
    record.attemptNumber < 1 ||
    record.attemptNumber > 10_000
  ) {
    throw new Error("Invalid exam attempt number");
  }
  timestampKey(record.startedAt);
  timestampKey(record.updatedAt);
  if (record.status === "completed") {
    if (typeof record.completedAt !== "string") {
      throw new Error("Completed exam attempt requires completedAt");
    }
    timestampKey(record.completedAt);
  } else if (record.completedAt !== null) {
    throw new Error("In-progress exam attempt must have null completedAt");
  }
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
    const isPending = section?.status === "pending";
    const validStatus =
      record.status === "completed"
        ? FINAL_STATUSES.has(section?.status)
        : isPending || FINAL_STATUSES.has(section?.status);
    if (
      !section ||
      section.key !== EXAM_SECTION_KEYS[i] ||
      !validStatus ||
      !isNonNegInt(section.score) ||
      !isNonNegInt(section.total) ||
      !isNonNegInt(section.elapsedSeconds) ||
      section.score > section.total
    ) {
      throw new Error(`Invalid exam section summary: ${EXAM_SECTION_KEYS[i]}`);
    }
    if (isPending) {
      if (section.score !== 0 || section.submittedAt !== null) {
        throw new Error(
          `Pending exam section must have score=0 and submittedAt=null: ${section.key}`,
        );
      }
    } else if (section.submittedAt !== null) {
      timestampKey(section.submittedAt);
    } else if (record.status === "completed") {
      throw new Error(`Completed section requires submittedAt: ${section.key}`);
    }
    scoreSum += section.score;
    totalSum += section.total;
  }
  if (scoreSum !== record.totalScore || totalSum !== record.totalQuestions) {
    throw new Error("Exam attempt totals do not match section summaries");
  }
  validateAnswersMap(record.answers);
}

function validateTimingRecord(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid exam draft ${label}`);
  }
  for (const [key, ts] of Object.entries(value)) {
    if (
      !EXAM_SECTION_KEYS.includes(key as (typeof EXAM_SECTION_KEYS)[number]) ||
      (ts !== undefined && (typeof ts !== "number" || !Number.isFinite(ts)))
    ) {
      throw new Error(`Invalid exam draft ${label} entry: ${key}`);
    }
  }
}

function validateDraft(draft: ActiveExamDraft): void {
  if (typeof draft.owner !== "string" || !draft.owner) {
    throw new Error("Invalid exam draft owner");
  }
  if (!LEVELS.includes(draft.level)) {
    throw new Error("Invalid exam draft level");
  }
  if (
    typeof draft.examId !== "string" ||
    draft.examId.length < 1 ||
    draft.examId.length > 128
  ) {
    throw new Error("Invalid exam draft examId");
  }
  if (
    typeof draft.attemptId !== "string" ||
    draft.attemptId.length < 1 ||
    draft.attemptId.length > 128
  ) {
    throw new Error("Invalid exam draft attemptId");
  }
  if (
    !isNonNegInt(draft.activeIndex) ||
    draft.activeIndex >= EXAM_SECTION_KEYS.length
  ) {
    throw new Error("Invalid exam draft activeIndex");
  }
  if (typeof draft.listeningScriptMode !== "boolean") {
    throw new Error("Invalid exam draft listeningScriptMode");
  }
  timestampKey(draft.savedAt);
  validateAnswersMap(draft.answers);
  validateTimingRecord(draft.startedAtMs, "startedAtMs");
  validateTimingRecord(draft.deadlineMs, "deadlineMs");
}

function indexKey(level: Level): string {
  return `examIndex:${level}`;
}

export const examStore = {
  async saveAttemptProgress(
    record: ExamAttemptRecord,
  ): Promise<ExamAttemptRecord> {
    validateAttemptRecord(record);
    return db.transaction(
      "rw",
      [db.examAttempts, db.activeExamDrafts, db.progressOutbox, db.settings],
      async () => {
        if (await isOwnerRetired(record.owner)) {
          throw new Error("Owner is retired");
        }
        const existing = await db.examAttempts.get(record.id);
        const merged = existing ? mergeExamAttempts(existing, record) : record;
        await db.examAttempts.put(merged);
        if (merged.owner !== GUEST_OWNER && existing?.status !== "completed") {
          const progressRow = toExamProgressRow(merged);
          validateProgressRow(progressRow);
          await db.progressOutbox.add({
            opId: newAttemptId(),
            owner: merged.owner,
            row: progressRow,
          });
        }
        if (merged.status === "completed") {
          await db.activeExamDrafts.delete([
            merged.owner,
            merged.level,
            merged.examId,
          ]);
        }
        return merged;
      },
    );
  },

  async recordAttempt(input: ExamAttemptInput): Promise<ExamAttemptRecord> {
    const now =
      input.updatedAt ?? input.completedAt ?? new Date().toISOString();
    const status = input.status ?? "completed";
    const attemptNumber =
      input.attemptNumber ??
      (await examStore.nextAttemptNumber(
        input.owner,
        input.level,
        input.examId,
      ));
    const record: ExamAttemptRecord = {
      ...input,
      id: input.id ?? newAttemptId(),
      status,
      attemptNumber,
      startedAt: input.startedAt ?? now,
      completedAt:
        input.completedAt !== undefined
          ? input.completedAt
          : status === "completed"
            ? now
            : null,
      updatedAt: now,
      sections: input.sections.map((section) => ({
        ...section,
        submittedAt:
          section.submittedAt !== undefined
            ? section.submittedAt
            : section.status === "pending"
              ? null
              : now,
      })),
    };
    return examStore.saveAttemptProgress(record);
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
    rows.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "in_progress" ? -1 : 1;
      }
      return (
        timestampKey(right.completedAt ?? right.updatedAt).localeCompare(
          timestampKey(left.completedAt ?? left.updatedAt),
        ) ||
        right.attemptNumber - left.attemptNumber ||
        right.id.localeCompare(left.id)
      );
    });
    return rows;
  },

  async getActiveAttempt(
    owner: string,
    level: Level,
    examId: string,
  ): Promise<ExamAttemptRecord | null> {
    const rows = await db.examAttempts
      .where("[owner+level+examId+status]")
      .equals([owner, level, examId, "in_progress"])
      .toArray();
    if (rows.length === 0) return null;
    rows.sort(
      (left, right) =>
        timestampKey(right.updatedAt).localeCompare(
          timestampKey(left.updatedAt),
        ) ||
        right.attemptNumber - left.attemptNumber ||
        right.id.localeCompare(left.id),
    );
    return rows[0];
  },

  async nextAttemptNumber(
    owner: string,
    level: Level,
    examId: string,
  ): Promise<number> {
    const rows = await db.examAttempts
      .where("[owner+level+examId]")
      .equals([owner, level, examId])
      .toArray();
    let max = 0;
    for (const row of rows) {
      if (row.attemptNumber > max) max = row.attemptNumber;
    }
    return max + 1;
  },

  async saveDraft(draft: ActiveExamDraft): Promise<void> {
    validateDraft(draft);
    await db.transaction("rw", db.activeExamDrafts, db.settings, async () => {
      if (await isOwnerRetired(draft.owner)) {
        throw new Error("Owner is retired");
      }
      await db.activeExamDrafts.put(draft);
    });
  },

  async loadDraft(
    owner: string,
    level: Level,
    examId: string,
  ): Promise<ActiveExamDraft | null> {
    const row = await db.activeExamDrafts.get([owner, level, examId]);
    return row ?? null;
  },

  async clearDraft(owner: string, level: Level, examId: string): Promise<void> {
    await db.activeExamDrafts.delete([owner, level, examId]);
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

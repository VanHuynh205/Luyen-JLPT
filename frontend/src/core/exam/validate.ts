import { LEVELS, type Level } from "../content/types";
import { isVersion } from "../content/validate";
import type { Result } from "../result";
import {
  EXAM_SECTION_KEYS,
  type ExamAnswerSource,
  type ExamAnswerSummary,
  type ExamDocument,
  type ExamIndex,
} from "./types";

const SHA256 = /^[a-f\d]{64}$/i;
const ANSWER_SOURCES: readonly ExamAnswerSource[] = ["official_key", "solved"];
const ANSWER_SUMMARIES: readonly ExamAnswerSummary[] = [
  "official_key",
  "solved",
  "mixed",
];

export type ExamDocumentError = {
  code: "schema" | "duplicate-id";
  detail: string;
};

export type ExamIndexError = {
  code: "schema";
  detail: string;
};

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Row {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isId(value: unknown, safePath = false): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    return false;
  }
  if (value.includes("\0")) return false;
  if (safePath && (/[\\/]/.test(value) || value === "." || value === "..")) {
    return false;
  }
  return true;
}

function isLevel(value: unknown): value is Level {
  return LEVELS.some((item) => item === value);
}

function isYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1984 &&
    value <= 2100
  );
}

function isMonth(value: unknown): value is 7 | 12 {
  return value === 7 || value === 12;
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isChoices(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    (value.length === 3 || value.length === 4) &&
    value.every((choice) => isNonEmptyString(choice))
  );
}

function failDoc(
  code: ExamDocumentError["code"],
  detail: string,
): Result<never, ExamDocumentError> {
  return { ok: false, error: { code, detail } };
}

function failIndex(detail: string): Result<never, ExamIndexError> {
  return { ok: false, error: { code: "schema", detail } };
}

export function validateExamDocument(
  raw: unknown,
): Result<ExamDocument, ExamDocumentError> {
  if (!isRecord(raw)) return failDoc("schema", "exam");
  if (!isId(raw.id, true)) return failDoc("schema", "id");
  if (!isLevel(raw.level)) return failDoc("schema", "level");
  if (!isYear(raw.year)) return failDoc("schema", "year");
  if (!isMonth(raw.month)) return failDoc("schema", "month");
  if (!isNonEmptyString(raw.code)) return failDoc("schema", "code");
  if (!isNonEmptyString(raw.title)) return failDoc("schema", "title");
  if (!ANSWER_SUMMARIES.some((item) => item === raw.answerSourceSummary)) {
    return failDoc("schema", "answerSourceSummary");
  }
  if (typeof raw.hasListeningScript !== "boolean") {
    return failDoc("schema", "hasListeningScript");
  }
  if (typeof raw.hasSourceAudio !== "boolean") {
    return failDoc("schema", "hasSourceAudio");
  }
  if (
    !Array.isArray(raw.sections) ||
    raw.sections.length !== EXAM_SECTION_KEYS.length
  ) {
    return failDoc("schema", "sections");
  }

  const questionIds = new Set<string>();
  for (let sIndex = 0; sIndex < EXAM_SECTION_KEYS.length; sIndex++) {
    const expectedKey = EXAM_SECTION_KEYS[sIndex];
    const section: unknown = raw.sections[sIndex];
    const sPath = `sections[${sIndex}]`;
    if (!isRecord(section)) return failDoc("schema", sPath);
    if (section.key !== expectedKey) return failDoc("schema", `${sPath}.key`);
    if (!isNonEmptyString(section.title)) {
      return failDoc("schema", `${sPath}.title`);
    }
    if (!isNonEmptyString(section.titleJa)) {
      return failDoc("schema", `${sPath}.titleJa`);
    }
    if (!isNonNegInt(section.durationSeconds)) {
      return failDoc("schema", `${sPath}.durationSeconds`);
    }
    if (typeof section.audioAvailable !== "boolean") {
      return failDoc("schema", `${sPath}.audioAvailable`);
    }
    if (!isOptionalString(section.audioNote)) {
      return failDoc("schema", `${sPath}.audioNote`);
    }
    if (!Array.isArray(section.groups)) {
      return failDoc("schema", `${sPath}.groups`);
    }

    for (let gIndex = 0; gIndex < section.groups.length; gIndex++) {
      const group: unknown = section.groups[gIndex];
      const gPath = `${sPath}.groups[${gIndex}]`;
      if (!isRecord(group)) return failDoc("schema", gPath);
      if (!isId(group.id)) return failDoc("schema", `${gPath}.id`);
      if (!isNonEmptyString(group.label)) {
        return failDoc("schema", `${gPath}.label`);
      }
      if (!isNonEmptyString(group.instructionJa)) {
        return failDoc("schema", `${gPath}.instructionJa`);
      }
      if (!isNonEmptyString(group.instructionVi)) {
        return failDoc("schema", `${gPath}.instructionVi`);
      }
      if (
        !isOptionalString(group.passage) ||
        !isOptionalString(group.passageRuby) ||
        !isOptionalString(group.passageTranslation)
      ) {
        return failDoc("schema", `${gPath}.passage`);
      }
      if (!Array.isArray(group.questions)) {
        return failDoc("schema", `${gPath}.questions`);
      }

      for (let qIndex = 0; qIndex < group.questions.length; qIndex++) {
        const q: unknown = group.questions[qIndex];
        const qPath = `${gPath}.questions[${qIndex}]`;
        if (!isRecord(q)) return failDoc("schema", qPath);
        if (!isId(q.id)) return failDoc("schema", `${qPath}.id`);
        if (questionIds.has(q.id)) {
          return failDoc("duplicate-id", `${qPath}.id`);
        }
        questionIds.add(q.id);
        if (
          typeof q.number !== "number" ||
          !Number.isSafeInteger(q.number) ||
          q.number < 1
        ) {
          return failDoc("schema", `${qPath}.number`);
        }
        if (!isNonEmptyString(q.prompt)) {
          return failDoc("schema", `${qPath}.prompt`);
        }
        if (!isNonEmptyString(q.promptRuby)) {
          return failDoc("schema", `${qPath}.promptRuby`);
        }
        if (!isChoices(q.choices)) {
          return failDoc("schema", `${qPath}.choices`);
        }
        if (
          q.choicesRuby !== undefined &&
          (!isChoices(q.choicesRuby) ||
            q.choicesRuby.length !== q.choices.length)
        ) {
          return failDoc("schema", `${qPath}.choicesRuby`);
        }
        if (
          typeof q.answerIndex !== "number" ||
          !Number.isSafeInteger(q.answerIndex) ||
          q.answerIndex < 0 ||
          q.answerIndex >= q.choices.length
        ) {
          return failDoc("schema", `${qPath}.answerIndex`);
        }
        if (!ANSWER_SOURCES.some((item) => item === q.answerSource)) {
          return failDoc("schema", `${qPath}.answerSource`);
        }
        if (!isNonEmptyString(q.translation)) {
          return failDoc("schema", `${qPath}.translation`);
        }
        if (!isNonEmptyString(q.explanation)) {
          return failDoc("schema", `${qPath}.explanation`);
        }
        if (
          !isOptionalString(q.script) ||
          !isOptionalString(q.scriptRuby) ||
          !isOptionalString(q.scriptTranslation) ||
          !isOptionalString(q.imageHint)
        ) {
          return failDoc("schema", `${qPath}.optional`);
        }
      }
    }
  }

  return { ok: true, value: raw as unknown as ExamDocument };
}

export function validateExamIndex(
  raw: unknown,
): Result<ExamIndex, ExamIndexError> {
  if (!isRecord(raw)) return failIndex("index");
  if (!isLevel(raw.level)) return failIndex("level");
  if (!isVersion(raw.version)) return failIndex("version");
  if (!Array.isArray(raw.exams)) return failIndex("exams");

  const seen = new Set<string>();
  for (let i = 0; i < raw.exams.length; i++) {
    const entry: unknown = raw.exams[i];
    const path = `exams[${i}]`;
    if (!isRecord(entry)) return failIndex(path);
    if (!isId(entry.id, true) || seen.has(entry.id)) {
      return failIndex(`${path}.id`);
    }
    seen.add(entry.id);
    if (entry.level !== raw.level) return failIndex(`${path}.level`);
    if (!isYear(entry.year)) return failIndex(`${path}.year`);
    if (!isMonth(entry.month)) return failIndex(`${path}.month`);
    if (!isNonEmptyString(entry.code)) return failIndex(`${path}.code`);
    if (!isNonEmptyString(entry.title)) return failIndex(`${path}.title`);
    if (!ANSWER_SUMMARIES.some((item) => item === entry.answerSourceSummary)) {
      return failIndex(`${path}.answerSourceSummary`);
    }
    if (typeof entry.hasListeningScript !== "boolean") {
      return failIndex(`${path}.hasListeningScript`);
    }
    if (typeof entry.hasSourceAudio !== "boolean") {
      return failIndex(`${path}.hasSourceAudio`);
    }
    if (!isRecord(entry.questionCounts)) {
      return failIndex(`${path}.questionCounts`);
    }
    let sum = 0;
    for (const key of EXAM_SECTION_KEYS) {
      const count = entry.questionCounts[key];
      if (!isNonNegInt(count)) {
        return failIndex(`${path}.questionCounts.${key}`);
      }
      sum += count;
    }
    if (!isNonNegInt(entry.totalQuestions) || entry.totalQuestions !== sum) {
      return failIndex(`${path}.totalQuestions`);
    }
    if (!isNonNegInt(entry.totalDurationSeconds)) {
      return failIndex(`${path}.totalDurationSeconds`);
    }
    if (typeof entry.sha256 !== "string" || !SHA256.test(entry.sha256)) {
      return failIndex(`${path}.sha256`);
    }
  }

  return { ok: true, value: raw as unknown as ExamIndex };
}

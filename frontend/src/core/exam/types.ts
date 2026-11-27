import type { Level } from "../content/types";

export const EXAM_SECTION_KEYS = [
  "vocab",
  "grammar_reading",
  "listening",
] as const;

export type ExamSectionKey = (typeof EXAM_SECTION_KEYS)[number];
export type ExamAnswerSource = "official_key" | "solved";
export type ExamAnswerSummary = "official_key" | "solved" | "mixed";

export interface ExamQuestion {
  id: string;
  number: number;
  prompt: string;
  promptRuby: string;
  choices: string[];
  choicesRuby?: string[];
  answerIndex: 0 | 1 | 2 | 3;
  answerSource: ExamAnswerSource;
  translation: string;
  explanation: string;
  script?: string;
  scriptRuby?: string;
  scriptTranslation?: string;
  imageHint?: string;
}

export interface ExamQuestionGroup {
  id: string;
  label: string;
  instructionJa: string;
  instructionVi: string;
  passage?: string;
  passageRuby?: string;
  passageTranslation?: string;
  questions: ExamQuestion[];
}

export interface ExamSection {
  key: ExamSectionKey;
  title: string;
  titleJa: string;
  durationSeconds: number;
  audioAvailable: boolean;
  audioNote?: string;
  groups: ExamQuestionGroup[];
}

export interface ExamDocument {
  id: string;
  level: Level;
  year: number;
  month: 7 | 12;
  code: string;
  title: string;
  answerSourceSummary: ExamAnswerSummary;
  hasListeningScript: boolean;
  hasSourceAudio: boolean;
  sections: ExamSection[];
}

export interface ExamIndexEntry {
  id: string;
  level: Level;
  year: number;
  month: 7 | 12;
  code: string;
  title: string;
  answerSourceSummary: ExamAnswerSummary;
  hasListeningScript: boolean;
  hasSourceAudio: boolean;
  questionCounts: Record<ExamSectionKey, number>;
  totalQuestions: number;
  totalDurationSeconds: number;
  sha256: string;
}

export interface ExamIndex {
  level: Level;
  version: string;
  exams: ExamIndexEntry[];
}

export type ExamSectionStatus =
  | "locked"
  | "ready"
  | "in_progress"
  | "submitted"
  | "timed_out"
  | "skipped";

export type ExamSectionAttemptStatus =
  | "pending"
  | "submitted"
  | "timed_out"
  | "skipped";

export type ExamAttemptStatus = "in_progress" | "completed";

export interface ExamSectionAttemptSummary {
  key: ExamSectionKey;
  status: ExamSectionAttemptStatus;
  score: number;
  total: number;
  elapsedSeconds: number;
  submittedAt: string | null;
}

export interface ExamAttemptRecord {
  id: string;
  owner: string;
  level: Level;
  examId: string;
  status: ExamAttemptStatus;
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
  totalScore: number;
  totalQuestions: number;
  sections: ExamSectionAttemptSummary[];
  answers: Record<string, number>;
}

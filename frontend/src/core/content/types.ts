export type Level = "n5" | "n4" | "n3" | "n2" | "n1";

export const LEVELS: readonly Level[] = ["n5", "n4", "n3", "n2", "n1"];

export const PACK_TABLES = [
  "vocabulary",
  "kanji",
  "compounds",
  "grammar",
  "comparisons",
  "conjugations",
  "keigo",
  "verbPairs",
  "reading",
] as const;

export type PackTable = (typeof PACK_TABLES)[number];

export interface PackManifest {
  level: Level;
  version: string;
  counts: Record<PackTable, number>;
  sha256: Record<PackTable, string>;
}

export type VocabSection = "từ chính" | "hội thoại" | "đọc" | "ghi tay";

export interface VocabWord {
  id: string;
  word: string;
  reading: string;
  hanViet?: string;
  meaning: string;
  lesson: number;
  section: VocabSection;
  context?: string;
  note?: string;
  wordType?: string;
}

export interface KanjiEntry {
  id: string;
  kanji: string;
  hanViet: string;
  onyomi: string[];
  kunyomi: string[];
  meaning: string;
  lessons: string[];
}

export interface CompoundComponent {
  kanji: string;
  hanViet: string;
  meaning: string;
}

export interface CompoundEntry {
  id: string;
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
  components: CompoundComponent[];
  /** Id của các kanji đơn mà từ ghép này thuộc về. */
  kanjiIds: string[];
  lessons: string[];
}

export interface GrammarExample {
  japanese: string;
  /** Chuỗi `{base|reading}` đã qua kiểm duyệt (không tự suy diễn lúc runtime). */
  reading?: string;
  meaning: string;
}

export interface GrammarQuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

/** Cách chia của mẫu câu theo từng loại từ (chỉ có khi dataset ghi). */
export interface GrammarConnections {
  /** Động từ */
  v?: string;
  /** Tính từ い */
  aI?: string;
  /** Tính từ な */
  aNa?: string;
  /** Danh từ */
  n?: string;
}

export interface GrammarPattern {
  id: string;
  lesson: number;
  pattern: string;
  connections: GrammarConnections;
  meaning: string;
  usage: string;
  examples: GrammarExample[];
  quiz?: GrammarQuizQuestion[];
}

export interface ReadingVocab {
  word: string;
  reading: string;
  meaning: string;
}

export interface ReadingQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  length: "short" | "medium";
  text: string;
  /** Chuỗi `{base|reading}` đã qua kiểm duyệt (không tự suy diễn lúc runtime). */
  textRuby?: string;
  translation: string;
  vocabulary: ReadingVocab[];
  questions: ReadingQuestion[];
}

export interface GrammarComparison {
  id: string;
  group: string;
  patterns: string;
  distinction: string;
  whenToUse: string;
  exampleJa: string;
  exampleVi: string;
}

export interface ConjugationRule {
  id: string;
  name: string;
  labelJa: string;
  recognition: string;
  group1: string;
  group2: string;
  group3: string;
  examplesG1: string;
  examplesG2: string;
  examplesG3: string;
  adjI: string;
  adjNa: string;
  noun: string;
  exceptions: string;
}

export interface KeigoEntry {
  id: string;
  plainJa: string;
  plainKana: string;
  sonkeigo: string;
  sonkeigoMasu: string;
  kenjogoI: string;
  kenjogoII: string;
  teineigo: string;
  recognition: string;
  exampleJa: string;
  exampleVi: string;
}

export interface VerbPair {
  id: string;
  transitiveJa: string;
  transitiveKana: string;
  intransitiveJa: string;
  intransitiveKana: string;
  meaning: string;
}

export interface ContentPack {
  manifest: PackManifest;
  vocabulary: VocabWord[];
  kanji: KanjiEntry[];
  compounds: CompoundEntry[];
  grammar: GrammarPattern[];
  comparisons: GrammarComparison[];
  conjugations: ConjugationRule[];
  keigo: KeigoEntry[];
  verbPairs: VerbPair[];
  reading: ReadingPassage[];
}

export type PackError = {
  code: "schema" | "count-mismatch" | "duplicate-id";
  detail: string;
};

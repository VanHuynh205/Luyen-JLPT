export enum KanjiQuizMode {
  mixed = "mixed",
  compound = "compound",
  single = "single",
}

export type FlashcardStatus = { cardId: string; known: boolean };

export type KanjiQuizResult = {
  id: string | bigint;
  mode: KanjiQuizMode;
  score: bigint;
  total: bigint;
  wrongItemIds: string[];
  takenAt: bigint;
};

export type ReadingResult = {
  passageId: string;
  attempts: bigint;
  lastScore: bigint;
  bestScore: bigint;
  total: bigint;
  lastAttemptAt: bigint;
};

export type ProgressSummary = {
  knownFlashcardCount: bigint;
  flashcards: FlashcardStatus[];
  recentKanjiResults: KanjiQuizResult[];
  learnedGrammarIds: string[];
  readingResults: ReadingResult[];
};

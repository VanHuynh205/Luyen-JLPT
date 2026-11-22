import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import { KanjiQuizMode, type ProgressSummary } from "@/core/progress/types";
import { describe, expect, it } from "vitest";
import {
  computeSectionStats,
  countKnownVocabulary,
  currentKanjiResults,
  currentReadingResults,
  getStudySections,
} from "./sections";

const empty: ProgressSummary = {
  flashcards: [],
  knownFlashcardCount: 0n,
  learnedGrammarIds: [],
  recentKanjiResults: [],
  readingResults: [],
};

describe("progress for the selected pack", () => {
  it("counts only distinct known vocabulary and grammar IDs in the pack", () => {
    const summary = {
      ...empty,
      knownFlashcardCount: 999n,
      flashcards: [
        { cardId: "vocab-1", known: true },
        { cardId: "vocab-1", known: true },
        { cardId: "stale", known: true },
      ],
      learnedGrammarIds: ["grammar-1", "grammar-1", "stale"],
    };
    expect(countKnownVocabulary(summary, miniPack)).toBe(1);
    expect(computeSectionStats(summary, miniPack).vocab).toMatchObject({
      value: "1 / 1 từ",
      ratio: 1,
    });
    expect(computeSectionStats(summary, miniPack).grammar.ratio).toBe(1);
  });

  it("keeps kanji results when known wrong items identify the active pack", () => {
    const result = {
      id: 1n,
      total: 1n,
      score: 0n,
      mode: KanjiQuizMode.single,
      takenAt: 1n,
      wrongItemIds: ["kanji-1"],
    };
    const summary = {
      ...empty,
      recentKanjiResults: [
        result,
        { ...result, id: 2n, wrongItemIds: ["stale"] },
        { ...result, id: 3n, score: 1n, wrongItemIds: [] },
        { ...result, id: 4n, total: 2n, wrongItemIds: ["kanji-1", "kanji-1"] },
        { ...result, id: 5n, mode: KanjiQuizMode.compound },
        { ...result, id: 6n, total: 0n, wrongItemIds: [] },
        { ...result, id: 7n, takenAt: 2n, total: 2n, score: 1n },
        {
          ...result,
          id: 8n,
          total: 3n,
          score: 1n,
          wrongItemIds: ["kanji-1", "stale"],
        },
      ],
    };
    expect(currentKanjiResults(summary, miniPack).map((r) => r.id)).toEqual([
      1n,
      3n,
      7n,
    ]);
    expect(computeSectionStats(summary, miniPack).kanji.value).toBe(
      "1 / 2 câu đúng",
    );
  });

  const perfect = {
    id: 1n,
    total: 10n,
    score: 10n,
    mode: KanjiQuizMode.single,
    takenAt: 1n,
    wrongItemIds: [],
  };

  it("counts a perfect quiz for the N4 pack", () => {
    const summary = { ...empty, recentKanjiResults: [perfect] };
    expect(currentKanjiResults(summary, miniPack)).toEqual([perfect]);
    expect(computeSectionStats(summary, miniPack).kanji.value).toBe(
      "10 / 10 câu đúng",
    );
  });

  it("counts a perfect quiz in the selected non-N4 level", () => {
    const n3 = {
      ...miniPack,
      manifest: { ...miniPack.manifest, level: "n3" as const },
    };
    const summary = { ...empty, recentKanjiResults: [perfect] };
    expect(currentKanjiResults(summary, n3)).toEqual([perfect]);
  });

  it("ignores an empty wrong list when the score is not perfect", () => {
    const summary = {
      ...empty,
      recentKanjiResults: [{ ...perfect, score: 9n }],
    };
    expect(currentKanjiResults(summary, miniPack)).toEqual([]);
  });

  it("filters and deduplicates reading results by current passage", () => {
    const result = {
      passageId: miniPack.reading[0].id,
      bestScore: 1n,
      total: 1n,
      attempts: 1n,
      lastAttemptAt: 1n,
      lastScore: 1n,
    };
    const summary = {
      ...empty,
      readingResults: [
        { ...result, total: 0n, bestScore: 0n },
        result,
        result,
        { ...result, passageId: "stale" },
      ],
    };
    expect(currentReadingResults(summary, miniPack)).toEqual([result]);
    expect(computeSectionStats(summary, miniPack).reading.ratio).toBe(1);
  });

  it("uses the selected level and counts for section descriptions", () => {
    const pack = {
      ...miniPack,
      manifest: { ...miniPack.manifest, level: "n3" as const },
      vocabulary: [],
    };
    expect(getStudySections(pack)[0].description).toContain("0 từ vựng N3");
    expect(computeSectionStats(empty, pack).vocab.ratio).toBe(0);
  });

  it("recomputes progress when the selected pack changes", () => {
    const summary = {
      ...empty,
      flashcards: [{ cardId: "vocab-1", known: true }],
      learnedGrammarIds: ["grammar-1"],
      readingResults: [
        {
          passageId: miniPack.reading[0].id,
          bestScore: 1n,
          total: 1n,
          attempts: 1n,
          lastAttemptAt: 1n,
          lastScore: 1n,
        },
      ],
    };
    const other = { ...miniPack, vocabulary: [], grammar: [], reading: [] };
    const stats = computeSectionStats(summary, other);
    expect(stats.vocab.value).toBe("0 / 0 từ");
    expect(stats.grammar.value).toBe("0 / 0 mẫu");
    expect(stats.reading.value).toBe("0 / 0 bài");
  });
});

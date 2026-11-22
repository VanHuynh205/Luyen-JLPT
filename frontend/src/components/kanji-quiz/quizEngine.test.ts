import { readFileSync } from "node:fs";
import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import type { CompoundEntry, KanjiEntry } from "@/core/content/types";
import { KanjiQuizMode } from "@/core/progress/types";
import { describe, expect, it, vi } from "vitest";
import {
  clampQuestionCount,
  generateQuiz,
  questionCountRange,
  quizPoolSize,
} from "./quizEngine";

const characters = [..."見学本日月火水木金土山川"];
const readings = [..."あいうえおかきくけこさし"];
const kanjiList = characters.map((kanji, i) => ({
  ...miniPack.kanji[0],
  id: `fixture-kanji-${i}`,
  kanji,
  onyomi: [readings[i]],
  kunyomi: [],
  meaning: `nghĩa ${i}`,
}));
const compoundList = characters.map((kanji, i) => ({
  ...miniPack.compounds[0],
  id: `fixture-compound-${i}`,
  word: `${kanji}学`,
  reading: `${readings[i]}く`,
  meaning: `từ ghép ${i}`,
}));
const pack = { kanji: kanjiList, compounds: compoundList };

it("returns no questions when a pack cannot supply four distinct choices", () => {
  expect(generateQuiz(KanjiQuizMode.mixed, miniPack)).toEqual([]);
});

it.each([KanjiQuizMode.single, KanjiQuizMode.compound, KanjiQuizMode.mixed])(
  "generateQuiz(%s) creates valid questions with answers from the source",
  (mode) => {
    let seed = 123456789;
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });

    try {
      const kinds = new Set<string>();
      const types = new Set<string>();

      for (let run = 0; run < 50; run++) {
        const questions = generateQuiz(mode, pack);
        expect(questions).toHaveLength(10);

        for (const question of questions) {
          kinds.add(question.item.kind);
          types.add(question.type);
          if (mode === KanjiQuizMode.single) {
            expect(question.item.kind).toBe("kanji");
          } else if (mode === KanjiQuizMode.compound) {
            expect(question.item.kind).toBe("compound");
          }

          expect(question.choices).toHaveLength(4);
          expect(new Set(question.choices).size).toBe(4);
          expect(Number.isInteger(question.correctIndex)).toBe(true);
          expect(question.correctIndex).toBeGreaterThanOrEqual(0);
          expect(question.correctIndex).toBeLessThan(4);
          expect(question.choicesAreJapanese).toBe(question.type !== "meaning");
          if (question.choicesAreJapanese) {
            for (const choice of question.choices) {
              expect(choice).not.toMatch(/[.－-]/);
            }
          }

          const answer = question.choices[question.correctIndex];
          const entries =
            question.item.kind === "kanji" ? kanjiList : compoundList;
          const available = entries.flatMap((entry) =>
            question.type === "meaning"
              ? [entry.meaning]
              : "kanji" in entry
                ? question.type === "reading"
                  ? [...entry.onyomi, ...entry.kunyomi]
                  : [entry.kanji]
                : question.type === "reading"
                  ? [entry.reading]
                  : [entry.word],
          );
          expect(
            question.choices.every((choice) => available.includes(choice)),
          ).toBe(true);
          if (question.item.kind === "kanji") {
            const source = kanjiList.find(
              (entry) => entry.id === question.item.id,
            );
            if (!source) throw new Error("Kanji source not found");
            const readings = [...source.onyomi, ...source.kunyomi];
            if (question.type === "reading") {
              expect(question.subject).toBe(source.kanji);
              expect(
                question.choices.filter((choice) => readings.includes(choice)),
              ).toEqual([answer]);
            } else if (question.type === "meaning") {
              expect(question.subject).toBe(source.kanji);
              expect(answer).toBe(source.meaning);
            } else {
              expect(readings).toContain(question.subject);
              expect(answer).toBe(source.kanji);
              const matchingKanji = kanjiList
                .filter((entry) =>
                  [...entry.onyomi, ...entry.kunyomi].includes(
                    question.subject,
                  ),
                )
                .map((entry) => entry.kanji);
              expect(
                question.choices.filter((choice) =>
                  matchingKanji.includes(choice),
                ),
              ).toEqual([answer]);
            }
          } else {
            const source = compoundList.find(
              (entry) => entry.id === question.item.id,
            );
            if (!source) throw new Error("Compound source not found");
            if (question.type === "reading") {
              expect(question.subject).toBe(source.word);
              expect(answer).toBe(source.reading);
            } else if (question.type === "meaning") {
              expect(question.subject).toBe(source.word);
              expect(answer).toBe(source.meaning);
            } else {
              expect(question.subject).toBe(source.reading);
              expect(answer).toBe(source.word);
            }
          }
        }
      }

      expect(types).toEqual(new Set(["reading", "meaning", "writing"]));
      if (mode === KanjiQuizMode.mixed) {
        expect(kinds).toEqual(new Set(["kanji", "compound"]));
      }
    } finally {
      random.mockRestore();
    }
  },
);

const readN4 = <T>(table: string): T[] =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../infra/content/n4/${table}.json`, import.meta.url),
      "utf8",
    ),
  );
const n4 = {
  kanji: readN4<KanjiEntry>("kanji"),
  compounds: readN4<CompoundEntry>("compounds"),
};
const modes = [
  KanjiQuizMode.single,
  KanjiQuizMode.compound,
  KanjiQuizMode.mixed,
] as const;

describe("question count", () => {
  it("sizes each mode's pool from the N4 pack", () => {
    expect(modes.map((mode) => quizPoolSize(mode, n4))).toEqual([
      118, 388, 506,
    ]);
  });

  it("allows 10 up to the whole pool, capped at the backend limit", () => {
    expect(questionCountRange(118)).toEqual({ min: 10, max: 118 });
    expect(questionCountRange(2)).toEqual({ min: 2, max: 2 });
    expect(questionCountRange(2500)).toEqual({ min: 10, max: 1000 });
  });

  it.each([
    [5, 118, 10],
    [9999, 118, 118],
    [Number.NaN, 118, 10],
    [-3, 118, 10],
    [20.6, 118, 21],
    [1, 2, 2],
  ])("clampQuestionCount(%s, %s) is %s", (value, pool, expected) => {
    expect(clampQuestionCount(value, pool)).toBe(expected);
  });

  it("creates the requested number of distinct items", () => {
    const questions = generateQuiz(KanjiQuizMode.single, n4, 30);
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.item.id)).size).toBe(30);
  });

  it.each(modes)("covers the whole N4 %s pool when all is chosen", (mode) => {
    const pool = quizPoolSize(mode, n4);
    const questions = generateQuiz(mode, n4, pool);
    expect(questions.length).toBe(pool);
    expect(new Set(questions.map((q) => q.item.id)).size).toBe(
      questions.length,
    );
    for (const q of questions) expect(new Set(q.choices).size).toBe(4);
  });
});

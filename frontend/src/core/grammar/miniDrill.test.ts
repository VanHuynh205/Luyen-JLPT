import { readFileSync } from "node:fs";
import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import type {
  ConjugationRule,
  KeigoEntry,
  VerbPair,
} from "@/core/content/types";
import { describe, expect, it } from "vitest";
import {
  buildConjugationDrill,
  buildKeigoDrill,
  buildVerbPairDrill,
} from "./miniDrill";

const readN4 = <T>(file: string): T[] =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../infra/content/n4/${file}.json`, import.meta.url),
      "utf8",
    ),
  );

const n4Conjugations = readN4<ConjugationRule>("conjugations");
const n4Keigo = readN4<KeigoEntry>("keigo");
const n4VerbPairs = readN4<VerbPair>("verb-pairs");

function assertValidQuestions(
  questions: ReturnType<typeof buildConjugationDrill>,
  expectedLength: number,
) {
  expect(questions).toHaveLength(expectedLength);
  for (const q of questions) {
    expect(q.question.trim().length).toBeGreaterThan(0);
    expect(q.explanation.trim().length).toBeGreaterThan(0);
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(Number.isInteger(q.answerIndex)).toBe(true);
    expect(q.answerIndex).toBeGreaterThanOrEqual(0);
    expect(q.answerIndex).toBeLessThan(4);
  }
}

describe("grammar mini-drills", () => {
  it("returns empty array when source has fewer than 4 distinct items", () => {
    expect(buildConjugationDrill(miniPack.conjugations)).toEqual([]);
    expect(buildKeigoDrill(miniPack.keigo)).toEqual([]);
    expect(buildVerbPairDrill(miniPack.verbPairs)).toEqual([]);
  });

  it("builds 4-choice distinct questions for conjugations, keigo, and verb pairs from N4 pack", () => {
    for (let run = 0; run < 10; run++) {
      assertValidQuestions(buildConjugationDrill(n4Conjugations, 5), 5);
      assertValidQuestions(buildKeigoDrill(n4Keigo, 5), 5);
      assertValidQuestions(buildVerbPairDrill(n4VerbPairs, 5), 5);
    }
  });

  it("never exceeds the source item count", () => {
    const qs = buildVerbPairDrill(n4VerbPairs, 50);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(n4VerbPairs.length);
    for (const q of qs) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
    }
  });

  it("uses exact transitive/intransitive counterparts for verb pair questions", () => {
    const sample: VerbPair[] = n4VerbPairs.slice(0, 4);
    const qs = buildVerbPairDrill(sample, 4);
    assertValidQuestions(qs, 4);

    const transitiveSet = new Set(sample.map((p) => p.transitiveJa));
    const intransitiveSet = new Set(sample.map((p) => p.intransitiveJa));

    for (const q of qs) {
      const answer = q.choices[q.answerIndex];
      const match = sample.find(
        (p) => p.transitiveJa === answer || p.intransitiveJa === answer,
      );
      expect(match).toBeDefined();
      if (match && answer === match.intransitiveJa) {
        expect(q.question).toContain(match.transitiveJa);
        expect(q.choices.every((c) => intransitiveSet.has(c))).toBe(true);
      } else if (match) {
        expect(q.question).toContain(match.intransitiveJa);
        expect(q.choices.every((c) => transitiveSet.has(c))).toBe(true);
      }
    }
  });

  it("does not put overlapping keigo forms as distractors", () => {
    // Run repeatedly to exercise KG001/KG002 (いらっしゃる) and KG007/KG009 (いただく)
    for (let run = 0; run < 30; run++) {
      const qs = buildKeigoDrill(n4Keigo, 10);
      for (const q of qs) {
        expect(new Set(q.choices).size).toBe(4);
        if (
          q.question.includes("「行く／来る」") &&
          q.question.includes("Tôn kính ngữ")
        ) {
          expect(q.choices).not.toContain("いらっしゃる");
        }
        if (
          q.question.includes("「いる」") &&
          q.question.includes("Tôn kính ngữ")
        ) {
          expect(q.choices).not.toContain("いらっしゃる／おいでになる");
        }
      }
    }
  });
});

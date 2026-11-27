import type {
  ConjugationRule,
  GrammarQuizQuestion,
  KeigoEntry,
  VerbPair,
} from "@/core/content/types";

const DEFAULT_DRILL_COUNT = 5;
const CHOICE_COUNT = 4;

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildFourChoiceQuestion({
  question,
  correct,
  distractorPool,
  explanation,
  conflictsWithCorrect,
}: {
  question: string;
  correct: string;
  distractorPool: readonly string[];
  explanation: string;
  conflictsWithCorrect?: (candidate: string) => boolean;
}): GrammarQuizQuestion | null {
  const normalizedCorrect = correct.trim();
  if (!normalizedCorrect) return null;

  const seen = new Set<string>([normalizedCorrect]);
  const distractors: string[] = [];

  for (const raw of shuffle(distractorPool)) {
    const candidate = raw.trim();
    if (!candidate || seen.has(candidate)) continue;
    if (conflictsWithCorrect?.(candidate)) continue;
    seen.add(candidate);
    distractors.push(candidate);
    if (distractors.length === CHOICE_COUNT - 1) break;
  }

  if (distractors.length < CHOICE_COUNT - 1) return null;

  const choices = shuffle([normalizedCorrect, ...distractors]);
  const answerIndex = choices.indexOf(normalizedCorrect);
  if (new Set(choices).size !== CHOICE_COUNT || answerIndex < 0) return null;

  return {
    question,
    choices,
    answerIndex,
    explanation,
  };
}

function keigoTokens(value: string): string[] {
  return value
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .split(/[／、]/)
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter((token) => token.length > 0);
}

function sharesKeigoAlternative(a: string, b: string): boolean {
  const tokensA = new Set(keigoTokens(a));
  return keigoTokens(b).some((token) => tokensA.has(token));
}

/** Build up to `count` 4-choice mini-drill questions from conjugation rules. */
export function buildConjugationDrill(
  rules: readonly ConjugationRule[],
  count: number = DEFAULT_DRILL_COUNT,
): GrammarQuizQuestion[] {
  if (count <= 0 || rules.length < CHOICE_COUNT) return [];

  const target = Math.min(Math.floor(count), rules.length);
  const questions: GrammarQuizQuestion[] = [];
  const labelOf = (r: ConjugationRule) => `${r.name}（${r.labelJa}）`;

  for (const rule of shuffle(rules)) {
    if (questions.length >= target) break;

    const templates = shuffle([
      () =>
        buildFourChoiceQuestion({
          question: `Ví dụ động từ nhóm I nào thuộc「${labelOf(rule)}」?`,
          correct: rule.examplesG1,
          distractorPool: rules
            .filter((r) => r.id !== rule.id)
            .map((r) => r.examplesG1),
          explanation: `${labelOf(rule)}: Nhóm I ${rule.group1}. ${rule.recognition}`,
        }),
      () =>
        buildFourChoiceQuestion({
          question: `Cách chia「${rule.examplesG1}」thuộc dạng nào?`,
          correct: labelOf(rule),
          distractorPool: rules.filter((r) => r.id !== rule.id).map(labelOf),
          explanation: `${labelOf(rule)}: Nhóm I ${rule.group1}; Nhóm II ${rule.group2} (${rule.examplesG2}).`,
        }),
      () =>
        buildFourChoiceQuestion({
          question: `Ví dụ động từ nhóm III nào ứng với「${labelOf(rule)}」?`,
          correct: rule.examplesG3,
          distractorPool: rules
            .filter((r) => r.id !== rule.id)
            .map((r) => r.examplesG3),
          explanation: `Nhóm III của ${labelOf(rule)}: ${rule.group3}.`,
        }),
    ]);

    for (const build of templates) {
      const q = build();
      if (q) {
        questions.push(q);
        break;
      }
    }
  }

  return questions;
}

const KEIGO_CATEGORIES = [
  { key: "sonkeigo", label: "Tôn kính ngữ" },
  { key: "kenjogoI", label: "Khiêm nhường ngữ I" },
  { key: "kenjogoII", label: "Khiêm nhường ngữ II" },
] as const;

/** Build up to `count` 4-choice mini-drill questions from keigo entries. */
export function buildKeigoDrill(
  entries: readonly KeigoEntry[],
  count: number = DEFAULT_DRILL_COUNT,
): GrammarQuizQuestion[] {
  if (count <= 0 || entries.length < CHOICE_COUNT) return [];

  const target = Math.min(Math.floor(count), entries.length);
  const questions: GrammarQuizQuestion[] = [];

  for (const entry of shuffle(entries)) {
    if (questions.length >= target) break;

    for (const category of shuffle(KEIGO_CATEGORIES)) {
      const correct = entry[category.key].trim();
      if (!correct) continue;

      const others = entries
        .filter((other) => other.id !== entry.id)
        .map((other) => other[category.key].trim())
        .filter(Boolean);

      const q = buildFourChoiceQuestion({
        question: `${category.label} của「${entry.plainJa}」（${entry.plainKana}）là gì?`,
        correct,
        distractorPool: others,
        conflictsWithCorrect: (candidate) =>
          sharesKeigoAlternative(candidate, correct),
        explanation: `${entry.plainJa} (${entry.plainKana}) → ${category.label}: ${correct}. ${entry.recognition}`,
      });

      if (q) {
        questions.push(q);
        break;
      }
    }
  }

  return questions;
}

/** Build up to `count` 4-choice mini-drill questions from transitive/intransitive verb pairs. */
export function buildVerbPairDrill(
  pairs: readonly VerbPair[],
  count: number = DEFAULT_DRILL_COUNT,
): GrammarQuizQuestion[] {
  if (count <= 0 || pairs.length < CHOICE_COUNT) return [];

  const target = Math.min(Math.floor(count), pairs.length);
  const questions: GrammarQuizQuestion[] = [];

  for (const pair of shuffle(pairs)) {
    if (questions.length >= target) break;

    const templates = shuffle([
      () =>
        buildFourChoiceQuestion({
          question: `Tự động từ (～が) tương ứng với「${pair.transitiveJa}」（${pair.meaning}）là gì?`,
          correct: pair.intransitiveJa,
          distractorPool: pairs
            .filter((p) => p.id !== pair.id)
            .map((p) => p.intransitiveJa),
          explanation: `Tha động từ: ${pair.transitiveJa} (${pair.transitiveKana}) · Tự động từ: ${pair.intransitiveJa} (${pair.intransitiveKana}) — ${pair.meaning}.`,
        }),
      () =>
        buildFourChoiceQuestion({
          question: `Tha động từ (～を) tương ứng với「${pair.intransitiveJa}」（${pair.meaning}）là gì?`,
          correct: pair.transitiveJa,
          distractorPool: pairs
            .filter((p) => p.id !== pair.id)
            .map((p) => p.transitiveJa),
          explanation: `Tha động từ: ${pair.transitiveJa} (${pair.transitiveKana}) · Tự động từ: ${pair.intransitiveJa} (${pair.intransitiveKana}) — ${pair.meaning}.`,
        }),
    ]);

    for (const build of templates) {
      const q = build();
      if (q) {
        questions.push(q);
        break;
      }
    }
  }

  return questions;
}

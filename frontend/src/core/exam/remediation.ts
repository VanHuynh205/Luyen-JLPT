import type {
  CompoundEntry,
  ContentPack,
  GrammarPattern,
  KanjiEntry,
  VocabWord,
} from "../content/types";
import { parseRubyText } from "./ruby";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamQuestion,
  ExamSectionKey,
} from "./types";

export interface RemediationItem {
  id: string;
  kind: "vocab" | "kanji" | "compound" | "grammar" | "exam_question";
  label: string;
  reading?: string;
  meaning: string;
  lesson?: number;
  sourceQuestionNumber: number;
  explanation: string;
}

const KANJI_RE = /[\u4e00-\u9faf]/g;
const KANA_ONLY_RE = /^[\u3040-\u309f\u30a0-\u30ffー]+$/;

function stripMarkup(input: string): string {
  return parseRubyText(input)
    .map((segment) => (segment.kind === "ruby" ? segment.base : segment.text))
    .join("")
    .trim();
}

function extractFocusTokens(question: ExamQuestion): string[] {
  const tokens: string[] = [];
  const pushUnique = (value: string | undefined) => {
    const cleaned = value ? stripMarkup(value) : "";
    if (cleaned && !tokens.includes(cleaned)) tokens.push(cleaned);
  };

  for (const match of question.prompt.matchAll(/\[\[([\s\S]+?)\]\]/g)) {
    pushUnique(match[1]);
  }

  pushUnique(question.choices[question.answerIndex]);

  for (const match of question.explanation.matchAll(/「([^」]+)」/g)) {
    pushUnique(match[1]);
  }

  return tokens;
}

function parseLessonNumber(lessons: readonly string[]): number | undefined {
  for (const raw of lessons) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function extractGrammarCores(pattern: string): string[] {
  const cores: string[] = [];
  for (const part of pattern.split(/[／/]/)) {
    const stripped = part
      .replace(/[～〜＋+\s（）()・]/g, "")
      .replace(/^Từ nghi vấn/i, "")
      .replace(/^[VNA](?![a-z])/g, "")
      .replace(/^A[いな]/g, "")
      .trim();
    if (stripped.length >= 2 && !cores.includes(stripped)) {
      cores.push(stripped);
    }
  }
  return cores;
}

interface PackLookup {
  compoundsByWord: Map<string, CompoundEntry>;
  vocabByWord: Map<string, VocabWord>;
  vocabByReading: Map<string, VocabWord>;
  kanjiByChar: Map<string, KanjiEntry>;
  grammarEntries: Array<{ core: string; pattern: GrammarPattern }>;
}

function buildPackLookup(pack: ContentPack): PackLookup {
  const compoundsByWord = new Map<string, CompoundEntry>();
  for (const compound of pack.compounds) {
    if (!compoundsByWord.has(compound.word)) {
      compoundsByWord.set(compound.word, compound);
    }
  }

  const vocabByWord = new Map<string, VocabWord>();
  const vocabByReading = new Map<string, VocabWord>();
  for (const vocab of pack.vocabulary) {
    if (!vocabByWord.has(vocab.word)) vocabByWord.set(vocab.word, vocab);
    if (vocab.reading.length >= 2 && !vocabByReading.has(vocab.reading)) {
      vocabByReading.set(vocab.reading, vocab);
    }
  }

  const kanjiByChar = new Map<string, KanjiEntry>();
  for (const entry of pack.kanji) {
    if (!kanjiByChar.has(entry.kanji)) kanjiByChar.set(entry.kanji, entry);
  }

  const grammarEntries: Array<{ core: string; pattern: GrammarPattern }> = [];
  for (const pattern of pack.grammar) {
    for (const core of extractGrammarCores(pattern.pattern)) {
      grammarEntries.push({ core, pattern });
    }
  }
  grammarEntries.sort((a, b) => b.core.length - a.core.length);

  return {
    compoundsByWord,
    vocabByWord,
    vocabByReading,
    kanjiByChar,
    grammarEntries,
  };
}

function toCompoundItem(
  entry: CompoundEntry,
  question: ExamQuestion,
): RemediationItem {
  return {
    id: entry.id,
    kind: "compound",
    label: entry.word,
    reading: entry.reading,
    meaning: entry.hanViet
      ? `${entry.hanViet} — ${entry.meaning}`
      : entry.meaning,
    lesson: parseLessonNumber(entry.lessons),
    sourceQuestionNumber: question.number,
    explanation: question.explanation,
  };
}

function toVocabItem(
  entry: VocabWord,
  question: ExamQuestion,
): RemediationItem {
  return {
    id: entry.id,
    kind: "vocab",
    label: entry.word,
    reading: entry.reading,
    meaning: entry.meaning,
    lesson: entry.lesson,
    sourceQuestionNumber: question.number,
    explanation: question.explanation,
  };
}

function toKanjiItem(
  entry: KanjiEntry,
  question: ExamQuestion,
): RemediationItem {
  const readings = [...entry.onyomi, ...entry.kunyomi];
  return {
    id: entry.id,
    kind: "kanji",
    label: entry.kanji,
    reading: readings.length > 0 ? readings.join(" · ") : undefined,
    meaning: entry.hanViet
      ? `${entry.hanViet} — ${entry.meaning}`
      : entry.meaning,
    lesson: parseLessonNumber(entry.lessons),
    sourceQuestionNumber: question.number,
    explanation: question.explanation,
  };
}

function toGrammarItem(
  entry: GrammarPattern,
  question: ExamQuestion,
): RemediationItem {
  return {
    id: entry.id,
    kind: "grammar",
    label: entry.pattern,
    meaning: entry.meaning,
    lesson: entry.lesson,
    sourceQuestionNumber: question.number,
    explanation: question.explanation,
  };
}

function collectCandidates(
  sectionKey: ExamSectionKey,
  question: ExamQuestion,
  lookup: PackLookup,
): RemediationItem[] {
  const focusTokens = extractFocusTokens(question);
  const plainPrompt = stripMarkup(question.prompt);
  const correctChoice = question.choices[question.answerIndex] ?? "";
  const combinedHaystack = `${plainPrompt} ${correctChoice} ${question.explanation}`;

  const compoundMatches: RemediationItem[] = [];
  for (const token of focusTokens) {
    const hit = lookup.compoundsByWord.get(token);
    if (hit) compoundMatches.push(toCompoundItem(hit, question));
  }

  const vocabMatches: RemediationItem[] = [];
  const focusKanji = new Set(
    focusTokens.flatMap((token) => token.match(KANJI_RE) ?? []),
  );
  for (const token of focusTokens) {
    const exact = lookup.vocabByWord.get(token);
    if (exact) vocabMatches.push(toVocabItem(exact, question));
  }
  for (const token of focusTokens) {
    if (!KANA_ONLY_RE.test(token) || token.length < 2) continue;
    const byReading = lookup.vocabByReading.get(token);
    if (!byReading) continue;
    const sharesKanji =
      focusKanji.size === 0 ||
      Array.from(focusKanji).some((ch) => byReading.word.includes(ch));
    if (sharesKanji) vocabMatches.push(toVocabItem(byReading, question));
  }

  const kanjiMatches: RemediationItem[] = [];
  const kanjiSearchSources = [...focusTokens, plainPrompt];
  for (const source of kanjiSearchSources) {
    for (const ch of source.match(KANJI_RE) ?? []) {
      const hit = lookup.kanjiByChar.get(ch);
      if (hit) kanjiMatches.push(toKanjiItem(hit, question));
    }
  }

  const grammarMatches: RemediationItem[] = [];
  for (const { core, pattern } of lookup.grammarEntries) {
    if (
      focusTokens.some((token) => token.includes(core)) ||
      combinedHaystack.includes(core)
    ) {
      grammarMatches.push(toGrammarItem(pattern, question));
    }
  }

  const ordered =
    sectionKey === "grammar_reading"
      ? [
          ...grammarMatches,
          ...vocabMatches,
          ...compoundMatches,
          ...kanjiMatches,
        ]
      : sectionKey === "listening"
        ? [
            ...vocabMatches,
            ...grammarMatches,
            ...compoundMatches,
            ...kanjiMatches,
          ]
        : [
            ...compoundMatches,
            ...vocabMatches,
            ...kanjiMatches,
            ...grammarMatches,
          ];

  ordered.push({
    id: `exam-question-${question.id}`,
    kind: "exam_question",
    label: plainPrompt,
    reading: correctChoice || undefined,
    meaning: question.translation,
    sourceQuestionNumber: question.number,
    explanation: question.explanation,
  });

  return ordered;
}

export function buildRemediationSession(
  attempt: ExamAttemptRecord,
  exam: ExamDocument,
  pack: ContentPack,
  maxItems = 15,
): RemediationItem[] {
  if (maxItems <= 0) return [];

  const statusBySection = new Map(
    attempt.sections.map((section) => [section.key, section.status]),
  );
  const lookup = buildPackLookup(pack);
  const seenIds = new Set<string>();
  const results: RemediationItem[] = [];

  for (const section of exam.sections) {
    const status = statusBySection.get(section.key);
    if (status !== "submitted" && status !== "timed_out") continue;

    for (const group of section.groups) {
      for (const question of group.questions) {
        if (attempt.answers[question.id] === question.answerIndex) continue;

        const candidates = collectCandidates(section.key, question, lookup);
        const picked = candidates.find((item) => !seenIds.has(item.id));
        if (!picked) continue;

        seenIds.add(picked.id);
        results.push(picked);
        if (results.length >= maxItems) return results;
      }
    }
  }

  return results;
}

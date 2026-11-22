import type {
  CompoundEntry,
  ContentPack,
  KanjiEntry,
} from "@/core/content/types";
import { KanjiQuizMode } from "@/core/progress/types";

export type QuizItem =
  | { kind: "kanji"; id: string; entry: KanjiEntry }
  | { kind: "compound"; id: string; entry: CompoundEntry };

export type QuestionType = "reading" | "meaning" | "writing";

export interface QuizQuestion {
  key: string;
  item: QuizItem;
  type: QuestionType;
  /** Text shown as the question subject (kanji, word or reading). */
  subject: string;
  subjectIsJapanese: boolean;
  instruction: string;
  choices: string[];
  choicesAreJapanese: boolean;
  correctIndex: number;
}

/** Số câu mặc định và tối thiểu. */
export const QUESTION_COUNT = 10;
/** Khớp giới hạn `total` trong bảng `kanji_quiz_attempts` của Supabase. */
export const MAX_QUESTION_COUNT = 1000;
const CHOICE_COUNT = 4;

type QuizSource = Pick<ContentPack, "kanji" | "compounds">;

export function quizPoolSize(mode: KanjiQuizMode, pack: QuizSource): number {
  if (mode === KanjiQuizMode.single) return pack.kanji.length;
  if (mode === KanjiQuizMode.compound) return pack.compounds.length;
  return pack.kanji.length + pack.compounds.length;
}

export function questionCountRange(poolSize: number): {
  min: number;
  max: number;
} {
  const max = Math.min(poolSize, MAX_QUESTION_COUNT);
  return { min: Math.min(QUESTION_COUNT, max), max };
}

export function clampQuestionCount(value: number, poolSize: number): number {
  const { min, max } = questionCountRange(poolSize);
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const modeOptions: {
  mode: KanjiQuizMode;
  label: string;
  jp: string;
  description: string;
}[] = [
  {
    mode: KanjiQuizMode.single,
    label: "Kanji đơn",
    jp: "漢字",
    description: "Âm đọc, nghĩa và mặt chữ của từng chữ Kanji.",
  },
  {
    mode: KanjiQuizMode.compound,
    label: "Từ ghép",
    jp: "熟語",
    description: "Cách đọc và nghĩa của các từ ghép thường gặp.",
  },
  {
    mode: KanjiQuizMode.mixed,
    label: "Trộn cả hai",
    jp: "混合",
    description: "Kết hợp Kanji đơn và từ ghép như đề thi thật.",
  },
];

export function modeLabel(mode: KanjiQuizMode): string {
  return modeOptions.find((o) => o.mode === mode)?.label ?? "Trắc nghiệm";
}

export function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MARKER = /[.\-－]/;
const KATAKANA = /^[\u30a0-\u30ffー]+$/;

function readingsOf(entry: KanjiEntry): string[] {
  return [...entry.onyomi, ...entry.kunyomi];
}

/** Picks up to `count` distinct values from candidates, skipping excluded ones. */
function pickDistractors(
  candidates: string[],
  exclude: Set<string>,
  count: number,
): string[] {
  const picked: string[] = [];
  for (const value of shuffle(candidates)) {
    if (!value || exclude.has(value)) continue;
    exclude.add(value);
    picked.push(value);
    if (picked.length === count) break;
  }
  return picked;
}

function build(
  item: QuizItem,
  type: QuestionType,
  subject: string,
  subjectIsJapanese: boolean,
  instruction: string,
  correct: string,
  distractors: string[],
  choicesAreJapanese: boolean,
  index: number,
): QuizQuestion | null {
  if (distractors.length < CHOICE_COUNT - 1) return null;
  const choices = shuffle([correct, ...distractors]);
  // Không bao giờ để đáp án trùng nhau hoặc còn dấu chấm/gạch của dữ liệu thô.
  if (
    new Set(choices).size !== choices.length ||
    (choicesAreJapanese && choices.some((c) => MARKER.test(c)))
  ) {
    return null;
  }
  return {
    key: `${item.id}-${type}-${index}`,
    item,
    type,
    subject,
    subjectIsJapanese,
    instruction,
    choices,
    choicesAreJapanese,
    correctIndex: choices.indexOf(correct),
  };
}

function kanjiQuestion(
  item: QuizItem & { kind: "kanji" },
  type: QuestionType,
  index: number,
  kanjiList: KanjiEntry[],
): QuizQuestion | null {
  const e = item.entry;
  const own = readingsOf(e);
  if (type === "meaning") {
    const others = kanjiList.filter((k) => k.id !== e.id).map((k) => k.meaning);
    return build(
      item,
      type,
      e.kanji,
      true,
      "Chọn nghĩa đúng của chữ Kanji",
      e.meaning,
      pickDistractors(others, new Set([e.meaning]), 3),
      false,
      index,
    );
  }
  if (own.length === 0) return null;
  const reading = own[Math.floor(Math.random() * own.length)];
  if (type === "reading") {
    const pool = kanjiList.filter((k) => k.id !== e.id).flatMap(readingsOf);
    // Ưu tiên đáp án nhiễu cùng loại chữ (On = katakana, Kun = hiragana).
    const sameScript = pool.filter(
      (r) => KATAKANA.test(r) === KATAKANA.test(reading),
    );
    const others = sameScript.length >= 12 ? sameScript : pool;
    return build(
      item,
      type,
      e.kanji,
      true,
      "Chọn cách đọc đúng của chữ Kanji",
      reading,
      pickDistractors(others, new Set(own), 3),
      true,
      index,
    );
  }
  const others = kanjiList
    .filter((k) => k.id !== e.id && !readingsOf(k).includes(reading))
    .map((k) => k.kanji);
  return build(
    item,
    type,
    reading,
    true,
    "Chọn chữ Kanji có cách đọc",
    e.kanji,
    pickDistractors(others, new Set([e.kanji]), 3),
    true,
    index,
  );
}

function compoundQuestion(
  item: QuizItem & { kind: "compound" },
  type: QuestionType,
  index: number,
  compoundList: CompoundEntry[],
): QuizQuestion | null {
  const e = item.entry;
  const others = compoundList.filter((c) => c.id !== e.id);
  if (type === "meaning") {
    return build(
      item,
      type,
      e.word,
      true,
      "Chọn nghĩa đúng của từ",
      e.meaning,
      pickDistractors(
        others.map((c) => c.meaning),
        new Set([e.meaning]),
        3,
      ),
      false,
      index,
    );
  }
  if (type === "reading") {
    return build(
      item,
      type,
      e.word,
      true,
      "Chọn cách đọc đúng của từ",
      e.reading,
      pickDistractors(
        others.map((c) => c.reading),
        new Set([e.reading]),
        3,
      ),
      true,
      index,
    );
  }
  const candidates = others
    .filter((c) => c.reading !== e.reading)
    .map((c) => c.word);
  return build(
    item,
    type,
    e.reading,
    true,
    "Chọn cách viết đúng bằng Kanji của từ",
    e.word,
    pickDistractors(candidates, new Set([e.word]), 3),
    true,
    index,
  );
}

const TYPES: QuestionType[] = ["reading", "meaning", "writing"];

export function generateQuiz(
  mode: KanjiQuizMode,
  pack: QuizSource,
  count: number = QUESTION_COUNT,
): QuizQuestion[] {
  const target = clampQuestionCount(count, quizPoolSize(mode, pack));
  const kanjiItems: QuizItem[] = pack.kanji.map((entry) => ({
    kind: "kanji",
    id: entry.id,
    entry,
  }));
  const compoundItems: QuizItem[] = pack.compounds.map((entry) => ({
    kind: "compound",
    id: entry.id,
    entry,
  }));
  const pool =
    mode === KanjiQuizMode.single
      ? kanjiItems
      : mode === KanjiQuizMode.compound
        ? compoundItems
        : [...kanjiItems, ...compoundItems];
  const questions: QuizQuestion[] = [];
  for (const item of shuffle(pool)) {
    if (questions.length === target) break;
    const index = questions.length;
    for (const type of shuffle(TYPES)) {
      const q =
        item.kind === "kanji"
          ? kanjiQuestion(item, type, index, pack.kanji)
          : compoundQuestion(item, type, index, pack.compounds);
      if (q) {
        questions.push(q);
        break;
      }
    }
  }
  return questions;
}

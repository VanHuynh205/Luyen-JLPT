import { describe, expect, it } from "vitest";
import { miniPack } from "../content/__fixtures__/mini-pack";
import type { ContentPack } from "../content/types";
import { buildRemediationSession } from "./remediation";
import type { ExamAttemptRecord, ExamDocument, ExamQuestion } from "./types";

function makePack(): ContentPack {
  const extraVocab = Array.from({ length: 16 }, (_, i) => ({
    id: `vocab-extra-${i + 1}`,
    word: `単語${i + 1}`,
    reading: `たんご${i + 1}`,
    meaning: `Từ vựng số ${i + 1}`,
    lesson: 27 + (i % 10),
    section: "từ chính" as const,
  }));

  return {
    ...miniPack,
    vocabulary: [
      ...miniPack.vocabulary,
      {
        id: "vocab-TV-26-04",
        word: "間に合います",
        reading: "まにあいます",
        hanViet: "gian hợp",
        meaning: "kịp giờ",
        lesson: 26,
        section: "từ chính",
      },
      ...extraVocab,
    ],
    kanji: [
      ...miniPack.kanji,
      {
        id: "kanji-K-767D",
        kanji: "白",
        hanViet: "BẠCH",
        onyomi: ["ハク"],
        kunyomi: ["しろ", "しろい"],
        meaning: "trắng",
        lessons: ["28"],
      },
    ],
    compounds: [
      ...miniPack.compounds,
      {
        id: "compound-KC010",
        word: "最近",
        reading: "さいきん",
        hanViet: "TỐI CẬN",
        meaning: "dạo gần đây",
        components: [],
        kanjiIds: [],
        lessons: ["30"],
      },
    ],
    grammar: [
      ...miniPack.grammar,
      {
        id: "grammar-G001",
        lesson: 26,
        pattern: "～んですか",
        connections: { v: "Thể thường" },
        meaning: "… à? … vậy?",
        usage: "Hỏi xác nhận",
        examples: [
          { japanese: "財布をなくしたんですか。", meaning: "Mất ví à?" },
        ],
      },
    ],
  };
}

function q(
  overrides: Partial<ExamQuestion> & Pick<ExamQuestion, "id" | "number">,
): ExamQuestion {
  return {
    prompt: "テスト",
    promptRuby: "テスト",
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    answerSource: "official_key",
    translation: "Dịch mẫu",
    explanation: "Giải thích mẫu",
    ...overrides,
  };
}

function makeExam(
  vocabQuestions: ExamQuestion[],
  grammarQuestions: ExamQuestion[],
): ExamDocument {
  return {
    id: "n4-2023-07",
    level: "n4",
    year: 2023,
    month: 7,
    code: "2023-07",
    title: "Đề N4 7/2023",
    answerSourceSummary: "official_key",
    hasListeningScript: false,
    hasSourceAudio: false,
    sections: [
      {
        key: "vocab",
        title: "Từ vựng & Chữ Hán",
        titleJa: "文字・語彙",
        durationSeconds: 1500,
        audioAvailable: false,
        groups: [
          {
            id: "v-m1",
            label: "問題1",
            instructionJa: "ja",
            instructionVi: "vi",
            questions: vocabQuestions,
          },
        ],
      },
      {
        key: "grammar_reading",
        title: "Ngữ pháp & Đọc hiểu",
        titleJa: "文法・読解",
        durationSeconds: 3300,
        audioAvailable: false,
        groups: [
          {
            id: "g-m1",
            label: "問題1",
            instructionJa: "ja",
            instructionVi: "vi",
            questions: grammarQuestions,
          },
        ],
      },
      {
        key: "listening",
        title: "Nghe hiểu",
        titleJa: "聴解",
        durationSeconds: 2100,
        audioAvailable: false,
        groups: [],
      },
    ],
  };
}

function makeAttempt(
  exam: ExamDocument,
  answers: Record<string, number>,
  listeningStatus: "skipped" | "submitted" = "skipped",
): ExamAttemptRecord {
  const ts = "2026-11-27T09:00:00.000Z";
  return {
    id: "33333333-3333-4333-8333-333333333333",
    owner: "guest",
    level: "n4",
    examId: exam.id,
    status: "completed",
    attemptNumber: 1,
    startedAt: ts,
    completedAt: ts,
    updatedAt: ts,
    totalScore: 0,
    totalQuestions:
      exam.sections[0].groups[0].questions.length +
      exam.sections[1].groups[0].questions.length,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 0,
        total: exam.sections[0].groups[0].questions.length,
        elapsedSeconds: 500,
        submittedAt: ts,
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: 0,
        total: exam.sections[1].groups[0].questions.length,
        elapsedSeconds: 1000,
        submittedAt: ts,
      },
      {
        key: "listening",
        status: listeningStatus,
        score: 0,
        total: 0,
        elapsedSeconds: 0,
        submittedAt: ts,
      },
    ],
    answers,
  };
}

describe("buildRemediationSession", () => {
  it("returns an empty array when 100% of attempted questions are answered correctly", () => {
    const exam = makeExam(
      [
        q({
          id: "vq1",
          number: 1,
          prompt: "[[最近]]、忙しいです。",
          choices: ["さいきん", "さいしん", "すいきん", "すいしん"],
          answerIndex: 0,
        }),
      ],
      [
        q({
          id: "gq1",
          number: 1,
          prompt: "どこに行く（　）。",
          choices: ["んですか", "から", "ので", "のに"],
          answerIndex: 0,
        }),
      ],
    );
    const attempt = makeAttempt(exam, { vq1: 0, gq1: 0 });
    expect(buildRemediationSession(attempt, exam, makePack())).toEqual([]);
  });

  it("matches missed and blank questions against pack compounds, kanji, vocab, and grammar with Minna lesson numbers", () => {
    const exam = makeExam(
      [
        q({
          id: "vq1",
          number: 1,
          prompt: "[[最近]]、とても忙しいです。",
          promptRuby: "[[{最近|さいきん}]]、とても{忙|いそが}しいです。",
          choices: ["さいしん", "すいきん", "さいきん", "すいしん"],
          answerIndex: 2,
          translation: "Dạo gần đây tôi rất bận.",
          explanation: "「最近」（TỐI CẬN）đọc là さいきん.",
        }),
        q({
          id: "vq2",
          number: 2,
          prompt: "あの[[白い]]車です。",
          promptRuby: "あの[[{白|しろ}い]]{車|くるま}です。",
          choices: ["しろい", "くろい", "あおい", "あかい"],
          answerIndex: 0,
          translation: "Chiếc xe màu trắng kia.",
          explanation: "「白い」（BẠCH）đọc là しろい.",
        }),
        q({
          id: "vq3",
          number: 3,
          prompt: "電車に（　）。",
          choices: ["間に合います", "遅れます", "探します", "拾います"],
          answerIndex: 0,
          translation: "Kịp chuyến tàu.",
          explanation: "「間に合います」nghĩa là kịp giờ.",
        }),
      ],
      [
        q({
          id: "gq1",
          number: 4,
          prompt: "どうして会社を辞めた（　）。",
          choices: ["んですか", "ので", "のに", "ながら"],
          answerIndex: 0,
          translation: "Tại sao bạn nghỉ việc vậy?",
          explanation: "Mẫu 「～んですか」dùng để hỏi xác nhận lý do.",
        }),
      ],
    );

    // vq1 wrong (1), vq2 blank, vq3 wrong (2), gq1 blank
    const attempt = makeAttempt(exam, { vq1: 1, vq3: 2 });
    const items = buildRemediationSession(attempt, exam, makePack());

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      id: "compound-KC010",
      kind: "compound",
      label: "最近",
      lesson: 30,
      sourceQuestionNumber: 1,
    });
    expect(items[1]).toMatchObject({
      id: "kanji-K-767D",
      kind: "kanji",
      label: "白",
      lesson: 28,
      sourceQuestionNumber: 2,
    });
    expect(items[2]).toMatchObject({
      id: "vocab-TV-26-04",
      kind: "vocab",
      label: "間に合います",
      lesson: 26,
      sourceQuestionNumber: 3,
    });
    expect(items[3]).toMatchObject({
      kind: "grammar",
      label: "～んですか",
      lesson: 26,
      sourceQuestionNumber: 4,
    });
  });

  it("caps results at maxItems (default 15) and deduplicates repeated pack IDs", () => {
    const vocabQuestions = Array.from({ length: 18 }, (_, i) =>
      q({
        id: `vq-${i + 1}`,
        number: i + 1,
        prompt: `これは[[単語${(i % 16) + 1}]]です。`,
        choices: [`単語${(i % 16) + 1}`, "B", "C", "D"],
        answerIndex: 0,
        explanation: `「単語${(i % 16) + 1}」là từ mục tiêu.`,
      }),
    );
    // Q17 & Q18 repeat 単語1 & 単語2 -> must deduplicate pack IDs, falling back or keeping unique IDs
    const exam = makeExam(vocabQuestions, []);
    const attempt = makeAttempt(exam, {});
    const items = buildRemediationSession(attempt, exam, makePack());

    expect(items).toHaveLength(15);
    expect(new Set(items.map((item) => item.id)).size).toBe(15);
  });

  it("falls back to exam_question when no pack entry matches", () => {
    const exam = makeExam(
      [
        q({
          id: "vq-fallback",
          number: 9,
          prompt: "[[カタカナ]]のことば。",
          choices: ["カタカナ", "ひらがな", "かんじ", "ローマじ"],
          answerIndex: 0,
          translation: "Từ katakana.",
          explanation: "Giải thích câu 9.",
        }),
      ],
      [],
    );
    const attempt = makeAttempt(exam, { "vq-fallback": 2 });
    const items = buildRemediationSession(attempt, exam, makePack());
    expect(items).toEqual([
      {
        id: "exam-question-vq-fallback",
        kind: "exam_question",
        label: "カタカナのことば。",
        reading: "カタカナ",
        meaning: "Từ katakana.",
        sourceQuestionNumber: 9,
        explanation: "Giải thích câu 9.",
      },
    ]);
  });
});

import type { ContentPack } from "../types";

const hash = "a".repeat(64);

export const miniPack = {
  manifest: {
    level: "n4",
    version: "1.0.0",
    counts: {
      vocabulary: 1,
      kanji: 1,
      compounds: 1,
      grammar: 1,
      comparisons: 1,
      conjugations: 1,
      keigo: 1,
      verbPairs: 1,
      reading: 1,
    },
    sha256: {
      vocabulary: hash,
      kanji: hash,
      compounds: hash,
      grammar: hash,
      comparisons: hash,
      conjugations: hash,
      keigo: hash,
      verbPairs: hash,
      reading: hash,
    },
  },
  vocabulary: [
    {
      id: "vocab-1",
      word: "見ます",
      reading: "みます",
      meaning: "xem",
      lesson: 26,
      section: "từ chính",
    },
  ],
  kanji: [
    {
      id: "kanji-1",
      kanji: "見",
      hanViet: "KIẾN",
      onyomi: ["ケン"],
      kunyomi: ["みる"],
      meaning: "nhìn",
      lessons: ["26"],
    },
  ],
  compounds: [
    {
      id: "compound-1",
      word: "見学",
      reading: "けんがく",
      hanViet: "KIẾN HỌC",
      meaning: "tham quan",
      components: [{ kanji: "見", hanViet: "KIẾN", meaning: "nhìn" }],
      kanjiIds: ["kanji-1"],
      lessons: ["26"],
    },
  ],
  grammar: [
    {
      id: "grammar-1",
      lesson: 26,
      pattern: "～んですか",
      connections: { v: "Thể thường" },
      meaning: "… à?",
      usage: "Hỏi xác nhận",
      examples: [{ japanese: "行くんですか。", meaning: "Bạn đi à?" }],
    },
  ],
  comparisons: [
    {
      id: "comparison-1",
      group: "câu hỏi",
      patterns: "～んですか",
      distinction: "xác nhận",
      whenToUse: "khi hỏi",
      exampleJa: "行くんですか。",
      exampleVi: "Bạn đi à?",
    },
  ],
  conjugations: [
    {
      id: "conjugation-1",
      name: "thể thường",
      labelJa: "普通形",
      recognition: "nhận biết",
      group1: "nhóm 1",
      group2: "nhóm 2",
      group3: "nhóm 3",
      examplesG1: "書く",
      examplesG2: "見る",
      examplesG3: "する",
      adjI: "い",
      adjNa: "な",
      noun: "danh từ",
      exceptions: "không",
    },
  ],
  keigo: [
    {
      id: "keigo-1",
      plainJa: "行く",
      plainKana: "いく",
      sonkeigo: "いらっしゃる",
      sonkeigoMasu: "いらっしゃいます",
      kenjogoI: "参る",
      kenjogoII: "参ります",
      teineigo: "行きます",
      recognition: "đi",
      exampleJa: "先生がいらっしゃいます。",
      exampleVi: "Thầy đến.",
    },
  ],
  verbPairs: [
    {
      id: "verbpair-1",
      transitiveJa: "電気をつける",
      transitiveKana: "でんきをつける",
      intransitiveJa: "電気がつく",
      intransitiveKana: "でんきがつく",
      meaning: "bật đèn",
    },
  ],
  reading: [
    {
      id: "reading-1",
      title: "Lời nhắn",
      length: "short",
      text: "本を読みます。",
      translation: "Tôi đọc sách.",
      vocabulary: [{ word: "本", reading: "ほん", meaning: "sách" }],
      questions: [
        {
          question: "何を読みますか。",
          choices: ["本", "新聞"],
          answerIndex: 0,
          explanation: "Đọc sách.",
        },
      ],
    },
  ],
} satisfies ContentPack;

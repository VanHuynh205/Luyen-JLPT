import { describe, expect, it } from "vitest";
import type { ExamDocument, ExamIndex } from "./types";
import { validateExamDocument, validateExamIndex } from "./validate";

function makeExam(): ExamDocument {
  return {
    id: "n4-2024-12",
    level: "n4",
    year: 2024,
    month: 12,
    code: "2024-12",
    title: "Đề thi JLPT N4 tháng 12/2024",
    answerSourceSummary: "mixed",
    hasListeningScript: true,
    hasSourceAudio: false,
    sections: [
      {
        key: "vocab",
        title: "Từ vựng",
        titleJa: "言語知識（文字・語彙）",
        durationSeconds: 1500,
        audioAvailable: false,
        groups: [
          {
            id: "v-m1",
            label: "問題1",
            instructionJa:
              "＿＿＿のことばの読み方として最もよいものをえらびなさい。",
            instructionVi: "Chọn cách đọc đúng cho từ được gạch chân.",
            questions: [
              {
                id: "n4-2024-12-v1",
                number: 1,
                prompt: "[[学校]]へ行きます。",
                promptRuby: "[[{学校|がっこう}]]へ{行|い}きます。",
                choices: ["がっこう", "かっこう", "がくこう", "かくこう"],
                choicesRuby: ["がっこう", "かっこう", "がくこう", "かくこう"],
                answerIndex: 0,
                answerSource: "official_key",
                translation: "Tôi đi đến trường.",
                explanation: "学校 đọc là がっこう (trường học).",
              },
            ],
          },
        ],
      },
      {
        key: "grammar_reading",
        title: "Ngữ pháp & Đọc hiểu",
        titleJa: "言語知識（文法）・読解",
        durationSeconds: 3300,
        audioAvailable: false,
        groups: [
          {
            id: "g-m1",
            label: "問題1",
            instructionJa: "（　）に入れるのに最もよいものをえらびなさい。",
            instructionVi: "Chọn đáp án thích hợp nhất điền vào chỗ trống.",
            passage: "きのう 友だちと 映画を見ました。",
            passageRuby:
              "きのう {友|とも}だちと {映画|えいが}を{見|み}ました。",
            passageTranslation: "Hôm qua tôi đã xem phim với bạn.",
            questions: [
              {
                id: "n4-2024-12-g1",
                number: 1,
                prompt: "雨が降って（　）ので、出かけませんでした。",
                promptRuby:
                  "{雨|あめ}が{降|ふ}って（　）ので、{出|で}かけませんでした。",
                choices: ["いた", "いる", "ある", "おいた"],
                answerIndex: 0,
                answerSource: "solved",
                translation: "Vì trời đang mưa nên tôi đã không ra ngoài.",
                explanation:
                  "Diễn tả trạng thái đang diễn ra trong quá khứ dùng ていた.",
              },
            ],
          },
        ],
      },
      {
        key: "listening",
        title: "Nghe hiểu",
        titleJa: "聴解",
        durationSeconds: 2100,
        audioAvailable: false,
        audioNote: "Chưa có file âm thanh gốc, chỉ có script luyện đọc.",
        groups: [
          {
            id: "l-m1",
            label: "問題1",
            instructionJa: "質問を聞いて、正しい答えをえらびなさい。",
            instructionVi: "Nghe câu hỏi và chọn đáp án đúng.",
            questions: [
              {
                id: "n4-2024-12-l1",
                number: 1,
                prompt: "男の人は何を買いますか。",
                promptRuby:
                  "{男|おとこ}の{人|ひと}は{何|なに}を{買|か}いますか。",
                choices: ["りんご", "みかん", "パン", "ぎゅうにゅう"],
                answerIndex: 2,
                answerSource: "solved",
                translation: "Người đàn ông sẽ mua gì?",
                explanation: "Trong hội thoại anh ấy nói sẽ mua bánh mì.",
                script: "男：パンを買ってきます。",
                scriptRuby: "{男|おとこ}：パンを{買|か}ってきます。",
                scriptTranslation: "Nam: Tôi sẽ đi mua bánh mì.",
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeIndex(): ExamIndex {
  return {
    level: "n4",
    version: "1.0.0",
    exams: [
      {
        id: "n4-2024-12",
        level: "n4",
        year: 2024,
        month: 12,
        code: "2024-12",
        title: "Đề thi JLPT N4 tháng 12/2024",
        answerSourceSummary: "mixed",
        hasListeningScript: true,
        hasSourceAudio: false,
        questionCounts: { vocab: 1, grammar_reading: 1, listening: 1 },
        totalQuestions: 3,
        totalDurationSeconds: 6900,
        sha256: "a".repeat(64),
      },
    ],
  };
}

describe("validateExamDocument", () => {
  it("accepts a valid exam document", () => {
    const exam = makeExam();
    expect(validateExamDocument(exam)).toEqual({ ok: true, value: exam });
  });

  it("accepts a listening section with empty groups when no listening script exists", () => {
    const exam = makeExam();
    exam.hasListeningScript = false;
    exam.sections[2].groups = [];
    expect(validateExamDocument(exam)).toEqual({ ok: true, value: exam });
  });

  it.each(["", "x".repeat(129), "../escape", "a/b", 123])(
    "rejects invalid exam id: %s",
    (id) => {
      const exam = { ...makeExam(), id };
      expect(validateExamDocument(exam)).toMatchObject({
        ok: false,
        error: { code: "schema" },
      });
    },
  );

  it("rejects invalid level or month", () => {
    expect(validateExamDocument({ ...makeExam(), level: "n0" })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
    expect(validateExamDocument({ ...makeExam(), month: 6 })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects sections that are missing or out of order", () => {
    const exam = makeExam();
    exam.sections = [exam.sections[1], exam.sections[0], exam.sections[2]];
    expect(validateExamDocument(exam)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });

    const shortExam = makeExam();
    shortExam.sections = shortExam.sections.slice(0, 2);
    expect(validateExamDocument(shortExam)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects duplicate question IDs across sections", () => {
    const exam = makeExam();
    exam.sections[1].groups[0].questions[0].id =
      exam.sections[0].groups[0].questions[0].id;
    expect(validateExamDocument(exam)).toMatchObject({
      ok: false,
      error: { code: "duplicate-id" },
    });
  });

  it("accepts 3-choice listening questions with matching choicesRuby and answerIndex 0..2", () => {
    const exam = makeExam();
    const listeningQ = exam.sections[2].groups[0].questions[0];
    listeningQ.choices = [
      "はい、わかりました。",
      "いいえ、ちがいます。",
      "ちょっとまってください。",
    ];
    listeningQ.choicesRuby = [
      "はい、わかりました。",
      "いいえ、ちがいます。",
      "ちょっと{待|ま}ってください。",
    ];
    listeningQ.answerIndex = 2;
    expect(validateExamDocument(exam)).toEqual({ ok: true, value: exam });
  });

  it("rejects answerIndex out of bounds for 3-choice questions", () => {
    const exam = makeExam();
    const listeningQ = exam.sections[2].groups[0].questions[0];
    listeningQ.choices = ["A", "B", "C"];
    listeningQ.answerIndex = 3;
    expect(validateExamDocument(exam)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects questions without 3 or 4 non-empty choices or mismatched choicesRuby length", () => {
    for (const badChoices of [
      ["a", "b"],
      ["a", "b", "c", "d", "e"],
    ]) {
      const exam = makeExam();
      exam.sections[0].groups[0].questions[0].choices = badChoices;
      expect(validateExamDocument(exam)).toMatchObject({
        ok: false,
        error: { code: "schema" },
      });
    }

    const examRuby = makeExam();
    examRuby.sections[0].groups[0].questions[0].choicesRuby = ["a", "b", "c"];
    expect(validateExamDocument(examRuby)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it.each([-1, 4, 1.5, "0"])("rejects invalid answerIndex: %s", (bad) => {
    const exam = makeExam();
    (
      exam.sections[0].groups[0].questions[0] as unknown as {
        answerIndex: unknown;
      }
    ).answerIndex = bad;
    expect(validateExamDocument(exam)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it.each(["prompt", "promptRuby", "translation", "explanation"] as const)(
    "rejects empty required text field %s",
    (field) => {
      const exam = makeExam();
      exam.sections[0].groups[0].questions[0][field] = "   ";
      expect(validateExamDocument(exam)).toMatchObject({
        ok: false,
        error: { code: "schema" },
      });
    },
  );
});

describe("validateExamIndex", () => {
  it("accepts a valid exam index", () => {
    const index = makeIndex();
    expect(validateExamIndex(index)).toEqual({ ok: true, value: index });
  });

  it("rejects invalid version or level", () => {
    expect(validateExamIndex({ ...makeIndex(), version: "1.0" })).toMatchObject(
      {
        ok: false,
        error: { code: "schema" },
      },
    );
    expect(validateExamIndex({ ...makeIndex(), level: "n9" })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects entry with wrong sha256, mismatched level, or mismatched totalQuestions", () => {
    const badSha = makeIndex();
    badSha.exams[0].sha256 = "z".repeat(64);
    expect(validateExamIndex(badSha)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });

    const badLevel = makeIndex();
    badLevel.exams[0].level = "n3";
    expect(validateExamIndex(badLevel)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });

    const badTotal = makeIndex();
    badTotal.exams[0].totalQuestions = 99;
    expect(validateExamIndex(badTotal)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects duplicate exam IDs in index", () => {
    const dup = makeIndex();
    dup.exams.push({ ...dup.exams[0] });
    expect(validateExamIndex(dup)).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });
});

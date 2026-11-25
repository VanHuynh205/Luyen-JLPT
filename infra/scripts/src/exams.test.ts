import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExamDocument } from "../../../frontend/src/core/exam/types";
import { buildExams, verifyExams } from "./exams";
import { buildPacks, verifyPacks } from "./packs";

const infra = fileURLToPath(new URL("../../", import.meta.url));
let root: string;

function makeExam(
  id: string,
  year: number,
  month: 7 | 12,
  withListening = false,
): ExamDocument {
  return {
    id,
    level: "n4",
    year,
    month,
    code: `${year}-${String(month).padStart(2, "0")}`,
    title: `Đề thi JLPT N4 tháng ${month}/${year}`,
    answerSourceSummary: "official_key",
    hasListeningScript: withListening,
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
            instructionJa: "読み方をえらびなさい。",
            instructionVi: "Chọn cách đọc đúng.",
            questions: [
              {
                id: `${id}-v1`,
                number: 1,
                prompt: "[[学校]]へ行きます。",
                promptRuby: "[[{学校|がっこう}]]へ{行|い}きます。",
                choices: ["がっこう", "かっこう", "がくこう", "かくこう"],
                answerIndex: 0,
                answerSource: "official_key",
                translation: "Đi đến trường.",
                explanation: "学校 là がっこう.",
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
            instructionJa: "（　）に入るものをえらびなさい。",
            instructionVi: "Chọn đáp án điền vào chỗ trống.",
            questions: [
              {
                id: `${id}-g1`,
                number: 1,
                prompt: "雨が降って（　）ます。",
                promptRuby: "{雨|あめ}が{降|ふ}って（　）ます。",
                choices: ["い", "あ", "お", "し"],
                answerIndex: 0,
                answerSource: "official_key",
                translation: "Trời đang mưa.",
                explanation: "Dùng ています.",
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
        groups: withListening
          ? [
              {
                id: "l-m1",
                label: "問題1",
                instructionJa: "聞いてえらびなさい。",
                instructionVi: "Nghe và chọn.",
                questions: [
                  {
                    id: `${id}-l1`,
                    number: 1,
                    prompt: "何を買いますか。",
                    promptRuby: "{何|なに}を{買|か}いますか。",
                    choices: ["パン", "りんご", "みかん", "みず"],
                    answerIndex: 0,
                    answerSource: "solved",
                    translation: "Mua gì?",
                    explanation: "Mua bánh mì.",
                    script: "男：パンを買います。",
                    scriptRuby: "{男|おとこ}：パンを{買|か}います。",
                    scriptTranslation: "Nam: Tôi mua bánh mì.",
                  },
                ],
              },
            ]
          : [],
      },
    ],
  };
}

function writeSourceExam(exam: ExamDocument) {
  const dir = join(root, "infra/dataset_n4_exams/exams");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${exam.id}.json`), JSON.stringify(exam, null, 2));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jlpt-exams-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("buildExams & verifyExams", () => {
  it("builds sorted exam packs, manifest, and JSONL questions into both pack dirs and verifies them", () => {
    const older = makeExam("n4-2023-07", 2023, 7, false);
    const mid = makeExam("n4-2024-07", 2024, 7, false);
    const newest = makeExam("n4-2024-12", 2024, 12, true);
    writeSourceExam(older);
    writeSourceExam(newest);
    writeSourceExam(mid);

    buildExams(root);
    verifyExams(root);

    const infraExamsDir = join(root, "infra/packs/n4/exams");
    const publicExamsDir = join(root, "frontend/public/packs/n4/exams");
    const index = JSON.parse(
      readFileSync(join(infraExamsDir, "index.json"), "utf8"),
    );
    expect(index.level).toBe("n4");
    expect(index.exams.map((e: { id: string }) => e.id)).toEqual([
      "n4-2024-12",
      "n4-2024-07",
      "n4-2023-07",
    ]);
    expect(index.exams[0].questionCounts).toEqual({
      vocab: 1,
      grammar_reading: 1,
      listening: 1,
    });
    expect(index.exams[0].totalQuestions).toBe(3);

    const examBytes = readFileSync(join(publicExamsDir, "n4-2024-12.json"));
    const actualSha = createHash("sha256").update(examBytes).digest("hex");
    expect(actualSha).toBe(index.exams[0].sha256);

    const manifest = JSON.parse(
      readFileSync(join(root, "infra/dataset_n4_exams/manifest.json"), "utf8"),
    );
    expect(manifest.examCount).toBe(3);
    expect(manifest.totalQuestions).toBe(7);

    const jsonlLines = readFileSync(
      join(root, "infra/dataset_n4_exams/jsonl/questions.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(jsonlLines).toHaveLength(7);
    expect(jsonlLines[0]).toMatchObject({
      examId: "n4-2024-12",
      section: "vocab",
      group: "v-m1",
      id: "n4-2024-12-v1",
    });
  });

  it("fails verification when a published exam, index, manifest, or JSONL is tampered or stale", () => {
    const exam = makeExam("n4-2024-12", 2024, 12, false);
    writeSourceExam(exam);
    buildExams(root);

    // Tampered published exam JSON
    appendFileSync(
      join(root, "frontend/public/packs/n4/exams/n4-2024-12.json"),
      " ",
    );
    expect(() => verifyExams(root)).toThrow(/sha256|differs/i);

    buildExams(root);
    // Tampered index.json mismatch
    appendFileSync(
      join(root, "frontend/public/packs/n4/exams/index.json"),
      " ",
    );
    expect(() => verifyExams(root)).toThrow(/index/i);

    buildExams(root);
    // Tampered manifest.json
    writeFileSync(
      join(root, "infra/dataset_n4_exams/manifest.json"),
      JSON.stringify({ stale: true }),
    );
    expect(() => verifyExams(root)).toThrow(/manifest/i);

    buildExams(root);
    // Tampered questions.jsonl
    writeFileSync(
      join(root, "infra/dataset_n4_exams/jsonl/questions.jsonl"),
      "",
    );
    expect(() => verifyExams(root)).toThrow(/questions\.jsonl/i);
  });

  it("rejects invalid source exam documents", () => {
    const dir = join(root, "infra/dataset_n4_exams/exams");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ id: "bad" }));
    expect(() => buildExams(root)).toThrow();
  });

  it("integrates with buildPacks and verifyPacks when dataset_n4_exams/exams exists", () => {
    for (const dir of ["content", "dataset_n4_minnanihongo/jsonl"]) {
      cpSync(join(infra, dir), join(root, "infra", dir), { recursive: true });
    }
    writeSourceExam(makeExam("n4-2024-12", 2024, 12, false));

    buildPacks(root, false);
    verifyPacks(root);

    expect(
      existsSync(join(root, "frontend/public/packs/n4/exams/index.json")),
    ).toBe(true);
    expect(existsSync(join(root, "infra/packs/n4/exams/n4-2024-12.json"))).toBe(
      true,
    );
  });
});

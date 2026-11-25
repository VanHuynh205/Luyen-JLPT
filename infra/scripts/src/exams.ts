import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isVersion } from "../../../frontend/src/core/content/validate";
import { countSectionQuestions } from "../../../frontend/src/core/exam/engine";
import type {
  ExamDocument,
  ExamIndex,
  ExamIndexEntry,
  ExamSectionKey,
} from "../../../frontend/src/core/exam/types";
import {
  validateExamDocument,
  validateExamIndex,
} from "../../../frontend/src/core/exam/validate";

const DATASET_DIR = "infra/dataset_n4_exams";
const EXAMS_SOURCE_DIR = `${DATASET_DIR}/exams`;

interface PreparedExam {
  exam: ExamDocument;
  entry: ExamIndexEntry;
  bytes: Buffer;
}

interface PreparedDataset {
  version: string;
  prepared: PreparedExam[];
  index: ExamIndex;
  indexBytes: Buffer;
  manifest: Record<string, unknown>;
  manifestBytes: Buffer;
  jsonlBytes: Buffer;
}

function resolveExamsVersion(root: string): string {
  for (const rel of [`${DATASET_DIR}/VERSION`, "infra/content/n4/VERSION"]) {
    const file = join(root, rel);
    if (!existsSync(file)) continue;
    const version = readFileSync(file, "utf8").trim();
    if (!isVersion(version)) throw new Error(`Invalid ${rel}`);
    return version;
  }
  return "1.0.0";
}

function loadSourceExams(root: string): PreparedDataset {
  const sourceDir = join(root, EXAMS_SOURCE_DIR);
  if (!existsSync(sourceDir)) {
    throw new Error(`Missing exam source directory: ${EXAMS_SOURCE_DIR}`);
  }
  const files = readdirSync(sourceDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const docs: ExamDocument[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const raw: unknown = JSON.parse(
      readFileSync(join(sourceDir, file), "utf8"),
    );
    const result = validateExamDocument(raw);
    if (!result.ok) {
      throw new Error(
        `Invalid exam ${file}: ${result.error.code} (${result.error.detail})`,
      );
    }
    if (result.value.level !== "n4") {
      throw new Error(
        `Unexpected exam level in ${file}: ${result.value.level}`,
      );
    }
    if (seenIds.has(result.value.id)) {
      throw new Error(`Duplicate exam id: ${result.value.id}`);
    }
    seenIds.add(result.value.id);
    docs.push(result.value);
  }

  docs.sort(
    (left, right) =>
      right.year - left.year ||
      right.month - left.month ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );

  const version = resolveExamsVersion(root);
  const prepared: PreparedExam[] = docs.map((exam) => {
    const bytes = Buffer.from(JSON.stringify(exam, null, 1), "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const questionCounts: Record<ExamSectionKey, number> = {
      vocab: 0,
      grammar_reading: 0,
      listening: 0,
    };
    let totalDurationSeconds = 0;
    for (const section of exam.sections) {
      questionCounts[section.key] = countSectionQuestions(section);
      totalDurationSeconds += section.durationSeconds;
    }
    const totalQuestions =
      questionCounts.vocab +
      questionCounts.grammar_reading +
      questionCounts.listening;
    const entry: ExamIndexEntry = {
      id: exam.id,
      level: exam.level,
      year: exam.year,
      month: exam.month,
      code: exam.code,
      title: exam.title,
      answerSourceSummary: exam.answerSourceSummary,
      hasListeningScript: exam.hasListeningScript,
      hasSourceAudio: exam.hasSourceAudio,
      questionCounts,
      totalQuestions,
      totalDurationSeconds,
      sha256,
    };
    return { exam, entry, bytes };
  });

  const index: ExamIndex = {
    level: "n4",
    version,
    exams: prepared.map((item) => item.entry),
  };
  const indexValidation = validateExamIndex(index);
  if (!indexValidation.ok) {
    throw new Error(`Invalid exam index: ${indexValidation.error.detail}`);
  }

  const totalQuestions = prepared.reduce(
    (sum, item) => sum + item.entry.totalQuestions,
    0,
  );
  const manifest = {
    level: "n4" as const,
    version,
    examCount: prepared.length,
    totalQuestions,
    exams: prepared.map(({ entry }) => ({
      id: entry.id,
      year: entry.year,
      month: entry.month,
      code: entry.code,
      title: entry.title,
      answerSourceSummary: entry.answerSourceSummary,
      hasListeningScript: entry.hasListeningScript,
      hasSourceAudio: entry.hasSourceAudio,
      questionCounts: entry.questionCounts,
      totalQuestions: entry.totalQuestions,
      totalDurationSeconds: entry.totalDurationSeconds,
      sha256: entry.sha256,
    })),
  };

  const jsonlLines: string[] = [];
  for (const { exam } of prepared) {
    for (const section of exam.sections) {
      for (const group of section.groups) {
        for (const question of group.questions) {
          jsonlLines.push(
            JSON.stringify({
              examId: exam.id,
              section: section.key,
              group: group.id,
              ...question,
            }),
          );
        }
      }
    }
  }
  const jsonlContent = jsonlLines.length ? `${jsonlLines.join("\n")}\n` : "";

  return {
    version,
    prepared,
    index,
    indexBytes: Buffer.from(JSON.stringify(index, null, 1), "utf8"),
    manifest,
    manifestBytes: Buffer.from(JSON.stringify(manifest, null, 1), "utf8"),
    jsonlBytes: Buffer.from(jsonlContent, "utf8"),
  };
}

export function buildExams(root: string): void {
  const dataset = loadSourceExams(root);

  const manifestPath = join(root, DATASET_DIR, "manifest.json");
  const jsonlDir = join(root, DATASET_DIR, "jsonl");
  mkdirSync(jsonlDir, { recursive: true });
  writeFileSync(manifestPath, dataset.manifestBytes);
  writeFileSync(join(jsonlDir, "questions.jsonl"), dataset.jsonlBytes);

  const destinations = [
    join(root, "infra/packs/n4/exams"),
    join(root, "frontend/public/packs/n4/exams"),
  ];
  for (const dir of destinations) {
    mkdirSync(dir, { recursive: true });
    for (const { entry, bytes } of dataset.prepared) {
      writeFileSync(join(dir, `${entry.id}.json`), bytes);
    }
    writeFileSync(join(dir, "index.json"), dataset.indexBytes);
  }
}

export function verifyExams(root: string): void {
  const dataset = loadSourceExams(root);
  const errors: string[] = [];

  const infraDir = join(root, "infra/packs/n4/exams");
  const publicDir = join(root, "frontend/public/packs/n4/exams");
  const dirs = [infraDir, publicDir];

  for (const dir of dirs) {
    const indexPath = join(dir, "index.json");
    if (!existsSync(indexPath)) {
      errors.push(`Missing exam index: ${indexPath}`);
      continue;
    }
    try {
      const rawBytes = readFileSync(indexPath);
      const parsed: unknown = JSON.parse(rawBytes.toString("utf8"));
      const checked = validateExamIndex(parsed);
      if (!checked.ok) {
        errors.push(`${indexPath}: ${checked.error.detail}`);
      } else if (!isDeepStrictEqual(checked.value, dataset.index)) {
        errors.push(`${indexPath}: exam index differs from source`);
      }
    } catch (error) {
      errors.push(`${indexPath}: ${String(error)}`);
    }
  }

  const infraIndexPath = join(infraDir, "index.json");
  const publicIndexPath = join(publicDir, "index.json");
  if (
    existsSync(infraIndexPath) &&
    existsSync(publicIndexPath) &&
    !readFileSync(infraIndexPath).equals(readFileSync(publicIndexPath))
  ) {
    errors.push(
      "Published exam index.json differs from infra/packs/n4/exams/index.json",
    );
  }

  for (const { entry, bytes: expectedBytes } of dataset.prepared) {
    for (const dir of dirs) {
      const filePath = join(dir, `${entry.id}.json`);
      if (!existsSync(filePath)) {
        errors.push(`Missing exam pack file: ${filePath}`);
        continue;
      }
      try {
        const actualBytes = readFileSync(filePath);
        const actualSha = createHash("sha256")
          .update(actualBytes)
          .digest("hex");
        if (actualSha !== entry.sha256) {
          errors.push(`${filePath}: sha256 mismatch`);
        }
        const parsed: unknown = JSON.parse(actualBytes.toString("utf8"));
        const validated = validateExamDocument(parsed);
        if (!validated.ok) {
          errors.push(
            `${filePath}: ${validated.error.code} (${validated.error.detail})`,
          );
        }
        if (!actualBytes.equals(expectedBytes)) {
          errors.push(`${filePath}: differs from normalized source bytes`);
        }
      } catch (error) {
        errors.push(`${filePath}: ${String(error)}`);
      }
    }
  }

  const manifestPath = join(root, DATASET_DIR, "manifest.json");
  if (!existsSync(manifestPath)) {
    errors.push(`Missing exam manifest: ${manifestPath}`);
  } else if (!readFileSync(manifestPath).equals(dataset.manifestBytes)) {
    errors.push(`Stale exam manifest.json: ${manifestPath}`);
  }

  const jsonlPath = join(root, DATASET_DIR, "jsonl/questions.jsonl");
  if (!existsSync(jsonlPath)) {
    errors.push(`Missing exam questions.jsonl: ${jsonlPath}`);
  } else if (!readFileSync(jsonlPath).equals(dataset.jsonlBytes)) {
    errors.push(`Stale exam questions.jsonl: ${jsonlPath}`);
  }

  if (errors.length) throw new Error(errors.join("\n"));
}

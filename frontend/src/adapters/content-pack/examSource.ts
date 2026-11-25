import type { Level } from "../../core/content/types";
import type {
  ExamDocument,
  ExamIndex,
  ExamIndexEntry,
} from "../../core/exam/types";
import {
  validateExamDocument,
  validateExamIndex,
} from "../../core/exam/validate";
import type { Result } from "../../core/result";
import { examStore } from "../local-store/exams";

const BUNDLED = "/packs";

export type ExamSourceError = {
  code: "schema" | "duplicate-id" | "hash-mismatch" | "network";
  detail: string;
};

function configuredSource(): string {
  return import.meta.env.VITE_CONTENT_INDEX_URL?.trim() || BUNDLED;
}

function basePath(baseUrl: string): string {
  return baseUrl.replace(/\/index\.json(?:[?#].*)?$/, "").replace(/\/+$/, "");
}

function candidateSources(baseUrl: string, hasCache: boolean): string[] {
  const isBundled = [BUNDLED, `${BUNDLED}/`, `${BUNDLED}/index.json`].includes(
    baseUrl,
  );
  return isBundled || hasCache ? [baseUrl] : [baseUrl, BUNDLED];
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function loadExamIndex(
  level: Level,
  baseUrl = configuredSource(),
): Promise<Result<ExamIndex, { code: "schema" | "network"; detail: string }>> {
  const cached = await examStore.getCachedIndex(level).catch(() => null);
  let lastError: { code: "schema" | "network"; detail: string } = {
    code: "network",
    detail: `No exam index for ${level}`,
  };

  for (const source of candidateSources(baseUrl, cached !== null)) {
    const url = `${basePath(source)}/${level}/exams/index.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = {
          code: "network",
          detail: `Failed to fetch ${url}: ${response.status}`,
        };
        continue;
      }
      const parsed: unknown = await response.json();
      const validated = validateExamIndex(parsed);
      if (!validated.ok) {
        lastError = validated.error;
        continue;
      }
      if (validated.value.level !== level) {
        lastError = {
          code: "schema",
          detail: `Exam index level mismatch: ${validated.value.level}`,
        };
        continue;
      }
      await examStore.cacheIndex(validated.value).catch(() => undefined);
      return { ok: true, value: validated.value };
    } catch (error) {
      lastError = {
        code: "network",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return cached ? { ok: true, value: cached } : { ok: false, error: lastError };
}

export async function loadExamDocument(
  level: Level,
  entry: ExamIndexEntry,
  baseUrl = configuredSource(),
): Promise<Result<ExamDocument, ExamSourceError>> {
  const cached = await examStore
    .getCachedExam(level, entry.id, entry.sha256)
    .catch(() => null);
  if (cached) return { ok: true, value: cached };

  let lastError: ExamSourceError = {
    code: "network",
    detail: `No exam document for ${level}/${entry.id}`,
  };

  for (const source of candidateSources(baseUrl, false)) {
    const url = `${basePath(source)}/${level}/exams/${entry.id}.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = {
          code: "network",
          detail: `Failed to fetch ${url}: ${response.status}`,
        };
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const actualSha = await sha256Hex(bytes);
      if (actualSha !== entry.sha256.toLowerCase()) {
        lastError = {
          code: "hash-mismatch",
          detail: `SHA-256 mismatch for ${entry.id}`,
        };
        continue;
      }
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      const validated = validateExamDocument(parsed);
      if (!validated.ok) {
        lastError = validated.error;
        continue;
      }
      if (validated.value.level !== level || validated.value.id !== entry.id) {
        lastError = {
          code: "schema",
          detail: `Exam identity mismatch: ${validated.value.level}/${validated.value.id}`,
        };
        continue;
      }
      await examStore
        .cacheExam(validated.value, actualSha)
        .catch(() => undefined);
      return { ok: true, value: validated.value };
    } catch (error) {
      lastError = {
        code: "network",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { ok: false, error: lastError };
}

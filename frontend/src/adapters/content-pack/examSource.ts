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
const FETCH_TIMEOUT_MS = 30_000;
const MAX_INDEX_BYTES = 1_048_576; // 1 MB
const MAX_DOCUMENT_BYTES = 16_777_216; // 16 MB

export type ExamSourceErrorCode =
  | "not-found"
  | "schema"
  | "duplicate-id"
  | "hash-mismatch"
  | "network"
  | "size-limit";

export type ExamSourceError = {
  code: ExamSourceErrorCode;
  detail: string;
};

export class ExamSourceHttpError extends Error {
  readonly code: ExamSourceErrorCode;

  constructor(error: ExamSourceError) {
    super(error.detail);
    this.name = "ExamSourceHttpError";
    this.code = error.code;
  }
}

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

function createRequestSignal(externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  if (!externalSignal) {
    if (typeof AbortSignal.timeout === "function") {
      return {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cleanup: () => {},
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException("Timed out", "TimeoutError"));
    }, FETCH_TIMEOUT_MS);
    return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
  }

  if (
    typeof AbortSignal.any === "function" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return {
      signal: AbortSignal.any([
        externalSignal,
        AbortSignal.timeout(FETCH_TIMEOUT_MS),
      ]),
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  const forwardAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal.aborted) {
    forwardAbort();
    return { signal: controller.signal, cleanup: () => {} };
  }
  externalSignal.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Timed out", "TimeoutError"));
  }, FETCH_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal.removeEventListener("abort", forwardAbort);
    },
  };
}

async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<Result<Uint8Array<ArrayBuffer>, ExamSourceError>> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      return {
        ok: false,
        error: {
          code: "size-limit",
          detail: `${label} exceeds maximum size of ${maxBytes} bytes`,
        },
      };
    }
  }

  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return {
            ok: false,
            error: {
              code: "size-limit",
              detail: `${label} exceeds maximum size of ${maxBytes} bytes`,
            },
          };
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const out = new Uint8Array(new ArrayBuffer(total));
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: out };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      error: {
        code: "size-limit",
        detail: `${label} exceeds maximum size of ${maxBytes} bytes`,
      },
    };
  }
  return { ok: true, value: new Uint8Array(buffer) };
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
  signal?: AbortSignal,
): Promise<Result<ExamIndex, ExamSourceError>> {
  const cached = await examStore.getCachedIndex(level).catch(() => null);
  let lastError: ExamSourceError = {
    code: "network",
    detail: `No exam index for ${level}`,
  };

  for (const source of candidateSources(baseUrl, cached !== null)) {
    const url = `${basePath(source)}/${level}/exams/index.json`;
    const req = createRequestSignal(signal);
    try {
      const response = await fetch(url, { signal: req.signal });
      if (!response.ok) {
        lastError = {
          code: response.status === 404 ? "not-found" : "network",
          detail: `Failed to fetch ${url}: ${response.status}`,
        };
        continue;
      }
      const limited = await readResponseBytesWithLimit(
        response,
        MAX_INDEX_BYTES,
        url,
      );
      if (!limited.ok) {
        lastError = limited.error;
        continue;
      }
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(limited.value),
      );
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
      if (signal?.aborted) break;
    } finally {
      req.cleanup();
    }
  }

  return cached ? { ok: true, value: cached } : { ok: false, error: lastError };
}

export async function loadExamDocument(
  level: Level,
  entry: ExamIndexEntry,
  baseUrl = configuredSource(),
  signal?: AbortSignal,
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
    const req = createRequestSignal(signal);
    try {
      const response = await fetch(url, { signal: req.signal });
      if (!response.ok) {
        lastError = {
          code: response.status === 404 ? "not-found" : "network",
          detail: `Failed to fetch ${url}: ${response.status}`,
        };
        continue;
      }
      const limited = await readResponseBytesWithLimit(
        response,
        MAX_DOCUMENT_BYTES,
        url,
      );
      if (!limited.ok) {
        lastError = limited.error;
        continue;
      }
      const bytes = limited.value;
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
      if (signal?.aborted) break;
    } finally {
      req.cleanup();
    }
  }

  return { ok: false, error: lastError };
}

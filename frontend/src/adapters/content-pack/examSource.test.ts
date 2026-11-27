import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamDocument, ExamIndex } from "../../core/exam/types";
import { db } from "../local-store/db";
import { loadExamDocument, loadExamIndex } from "./examSource";

function sampleExam(id = "n4-2024-12", title = "Đề N4 12/2024"): ExamDocument {
  return {
    id,
    level: "n4",
    year: 2024,
    month: 12,
    code: "2024-12",
    title,
    answerSourceSummary: "official_key",
    hasListeningScript: false,
    hasSourceAudio: false,
    sections: [
      {
        key: "vocab",
        title: "Từ vựng",
        titleJa: "文字・語彙",
        durationSeconds: 1500,
        audioAvailable: false,
        groups: [
          {
            id: "v1",
            label: "問題1",
            instructionJa: "ja",
            instructionVi: "vi",
            questions: [
              {
                id: `${id}-q1`,
                number: 1,
                prompt: "学校",
                promptRuby: "{学校|がっこう}",
                choices: ["がっこう", "かっこう", "がくこう", "かくこう"],
                answerIndex: 0,
                answerSource: "official_key",
                translation: "Trường học",
                explanation: "学校 đọc là がっこう.",
              },
            ],
          },
        ],
      },
      {
        key: "grammar_reading",
        title: "Ngữ pháp & Đọc hiểu",
        titleJa: "文法・読解",
        durationSeconds: 3300,
        audioAvailable: false,
        groups: [],
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

function makeFixture(exam: ExamDocument) {
  const body = JSON.stringify(exam, null, 1);
  const sha256 = createHash("sha256").update(body, "utf8").digest("hex");
  const index: ExamIndex = {
    level: exam.level,
    version: "1.0.0",
    exams: [
      {
        id: exam.id,
        level: exam.level,
        year: exam.year,
        month: exam.month,
        code: exam.code,
        title: exam.title,
        answerSourceSummary: exam.answerSourceSummary,
        hasListeningScript: exam.hasListeningScript,
        hasSourceAudio: exam.hasSourceAudio,
        questionCounts: { vocab: 1, grammar_reading: 0, listening: 0 },
        totalQuestions: 1,
        totalDurationSeconds: 6900,
        sha256,
      },
    ],
  };
  return { body, sha256, index };
}

function mockFetch(responses: Map<string, string>) {
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const body = responses.get(url);
    if (body === undefined) throw new TypeError(`Offline: ${url}`);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => db.open());
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.delete();
});

describe("examSource", () => {
  it("loads, validates, and caches exam index, falling back offline", async () => {
    const exam = sampleExam();
    const { index } = makeFixture(exam);
    mockFetch(new Map([["/packs/n4/exams/index.json", JSON.stringify(index)]]));

    expect(await loadExamIndex("n4", "/packs")).toEqual({
      ok: true,
      value: index,
    });

    mockFetch(new Map());
    expect(await loadExamIndex("n4", "/packs")).toEqual({
      ok: true,
      value: index,
    });
  });

  it("returns an error when index fetch fails and no offline cache exists", async () => {
    mockFetch(new Map());
    const result = await loadExamIndex("n4", "/packs");
    expect(result.ok).toBe(false);
  });

  it("verifies SHA-256 on fetched exam document and serves subsequent reads from Dexie cache", async () => {
    const exam = sampleExam();
    const { body, index } = makeFixture(exam);
    const entry = index.exams[0];
    const fetchMock = mockFetch(
      new Map([[`/packs/n4/exams/${exam.id}.json`, body]]),
    );

    expect(await loadExamDocument("n4", entry, "/packs")).toEqual({
      ok: true,
      value: exam,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call hits Dexie cache with matching sha256 and skips network
    expect(await loadExamDocument("n4", entry, "/packs")).toEqual({
      ok: true,
      value: exam,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Updated sha256 triggers a fresh fetch
    const updated = sampleExam("n4-2024-12", "Đề N4 12/2024 (hiệu đính)");
    const nextFixture = makeFixture(updated);
    const fetchUpdated = mockFetch(
      new Map([[`/packs/n4/exams/${updated.id}.json`, nextFixture.body]]),
    );
    expect(
      await loadExamDocument("n4", nextFixture.index.exams[0], "/packs"),
    ).toEqual({
      ok: true,
      value: updated,
    });
    expect(fetchUpdated).toHaveBeenCalledTimes(1);
  });

  it("rejects exam document when SHA-256 does not match", async () => {
    const exam = sampleExam();
    const { body, index } = makeFixture(exam);
    const tamperedEntry = { ...index.exams[0], sha256: "0".repeat(64) };
    mockFetch(new Map([[`/packs/n4/exams/${exam.id}.json`, body]]));

    const result = await loadExamDocument("n4", tamperedEntry, "/packs");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "hash-mismatch" },
    });
    expect(await db.examPacks.get(["n4", exam.id])).toBeUndefined();
  });

  it("rejects exam document with invalid schema even when SHA-256 matches", async () => {
    const invalidBody = JSON.stringify({ id: "n4-2024-12", broken: true });
    const sha256 = createHash("sha256")
      .update(invalidBody, "utf8")
      .digest("hex");
    const { index } = makeFixture(sampleExam());
    const entry = { ...index.exams[0], sha256 };
    mockFetch(new Map([[`/packs/n4/exams/${entry.id}.json`, invalidBody]]));

    const result = await loadExamDocument("n4", entry, "/packs");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
    expect(await db.examPacks.get(["n4", entry.id])).toBeUndefined();
  });

  it("returns code not-found when exam index or document responds with HTTP 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );

    const indexResult = await loadExamIndex("n3", "/packs");
    expect(indexResult).toMatchObject({
      ok: false,
      error: { code: "not-found" },
    });

    const { index } = makeFixture(sampleExam());
    const docResult = await loadExamDocument("n4", index.exams[0], "/packs");
    expect(docResult).toMatchObject({
      ok: false,
      error: { code: "not-found" },
    });
  });

  it("returns code size-limit when exam index exceeds 1 MB or exam document exceeds 16 MB", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("{}", {
            status: 200,
            headers: { "Content-Length": String(1_048_577) },
          }),
      ),
    );
    const oversizedIndex = await loadExamIndex("n4", "/packs");
    expect(oversizedIndex).toMatchObject({
      ok: false,
      error: { code: "size-limit" },
    });

    const { index } = makeFixture(sampleExam());
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = new Uint8Array(4 * 1024 * 1024);
        for (let i = 0; i < 5; i++) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200 })),
    );
    const oversizedDoc = await loadExamDocument("n4", index.exams[0], "/packs");
    expect(oversizedDoc).toMatchObject({
      ok: false,
      error: { code: "size-limit" },
    });
  });

  it("aborts hung exam fetch via AbortSignal", async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchSpy = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          seenSignal = init?.signal ?? undefined;
          if (init?.signal?.aborted) {
            reject(
              init.signal.reason ?? new DOMException("Aborted", "AbortError"),
            );
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            reject(
              init.signal?.reason ?? new DOMException("Aborted", "AbortError"),
            );
          });
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const controller = new AbortController();
    const pending = loadExamIndex("n4", "/packs", controller.signal);
    controller.abort(new DOMException("Timed out", "TimeoutError"));

    const result = await pending;
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal?.aborted).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "network" },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("enforces fetch timeout even when AbortSignal.any is absent and an external signal is passed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const originalAny = AbortSignal.any;
    Object.defineProperty(AbortSignal, "any", {
      value: undefined,
      configurable: true,
    });
    try {
      let seenSignal: AbortSignal | undefined;
      const fetchSpy = vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            seenSignal = init?.signal ?? undefined;
            init?.signal?.addEventListener("abort", () => {
              reject(
                init.signal?.reason ??
                  new DOMException("Timed out", "TimeoutError"),
              );
            });
          }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const external = new AbortController();
      const pending = loadExamIndex("n4", "/packs", external.signal);
      await vi.advanceTimersByTimeAsync(30_000);

      const result = await pending;
      expect(seenSignal?.aborted).toBe(true);
      expect(external.signal.aborted).toBe(false);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "network" },
      });
    } finally {
      Object.defineProperty(AbortSignal, "any", {
        value: originalAny,
        configurable: true,
      });
      vi.useRealTimers();
    }
  });
});

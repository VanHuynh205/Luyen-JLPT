import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { createSupabaseProgressRemote } from ".";
import type { ProgressRow } from "../../core/progress";

const owner = "10a99891-7c81-46e4-abcd-2b9095c49de1";
const attemptId = "bb08258f-378c-4052-9f95-2cab971b8cd4";
const time = "2026-11-22T01:00:00.123456+00:00";

function setup(rows: unknown[] = []) {
  const requests: Request[] = [];
  const client = createClient("https://sync.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return Response.json(request.method === "GET" ? rows : null);
      },
    },
  });
  return { remote: createSupabaseProgressRemote(client), requests };
}

it("uses the owner's composite query with the exact timestamp and escaped item key", async () => {
  const item = 'a,"(bc)\\d';
  const { remote, requests } = setup([
    {
      user_id: owner,
      item_id: "later",
      level: "n4",
      client_updated_at: time,
      server_updated_at: time,
      known: false,
    },
  ]);
  const page = await remote.pull(
    owner,
    "card_status",
    { id: item, serverUpdatedAt: time },
    10,
    new AbortController().signal,
  );
  expect(page[0].cursor).toEqual({ id: "later", serverUpdatedAt: time });
  const { searchParams } = new URL(requests[0].url);
  expect(searchParams.get("user_id")).toBe(`eq.${owner}`);
  expect(searchParams.get("order")).toBe("server_updated_at.asc,item_id.asc");
  expect(searchParams.get("limit")).toBe("10");
  expect(searchParams.get("or")).toBe(
    `(server_updated_at.gt."${time}",and(server_updated_at.eq."${time}",item_id.gt."a,\\"(bc)\\\\d"))`,
  );
});

it("coalesces state upserts and sends immutable reading attempts with the SQL wire keys", async () => {
  const { remote, requests } = setup();
  const card = {
    owner,
    level: "n4",
    id: "card",
    updatedAt: time,
    kind: "card_status",
    known: true,
  } as const;
  const rows: ProgressRow[] = [
    card,
    { ...card, known: false, updatedAt: "2026-11-22T01:00:00.123457Z" },
    { ...card, level: "n3" },
    {
      owner,
      level: "n3",
      id: attemptId,
      updatedAt: time,
      kind: "reading_attempts",
      passageId: "passage",
      score: 1,
      total: 2,
    },
  ];
  const signal = new AbortController().signal;
  await expect(
    remote.push(
      "other",
      rows.map((row) => ({ owner, row, opId: row.id })),
      signal,
    ),
  ).rejects.toThrow("scope mismatch");
  expect(requests).toHaveLength(0);
  await remote.push(
    owner,
    rows.map((row) => ({ owner, row, opId: row.id })),
    signal,
  );
  const byTable = (table: string) =>
    requests.find((request) =>
      new URL(request.url).pathname.endsWith(`/${table}`),
    )!;
  const state = byTable("card_status");
  expect(new URL(state.url).searchParams.get("on_conflict")).toBe(
    "user_id,level,item_id",
  );
  expect(state.headers.get("prefer")).toContain("resolution=merge-duplicates");
  expect(await state.json()).toEqual([
    {
      user_id: owner,
      level: "n4",
      item_id: "card",
      known: false,
      client_updated_at: rows[1].updatedAt,
    },
    {
      user_id: owner,
      level: "n3",
      item_id: "card",
      known: true,
      client_updated_at: time,
    },
  ]);
  const attempt = byTable("reading_attempts");
  expect(new URL(attempt.url).searchParams.get("on_conflict")).toBe("id");
  expect(attempt.headers.get("prefer")).toContain(
    "resolution=ignore-duplicates",
  );
  expect(await attempt.json()).toEqual([
    {
      user_id: owner,
      id: attemptId,
      item_id: "passage",
      level: "n3",
      score: 1,
      total: 2,
      client_updated_at: time,
    },
  ]);
});

it("pushes exam_attempts with merge-duplicates on id and pulls using id cursor column", async () => {
  const examRow1: Extract<ProgressRow, { kind: "exam_attempts" }> = {
    owner,
    level: "n4",
    id: attemptId,
    kind: "exam_attempts",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:45:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:00:00.000Z",
    totalScore: 24,
    totalQuestions: 85,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 24,
        total: 28,
        elapsedSeconds: 900,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-1": 2 },
  };
  const examRow2: Extract<ProgressRow, { kind: "exam_attempts" }> = {
    ...examRow1,
    updatedAt: "2026-11-27T08:30:00.000Z",
    totalScore: 44,
    sections: [
      examRow1.sections[0],
      {
        key: "grammar_reading",
        status: "submitted",
        score: 20,
        total: 29,
        elapsedSeconds: 1800,
        submittedAt: "2026-11-27T08:30:00.000Z",
      },
      examRow1.sections[2],
    ],
    answers: { "q-1": 2, "q-2": 1 },
  };

  const { remote, requests } = setup([
    {
      id: attemptId,
      user_id: owner,
      level: "n4",
      exam_id: "n4-2024-12",
      status: "in_progress",
      attempt_number: 1,
      total_score: 44,
      total_questions: 85,
      sections: examRow2.sections,
      answers: examRow2.answers,
      started_at: examRow2.startedAt,
      completed_at: null,
      client_updated_at: examRow2.updatedAt,
      server_updated_at: time,
    },
  ]);

  const signal = new AbortController().signal;
  await remote.push(
    owner,
    [
      { opId: "op-1", owner, row: examRow1 },
      { opId: "op-2", owner, row: examRow2 },
    ],
    signal,
  );

  const pushReq = requests.find((r) =>
    new URL(r.url).pathname.endsWith("/exam_attempts"),
  )!;
  expect(new URL(pushReq.url).searchParams.get("on_conflict")).toBe("id");
  expect(pushReq.headers.get("prefer")).toContain(
    "resolution=merge-duplicates",
  );
  expect(await pushReq.json()).toEqual([
    {
      id: attemptId,
      user_id: owner,
      level: "n4",
      exam_id: "n4-2024-12",
      status: "in_progress",
      attempt_number: 1,
      total_score: 44,
      total_questions: 85,
      sections: examRow2.sections,
      answers: examRow2.answers,
      started_at: examRow2.startedAt,
      completed_at: null,
      client_updated_at: examRow2.updatedAt,
    },
  ]);

  const pulled = await remote.pull(
    owner,
    "exam_attempts",
    { id: attemptId, serverUpdatedAt: time },
    10,
    signal,
  );
  expect(pulled).toHaveLength(1);
  expect(pulled[0].row).toEqual(examRow2);
  expect(pulled[0].cursor).toEqual({ id: attemptId, serverUpdatedAt: time });
  const pullUrl = new URL(requests[requests.length - 1].url);
  expect(pullUrl.searchParams.get("order")).toBe(
    "server_updated_at.asc,id.asc",
  );
  expect(pullUrl.searchParams.get("or")).toBe(
    `(server_updated_at.gt."${time}",and(server_updated_at.eq."${time}",id.gt."${attemptId}"))`,
  );
});

function makeExamAttemptRow(
  overrides: Partial<Extract<ProgressRow, { kind: "exam_attempts" }>> = {},
): Extract<ProgressRow, { kind: "exam_attempts" }> {
  return {
    owner,
    level: "n4",
    id: attemptId,
    kind: "exam_attempts",
    examId: "n4-2024-12",
    status: "in_progress",
    attemptNumber: 1,
    startedAt: "2026-11-27T07:45:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-27T08:00:00.000Z",
    totalScore: 24,
    totalQuestions: 85,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 24,
        total: 28,
        elapsedSeconds: 900,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-1": 2 },
    ...overrides,
  };
}

function toRemoteWire(
  row: Extract<ProgressRow, { kind: "exam_attempts" }>,
  serverUpdatedAt = time,
) {
  return {
    id: row.id,
    user_id: row.owner,
    level: row.level,
    exam_id: row.examId,
    status: row.status,
    attempt_number: row.attemptNumber,
    total_score: row.totalScore,
    total_questions: row.totalQuestions,
    sections: row.sections,
    answers: row.answers,
    started_at: row.startedAt,
    completed_at: row.completedAt,
    client_updated_at: row.updatedAt,
    server_updated_at: serverUpdatedAt,
  };
}

function setupHandler(
  handler: (request: Request, url: URL) => Promise<Response> | Response,
) {
  const requests: Request[] = [];
  const client = createClient("https://sync.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return handler(request, new URL(request.url));
      },
    },
  });
  return { remote: createSupabaseProgressRemote(client), requests };
}

it("treats 23514 on an already-completed exam_attempts retry as converged without updating", async () => {
  const completedRow = makeExamAttemptRow({
    status: "completed",
    completedAt: "2026-11-27T08:40:00.000Z",
    updatedAt: "2026-11-27T08:40:00.000Z",
    totalScore: 50,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 24,
        total: 28,
        elapsedSeconds: 900,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: 26,
        total: 29,
        elapsedSeconds: 2400,
        submittedAt: "2026-11-27T08:30:00.000Z",
      },
      {
        key: "listening",
        status: "skipped",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: "2026-11-27T08:40:00.000Z",
      },
    ],
    answers: { "q-1": 2, "q-2": 1 },
  });

  const { remote, requests } = setupHandler(async (request, url) => {
    if (request.method === "POST") {
      return Response.json(
        {
          code: "23514",
          message: "Completed exam attempt is immutable",
          details: null,
          hint: null,
        },
        { status: 400 },
      );
    }
    if (
      request.method === "GET" &&
      url.searchParams.get("id") === `eq.${attemptId}`
    ) {
      return Response.json([toRemoteWire(completedRow)]);
    }
    throw new Error(`Unexpected ${request.method} ${url.toString()}`);
  });

  await expect(
    remote.push(
      owner,
      [{ opId: "op-retry", owner, row: completedRow }],
      new AbortController().signal,
    ),
  ).resolves.toBeUndefined();

  expect(requests.map((r) => r.method)).toEqual(["POST", "GET"]);
});

it("resolves 23514 section regression conflict by merging remote and local monotonically and preserving locked remote sections", async () => {
  const remoteInProgress = makeExamAttemptRow({
    updatedAt: "2026-11-27T08:05:00.000Z",
    totalScore: 25,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 25,
        total: 28,
        elapsedSeconds: 950,
        submittedAt: "2026-11-27T08:05:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "pending",
        score: 0,
        total: 29,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-1": 2 },
  });

  // Device B has earlier vocab timestamp/score (08:00, score 20) + submitted grammar_reading
  const localStaleAndNewerSec2 = makeExamAttemptRow({
    updatedAt: "2026-11-27T08:30:00.000Z",
    totalScore: 40,
    sections: [
      {
        key: "vocab",
        status: "submitted",
        score: 20,
        total: 28,
        elapsedSeconds: 800,
        submittedAt: "2026-11-27T08:00:00.000Z",
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: 20,
        total: 29,
        elapsedSeconds: 1800,
        submittedAt: "2026-11-27T08:30:00.000Z",
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-1": 0, "q-2": 1 },
  });

  let patchedBody: Record<string, unknown> | undefined;
  const { remote, requests } = setupHandler(async (request, url) => {
    if (request.method === "POST") {
      return Response.json(
        {
          code: "23514",
          message: "Exam section status cannot regress",
          details: null,
          hint: null,
        },
        { status: 400 },
      );
    }
    if (
      request.method === "GET" &&
      url.searchParams.get("id") === `eq.${attemptId}`
    ) {
      return Response.json([toRemoteWire(remoteInProgress)]);
    }
    if (request.method === "PATCH") {
      patchedBody = (await request.json()) as Record<string, unknown>;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected ${request.method} ${url.toString()}`);
  });

  await remote.push(
    owner,
    [{ opId: "op-b", owner, row: localStaleAndNewerSec2 }],
    new AbortController().signal,
  );

  expect(requests.map((r) => r.method)).toEqual(["POST", "GET", "PATCH"]);
  expect(patchedBody).toMatchObject({
    id: attemptId,
    user_id: owner,
    status: "in_progress",
    total_score: 45,
    answers: { "q-1": 2, "q-2": 1 },
    sections: [
      remoteInProgress.sections[0],
      localStaleAndNewerSec2.sections[1],
      remoteInProgress.sections[2],
    ],
  });
});

it("resolves 23505 parallel in_progress conflict onto the remote attempt id and attempt_number", async () => {
  const remoteId = "11111111-2222-4333-8444-555555555555";
  const localOtherId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  const remoteRow = makeExamAttemptRow({
    id: remoteId,
    attemptNumber: 2,
    totalScore: 24,
    answers: { "q-1": 2 },
  });
  const localRow = makeExamAttemptRow({
    id: localOtherId,
    attemptNumber: 1,
    updatedAt: "2026-11-27T08:30:00.000Z",
    totalScore: 20,
    sections: [
      {
        key: "vocab",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
      {
        key: "grammar_reading",
        status: "submitted",
        score: 20,
        total: 29,
        elapsedSeconds: 1800,
        submittedAt: "2026-11-27T08:30:00.000Z",
      },
      {
        key: "listening",
        status: "pending",
        score: 0,
        total: 28,
        elapsedSeconds: 0,
        submittedAt: null,
      },
    ],
    answers: { "q-2": 1 },
  });

  let patchedUrl = "";
  let patchedBody: Record<string, unknown> | undefined;
  const { remote, requests } = setupHandler(async (request, url) => {
    if (request.method === "POST") {
      return Response.json(
        {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "exam_attempts_one_in_progress_idx"',
          details: null,
          hint: null,
        },
        { status: 409 },
      );
    }
    if (request.method === "GET") {
      if (url.searchParams.get("id") === `eq.${localOtherId}`) {
        return Response.json([]);
      }
      if (
        url.searchParams.get("exam_id") === "eq.n4-2024-12" &&
        url.searchParams.get("status") === "eq.in_progress"
      ) {
        return Response.json([toRemoteWire(remoteRow)]);
      }
    }
    if (request.method === "PATCH") {
      patchedUrl = url.toString();
      patchedBody = (await request.json()) as Record<string, unknown>;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected ${request.method} ${url.toString()}`);
  });

  await remote.push(
    owner,
    [{ opId: "op-c", owner, row: localRow }],
    new AbortController().signal,
  );

  expect(requests.map((r) => r.method)).toEqual([
    "POST",
    "GET",
    "GET",
    "PATCH",
  ]);
  expect(patchedUrl).toContain(`id=eq.${remoteId}`);
  expect(patchedBody).toMatchObject({
    id: remoteId,
    attempt_number: 2,
    total_score: 44,
    answers: { "q-1": 2, "q-2": 1 },
  });
});

it("stops cleanly when 23505 remote row completes concurrently during conflict update and rethrows genuine 23514 validation errors", async () => {
  const remoteId = "11111111-2222-4333-8444-555555555555";
  const localOtherId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const remoteInProgress = makeExamAttemptRow({ id: remoteId });
  const remoteCompleted = makeExamAttemptRow({
    id: remoteId,
    status: "completed",
    completedAt: "2026-11-27T08:40:00.000Z",
    sections: remoteInProgress.sections.map((s) => ({
      ...s,
      status: "submitted",
      submittedAt: "2026-11-27T08:40:00.000Z",
    })),
  });
  const localRow = makeExamAttemptRow({ id: localOtherId });

  let patchAttempts = 0;
  const { remote } = setupHandler(async (request, url) => {
    if (request.method === "POST") {
      return Response.json(
        { code: "23505", message: "duplicate", details: null, hint: null },
        { status: 409 },
      );
    }
    if (request.method === "GET") {
      if (url.searchParams.get("id") === `eq.${localOtherId}`) {
        return Response.json([]);
      }
      if (url.searchParams.get("id") === `eq.${remoteId}`) {
        return Response.json([toRemoteWire(remoteCompleted)]);
      }
      return Response.json([toRemoteWire(remoteInProgress)]);
    }
    if (request.method === "PATCH") {
      patchAttempts += 1;
      return Response.json(
        {
          code: "23514",
          message: "Completed exam attempt is immutable",
          details: null,
          hint: null,
        },
        { status: 400 },
      );
    }
    throw new Error(`Unexpected ${request.method}`);
  });

  await expect(
    remote.push(
      owner,
      [{ opId: "op-race", owner, row: localRow }],
      new AbortController().signal,
    ),
  ).resolves.toBeUndefined();
  expect(patchAttempts).toBe(1);

  const { remote: validationRemote } = setupHandler(async (request) => {
    if (request.method === "POST") {
      return Response.json(
        {
          code: "23514",
          message: "new row violates check constraint",
          details: null,
          hint: null,
        },
        { status: 400 },
      );
    }
    if (request.method === "GET") {
      return Response.json([]);
    }
    throw new Error(`Unexpected ${request.method}`);
  });

  await expect(
    validationRemote.push(
      owner,
      [{ opId: "op-invalid", owner, row: localRow }],
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

it("still pushes remaining batch exam_attempts rows when another row in the same batch conflicts", async () => {
  const secondId = "22222222-3333-4444-8555-666666666666";
  const completedRow = makeExamAttemptRow({
    status: "completed",
    completedAt: "2026-11-27T08:40:00.000Z",
  });
  const secondRow = makeExamAttemptRow({
    id: secondId,
    examId: "n4-2024-07",
  });

  const postedIds: string[][] = [];
  const { remote } = setupHandler(async (request, url) => {
    if (request.method === "POST") {
      const body = (await request.json()) as Array<{ id: string }>;
      postedIds.push(body.map((item) => item.id));
      if (body.some((item) => item.id === attemptId)) {
        return Response.json(
          {
            code: "23514",
            message: "Completed exam attempt is immutable",
            details: null,
            hint: null,
          },
          { status: 400 },
        );
      }
      return Response.json(null);
    }
    if (
      request.method === "GET" &&
      url.searchParams.get("id") === `eq.${attemptId}`
    ) {
      return Response.json([toRemoteWire(completedRow)]);
    }
    throw new Error(`Unexpected ${request.method}`);
  });

  await remote.push(
    owner,
    [
      { opId: "op-1", owner, row: completedRow },
      { opId: "op-2", owner, row: secondRow },
    ],
    new AbortController().signal,
  );

  expect(postedIds).toEqual([[attemptId, secondId], [attemptId], [secondId]]);
});

it("retries upsert cleanly when 23505 clears before conflict lookup", async () => {
  const localRow = makeExamAttemptRow({
    id: "cccccccc-dddd-4eee-8fff-111111111111",
    attemptNumber: 2,
  });
  let postCalls = 0;
  const { remote, requests } = setupHandler(async (request) => {
    if (request.method === "POST") {
      postCalls += 1;
      if (postCalls === 1) {
        return Response.json(
          { code: "23505", message: "duplicate", details: null, hint: null },
          { status: 409 },
        );
      }
      return Response.json(null);
    }
    if (request.method === "GET") {
      return Response.json([]);
    }
    throw new Error(`Unexpected ${request.method}`);
  });

  await expect(
    remote.push(
      owner,
      [{ opId: "op-retry-insert", owner, row: localRow }],
      new AbortController().signal,
    ),
  ).resolves.toBeUndefined();
  expect(requests.map((r) => r.method)).toEqual(["POST", "GET", "GET", "POST"]);
});

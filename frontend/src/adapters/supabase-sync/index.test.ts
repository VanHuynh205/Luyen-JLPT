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

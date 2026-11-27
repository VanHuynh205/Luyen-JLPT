import assert from "node:assert/strict";
import { deleteAccount } from "../functions/_shared/delete-account.ts";
import { corsHeadersFor } from "../functions/_shared/http.ts";
import { resolveLogin } from "../functions/_shared/resolve-login.ts";

const config = {
  url: "http://supabase.test",
  anonKey: "test-anon-key",
  serviceKey: "test-service-key",
};
const userId = "10000000-0000-4000-8000-000000000001";
const login = (
  body = { username: " Learner_One ", password: "test-password" },
) =>
  new Request("http://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
const deletion = (token?: string, expectedOwner = userId) =>
  new Request("http://example.test", {
    method: "POST",
    headers: token
      ? { authorization: `Bearer ${token}`, "x-confirmed-owner": expectedOwner }
      : undefined,
    body: JSON.stringify({ user_id: "20000000-0000-4000-8000-000000000002" }),
  });
const unexpectedFetch: typeof fetch = () =>
  assert.fail("unexpected upstream call");

Deno.test("username login authenticates server-side and returns only the token pair", async () => {
  const email = "private@example.test";
  let calls = 0;
  const response = await resolveLogin(login(), config, async (input, init) => {
    const request = new Request(input, init);
    if (++calls === 1) {
      assert.equal(
        new URL(request.url).pathname,
        "/rest/v1/rpc/resolve_username_login",
      );
      assert.equal(
        request.headers.get("authorization"),
        `Bearer ${config.serviceKey}`,
      );
      assert.deepEqual(await request.json(), { p_username: "learner_one" });
      return Response.json([{ allowed: true, user_id: userId, email }]);
    }
    assert.equal(new URL(request.url).search, "?grant_type=password");
    assert.equal(request.headers.get("apikey"), config.anonKey);
    assert.deepEqual(await request.json(), {
      email,
      password: "test-password",
    });
    return Response.json({
      access_token: "access",
      refresh_token: "refresh",
      user: { id: userId, email },
    });
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    access_token: "access",
    refresh_token: "refresh",
  });
});

Deno.test("unknown usernames and wrong passwords have identical public responses", async () => {
  for (const email of [null, "private@example.test"]) {
    let calls = 0;
    let authEmail: string | undefined;
    const response = await resolveLogin(
      login(),
      config,
      async (input, init) => {
        if (++calls === 1) return Response.json([{ allowed: true, email }]);
        authEmail = (await new Request(input, init).json()).email;
        return Response.json({ message: "internal auth reason" }, {
          status: 400,
        });
      },
    );
    assert.equal(calls, 2);
    if (email === null) assert.match(authEmail ?? "", /@login\.invalid$/);
    else assert.equal(authEmail, email);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  }
});

Deno.test("password grant must return the user bound to the requested username", async () => {
  let calls = 0;
  const response = await resolveLogin(login(), config, () => {
    return Promise.resolve(
      ++calls === 1
        ? Response.json([{
          allowed: true,
          user_id: userId,
          email: "reassigned@example.test",
        }])
        : Response.json({
          access_token: "other",
          refresh_token: "other",
          user: { id: "another-account" },
        }),
    );
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_credentials" });
});

Deno.test("throttled or unavailable limiter never calls the password endpoint", async () => {
  for (const status of [200, 502]) {
    const response = await resolveLogin(login(), config, (input) => {
      assert.equal(
        new URL(String(input)).pathname,
        "/rest/v1/rpc/resolve_username_login",
      );
      return Promise.resolve(
        Response.json([{ allowed: false, email: null }], { status }),
      );
    });
    assert.equal(response.status, status === 200 ? 429 : 503);
    assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  }
});

Deno.test("invalid or oversized credentials do not use upstream services", async () => {
  for (
    const body of [
      { username: "private@example.test", password: "test" },
      { username: "valid_name", password: "x".repeat(8192) },
    ]
  ) {
    let called = false;
    const response = await resolveLogin(login(body), config, (...args) => {
      called = true;
      return unexpectedFetch(...args);
    });
    assert.equal(called, false);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  }
});

Deno.test("delete-account verifies the bearer token and deletes only the authenticated user", async () => {
  let calls = 0;
  const response = await deleteAccount(
    deletion("user-jwt"),
    config,
    async (input, init) => {
      const request = new Request(input, init);
      if (++calls === 1) {
        assert.equal(request.method, "GET");
        assert.equal(new URL(request.url).pathname, "/auth/v1/user");
        assert.equal(request.headers.get("authorization"), "Bearer user-jwt");
        return Response.json({ id: userId, role: "authenticated" });
      }
      assert.equal(request.method, "DELETE");
      assert.equal(
        new URL(request.url).pathname,
        `/auth/v1/admin/users/${userId}`,
      );
      assert.equal(
        request.headers.get("authorization"),
        `Bearer ${config.serviceKey}`,
      );
      assert.deepEqual(await request.json(), { should_soft_delete: false });
      return Response.json({});
    },
  );
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
});

Deno.test("absent, invalid, and anonymous sessions cannot delete an account", async () => {
  assert.equal(
    (await deleteAccount(deletion(), config, unexpectedFetch)).status,
    401,
  );
  for (const status of [200, 401]) {
    let calls = 0;
    const response = await deleteAccount(deletion("untrusted"), config, () => {
      calls++;
      return Promise.resolve(
        Response.json(
          { id: userId, role: "authenticated", is_anonymous: true },
          { status },
        ),
      );
    });
    assert.equal(calls, 1);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  }
});

Deno.test("a bearer for a different account cannot confirm deletion", async () => {
  let calls = 0;
  const response = await deleteAccount(
    deletion("switched-token"),
    config,
    () => {
      assert.equal(++calls, 1);
      return Promise.resolve(
        Response.json({
          role: "authenticated",
          id: "20000000-0000-4000-8000-000000000002",
        }),
      );
    },
  );
  assert.equal(response.status, 401);
});

Deno.test("CORS reflects only allowlisted web and Tauri origins with Vary: Origin and never *", async () => {
  const allowed = ["https://luyen-jlpt.example.com"];
  const allowedReq = new Request("http://example.test", {
    method: "OPTIONS",
    headers: { origin: "https://luyen-jlpt.example.com" },
  });
  const allowedHeaders = corsHeadersFor(allowedReq, allowed);
  assert.equal(
    allowedHeaders["access-control-allow-origin"],
    "https://luyen-jlpt.example.com",
  );
  assert.equal(allowedHeaders.vary, "Origin");

  const tauriReq = new Request("http://example.test", {
    method: "OPTIONS",
    headers: { origin: "tauri://localhost" },
  });
  assert.equal(
    corsHeadersFor(tauriReq, allowed)["access-control-allow-origin"],
    "tauri://localhost",
  );

  const foreignReq = new Request("http://example.test", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example.net" },
  });
  const foreignHeaders = corsHeadersFor(foreignReq, allowed);
  assert.equal(foreignHeaders["access-control-allow-origin"], undefined);
  assert.equal(foreignHeaders.vary, "Origin");

  const preflight = await resolveLogin(
    allowedReq,
    { ...config, allowedOrigins: allowed },
    unexpectedFetch,
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://luyen-jlpt.example.com",
  );
  assert.equal(preflight.headers.get("vary"), "Origin");

  const foreignDelete = await deleteAccount(
    new Request("http://example.test", {
      method: "POST",
      headers: { origin: "https://evil.example.net" },
    }),
    { ...config, allowedOrigins: allowed },
    unexpectedFetch,
  );
  assert.equal(foreignDelete.status, 401);
  assert.equal(foreignDelete.headers.get("access-control-allow-origin"), null);
  assert.equal(foreignDelete.headers.get("vary"), "Origin");
});

Deno.test("resolve-login works with sb_publishable_* apikey header and no Authorization header", async () => {
  const allowed = ["https://luyen-jlpt.example.com"];
  const req = new Request("http://example.test", {
    method: "POST",
    headers: {
      origin: "https://luyen-jlpt.example.com",
      apikey: "sb_publishable_test_key_123",
      "content-type": "application/json",
    },
    body: JSON.stringify({ username: "learner_one", password: "test-password" }),
  });
  let calls = 0;
  const response = await resolveLogin(
    req,
    { ...config, allowedOrigins: allowed },
    async () => {
      if (++calls === 1) {
        return Response.json([
          { allowed: true, user_id: userId, email: "learner@example.test" },
        ]);
      }
      return Response.json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        user: { id: userId },
      });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://luyen-jlpt.example.com",
  );
  assert.equal(response.headers.get("vary"), "Origin");
  assert.deepEqual(await response.json(), {
    access_token: "access-token",
    refresh_token: "refresh-token",
  });
});

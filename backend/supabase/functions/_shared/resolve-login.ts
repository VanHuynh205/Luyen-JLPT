import { checkMethod, type Config, json, upstream } from "./http.ts";

async function readCredentials(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return;
  const buffer = new Uint8Array(4096);
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > buffer.length) {
        void reader.cancel().catch(() => {});
        return;
      }
      buffer.set(value, length);
      length += value.length;
    }
    const body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, length),
      ),
    ) as { username?: unknown; password?: unknown } | null;
    if (
      typeof body?.username !== "string" || typeof body?.password !== "string"
    ) return;
    const username = body.username.trim();
    if (
      !/^[A-Za-z0-9_]{3,32}$/.test(username) || !body.password ||
      body.password.length > 1024
    ) return;
    return { username: username.toLowerCase(), password: body.password };
  } catch {
    return;
  } finally {
    reader.releaseLock();
  }
}

export async function resolveLogin(
  request: Request,
  config: Config,
  fetcher = fetch,
): Promise<Response> {
  const methodError = checkMethod(request, config.allowedOrigins);
  if (methodError) return methodError;
  const denied = (status: number) =>
    json({ error: "invalid_credentials" }, status, request, config.allowedOrigins);
  const credentials = await readCredentials(request);
  if (!credentials) return denied(401);

  const started = performance.now();
  try {
    const lookup = await upstream(
      fetcher,
      `${config.url}/rest/v1/rpc/resolve_username_login`,
      config.serviceKey,
      "POST",
      config.serviceKey,
      { p_username: credentials.username },
    );
    if (!lookup.ok) return denied(503);
    const [account] = await lookup.json() as Array<
      { allowed: boolean; email: string | null; user_id: string | null }
    >;
    if (account?.allowed === false) return denied(429);
    if (account?.allowed !== true) return denied(503);

    const result = await upstream(
      fetcher,
      `${config.url}/auth/v1/token?grant_type=password`,
      config.anonKey,
      "POST",
      undefined,
      {
        email: account.email ?? "unknown@login.invalid",
        password: credentials.password,
      },
    );
    if (result.ok && account.email && account.user_id) {
      const { access_token, refresh_token, user } = await result.json();
      if (
        user?.id === account.user_id && typeof access_token === "string" &&
        access_token &&
        typeof refresh_token === "string" && refresh_token
      ) {
        return json(
          { access_token, refresh_token },
          200,
          request,
          config.allowedOrigins,
        );
      }
    } else {
      await result.body?.cancel();
    }
  } catch {
    return denied(503);
  }

  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, 500 - (performance.now() - started)))
  );
  return denied(401);
}

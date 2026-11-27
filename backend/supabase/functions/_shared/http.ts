export type Config = {
  url: string;
  anonKey: string;
  serviceKey: string;
  allowedOrigins?: readonly string[];
};

const BASE_HEADERS = {
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, x-confirmed-owner",
  "access-control-allow-methods": "OPTIONS, POST",
  "cache-control": "no-store",
  vary: "Origin",
} as const;

const TAURI_ORIGINS = [
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
] as const;

const LOCAL_FALLBACK_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4174",
] as const;

function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "*" || trimmed === "null") return null;
  if (trimmed === "tauri://localhost") return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.origin === "null"
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function readEnvAllowedOrigins(): string[] | undefined {
  try {
    const raw = Deno.env.get("ALLOWED_ORIGINS");
    if (!raw || !raw.trim()) return undefined;
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

export function corsHeadersFor(
  request: Request,
  allowedOrigins?: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  const allowed = new Set<string>(TAURI_ORIGINS);
  const configured =
    allowedOrigins !== undefined ? allowedOrigins : readEnvAllowedOrigins();
  const sources =
    configured !== undefined ? configured : LOCAL_FALLBACK_ORIGINS;
  for (const entry of sources) {
    const normalized = normalizeOrigin(entry);
    if (normalized) allowed.add(normalized);
  }

  const origin = request.headers.get("origin");
  if (origin && allowed.has(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

export function json(
  data: unknown,
  status = 200,
  request?: Request,
  allowedOrigins?: readonly string[],
) {
  const headers = request
    ? corsHeadersFor(request, allowedOrigins)
    : { ...BASE_HEADERS };
  return Response.json(data, { status, headers });
}

export function checkMethod(
  request: Request,
  allowedOrigins?: readonly string[],
): Response | undefined {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeadersFor(request, allowedOrigins),
    });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, request, allowedOrigins);
  }
}

export function upstream(
  fetcher: typeof fetch,
  url: string,
  key: string,
  method: string,
  bearer?: string,
  payload?: unknown,
) {
  const requestHeaders = new Headers({ apikey: key });
  if (bearer) requestHeaders.set("authorization", `Bearer ${bearer}`);
  if (payload !== undefined) {
    requestHeaders.set("content-type", "application/json");
  }
  return fetcher(url, {
    method,
    headers: requestHeaders,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
}

export function serve(
  handler: (request: Request, config: Config) => Promise<Response>,
) {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const allowedOrigins = readEnvAllowedOrigins();
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Missing Supabase function configuration");
  }
  Deno.serve((request) =>
    handler(request, { url, anonKey, serviceKey, allowedOrigins })
  );
}

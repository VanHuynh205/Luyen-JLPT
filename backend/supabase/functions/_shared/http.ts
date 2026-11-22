export type Config = { url: string; anonKey: string; serviceKey: string };

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, x-confirmed-owner",
  "access-control-allow-methods": "OPTIONS, POST",
  "cache-control": "no-store",
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}

export function checkMethod(request: Request): Response | undefined {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
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
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Missing Supabase function configuration");
  }
  Deno.serve((request) => handler(request, { url, anonKey, serviceKey }));
}

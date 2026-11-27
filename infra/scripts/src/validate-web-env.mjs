import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_HTTP_HOSTS = new Set(["127.0.0.1", "localhost"]);

function isPublishableOrAnonKey(key) {
  if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return true;
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    );
    return (
      payload !== null && typeof payload === "object" && payload.role === "anon"
    );
  } catch {
    return false;
  }
}

/**
 * Validates web build Supabase environment variables.
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ url: string; key: string }}
 */
export function validateWebEnv(env = process.env) {
  const rawUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!rawUrl) {
    throw new Error(
      "Missing VITE_SUPABASE_URL. Configure a valid HTTPS Supabase origin.",
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      `Invalid VITE_SUPABASE_URL: "${rawUrl}" is not a valid URL.`,
    );
  }

  const isLocalHttp =
    parsed.protocol === "http:" && LOCAL_HTTP_HOSTS.has(parsed.hostname);
  const isHttps = parsed.protocol === "https:" && parsed.hostname.length > 0;
  if (
    (!isHttps && !isLocalHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "VITE_SUPABASE_URL must be an HTTPS origin without path, query, fragment, or credentials (or http://127.0.0.1 / http://localhost for local testing).",
    );
  }

  if (!isPublishableOrAnonKey(key)) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable (sb_publishable_*) or anon JWT key; service_role and secret keys are rejected.",
    );
  }

  return { url: parsed.origin, key };
}

const isMain =
  typeof process.argv[1] === "string" &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    validateWebEnv(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

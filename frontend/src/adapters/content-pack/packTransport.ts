import {
  type ContentPack,
  LEVELS,
  type Level,
  PACK_TABLES,
} from "../../core/content/types";
import { isVersion, validatePack } from "../../core/content/validate";

export interface PackIndexEntry {
  level: Level;
  version: string;
  path: string;
}

const REQUEST_TIMEOUT_MS = 30_000;
const METADATA_LIMIT = 1024 * 1024;
const TABLE_LIMIT = 16 * 1024 * 1024;

function isEntry(value: unknown): value is PackIndexEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    LEVELS.some((level) => level === entry.level) &&
    isVersion(entry.version) &&
    entry.path === `${entry.level}/${entry.version}`
  );
}

function basePath(baseUrl: string): string {
  return baseUrl.replace(/\/index\.json(?:[?#].*)?$/, "").replace(/\/+$/, "");
}

async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Pack request timed out"));
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function getBytes(
  url: string,
  signal: AbortSignal,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  signal.throwIfAborted();
  const response = await fetch(url, { signal });
  signal.throwIfAborted();
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  if (!response.body) throw new Error(`Missing response body: ${url}`);
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        cancel();
        throw new Error(`Response too large: ${url}`);
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function readIndex(baseUrl: string): Promise<PackIndexEntry[]> {
  const url = /\/index\.json(?:[?#].*)?$/.test(baseUrl)
    ? baseUrl
    : `${basePath(baseUrl)}/index.json`;
  const index = parseJson(
    await withDeadline((signal) => getBytes(url, signal, METADATA_LIMIT)),
  );
  if (
    typeof index !== "object" ||
    index === null ||
    !("levels" in index) ||
    !Array.isArray(index.levels)
  ) {
    throw new Error("Invalid pack index");
  }
  const seen = new Set<string>();
  return index.levels.map((entry: unknown) => {
    if (!isEntry(entry) || seen.has(entry.path))
      throw new Error("Invalid pack index entry");
    seen.add(entry.path);
    return entry;
  });
}

export async function fetchPack(
  baseUrl: string,
  entry: PackIndexEntry,
): Promise<ContentPack> {
  if (!isEntry(entry)) throw new Error("Invalid pack index entry");
  return withDeadline((signal) => loadPack(baseUrl, entry, signal));
}

async function loadPack(
  baseUrl: string,
  entry: PackIndexEntry,
  signal: AbortSignal,
): Promise<ContentPack> {
  const packUrl = `${basePath(baseUrl)}/${entry.path}`;
  const manifest = parseJson(
    await getBytes(`${packUrl}/manifest.json`, signal, METADATA_LIMIT),
  );
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("level" in manifest) ||
    manifest.level !== entry.level ||
    !("version" in manifest) ||
    manifest.version !== entry.version ||
    !("sha256" in manifest) ||
    typeof manifest.sha256 !== "object" ||
    manifest.sha256 === null
  )
    throw new Error("Invalid pack manifest");

  const hashes = manifest.sha256 as Record<string, unknown>;
  const tables: Record<string, unknown> = {};
  for (const table of PACK_TABLES) {
    const expected = hashes[table];
    if (typeof expected !== "string" || !/^[a-f\d]{64}$/i.test(expected))
      throw new Error(`Invalid hash: ${table}`);
    const name = table === "verbPairs" ? "verb-pairs" : table;
    const bytes = await getBytes(
      `${packUrl}/${name}.json`,
      signal,
      TABLE_LIMIT,
    );
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (actual !== expected.toLowerCase())
      throw new Error(`Hash mismatch: ${table}`);
    tables[table] = parseJson(bytes);
  }
  const result = validatePack({ manifest, ...tables });
  if (!result.ok) throw new Error(`Invalid pack: ${result.error.detail}`);
  return result.value;
}

function compareNumeric(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareVersions(left: string, right: string): number {
  if (!isVersion(left) || !isVersion(right))
    throw new Error("Invalid semantic version");
  const leftVersion = left.split("+")[0];
  const rightVersion = right.split("+")[0];
  const leftDash = leftVersion.indexOf("-");
  const rightDash = rightVersion.indexOf("-");
  const leftCore = leftDash < 0 ? leftVersion : leftVersion.slice(0, leftDash);
  const rightCore =
    rightDash < 0 ? rightVersion : rightVersion.slice(0, rightDash);
  const leftPre = leftDash < 0 ? undefined : leftVersion.slice(leftDash + 1);
  const rightPre =
    rightDash < 0 ? undefined : rightVersion.slice(rightDash + 1);
  const leftParts = leftCore.split(".");
  const rightParts = rightCore.split(".");
  for (let index = 0; index < 3; index++) {
    const comparison = compareNumeric(leftParts[index], rightParts[index]);
    if (comparison) return comparison;
  }
  if (leftPre === undefined || rightPre === undefined)
    return leftPre === rightPre ? 0 : leftPre === undefined ? 1 : -1;
  const leftIds = leftPre.split(".");
  const rightIds = rightPre.split(".");
  for (
    let index = 0;
    index < Math.min(leftIds.length, rightIds.length);
    index++
  ) {
    const leftIdentifier = leftIds[index];
    const rightIdentifier = rightIds[index];
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    const comparison = leftNumeric
      ? compareNumeric(leftIdentifier, rightIdentifier)
      : leftIdentifier === rightIdentifier
        ? 0
        : leftIdentifier < rightIdentifier
          ? -1
          : 1;
    if (comparison) return comparison;
  }
  return Math.sign(leftIds.length - rightIds.length);
}

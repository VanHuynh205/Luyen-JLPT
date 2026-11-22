import {
  type ContentPack,
  LEVELS,
  type Level,
  type PackError,
} from "../../core/content/types";
import { isVersion, validatePack } from "../../core/content/validate";
import type { Result } from "../../core/result";
import { db } from "../local-store/db";
import { compareVersions, fetchPack, readIndex } from "./packTransport";

export type { PackIndexEntry } from "./packTransport";

const bundled = "/packs";

async function checksum(pack: ContentPack): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(pack));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function configuredSource(): string {
  return import.meta.env.VITE_CONTENT_INDEX_URL?.trim() || bundled;
}

async function latestCached(level: Level): Promise<ContentPack | undefined> {
  try {
    const keys = await db.packs.where("level").equals(level).primaryKeys();
    const versions = keys.map(([, version]) => version).filter(isVersion);
    versions.sort((left, right) => compareVersions(right, left));
    for (const version of versions) {
      const row = await db.packs.get([level, version]).catch(() => undefined);
      const result = validatePack(row?.pack);
      if (
        result.ok &&
        result.value.manifest.level === level &&
        result.value.manifest.version === version &&
        typeof row?.checksum === "string" &&
        (await checksum(result.value).catch(() => undefined)) === row.checksum
      ) {
        return result.value;
      }
    }
  } catch {
    return undefined;
  }
}

export async function listAvailableLevels(
  baseUrl = configuredSource(),
): Promise<Level[]> {
  const entries = await readIndex(baseUrl).catch(() => []);
  if (entries.length) return [...new Set(entries.map((entry) => entry.level))];
  const packs = await Promise.all(LEVELS.map(latestCached));
  const levels = packs.flatMap((pack) => (pack ? [pack.manifest.level] : []));
  return levels.length ? levels : ["n4"];
}

export async function loadPack(
  level: Level,
  baseUrl = configuredSource(),
): Promise<Result<ContentPack, PackError>> {
  const cached = await latestCached(level);
  const isBundled = [bundled, `${bundled}/`, `${bundled}/index.json`].includes(
    baseUrl,
  );
  const sources = isBundled || cached ? [baseUrl] : [baseUrl, bundled];
  let detail = `No pack for ${level}`;
  for (const source of sources) {
    try {
      const entries = (await readIndex(source)).filter(
        (entry) => entry.level === level,
      );
      const latest = entries.sort((left, right) =>
        compareVersions(right.version, left.version),
      )[0];
      if (!latest) continue;
      if (
        cached &&
        compareVersions(latest.version, cached.manifest.version) <= 0
      )
        break;
      const pack = await fetchPack(source, latest);
      await checksum(pack)
        .then((digest) =>
          db.packs.put({
            level,
            version: latest.version,
            pack,
            checksum: digest,
          }),
        )
        .catch(() => undefined);
      return { ok: true, value: pack };
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
  }
  return cached
    ? { ok: true, value: cached }
    : { ok: false, error: { code: "schema", detail } };
}

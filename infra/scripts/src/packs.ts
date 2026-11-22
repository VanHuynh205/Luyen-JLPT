import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { PACK_TABLES } from "../../../frontend/src/core/content/types";
import { isVersion } from "../../../frontend/src/core/content/validate";
import { buildPack, writeIndex } from "./build-packs";
import { removedIds, verifyN4AgainstDataset, verifyPack } from "./verify-packs";
import { tableFilename } from "./write-table";

const sample = { level: "n3", version: "1.0.0", path: "n3/1.0.0" } as const;
const tableFiles = PACK_TABLES.map(tableFilename);
const packFiles = [...tableFiles, "manifest.json"];

function contentDir(root: string, level: "n4" | "n3"): string {
  return join(root, "infra/content", level === "n4" ? "n4" : "n3-sample");
}

function n4Release(root: string) {
  const version = readFileSync(
    join(root, "infra/content/n4/VERSION"),
    "utf8",
  ).trim();
  if (!isVersion(version)) throw new Error("Invalid infra/content/n4/VERSION");
  return { level: "n4" as const, version, path: `n4/${version}` };
}

export function buildPacks(root: string, experimental: boolean): void {
  const output = join(root, "infra/packs");
  const published = join(root, "frontend/public/packs");
  const releases = [n4Release(root), ...(experimental ? [sample] : [])];
  for (const release of releases) {
    const content = contentDir(root, release.level);
    buildPack(release.level, content, output, release.version, published);
  }
  for (const dir of [output, published]) {
    writeIndex(dir, releases);
    if (!experimental) {
      for (const file of packFiles)
        rmSync(join(dir, sample.path, file), { force: true });
    }
  }
}

export function verifyPacks(root: string, previousN4?: string): void {
  const output = join(root, "infra/packs");
  const published = join(root, "frontend/public/packs");
  const n4 = n4Release(root);
  const readIndex = (dir: string): unknown =>
    JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  const index = readIndex(output);
  const releases = [
    n4,
    ...(isDeepStrictEqual(index, { levels: [n4, sample] }) ? [sample] : []),
  ];
  if (
    !isDeepStrictEqual(index, { levels: releases }) ||
    !isDeepStrictEqual(index, readIndex(published))
  ) {
    throw new Error("Invalid or inconsistent packs/index.json");
  }
  const errors: string[] = [];
  for (const release of releases) {
    for (const dir of [output, published]) {
      const pack = join(dir, release.path);
      for (const error of verifyPack(pack, release))
        errors.push(`${pack}: ${error}`);
    }
    const source = contentDir(root, release.level);
    for (const file of tableFiles) {
      if (
        !readFileSync(join(source, file)).equals(
          readFileSync(join(output, release.path, file)),
        )
      ) {
        errors.push(`Source differs from built pack: ${release.path}/${file}`);
      }
    }
    const manifest = join(release.path, "manifest.json");
    if (
      !readFileSync(join(output, manifest)).equals(
        readFileSync(join(published, manifest)),
      )
    ) {
      errors.push(`Published manifest differs: ${manifest}`);
    }
  }
  const pack = join(output, n4.path);
  errors.push(
    ...verifyN4AgainstDataset(
      pack,
      join(root, "infra/dataset_n4_minnanihongo/jsonl"),
    ),
  );
  if (previousN4) {
    const previous = JSON.parse(
      readFileSync(join(previousN4, "manifest.json"), "utf8"),
    );
    if (!isVersion(previous?.version))
      throw new Error("Invalid previous N4 version");
    const invalid = verifyPack(previousN4, {
      level: "n4",
      version: previous.version,
    });
    if (invalid.length)
      throw new Error(`Invalid previous N4 pack: ${invalid.join("\n")}`);
    if (previous.version === n4.version) {
      const current = JSON.parse(
        readFileSync(join(pack, "manifest.json"), "utf8"),
      );
      if (!isDeepStrictEqual(previous.sha256, current.sha256))
        errors.push(`N4 content changed without a version bump: ${n4.version}`);
    }
    const missing = removedIds(previousN4, pack);
    if (missing.length) errors.push(`Removed N4 IDs: ${missing.join(", ")}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  try {
    const [command, previousN4, ...rest] = process.argv.slice(2);
    if (command === "build" && previousN4 === undefined)
      buildPacks(root, process.env.EXPERIMENTAL_LEVELS === "1");
    else if (command === "verify" && !rest.length)
      verifyPacks(root, previousN4);
    else
      throw new Error("Usage: packs.ts build | verify [previous-n4-pack-dir]");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

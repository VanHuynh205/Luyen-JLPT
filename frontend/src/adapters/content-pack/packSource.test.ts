import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { miniPack } from "../../core/content/__fixtures__/mini-pack";
import { type ContentPack, PACK_TABLES } from "../../core/content/types";
import { db } from "../local-store/db";
import { listAvailableLevels, loadPack } from "./packSource";

function fixture(version: string): ContentPack {
  const pack: ContentPack = structuredClone(miniPack);
  pack.manifest.version = version;
  for (const table of PACK_TABLES) {
    pack.manifest.sha256[table] = createHash("sha256")
      .update(JSON.stringify(pack[table]))
      .digest("hex");
  }
  return pack;
}

function servePack(
  base: string,
  pack: ContentPack,
  indexVersion = pack.manifest.version,
) {
  const path = `n4/${indexVersion}`;
  const responses = new Map<string, string>([
    [
      `${base}/index.json`,
      JSON.stringify({
        levels: [{ level: "n4", version: indexVersion, path }],
      }),
    ],
    [`${base}/${path}/manifest.json`, JSON.stringify(pack.manifest)],
  ]);
  for (const table of PACK_TABLES) {
    const file = table === "verbPairs" ? "verb-pairs" : table;
    responses.set(`${base}/${path}/${file}.json`, JSON.stringify(pack[table]));
  }
  return responses;
}

function mockFetch(responses: Map<string, string>, htmlIndex?: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url === htmlIndex)
        return new Response("<html>Not Found</html>", { status: 404 });
      const body = responses.get(url);
      if (body === undefined) throw new TypeError(`Offline: ${url}`);
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

async function cache(pack: ContentPack, version = pack.manifest.version) {
  const checksum = createHash("sha256")
    .update(JSON.stringify(pack))
    .digest("hex");
  await db.packs.put({ level: "n4", version, pack, checksum });
}

beforeEach(async () => {
  await db.packs.clear();
  await db.settings.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("content pack source", () => {
  it("uses the configured index URL; online levels come from the current release", async () => {
    const remote = "https://example.test/releases";
    const indexUrl = `${remote}/index.json`;
    vi.stubEnv("VITE_CONTENT_INDEX_URL", indexUrl);
    const pack = fixture("1.0.0");
    const responses = servePack(remote, pack);
    const index = {
      levels: [
        { level: "n4", version: "1.0.0", path: "n4/1.0.0" },
        { level: "n3", version: "1.0.1", path: "n3/1.0.1" },
      ],
    };
    responses.set(indexUrl, JSON.stringify(index));
    mockFetch(responses);
    expect(await listAvailableLevels()).toEqual(["n4", "n3"]);
    expect(await loadPack("n4")).toEqual({ ok: true, value: pack });
    responses.set(indexUrl, JSON.stringify({ levels: [index.levels[0]] }));
    expect(await listAvailableLevels()).toEqual(["n4"]);
  });

  it("lists valid cached levels offline but omits a level whose only pack is corrupt", async () => {
    const good = fixture("1.0.0");
    good.manifest.level = "n3";
    const checksum = createHash("sha256")
      .update(JSON.stringify(good))
      .digest("hex");
    await db.packs.put({ level: "n3", version: "1.0.0", pack: good, checksum });
    const broken = fixture("1.0.0");
    broken.manifest.counts.grammar += 1;
    await cache(broken);
    mockFetch(new Map());
    expect(await listAvailableLevels("/packs")).toEqual(["n3"]);
  });

  it("does not download an older release when the latest valid cached version is newer", async () => {
    const stable = fixture("1.10.0");
    await cache(stable);
    await cache(fixture("1.9.0"));
    mockFetch(servePack("/packs", fixture("1.10.0-rc.2")));
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: stable });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns an error result if neither source nor cache has the requested level", async () => {
    mockFetch(servePack("/packs", fixture("1.0.0")));
    expect((await loadPack("n3", "https://example.test/packs")).ok).toBe(false);
    expect(await db.packs.count()).toBe(0);
  });

  it("uses the bundled pack when the cached pack is incomplete and the remote is offline", async () => {
    const { kanji: _kanji, ...incomplete } = fixture("1.0.0");
    await cache(incomplete as ContentPack);
    const bundled = fixture("1.0.0");
    mockFetch(servePack("/packs", bundled));

    expect(await loadPack("n4", "https://example.test/packs")).toEqual({
      ok: true,
      value: bundled,
    });
  });

  it("uses the cache when the remote index returns an HTML 404", async () => {
    const old = fixture("1.0.0");
    await cache(old);
    mockFetch(new Map(), "https://example.test/packs/index.json");

    expect(
      await loadPack("n4", "https://example.test/packs/index.json"),
    ).toEqual({ ok: true, value: old });
  });

  it("downloads, verifies and stores a newer version", async () => {
    await cache(fixture("1.0.0"));
    const newer = fixture("1.1.0");
    mockFetch(servePack("/packs", newer));

    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: newer });
    expect(await db.packs.get(["n4", "1.1.0"])).toEqual({
      level: "n4",
      version: "1.1.0",
      pack: newer,
      checksum: createHash("sha256")
        .update(JSON.stringify(newer))
        .digest("hex"),
    });
  });

  it("keeps the old pack when a downloaded table fails its SHA-256 check", async () => {
    const old = fixture("1.0.0");
    await cache(old);
    const newer = fixture("1.1.0");
    newer.manifest.sha256.kanji = "0".repeat(64);
    mockFetch(servePack("/packs", newer));

    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
    expect(await db.packs.get(["n4", "1.1.0"])).toBeUndefined();
  });

  it("lists N4 when offline with an empty cache", async () => {
    mockFetch(new Map());
    expect(await listAvailableLevels("/packs")).toEqual(["n4"]);
  });

  it("finds an older valid cache entry when a newer entry is corrupt and offline", async () => {
    const old = fixture("1.0.0");
    await cache(old);
    const { kanji: _kanji, ...incomplete } = fixture("1.1.0");
    await cache(incomplete as ContentPack);
    mockFetch(new Map());

    expect(await loadPack("n4", "https://example.test/packs")).toEqual({
      ok: true,
      value: old,
    });
  });
  it("rejects a valid-shaped translation changed after installation and falls back offline", async () => {
    const old = fixture("1.0.0");
    const newer = fixture("1.1.0");
    mockFetch(servePack("/packs", old));
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
    mockFetch(servePack("/packs", newer));
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: newer });

    const row = await db.packs.get(["n4", "1.1.0"]);
    if (!row) throw new Error("Pack was not installed");
    row.pack.vocabulary[0].meaning = "bản dịch bị sửa";
    await db.packs.update(["n4", "1.1.0"], { pack: row.pack });
    expect((await db.packs.get(["n4", "1.1.0"]))?.checksum).toBe(row.checksum);

    mockFetch(new Map());
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
    await db.packs.delete(["n4", "1.0.0"]);
    expect((await loadPack("n4", "/packs")).ok).toBe(false);
  });
  it("rejects a legacy cache record without a checksum", async () => {
    const pack = fixture("1.0.0");
    await cache(pack);
    await db.packs.update(["n4", "1.0.0"], { checksum: undefined });
    mockFetch(new Map());
    expect((await loadPack("n4", "/packs")).ok).toBe(false);
  });

  it("skips a cached pack with a cyclic extra property and finds an older pack", async () => {
    const old = fixture("1.0.0");
    const newer = fixture("1.1.0");
    mockFetch(servePack("/packs", old));
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
    mockFetch(servePack("/packs", newer));
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: newer });

    const row = await db.packs.get(["n4", "1.1.0"]);
    if (!row) throw new Error("Pack was not installed");
    const cyclic = Object.assign(row.pack, {
      extra: {} as Record<string, unknown>,
    });
    cyclic.extra.self = cyclic.extra;
    await db.packs.update(["n4", "1.1.0"], { pack: cyclic });
    mockFetch(new Map());
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
  });
  it("rejects invalid cached data even when its checksum matches", async () => {
    const pack = fixture("1.0.0");
    pack.manifest.counts.grammar += 1;
    await cache(pack);
    mockFetch(new Map());
    expect((await loadPack("n4", "/packs")).ok).toBe(false);
  });
  it("caches parsed data from tables with valid noncompact JSON", async () => {
    const pack = fixture("1.0.0");
    const responses = servePack("/packs", pack);
    for (const table of PACK_TABLES) {
      const body = JSON.stringify(pack[table], null, 2);
      pack.manifest.sha256[table] = createHash("sha256")
        .update(body)
        .digest("hex");
      const file = table === "verbPairs" ? "verb-pairs" : table;
      responses.set(`/packs/n4/1.0.0/${file}.json`, body);
    }
    responses.set(
      "/packs/n4/1.0.0/manifest.json",
      JSON.stringify(pack.manifest),
    );
    mockFetch(responses);
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: pack });
    mockFetch(new Map());
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: pack });
  });

  it.each([
    { level: "n3" as const, version: "1.1.0" },
    { level: "n4" as const, version: "1.2.0" },
  ])(
    "ignores a cache entry whose manifest identity disagrees with its key: $level $version",
    async (identity) => {
      const old = fixture("1.0.0");
      await cache(old);
      const wrong = fixture(identity.version);
      wrong.manifest.level = identity.level;
      await cache(wrong, "1.1.0");
      mockFetch(new Map());

      expect(await loadPack("n4", "https://example.test/packs")).toEqual({
        ok: true,
        value: old,
      });
    },
  );

  it.each([
    { level: "n3" as const, version: "1.1.0" },
    { level: "n4" as const, version: "1.2.0" },
  ])(
    "rejects a downloaded manifest with the wrong identity: $level $version",
    async (identity) => {
      const old = fixture("1.0.0");
      await cache(old);
      const wrong = fixture(identity.version);
      wrong.manifest.level = identity.level;
      mockFetch(servePack("/packs", wrong, "1.1.0"));

      expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: old });
      expect(await db.packs.get(["n4", "1.1.0"])).toBeUndefined();
    },
  );

  it("returns verified learning data even when saving the downloaded pack fails", async () => {
    const pack = fixture("1.1.0");
    mockFetch(servePack("/packs", pack));
    const failWrite = () => {
      throw new Error("storage unavailable");
    };
    db.packs.hook("creating", failWrite);
    try {
      expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: pack });
      expect(await db.packs.get(["n4", "1.1.0"])).toBeUndefined();
    } finally {
      db.packs.hook("creating").unsubscribe(failWrite);
    }
  });

  it("returns the verified downloaded pack when computing its cache checksum fails", async () => {
    const pack = fixture("1.1.0");
    mockFetch(servePack("/packs", pack));
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let calls = 0;
    vi.spyOn(crypto.subtle, "digest").mockImplementation((algorithm, data) => {
      if (++calls > PACK_TABLES.length)
        return Promise.reject(new Error("digest unavailable"));
      return digest(algorithm, data);
    });
    expect(await loadPack("n4", "/packs")).toEqual({ ok: true, value: pack });
    expect(await db.packs.get(["n4", "1.1.0"])).toBeUndefined();
  });
});

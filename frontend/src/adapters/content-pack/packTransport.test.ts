import { afterEach, describe, expect, it, vi } from "vitest";
import { miniPack } from "../../core/content/__fixtures__/mini-pack";
import { PACK_TABLES } from "../../core/content/types";
import { compareVersions, fetchPack, readIndex } from "./packTransport";

const entry = { level: "n4", version: "1.0.0", path: "n4/1.0.0" } as const;

async function files() {
  const pack = structuredClone(miniPack);
  const result = new Map<string, string>();
  for (const table of PACK_TABLES) {
    const body = JSON.stringify(pack[table]);
    const bytes = new TextEncoder().encode(body);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    pack.manifest.sha256[table] = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    result.set(`${table === "verbPairs" ? "verb-pairs" : table}.json`, body);
  }
  result.set("manifest.json", JSON.stringify(pack.manifest));
  return { pack, result };
}

function serve(base: string, contents: Map<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.startsWith(`${base}/`)
        ? contents.get(url.slice(base.length + 1))
        : undefined;
      return body === undefined
        ? new Response("missing", { status: 404 })
        : new Response(body);
    }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pack transport", () => {
  it.each([
    "/packs",
    "https://example.test/packs",
    "https://example.test/packs/index.json",
  ])("reads the index and pack from %s", async (baseUrl) => {
    const { pack, result } = await files();
    result.set("index.json", JSON.stringify({ levels: [entry] }));
    const base = baseUrl.replace(/\/index\.json$/, "");
    const routed = new Map<string, string>([
      ["index.json", result.get("index.json")!],
    ]);
    for (const [name, body] of result)
      if (name !== "index.json") routed.set(`${entry.path}/${name}`, body);
    serve(base, routed);
    expect(await readIndex(baseUrl)).toEqual([entry]);
    expect(await fetchPack(baseUrl, entry)).toEqual(pack);
  });

  it.each([
    { levels: null },
    { levels: [{ ...entry, level: "n6" }] },
    { levels: [{ ...entry, version: "1.0" }] },
    { levels: [{ ...entry, path: "../n4/1.0.0" }] },
    { levels: [{ ...entry, path: "n3/1.0.0" }] },
    { levels: [{ ...entry, path: "n4/%31.0.0" }] },
    { levels: [entry, entry] },
  ])("rejects malformed index %#", async (index) => {
    serve("/packs", new Map([["index.json", JSON.stringify(index)]]));
    await expect(readIndex("/packs")).rejects.toThrow();
  });

  it("rejects an oversized streamed table", async () => {
    const { result } = await files();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("vocabulary.json")) {
          return new Response(new Uint8Array(16 * 1024 * 1024 + 1));
        }
        return new Response(result.get(url.slice(url.lastIndexOf("/") + 1)));
      }),
    );
    await expect(fetchPack("/packs", entry)).rejects.toThrow(
      "Response too large",
    );
  });

  it("rejects a failed index response and non-JSON content", async () => {
    serve("/packs", new Map());
    await expect(readIndex("/packs")).rejects.toThrow();
    serve("/packs", new Map([["index.json", "<html>error</html>"]]));
    await expect(readIndex("/packs")).rejects.toThrow();
  });

  it("rejects unsafe entries before fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      fetchPack("/packs", { ...entry, path: "//evil.test/x" }),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a manifest whose identity does not match the index", async () => {
    const { result } = await files();
    const manifest = JSON.parse(result.get("manifest.json")!);
    manifest.version = "1.0.1";
    result.set("manifest.json", JSON.stringify(manifest));
    serve(`/packs/${entry.path}`, result);
    await expect(fetchPack("/packs", entry)).rejects.toThrow();
  });

  it("rejects a table whose exact bytes differ despite equivalent JSON", async () => {
    const { result } = await files();
    result.set("kanji.json", `${result.get("kanji.json")}\n`);
    serve(`/packs/${entry.path}`, result);
    await expect(fetchPack("/packs", entry)).rejects.toThrow();
  });

  it("rejects a validly hashed pack that fails schema validation", async () => {
    const { result } = await files();
    const manifest = JSON.parse(result.get("manifest.json")!);
    manifest.counts.kanji = 2;
    result.set("manifest.json", JSON.stringify(manifest));
    serve(`/packs/${entry.path}`, result);
    await expect(fetchPack("/packs", entry)).rejects.toThrow();
  });

  it("rejects missing table responses", async () => {
    const { result } = await files();
    result.delete("verb-pairs.json");
    serve(`/packs/${entry.path}`, result);
    await expect(fetchPack("/packs", entry)).rejects.toThrow();
  });

  it.each(["index headers", "index body", "pack body"])(
    "times out stalled %s and aborts the request",
    async (stage) => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, options: RequestInit = {}) => {
          signal = options.signal ?? undefined;
          if (stage === "index headers") return new Promise<Response>(() => {});
          return new Response(new ReadableStream({ start() {} }));
        }),
      );
      const pending =
        stage === "pack body"
          ? fetchPack("/packs", entry)
          : readIndex("/packs");
      const rejection = expect(pending).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(31_000);
      await rejection;
      expect(signal?.aborted).toBe(true);
    },
  );

  it("rejects a response whose streamed body exceeds the index limit", async () => {
    const chunks = [new Uint8Array(700_000), new Uint8Array(700_000)];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
              },
            }),
          ),
      ),
    );
    await expect(readIndex("/packs")).rejects.toThrow("Response too large");
  });

  it("uses one deadline for all files in a pack", async () => {
    const { result } = await files();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        const name = url.slice(url.lastIndexOf("/") + 1);
        return new Response(result.get(name));
      }),
    );
    const rejection = expect(fetchPack("/packs", entry)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(31_000);
    await rejection;
  });
});

describe("semantic version precedence", () => {
  it.each([
    ["1.0.0", "1.0.0+build.2", 0],
    ["1.10.0", "1.9.0", 1],
    ["1.0.0", "1.0.0-rc.1", 1],
    ["1.0.0-alpha.2", "1.0.0-alpha.10", -1],
    ["1.0.0-alpha.1", "1.0.0-alpha.beta", -1],
    ["1.0.0-alpha", "1.0.0-alpha.1", -1],
    ["1.0.0-alpha-z", "1.0.0-alpha-a", 1],
    ["99999999999999999999.0.0", "99999999999999999998.0.0", 1],
    ["1.0.0-99999999999999999999", "1.0.0-99999999999999999998", 1],
  ])("compares %s and %s", (left, right, expected) => {
    expect(Math.sign(compareVersions(left, right))).toBe(expected);
    expect(Math.sign(compareVersions(right, left)) || 0).toBe(-expected || 0);
  });

  it.each(["1.0", "01.0.0", "1.0.0-01", "1.0.0+"])(
    "rejects invalid version %s",
    (version) => {
      expect(() => compareVersions(version, "1.0.0")).toThrow();
    },
  );
});

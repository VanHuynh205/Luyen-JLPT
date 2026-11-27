import { describe, expect, it } from "vitest";
import { miniPack } from "./__fixtures__/mini-pack";
import { validatePack } from "./validate";

const tables = [
  "vocabulary",
  "kanji",
  "compounds",
  "grammar",
  "comparisons",
  "conjugations",
  "keigo",
  "verbPairs",
  "reading",
] as const;

describe("validatePack", () => {
  it("accepts a complete pack", () => {
    expect(validatePack(miniPack)).toMatchObject({ ok: true, value: miniPack });
  });

  it("accepts a SemVer prerelease with build metadata", () => {
    const manifest = { ...miniPack.manifest, version: "1.2.3-rc.1+build.001" };
    expect(validatePack({ ...miniPack, manifest })).toMatchObject({ ok: true });
  });

  it("rejects a count that differs from the table length", () => {
    const manifest = {
      ...miniPack.manifest,
      counts: { ...miniPack.manifest.counts, kanji: 2 },
    };
    expect(validatePack({ ...miniPack, manifest })).toMatchObject({
      ok: false,
      error: { code: "count-mismatch" },
    });
  });

  it("rejects an ID duplicated across tables", () => {
    const kanji = [{ ...miniPack.kanji[0], id: miniPack.vocabulary[0].id }];
    expect(validatePack({ ...miniPack, kanji })).toMatchObject({
      ok: false,
      error: { code: "duplicate-id" },
    });
  });

  it.each(tables)("rejects %s when it is not an array", (table) => {
    expect(validatePack({ ...miniPack, [table]: {} })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it.each(["", 123, null, "x".repeat(129)])(
    "rejects an invalid ID: %s",
    (id) => {
      const vocabulary = [{ ...miniPack.vocabulary[0], id }];
      expect(validatePack({ ...miniPack, vocabulary })).toMatchObject({
        ok: false,
        error: { code: "schema" },
      });
    },
  );

  it("rejects a missing ID", () => {
    const { id: _id, ...word } = miniPack.vocabulary[0];
    expect(validatePack({ ...miniPack, vocabulary: [word] })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("accepts an ID of 128 characters", () => {
    const vocabulary = [{ ...miniPack.vocabulary[0], id: "x".repeat(128) }];
    expect(validatePack({ ...miniPack, vocabulary }).ok).toBe(true);
  });

  it.each([
    undefined,
    null,
    {},
    { ...miniPack.manifest, level: "n0" },
    { ...miniPack.manifest, version: "1.0" },
    { ...miniPack.manifest, version: "1.2.3-01" },
  ])("rejects a missing or malformed manifest: %s", (manifest) => {
    expect(validatePack({ ...miniPack, manifest })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it.each(tables)("requires a valid count for %s", (table) => {
    for (const invalid of [undefined, -1, 1.5, "1"]) {
      const counts = { ...miniPack.manifest.counts, [table]: invalid };
      expect(
        validatePack({
          ...miniPack,
          manifest: { ...miniPack.manifest, counts },
        }),
      ).toMatchObject({ ok: false, error: { code: "schema" } });
    }
  });

  it.each(tables)("requires a SHA-256 hex digest for %s", (table) => {
    for (const invalid of [undefined, "a".repeat(63), "g".repeat(64), 123]) {
      const sha256 = { ...miniPack.manifest.sha256, [table]: invalid };
      expect(
        validatePack({
          ...miniPack,
          manifest: { ...miniPack.manifest, sha256 },
        }),
      ).toMatchObject({ ok: false, error: { code: "schema" } });
    }
  });

  it("rejects a row with a missing required non-ID field", () => {
    const { meaning: _meaning, ...word } = miniPack.vocabulary[0];
    expect(validatePack({ ...miniPack, vocabulary: [word] })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects a non-JSON object in grammar connections", () => {
    const grammar = [{ ...miniPack.grammar[0], connections: new Date(0) }];
    expect(validatePack({ ...miniPack, grammar })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("rejects an invalid nested reading question", () => {
    const reading = [
      {
        ...miniPack.reading[0],
        questions: [{ ...miniPack.reading[0].questions[0], choices: "本" }],
      },
    ];
    expect(validatePack({ ...miniPack, reading })).toMatchObject({
      ok: false,
      error: { code: "schema" },
    });
  });

  it("accepts optional textRuby string on reading passages and rejects non-string textRuby", () => {
    const validReading = [
      {
        ...miniPack.reading[0],
        textRuby: "{本|ほん}を{読|よ}みます。",
      },
    ];
    expect(validatePack({ ...miniPack, reading: validReading })).toMatchObject({
      ok: true,
    });

    const invalidReading = [
      {
        ...miniPack.reading[0],
        textRuby: 123,
      },
    ];
    expect(
      validatePack({ ...miniPack, reading: invalidReading }),
    ).toMatchObject({
      ok: false,
      error: { code: "schema", detail: "reading[0]" },
    });
  });
});

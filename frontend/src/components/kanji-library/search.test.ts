import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import { describe, expect, it } from "vitest";
import { filterKanji, normalize } from "./search";

describe("normalize", () => {
  it.each([
    ["Học", "hoc"],
    ["ĐỘNG", "dong"],
    ["カ", "か"],
    ["が", "が"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("filterKanji", () => {
  it("finds 見 by its unaccented Hán Việt reading", () => {
    expect(
      filterKanji(miniPack.kanji, "kien").map((entry) => entry.kanji),
    ).toEqual(["見"]);
  });
});

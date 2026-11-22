import { describe, expect, it } from "vitest";
import { resolveLevel } from "./level";

describe("resolveLevel", () => {
  it("falls back to N4 if the saved level disappeared", () => {
    expect(resolveLevel("n3", ["n4"])).toBe("n4");
  });

  it("retains an available saved level", () => {
    expect(resolveLevel("n3", ["n4", "n3"])).toBe("n3");
  });

  it("defaults to N4 if the setting is invalid", () => {
    expect(resolveLevel(42, ["n5", "n4"])).toBe("n4");
  });

  it("uses the first available level if N4 is absent", () => {
    expect(resolveLevel("n4", ["n2", "n3"])).toBe("n2");
  });

  it("still returns N4 when no levels are listed", () => {
    expect(resolveLevel(undefined, [])).toBe("n4");
  });
});

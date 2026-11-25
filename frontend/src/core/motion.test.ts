import { describe, expect, it } from "vitest";
import {
  isMotionPreference,
  parseMotionPreference,
  resolveMotionMode,
} from "./motion";

describe("motion preference parsing", () => {
  it("accepts valid preferences and falls back to auto for invalid inputs", () => {
    expect(isMotionPreference("auto")).toBe(true);
    expect(isMotionPreference("full")).toBe(true);
    expect(isMotionPreference("reduced")).toBe(true);
    expect(isMotionPreference("off")).toBe(false);
    expect(isMotionPreference(null)).toBe(false);

    expect(parseMotionPreference("full")).toBe("full");
    expect(parseMotionPreference("reduced")).toBe("reduced");
    expect(parseMotionPreference("unknown")).toBe("auto");
    expect(parseMotionPreference(undefined)).toBe("auto");
  });
});

describe("resolveMotionMode", () => {
  it("returns reduced when preference is reduced regardless of OS or hardware", () => {
    expect(
      resolveMotionMode({
        preference: "reduced",
        osReduced: false,
        webglSupported: true,
        lowPerf: false,
      }),
    ).toBe("reduced");
    expect(
      resolveMotionMode({
        preference: "reduced",
        osReduced: true,
        webglSupported: false,
        lowPerf: true,
      }),
    ).toBe("reduced");
  });

  it("follows OS prefers-reduced-motion when preference is auto", () => {
    expect(
      resolveMotionMode({
        preference: "auto",
        osReduced: true,
        webglSupported: true,
        lowPerf: false,
      }),
    ).toBe("reduced");
    expect(
      resolveMotionMode({
        preference: "auto",
        osReduced: false,
        webglSupported: true,
        lowPerf: false,
      }),
    ).toBe("full");
  });

  it("honors OS reduced motion even after the app has saved full effects", () => {
    expect(
      resolveMotionMode({
        preference: "full",
        osReduced: true,
        webglSupported: true,
        lowPerf: false,
      }),
    ).toBe("reduced");
  });

  it("falls back to static when WebGL is unavailable or performance degraded", () => {
    expect(
      resolveMotionMode({
        preference: "auto",
        osReduced: false,
        webglSupported: false,
        lowPerf: false,
      }),
    ).toBe("static");
    expect(
      resolveMotionMode({
        preference: "full",
        osReduced: false,
        webglSupported: true,
        lowPerf: true,
      }),
    ).toBe("static");
    expect(
      resolveMotionMode({
        preference: "full",
        osReduced: true,
        webglSupported: false,
        lowPerf: false,
      }),
    ).toBe("reduced");
  });
});

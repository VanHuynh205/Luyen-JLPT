import { describe, expect, it } from "vitest";
import { availableAndroidUpdate } from "./androidUpdate";

const update = {
  version: "0.2.0",
  versionCode: 2000,
  url: "https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/download/v0.2.0/Luyen-JLPT-android.apk",
};

describe("Android update metadata", () => {
  it("accepts an exact release download only when the version code increases", () => {
    expect(availableAndroidUpdate("0.1.999", update)).toEqual(update);
    expect(availableAndroidUpdate("0.2.0", update)).toBeUndefined();
    expect(availableAndroidUpdate("0.3.0", update)).toBeUndefined();
  });

  it("rejects unknown versions, mismatched versions and noncanonical downloads", () => {
    for (const metadata of [
      null,
      [],
      { ...update, version: "0.2.0-beta" },
      { ...update, versionCode: 2001 },
      { ...update, url: `${update.url}?redirect=example.test` },
      { ...update, url: update.url.replace("github.com", "example.test") },
      { ...update, url: update.url.replace("v0.2.0", "v0.1.0") },
    ]) {
      expect(availableAndroidUpdate("0.1.0", metadata)).toBeUndefined();
    }
    expect(availableAndroidUpdate("unknown", update)).toBeUndefined();
  });
});

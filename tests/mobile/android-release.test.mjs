import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertApkBadging,
  assertSignerFingerprint,
  createMetadata,
  versionToCode,
} from "../../mobile/scripts/android-release.mjs";

test("only accepts one signer with the pinned release certificate fingerprint", () => {
  const digest = "ab".repeat(32);
  const accepted = `Number of signers: 1\nV3.0 Signer: certificate SHA-256 digest: ${digest}\n`;
  assert.doesNotThrow(() => assertSignerFingerprint(accepted, Array(32).fill("AB").join(":")));
  assert.doesNotThrow(() => assertSignerFingerprint(accepted.replace("V3.0 Signer:", "Signer #1"), digest));
  assert.throws(() => assertSignerFingerprint(accepted, "invalid"), /Configure/);
  assert.throws(() => assertSignerFingerprint(accepted, "cd".repeat(32)), /pinned/);
  assert.throws(() => assertSignerFingerprint(accepted.replace("signers: 1", "signers: 2"), digest), /pinned/);
  assert.throws(() => assertSignerFingerprint(`${accepted}V2.0 Signer: certificate SHA-256 digest: ${digest}\n`, digest), /pinned/);
});

const settings = {
  identifier: "vn.luyenjlpt.app",
  version: "1.4.23",
  bundle: { android: { minSdkVersion: 26 } },
};
const badging = `package: name='vn.luyenjlpt.app' versionCode='1004023' versionName='1.4.23'
sdkVersion:'26'
targetSdkVersion:'37'`;

test("derives the Tauri Android version code", () => {
  assert.equal(versionToCode("0.1.0"), 1000);
  assert.equal(versionToCode("1.4.23"), 1004023);
  for (const version of ["0.0.0", "1.0.1000", "1.1000.0", "01.2.3", "1.2.3-beta.1", "2100.0.1"])
    assert.throws(() => versionToCode(version), /version/i);
});

test("generates the frontend metadata contract and canonical APK URL", () => {
  assert.deepEqual(createMetadata(settings), {
    version: "1.4.23",
    versionCode: 1004023,
    url: "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v1.4.23/Luyen-JLPT-android.apk",
  });
});

test("rejects version code overrides that would diverge from getVersion", () => {
  for (const override of [{ versionCode: 1 }, { autoIncrementVersionCode: true }]) {
    assert.throws(() => createMetadata({
      ...settings,
      bundle: { android: { minSdkVersion: 26, ...override } },
    }), /unset/);
  }
});

test("checks the APK application ID, version and minimum API instead of its name", () => {
  assert.doesNotThrow(() => assertApkBadging(badging, settings));
  assert.doesNotThrow(() =>
    assertApkBadging(
      badging.replace("sdkVersion:'26'", "minSdkVersion:'26'"),
      settings,
    ),
  );
  assert.throws(() => assertApkBadging(`${badging}\napplication-debuggable`, settings), /debuggable/);
  for (const [original, replacement] of [
    ["vn.luyenjlpt.app", "vn.luyenjlpt.app.debug"],
    ["1004023", "1004022"],
    ["1.4.23", "1.4.24"],
    ["sdkVersion:'26'", "sdkVersion:'25'"],
  ]) assert.throws(() => assertApkBadging(badging.replace(original, replacement), settings), /APK/);
});

test("opens only the approved About links on Android and iOS", () => {
  const capability = JSON.parse(readFileSync(new URL("../../mobile/src-tauri/capabilities/default.json", import.meta.url), "utf8"));
  const opener = capability.permissions.find(({ identifier }) => identifier === "opener:allow-open-url");
  assert.deepEqual(capability.platforms, ["android", "iOS"]);
  assert.deepEqual(opener.allow.map(({ url }) => url).slice(1), [
    "https://www.edrdg.org/wiki/KANJIDIC_Project.html",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    "https://github.com/VanHuynh205/Luyen-JLPT/releases",
  ]);
});

test("real mobile config uses the derived version code contract", () => {
  const config = JSON.parse(readFileSync(new URL("../../mobile/src-tauri/tauri.conf.json", import.meta.url)));
  assert.equal(config.identifier, settings.identifier, "keep the direct-distribution application ID stable across upgrades");
  assert.equal(createMetadata(config).versionCode, versionToCode(config.version));
});

test("signing skips secret-free jobs and fails closed in a release job", () => {
  const sign = fileURLToPath(new URL("../../mobile/scripts/sign-android.mjs", import.meta.url));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ANDROID_")));
  const skipped = spawnSync(process.execPath, [sign], { env, encoding: "utf8" });
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /signing skipped/i);
  const required = spawnSync(process.execPath, [sign, "input.apk", "output.apk"], {
    env: { ...env, ANDROID_RELEASE_SIGNING_ENABLED: "true" },
    encoding: "utf8",
  });
  assert.notEqual(required.status, 0);
  assert.match(required.stderr, /ANDROID_KEYSTORE_PATH.*ANDROID_KEYSTORE_PASSWORD.*ANDROID_KEY_ALIAS.*ANDROID_KEY_PASSWORD/);
});

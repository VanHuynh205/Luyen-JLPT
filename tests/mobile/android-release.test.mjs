import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_ANDROID_APK_BYTES,
  assertApkBadging,
  assertSignerFingerprint,
  createMetadata,
  readApkIntegrity,
  versionToCode,
} from "../../mobile/scripts/android-release.mjs";
import { patchAndroidProject } from "../../mobile/scripts/patch-android-manifest.mjs";

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

test("extends metadata with sha256 and sizeBytes when apkInfo is provided and rejects > 60 MiB (SEC-T08)", () => {
  const sha256 = "AB".repeat(32);
  assert.deepEqual(createMetadata(settings, { sha256, sizeBytes: 24_000_000 }), {
    version: "1.4.23",
    versionCode: 1004023,
    url: "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v1.4.23/Luyen-JLPT-android.apk",
    sha256: "ab".repeat(32),
    sizeBytes: 24_000_000,
  });
  assert.equal(MAX_ANDROID_APK_BYTES, 62_914_560);
  for (const invalid of [
    { sha256: "not-hex", sizeBytes: 1024 },
    { sha256: "ab".repeat(31), sizeBytes: 1024 },
    { sha256: "ab".repeat(32), sizeBytes: 0 },
    { sha256: "ab".repeat(32), sizeBytes: -5 },
    { sha256: "ab".repeat(32), sizeBytes: 1.5 },
    { sha256: "ab".repeat(32), sizeBytes: MAX_ANDROID_APK_BYTES + 1 },
  ]) {
    assert.throws(() => createMetadata(settings, invalid));
  }

  const dir = mkdtempSync(join(tmpdir(), "luyen-apk-integrity-"));
  try {
    const samplePath = join(dir, "sample.apk");
    writeFileSync(samplePath, "dummy-apk-payload");
    const integrity = readApkIntegrity(samplePath);
    assert.match(integrity.sha256, /^[a-f0-9]{64}$/);
    assert.equal(integrity.sizeBytes, 17);

    const emptyPath = join(dir, "empty.apk");
    writeFileSync(emptyPath, "");
    assert.throws(() => readApkIntegrity(emptyPath), /size/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  assert.throws(() => assertApkBadging(`${badging}\nusesCleartextTraffic="true"`, settings), /cleartext/i);
  assert.throws(() => assertApkBadging(`${badging}\nusesCleartextTraffic='true'`, settings), /cleartext/i);
  assert.throws(() => assertApkBadging(`${badging}\napplication-uses-cleartext-traffic`, settings), /cleartext/i);
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

test("android-update capability removes opener:allow-open-url and release-assets CDN (SEC-E7-06)", () => {
  const capability = JSON.parse(
    readFileSync(new URL("../../mobile/src-tauri/capabilities/android-update.json", import.meta.url), "utf8"),
  );
  assert.equal(
    capability.permissions.some((p) => (typeof p === "string" ? p : p.identifier) === "opener:allow-open-url"),
    false,
  );
  const httpPerm = capability.permissions.find((p) => typeof p === "object" && p.identifier === "http:default");
  assert.ok(httpPerm, "http:default must remain for android-latest.json");
  assert.deepEqual(
    httpPerm.allow.map(({ url }) => url),
    [
      "https://github.com/VanHuynh205/Luyen-JLPT/releases/latest/download/android-latest.json",
      "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v*/android-latest.json",
    ],
  );
});

test("patch-android-manifest.mjs idempotently hardens manifest, writes XML configs and ApkInstallerPlugin.kt (SEC-T08)", () => {
  const dir = mkdtempSync(join(tmpdir(), "luyen-android-gen-"));
  try {
    const manifestPath = join(dir, "app", "src", "main", "AndroidManifest.xml");
    mkdirSync(join(dir, "app", "src", "main"), { recursive: true });
    writeFileSync(
      manifestPath,
      `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:label="@string/app_name"
        android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity" android:exported="true" />
    </application>
</manifest>
`,
    );

    patchAndroidProject(dir);
    const manifestAfterFirst = readFileSync(manifestPath, "utf8");
    patchAndroidProject(dir);
    const manifestAfterSecond = readFileSync(manifestPath, "utf8");

    assert.equal(manifestAfterSecond, manifestAfterFirst, "patchAndroidProject must be idempotent");
    assert.match(manifestAfterFirst, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
    assert.match(manifestAfterFirst, /android:usesCleartextTraffic="false"/);
    assert.doesNotMatch(manifestAfterFirst, /android:usesCleartextTraffic="true"/);
    assert.match(manifestAfterFirst, /android:networkSecurityConfig="@xml\/network_security_config"/);
    assert.match(manifestAfterFirst, /androidx\.core\.content\.FileProvider/);
    assert.match(manifestAfterFirst, /android:authorities="\$\{applicationId\}\.fileprovider"/);
    assert.match(manifestAfterFirst, /android:exported="false"/);
    assert.match(manifestAfterFirst, /android:grantUriPermissions="true"/);
    assert.match(manifestAfterFirst, /android:resource="@xml\/file_paths"/);

    const filePathsXml = readFileSync(join(dir, "app", "src", "main", "res", "xml", "file_paths.xml"), "utf8");
    assert.match(filePathsXml, /<cache-path\s+name="updates"\s+path="updates\/"\s*\/>/);

    const netSecXml = readFileSync(join(dir, "app", "src", "main", "res", "xml", "network_security_config.xml"), "utf8");
    assert.match(netSecXml, /cleartextTrafficPermitted="false"/);
    assert.match(netSecXml, /<certificates\s+src="system"\s*\/>/);

    const pluginKt = readFileSync(
      join(dir, "app", "src", "main", "java", "vn", "luyenjlpt", "app", "ApkInstallerPlugin.kt"),
      "utf8",
    );
    assert.match(pluginKt, /@TauriPlugin/);
    assert.match(pluginKt, /GET_SIGNING_CERTIFICATES/);
    assert.match(pluginKt, /vn\.luyenjlpt\.app/);
    assert.match(pluginKt, /FileProvider\.getUriForFile/);
    assert.match(pluginKt, /FLAG_GRANT_READ_URI_PERMISSION/);
    assert.match(pluginKt, /MessageDigest\.getInstance\("SHA-256"\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const releaseBase = "https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/download";

export function readConfig() {
  return JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
}

export function versionToCode(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version))
    throw new Error("Android release version must be X.Y.Z with minor and patch below 1000");
  const [major, minor, patch] = version.split(".").map(Number);
  const versionCode = major * 1_000_000 + minor * 1_000 + patch;
  if (versionCode < 1 || versionCode > 2_100_000_000)
    throw new Error("Android version code is outside 1..2100000000");
  return versionCode;
}

export function createMetadata(config) {
  const android = config.bundle?.android;
  if (!android || "versionCode" in android || "autoIncrementVersionCode" in android)
    throw new Error("Leave bundle.android.versionCode and autoIncrementVersionCode unset");
  const { version } = config;
  return { version, versionCode: versionToCode(version), url: `${releaseBase}/v${version}/Luyen-JLPT-android.apk` };
}

export function assertApkBadging(badging, config) {
  const { version, versionCode } = createMetadata(config);
  if (/^application-debuggable\b/m.test(badging))
    throw new Error("APK must not be debuggable for release");
  const packageLine = /^package: .*$/m.exec(badging)?.[0] ?? "";
  const sdkVersion =
    /^sdkVersion:'(\d+)'\r?$/m.exec(badging)?.[1] ??
    /^minSdkVersion:'(\d+)'\r?$/m.exec(badging)?.[1];
  for (const [field, expected] of Object.entries({ name: config.identifier, versionCode, versionName: version })) {
    if (new RegExp(`\\b${field}='([^']*)'`).exec(packageLine)?.[1] !== String(expected))
      throw new Error(`APK manifest ${field} must be ${expected}`);
  }
  if (sdkVersion !== String(config.bundle.android.minSdkVersion))
    throw new Error(`APK minimum SDK must be ${config.bundle.android.minSdkVersion}`);
}

export function androidBuildTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const version = process.env.ANDROID_BUILD_TOOLS_VERSION || "37.0.0";
  if (!sdk) throw new Error("Set ANDROID_HOME or ANDROID_SDK_ROOT to the Android SDK");
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("ANDROID_BUILD_TOOLS_VERSION must name an installed X.Y.Z version");
  return resolve(sdk, "build-tools", version);
}

export function checkApk(apk, config) {
  const aapt2 = join(androidBuildTools(), process.platform === "win32" ? "aapt2.exe" : "aapt2");
  let badging;
  try {
    badging = execFileSync(aapt2, ["dump", "badging", resolve(apk)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    throw new Error(`aapt2 could not inspect the APK (${error.code ?? error.status}); check the APK path and SDK Build Tools at ${androidBuildTools()}`);
  }
  assertApkBadging(badging, config);
}

export function runApksigner(args, { signing = false } = {}) {
  const java = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
    : "java";
  const jar = join(androidBuildTools(), "lib", "apksigner.jar");
  try {
    return execFileSync(java, ["-jar", jar, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 128 * 1024,
    });
  } catch (error) {
    throw new Error(`apksigner ${signing ? "signing" : "verification"} failed (${error.code ?? error.status}); check Java, SDK Build Tools and ${signing ? "release signing credentials" : "the signed APK"}`);
  }
}

export function assertSignerFingerprint(report, expected) {
  const normalize = (fingerprint) => fingerprint?.replaceAll(":", "").trim().toLowerCase();
  const pinned = normalize(expected);
  if (!/^[a-f0-9]{64}$/.test(pinned ?? ""))
    throw new Error("Configure ANDROID_SIGNING_CERT_SHA256 with the release certificate fingerprint");
  const signerCount = /^Number of signers: (\d+)[ \t]*\r?$/m.exec(report)?.[1];
  const matches = [
    ...report.matchAll(/^.+ certificate SHA-256 digest: ([a-f0-9:]+)[ \t]*\r?$/gim),
  ];
  if (signerCount !== "1" || matches.length !== 1 || normalize(matches[0][1]) !== pinned)
    throw new Error("The APK does not use the pinned Android release certificate");
}

export function verifyReleaseSigner(apk) {
  assertSignerFingerprint(
    runApksigner(["verify", "--verbose", "--print-certs", resolve(apk)]),
    process.env.ANDROID_SIGNING_CERT_SHA256,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, apk, ...rest] = process.argv.slice(2);
    if (rest.length || !(command === "version" && !apk || ["check", "metadata"].includes(command) && apk))
      throw new Error("Usage: android-release.mjs version | check <release.apk> | metadata <signed-release.apk>");
    const config = readConfig();
    const metadata = createMetadata(config);
    if (apk) checkApk(apk, config);
    if (command === "metadata") verifyReleaseSigner(apk);
    process.stdout.write(`${JSON.stringify(metadata)}\n`);
  } catch (error) {
    console.error(`android-release: ${error.message}`);
    process.exitCode = 2;
  }
}

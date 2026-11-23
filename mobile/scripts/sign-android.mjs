import { constants, copyFileSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { checkApk, readConfig, runApksigner, verifyReleaseSigner } from "./android-release.mjs";

function sign() {
  if (process.env.ANDROID_RELEASE_SIGNING_ENABLED !== "true") {
    console.log("Android release signing skipped: ANDROID_RELEASE_SIGNING_ENABLED is not true.");
    return;
  }
  const keys = ["ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD", "ANDROID_SIGNING_CERT_SHA256"];
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing signing environment: ${missing.join(", ")}`);
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output || rest.length)
    throw new Error("Usage: sign-android.mjs <unsigned.apk> <signed.apk>");
  const source = resolve(input);
  const destination = resolve(output);
  if (source === destination) throw new Error("Input and output APK paths must differ");
  const config = readConfig();
  checkApk(source, config);
  const stage = mkdtempSync(join(dirname(destination), ".android-sign-"));
  const stagedApk = join(stage, "signed.apk");
  try {
    runApksigner([
      "sign", "--v4-signing-enabled", "false",
      "--ks", resolve(process.env.ANDROID_KEYSTORE_PATH),
      "--ks-key-alias", process.env.ANDROID_KEY_ALIAS,
      "--ks-pass", "env:ANDROID_KEYSTORE_PASSWORD",
      "--key-pass", "env:ANDROID_KEY_PASSWORD",
      "--out", stagedApk, source,
    ], { signing: true });
    verifyReleaseSigner(stagedApk);
    checkApk(stagedApk, config);
    copyFileSync(stagedApk, destination, constants.COPYFILE_EXCL);
  } finally {
    try {
      unlinkSync(stagedApk);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    rmdirSync(stage);
  }
  console.log("Signed APK verified and written to the requested output path.");
}

try {
  sign();
} catch (error) {
  console.error(`android-sign: ${error.message}`);
  process.exitCode = 2;
}

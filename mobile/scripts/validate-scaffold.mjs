import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMetadata, readConfig } from "./android-release.mjs";

const config = readConfig();
const configUrl = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const frontend = new URL(`${config.build.frontendDist}/`, configUrl);
const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));

createMetadata(config);
if (config.build.frontendDist !== "../../frontend/dist" || config.identifier !== "vn.luyenjlpt.app.mobile")
  throw new Error("Unexpected shared frontend path or mobile identifier");
if (config.bundle.android.minSdkVersion !== 26 || config.bundle.iOS.minimumSystemVersion !== "15.0")
  throw new Error("Expected Android API 26 and iOS 15 minimums");
if (!config.app.windows[0].useHttpsScheme)
  throw new Error("Android asset origin must be secure for Web Crypto pack validation");
if (!config.plugins["deep-link"].mobile.some(({ scheme, host }) => scheme.includes("luyenjlpt") && host === "auth-callback"))
  throw new Error("Expected the luyenjlpt://auth-callback registration");
if (!config.plugins.http.scopeRedirects) throw new Error("HTTP redirects must be scoped");

if (!process.argv.includes("--config-only")) {
  readFileSync(new URL("index.html", frontend));
  const packs = new URL("packs/", frontend);
  const { levels } = readJson(new URL("index.json", packs));
  const seed = levels.find(({ level, path, version }) => level === "n4" && /^\d+\.\d+\.\d+$/.test(version) && path === `n4/${version}`);
  if (!seed) throw new Error("Bundled frontend has no versioned N4 pack");
  const pack = new URL(`${seed.path}/`, packs);
  const manifest = readJson(new URL("manifest.json", pack));
  if (manifest.level !== "n4" || manifest.version !== seed.version)
    throw new Error("Bundled N4 manifest does not match its index entry");
  for (const table of ["vocabulary", "kanji", "compounds", "grammar", "comparisons", "conjugations", "keigo", "verbPairs", "reading"]) {
    const file = table === "verbPairs" ? "verb-pairs" : table;
    const data = readFileSync(new URL(`${file}.json`, pack));
    if (createHash("sha256").update(data).digest("hex") !== manifest.sha256[table])
      throw new Error(`Bundled N4 checksum mismatch: ${file}.json`);
  }
  console.log(`Bundled N4 pack ${seed.version}: all nine table checksums verified.`);
}
console.log("Mobile config contract verified.");

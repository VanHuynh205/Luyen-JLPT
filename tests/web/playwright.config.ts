import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const frontend = fileURLToPath(new URL("../../frontend/", import.meta.url));
const staging =
  process.env.JLPT_STAGING_URL === undefined
    ? null
    : new URL(process.env.JLPT_STAGING_URL);
if (
  staging &&
  (staging.protocol !== "https:" ||
    staging.username ||
    staging.password ||
    staging.href !== `${staging.origin}/`)
) {
  throw new Error(
    "JLPT_STAGING_URL must be an HTTPS origin without credentials, path, query or fragment",
  );
}
if (staging && process.env.JLPT_LOCAL_AUTH === "1") {
  throw new Error("JLPT_LOCAL_AUTH is for the disposable local stack only");
}
const baseURL = staging?.origin ?? "http://127.0.0.1:4174";

export default defineConfig({
  testDir: ".",
  testMatch: staging
    ? [
        "routes.spec.ts",
        "level-switcher.spec.ts",
        "guest-progress.spec.ts",
        "kanji-quiz-count.spec.ts",
      ]
    : undefined,
  outputDir: "../../test-results",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    serviceWorkers: "block",
  },
  webServer: staging
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort",
        cwd: frontend,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});

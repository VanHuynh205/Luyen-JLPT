import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { readConfig } from "../../mobile/scripts/android-release.mjs";

const [apk, ...args] = process.argv.slice(2);
const required = args.includes("--required");
const adb = process.env.ADB || "adb";
const id = readConfig().identifier;

function skip(reason) {
  if (required) throw new Error(reason);
  console.log(`SKIP Android offline smoke: ${reason}`);
  process.exit(0);
}

function run(...args) {
  return execFileSync(adb, args, { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

if (!apk || !existsSync(apk)) skip("Pass the built APK path as the first argument.");
let devices;
try {
  devices = run("devices");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  skip("adb is not installed or on PATH.");
}
const emulators = [...devices.matchAll(/^(emulator-\d+)\s+device\s*$/gm)].map((match) => match[1]);
const serial = process.env.ANDROID_SERIAL ?? (emulators.length === 1 ? emulators[0] : undefined);
if (!emulators.includes(serial)) skip("Start one disposable emulator or select it with ANDROID_SERIAL.");
const device = (...args) => run("-s", serial, ...args);
const shell = (...args) => device("shell", ...args);
const settings = (name) => shell("settings", "get", "global", name);
const dumpPath = `/data/local/tmp/luyen-jlpt-smoke-${process.pid}.xml`;

function uiDump() {
  shell("uiautomator", "dump", dumpPath);
  return device("exec-out", "cat", dumpPath);
}

function tapNode(xml, predicate) {
  for (const node of xml.match(/<node\b[^>]+>/g) ?? []) {
    if (!predicate(node)) continue;
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if (!bounds) continue;
    const [left, top, right, bottom] = bounds.slice(1).map(Number);
    if (left >= right || top >= bottom) continue;
    shell("input", "tap", String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2)));
    return;
  }
}

async function waitForUi(predicate, description) {
  let snapshot = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    snapshot = uiDump();
    if (predicate(snapshot)) return;
    await delay(500);
  }
  const labels = [...snapshot.matchAll(/(?:text|content-desc)="([^"]+)"/g)]
    .map((match) => match[1])
    .slice(0, 30);
  throw new Error(`Did not find ${description} in the offline app UI. Labels: ${labels.join(" | ")}`);
}

const installed = shell("pm", "list", "packages", id).split(/\r?\n/);
assert(!installed.includes(`package:${id}`), "Use a clean emulator; refusing to replace or clear an installed app.");
const originalAirplane = settings("airplane_mode_on");
const originalWifi = settings("wifi_on");
assert.match(originalAirplane, /^[01]$/);
assert.match(originalWifi, /^[012]$/);
const [card] = JSON.parse(readFileSync(new URL("../../infra/content/n4/vocabulary.json", import.meta.url), "utf8"));
assert(card?.word, "Missing the first N4 vocabulary card in the dataset");

assert.match(device("install", apk), /Success/);
try {
  shell("cmd", "connectivity", "airplane-mode", "enable");
  shell("svc", "wifi", "disable");
  assert.equal(settings("airplane_mode_on"), "1");
  assert.equal(settings("wifi_on"), "0");
  shell("am", "start", "-W", "-n", `${id}/.MainActivity`);
  await waitForUi((xml) => {
    if (xml.includes("Từ vựng Minna no Nihongo")) return true;
    tapNode(xml, (node) => /(?:text|content-desc)="Bắt đầu học"/.test(node));
    return false;
  }, "the N4 vocabulary heading after tapping Bắt đầu học");
  const dimensions = [...shell("wm", "size").matchAll(/(\d+)x(\d+)/g)].at(-1);
  assert(dimensions, "Could not determine the emulator screen size");
  const [, width, height] = dimensions.map(Number);
  const center = String(Math.floor(width / 2));
  if (!uiDump().includes(card.word)) {
    shell("input", "swipe", center, String(Math.floor(height * 0.8)), center, String(Math.floor(height * 0.35)), "400");
    await waitForUi((xml) => xml.includes(card.word), `the first N4 card (${card.word})`);
  }
  console.log(`PASS Android offline smoke: fresh install loaded the N4 card ${card.word} in airplane mode.`);
} finally {
  const cleanup = [
    () => shell("cmd", "connectivity", "airplane-mode", originalAirplane === "1" ? "enable" : "disable"),
    () => shell("svc", "wifi", originalWifi === "0" ? "disable" : "enable"),
    () => shell("rm", "-f", dumpPath),
    () => device("uninstall", id),
  ];
  for (const action of cleanup) {
    try {
      action();
    } catch (error) {
      console.error(`Emulator cleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

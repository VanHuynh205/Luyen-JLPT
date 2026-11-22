import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { createServer, get } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "win32");
assert.equal(process.argv.length, 3, "Pass a cache run path from updater-build.ps1");
const cache = await realpath(fileURLToPath(new URL("../../.cache/epic3-updater/", import.meta.url)));
const run = await realpath(resolve(process.argv[2]));
const tag = basename(run);
assert.equal(dirname(run), cache);
assert.match(tag, /^[a-f0-9]{10}$/);
const { product, binary, port, debuggerPort, endpoint } = JSON.parse(await readFile(join(run, "manifest.json"), "utf8"));
assert.equal(product, `Luyen JLPT Updater Smoke ${tag}`);
assert.equal(binary, `luyen-updater-smoke-${tag}`);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65534);
assert.equal(debuggerPort, port + 1);
const host = "127.0.0.1";
const origin = `http://${host}:${port}`;
const page = `/${tag}/latest.json`;
assert.equal(endpoint, `${origin}${page}`);

const [initial, updated, mismatch] = ["0.1.0", "0.1.1", "0.1.2"];
const baselineInstaller = join(run, `${initial}-setup.exe`);
const updateInstaller = join(run, `${updated}-setup.exe`);
const signature = (await readFile(`${updateInstaller}.sig`, "utf8")).trim();
assert.match(Buffer.from(signature, "base64").toString(), /\tversion:0\.1\.1(?:\s|$)/);
const installDir = join(run, "installed");
const app = join(installDir, `${binary}.exe`);
const uninstaller = join(installDir, "uninstall.exe");
const profile = join(run, "webview2-profile");
await assert.rejects(access(profile), { code: "ENOENT" });
await mkdir(profile);
await assert.rejects(access(installDir), { code: "ENOENT" });
await assert.rejects(access(join(run, "app-data")), { code: "ENOENT" });
const environment = {
  ...process.env,
  TMP: join(run, "tmp"), TEMP: join(run, "tmp"),
  NO_PROXY: "127.0.0.1,localhost",
  WEBVIEW2_USER_DATA_FOLDER: profile,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [
    `--remote-debugging-port=${debuggerPort}`,
    `--remote-debugging-address=${host}`,
    "--proxy-server=127.0.0.1:9",
    "--proxy-bypass-list=<-loopback>;tauri.localhost;ipc.localhost",
  ].join(" "),
  UPDATER_SMOKE_APP: app,
  UPDATER_SMOKE_NAME: binary,
  UPDATER_SMOKE_PRODUCT: product,
  UPDATER_SMOKE_UNINSTALL: uninstaller,
};

const download = `/${tag}/update.exe`;
const bytes = (await stat(updateInstaller)).size;
const requests = [];
let announcedVersion = mismatch;
const feed = createServer((request, response) => {
  if (request.socket.remoteAddress !== host || request.headers.host !== `${host}:${port}` || request.method !== "GET") {
    response.writeHead(403).end();
  } else if (request.url === page) {
    requests.push(`${announcedVersion} manifest`);
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ version: announcedVersion, url: `${origin}${download}`, signature }));
  } else if (request.url === download) {
    const servedFor = announcedVersion;
    response.writeHead(200, { "content-type": "application/octet-stream", "content-length": bytes });
    const artifact = createReadStream(updateInstaller);
    let streamed = 0;
    artifact.on("data", (chunk) => {
      streamed += chunk.length;
      if (streamed === bytes) requests.push(`${servedFor} artifact ${bytes} bytes`);
    });
    artifact.on("error", (error) => response.destroy(error)).pipe(response);
  } else {
    response.writeHead(404).end();
  }
});

function powershell(script) {
  return execFileSync("pwsh.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference = 'Stop'; ${script}`], {
    env: environment, encoding: "utf8", windowsHide: true, timeout: 120_000,
  }).trim();
}

const uninstallKey = String.raw`Software\Microsoft\Windows\CurrentVersion\Uninstall`;
const publisherKey = `Software\\UpdaterSmoke-${tag}`;
const assertAbsent = String.raw`
foreach ($view in @('Registry64', 'Registry32')) {
  foreach ($hive in @('CurrentUser', 'LocalMachine', 'ClassesRoot')) {
    $root = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $scheme = if ($hive -eq 'ClassesRoot') { 'luyenjlpt' } else { 'Software\Classes\luyenjlpt' }
    if ($root.OpenSubKey($scheme)) { throw "Existing luyenjlpt protocol: $hive $view" }
    if ($hive -ne 'ClassesRoot' -and $root.OpenSubKey('${uninstallKey}\' + $env:UPDATER_SMOKE_PRODUCT)) {
      throw "Existing smoke installation: $hive $view"
    }
    if ($hive -ne 'ClassesRoot' -and $root.OpenSubKey('${publisherKey}')) { throw "Existing smoke publisher: $hive $view" }
  }
}`;
const scopedProcesses = `Get-Process -Name $env:UPDATER_SMOKE_NAME -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $env:UPDATER_SMOKE_APP }`;

async function verifyInstalled(version) {
  const actualHash = createHash("sha256").update(await readFile(app)).digest("hex");
  const metadata = JSON.parse(powershell(String.raw`
    $file = Get-Item -LiteralPath $env:UPDATER_SMOKE_APP
    $install = Get-ItemProperty -LiteralPath (Join-Path HKCU: '${uninstallKey}\' | Join-Path -ChildPath $env:UPDATER_SMOKE_PRODUCT)
    if ($install.InstallLocation.Trim('"') -ne (Split-Path $env:UPDATER_SMOKE_APP)) { throw 'Unexpected InstallLocation' }
    @{ fileVersion = $file.VersionInfo.ProductVersion; displayVersion = $install.DisplayVersion } | ConvertTo-Json -Compress
  `));
  assert.equal(metadata.fileVersion, version, "Installed executable product version");
  assert.equal(metadata.displayVersion, version, "Per-user NSIS DisplayVersion");
  return actualHash;
}

async function until(description, probe, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await delay(250);
  }
  assert.fail(`Timed out waiting for ${description}; feed: ${JSON.stringify(requests)}`);
}

async function listen(server, listenPort) {
  server.listen(listenPort, host);
  await once(server, "listening");
  return server.address().port;
}

async function evaluate(expression) {
  const targets = await new Promise((resolve, reject) => {
    get({ host, port: debuggerPort, path: "/json/list", signal: AbortSignal.timeout(1500) }, async (response) => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve(JSON.parse(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    }).once("error", reject);
  });
  const target = targets.find(({ type, url }) => type === "page" && /^https?:\/\/tauri\.localhost\//.test(url));
  if (!target) return undefined;
  const debugUrl = new URL(target.webSocketDebuggerUrl);
  assert.equal(debugUrl.origin, `ws://${host}:${debuggerPort}`);
  const socket = new WebSocket(debugUrl);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP evaluation timed out")), 2500);
      socket.addEventListener("open", () => socket.send(JSON.stringify({
        id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true },
      })), { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connection failed")); }, { once: true });
      socket.addEventListener("message", ({ data }) => {
        const message = JSON.parse(data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message)));
        else resolve(message.result.result.value);
      });
    });
  } finally {
    socket.close();
  }
}

const home = "[data-ocid='home.hero.primary_button']";
const guest = "[data-ocid='auth.button']";
const windowState = `(async () => ({
  version: await window.__TAURI_INTERNALS__?.invoke('plugin:app|version'),
  home: !!document.querySelector(${JSON.stringify(home)}),
  auth: document.querySelector(${JSON.stringify(guest)})?.innerText.trim(),
}))()`;
const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const clickUpdate = (version) => `(() => {
  const toast = [...document.querySelectorAll('[data-sonner-toast]')].find((item) => item.innerText.includes(${JSON.stringify("Có bản Windows " + version)}));
  const button = [...(toast?.querySelectorAll('button') ?? [])].find((item) => item.innerText.trim() === 'Cài cập nhật');
  button?.click();
  return !!button;
})()`;

async function waitForGuest(version, timeout, child) {
  let state;
  try {
    return await until(`guest ${version} home UI`, async () => {
      if (child && child.exitCode !== null) throw new Error(`App exited before opening the WebView: ${child.exitCode}`);
      try {
        state = await evaluate(windowState);
        return state?.version === version && state.home && state.auth === "Đăng nhập" && state;
      } catch (error) {
        state = { error: String(error) };
        return false;
      }
    }, timeout);
  } catch (error) {
    throw new Error(`${error.message}; last WebView: ${JSON.stringify(state)}`, { cause: error });
  }
}

async function openApp() {
  const child = spawn(app, [], { env: environment, stdio: ["ignore", "inherit", "inherit"], windowsHide: true });
  await once(child, "spawn");
  return child;
}

let installStarted = false;
try {
  await listen(feed, port);
  const probeServer = createServer();
  await listen(probeServer, debuggerPort);
  await new Promise((done) => probeServer.close(done));
  const runtime = powershell(String.raw`${assertAbsent}
    $version = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}').pv
    if (!$version) { throw 'This smoke requires an existing machine WebView2 runtime' }
    $version
  `);
  console.log(`Preflight: luyenjlpt absent in HKCU/HKLM/HKCR (both views); WebView2 ${runtime}; feed ${endpoint}.`);
  await mkdir(installDir);
  installStarted = true;
  const install = spawn(baselineInstaller, ["/S", "/NS", `/D=${installDir}`], {
    env: environment, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: true,
  });
  assert.equal((await once(install, "exit"))[0], 0, "Guest baseline NSIS install");
  const initialHash = await verifyInstalled(initial);
  const first = await openApp();
  console.log("Baseline:", { pid: first.pid, sha256: initialHash, ...(await waitForGuest(initial, 30_000, first)) });

  await until("mismatched 0.1.2 update offer", () => evaluate(hasText(`Có bản Windows ${mismatch}`)));
  assert.ok(await evaluate(clickUpdate(mismatch)), "Click the actual updater action");
  await until("signed-version mismatch rejection in the UI", () => evaluate(hasText("Không cài được bản cập nhật.")), 120_000);
  assert.ok(requests.includes(`${mismatch} artifact ${bytes} bytes`), "Mismatched artifact must be downloaded");
  assert.equal(await verifyInstalled(initial), initialHash);
  assert.equal(first.exitCode, null, "Rejected update must not exit the baseline");
  console.log("Negative control: announced 0.1.2 / signed 0.1.1 rejected after full download; v0.1.0 unchanged.");

  announcedVersion = updated;
  await evaluate("window.dispatchEvent(new Event('online'))");
  await until("valid 0.1.1 update offer", () => evaluate(hasText(`Có bản Windows ${updated}`)));
  assert.ok(await evaluate(clickUpdate(updated)), "Click the actual updater action");
  await until("original app exits for NSIS update", () => first.exitCode === 0, 120_000);
  await until("updated executable and NSIS registry version", async () => {
    try { return await verifyInstalled(updated); } catch { return false; }
  }, 120_000);
  const updatedHash = await verifyInstalled(updated);
  assert.notEqual(updatedHash, initialHash);
  assert.ok(requests.includes(`${updated} artifact ${bytes} bytes`), "Matching artifact must be downloaded");
  const updatedWindow = await waitForGuest(updated, 45_000);
  const pid = powershell(`@(${scopedProcesses}).Id`);
  assert.match(pid, /^\d+$/);
  assert.notEqual(Number(pid), first.pid);
  console.log("Updated and relaunched:", { pid: Number(pid), sha256: updatedHash, ...updatedWindow });
  await evaluate(`document.querySelector(${JSON.stringify(home)}).click()`);
  await until("bundled Japanese flashcard after update", () => evaluate(`!!document.querySelector('[data-ocid="flashcard.card"] [lang="ja"]')?.innerText.trim()`));
  console.log("Updated guest opened a bundled N4 flashcard.");
} finally {
  console.log("Loopback requests:", requests);
  feed.closeAllConnections();
  await new Promise((done) => feed.close(done));
  if (installStarted) {
    powershell(String.raw`
      @(${scopedProcesses}) | ForEach-Object { $_.Kill(); $_.WaitForExit() }
      if (Test-Path -LiteralPath $env:UPDATER_SMOKE_UNINSTALL) {
        $process = Start-Process -FilePath $env:UPDATER_SMOKE_UNINSTALL -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -ne 0) { throw "Test uninstaller exited $($process.ExitCode)" }
      }
      foreach ($view in @('Registry64', 'Registry32')) {
        $root = [Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser', $view)
        $publisher = $root.OpenSubKey('${publisherKey}', $true)
        if (!$publisher) { continue }
        $registration = $publisher.OpenSubKey($env:UPDATER_SMOKE_PRODUCT)
        if ($registration) {
          if ($registration.GetValue('') -ne (Split-Path $env:UPDATER_SMOKE_APP) -or $registration.SubKeyCount) { throw 'Unexpected smoke publisher registration' }
          $registration.Dispose()
          $publisher.DeleteSubKey($env:UPDATER_SMOKE_PRODUCT)
        }
        if ($publisher.SubKeyCount -or $publisher.ValueCount) { throw 'Unexpected smoke publisher contents' }
        $publisher.Dispose()
        $root.DeleteSubKey('${publisherKey}')
      }
      ${assertAbsent}
    `);
    await assert.rejects(access(app), { code: "ENOENT" });
    console.log("Cleanup: test executable and uninstall registration removed; luyenjlpt still absent.");
  }
}

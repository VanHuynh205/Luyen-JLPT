import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [argument, app] = process.argv.slice(2);
assert.equal(process.platform, "win32", "Desktop smoke requires Windows");
assert.ok(
  argument === "--app" && app && isAbsolute(app) && /\.exe$/i.test(app),
  "Pass --app <absolute path to the installed application exe, not the installer>",
);
assert.ok((await stat(app)).isFile(), "The application exe must exist");

const port = Number(process.env.TAURI_DRIVER_PORT ?? 4444);
const nativePort = Number(process.env.TAURI_NATIVE_DRIVER_PORT ?? 4445);
const coldLink = "luyenjlpt://auth-callback?error=access_denied";
const warmLink =
  "luyenjlpt://auth-callback?code=desktop-smoke-invalid&sb_flow_id=00000000000000000000000000000000";
const invalidLinkToast = "Liên kết tài khoản không hợp lệ hoặc đã hết hạn.";
const flashcard = '[data-ocid="flashcard.card"]';
const tempRoot = await realpath(tmpdir());
const profilePrefix = "luyen-jlpt-smoke-";
const profile = await mkdtemp(join(tempRoot, profilePrefix));
const offlineArguments =
  "--proxy-server=127.0.0.1:9 --proxy-bypass-list=<-loopback>;tauri.localhost;ipc.localhost";
const driver = spawn(
  "tauri-driver",
  ["--port", String(port), "--native-port", String(nativePort)],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: join(profile, "webdriver"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: offlineArguments,
    },
  },
);
let driverFailure;
driver.on("error", (error) => {
  driverFailure = error;
});
let sessionPath;

async function request(path, method, data, timeout = 10_000) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    ...(data === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        }),
    signal: AbortSignal.timeout(timeout),
  });
  const result = await response.json();
  assert.ok(
    response.ok && !result.value?.error,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return result.value;
}

async function until(description, probe, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await delay(150);
  }
  assert.fail(`Timed out waiting for ${description}`);
}

function evaluate(script, args = []) {
  return request(`${sessionPath}/execute/sync`, "POST", { script, args });
}

async function startSession(alwaysMatch) {
  const session = await request(
    "/session",
    "POST",
    {
      capabilities: { alwaysMatch },
    },
    60_000,
  );
  assert.ok(session.sessionId, "WebDriver must return a session ID");
  sessionPath = `/session/${session.sessionId}`;
}

async function testColdLaunch() {
  const coldProfile = join(profile, "cold");
  const portFile = join(coldProfile, "EBWebView", "DevToolsActivePort");
  const cold = spawn(app, [coldLink], {
    windowsHide: true,
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: coldProfile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${offlineArguments} --remote-debugging-address=127.0.0.1 --remote-debugging-port=0`,
    },
  });
  await once(cold, "spawn");
  let phase = "reading the WebView2 port file";
  try {
    const debuggerAddress = await until("WebView2 debugger", async () => {
      assert.equal(cold.exitCode, null, "Cold launch exited during startup");
      try {
        const [portText] = (await readFile(portFile, "utf8")).split(/\r?\n/);
        const debuggerPort = Number(portText);
        if (!/^\d{1,5}$/.test(portText) || debuggerPort < 1 || debuggerPort > 65535) {
          return false;
        }
        phase = "connecting to the loopback debugger";
        const response = await fetch(
          `http://127.0.0.1:${debuggerPort}/json/list`,
          {
            signal: AbortSignal.timeout(1_000),
          },
        );
        phase = "finding the bundled app target";
        return (
          response.ok &&
          (await response.json()).some(
            ({ type, url }) => type === "page" && url.startsWith("http://tauri.localhost/"),
          ) &&
          `127.0.0.1:${debuggerPort}`
        );
      } catch {
        return false;
      }
    }, 60_000);
    phase = "opening the debugger session";
    await startSession({
      browserName: "webview2",
      "ms:edgeOptions": { debuggerAddress },
    });
    phase = "checking the cold callback";
    await waitForCallback("cold launch");
  } catch (error) {
    throw new Error(`Cold launch failed while ${phase}.`, { cause: error });
  } finally {
    try {
      await endSession();
    } finally {
      if (cold.exitCode === null && cold.signalCode === null) {
        const done = once(cold, "exit");
        cold.kill();
        await done;
      }
    }
  }
}

async function endSession() {
  if (!sessionPath) return;
  await request(sessionPath, "DELETE");
  sessionPath = undefined;
}

async function click(selector) {
  const elementKey = "element-6066-11e4-a52e-4f735466cecf";
  const element = await request(`${sessionPath}/element`, "POST", {
    using: "css selector",
    value: selector,
  });
  assert.ok(element[elementKey], `No WebDriver element for ${selector}`);
  await request(
    `${sessionPath}/element/${element[elementKey]}/click`,
    "POST",
    {},
  );
}

async function waitForCallback(phase) {
  try {
    await until(`${phase} callback route, heading and error toast`, () =>
      evaluate(
        `return location.hash === '#/tai-khoan'
        && [...document.querySelectorAll('h1, h2, [role="heading"]')]
          .some((heading) => heading.innerText.trim() === 'Tài khoản')
        && [...document.querySelectorAll('[data-sonner-toast] [data-title]')]
          .some((toast) => toast.innerText.trim() === arguments[0]);`,
        [invalidLinkToast],
      ),
    );
  } catch (error) {
    const page = await evaluate(
      `return { hash: location.hash, text: document.body.innerText.slice(0, 500), tauri: !!window.isTauri };`,
    );
    throw new Error(
      `${phase} callback did not finish: ${JSON.stringify(page)}`,
      { cause: error },
    );
  }
}

try {
  await until("tauri-driver and Edge WebDriver", async () => {
    if (driverFailure) throw driverFailure;
    assert.equal(driver.exitCode, null, "tauri-driver stopped during startup");
    try {
      return (await request("/status", "GET", undefined, 1_000)).ready;
    } catch {
      return false;
    }
  });

  await testColdLaunch();
  await startSession({ "tauri:options": { application: app } });
  const startLearning = '[data-ocid="home.hero.primary_button"]';
  await until("home navigation", () =>
    evaluate("return !!document.querySelector(arguments[0]);", [startLearning]),
  );
  await click(startLearning);
  try {
    await until("first bundled N4 flashcard", () =>
      evaluate(
        `const word = document.querySelector(arguments[0] + ' [lang="ja"]');
         return !!word?.innerText.trim() && !!document.querySelector('[data-ocid="vocabulary.page"]');`,
        [flashcard],
      ),
    );
  } catch (error) {
    const page = await evaluate(
      `return { hash: location.hash, text: document.body.innerText.slice(0, 700) };`,
    );
    throw new Error(`N4 flashcard did not load: ${JSON.stringify(page)}`, {
      cause: error,
    });
  }
  await click(flashcard);
  await until("flipped flashcard", () =>
    evaluate(
      "return document.querySelector(arguments[0])?.getAttribute('aria-pressed') === 'true';",
      [flashcard],
    ),
  );
  await click('[data-ocid="vocabulary.mark_known_button"]');
  const known = () =>
    evaluate(`
    return [...document.querySelectorAll('[data-ocid="flashcard.status_badge"]')]
      .some((badge) => badge.innerText.trim() === 'Đã thuộc');
  `);
  await until("locally saved flashcard", known);
  await request(`${sessionPath}/refresh`, "POST", {});
  await until("flashcard progress after offline reload", known);

  const protocol = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Start-Process -FilePath $env:DESKTOP_SMOKE_LINK -WindowStyle Hidden -ErrorAction Stop",
    ],
    {
      env: { ...process.env, DESKTOP_SMOKE_LINK: warmLink },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  assert.equal(
    (await once(protocol, "close"))[0],
    0,
    "Windows could not open the registered protocol",
  );
  await waitForCallback("warm launch");
  console.log(
    "Desktop smoke passed: cold and warm auth callbacks, offline N4 flashcard and local progress.",
  );
} finally {
  try {
    await endSession();
  } finally {
    if (driver.pid && driver.exitCode === null) {
      const cleanup = spawn(
        "taskkill.exe",
        ["/pid", String(driver.pid), "/t", "/f"],
        { stdio: "ignore", windowsHide: true },
      );
      await once(cleanup, "close");
    }
    const cleanupPath = await realpath(profile);
    assert.equal(dirname(cleanupPath), tempRoot);
    assert.ok(basename(cleanupPath).startsWith(profilePrefix));
    await rm(cleanupPath, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 200,
    });
  }
}

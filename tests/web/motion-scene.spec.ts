import { type Page, expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
  reducedMotion: "no-preference",
});
test.describe.configure({ mode: "default", timeout: 45_000 });

const sceneScript = /\/(?:scene-three|DeskHeroCanvas)-[^/]+\.js$/;
const fallback = 'svg:has([id="desk-wood-surface"])';
const fallbackLayer = (page: Page) => page.locator(fallback).locator("xpath=../..");

async function trackWebGLProbes(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: unknown,
    ) {
      if (kind === "webgl" || kind === "webgl2") {
        document.documentElement.dataset.webglRequested = "true";
      }
      return Reflect.apply(original, this, [kind, options]);
    };
  });
}

test("a study route loads without requesting the optional 3D bundle", async ({
  page,
}) => {
  await trackWebGLProbes(page);
  const sceneRequests: string[] = [];
  await page.route(sceneScript, (route) => {
    sceneRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto("/tu-vung");
  await expect(page.getByRole("button", { name: /Nhấn để lật/ })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-webgl-requested",
    "true",
  );
  expect(sceneRequests).toEqual([]);
});

test("OS reduced motion overrides saved full effects and restores the scene when cleared", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trackWebGLProbes(page);
  await page.addInitScript(() =>
    localStorage.setItem("jlpt:motionPreference", "full"),
  );
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (sceneScript.test(request.url())) sceneRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\breduce-motion\b/);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(fallbackLayer(page)).toHaveCSS("opacity", "1");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-webgl-requested",
    "true",
  );
  expect(sceneRequests).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(fallbackLayer(page)).toHaveCSS("opacity", "0", { timeout: 15_000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toHaveCount(0);
});

for (const failure of ["webgl1-only", "renderer-init"] as const) {
  test(`${failure} keeps the SVG fallback and study link without page errors`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript((failure) => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        options?: unknown,
      ) {
        if (
          kind === "webgl2" &&
          (failure === "webgl1-only" || this.isConnected)
        ) {
          document.documentElement.dataset.webgl2Refused = "true";
          return null;
        }
        return Reflect.apply(original, this, [kind, options]);
      };
    }, failure);

    await page.goto("/");
    const studyLink = page.getByRole("link", { name: "Bắt đầu học" });
    await expect(studyLink).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("html")).toHaveAttribute(
      "data-webgl2-refused",
      "true",
      { timeout: 15_000 },
    );
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(fallback)).toBeVisible();
    await page.getByRole("link", { name: "Đăng nhập" }).first().click();
    await expect(
      page.getByText("Thiết bị đang dùng ảnh tĩnh", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ôn JLPT" }).click();
    await studyLink.click();
    await expect(page.getByRole("button", { name: /Nhấn để lật/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test("losing a live WebGL2 context restores the fallback and preserves navigation", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  const backdrop = fallbackLayer(page);
  await expect(backdrop).toHaveCSS("opacity", "0", { timeout: 15_000 });

  const lost = await canvas.evaluate((element: HTMLCanvasElement) => {
    const extension = element
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(lost).toBe(true);
  await expect(canvas).toHaveCount(0);
  await expect(backdrop).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Bắt đầu học" }).click();
  await expect(page.getByRole("button", { name: /Nhấn để lật/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("sustained slow active frames switch the scene to the static fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      requestFrame((time) => {
        if (document.documentElement.dataset.slowFrames === "true") {
          window.setTimeout(() => callback(performance.now()), 310);
        } else {
          callback(time);
        }
      });
  });
  await page.goto("/");
  await expect(fallbackLayer(page)).toHaveCSS("opacity", "0", { timeout: 15_000 });

  await page.evaluate(() => {
    document.documentElement.dataset.slowFrames = "true";
    let right = false;
    const pointer = window.setInterval(() => {
      if (!document.querySelector("canvas")) {
        window.clearInterval(pointer);
        return;
      }
      right = !right;
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          clientX: right ? window.innerWidth : 0,
        }),
      );
    }, 350);
  });

  await expect(page.locator("canvas")).toHaveCount(0, { timeout: 15_000 });
  await expect(fallbackLayer(page)).toHaveCSS("opacity", "1");
});

test("the mobile drawer does not slide when app effects are off", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem("jlpt:motionPreference", "reduced"),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\breduce-motion\b/);
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("animation-name", "none");
});

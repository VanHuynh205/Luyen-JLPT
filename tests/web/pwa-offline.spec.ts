import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test.describe("Web PWA offline & NetworkOnly Supabase boundary", () => {
  test("registers SW, serves valid manifest & icons, enforces NetworkOnly for supabase.co (SEC-T03), preserves /tai-khoan/?code=abc, and loads /tu-vung & / offline", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required");
    const appOrigin = new URL(baseURL).origin;
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    let sawSupabaseThroughSw = false;
    await context.route("https://demo.supabase.co/**", async (route) => {
      if (route.request().serviceWorker()) {
        sawSupabaseThroughSw = true;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
        body: JSON.stringify({ access_token: "secret", token_type: "bearer" }),
      });
    });

    const seenInitialSearches: string[] = [];
    await page.addInitScript(() => {
      (
        window as unknown as { __initialLocationSearch?: string }
      ).__initialLocationSearch = window.location.search;
    });

    await page.goto("/");
    await expect(page.locator('[data-ocid="home.page"]')).toBeVisible();

    await page.waitForFunction(() =>
      navigator.serviceWorker.ready.then(() =>
        Boolean(navigator.serviceWorker.controller),
      ),
    );

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(manifestHref).toBeTruthy();

    const appleTouchHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute("href");
    expect(appleTouchHref).toBe("/icons/pwa-192.png");

    const themeColorCount = await page
      .locator('meta[name="theme-color"]')
      .count();
    expect(themeColorCount).toBeGreaterThanOrEqual(1);

    const manifestRes = await page.request.get(
      new URL(manifestHref!, appOrigin).href,
    );
    expect(manifestRes.status()).toBe(200);
    const manifest = (await manifestRes.json()) as {
      name: string;
      short_name: string;
      lang: string;
      start_url: string;
      scope: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type?: string }>;
    };
    expect(manifest.name).toBe("Ôn JLPT N4");
    expect(manifest.short_name).toBe("Ôn JLPT");
    expect(manifest.lang).toBe("vi");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#F9F6F1");
    expect(manifest.theme_color).toBe("#F9F6F1");
    expect(
      manifest.icons.some(
        (icon) => icon.src === "/icons/pwa-192.png" && icon.sizes === "192x192",
      ),
    ).toBe(true);
    expect(
      manifest.icons.some(
        (icon) => icon.src === "/icons/pwa-512.png" && icon.sizes === "512x512",
      ),
    ).toBe(true);

    for (const iconPath of ["/icons/pwa-192.png", "/icons/pwa-512.png"]) {
      const res = await page.request.get(`${appOrigin}${iconPath}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    }

    // SEC-T03: trigger supabase.co auth/rest/signed-storage fetches through SW and verify zero supabase entries in Cache Storage.
    const supabaseStatuses = await page.evaluate(async () => {
      const tokenRes = await fetch("https://demo.supabase.co/auth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "password" }),
      });
      const restRes = await fetch(
        "https://demo.supabase.co/rest/v1/card_status?select=*",
      );
      const signedRes = await fetch(
        "https://demo.supabase.co/storage/v1/object/sign/audio-packs/n4.opus?token=secret",
      );
      return [tokenRes.status, restRes.status, signedRes.status];
    });
    expect(supabaseStatuses).toEqual([200, 200, 200]);
    expect(sawSupabaseThroughSw).toBe(true);

    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) urls.push(req.url);
      }
      return urls;
    });
    expect(cachedUrls.length).toBeGreaterThan(0);
    expect(cachedUrls.some((u) => u.includes("supabase.co"))).toBe(false);
    expect(cachedUrls.some((u) => u.includes("/packs/index.json"))).toBe(true);
    expect(
      cachedUrls.some((u) => u.includes("/packs/n4/1.1.0/vocabulary.json")),
    ).toBe(true);

    // Review Focus #4: /tai-khoan/?code=abc preserves query param through SW navigation fallback.
    await page.goto("/tai-khoan/?code=abc");
    await expect(page.locator('[data-ocid="account.page"]')).toBeVisible();
    const initialSearch = await page.evaluate(
      () =>
        (window as unknown as { __initialLocationSearch?: string })
          .__initialLocationSearch ?? "",
    );
    seenInitialSearches.push(initialSearch);
    expect(new URLSearchParams(seenInitialSearches[0]).get("code")).toBe("abc");
    if (!process.env.VITE_SUPABASE_URL) {
      expect(new URL(page.url()).searchParams.get("code")).toBe("abc");
    }

    // Cold offline navigations in a fresh tab to /tu-vung and / must succeed via SW precache & IndexedDB.
    await context.setOffline(true);
    await page.close();
    const offlinePage = await context.newPage();
    offlinePage.on("pageerror", (error) =>
      errors.push(`offline pageerror: ${error.message}`),
    );
    offlinePage.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`offline console: ${msg.text()}`);
    });

    await offlinePage.goto("/tu-vung");
    await expect(
      offlinePage.locator('[data-ocid="vocabulary.page"]'),
    ).toBeVisible();
    await expect(
      offlinePage.locator('[data-ocid="vocabulary.position"]'),
    ).toHaveText("1 / 1182");

    await offlinePage.goto("/");
    await expect(offlinePage.locator('[data-ocid="home.page"]')).toBeVisible();
    await expect(offlinePage.locator("h1")).toContainText("Chinh phục JLPT N4");

    expect(errors).toEqual([]);
  });
});

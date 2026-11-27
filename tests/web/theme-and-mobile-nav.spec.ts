import { expect, test } from "./fixtures";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

test.describe("Sumi dark mode & 5-tab mobile navigation", () => {
  test("loads theme-init.js without inline scripts or CSP violations", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations =
        violations;
      document.addEventListener("securitypolicyviolation", (event) => {
        violations.push(`${event.violatedDirective}:${event.blockedURI}`);
      });
    });

    const themeScriptRes = page.waitForResponse(
      (res) => res.url().endsWith("/theme-init.js") && res.status() === 200,
    );
    await page.goto("/");
    await themeScriptRes;

    const inlineScripts = await page.evaluate(
      () => document.querySelectorAll("script:not([src])").length,
    );
    expect(inlineScripts).toBe(0);

    const scriptOrderValid = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]")).map(
        (el) => el.getAttribute("src") ?? "",
      );
      const initIdx = scripts.findIndex((src) => src.endsWith("/theme-init.js"));
      const appIdx = scripts.findIndex((src) => src.includes("/assets/index-"));
      return initIdx >= 0 && (appIdx === -1 || initIdx < appIdx);
    });
    expect(scriptOrderValid).toBe(true);

    const cspViolations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(cspViolations).toEqual([]);
    expect(await page.locator(".hanko").count()).toBeLessThanOrEqual(1);
  });

  test("toggles Light, Sumi dark, and System theme with reload persistence and dark hero fallback", async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: "light",
      reducedMotion: "reduce",
    });

    await page.goto("/tai-khoan");
    const lightBtn = page.locator('[data-ocid="account.theme.light.button"]');
    const darkBtn = page.locator('[data-ocid="account.theme.dark.button"]');
    const systemBtn = page.locator('[data-ocid="account.theme.system.button"]');

    await expect(lightBtn).toBeVisible();
    await expect(darkBtn).toBeVisible();
    await expect(systemBtn).toBeVisible();
    await expect(systemBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

    for (const btn of [lightBtn, darkBtn, systemBtn]) {
      const box = await btn.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    // Switch to Tối (Sumi đêm).
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false");
    await expect(systemBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const storedDark = await page.evaluate(() =>
      localStorage.getItem("luyen-jlpt:theme"),
    );
    expect(storedDark).toBe("dark");

    const darkBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(darkBg).not.toBe("rgb(0, 0, 0)");

    // Persistence across full page reload (theme-init.js + localStorage + db.settings).
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");

    // Verify home hero scene renders Sumi dark SVG palette and <= 1 .hanko seal.
    await page.getByRole("link", { name: "Ôn JLPT" }).click();
    await expect(page.locator('[data-ocid="home.page"]')).toBeVisible();
    const darkScene = page.locator('[data-scene-theme="dark"]');
    await expect(darkScene).toBeVisible();
    const darkWoodStop = await darkScene
      .locator('#desk-wood-surface stop[offset="0.55"]')
      .getAttribute("stop-color");
    expect(darkWoodStop?.toUpperCase()).toBe("#4E3B2B");
    expect(await page.locator(".hanko").count()).toBeLessThanOrEqual(1);

    // Switch back to Sáng and confirm persistence across reload.
    await page.getByRole("link", { name: "Đăng nhập" }).first().click();
    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect(lightBtn).toHaveAttribute("aria-pressed", "true");

    // Switch to Theo hệ thống and confirm live OS color-scheme tracking.
    await systemBtn.click();
    await expect(systemBtn).toHaveAttribute("aria-pressed", "true");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("desktop 1280x800 preserves top NAV_ITEMS and hides mobile bottom bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.locator('[data-ocid="nav.bottom_bar"]')).toBeHidden();
    for (const id of [
      "home",
      "vocabulary",
      "kanji",
      "grammar",
      "reading",
      "exam",
      "progress",
    ]) {
      await expect(page.locator(`[data-ocid="nav.${id}.link"]`)).toBeVisible();
    }
  });

  test("360x800 mobile 5-tab bar reaches /doc-hieu and /luyen-de in <= 2 taps with >= 44px targets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);

    const homeTab = page.locator('[data-ocid="nav.tab.home.link"]');
    const studyTab = page.locator('[data-ocid="nav.tab.study.button"]');
    const examTab = page.locator('[data-ocid="nav.tab.exam.button"]');
    const lookupTab = page.locator('[data-ocid="nav.tab.lookup.link"]');
    const progressTab = page.locator('[data-ocid="nav.tab.progress.link"]');

    for (const tab of [homeTab, studyTab, examTab, lookupTab, progressTab]) {
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(homeTab).toHaveAttribute("aria-current", "page");

    // Open Ôn tập popover -> verify 3 >= 44px links and Escape closes.
    await studyTab.click();
    const studyPopover = page.locator('[data-ocid="nav.tab.study.popover"]');
    await expect(studyPopover).toBeVisible();
    const vocabLink = page.locator(
      '[data-ocid="nav.tab.study.vocabulary.link"]',
    );
    const kanjiLink = page.locator('[data-ocid="nav.tab.study.kanji.link"]');
    const grammarLink = page.locator(
      '[data-ocid="nav.tab.study.grammar.link"]',
    );
    for (const link of [vocabLink, kanjiLink, grammarLink]) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press("Escape");
    await expect(studyPopover).toBeHidden();

    // Re-open Ôn tập and close via outside click.
    await studyTab.click();
    await expect(studyPopover).toBeVisible();
    await page.locator('[data-ocid="nav.tab.popover_backdrop"]').click();
    await expect(studyPopover).toBeHidden();

    // Tap Ôn tập -> Kanji (2 taps) -> popover closes and Ôn tập is active without highlighting Tra cứu.
    await studyTab.click();
    await kanjiLink.click();
    await expect(page).toHaveURL(/\/kanji$/);
    await expect(studyPopover).toBeHidden();
    await expect(studyTab).toHaveAttribute("data-active", "true");
    await expect(lookupTab).not.toHaveAttribute("aria-current", "page");

    // 1 tap to Tra cứu (/kanji/tra-cuu): Tra cứu active, Ôn tập inactive.
    await lookupTab.click();
    await expect(page).toHaveURL(/\/kanji\/tra-cuu$/);
    await expect(lookupTab).toHaveAttribute("aria-current", "page");
    await expect(studyTab).not.toHaveAttribute("data-active", "true");

    // 2 taps to Đề thi JLPT (/luyen-de).
    await examTab.click();
    const examPopover = page.locator('[data-ocid="nav.tab.exam.popover"]');
    await expect(examPopover).toBeVisible();
    const mockExamLink = page.locator('[data-ocid="nav.tab.exam.mock.link"]');
    const readingLink = page.locator(
      '[data-ocid="nav.tab.exam.reading.link"]',
    );
    for (const link of [mockExamLink, readingLink]) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await mockExamLink.click();
    await expect(page).toHaveURL(/\/luyen-de$/);
    await expect(page.locator('[data-ocid="exam_list.page"]')).toBeVisible();
    await expect(examPopover).toBeHidden();
    await expect(examTab).toHaveAttribute("data-active", "true");

    // 2 taps from / to Đọc hiểu (/doc-hieu).
    await homeTab.click();
    await expect(page).toHaveURL(/\/$/);
    await examTab.click();
    await expect(examPopover).toBeVisible();
    await readingLink.click();
    await expect(page).toHaveURL(/\/doc-hieu$/);
    await expect(page.locator('[data-ocid="reading_list.page"]')).toBeVisible();
    await expect(examPopover).toBeHidden();
    await expect(examTab).toHaveAttribute("data-active", "true");

    // 1 tap to Tiến độ (/tien-do).
    await progressTab.click();
    await expect(page).toHaveURL(/\/tien-do$/);
    await expect(progressTab).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});

test.describe("3D desk hero in Sumi dark mode", () => {
  test.use({
    reducedMotion: "no-preference",
  });

  test("renders WebGL2 DeskHeroCanvas cleanly in dark mode without errors", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("luyen-jlpt:theme", "dark");
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const fallbackLayer = page
      .locator('svg:has([id="desk-wood-surface"])')
      .locator("xpath=../..");
    await expect(fallbackLayer).toHaveCSS("opacity", "0", { timeout: 15_000 });
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.locator(".hanko").count()).toBeLessThanOrEqual(1);
  });
});

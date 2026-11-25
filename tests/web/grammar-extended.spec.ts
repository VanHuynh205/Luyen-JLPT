import { expect, test } from "./fixtures";

const EXTENDED_PAGES = [
  {
    path: "/ngu-phap/so-sanh",
    pageId: "grammar_comparisons.page",
    prefix: "grammar_comparisons",
    navId: "comparisons",
    total: 27,
    unit: "bài so sánh",
    query: "ようにする",
    expectedFiltered: 1,
    expectedSnippet: "ようにする／ようになる／なくなる",
  },
  {
    path: "/ngu-phap/cach-chia",
    pageId: "grammar_conjugations.page",
    prefix: "grammar_conjugations",
    navId: "conjugations",
    total: 22,
    unit: "quy tắc",
    query: "て形",
    expectedFiltered: 1,
    expectedSnippet: "Thể て",
  },
  {
    path: "/ngu-phap/kinh-ngu",
    pageId: "grammar_keigo.page",
    prefix: "grammar_keigo",
    navId: "keigo",
    total: 17,
    unit: "mục",
    query: "いらっしゃる",
    expectedFiltered: 3,
    expectedSnippet: "いらっしゃる",
  },
  {
    path: "/ngu-phap/tu-dong-tha-dong",
    pageId: "grammar_verb_pairs.page",
    prefix: "grammar_verb_pairs",
    navId: "verb_pairs",
    total: 12,
    unit: "cặp",
    query: "bật đèn",
    expectedFiltered: 1,
    expectedSnippet: "電気をつける",
  },
] as const;

test("extended grammar pages render exact counts and filter via search", async ({
  page,
}) => {
  for (const entry of EXTENDED_PAGES) {
    await page.goto(entry.path);
    await expect(page.locator(`[data-ocid="${entry.pageId}"]`)).toBeVisible();

    const items = page.locator(`[data-ocid^="${entry.prefix}.item."]`);
    await expect(items).toHaveCount(entry.total);
    await expect(
      page.getByText(`Hiển thị ${entry.total} / ${entry.total} ${entry.unit}`),
    ).toBeVisible();

    await page
      .locator(`[data-ocid="${entry.prefix}.search_input"]`)
      .fill(entry.query);
    await expect(items).toHaveCount(entry.expectedFiltered);
    await expect(
      page.getByText(
        `Hiển thị ${entry.expectedFiltered} / ${entry.total} ${entry.unit}`,
      ),
    ).toBeVisible();
    await expect(items.first()).toContainText(entry.expectedSnippet);

    await page
      .locator(`[data-ocid="${entry.prefix}.search_clear_button"]`)
      .click();
    await expect(items).toHaveCount(entry.total);
  }
});

test("bidirectional links work between grammar patterns and comparisons", async ({
  page,
}) => {
  await page.goto("/ngu-phap/grammar-G001");
  await expect(page.locator("#so-sanh-lien-quan")).toContainText(
    "So sánh liên quan",
  );

  const comparisonLink = page.locator(
    '[data-ocid="grammar_detail.comparisons.list"] a[href="/ngu-phap/so-sanh/comparison-SS001"]',
  );
  await expect(comparisonLink).toBeVisible();
  await comparisonLink.click();

  await expect(page).toHaveURL(/\/ngu-phap\/so-sanh\/comparison-SS001$/);
  await expect(
    page.locator('[data-ocid="grammar_comparison_detail.page"]'),
  ).toBeVisible();

  const backToPattern = page.locator(
    '[data-ocid="grammar_comparison_detail.patterns.list"] a[href="/ngu-phap/grammar-G001"]',
  );
  await expect(backToPattern).toBeVisible();
  await backToPattern.click();

  await expect(page).toHaveURL(/\/ngu-phap\/grammar-G001$/);
  await expect(page.locator('[data-ocid="grammar_detail.page"]')).toBeVisible();
  await expect(page.locator("h1")).toHaveText("～んですか");

  await page.goto("/ngu-phap/so-sanh/comparison-SS014");
  await expect(
    page.locator('[data-ocid="grammar_comparison_detail.page"]'),
  ).toBeVisible();

  const relatedItems = page.locator(
    '[data-ocid^="grammar_comparison_detail.pattern.item."]',
  );
  await expect(relatedItems).toHaveCount(3);
  await relatedItems.first().click();

  await expect(page).toHaveURL(/\/ngu-phap\/grammar-G\d+$/);
  await expect(page.locator('[data-ocid="grammar_detail.page"]')).toBeVisible();
});

test("ReadingDetailPage resets answers and result state on direct client-side passage switch", async ({
  page,
}) => {
  await page.goto("/doc-hieu/reading-01");
  const questions = page.locator(
    '[data-ocid^="reading_detail.question.item."]',
  );
  await expect(questions.first()).toBeVisible();

  for (const question of await questions.all()) {
    await question.locator("label").first().click();
  }
  await page.locator('[data-ocid="reading_detail.submit_button"]').click();
  await expect(
    page.locator('[data-ocid="reading_detail.result.success_state"]'),
  ).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __noReload?: boolean }).__noReload = true;
    window.history.pushState({}, "", "/doc-hieu/reading-02");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page).toHaveURL(/\/doc-hieu\/reading-02$/);
  await expect(page.locator("h1")).toContainText("Thông báo của thư viện");
  expect(
    await page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload,
    ),
  ).toBe(true);

  await expect(
    page.locator('[data-ocid="reading_detail.result.success_state"]'),
  ).toBeHidden();
  const submit = page.locator('[data-ocid="reading_detail.submit_button"]');
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(
    page.getByText("Đã trả lời 0/2 câu — hãy trả lời hết để nộp bài."),
  ).toBeVisible();
});

test("360px mobile layout fits without horizontal overflow and keeps 44px subnav targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });

  for (const entry of EXTENDED_PAGES) {
    await page.goto(entry.path);
    await expect(page.locator(`[data-ocid="${entry.pageId}"]`)).toBeVisible();
    await expect(page.locator("main > div").first()).toHaveCSS(
      "transform",
      "none",
    );

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);

    const subnavLinks = page.locator('[data-ocid="grammar_subnav.nav"] a');
    await expect(subnavLinks).toHaveCount(5);
    for (const link of await subnavLinks.all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.locator(`[data-ocid="grammar_subnav.${entry.navId}.link"]`),
    ).toHaveAttribute("aria-current", "page");
  }
});

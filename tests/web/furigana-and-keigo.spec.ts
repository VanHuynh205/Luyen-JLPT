import { expect, test } from "./fixtures";

test("ReadingDetailPage renders audited furigana by default and persists toggle state", async ({
  page,
}) => {
  await page.goto("/doc-hieu/reading-01");
  const panel = page.locator('[data-ocid="reading_detail.passage.panel"]');
  const furiganaSwitch = page.locator(
    '[data-ocid="reading_detail.furigana.switch"]',
  );

  await expect(panel).toBeVisible();
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "true");

  const rtTags = panel.locator("ruby rt");
  expect(await rtTags.count()).toBeGreaterThan(5);
  await expect(rtTags.first()).toHaveText("たなか");

  await furiganaSwitch.click();
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "false");
  await expect(rtTags).toHaveCount(0);
  await expect(panel).toContainText("田中さんへ");

  await page.reload();
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "false");
  await expect(panel.locator("ruby rt")).toHaveCount(0);

  // Shared per-level preference stays off on GrammarDetailPage as well
  await page.goto("/ngu-phap/grammar-G001");
  const grammarSwitch = page.locator(
    '[data-ocid="grammar_detail.furigana.switch"]',
  );
  await expect(grammarSwitch).toHaveAttribute("aria-checked", "false");
  await expect(
    page.locator('[data-ocid="grammar_detail.examples.list"] ruby rt'),
  ).toHaveCount(0);

  await page.goto("/doc-hieu/reading-01");
  await furiganaSwitch.click();
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "true");
  expect(await panel.locator("ruby rt").count()).toBeGreaterThan(5);
});

test("GrammarDetailPage toggles furigana on examples and preserves 4 core sections without quiz", async ({
  page,
}) => {
  await page.goto("/ngu-phap/grammar-G001");
  await expect(page.locator('[data-ocid="grammar_detail.page"]')).toBeVisible();

  await expect(page.locator("#cach-chia")).toBeVisible();
  await expect(page.locator("#y-nghia")).toBeVisible();
  await expect(page.locator("#cach-dung")).toBeVisible();
  await expect(page.locator("#vi-du")).toBeVisible();
  await expect(
    page.locator('[data-ocid="grammar_detail.practice.section"]'),
  ).toHaveCount(0);

  const examplesList = page.locator(
    '[data-ocid="grammar_detail.examples.list"]',
  );
  const furiganaSwitch = page.locator(
    '[data-ocid="grammar_detail.furigana.switch"]',
  );
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "true");
  await expect(examplesList.locator("ruby rt")).toHaveText(["さいふ"]);

  await furiganaSwitch.click();
  await expect(furiganaSwitch).toHaveAttribute("aria-checked", "false");
  await expect(examplesList.locator("ruby rt")).toHaveCount(0);
  await expect(examplesList).toContainText("財布をなくしたんですか。");
});

test("GrammarKeigoPage marks all non-dash Japanese keigo cells with lang=ja", async ({
  page,
}) => {
  await page.goto("/ngu-phap/kinh-ngu");
  await expect(page.locator('[data-ocid="grammar_keigo.page"]')).toBeVisible();

  const items = page.locator('[data-ocid^="grammar_keigo.item."]');
  await expect(items).toHaveCount(17);

  const valueCells = page.locator(
    '[data-ocid^="grammar_keigo.item."] table tbody tr td:nth-child(2)',
  );
  const cellCount = await valueCells.count();
  expect(cellCount).toBe(17 * 4);

  let checkedKenjogoI = 0;
  let checkedKenjogoII = 0;

  for (let i = 0; i < cellCount; i++) {
    const cell = valueCells.nth(i);
    const text = (await cell.innerText()).trim();
    if (text === "—") continue;
    await expect(cell.locator('[lang="ja"]').first()).toBeVisible();
    if (i % 4 === 1) checkedKenjogoI += 1;
    if (i % 4 === 2) checkedKenjogoII += 1;
  }

  expect(checkedKenjogoI).toBeGreaterThan(0);
  expect(checkedKenjogoII).toBeGreaterThan(0);
});

test("360px mobile layout keeps furigana toggle >= 44px without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });

  await page.goto("/doc-hieu/reading-01");
  await expect(
    page.locator('[data-ocid="reading_detail.passage.panel"]'),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(360);
  expect(
    (
      await page
        .locator('label[for="reading-furigana-switch"]')
        .boundingBox()
    )?.height,
  ).toBeGreaterThanOrEqual(44);

  await page.goto("/ngu-phap/grammar-G001");
  await expect(
    page.locator('[data-ocid="grammar_detail.examples.list"]'),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(360);
  expect(
    (
      await page
        .locator('label[for="grammar-furigana-switch"]')
        .boundingBox()
    )?.height,
  ).toBeGreaterThanOrEqual(44);
});

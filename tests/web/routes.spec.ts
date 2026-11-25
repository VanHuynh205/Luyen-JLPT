import { expect, test } from "./fixtures";

const routes = [
  ["/", "home.page"],
  ["/tu-vung", "vocabulary.page"],
  ["/kanji", "kanji_quiz.page"],
  ["/kanji/tra-cuu", "kanji_library.page"],
  ["/ngu-phap", "grammar_list.page"],
  ["/ngu-phap/so-sanh", "grammar_comparisons.page"],
  ["/ngu-phap/so-sanh/comparison-SS001", "grammar_comparison_detail.page"],
  ["/ngu-phap/cach-chia", "grammar_conjugations.page"],
  ["/ngu-phap/kinh-ngu", "grammar_keigo.page"],
  ["/ngu-phap/tu-dong-tha-dong", "grammar_verb_pairs.page"],
  ["/ngu-phap/grammar-G001", "grammar_detail.page"],
  ["/doc-hieu", "reading_list.page"],
  ["/doc-hieu/reading-01", "reading_detail.page"],
  ["/luyen-de", "exam_list.page"],
  ["/luyen-de/n4-2023-07", "exam_runner.page"],
  ["/tai-khoan", "account.page"],
  ["/gioi-thieu", "about.page"],
  ["/tien-do", "progress.page"],
] as const;

for (const [path, pageId] of routes) {
  test(`${path} loads successfully`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator(`[data-ocid="${pageId}"]`)).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Đăng nhập", exact: true }).first(),
    ).toBeVisible();
    if (path === "/tu-vung") {
      await expect(
        page.locator('[data-ocid="vocabulary.position"]'),
      ).toHaveText("1 / 1182");
    }
    if (path === "/ngu-phap/grammar-G001") {
      await expect(page.locator("h1")).toHaveText("～んですか");
    }
    if (path === "/doc-hieu/reading-01") {
      await expect(
        page.locator('[data-ocid="reading_detail.passage.panel"]'),
      ).toBeVisible();
      await expect(page.locator("h1")).toContainText(
        "Lời nhắn gửi đồng nghiệp",
      );
    }
    if (path === "/gioi-thieu") {
      await expect(page.getByRole("link", { name: "Nguồn KANJIDIC2" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Giấy phép CC BY-SA 4.0" })).toBeVisible();
    }
  });
}

test("360px layout keeps primary study actions at least 44px high", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Mở menu" });
  await expect(menu).toBeVisible();
  expect((await menu.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("link", { name: "Bắt đầu học" }).click();
  const known = page.getByRole("button", { name: "Đã thuộc", exact: true });
  await expect(known).toBeVisible();
  expect((await known.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

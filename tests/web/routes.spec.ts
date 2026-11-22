import { expect, test } from "./fixtures";

const routes = [
  ["/", "home.page"],
  ["/tu-vung", "vocabulary.page"],
  ["/kanji", "kanji_quiz.page"],
  ["/kanji/tra-cuu", "kanji_library.page"],
  ["/ngu-phap", "grammar_list.page"],
  ["/ngu-phap/grammar-G001", "grammar_detail.page"],
  ["/doc-hieu", "reading_list.page"],
  ["/doc-hieu/reading-01", "reading_detail.page"],
  ["/tai-khoan", "account.page"],
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
  });
}

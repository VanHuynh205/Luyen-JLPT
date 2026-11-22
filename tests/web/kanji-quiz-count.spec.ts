import { expect, test } from "./fixtures";

test("each kanji quiz mode keeps its own question count from 10 to all", async ({
  page,
}) => {
  expect((await page.goto("/kanji"))?.status()).toBe(200);
  const mode = (id: string) =>
    page.locator(`[data-ocid="kanji_quiz.mode_${id}.toggle"]`);
  const all = page.locator('[data-ocid="kanji_quiz.count_all.toggle"]');
  const input = page.locator('[data-ocid="kanji_quiz.count.input"]');

  await expect(all).toHaveText("Tất cả (118)");
  await expect(input).toHaveValue("10");
  await mode("compound").click();
  await expect(all).toHaveText("Tất cả (388)");
  await mode("mixed").click();
  await expect(all).toHaveText("Tất cả (506)");

  await mode("single").click();
  await page.locator('[data-ocid="kanji_quiz.count_20.toggle"]').click();
  await expect(input).toHaveValue("20");
  await mode("compound").click();
  await expect(input).toHaveValue("10");
  await input.fill("5");
  await input.blur();
  await expect(input).toHaveValue("10");
  await mode("single").click();
  await expect(input).toHaveValue("20");

  await input.fill("9999");
  await input.press("Enter");
  await expect(input).toHaveValue("118");
  await expect(all).toHaveAttribute("aria-pressed", "true");

  await mode("compound").click();
  await page.locator('[data-ocid="kanji_quiz.count_50.toggle"]').click();
  await mode("single").click();
  await input.fill("20");
  await input.blur();

  expect((await page.reload())?.status()).toBe(200);
  await expect(input).toHaveValue("20");
  await mode("compound").click();
  await expect(input).toHaveValue("50");
  await mode("mixed").click();
  await expect(input).toHaveValue("10");
  await mode("single").click();
  await expect(input).toHaveValue("20");

  await page.locator('[data-ocid="kanji_quiz.start.primary_button"]').click();
  await expect(page.getByText("Câu 1/20")).toBeVisible();
});

import { expect, test } from "./fixtures";

test("guest progress survives reload and stays in its level", async ({
  page,
}) => {
  await page.goto("/tu-vung");
  await page.locator('[data-ocid="vocabulary.mark_known_button"]').click();
  await expect(page.getByText("1/1182", { exact: true })).toBeVisible();
  await page.goto("/tien-do");
  const cards = page.locator('[data-ocid="progress.stat.card.1"]');
  await expect(cards).toContainText("1 / 1182");
  if (process.env.EXPERIMENTAL_LEVELS === "1") {
    await page.getByRole("button", { name: "N3", exact: true }).click();
    await expect(
      page.locator('[data-ocid="progress.empty_state"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: "N4", exact: true }).click();
    await expect(cards).toContainText("1 / 1182");
  }
});

test("grammar and reading results persist for a guest", async ({ page }) => {
  await page.goto("/ngu-phap/grammar-G001");
  const learned = page.locator('[data-ocid="grammar_detail.learned_toggle"]');
  await learned.click();
  await expect(learned).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(learned).toHaveAttribute("aria-pressed", "true");
  await page.goto("/doc-hieu/reading-01");
  const questions = page.locator(
    '[data-ocid^="reading_detail.question.item."]',
  );
  await expect(questions.first()).toBeVisible();
  for (const question of await questions.all())
    await question.locator("label").first().click();
  await page.locator('[data-ocid="reading_detail.submit_button"]').click();
  await expect(page.getByText("Đã lưu vào tiến độ.")).toBeVisible();
  await page.goto("/tien-do");
  await expect(
    page.locator('[data-ocid="progress.stat.card.2"]'),
  ).toContainText("1 / 148");
  await expect(
    page.locator('[data-ocid="progress.stat.card.3"]'),
  ).toContainText("1 /");
});

test("kanji explanations, quiz history and compound lookup", async ({
  page,
}) => {
  await page.goto("/kanji/tra-cuu");
  await page.locator('[data-ocid="kanji_library.search_input"]').fill("悪口");
  await page.locator('[data-ocid="kanji_library.compound.tab"]').click();
  await expect(
    page.locator('[data-ocid="kanji_library.compound.list"]'),
  ).toContainText("nói xấu");
  await page.goto("/kanji");
  await page.locator('[data-ocid="kanji_quiz.start.primary_button"]').click();
  for (let index = 0; index < 10; index++) {
    await page.locator('[data-ocid="kanji_quiz.choice.1"]').click();
    await expect(page.getByText(/Hán Việt/i).first()).toBeVisible();
    await page.locator('[data-ocid="kanji_quiz.next.primary_button"]').click();
  }
  await expect(
    page.locator('[data-ocid="kanji_quiz.history.list"]'),
  ).toBeVisible();
});

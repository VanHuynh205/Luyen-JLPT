import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const EXPECTED_EXAMS = [
  ["2025-07", 57, "115 phút · 3 phần"],
  ["2024-12", 85, "115 phút · 3 phần"],
  ["2024-07", 85, "115 phút · 3 phần"],
  ["2023-07", 57, "115 phút · 3 phần"],
  ["2021-12", 85, "115 phút · 3 phần"],
  ["2021-07", 57, "115 phút · 3 phần"],
  ["2018-12", 98, "125 phút · 3 phần"],
  ["2017-07", 97, "125 phút · 3 phần"],
  ["2013-07", 98, "125 phút · 3 phần"],
] as const;

async function completeExamWithoutListening(page: Page) {
  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  await page.locator('[data-ocid="exam_runner.skip_listening_button"]').click();
}

test("exam list renders all 9 JLPT N4 exams with counts and durations", async ({
  page,
}) => {
  await page.goto("/luyen-de");
  await expect(page.locator('[data-ocid="exam_list.page"]')).toBeVisible();

  const items = page.locator('[data-ocid^="exam_list.item."]');
  await expect(items).toHaveCount(EXPECTED_EXAMS.length);

  for (let i = 0; i < EXPECTED_EXAMS.length; i++) {
    const [code, count, duration] = EXPECTED_EXAMS[i];
    const card = page.locator(`[data-ocid="exam_list.item.${i + 1}"]`);
    await expect(card).toContainText(`Mã đề: ${code}`);
    await expect(card).toContainText(`${count} câu`);
    await expect(card).toContainText(duration);
  }
});

test("sequential 3-section exam flow locks steps and reveals furigana and explanations on submit", async ({
  page,
}) => {
  await page.goto("/luyen-de/n4-2023-07");
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();

  const step1 = page.locator('[data-ocid="exam_runner.step.1"]');
  const step2 = page.locator('[data-ocid="exam_runner.step.2"]');
  const step3 = page.locator('[data-ocid="exam_runner.step.3"]');
  await expect(step1).toBeEnabled();
  await expect(step2).toBeDisabled();
  await expect(step3).toBeDisabled();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.timer_value"]'),
  ).toHaveText(/^(25:00|24:59)$/);
  await expect(step2).toBeDisabled();
  await expect(step3).toBeDisabled();

  await page
    .locator('[data-ocid="exam_runner.choice.n4-2023-07-v-01.1"]')
    .click();
  await page
    .locator('[data-ocid="exam_runner.choice.n4-2023-07-v-02.2"]')
    .click();
  await expect(
    page.locator('[data-ocid="exam_runner.timer_bar"]'),
  ).toContainText("Đã trả lời 2 / 28 câu");

  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.section_result"]'),
  ).toContainText(/Đã nộp Phần 1 · Đúng \d+\/28 câu/);

  const firstQuestion = page.locator(
    '[data-ocid="exam_runner.question.n4-2023-07-v-01"]',
  );
  for (const choice of await firstQuestion
    .locator('[data-ocid^="exam_runner.choice."]')
    .all()) {
    await expect(choice).toBeDisabled();
  }
  await expect(firstQuestion.locator("ruby rt").first()).toBeVisible();

  const explanation = page.locator(
    '[data-ocid="exam_runner.explanation.n4-2023-07-v-01"]',
  );
  await expect(explanation).toContainText("Dịch nghĩa:");
  await expect(explanation).toContainText("Vì sao chọn:");

  await expect(step2).toBeEnabled();
  await expect(step3).toBeDisabled();

  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.section_intro"]'),
  ).toContainText("Phần 2: Ngữ pháp & Đọc hiểu");

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.timer_value"]'),
  ).toHaveText(/^(55:00|54:59)$/);
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await expect(step3).toBeEnabled();

  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.section_intro"]'),
  ).toContainText("Phần 3: Nghe hiểu");
  await page.locator('[data-ocid="exam_runner.skip_listening_button"]').click();

  await expect(page.locator('[data-ocid="exam_runner.summary"]')).toBeVisible();
});

test("timer expiration auto-locks choices, reveals explanations, and unlocks section 2", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/luyen-de/n4-2023-07");

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await page
    .locator('[data-ocid="exam_runner.choice.n4-2023-07-v-01.1"]')
    .click();

  await page.clock.fastForward(1501 * 1000);
  await page.clock.runFor(300);

  const timerValue = page.locator('[data-ocid="exam_runner.timer_value"]');
  await expect(timerValue).toContainText("00:00");
  await expect(timerValue).toContainText("Hết giờ");
  await expect(
    page.locator('[data-ocid="exam_runner.timeout_notice"]'),
  ).toContainText("Hết giờ");

  const allChoices = page.locator('[data-ocid^="exam_runner.choice."]');
  await expect(allChoices).toHaveCount(112);
  const enabledCount = await allChoices.evaluateAll(
    (buttons) =>
      buttons.filter((button) => !(button as HTMLButtonElement).disabled)
        .length,
  );
  expect(enabledCount).toBe(0);

  const explanation = page.locator(
    '[data-ocid="exam_runner.explanation.n4-2023-07-v-01"]',
  );
  await expect(explanation).toContainText("Dịch nghĩa:");
  await expect(explanation).toContainText("Vì sao chọn:");

  await expect(page.locator('[data-ocid="exam_runner.step.2"]')).toBeEnabled();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.section_intro"]'),
  ).toContainText("Phần 2: Ngữ pháp & Đọc hiểu");
});

test("listening script mode supports 3-choice questions and persists attempt in IndexedDB across reload", async ({
  page,
}) => {
  await page.goto("/luyen-de/n4-2024-07");
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  await page
    .locator('[data-ocid="exam_runner.start_listening_script_button"]')
    .click();

  const mondai3Question = page.locator(
    '[data-ocid="exam_runner.question.n4-2024-07-l-16"]',
  );
  const mondai3Choices = mondai3Question.locator(
    '[data-ocid^="exam_runner.choice."]',
  );
  await expect(mondai3Choices).toHaveCount(3);

  await expect(
    page.locator('[data-ocid^="exam_runner.choice.n4-2024-07-l-21."]'),
  ).toHaveCount(3);

  await mondai3Question
    .getByRole("button", { name: "Xem script nghe" })
    .click();
  await expect(mondai3Question).toContainText("スープを作っています");

  await mondai3Choices.first().click();
  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();

  const mondai3Explanation = page.locator(
    '[data-ocid="exam_runner.explanation.n4-2024-07-l-16"]',
  );
  await expect(mondai3Explanation).toContainText("Script nghe");
  await expect(mondai3Explanation).toContainText("Dịch script:");

  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  const summary = page.locator('[data-ocid="exam_runner.summary"]');
  await expect(summary).toBeVisible();
  await expect(summary.locator("[data-stamp-value]")).toBeVisible();
  await expect(summary).toContainText("Đã lưu kết quả làm đề trên máy.");

  await page.reload();
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();

  await page.goto("/luyen-de");
  await expect(page.locator('[data-ocid="exam_list.item.3"]')).toContainText(
    "Đã làm 1 lần",
  );

  await page.goto("/tien-do");
  const examSection = page.locator(
    '[data-ocid="progress.exam_attempts.section"]',
  );
  await expect(examSection).toBeVisible();
  await expect(examSection).toContainText("Đề thi JLPT N4 — Tháng 7/2024");
});

test("360px mobile layout fits without horizontal overflow and keeps primary exam controls at least 44px high", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });

  await page.goto("/luyen-de");
  await expect(page.locator('[data-ocid="exam_list.page"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );

  const startLinks = page.locator('[data-ocid^="exam_list.start."]');
  await expect(startLinks).toHaveCount(9);
  for (const link of await startLinks.all()) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/luyen-de/n4-2023-07");
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );

  const startSection = page.locator(
    '[data-ocid="exam_runner.start_section_button"]',
  );
  await expect(startSection).toBeVisible();
  expect((await startSection.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await startSection.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  expect(
    (
      await page
        .locator('[data-ocid="exam_runner.choice.n4-2023-07-v-01.1"]')
        .boundingBox()
    )?.height,
  ).toBeGreaterThanOrEqual(44);

  const submitSection = page.locator(
    '[data-ocid="exam_runner.submit_section_button"]',
  );
  expect((await submitSection.boundingBox())?.height).toBeGreaterThanOrEqual(
    44,
  );
  await submitSection.click();

  const nextSection = page.locator(
    '[data-ocid="exam_runner.next_section_button"]',
  );
  expect((await nextSection.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await nextSection.click();
  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
});

test("pre-2020 exam uses 30-minute section 1 and 60-minute section 2 timers", async ({
  page,
}) => {
  await page.goto("/luyen-de/n4-2018-12");
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.timer_value"]'),
  ).toHaveText(/^(30:00|29:59)$/);

  await page.locator('[data-ocid="exam_runner.submit_section_button"]').click();
  await page.locator('[data-ocid="exam_runner.next_section_button"]').click();

  await page.locator('[data-ocid="exam_runner.start_section_button"]').click();
  await expect(
    page.locator('[data-ocid="exam_runner.timer_value"]'),
  ).toHaveText(/^(60:00|59:59)$/);
});

test("retake flow resets exam runner and updates attempt count on exam list", async ({
  page,
}) => {
  await page.goto("/luyen-de/n4-2023-07");
  await expect(page.locator('[data-ocid="exam_runner.page"]')).toBeVisible();

  await completeExamWithoutListening(page);

  const summary = page.locator('[data-ocid="exam_runner.summary"]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Đã lưu kết quả làm đề trên máy.");

  const retryButton = page.locator('[data-ocid="exam_runner.retry_button"]');
  await expect(retryButton).toBeVisible();
  await retryButton.click();

  await expect(
    page.locator('[data-ocid="exam_runner.section_intro"]'),
  ).toContainText("Phần 1: Từ vựng & Chữ Hán");
  await expect(page.locator('[data-ocid="exam_runner.step.2"]')).toBeDisabled();

  await completeExamWithoutListening(page);
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Đã lưu kết quả làm đề trên máy.");

  await page.goto("/luyen-de");
  const card = page.locator('[data-ocid="exam_list.item.4"]');
  await expect(card).toContainText("Mã đề: 2023-07");
  await expect(card).toContainText("Đã làm 2 lần");
  await expect(page.locator('[data-ocid="exam_list.start.4"]')).toContainText(
    "Làm lại đề",
  );
});

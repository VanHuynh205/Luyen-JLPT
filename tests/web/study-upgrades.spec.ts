import { expect, test } from "./fixtures";

test("vocabulary search normalizes kana/diacritics and persists lesson/section/onlyUnknown across reload", async ({
  page,
}) => {
  await page.goto("/tu-vung");
  const position = page.locator('[data-ocid="vocabulary.position"]');
  await expect(position).toHaveText("1 / 1182");

  const searchInput = page.locator('[data-ocid="vocabulary.search_input"]');
  await searchInput.fill("サガシマス");
  await expect(position).toHaveText("1 / 1");
  await expect(page.locator('[data-ocid="flashcard.card"]')).toContainText(
    "探します",
  );

  await page.locator('[data-ocid="vocabulary.search_clear_button"]').click();
  await expect(position).toHaveText("1 / 1182");

  await searchInput.fill("kham benh");
  await expect(position).toHaveText("1 / 1");
  await expect(page.locator('[data-ocid="flashcard.card"]')).toContainText(
    "見ます",
  );

  await searchInput.fill("lien lac");
  await expect(position).toHaveText("1 / 1");
  await expect(page.locator('[data-ocid="flashcard.card"]')).toContainText(
    "連絡します",
  );

  await page.locator('[data-ocid="vocabulary.search_clear_button"]').click();
  await expect(position).toHaveText("1 / 1182");

  await page.locator('[data-ocid="vocabulary.lesson.select"]').click();
  await page.getByRole("option", { name: /^Bài 26 \(/ }).click();

  await page.locator('[data-ocid="vocabulary.section.select"]').click();
  await page.getByRole("option", { name: /^Hội thoại \(/ }).click();

  await expect(position).toHaveText("1 / 9");
  await page.locator('[data-ocid="vocabulary.mark_known_button"]').click();
  await page.locator('[data-ocid="vocabulary.only_unknown.switch"]').click();
  await expect(position).toHaveText("1 / 8");

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("luyen-jlpt");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return new Promise<unknown>((resolve, reject) => {
          const request = db
            .transaction("settings")
            .objectStore("settings")
            .get("vocabFilter:n4");
          request.onsuccess = () => {
            db.close();
            resolve(request.result?.value);
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        });
      }),
    )
    .toEqual({ lesson: "26", section: "hội thoại", onlyUnknown: true });

  await page.reload();
  await expect(
    page.locator('[data-ocid="vocabulary.lesson.select"]'),
  ).toContainText("Bài 26");
  await expect(
    page.locator('[data-ocid="vocabulary.section.select"]'),
  ).toContainText("Hội thoại");
  await expect(
    page.locator('[data-ocid="vocabulary.only_unknown.switch"]'),
  ).toHaveAttribute("aria-checked", "true");
  await expect(position).toHaveText("1 / 8");
});

test("kanji sub-tabs switch cleanly and Minna lesson filter updates pool size live", async ({
  page,
}) => {
  await page.goto("/kanji");
  const subnav = page.locator('[data-ocid="kanji_subnav.nav"]');
  await expect(subnav).toBeVisible();

  const quizTab = page.locator('[data-ocid="kanji_subnav.quiz.link"]');
  const libraryTab = page.locator('[data-ocid="kanji_subnav.library.link"]');
  await expect(quizTab).toHaveAttribute("aria-current", "page");

  await libraryTab.click();
  await expect(page).toHaveURL(/\/kanji\/tra-cuu$/);
  await expect(page.locator('[data-ocid="kanji_library.page"]')).toBeVisible();
  await expect(libraryTab).toHaveAttribute("aria-current", "page");

  await quizTab.click();
  await expect(page).toHaveURL(/\/kanji$/);
  await expect(quizTab).toHaveAttribute("aria-current", "page");

  const allToggle = page.locator('[data-ocid="kanji_quiz.count_all.toggle"]');
  await expect(allToggle).toHaveText("Tất cả (118)");

  await page.locator('[data-ocid="kanji_quiz.lesson.select"]').click();
  await page.getByRole("option", { name: "Bài 26", exact: true }).click();
  await expect(allToggle).toHaveText("Tất cả (10)");

  await page.locator('[data-ocid="kanji_quiz.mode_compound.toggle"]').click();
  await expect(allToggle).toHaveText("Tất cả (28)");

  await page.locator('[data-ocid="kanji_quiz.start.primary_button"]').click();
  await expect(
    page.locator('[data-ocid="kanji_quiz.question.panel"]'),
  ).toBeVisible();
  await expect(page.getByText("Câu 1/10")).toBeVisible();
});

test("progress mostMissed launches targeted kanji retry drill via /kanji?retryIds=", async ({
  page,
}) => {
  // Verify direct URL validation/dedup handles invalid IDs gracefully
  await page.goto("/kanji?retryIds=kanji-K-60AA,non-existent-id,kanji-K-60AA");
  await expect(
    page.locator('[data-ocid="kanji_quiz.question.panel"]'),
  ).toBeVisible();
  await expect(page.getByText("Câu 1/1")).toBeVisible();

  // Complete a 10-question lesson 26 quiz to populate mostMissed on /tien-do
  await page.goto("/kanji");
  await page.locator('[data-ocid="kanji_quiz.lesson.select"]').click();
  await page.getByRole("option", { name: "Bài 26", exact: true }).click();
  await page.locator('[data-ocid="kanji_quiz.start.primary_button"]').click();

  for (let i = 0; i < 10; i++) {
    await page.locator('[data-ocid="kanji_quiz.choice.1"]').click();
    await page.locator('[data-ocid="kanji_quiz.next.primary_button"]').click();
  }

  await expect(
    page.locator('[data-ocid="kanji_quiz.result.panel"]'),
  ).toBeVisible();
  const wrongCount = await page
    .locator('[data-ocid^="kanji_quiz.wrong.item."]')
    .count();
  expect(wrongCount).toBeGreaterThan(0);

  await page.goto("/tien-do");
  const practiceBtn = page.locator(
    '[data-ocid="progress.most_missed.practice_button"]',
  );
  await expect(practiceBtn).toBeVisible();
  await expect(practiceBtn).toContainText(
    `Luyện lại ${wrongCount} chữ hay sai`,
  );
  expect((await practiceBtn.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await practiceBtn.click();
  await expect(page).toHaveURL(/\/kanji\?retryIds=/);
  await expect(
    page.locator('[data-ocid="kanji_quiz.question.panel"]'),
  ).toBeVisible();
  await expect(page.getByText(`Câu 1/${wrongCount}`)).toBeVisible();
});

test("collapsible 5-question mini-drills work on extended grammar pages and GrammarDetailPage stays quiz-free", async ({
  page,
}) => {
  const routes = [
    "/ngu-phap/cach-chia",
    "/ngu-phap/kinh-ngu",
    "/ngu-phap/tu-dong-tha-dong",
  ] as const;

  for (const route of routes) {
    await page.goto(route);
    const toggle = page.locator(
      '[data-ocid="grammar_mini_drill.toggle_button"]',
    );
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("Luyện nhanh 5 câu");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const items = page.locator('[data-ocid^="grammar_quiz.item."]');
    await expect(items).toHaveCount(5);

    await page.locator('[data-ocid="grammar_quiz.choice.1.1"]').click();
    await expect(
      page.locator(
        '[data-ocid="grammar_quiz.success_state.1"], [data-ocid="grammar_quiz.error_state.1"]',
      ),
    ).toBeVisible();

    const regenerate = page.locator(
      '[data-ocid="grammar_mini_drill.regenerate_button"]',
    );
    expect((await regenerate.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await regenerate.click();
    await expect(items).toHaveCount(5);
    await expect(
      page.locator(
        '[data-ocid="grammar_quiz.success_state.1"], [data-ocid="grammar_quiz.error_state.1"]',
      ),
    ).toHaveCount(0);
  }

  await page.goto("/ngu-phap/grammar-G001");
  await expect(
    page.locator('[data-ocid="grammar_mini_drill.panel"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-ocid="grammar_quiz.list"]')).toHaveCount(0);
});

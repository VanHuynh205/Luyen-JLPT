import { randomUUID } from "node:crypto";
import { type Page, expect, test } from "@playwright/test";

test.skip(
  process.env.JLPT_LOCAL_AUTH !== "1",
  "Needs the local Supabase stack",
);
test.use({ actionTimeout: 10_000 });

test("second-learner-isolated / second-user-empty-progress: offline write syncs to device two, not another account", async ({
  page,
  context,
  browser,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const api = "http://127.0.0.1:54321";
  const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (
    !serviceKey ||
    baseURL !== "http://127.0.0.1:4174" ||
    process.env.VITE_SUPABASE_URL !== api
  )
    throw new Error("Run against the local test stack only");
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = randomUUID();
  const created: string[] = [];
  async function login(tab: Page, identifier: string) {
    await tab.goto("/tai-khoan");
    await tab.getByLabel("Email hoặc tên đăng nhập").fill(identifier);
    await tab.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await tab.getByRole("button", { name: "Vào tài khoản" }).click();
    await expect(tab.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  }
  const other = await browser.newContext({ baseURL });
  other.setDefaultTimeout(10_000);
  try {
    for (const prefix of ["first", "second"]) {
      const username = `${prefix}_${suffix}`;
      const response = await request.post(`${api}/auth/v1/admin/users`, {
        headers,
        data: {
          email: `${username}@example.test`,
          password,
          email_confirm: true,
          user_metadata: { username },
        },
      });
      expect(response.ok()).toBe(true);
      created.push((await response.json()).id);
    }
    await page.goto("/ngu-phap/grammar-G001");
    const learned = page.locator('[data-ocid="grammar_detail.learned_toggle"]');
    await learned.click();
    await expect(learned).toHaveAttribute("aria-pressed", "true");
    await login(page, `FIRST_${suffix}`);
    await page
      .getByRole("button", { name: "Gộp tiến độ", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Gộp tiến độ", exact: true }),
    ).toHaveCount(0);
    const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const firstSession = await request.post(
      `${api}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: publicKey },
        data: { email: `first_${suffix}@example.test`, password },
      },
    );
    expect(firstSession.ok()).toBe(true);
    const firstHeaders = {
      apikey: publicKey,
      Authorization: `Bearer ${(await firstSession.json()).access_token}`,
    };
    await page.goto("/tu-vung");
    const mark = page.locator('[data-ocid="vocabulary.mark_known_button"]');
    await expect(mark).toBeVisible();
    await context.setOffline(true);
    await mark.click();
    await expect(page.getByText("1/1182", { exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${api}/rest/v1/card_status?user_id=eq.${created[0]}&known=eq.true`,
            { headers: firstHeaders },
          );
          return res.ok() && (await res.json()).length;
        },
        { timeout: 30_000 },
      )
      .toBe(1);
    const device = await other.newPage();
    await login(device, `first_${suffix}@example.test`);
    await device.goto("/tien-do");
    await expect(
      device.locator('[data-ocid="progress.stat.card.1"]'),
    ).toContainText("1 / 1182", { timeout: 30_000 });
    await expect(
      device.locator('[data-ocid="progress.stat.card.2"]'),
    ).toContainText("1 / 148", { timeout: 30_000 });
    await page.goto("/tai-khoan");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(
      page.getByRole("button", { name: "Vào tài khoản" }),
    ).toBeVisible();
    await login(page, `second_${suffix}`);
    await page.goto("/tien-do");
    await expect(
      page.locator('[data-ocid="progress.empty_state"]'),
    ).toBeVisible();
    await device.goto("/tai-khoan");
    await device.getByRole("button", { name: "Xoá tài khoản" }).click();
    await device
      .getByRole("button", { name: "Xác nhận xoá vĩnh viễn" })
      .click();
    await expect(
      device.getByRole("button", { name: "Vào tài khoản" }),
    ).toBeVisible();
    expect(
      (
        await request.get(`${api}/auth/v1/admin/users/${created[0]}`, {
          headers,
        })
      ).status(),
    ).toBe(404);
  } finally {
    await other.close();
    for (const id of created)
      await request.delete(`${api}/auth/v1/admin/users/${id}`, { headers });
  }
});

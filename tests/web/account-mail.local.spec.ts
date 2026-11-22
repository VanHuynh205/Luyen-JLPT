import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";

const app = "http://127.0.0.1:4174";
const api = "http://127.0.0.1:54321";
const mailpit = "http://127.0.0.1:54324";
const callback = `${app}/tai-khoan`;

test.skip(process.env.JLPT_LOCAL_AUTH !== "1", "Disposable local stack only");

test("recovery explains rate limits and keeps other notices neutral", async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL !== app || process.env.VITE_SUPABASE_URL !== api)
    throw new Error("Use the loopback app and Auth endpoints");

  const waitMessage = "Có quá nhiều yêu cầu. Vui lòng thử lại sau.";
  const cases = [
    { status: 429, code: "over_email_send_rate_limit", notice: waitMessage },
    { status: 429, code: "over_request_rate_limit", notice: waitMessage },
    {
      status: 500,
      code: "unexpected_failure",
      notice: "Không thực hiện được. Vui lòng thử lại.",
    },
    {
      status: 200,
      notice: "Nếu email có tài khoản, bạn sẽ nhận được thư đặt lại mật khẩu.",
    },
  ];
  let requests = 0;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === app) return route.continue();
    if (
      url.origin !== api ||
      url.pathname !== "/auth/v1/recover" ||
      request.method() !== "POST"
    )
      return route.abort();
    const response = cases[requests++];
    if (!response) return route.abort();
    return route.fulfill({
      status: response.status,
      json: response.code
        ? { error_code: response.code, msg: "Private Auth response" }
        : {},
    });
  });

  await page.goto(callback);
  await page
    .getByRole("button", { name: "Quên mật khẩu", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("learner@example.test");
  const send = page.getByRole("button", { name: "Gửi liên kết", exact: true });
  const notice = page.locator('[data-ocid="account.page"]').getByRole("status");
  for (const response of cases) {
    await send.click();
    await expect(send).toBeEnabled();
    await expect(notice).toHaveText(response.notice);
  }
  expect(requests).toBe(cases.length);
});

async function mailedCallback(
  request: APIRequestContext,
  email: string,
  type: "signup" | "recovery",
) {
  let verify: URL | undefined;
  await expect
    .poll(
      async () => {
        const inbox = await request.get(`${mailpit}/api/v1/search`, {
          params: { query: `to:${email}` },
          maxRedirects: 0,
        });
        expect(inbox.status()).toBe(200);
        const { messages } = (await inbox.json()) as {
          messages: { ID: string; To: { Address: string }[] }[];
        };
        for (const message of messages) {
          if (!message.To.some(({ Address }) => Address === email)) continue;
          const detail = await request.get(
            `${mailpit}/api/v1/message/${encodeURIComponent(message.ID)}`,
            { maxRedirects: 0 },
          );
          expect(detail.status()).toBe(200);
          const { HTML } = (await detail.json()) as { HTML: string };
          for (const match of HTML.matchAll(
            /\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
          )) {
            const url = new URL(match[1].replaceAll("&amp;", "&"));
            if (
              url.pathname !== "/auth/v1/verify" ||
              url.searchParams.get("type") !== type
            )
              continue;
            if (
              ![api, "http://localhost:54321"].includes(url.origin) ||
              url.username ||
              url.password ||
              url.searchParams.get("redirect_to") !== callback
            )
              throw new Error("Unexpected Auth email destination");
            verify = url;
            return true;
          }
        }
        return false;
      },
      {
        timeout: 25_000,
        message: `Mailpit delivered the ${type} verification link`,
      },
    )
    .toBe(true);

  if (!verify) throw new Error("Missing verification link");
  const response = await request.get(verify.href, { maxRedirects: 0 });
  expect([302, 303]).toContain(response.status());
  const redirect = new URL(response.headers().location);
  if (
    redirect.origin !== app ||
    redirect.pathname !== "/tai-khoan" ||
    redirect.username ||
    redirect.password ||
    !redirect.searchParams.get("code")
  )
    throw new Error("Expected a local PKCE callback");
  return redirect.href;
}

test("public signup requires confirmation; mailed recovery replaces the password", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (baseURL !== app || process.env.VITE_SUPABASE_URL !== api || !publicKey) {
    throw new Error(
      "Use the disposable loopback app, Auth, Mailpit and local public key",
    );
  }
  await context.route("**/*", (route) =>
    [app, api].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const username = `mail_${randomUUID().slice(0, 18).replaceAll("-", "")}`;
  const email = `${username}@example.test`;
  const oldPassword = randomUUID();
  const newPassword = randomUUID();
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });

  await page.goto(callback);
  await button("Đăng ký").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Tên đăng nhập/).fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
  await button("Tạo tài khoản").click();
  await expect(
    page.getByText(
      "Hãy mở thư xác nhận trên trình duyệt này để hoàn tất đăng ký.",
    ),
  ).toBeVisible();

  const pending = await request.post(
    `${api}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: publicKey },
      data: { email, password: oldPassword },
      maxRedirects: 0,
    },
  );
  expect(pending.ok()).toBe(false);
  expect((await pending.json()).error_code).toBe("email_not_confirmed");

  await page.goto(await mailedCallback(request, email, "signup"));
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await button("Đăng xuất").click();
  await button("Quên mật khẩu").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await button("Gửi liên kết").click();
  await expect(
    page.getByText(
      "Nếu email có tài khoản, bạn sẽ nhận được thư đặt lại mật khẩu.",
    ),
  ).toBeVisible();

  await page.goto(await mailedCallback(request, email, "recovery"));
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
  await button("Lưu mật khẩu mới").click();
  await expect(page.getByText("Đã cập nhật mật khẩu.")).toBeVisible();
  await button("Đăng xuất").click();
  await button("Đăng nhập").click();
  await page.getByLabel("Email hoặc tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
  await button("Vào tài khoản").click();
  await expect(
    page.getByText("Tên đăng nhập, email hoặc mật khẩu không đúng."),
  ).toBeVisible();
  await page.getByLabel("Mật khẩu", { exact: true }).fill(newPassword);
  await button("Vào tài khoản").click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

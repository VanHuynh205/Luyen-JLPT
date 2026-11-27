import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test as rawTest } from "@playwright/test";
import { test } from "./fixtures";

const headersFile = fileURLToPath(
  new URL("../../frontend/public/_headers", import.meta.url),
);

test("ships Cloudflare Web security headers including strict CSP and /tai-khoan no-store", () => {
  const headers = readFileSync(headersFile, "utf8");
  expect(headers).toContain("Content-Security-Policy:");
  expect(headers).toContain("default-src 'self'");
  expect(headers).toContain("frame-ancestors 'none'");
  expect(headers).toContain("object-src 'none'");
  expect(headers).toContain(
    "Strict-Transport-Security: max-age=31536000; includeSubDomains",
  );
  expect(headers).toContain("X-Content-Type-Options: nosniff");
  expect(headers).toContain("X-Frame-Options: DENY");
  expect(headers).toContain(
    "Referrer-Policy: strict-origin-when-cross-origin",
  );
  expect(headers).toContain(
    "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
  );
  expect(headers).toMatch(/\/tai-khoan\s+Cache-Control:\s*no-store/);
});

test("shows unconfigured account banner when built without Supabase env and handles /tai-khoan/ callback safely", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.VITE_SUPABASE_URL),
    "Unconfigured build check only",
  );

  await page.goto("/tai-khoan");
  await expect(page.locator('[data-ocid="account.page"]')).toBeVisible();
  await expect(
    page.getByText(
      "Bạn có thể học và lưu tiến độ trên máy. Bản này chưa cấu hình dịch vụ tài khoản.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vào tài khoản" }),
  ).toHaveCount(0);

  await page.goto("/tai-khoan/?code=sample_pkce_code&keep=1");
  await expect(page.locator('[data-ocid="account.page"]')).toBeVisible();
  await expect(
    page.getByText("Bản này chưa cấu hình dịch vụ tài khoản.", { exact: false }),
  ).toBeVisible();
});

rawTest(
  "classifies auth errors clearly and normalizes /tai-khoan/?code= callbacks when Supabase env is configured",
  async ({ page, context, baseURL }) => {
    rawTest.skip(
      !process.env.VITE_SUPABASE_URL,
      "Requires a build configured with VITE_SUPABASE_URL",
    );
    const appOrigin = new URL(baseURL ?? "http://127.0.0.1:4174").origin;
    const supabaseOrigin = new URL(process.env.VITE_SUPABASE_URL!).origin;

    let tokenAttempt = 0;
    let resolveAttempt = 0;
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === appOrigin) return route.continue();
      if (url.origin !== supabaseOrigin) return route.abort();

      if (url.pathname === "/auth/v1/token") {
        if (url.searchParams.get("grant_type") === "pkce") {
          return route.fulfill({
            status: 400,
            json: { error: "invalid_grant", error_description: "expired" },
          });
        }
        tokenAttempt++;
        if (tokenAttempt === 1) {
          return route.fulfill({
            status: 400,
            json: {
              error_code: "email_not_confirmed",
              msg: "Email not confirmed",
            },
          });
        }
        return route.fulfill({
          status: 400,
          json: {
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          },
        });
      }

      if (url.pathname === "/functions/v1/resolve-login") {
        resolveAttempt++;
        if (resolveAttempt === 1) {
          return route.fulfill({
            status: 429,
            json: { error: "invalid_credentials" },
          });
        }
        return route.fulfill({
          status: 503,
          json: { error: "invalid_credentials" },
        });
      }

      return route.abort();
    });

    await page.goto("/tai-khoan/?code=expired_pkce&keep=1");
    await expect(page).toHaveURL(`${appOrigin}/tai-khoan/?keep=1`);
    const notice = page.locator('[data-ocid="account.page"]').getByRole("status");
    await expect(notice).toContainText("Không mở được liên kết tài khoản.");

    await page.getByLabel("Email hoặc tên đăng nhập").fill("learner@example.test");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("secret123");
    await page.getByRole("button", { name: "Vào tài khoản" }).click();
    await expect(notice).toContainText("Email chưa được xác nhận.");

    await page.getByLabel("Email hoặc tên đăng nhập").fill("learner@example.test");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("wrongpass");
    await page.getByRole("button", { name: "Vào tài khoản" }).click();
    await expect(notice).toHaveText(
      "Tên đăng nhập, email hoặc mật khẩu không đúng.",
    );

    await page.getByLabel("Email hoặc tên đăng nhập").fill("learner_one");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("secret123");
    await page.getByRole("button", { name: "Vào tài khoản" }).click();
    await expect(notice).toContainText("Bạn thử đăng nhập quá nhiều lần.");

    await page.getByLabel("Email hoặc tên đăng nhập").fill("learner_one");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("secret123");
    await page.getByRole("button", { name: "Vào tài khoản" }).click();
    await expect(notice).toContainText(
      "Dịch vụ đăng nhập tạm thời không phản hồi.",
    );
  },
);

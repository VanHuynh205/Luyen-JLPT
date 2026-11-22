import { test as base, expect } from "@playwright/test";

export { expect };

export const test = base.extend<{ anonymous: undefined }>({
  anonymous: [
    async ({ page, context, baseURL }, use) => {
      const errors: string[] = [];
      if (!baseURL) throw new Error("Playwright baseURL is required");
      const origin = new URL(baseURL).origin;
      page.on("pageerror", (error) =>
        errors.push(`pageerror: ${error.message}`),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          errors.push(`console: ${message.text()}`);
      });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || url.pathname.startsWith("/api/")) {
          errors.push(`Unexpected request: ${url.origin}${url.pathname}`);
          await route.abort();
        } else {
          await route.continue();
        }
      });
      await use(undefined);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

import { expect, test } from "./fixtures";

const experimental = process.env.EXPERIMENTAL_LEVELS === "1";

test("N4 is selected and N3 reflects the built pack", async ({
  page,
  baseURL,
}) => {
  expect((await page.goto("/tu-vung"))?.status()).toBe(200);
  const n4 = page.getByRole("button", { name: "N4", exact: true });
  const position = page.locator('[data-ocid="vocabulary.position"]');
  await expect(n4).toHaveAttribute("aria-pressed", "true");
  await expect(position).toHaveText("1 / 1182");

  if (!experimental) {
    const n3 = page.getByRole("button", { name: "N3, Sắp ra mắt" });
    await expect(n3).toBeDisabled();
    await expect(n3).toContainText("Sắp ra mắt");
    return;
  }

  const n3 = page.getByRole("button", { name: "N3", exact: true });
  await expect(n3).toBeEnabled();
  await n3.click();
  await expect(n3).toHaveAttribute("aria-pressed", "true");
  await expect(position).toHaveText("1 / 2");
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
            .get("level");
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
    .toBe("n3");
  expect((await page.reload())?.status()).toBe(200);
  await expect(n3).toHaveAttribute("aria-pressed", "true");
  await expect(position).toHaveText("1 / 2");

  if (!baseURL) throw new Error("Playwright baseURL is required");
  await page.route(
    new URL("/packs/index.json", baseURL).href,
    async (route) => {
      const response = await route.fetch();
      const index = await response.json();
      index.levels = index.levels.filter(
        (entry: { level: string }) => entry.level !== "n3",
      );
      await route.fulfill({ response, json: index });
    },
  );
  expect((await page.reload())?.status()).toBe(200);
  await expect(n4).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "N3, Sắp ra mắt" }),
  ).toBeDisabled();
  await expect(position).toHaveText("1 / 1182");
});

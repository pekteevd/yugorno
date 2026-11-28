import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.YUGORNO_BASE_URL || "http://127.0.0.1:3187";
const browser = await chromium.launch({ headless: true });
const apiResponses = [];
const pageErrors = [];
const unexpectedConsoleErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !/401\\s*\\(Unauthorized\\)/i.test(message.text())) unexpectedConsoleErrors.push(message.text());
  });
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/api/moderation/") || url.includes("/api/admin/")) apiResponses.push({ status: response.status(), url });
  });
  page.on("dialog", dialog => dialog.accept());

  await page.addInitScript(() => { window.yugornoLocalDemo = true; });
  await page.route("https://telegram.org/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("https://unpkg.com/**", route => route.abort());

  const response = await page.goto(baseUrl, { waitUntil: "commit", timeout: 15000 });
  assert.equal(response?.status(), 200, "Mini App should return HTTP 200");
  await page.locator("#account-access-button").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#account-access-button").click();

  const localAdminLogin = page.getByRole("button", { name: "Войти как локальный тестовый администратор", exact: true });
  await localAdminLogin.waitFor({ state: "visible", timeout: 10000 });
  await localAdminLogin.click();

  await page.getByText("Локальный тестировщик", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.getByText("Администратор", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });

  const profileModeration = page.locator("button:visible").filter({ hasText: /^Модерация$/ });
  await profileModeration.first().waitFor({ state: "visible", timeout: 10000 });
  await profileModeration.first().click();

  const mapModeration = page.locator("#map-moderation-btn:visible");
  await mapModeration.waitFor({ state: "visible", timeout: 10000 });
  await mapModeration.click();

  await page.getByText(/Очередь модерации/, { exact: false }).waitFor({ state: "visible", timeout: 10000 });

  for (const endpoint of ["/api/moderation/places", "/api/moderation/impressions", "/api/moderation/routes", "/api/admin/destinations", "/api/admin/settings"]) {
    assert.ok(apiResponses.some(item => item.status === 200 && item.url.includes(endpoint)), "Expected authenticated HTTP 200 for " + endpoint);
  }

  assert.deepEqual(pageErrors, [], "browser should not emit uncaught JavaScript errors");
  assert.deepEqual(unexpectedConsoleErrors, [], "browser should not emit unexpected console errors");

  process.stdout.write("PASS: local administrator authentication and role display\n");
  process.stdout.write("PASS: profile moderation action opens the map moderation tools\n");
  process.stdout.write("PASS: moderation queue opens and all protected APIs return HTTP 200\n");
  process.stdout.write("PASS: no uncaught browser JavaScript errors\n");
} finally {
  await browser.close();
}

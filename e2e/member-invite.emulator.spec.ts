import { test, expect } from "@playwright/test";

/**
 * Full member visibility flow against Firebase Auth + Firestore emulators.
 * Requires: emulators running + seed (npm run emulator:seed) +
 * Next with .env.emulator (npm run dev:emulator).
 */
const MEMBER_EMAIL = "member@payround.test";
const MEMBER_PASSWORD = "testpass123";
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";

test.describe("Member invited subscriptions (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed)",
  );

  test.setTimeout(90_000);

  // Mobile + desktop shells both render ModeTabs; prefer the visible one.
  const visibleMemberTab = (page: import("@playwright/test").Page) =>
    page.locator('[data-testid="tab-member"]:visible').first();
  const visibleAdminTab = (page: import("@playwright/test").Page) =>
    page.locator('[data-testid="tab-admin"]:visible').first();

  test("member can sign in and see Netflix Shared", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-tab-signin").click();
    await page.locator("#signin-email").fill(MEMBER_EMAIL);
    await page.locator("#signin-password").fill(MEMBER_PASSWORD);
    await page.getByTestId("login-submit-signin").click();

    const error = page.getByTestId("login-error");
    const memberTab = visibleMemberTab(page);
    await Promise.race([
      memberTab.waitFor({ state: "visible", timeout: 60_000 }),
      error.waitFor({ state: "visible", timeout: 60_000 }).then(async () => {
        throw new Error(`Login failed: ${await error.textContent()}`);
      }),
    ]);

    await memberTab.click();
    await expect(page).toHaveURL(/\/pay/, { timeout: 15_000 });
    await expect(page.getByTestId("member-pay-page")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Netflix Shared" }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("owner Admin tab works and can switch to Member", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-tab-signin").click();
    await page.locator("#signin-email").fill(OWNER_EMAIL);
    await page.locator("#signin-password").fill(OWNER_PASSWORD);
    await page.getByTestId("login-submit-signin").click();

    await expect(visibleAdminTab(page)).toBeVisible({
      timeout: 60_000,
    });
    await visibleAdminTab(page).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText("Netflix Shared")).toBeVisible({
      timeout: 30_000,
    });

    await visibleMemberTab(page).click();
    await expect(page).toHaveURL(/\/pay/);
    await expect(page.getByTestId("member-pay-page")).toBeVisible();
  });
});

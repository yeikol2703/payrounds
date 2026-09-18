import { test, expect, type Page } from "@playwright/test";

/**
 * Dashboard cards/list toggle against Firebase emulators.
 */
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";

test.describe("Dashboard views (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed)",
  );

  test.setTimeout(90_000);

  const visibleAdminTab = (page: Page) =>
    page.locator('[data-testid="tab-admin"]:visible').first();

  async function signInOwner(page: Page) {
    await page.goto("/login");
    await page.getByTestId("login-tab-signin").click();
    await page.locator("#signin-email").fill(OWNER_EMAIL);
    await page.locator("#signin-password").fill(OWNER_PASSWORD);
    await page.getByTestId("login-submit-signin").click();
    await expect(visibleAdminTab(page)).toBeVisible({ timeout: 60_000 });
    await visibleAdminTab(page).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  }

  test("owner can toggle cards and list views", async ({ page }) => {
    await signInOwner(page);
    await expect(page.getByText("Netflix Shared")).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByTestId("dashboard-view-toggle")).toBeVisible();
    await expect(page.getByTestId("dashboard-cards")).toBeVisible();

    await page.getByTestId("dashboard-view-list").click();
    await expect(page.getByTestId("dashboard-list")).toBeVisible();
    await expect(page.getByTestId("dashboard-cards")).toHaveCount(0);

    await page.getByTestId("dashboard-view-cards").click();
    await expect(page.getByTestId("dashboard-cards")).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

/**
 * Bulk soft-cancel of owner subscriptions (emulator).
 * Seed provides Netflix Shared + Spotify Duo.
 */
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";
const SPOTIFY_ID = "sub-demo-spotify";

test.describe("Dashboard bulk cancel (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed)",
  );

  test.setTimeout(120_000);

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

  test("owner can select and soft-cancel Spotify Duo", async ({ page }) => {
    await signInOwner(page);
    await expect(page.getByText("Spotify Duo")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId(`dashboard-select-${SPOTIFY_ID}`).check();
    await expect(page.getByTestId("dashboard-bulk-cancel")).toBeVisible();
    await page.getByTestId("dashboard-bulk-cancel").click();
    await expect(page.getByTestId("dashboard-bulk-cancel-modal")).toBeVisible();
    await page.getByTestId("dashboard-bulk-cancel-confirm").click();

    await expect(page.getByText("Spotify Duo")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByText("Netflix Shared")).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

/**
 * Custom split + native day-of-month date picker (emulator).
 */
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";

test.describe("Custom split + billing day (emulator)", () => {
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
  }

  test("create wizard shows date picker and custom split validation", async ({
    page,
  }) => {
    await signInOwner(page);
    await page.goto("/subscriptions/new");

    await page.locator("#sub-name").fill("Custom Split Demo");
    await page.locator("#sub-cost").fill("30");
    await expect(page.getByTestId("day-of-month-picker")).toBeVisible();
    await page.getByTestId("billing-day-date-input").fill("2024-01-10");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("split-mode-toggle")).toBeVisible();
    await page.getByTestId("split-mode-custom").click();
    await page.getByTestId("split-owner-amount").fill("20");
    await page.locator('input[type="email"]').first().fill("friend@example.com");
    await page.getByTestId("split-friend-amount-0").fill("5");
    await expect(page.getByTestId("split-sum-status")).toContainText(/must sum/i);

    await page.getByTestId("split-friend-amount-0").fill("10");
    await expect(page.getByTestId("split-sum-status")).toContainText(/sum to \$30/i);
  });
});

import { test, expect, type Page } from "@playwright/test";

const MEMBER_EMAIL = "member@payround.test";
const MEMBER_PASSWORD = "testpass123";
const SUB_ID = "sub-demo-netflix";

test.describe("Member roster (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed)",
  );

  test.setTimeout(90_000);

  const visibleMemberTab = (page: Page) =>
    page.locator('[data-testid="tab-member"]:visible').first();

  test("member sees roster with payment states", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-tab-signin").click();
    await page.locator("#signin-email").fill(MEMBER_EMAIL);
    await page.locator("#signin-password").fill(MEMBER_PASSWORD);
    await page.getByTestId("login-submit-signin").click();

    await expect(visibleMemberTab(page)).toBeVisible({ timeout: 60_000 });
    await visibleMemberTab(page).click();
    await expect(page).toHaveURL(/\/pay/, { timeout: 15_000 });
    await expect(page.getByTestId(`pay-roster-${SUB_ID}`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(`pay-roster-${SUB_ID}`)).toContainText(
      /(You|Tú)/i,
    );
  });
});

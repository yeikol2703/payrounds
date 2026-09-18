import { test, expect, type Page } from "@playwright/test";

const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";

test.describe("Settings i18n (emulator)", () => {
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
  }

  test("owner can open settings and switch locale to Spanish", async ({
    page,
  }) => {
    await signInOwner(page);
    await page.goto("/settings");
    await expect(page.getByTestId("settings-page")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("account-locale-es").click();

    await expect(page.getByText("Ajustes").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Eliminar cuenta")).toBeVisible();
  });
});

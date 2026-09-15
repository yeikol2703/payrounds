import { test, expect } from "@playwright/test";

test.describe("Payround smoke", () => {
  test("login page shows unified Google + email auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-card")).toBeVisible();
    await expect(page.getByTestId("login-google")).toBeVisible();
    await expect(page.getByTestId("login-tab-signin")).toBeVisible();
    await expect(page.getByTestId("login-tab-register")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payround" })).toBeVisible();
    await expect(
      page.getByText(/Admin/i).first(),
    ).toBeVisible();
  });

  test("email register tab shows name + password fields", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-tab-register").click();
    await expect(page.getByTestId("login-register-form")).toBeVisible();
    await expect(page.locator("#reg-name")).toBeVisible();
    await expect(page.locator("#reg-email")).toBeVisible();
    await expect(page.locator("#reg-password")).toBeVisible();
    await expect(page.locator("#reg-confirm")).toBeVisible();
  });

  test("sign-in form validates empty submit via required fields", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("login-tab-signin").click();
    await page.getByTestId("login-submit-signin").click();
    // HTML5 required keeps us on login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("login-signin-form")).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("unauthenticated /pay redirects to login", async ({ page }) => {
    await page.goto("/pay");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("invalid invite token shows error state", async ({ page }) => {
    await page.goto("/invite/not-a-real-token-12345");
    await expect(
      page.getByRole("heading", {
        name: /invalid or has expired/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("root redirects signed-out users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe("Responsive shell (login)", () => {
  test("login remains usable at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await expect(page.getByTestId("login-card")).toBeVisible();
    await expect(page.getByTestId("login-google")).toBeInViewport();
  });
});

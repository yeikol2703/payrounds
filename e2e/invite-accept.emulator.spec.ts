import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end: owner sends invite → invitee registers & accepts → sees sub in Member.
 * Requires Docker emulators + seed + Next with .env.emulator (port 3002).
 */
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";
const INVITEE_PASSWORD = "testpass123";

test.describe("Owner invite → member accept (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed)",
  );

  test.setTimeout(120_000);

  const visibleAdminTab = (page: Page) =>
    page.locator('[data-testid="tab-admin"]:visible').first();
  const visibleMemberTab = (page: Page) =>
    page.locator('[data-testid="tab-member"]:visible').first();

  async function signIn(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByTestId("login-card").waitFor({ state: "visible" });
    await page.getByTestId("login-tab-signin").click();
    await page.locator("#signin-email").fill(email);
    await page.locator("#signin-password").fill(password);
    await expect(page.locator("#signin-email")).toHaveValue(email);
    await page.getByTestId("login-submit-signin").click();

    const error = page.getByTestId("login-error");
    await Promise.race([
      page.waitForURL(/\/(dashboard|pay)/, { timeout: 60_000 }),
      visibleAdminTab(page).waitFor({ state: "visible", timeout: 60_000 }),
      visibleMemberTab(page).waitFor({ state: "visible", timeout: 60_000 }),
      error.waitFor({ state: "visible", timeout: 60_000 }).then(async () => {
        throw new Error(`Login failed: ${await error.textContent()}`);
      }),
    ]);
  }

  test("owner invites new email; invitee joins and sees subscription", async ({
    browser,
  }) => {
    const inviteeEmail = `invitee-${Date.now()}@payround.test`;
    const owner = await browser.newPage();

    // --- Owner: sign in, open Netflix Shared, send invite ---
    await signIn(owner, OWNER_EMAIL, OWNER_PASSWORD);
    await visibleAdminTab(owner).click();
    await expect(owner).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await owner.getByRole("heading", { name: "Netflix Shared" }).click();
    await expect(owner).toHaveURL(/\/subscriptions\/sub-demo-netflix/, {
      timeout: 15_000,
    });

    await owner.getByTestId("add-member-open").click();
    await expect(owner.getByRole("heading", { name: "Add member" })).toBeVisible();
    await owner.locator("#add-member-email").fill(inviteeEmail);
    await owner.getByTestId("add-member-submit").click();

    const inviteUrlEl = owner.getByTestId("invite-share-url");
    const addError = owner.locator('[role="dialog"] [role="alert"]');
    await Promise.race([
      inviteUrlEl.waitFor({ state: "visible", timeout: 45_000 }),
      owner
        .getByText(/been added to this subscription/i)
        .waitFor({ state: "visible", timeout: 45_000 })
        .then(() => {
          throw new Error(
            "Expected invite link for a new email, but user was added as registered",
          );
        }),
      addError.waitFor({ state: "visible", timeout: 45_000 }).then(async () => {
        throw new Error(`Add member failed: ${await addError.textContent()}`);
      }),
    ]);
    const inviteUrl = (await inviteUrlEl.textContent())?.trim() ?? "";
    expect(inviteUrl).toMatch(/\/invite\/[0-9a-f-]{20,}/i);

    // --- Invitee: open invite link, register, join ---
    const invitee = await browser.newPage();
    await invitee.goto(inviteUrl);
    await expect(
      invitee.getByRole("heading", { name: /invited/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(invitee.getByText(inviteeEmail)).toBeVisible();

    await invitee.locator("#invite-name").fill("New Friend");
    await invitee.locator("#invite-email").fill(inviteeEmail);
    await invitee.locator("#invite-password").fill(INVITEE_PASSWORD);
    await invitee.locator("#invite-confirm").fill(INVITEE_PASSWORD);
    await invitee.getByTestId("invite-register-submit").click();

    // After join, land in app with workspace tabs
    await expect(visibleMemberTab(invitee)).toBeVisible({ timeout: 60_000 });
    await visibleMemberTab(invitee).click();
    await expect(invitee).toHaveURL(/\/pay/, { timeout: 15_000 });
    await expect(invitee.getByTestId("member-pay-page")).toBeVisible();
    await expect(
      invitee.getByRole("heading", { name: "Netflix Shared" }),
    ).toBeVisible({ timeout: 30_000 });

    await owner.close();
    await invitee.close();
  });
});

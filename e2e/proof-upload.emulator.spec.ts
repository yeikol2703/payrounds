import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Payment proof E2E against Auth + Firestore + Storage emulators.
 * Fixture: test/sinpe.jpg
 */
const OWNER_EMAIL = "owner@payround.test";
const OWNER_PASSWORD = "testpass123";
const MEMBER_EMAIL = "member@payround.test";
const MEMBER_PASSWORD = "testpass123";
const SUB_ID = "sub-demo-netflix";
const PROOF_FILE = path.resolve(process.cwd(), "test/sinpe.jpg");

test.describe("Payment proof upload (emulator)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
      process.env.PLAYWRIGHT_USE_EMULATOR !== "true",
    "Set PLAYWRIGHT_USE_EMULATOR=true (and run emulators + seed + Storage on :9199)",
  );

  test.setTimeout(180_000);

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

  test("member uploads sinpe → owner rejects → re-upload → owner confirms", async ({
    browser,
  }) => {
    const member = await browser.newPage();
    const owner = await browser.newPage();

    // --- Member uploads proof ---
    await signIn(member, MEMBER_EMAIL, MEMBER_PASSWORD);
    await visibleMemberTab(member).click();
    await expect(member).toHaveURL(/\/pay/, { timeout: 15_000 });
    await expect(member.getByTestId("member-pay-page")).toBeVisible();
    await expect(
      member.getByRole("heading", { name: "Netflix Shared" }),
    ).toBeVisible({ timeout: 30_000 });

    await member.getByTestId(`proof-upload-${SUB_ID}`).setInputFiles(PROOF_FILE);

    await expect(member.getByText("Under review").first()).toBeVisible({
      timeout: 60_000,
    });

    // --- Owner rejects with optional note ---
    await signIn(owner, OWNER_EMAIL, OWNER_PASSWORD);
    await visibleAdminTab(owner).click();
    await expect(owner).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await owner.getByRole("heading", { name: "Netflix Shared" }).click();
    await expect(owner).toHaveURL(new RegExp(`/subscriptions/${SUB_ID}`), {
      timeout: 15_000,
    });

    await owner.getByTestId("proof-review-banner-open").click();
    await expect(owner.getByTestId("proof-review-modal")).toBeVisible();
    await owner.locator("#reject-note").fill("Blurry SINPE — please resubmit");
    await owner.getByTestId("proof-reject").click();
    await Promise.race([
      expect(owner.getByTestId("proof-review-modal")).toBeHidden({
        timeout: 45_000,
      }),
      owner
        .getByTestId("proof-action-error")
        .waitFor({ state: "visible", timeout: 45_000 })
        .then(async () => {
          throw new Error(
            `Reject failed: ${await owner.getByTestId("proof-action-error").textContent()}`,
          );
        }),
    ]);

    // --- Member sees rejection + uploads again ---
    await member.reload();
    await expect(member.getByTestId("member-pay-page")).toBeVisible();
    await expect(
      member.getByText(/Blurry SINPE|Note from owner/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    await member.getByTestId(`proof-upload-${SUB_ID}`).setInputFiles(PROOF_FILE);
    await expect(member.getByText("Under review").first()).toBeVisible({
      timeout: 60_000,
    });

    // --- Owner confirms ---
    await owner.reload();
    await expect(owner.getByTestId("proof-review-banner-open")).toBeVisible({
      timeout: 30_000,
    });
    await owner.getByTestId("proof-review-banner-open").click();
    await expect(owner.getByTestId("proof-review-modal")).toBeVisible();
    await owner.getByTestId("proof-confirm").click();
    await expect(owner.getByTestId("proof-review-modal")).toBeHidden({
      timeout: 30_000,
    });

    await member.reload();
    await expect(member.getByText(/Paid|Payment confirmed/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await member.close();
    await owner.close();
  });
});

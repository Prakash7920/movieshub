import { expect, test } from "@playwright/test";

test("verification error leads to a working resend-verification flow", async ({ page }) => {
  let submittedEmail = "";

  await page.route("**/api/auth/resend-verification", async (route) => {
    submittedEmail = String(route.request().postDataJSON()?.email ?? "");
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        message: "If an unverified account exists for that email, a verification link will be sent.",
      }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/verify-email");
  await expect(page.getByRole("status")).toContainText("invalid or missing");
  await page.getByRole("link", { name: "Try again" }).click();

  await expect(page).toHaveURL(/\/auth\/resend-verification$/);
  await expect(page.getByRole("heading", { name: "Resend verification email" })).toBeVisible();
  await page.getByLabel("Account email").fill(" CUSTOMER@EXAMPLE.COM ");
  await page.getByRole("button", { name: "Resend verification email" }).click();

  await expect(page.getByRole("status")).toContainText("If an unverified account exists");
  expect(submittedEmail).toBe("customer@example.com");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("authentication pages only advertise the supported email/password flows", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("button", { name: "Google login" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "OTP login" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Resend verification email" })).toHaveAttribute("href", "/auth/resend-verification");

  await page.goto("/auth/register");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);

  await page.goto("/auth/forgot-password");
  await expect(page.getByRole("button", { name: "Request OTP instead" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

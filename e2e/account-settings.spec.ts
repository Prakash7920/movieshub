import { expect, test } from "@playwright/test";
import { AuthProvider, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "NexaFilm-Settings-Test-Password-2026!";
const changedPassword = "NexaFilm-Changed-Password-2026!";
let isolatedDatabaseValidated = false;

function requireIsolatedTestDatabase() {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("E2E tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required for E2E tests.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("E2E tests may only run against the isolated local movieshub_test database.");
  }
  isolatedDatabaseValidated = true;
}

test.beforeAll(async () => {
  requireIsolatedTestDatabase();
  await prisma.$connect();
});

test.afterAll(async () => {
  if (isolatedDatabaseValidated) {
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@nexafilm-settings-e2e.test" } },
    });
  }
  await prisma.$disconnect();
});

test("customer can update account settings and sync the saved language to a fresh browser", async ({ page, browser }) => {
  const email = `settings-${Date.now()}@nexafilm-settings-e2e.test`;
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.user.create({
    data: {
      email,
      name: "Settings Test User",
      passwordHash,
      provider: AuthProvider.CREDENTIALS,
      role: Role.USER,
      isEmailVerified: true,
      profiles: {
        create: { displayName: "Settings Test User", languagePreference: "en" },
      },
    },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  await expect(page.getByLabel("Email address")).toHaveAttribute("readonly", "");
  await page.getByLabel("Display name").fill("Tamil Cinema Fan");
  await page.getByLabel("Preferred language").selectOption("ta");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved.");

  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Tamil Cinema Fan");
  await expect(page.getByLabel("Preferred language")).toHaveValue("ta");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  const saved = await prisma.user.findUnique({
    where: { email },
    select: {
      name: true,
      profiles: { select: { displayName: true, languagePreference: true } },
    },
  });
  expect(saved?.name).toBe("Tamil Cinema Fan");
  expect(saved?.profiles).toEqual([{ displayName: "Tamil Cinema Fan", languagePreference: "ta" }]);

  // New browser context: no localStorage or cookies from the first context.
  const secondContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1280, height: 900 },
  });
  try {
    const secondPage = await secondContext.newPage();
    await secondPage.goto("/auth/login");
    await secondPage.locator('input[type="email"]').fill(email);
    await secondPage.locator('input[type="password"]').fill(password);
    await secondPage.getByRole("button", { name: "Login", exact: true }).click();
    await expect(secondPage).toHaveURL(/dashboard/);
    await expect(secondPage.locator("html")).toHaveAttribute("lang", "ta");
    await expect(secondPage.getByRole("link", { name: /திரைப்படங்கள்/ })).toBeVisible();
  } finally {
    await secondContext.close();
  }

  // Password changes are available from Settings, verify the current credential,
  // and force a fresh sign-in for this and every other session.
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  await page.getByLabel("Current password").fill("Wrong-Current-Password-2026!");
  await page.getByLabel("New password", { exact: true }).fill(changedPassword);
  await page.getByLabel("Confirm new password").fill(changedPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Current password is incorrect.");

  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("New password", { exact: true }).fill(changedPassword);
  await page.getByLabel("Confirm new password").fill(changedPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?passwordChanged=1/);
  await expect(page.getByRole("status")).toContainText("Password updated. Please sign in with your new password.");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Email or password is incorrect");

  await page.locator('input[type="password"]').fill(changedPassword);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);

  const finalUser = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true, passwordChangedAt: true },
  });
  expect(finalUser?.passwordChangedAt).not.toBeNull();
  expect(finalUser?.passwordHash).not.toBe(passwordHash);
});

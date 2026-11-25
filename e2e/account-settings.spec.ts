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
  await expect(page.getByRole("status")).toContainText("அமைப்புகள் சேமிக்கப்பட்டன.");

  await page.reload();
  await expect(page.getByLabel("காட்சிப் பெயர்")).toHaveValue("Tamil Cinema Fan");
  await expect(page.getByLabel("விருப்ப மொழி")).toHaveValue("ta");
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
    // The watchlist endpoint correctly fails closed without a verified viewer country.
    await secondPage.setExtraHTTPHeaders({ "x-vercel-ip-country": "IN" });
    await secondPage.goto("/auth/login");
    await secondPage.locator('input[type="email"]').fill(email);
    await secondPage.locator('input[type="password"]').fill(password);
    await secondPage.getByRole("button", { name: "Login", exact: true }).click();
    await expect(secondPage).toHaveURL(/dashboard/);
    await expect(secondPage.locator("html")).toHaveAttribute("lang", "ta");
    await expect(secondPage.getByRole("link", { name: /திரைப்படங்கள்/ })).toBeVisible();
    await secondPage.setViewportSize({ width: 390, height: 844 });
    await secondPage.goto("/");
    await expect(secondPage.getByRole("heading", { name: "ஒவ்வொரு மொழியிலும் ஒரு சினிமா உலகம்." })).toBeVisible();
    await secondPage.goto("/movies");
    await expect(secondPage.getByRole("heading", { name: "திரைப்படங்களைத் தேடுங்கள்" })).toBeVisible();
    await expect(secondPage.getByPlaceholder("திரைப்படம், தலைப்பு அல்லது விவரத்தைத் தேடுங்கள்...")).toBeVisible();
    await secondPage.goto("/dashboard");
    await expect(secondPage.getByRole("heading", { name: "எனது டாஷ்போர்டு" })).toBeVisible();
    await secondPage.goto("/dashboard/watchlist");
    await expect(secondPage.getByRole("heading", { name: "எனது விருப்பப் பட்டியல்" })).toBeVisible();
    await expect(secondPage.getByRole("link", { name: "திரைப்படங்களைப் பாருங்கள்" })).toBeVisible();
    await secondPage.goto("/dashboard/history");
    await expect(secondPage.getByRole("heading", { name: "பார்த்த வரலாறு", exact: true })).toBeVisible();
    await secondPage.goto("/dashboard/settings");
    await expect(secondPage.getByRole("heading", { name: "கணக்கு அமைப்புகள்" })).toBeVisible();
    await expect(secondPage.getByRole("heading", { name: "கடவுச்சொல்லை மாற்று" })).toBeVisible();
    await expect(secondPage.getByLabel("தற்போதைய கடவுச்சொல்")).toBeVisible();
    await secondPage.goto("/subscription");
    await expect(secondPage.getByRole("heading", { name: "உங்கள் NexaFilm திட்டத்தைத் தேர்ந்தெடுக்கவும்" })).toBeVisible();
    await expect(secondPage.getByRole("button", { name: "மாதந்தோறும்" })).toBeVisible();
    await expect(secondPage.getByText("தேர்ந்தெடுக்கப்பட்ட இலவச திரைப்படங்கள்", { exact: true })).toBeVisible();
    await secondPage.goto("/subscription/success");
    await expect(secondPage.getByRole("heading", { name: "உங்கள் சந்தா நிலையைச் சரிபார்க்கவும்" })).toBeVisible();
    await secondPage.goto("/subscription/failure");
    await expect(secondPage.getByRole("heading", { name: "உங்கள் கட்டண நிலையைச் சரிபார்க்கவும்" })).toBeVisible();
  } finally {
    await secondContext.close();
  }

  // Password changes are available from Settings, verify the current credential,
  // and force a fresh sign-in for this and every other session.
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "கடவுச்சொல்லை மாற்று" })).toBeVisible();
  await page.getByLabel("தற்போதைய கடவுச்சொல்").fill("Wrong-Current-Password-2026!");
  await page.getByLabel("புதிய கடவுச்சொல்", { exact: true }).fill(changedPassword);
  await page.getByLabel("புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்").fill(changedPassword);
  await page.getByRole("button", { name: "கடவுச்சொல்லைப் புதுப்பிக்கவும்" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("தற்போதைய கடவுச்சொல் தவறானது.");

  await page.getByLabel("தற்போதைய கடவுச்சொல்").fill(password);
  await page.getByLabel("புதிய கடவுச்சொல்", { exact: true }).fill(changedPassword);
  await page.getByLabel("புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்").fill(changedPassword);
  await page.getByRole("button", { name: "கடவுச்சொல்லைப் புதுப்பிக்கவும்" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?passwordChanged=1/);
  await expect(page.getByRole("status")).toContainText("கடவுச்சொல் புதுப்பிக்கப்பட்டது. புதிய கடவுச்சொல்லுடன் உள்நுழையவும்.");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "உள்நுழை", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("மின்னஞ்சல் அல்லது கடவுச்சொல் தவறாக உள்ளது.");

  await page.locator('input[type="password"]').fill(changedPassword);
  await page.getByRole("button", { name: "உள்நுழை", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);

  const finalUser = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true, passwordChangedAt: true },
  });
  expect(finalUser?.passwordChangedAt).not.toBeNull();
  expect(finalUser?.passwordHash).not.toBe(passwordHash);
});

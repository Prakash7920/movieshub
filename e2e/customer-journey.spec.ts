import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { AuthProvider, ContentStatus, LicenseStatus, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const suffix = randomUUID();
const email = `journey-${suffix}@nexafilm-route-e2e.test`;
const password = "NexaFilm-Customer-Journey-2026!";
const slug = `customer-journey-${suffix}`;
let isolatedDatabaseValidated = false;
let movieId: string | null = null;
let userId: string | null = null;

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
    throw new Error("Customer journey tests may only use the isolated local movieshub_test database.");
  }
  isolatedDatabaseValidated = true;
}

test.beforeAll(async () => {
  requireIsolatedTestDatabase();
  await prisma.$connect();

  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      email,
      name: "NexaFilm Journey Tester",
      passwordHash,
      provider: AuthProvider.CREDENTIALS,
      role: Role.USER,
      isEmailVerified: true,
      profiles: {
        create: { displayName: "NexaFilm Journey Tester", languagePreference: "en" },
      },
    },
    select: { id: true },
  });
  userId = user.id;

  const movie = await prisma.movie.create({
    data: {
      titleEn: "NexaFilm Customer Journey Test",
      titleTa: "நெக்ஸாஃபில்ம் சோதனை",
      slug,
      descriptionEn: "Isolated legal catalogue test fixture.",
      descriptionTa: "தனிமைப்படுத்தப்பட்ட சோதனை.",
      posterUrl: "https://example.invalid/nexafilm-journey-poster.jpg",
      backdropUrl: "https://example.invalid/nexafilm-journey-backdrop.jpg",
      language: "ta",
      audioLanguages: ["ta"],
      subtitleLanguages: ["en"],
      releaseYear: 2026,
      runtimeMinutes: 95,
      ageRating: "U",
      isPublished: true,
      contentStatus: ContentStatus.PUBLISHED,
      allowedCountries: ["IN"],
      license: {
        create: {
          owner: "NexaFilm isolated E2E rights fixture",
          status: LicenseStatus.ACTIVE,
          startDate: new Date(Date.now() - 60_000),
          expiryDate: new Date(Date.now() + 60 * 60 * 1000),
          allowedCountries: ["IN"],
        },
      },
    },
    select: { id: true },
  });
  movieId = movie.id;
});

test.afterAll(async () => {
  if (isolatedDatabaseValidated) {
    if (movieId) await prisma.movie.deleteMany({ where: { id: movieId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

test("customer can navigate the legal catalogue, account library, settings and plans", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ "x-vercel-ip-country": "IN" });

  // Guest mobile navigation: primary destinations are reachable without a desktop nav.
  await page.goto("/");
  const openMenu = page.getByRole("button", { name: "Open navigation menu" });
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  await openMenu.click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Movies" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "AI Picks" })).toBeVisible();
  await mobileNav.getByRole("link", { name: "Movies" }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");

  const publicRoutes = [
    "/",
    "/movies",
    "/categories",
    "/assistant",
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/resend-verification",
    "/auth/reset-password",
    "/auth/verify-email",
    "/subscription",
    "/subscription/success",
    "/subscription/failure",
    "/watch/customer-journey-preview",
  ];

  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), `route ${route}`).toBe(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      `horizontal overflow on ${route}`,
    ).toBe(false);
  }

  await page.goto("/categories");
  await expect(page).toHaveURL(/\/movies$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login/);

  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();

  // Signed-in mobile navigation must expose account destinations as well.
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const signedInMobileNav = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await expect(signedInMobileNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(signedInMobileNav.getByRole("link", { name: "Admin" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(signedInMobileNav).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");

  await page.goto("/");
  await page.getByRole("link", { name: "Explore the Catalogue" }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.getByRole("heading", { name: "Explore movies" })).toBeVisible();
  await expect(page.getByPlaceholder("Search movie, title or description...")).toBeVisible();
  const movieCard = page.locator(`a[href="/movies/${slug}"]`);
  await expect(movieCard).toBeVisible();
  await movieCard.click();

  await expect(page).toHaveURL(new RegExp(`/movies/${slug}$`));
  await expect(page.getByRole("heading", { name: "NexaFilm Customer Journey Test" })).toBeVisible();
  await expect(page.getByText("Catalogue metadata", { exact: true })).toBeVisible();
  await expect(page.getByText("Audio: ta · Subtitles: en", { exact: true })).toBeVisible();
  await expect(page.getByText("Playback is disabled in this Preview until distribution rights and secure video access are verified.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add to Watchlist" }).click();
  await expect(page.getByRole("button", { name: "Remove from Watchlist" })).toBeVisible();
  await page.getByRole("button", { name: "Add history preview" }).click();
  await expect(page.getByRole("status")).toContainText("Preview entry saved");

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /My Watchlist/ })).toHaveAttribute("href", "/dashboard/watchlist");
  await expect(page.getByRole("link", { name: /Watch History/ })).toHaveAttribute("href", "/dashboard/history");
  await expect(page.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/dashboard/settings");

  await page.goto("/dashboard/watchlist");
  await expect(page.getByRole("heading", { name: "My Watchlist" })).toBeVisible();
  await expect(page.getByText("NexaFilm Customer Journey Test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await expect(page.getByRole("heading", { name: "Your watchlist is empty" })).toBeVisible();

  await page.goto("/dashboard/history");
  await expect(page.getByRole("heading", { name: "Watch History" })).toBeVisible();
  await expect(page.getByText("NexaFilm Customer Journey Test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await expect(page.getByRole("heading", { name: "No watch history yet" })).toBeVisible();

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(email);

  await page.goto("/subscription");
  await expect(page.getByRole("heading", { name: "Choose your NexaFilm plan" })).toBeVisible();
  await page.goto("/subscription/success");
  await expect(page.getByRole("heading", { name: "Check your subscription status" })).toBeVisible();
  await page.goto("/subscription/failure");
  await expect(page.getByRole("heading", { name: "Check your payment status" })).toBeVisible();

  await page.goto("/watch/customer-journey-preview");
  await expect(page.getByText("Playback disabled", { exact: true })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  // Desktop keeps its full primary nav and hides the mobile disclosure control.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: /navigation menu/i })).toBeHidden();

  for (const route of ["/movies", "/dashboard", "/dashboard/watchlist", "/dashboard/history", "/dashboard/settings", "/subscription"]) {
    await page.goto(route);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      `desktop horizontal overflow on ${route}`,
    ).toBe(false);
  }

  // Verify the movie-detail interface follows the selected language on mobile and desktop.
  await page.goto("/movies");
  await page.getByRole("combobox", { name: "Select language" }).selectOption("ta");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`a[href="/movies/${slug}"]`).click();
  await expect(page.getByText("திரைப்பட விவரங்கள்", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /திரைப்படங்களுக்குத் திரும்பு/ })).toBeVisible();
  await expect(page.getByText("ஒலி: ta · வசன வரிகள்: en", { exact: true })).toBeVisible();
  await expect(page.getByText("விநியோக உரிமைகள் மற்றும் பாதுகாப்பான வீடியோ அணுகல் சரிபார்க்கப்படும் வரை இந்த முன்னோட்டத்தில் வீடியோ இயக்கம் முடக்கப்பட்டுள்ளது.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByText("திரைப்பட விவரங்கள்", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

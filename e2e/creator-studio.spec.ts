import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { AuthProvider, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "NexaFilm-Creator-E2E-Password-2026!";
const domain = "@nexafilm-creator-e2e.test";
const createdEmails: string[] = [];

async function createUser(role: Role = Role.USER) {
  const email = "creator-" + randomUUID() + domain;
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      email,
      name: "NexaFilm Creator E2E",
      passwordHash,
      provider: AuthProvider.CREDENTIALS,
      role,
      isEmailVerified: true,
      profiles: { create: { displayName: "NexaFilm Creator E2E", languagePreference: "en" } },
    },
    select: { id: true, email: true },
  });
  createdEmails.push(email);
  return user;
}

async function createCreator(userId: string, publicName: string, status: "PENDING" | "APPROVED" = "APPROVED") {
  return prisma.creatorProfile.create({
    data: {
      userId,
      publicName,
      bio: "Isolated Creator Studio Playwright fixture.",
      adultEligibilityConfirmed: true,
      status,
    },
  });
}

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.beforeAll(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") throw new Error("Creator Studio E2E requires MOVIESHUB_E2E=true.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) || !databaseUrl.pathname.includes("movieshub_test")) {
    throw new Error("Creator Studio E2E tests may only use the isolated local movieshub_test database.");
  }
  await prisma.$connect();
});

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true, email: true },
  });
  const userIds = users.map(user => user.id);
  const profiles = await prisma.creatorProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const profileIds = profiles.map(profile => profile.id);
  await prisma.adminAuditLog.deleteMany({ where: { actorEmail: { in: createdEmails } } });
  await prisma.creatorSubmission.deleteMany({ where: { creatorProfileId: { in: profileIds } } });
  await prisma.creatorProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("verified member applies with the 18+ self-declaration and remains gated pending review", async ({ page }) => {
  const user = await createUser();
  const publicName = "Pending Creator " + randomUUID().slice(0, 8);

  await login(page, user.email);
  await page.goto("/creator/studio");
  await expect(page.getByRole("heading", { name: "Creator Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator application" })).toBeVisible();

  await page.getByLabel("Public creator name").fill(publicName);
  await page.getByLabel("Short bio (optional)").fill("Independent Tamil short-film creator.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Apply as creator" }).click();

  await expect(page.getByRole("status")).toContainText("Creator application submitted for review.");
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(page.getByText("Your application is waiting for admin review.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New metadata submission" })).toHaveCount(0);

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  expect(profile?.publicName).toBe(publicName);
  expect(profile?.adultEligibilityConfirmed).toBe(true);
  expect(profile?.status).toBe("PENDING");

  const blocked = await page.request.post("/api/creator/submissions", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {
      title: "Blocked pending creator submission",
      synopsis: "This metadata must not be accepted before creator approval.",
      originalLanguage: "ta",
      runtimeMinutes: 12,
      releaseYear: new Date().getFullYear(),
      contentType: "SHORT_FILM",
    },
  });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error).toContain("after your application is approved");
});

test("approved creator can save and submit metadata without creating or publishing a movie", async ({ page }) => {
  const user = await createUser();
  const publicName = "Approved Creator " + randomUUID().slice(0, 8);
  const profile = await createCreator(user.id, publicName, "APPROVED");
  const title = "Creator Studio Draft " + randomUUID().slice(0, 8);
  const revisedTitle = title + " Revised";
  const movieCountBefore = await prisma.movie.count();

  await login(page, user.email);
  await page.goto("/creator/studio");
  await expect(page.getByRole("heading", { name: "Creator Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New metadata submission" })).toBeVisible();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();

  await page.getByLabel("Film / episode title").fill(title);
  await page.getByLabel("Synopsis").fill("A carefully written synopsis for an original Tamil short film, created only as an isolated test fixture.");
  await page.getByLabel("Original language code").fill("ta");
  await page.getByLabel("Runtime (minutes)").fill("14");
  await page.getByLabel("Release year").fill(String(new Date().getFullYear()));
  await page.getByRole("button", { name: "Save private draft" }).click();

  await expect(page.getByRole("status")).toContainText("Private draft saved. It is not published or playable.");
  let card = page.locator("article").filter({ hasText: title });
  await expect(card.getByText("DRAFT", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Edit draft" }).click();
  await page.getByLabel("Film / episode title").fill(revisedTitle);
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(page.getByRole("status")).toContainText("Private draft saved. It is not published or playable.");

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Metadata submitted for admin review.");
  card = page.locator("article").filter({ hasText: revisedTitle });
  await expect(card.getByText("SUBMITTED", { exact: true })).toBeVisible();

  const saved = await prisma.creatorSubmission.findMany({
    where: { creatorProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
  expect(saved).toHaveLength(1);
  expect(saved[0].title).toBe(revisedTitle);
  expect(saved[0].status).toBe("SUBMITTED");
  expect(saved[0].submittedAt).not.toBeNull();
  expect(await prisma.movie.count()).toBe(movieCountBefore);
  expect(await prisma.movie.findFirst({ where: { titleEn: revisedTitle } })).toBeNull();
});

test("creator cannot view or modify another creator's private submission", async ({ page }) => {
  const owner = await createUser();
  const other = await createUser();
  const ownerProfile = await createCreator(owner.id, "Owner " + randomUUID().slice(0, 8), "APPROVED");
  const otherProfile = await createCreator(other.id, "Other " + randomUUID().slice(0, 8), "APPROVED");
  const foreignTitle = "Private foreign draft " + randomUUID().slice(0, 8);
  const foreignSubmission = await prisma.creatorSubmission.create({
    data: {
      creatorProfileId: otherProfile.id,
      title: foreignTitle,
      synopsis: "Private metadata owned by a different creator account.",
      originalLanguage: "ta",
      runtimeMinutes: 9,
      releaseYear: new Date().getFullYear(),
      contentType: "SHORT_FILM",
      status: "DRAFT",
    },
  });

  await login(page, owner.email);
  await page.goto("/creator/studio");
  await expect(page.getByRole("heading", { name: "Creator Studio" })).toBeVisible();

  const ownSubmissions = await page.request.get("/api/creator/submissions");
  expect(ownSubmissions.status()).toBe(200);
  expect((await ownSubmissions.json()).submissions).toEqual([]);
  await expect(page.getByText(foreignTitle, { exact: true })).toHaveCount(0);

  const crossAccountUpdate = await page.request.fetch("/api/creator/submissions", {
    method: "PATCH",
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {
      action: "SAVE_DRAFT",
      id: foreignSubmission.id,
      title: "Attempted cross-account edit",
      synopsis: "This cross-account update must be rejected by the server ownership check.",
      originalLanguage: "ta",
      runtimeMinutes: 10,
      releaseYear: new Date().getFullYear(),
      contentType: "SHORT_FILM",
    },
  });
  expect(crossAccountUpdate.status()).toBe(404);

  const unchanged = await prisma.creatorSubmission.findUnique({ where: { id: foreignSubmission.id } });
  expect(unchanged?.title).toBe(foreignTitle);
  expect(unchanged?.status).toBe("DRAFT");
  expect(ownerProfile.status).toBe("APPROVED");
});

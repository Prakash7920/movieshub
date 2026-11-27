import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { AuthProvider, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "NexaFilm-Admin-E2E-Password-2026!";
const domain = "@nexafilm-admin-e2e.test";
const createdEmails: string[] = [];

async function createUser(role: Role = Role.USER) {
  const email = "admin-" + randomUUID() + domain;
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      email,
      name: "NexaFilm Admin E2E",
      passwordHash,
      provider: AuthProvider.CREDENTIALS,
      role,
      isEmailVerified: true,
      profiles: { create: { displayName: "NexaFilm Admin E2E", languagePreference: "en" } },
    },
    select: { id: true, email: true },
  });
  createdEmails.push(email);
  return user;
}

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.beforeAll(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") throw new Error("Admin Creator E2E requires MOVIESHUB_E2E=true.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) || !databaseUrl.pathname.includes("movieshub_test")) {
    throw new Error("Admin Creator E2E tests may only use the isolated local movieshub_test database.");
  }
  await prisma.$connect();
});

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true },
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

test("ordinary verified users cannot access Admin pages or the creator review API", async ({ page }) => {
  const user = await createUser(Role.USER);
  await login(page, user.email);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();

  const response = await page.request.get("/api/admin/creators");
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toBe("Admin access required.");
});

test("Admin can approve creator eligibility and metadata without publishing a catalogue movie", async ({ page }) => {
  const admin = await createUser(Role.ADMIN);
  const pendingCreator = await createUser(Role.USER);
  const submittedCreator = await createUser(Role.USER);
  const pendingName = "Pending Network Creator " + randomUUID().slice(0, 8);
  const submittedName = "Approved Network Creator " + randomUUID().slice(0, 8);
  const submissionTitle = "Admin Review Metadata " + randomUUID().slice(0, 8);

  await prisma.creatorProfile.create({
    data: {
      userId: pendingCreator.id,
      publicName: pendingName,
      bio: "Pending creator application for isolated Admin E2E review.",
      adultEligibilityConfirmed: true,
      status: "PENDING",
    },
  });
  const approvedProfile = await prisma.creatorProfile.create({
    data: {
      userId: submittedCreator.id,
      publicName: submittedName,
      bio: "Approved creator profile used for isolated Admin E2E review.",
      adultEligibilityConfirmed: true,
      status: "APPROVED",
    },
  });
  const submission = await prisma.creatorSubmission.create({
    data: {
      creatorProfileId: approvedProfile.id,
      title: submissionTitle,
      synopsis: "An isolated film metadata entry submitted by an already-approved creator for admin review.",
      originalLanguage: "ta",
      runtimeMinutes: 16,
      releaseYear: new Date().getFullYear(),
      contentType: "SHORT_FILM",
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });
  const movieCountBefore = await prisma.movie.count();

  const dialogs: Array<{ type: string; message: string }> = [];
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === "prompt") await dialog.accept("Reviewed using the isolated admin E2E workflow.");
    else await dialog.accept();
  });

  await login(page, admin.email);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin · Movie Management" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator review queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending creator applications (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Submitted film metadata (1)" })).toBeVisible();

  const pendingCard = page.locator("article").filter({ hasText: pendingName });
  await expect(pendingCard).toContainText(pendingCreator.email);
  await expect(pendingCard).toContainText("18+ self-declaration: Confirmed");
  await pendingCard.getByRole("button", { name: "Approve creator" }).click();

  await expect(page.getByRole("status")).toContainText("Review decision recorded.");
  expect(dialogs[0]?.type).toBe("confirm");
  expect(dialogs[0]?.message).toContain("18+");
  expect(dialogs[1]?.type).toBe("prompt");

  const reviewedProfile = await prisma.creatorProfile.findUnique({ where: { userId: pendingCreator.id } });
  expect(reviewedProfile?.status).toBe("APPROVED");
  expect(reviewedProfile?.reviewedByUserId).toBe(admin.id);
  expect(reviewedProfile?.reviewNotes).toBe("Reviewed using the isolated admin E2E workflow.");

  const submissionCard = page.locator("article").filter({ hasText: submissionTitle });
  await expect(submissionCard).toContainText(submittedName);
  await submissionCard.getByRole("button", { name: "Approve metadata" }).click();
  await expect(page.getByRole("status")).toContainText("Review decision recorded. This does not publish content or enable playback.");

  expect(dialogs[2]?.type).toBe("prompt");
  const reviewedSubmission = await prisma.creatorSubmission.findUnique({ where: { id: submission.id } });
  expect(reviewedSubmission?.status).toBe("APPROVED_FOR_CATALOGUE");
  expect(reviewedSubmission?.reviewedByUserId).toBe(admin.id);
  expect(reviewedSubmission?.reviewNotes).toBe("Reviewed using the isolated admin E2E workflow.");

  const auditEvents = await prisma.adminAuditLog.findMany({
    where: {
      actorEmail: admin.email,
      action: { in: ["CREATOR_PROFILE_APPROVED", "CREATOR_SUBMISSION_APPROVED_FOR_CATALOGUE"] },
    },
  });
  expect(auditEvents).toHaveLength(2);
  expect(await prisma.movie.count()).toBe(movieCountBefore);
  expect(await prisma.movie.findFirst({ where: { titleEn: submissionTitle } })).toBeNull();
});

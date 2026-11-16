import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Role } from "@prisma/client";
import {
  PATCH as reviewAdminLicense,
  POST as saveAdminLicense,
} from "../app/api/admin/licenses/route";
import { prisma } from "../lib/prisma";
import { runWithAdminSessionForIntegrationTest } from "../lib/security/admin-session";

const prismaTest = prisma;
const suffix = randomUUID();
const movieIds: string[] = [];
let adminId: string | null = null;
let memberId: string | null = null;

async function createMovie(label: string): Promise<string> {
  const movie = await prismaTest.movie.create({
    data: {
      titleEn: `Licence route ${label} ${suffix}`,
      titleTa: `Licence route ${label} ${suffix}`,
      slug: `licence-route-${label}-${suffix}`,
      descriptionEn: "Admin licence route integration fixture",
      descriptionTa: "Admin licence route integration fixture",
      posterUrl: "https://example.invalid/poster.jpg",
      backdropUrl: "https://example.invalid/backdrop.jpg",
      language: "en",
      audioLanguages: ["en"],
      subtitleLanguages: [],
      releaseYear: 2026,
      runtimeMinutes: 90,
      ageRating: "U",
      allowedCountries: ["IN"],
      isPublished: true,
    },
    select: { id: true },
  });
  movieIds.push(movie.id);
  return movie.id;
}

function licenseRequest(
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
): Request {
  const origin = "https://admin-license-route-test.example";
  return new Request(`${origin}/api/admin/licenses`, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function withSession<T>(
  userId: string | null,
  callback: () => Promise<T>,
): Promise<T> {
  return runWithAdminSessionForIntegrationTest(
    userId ? { user: { id: userId } } : null,
    callback,
  );
}

async function savePendingLicense(movieId: string) {
  const now = new Date();
  return withSession(adminId, () =>
    saveAdminLicense(licenseRequest("POST", {
      movieId,
      owner: "Integration Rights Holder",
      startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      expiryDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      countries: "IN, SG",
      notes: "Test agreement record",
    })),
  );
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Admin licence route integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Admin licence route integration tests may only use the isolated movieshub_test database.");
  }
  await prismaTest.$connect();
  const admin = await prismaTest.user.create({
    data: { email: `licence-route-admin-${suffix}@example.invalid`, role: Role.ADMIN },
    select: { id: true },
  });
  adminId = admin.id;
  const member = await prismaTest.user.create({
    data: { email: `licence-route-member-${suffix}@example.invalid`, role: Role.USER },
    select: { id: true },
  });
  memberId = member.id;
});

after(async () => {
  if (movieIds.length) await prismaTest.movie.deleteMany({ where: { id: { in: movieIds } } });
  if (adminId) await prismaTest.user.deleteMany({ where: { id: adminId } });
  if (memberId) await prismaTest.user.deleteMany({ where: { id: memberId } });
  // AdminAuditLog is append-only: retain audit evidence after fixture cleanup.
  await prismaTest.$disconnect();
});

test("admin licence POST rejects unauthenticated and non-admin sessions without mutation", async () => {
  const movieId = await createMovie("denied");
  const body = {
    movieId,
    owner: "Unauthorized Rights Holder",
    startDate: new Date(Date.now() - 60_000).toISOString(),
    expiryDate: new Date(Date.now() + 86_400_000).toISOString(),
    countries: "IN",
  };

  const unauthenticated = await withSession(null, () =>
    saveAdminLicense(licenseRequest("POST", body)),
  );
  assert.ok(unauthenticated, "unauthenticated licence request must return a response");
  assert.equal(unauthenticated.status, 401);

  const nonAdmin = await withSession(memberId, () =>
    saveAdminLicense(licenseRequest("POST", body)),
  );
  assert.ok(nonAdmin, "non-admin licence request must return a response");
  assert.equal(nonAdmin.status, 403);

  const license = await prismaTest.license.findUnique({ where: { movieId } });
  assert.equal(license, null, "rejected requests must not create a licence");
  const auditCount = await prismaTest.adminAuditLog.count({
    where: { action: "LICENSE_SAVED_PENDING", resourceType: "License", metadata: { path: ["movieId"], equals: movieId } },
  });
  assert.equal(auditCount, 0, "rejected requests must not create an audit event");
});

test("admin licence POST saves pending rights, unpublishes the movie and writes an audit event", async () => {
  const movieId = await createMovie("pending");
  const response = await savePendingLicense(movieId);
  assert.ok(response, "admin licence save must return a response");
  assert.equal(response.status, 201, await response.clone().text());

  const license = await prismaTest.license.findUnique({
    where: { movieId },
    select: { id: true, owner: true, status: true, allowedCountries: true },
  });
  assert.ok(license, "admin route must persist the licence");
  assert.equal(license.status, "PENDING");
  assert.equal(license.owner, "Integration Rights Holder");
  assert.deepEqual(license.allowedCountries, ["IN", "SG"]);

  const movie = await prismaTest.movie.findUnique({
    where: { id: movieId },
    select: { isPublished: true, contentStatus: true },
  });
  assert.ok(movie);
  assert.equal(movie.isPublished, false);
  assert.equal(movie.contentStatus, "UNPUBLISHED");

  const audit = await prismaTest.adminAuditLog.findFirst({
    where: { actorUserId: adminId!, action: "LICENSE_SAVED_PENDING", resourceType: "License", resourceId: license.id },
    select: { actorEmail: true, metadata: true },
  });
  assert.ok(audit, "successful licence save must create its matching audit event");
  assert.equal(audit.actorEmail, `licence-route-admin-${suffix}@example.invalid`);
  assert.deepEqual(audit.metadata, { movieId });
});

test("admin licence PATCH approves only a current verified licence and audits the approval", async () => {
  const movieId = await createMovie("approve");
  const saved = await savePendingLicense(movieId);
  assert.ok(saved);
  assert.equal(saved.status, 201, await saved.clone().text());

  const response = await withSession(adminId, () =>
    reviewAdminLicense(licenseRequest("PATCH", {
      movieId,
      status: "ACTIVE",
      confirmed: true,
      agreementReference: "SIGNED-AGREEMENT-2026-001",
    })),
  );
  assert.ok(response, "admin approval must return a response");
  assert.equal(response.status, 200, await response.clone().text());

  const license = await prismaTest.license.findUnique({
    where: { movieId },
    select: { status: true, notes: true },
  });
  assert.ok(license);
  assert.equal(license.status, "ACTIVE");
  assert.match(license.notes ?? "", /SIGNED-AGREEMENT-2026-001/);

  const movie = await prismaTest.movie.findUnique({
    where: { id: movieId },
    select: { licenseOwner: true, allowedCountries: true, downloadPermission: true },
  });
  assert.ok(movie);
  assert.equal(movie.licenseOwner, "Integration Rights Holder");
  assert.deepEqual(movie.allowedCountries, ["IN", "SG"]);
  assert.equal(movie.downloadPermission, false);

  const audit = await prismaTest.adminAuditLog.findFirst({
    where: { actorUserId: adminId!, action: "LICENSE_APPROVED", resourceType: "License", resourceId: movieId },
    select: { actorEmail: true, metadata: true },
  });
  assert.ok(audit, "approval must create its matching audit event");
  assert.equal(audit.actorEmail, `licence-route-admin-${suffix}@example.invalid`);
  assert.deepEqual(audit.metadata, { agreementReferenceRecorded: true });
});

test("admin licence PATCH rejects a licence with a recorded reason and audits the rejection", async () => {
  const movieId = await createMovie("reject");
  const saved = await savePendingLicense(movieId);
  assert.ok(saved);
  assert.equal(saved.status, 201, await saved.clone().text());

  const response = await withSession(adminId, () =>
    reviewAdminLicense(licenseRequest("PATCH", {
      movieId,
      status: "REJECTED",
      reason: "Agreement evidence is incomplete",
    })),
  );
  assert.ok(response, "admin rejection must return a response");
  assert.equal(response.status, 200, await response.clone().text());

  const license = await prismaTest.license.findUnique({
    where: { movieId },
    select: { status: true, notes: true },
  });
  assert.ok(license);
  assert.equal(license.status, "REJECTED");
  assert.match(license.notes ?? "", /Agreement evidence is incomplete/);

  const audit = await prismaTest.adminAuditLog.findFirst({
    where: { actorUserId: adminId!, action: "LICENSE_REJECTED", resourceType: "License", resourceId: movieId },
    select: { actorEmail: true, metadata: true },
  });
  assert.ok(audit, "rejection must create its matching audit event");
  assert.equal(audit.actorEmail, `licence-route-admin-${suffix}@example.invalid`);
  assert.deepEqual(audit.metadata, { rejectionReasonRecorded: true });
});

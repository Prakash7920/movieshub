import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Role } from "@prisma/client";
import { POST as createAdminMovie } from "../app/api/admin/movies/route";
import { prisma } from "../lib/prisma";
import { runWithAdminSessionForIntegrationTest } from "../lib/security/admin-session";

const prismaTest = prisma;
const suffix = randomUUID();
const slug = `route-admin-${suffix}`;
const genreName = `Route Test ${suffix}`;
const genreSlug = genreName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
let adminId: string | null = null;
let memberId: string | null = null;

function postRequest(): Request {
  const origin = "https://admin-route-test.example";
  return new Request(`${origin}/api/admin/movies`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      titleEn: "Admin route integration",
      titleTa: "Admin route integration",
      slug,
      descriptionEn: "Integration test movie",
      descriptionTa: "Integration test movie",
      posterUrl: "https://example.invalid/poster.jpg",
      backdropUrl: "https://example.invalid/backdrop.jpg",
      language: "en",
      ageRating: "U",
      releaseYear: 2026,
      runtimeMinutes: 90,
      rating: 0,
      genre: genreName,
      audioLanguages: ["en"],
      subtitleLanguages: [],
      allowedCountries: ["IN"],
    }),
  });
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Admin route integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Admin route integration tests may only use the isolated movieshub_test database.");
  }
  await prismaTest.$connect();
  const admin = await prismaTest.user.create({
    data: { email: `route-admin-${suffix}@example.invalid`, role: Role.ADMIN },
    select: { id: true },
  });
  adminId = admin.id;
  const member = await prismaTest.user.create({
    data: { email: `route-member-${suffix}@example.invalid`, role: Role.USER },
    select: { id: true },
  });
  memberId = member.id;
});

after(async () => {
  await prismaTest.movie.deleteMany({ where: { slug } });
  await prismaTest.genre.deleteMany({ where: { slug: genreSlug } });
  if (adminId) await prismaTest.user.deleteMany({ where: { id: adminId } });
  if (memberId) await prismaTest.user.deleteMany({ where: { id: memberId } });
  await prismaTest.$disconnect();
});

test("admin movie POST rejects unauthenticated and non-admin sessions without mutation", async () => {
  const unauthenticated = await runWithAdminSessionForIntegrationTest(null, () =>
    createAdminMovie(postRequest()),
  );
  assert.ok(unauthenticated, "unauthenticated route invocation must return a response");
  assert.equal(unauthenticated.status, 401);

  const nonAdmin = await runWithAdminSessionForIntegrationTest(
    { user: { id: memberId! } },
    () => createAdminMovie(postRequest()),
  );
  assert.ok(nonAdmin, "non-admin route invocation must return a response");
  assert.equal(nonAdmin.status, 403);

  const movie = await prismaTest.movie.findUnique({ where: { slug }, select: { id: true } });
  assert.equal(movie, null, "rejected requests must not create a movie");

  const auditCount = await prismaTest.adminAuditLog.count({
    where: { action: "MOVIE_DRAFT_CREATED", metadata: { path: ["slug"], equals: slug } },
  });
  assert.equal(auditCount, 0, "rejected requests must not create an audit event");
});

test("admin movie POST creates a draft and its audit event through the real route handler", async () => {
  const response = await runWithAdminSessionForIntegrationTest(
    { user: { id: adminId! } },
    () => createAdminMovie(postRequest()),
  );
  assert.ok(response, "admin route invocation must return a response");
  assert.equal(response.status, 201, await response.clone().text());

  const movie = await prismaTest.movie.findUnique({
    where: { slug },
    select: { id: true, isPublished: true, contentStatus: true },
  });
  assert.ok(movie, "successful admin route must persist the movie");
  assert.equal(movie.isPublished, false);
  assert.equal(movie.contentStatus, "DRAFT");

  const audit = await prismaTest.adminAuditLog.findFirst({
    where: {
      actorUserId: adminId!,
      action: "MOVIE_DRAFT_CREATED",
      resourceType: "Movie",
      resourceId: movie.id,
    },
    select: { id: true, actorEmail: true },
  });
  assert.ok(audit, "successful admin route must persist the matching audit event");
  assert.equal(audit.actorEmail, `route-admin-${suffix}@example.invalid`);
});


test("admin movie POST rejects cross-origin, non-JSON and oversized requests before authorization", async () => {
  const origin = "https://admin-route-test.example";
  const guardSlug = `guard-${randomUUID()}`;
  const body = JSON.stringify({ slug: guardSlug });
  const crossOrigin = new Request("https://admin-route-test.example/api/admin/movies", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body,
  });
  const wrongContentType = new Request("https://admin-route-test.example/api/admin/movies", {
    method: "POST",
    headers: { origin, "content-type": "text/plain" },
    body,
  });
  const oversized = new Request("https://admin-route-test.example/api/admin/movies", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "content-length": "32769" },
    body,
  });

  const crossOriginResponse = await createAdminMovie(crossOrigin);
  assert.equal(crossOriginResponse.status, 403, await crossOriginResponse.clone().text());
  assert.equal(crossOriginResponse.headers.get("cache-control"), "no-store");

  const wrongTypeResponse = await createAdminMovie(wrongContentType);
  assert.equal(wrongTypeResponse.status, 415, await wrongTypeResponse.clone().text());

  const oversizedResponse = await createAdminMovie(oversized);
  assert.equal(oversizedResponse.status, 415, await oversizedResponse.clone().text());

  assert.equal(await prismaTest.movie.count({ where: { slug: guardSlug } }), 0);
  assert.equal(await prismaTest.adminAuditLog.count({
    where: { action: "MOVIE_DRAFT_CREATED", metadata: { path: ["slug"], equals: guardSlug } },
  }), 0);
});

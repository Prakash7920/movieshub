import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { GET as getProfile, PATCH as updateProfile } from "../app/api/profile/route";
import { prisma } from "../lib/prisma";
import { runWithApiSessionForIntegrationTest } from "../lib/security/api-session";

const suffix = randomUUID();
const primaryEmail = `profile-primary-${suffix}@example.invalid`;
const otherEmail = `profile-other-${suffix}@example.invalid`;
let primaryUserId: string | null = null;
let otherUserId: string | null = null;

function patchRequest(
  body: unknown,
  origin = "https://profile-route-test.example",
): Request {
  const requestOrigin = "https://profile-route-test.example";
  return new Request(`${requestOrigin}/api/profile`, {
    method: "PATCH",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Profile route integration tests require MOVIESHUB_E2E=true.");
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Profile route integration tests may only use the isolated movieshub_test database.");
  }

  await prisma.$connect();
  const primary = await prisma.user.create({
    data: {
      email: primaryEmail,
      name: "Original Profile Name",
      isEmailVerified: true,
    },
    select: { id: true },
  });
  primaryUserId = primary.id;

  const other = await prisma.user.create({
    data: {
      email: otherEmail,
      name: "Other Account",
      isEmailVerified: true,
      profiles: {
        create: { displayName: "Other Account", languagePreference: "en" },
      },
    },
    select: { id: true },
  });
  otherUserId = other.id;
});

after(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [primaryEmail, otherEmail] } },
  });
  await prisma.$disconnect();
});

test("profile GET requires an authenticated session", async () => {
  const response = await runWithApiSessionForIntegrationTest(null, () => getProfile());
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
});

test("profile GET returns only the signed-in user's profile with safe defaults", async () => {
  const response = await runWithApiSessionForIntegrationTest(
    { user: { id: primaryUserId! } },
    () => getProfile(),
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { profile: { displayName: string; email: string; languagePreference: string } };
  assert.deepEqual(body.profile, {
    displayName: "Original Profile Name",
    email: primaryEmail,
    isEmailVerified: true,
    languagePreference: "en",
  });
});

test("profile PATCH rejects cross-origin requests and invalid input", async () => {
  const crossOrigin = await runWithApiSessionForIntegrationTest(
    { user: { id: primaryUserId! } },
    () => updateProfile(patchRequest(
      { displayName: "New Name", languagePreference: "ta" },
      "https://attacker.example",
    )),
  );
  assert.equal(crossOrigin.status, 403);

  const invalid = await runWithApiSessionForIntegrationTest(
    { user: { id: primaryUserId! } },
    () => updateProfile(patchRequest({ displayName: "A", languagePreference: "fr" })),
  );
  assert.equal(invalid.status, 400);
});

test("profile PATCH persists display name and language without changing another account", async () => {
  const response = await runWithApiSessionForIntegrationTest(
    { user: { id: primaryUserId! } },
    () => updateProfile(patchRequest({
      displayName: "Tamil Cinema Fan",
      languagePreference: "ta",
    })),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);

  const primary = await prisma.user.findUnique({
    where: { id: primaryUserId! },
    select: {
      name: true,
      profiles: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { displayName: true, languagePreference: true },
      },
    },
  });
  assert.equal(primary?.name, "Tamil Cinema Fan");
  assert.equal(primary?.profiles[0]?.displayName, "Tamil Cinema Fan");
  assert.equal(primary?.profiles[0]?.languagePreference, "ta");

  const other = await prisma.user.findUnique({
    where: { id: otherUserId! },
    select: {
      name: true,
      profiles: { select: { displayName: true, languagePreference: true } },
    },
  });
  assert.equal(other?.name, "Other Account");
  assert.deepEqual(other?.profiles, [{ displayName: "Other Account", languagePreference: "en" }]);

  const reread = await runWithApiSessionForIntegrationTest(
    { user: { id: primaryUserId! } },
    () => getProfile(),
  );
  const rereadBody = await reread.json() as { profile: { displayName: string; languagePreference: string } };
  assert.deepEqual(rereadBody.profile, {
    displayName: "Tamil Cinema Fan",
    email: primaryEmail,
    isEmailVerified: true,
    languagePreference: "ta",
  });
});

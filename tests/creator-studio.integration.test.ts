import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Role } from "@prisma/client";
import {
  GET as getCreatorProfile,
  POST as applyCreatorProfile,
} from "../app/api/creator/profile/route";
import {
  GET as getCreatorSubmissions,
  PATCH as updateCreatorSubmission,
  POST as createCreatorSubmission,
} from "../app/api/creator/submissions/route";
import {
  GET as getAdminCreatorQueue,
  PATCH as reviewAdminCreatorItem,
} from "../app/api/admin/creators/route";
import { prisma } from "../lib/prisma";
import { runWithApiSessionForIntegrationTest } from "../lib/security/api-session";
import { runWithAdminSessionForIntegrationTest } from "../lib/security/admin-session";

const prismaTest = prisma;
const suffix = randomUUID();
let creatorOneId: string | null = null;
let creatorTwoId: string | null = null;
let unverifiedId: string | null = null;
let bannedId: string | null = null;
let adminId: string | null = null;
let creatorOneProfileId: string | null = null;
let creatorTwoProfileId: string | null = null;
let submissionOneId: string | null = null;
let submissionTwoId: string | null = null;

function jsonRequest(url: string, method: "POST" | "PATCH", body: Record<string, unknown>, origin = new URL(url).origin): Request {
  return new Request(url, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function profileRequest(body: Record<string, unknown>, origin?: string) {
  const url = "https://creator-studio-test.example/api/creator/profile";
  return jsonRequest(url, "POST", body, origin);
}

function submissionRequest(method: "POST" | "PATCH", body: Record<string, unknown>, origin?: string) {
  const url = "https://creator-studio-test.example/api/creator/submissions";
  return jsonRequest(url, method, body, origin);
}

function adminReviewRequest(body: Record<string, unknown>) {
  const url = "https://creator-studio-test.example/api/admin/creators";
  return jsonRequest(url, "PATCH", body);
}

async function asApi(userId: string | null, callback: () => Promise<Response | undefined>): Promise<Response> {
  const response = await runWithApiSessionForIntegrationTest(userId ? { user: { id: userId } } : null, callback);
  assert.ok(response, "creator API route must return a response");
  return response;
}

async function asAdmin(userId: string | null, callback: () => Promise<Response | undefined>): Promise<Response> {
  const response = await runWithAdminSessionForIntegrationTest(userId ? { user: { id: userId } } : null, callback);
  assert.ok(response, "admin API route must return a response");
  return response;
}

const metadata = (title: string) => ({
  title,
  synopsis: "An original independent Tamil short film submitted for metadata review.",
  originalLanguage: "ta",
  runtimeMinutes: 12,
  releaseYear: 2026,
  contentType: "SHORT_FILM",
});

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Creator Studio integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Creator Studio integration tests may only use the isolated movieshub_test database.");
  }

  await prismaTest.$connect();
  const users = await prismaTest.user.createManyAndReturn({
    data: [
      { email: `creator-one-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true },
      { email: `creator-two-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true },
      { email: `creator-unverified-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: false },
      { email: `creator-banned-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true, isBanned: true },
      { email: `creator-admin-${suffix}@example.invalid`, role: Role.ADMIN, isEmailVerified: true },
    ],
    select: { id: true, email: true },
  });
  creatorOneId = users.find(user => user.email.startsWith("creator-one-"))!.id;
  creatorTwoId = users.find(user => user.email.startsWith("creator-two-"))!.id;
  unverifiedId = users.find(user => user.email.startsWith("creator-unverified-"))!.id;
  bannedId = users.find(user => user.email.startsWith("creator-banned-"))!.id;
  adminId = users.find(user => user.email.startsWith("creator-admin-"))!.id;
});

after(async () => {
  // Delete creator-owned rows first so reviewer RESTRICT references are removed
  // before the isolated test admin account is deleted.
  if (creatorOneId) await prismaTest.user.deleteMany({ where: { id: creatorOneId } });
  if (creatorTwoId) await prismaTest.user.deleteMany({ where: { id: creatorTwoId } });
  if (unverifiedId) await prismaTest.user.deleteMany({ where: { id: unverifiedId } });
  if (bannedId) await prismaTest.user.deleteMany({ where: { id: bannedId } });
  if (adminId) await prismaTest.user.deleteMany({ where: { id: adminId } });
  // AdminAuditLog is append-only; the test deliberately leaves audit evidence.
  await prismaTest.$disconnect();
});

test("creator application, metadata submission and admin review are ownership-scoped and never publish media", async () => {
  const unauthenticated = await asApi(null, () => applyCreatorProfile(profileRequest({ publicName: "Unauthenticated Creator", adultEligibilityConfirmed: true })));
  assert.equal(unauthenticated.status, 401);

  const unverified = await asApi(unverifiedId, () => applyCreatorProfile(profileRequest({ publicName: "Unverified Creator", adultEligibilityConfirmed: true })));
  assert.equal(unverified.status, 403);

  const banned = await asApi(bannedId, () => applyCreatorProfile(profileRequest({ publicName: "Banned Creator", adultEligibilityConfirmed: true })));
  assert.equal(banned.status, 403);

  const crossOrigin = await asApi(creatorOneId, () => applyCreatorProfile(profileRequest({ publicName: "Cross Origin Creator", adultEligibilityConfirmed: true }, "https://attacker.example")));
  assert.equal(crossOrigin.status, 403);

  const invalidApplication = await asApi(creatorOneId, () => applyCreatorProfile(profileRequest({
    publicName: "Valid Name",
    adultEligibilityConfirmed: true,
    unexpectedRole: "ADMIN",
  })));
  assert.equal(invalidApplication.status, 400);

  const missingAdultDeclaration = await asApi(creatorOneId, () => applyCreatorProfile(profileRequest({
    publicName: "No Adult Declaration",
    adultEligibilityConfirmed: false,
  })));
  assert.equal(missingAdultDeclaration.status, 400);

  const applyOne = await asApi(creatorOneId, () => applyCreatorProfile(profileRequest({
    publicName: "Creator One",
    bio: "Independent Tamil filmmaker.",
    adultEligibilityConfirmed: true,
  })));
  assert.equal(applyOne.status, 201, await applyOne.clone().text());
  const applyOneData = await applyOne.json() as { creatorProfile: { id: string; status: string } };
  creatorOneProfileId = applyOneData.creatorProfile.id;
  assert.equal(applyOneData.creatorProfile.status, "PENDING");

  const duplicateApplication = await asApi(creatorOneId, () => applyCreatorProfile(profileRequest({ publicName: "Creator One Again", adultEligibilityConfirmed: true })));
  assert.equal(duplicateApplication.status, 409);

  const applyTwo = await asApi(creatorTwoId, () => applyCreatorProfile(profileRequest({ publicName: "Creator Two", adultEligibilityConfirmed: true })));
  assert.equal(applyTwo.status, 201, await applyTwo.clone().text());
  const applyTwoData = await applyTwo.json() as { creatorProfile: { id: string } };
  creatorTwoProfileId = applyTwoData.creatorProfile.id;

  const notYetApproved = await asApi(creatorOneId, () => createCreatorSubmission(submissionRequest("POST", metadata("Before Approval"))));
  assert.equal(notYetApproved.status, 403);

  const adminUnauthenticated = await asAdmin(null, () => getAdminCreatorQueue(new Request("https://creator-studio-test.example/api/admin/creators")));
  assert.equal(adminUnauthenticated.status, 401);
  const adminNonAdmin = await asAdmin(creatorOneId, () => getAdminCreatorQueue(new Request("https://creator-studio-test.example/api/admin/creators")));
  assert.equal(adminNonAdmin.status, 403);

  const queueBeforeApproval = await asAdmin(adminId, () => getAdminCreatorQueue(new Request("https://creator-studio-test.example/api/admin/creators")));
  assert.equal(queueBeforeApproval.status, 200);
  const queueData = await queueBeforeApproval.json() as { creatorProfiles: Array<{ id: string }> };
  assert.ok(queueData.creatorProfiles.some(item => item.id === creatorOneProfileId));

  const approveWithoutAgeReview = await asAdmin(adminId, () => reviewAdminCreatorItem(adminReviewRequest({
    resourceType: "CREATOR_PROFILE",
    id: creatorOneProfileId!,
    status: "APPROVED",
    notes: "Creator application reviewed and accepted.",
  })));
  assert.equal(approveWithoutAgeReview.status, 400);

  const approveOne = await asAdmin(adminId, () => reviewAdminCreatorItem(adminReviewRequest({
    resourceType: "CREATOR_PROFILE",
    id: creatorOneProfileId!,
    status: "APPROVED",
    ageVerificationReviewed: true,
    notes: "18+ eligibility independently checked through the approved restricted process.",
  })));
  assert.equal(approveOne.status, 200, await approveOne.clone().text());

  const approveTwo = await asAdmin(adminId, () => reviewAdminCreatorItem(adminReviewRequest({
    resourceType: "CREATOR_PROFILE",
    id: creatorTwoProfileId!,
    status: "APPROVED",
    notes: "Creator application reviewed and accepted.",
  })));
  assert.equal(approveTwo.status, 200, await approveTwo.clone().text());

  const invalidMediaPayload = await asApi(creatorOneId, () => createCreatorSubmission(submissionRequest("POST", {
    ...metadata("Media Payload Must Fail"),
    videoUrl: "https://example.invalid/source.mp4",
  })));
  assert.equal(invalidMediaPayload.status, 400);

  const createdDraft = await asApi(creatorOneId, () => createCreatorSubmission(submissionRequest("POST", metadata("Creator One Short Film"))));
  assert.equal(createdDraft.status, 201, await createdDraft.clone().text());
  const draftData = await createdDraft.json() as { submission: { id: string; status: string } };
  submissionOneId = draftData.submission.id;
  assert.equal(draftData.submission.status, "DRAFT");

  const savedDraft = await asApi(creatorOneId, () => updateCreatorSubmission(submissionRequest("PATCH", {
    action: "SAVE_DRAFT",
    id: submissionOneId!,
    ...metadata("Creator One Updated Short Film"),
  })));
  assert.equal(savedDraft.status, 200, await savedDraft.clone().text());

  const otherCreatorCannotReadOwnListOfFirstCreator = await asApi(creatorTwoId, () => getCreatorSubmissions());
  assert.equal(otherCreatorCannotReadOwnListOfFirstCreator.status, 200);
  const otherCreatorCannotMutateFirstCreatorDraft = await asApi(creatorTwoId, () => updateCreatorSubmission(submissionRequest("PATCH", {
    action: "SUBMIT_FOR_REVIEW",
    id: submissionOneId!,
  })));
  assert.equal(otherCreatorCannotMutateFirstCreatorDraft.status, 404);

  const submitted = await asApi(creatorOneId, () => updateCreatorSubmission(submissionRequest("PATCH", {
    action: "SUBMIT_FOR_REVIEW",
    id: submissionOneId!,
  })));
  assert.equal(submitted.status, 200, await submitted.clone().text());
  const submittedData = await submitted.json() as { submission: { status: string } };
  assert.equal(submittedData.submission.status, "SUBMITTED");

  const queueWithSubmission = await asAdmin(adminId, () => getAdminCreatorQueue(new Request("https://creator-studio-test.example/api/admin/creators")));
  assert.equal(queueWithSubmission.status, 200);
  const reviewQueueData = await queueWithSubmission.json() as { submissions: Array<{ id: string }> };
  assert.ok(reviewQueueData.submissions.some(item => item.id === submissionOneId));

  const approvedMetadata = await asAdmin(adminId, () => reviewAdminCreatorItem(adminReviewRequest({
    resourceType: "CREATOR_SUBMISSION",
    id: submissionOneId!,
    status: "APPROVED_FOR_CATALOGUE",
    notes: "Metadata approved for a separate rights and catalogue review.",
  })));
  assert.equal(approvedMetadata.status, 200, await approvedMetadata.clone().text());

  const persistedSubmission = await prismaTest.creatorSubmission.findUnique({
    where: { id: submissionOneId! },
    select: { status: true, reviewedByUserId: true, reviewedAt: true },
  });
  assert.ok(persistedSubmission);
  assert.equal(persistedSubmission.status, "APPROVED_FOR_CATALOGUE");
  assert.equal(persistedSubmission.reviewedByUserId, adminId);
  assert.ok(persistedSubmission.reviewedAt instanceof Date);

  const noMovieCreated = await prismaTest.movie.findFirst({
    where: { titleEn: "Creator One Updated Short Film" },
    select: { id: true, isPublished: true, contentStatus: true, videoUrl: true, cloudflareStreamUid: true },
  });
  assert.equal(noMovieCreated, null, "metadata approval must not create or publish a Movie");

  const lockedSubmission = await asApi(creatorOneId, () => updateCreatorSubmission(submissionRequest("PATCH", {
    action: "SAVE_DRAFT",
    id: submissionOneId!,
    ...metadata("Attempt To Edit Approved Submission"),
  })));
  assert.equal(lockedSubmission.status, 409);

  const missingReviewReason = await asAdmin(adminId, () => reviewAdminCreatorItem(adminReviewRequest({
    resourceType: "CREATOR_SUBMISSION",
    id: randomUUID(),
    status: "REJECTED",
    notes: "  ",
  })));
  assert.equal(missingReviewReason.status, 400);

  const creatorAudit = await prismaTest.adminAuditLog.count({
    where: {
      resourceType: "CreatorProfile",
      resourceId: creatorOneProfileId,
      action: "CREATOR_PROFILE_APPROVED",
      actorUserId: adminId,
    },
  });
  assert.equal(creatorAudit, 1);

  const submissionAudit = await prismaTest.adminAuditLog.count({
    where: {
      resourceType: "CreatorSubmission",
      resourceId: submissionOneId,
      action: "CREATOR_SUBMISSION_APPROVED_FOR_CATALOGUE",
      actorUserId: adminId,
    },
  });
  assert.equal(submissionAudit, 1);
});

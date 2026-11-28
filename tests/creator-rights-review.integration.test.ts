import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { CreatorContentType, CreatorMediaRole, CreatorProfileStatus, CreatorSubmissionRevisionStatus, CreatorSubmissionStatus, Role } from "@prisma/client";
import { GET as getRightsReviews, PATCH as decideRightsReview, POST as createRightsReview } from "../app/api/admin/creator-rights-reviews/route";
import { POST as createUploadIntent } from "../app/api/creator/upload-intents/route";
import { resolveCreatorUploadRightsGate } from "../lib/creator/upload-rights-gate";
import { prisma } from "../lib/prisma";
import { runWithAdminSessionForIntegrationTest } from "../lib/security/admin-session";
import { runWithApiSessionForIntegrationTest } from "../lib/security/api-session";

const prismaTest = prisma;
const suffix = randomUUID();
let adminSubmitterId: string | null = null;
let adminReviewerId: string | null = null;
let memberId: string | null = null;
let creatorId: string | null = null;
let creatorProfileId: string | null = null;
let revisionId: string | null = null;

function request(path: string, method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>): Request {
  const origin = "https://creator-rights-review-test.example";
  return new Request(origin + path, {
    method, headers: { origin, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function asAdmin<T>(userId: string | null, callback: () => Promise<T>): Promise<T> {
  return runWithAdminSessionForIntegrationTest(userId ? { user: { id: userId } } : null, callback);
}
async function asCreator<T>(userId: string | null, callback: () => Promise<T>): Promise<T> {
  return runWithApiSessionForIntegrationTest(userId ? { user: { id: userId } } : null, callback);
}
function rightsBody(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    submissionRevisionId: revisionId!,
    rightsHolder: "Integration Rights Holder",
    evidenceReference: "LegalVault/NexaFilm/CREATOR-RIGHTS-001",
    evidenceSha256: "a".repeat(64),
    ownerApprovalReference: "OwnerApprovals/NexaFilm/001",
    legalApprovalReference: "LegalReviews/NexaFilm/001",
    allowedTerritories: ["IN", "SG"],
    allowedLanguages: ["ta", "en"],
    permittedMediaRoles: ["PRIMARY_VIDEO", "TRAILER"],
    startDate: new Date(now - 60_000).toISOString(),
    expiryDate: new Date(now + 7 * 86_400_000).toISOString(),
    uploadAllowed: true, hostingAllowed: true, processingAllowed: true, ottVodStreamingAllowed: true,
    ...overrides,
  };
}
function creatorIntentBody(overrides: Record<string, unknown> = {}) {
  return {
    submissionRevisionId: revisionId!, mediaRole: "PRIMARY_VIDEO", territoryCode: "IN",
    idempotencyKey: "rights-review-intent-" + randomUUID(), ...overrides,
  };
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") throw new Error("Creator rights-review tests require MOVIESHUB_E2E=true.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
      !/(movieshub_test|nexafilm_migration_test)/.test(databaseUrl.pathname)) {
    throw new Error("Creator rights-review tests may only use an isolated localhost test database.");
  }
  await prismaTest.$connect();

  const users = await prismaTest.user.createManyAndReturn({
    data: [
      { email: "rights-submitter-" + suffix + "@example.invalid", role: Role.ADMIN, isEmailVerified: true },
      { email: "rights-reviewer-" + suffix + "@example.invalid", role: Role.SUPERADMIN, isEmailVerified: true },
      { email: "rights-member-" + suffix + "@example.invalid", role: Role.USER, isEmailVerified: true },
      { email: "rights-creator-" + suffix + "@example.invalid", role: Role.USER, isEmailVerified: true },
    ],
    select: { id: true, email: true },
  });
  adminSubmitterId = users.find(user => user.email.startsWith("rights-submitter-"))!.id;
  adminReviewerId = users.find(user => user.email.startsWith("rights-reviewer-"))!.id;
  memberId = users.find(user => user.email.startsWith("rights-member-"))!.id;
  creatorId = users.find(user => user.email.startsWith("rights-creator-"))!.id;
  const profile = await prismaTest.creatorProfile.create({
    data: { userId: creatorId!, publicName: "Rights Review Creator " + suffix.slice(0, 6), adultEligibilityConfirmed: true, status: CreatorProfileStatus.APPROVED },
    select: { id: true },
  });
  creatorProfileId = profile.id;
  const submission = await prismaTest.creatorSubmission.create({
    data: {
      creatorProfileId: creatorProfileId!, title: "Rights Review Integration Work",
      synopsis: "Synthetic rights-review fixture.", originalLanguage: "ta", runtimeMinutes: 12,
      releaseYear: 2026, contentType: CreatorContentType.SHORT_FILM,
      status: CreatorSubmissionStatus.APPROVED_FOR_CATALOGUE, submittedAt: new Date(),
      reviewedAt: new Date(), reviewedByUserId: adminReviewerId!,
    },
    select: { id: true },
  });
  const revision = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: submission.id, revisionNumber: 1, title: "Rights Review Integration Work",
      synopsis: "Exact immutable revision fixture.", originalLanguage: "ta", runtimeMinutes: 12,
      releaseYear: 2026, contentType: CreatorContentType.SHORT_FILM,
      status: CreatorSubmissionRevisionStatus.APPROVED_FOR_CATALOGUE, submittedAt: new Date(),
      reviewedAt: new Date(), reviewedByUserId: adminReviewerId!,
    },
    select: { id: true },
  });
  revisionId = revision.id;
});

after(async () => {
  try {
    if (creatorId) await prismaTest.user.deleteMany({ where: { id: creatorId } });
    if (memberId) await prismaTest.user.deleteMany({ where: { id: memberId } });
    if (adminSubmitterId) await prismaTest.user.deleteMany({ where: { id: adminSubmitterId } });
    if (adminReviewerId) await prismaTest.user.deleteMany({ where: { id: adminReviewerId } });
  } finally { await prismaTest.$disconnect(); }
});

test("C3-I4 requires independent admin review and gates exact revision, role and territory", async () => {
  assert.ok(adminSubmitterId && adminReviewerId && memberId && creatorId && revisionId);
  const unauthenticated = await asAdmin(null, () => getRightsReviews(request("/api/admin/creator-rights-reviews", "GET")));
  assert.ok(unauthenticated); assert.equal(unauthenticated.status, 401);
  const nonAdmin = await asAdmin(memberId, () => getRightsReviews(request("/api/admin/creator-rights-reviews", "GET")));
  assert.ok(nonAdmin); assert.equal(nonAdmin.status, 403);

  const invalidReference = await asAdmin(adminSubmitterId, () => createRightsReview(request(
    "/api/admin/creator-rights-reviews", "POST", rightsBody({ evidenceReference: "https://outside.invalid/contract.pdf" }),
  )));
  assert.ok(invalidReference); assert.equal(invalidReference.status, 400);

  const created = await asAdmin(adminSubmitterId, () => createRightsReview(request("/api/admin/creator-rights-reviews", "POST", rightsBody())));
  assert.ok(created); assert.equal(created.status, 201, await created.clone().text());
  const createdData = await created.json() as { reviewId: string; sequence: number; status: string };
  assert.equal(createdData.status, "PENDING"); assert.equal(createdData.sequence, 1);

  const pending = await prismaTest.creatorRightsReview.findUnique({ where: { id: createdData.reviewId } });
  assert.ok(pending); assert.equal(pending.submissionRevisionId, revisionId);
  assert.equal(pending.submittedByUserId, adminSubmitterId); assert.equal(pending.reviewedByUserId, null);
  assert.equal(pending.downloadsAllowed, false);

  const createdAudit = await prismaTest.adminAuditLog.findFirst({
    where: { resourceType: "CreatorRightsReview", resourceId: pending.id, action: "CREATOR_RIGHTS_REVIEW_CREATED" },
    select: { actorUserId: true, metadata: true },
  });
  assert.ok(createdAudit); assert.equal(createdAudit.actorUserId, adminSubmitterId);
  assert.equal(JSON.stringify(createdAudit.metadata).includes(pending.evidenceReference), false);
  assert.equal(JSON.stringify(createdAudit.metadata).includes(pending.ownerApprovalReference), false);
  assert.equal(JSON.stringify(createdAudit.metadata).includes(pending.legalApprovalReference), false);

  const blocked = await asCreator(creatorId, () => createUploadIntent(request("/api/creator/upload-intents", "POST", creatorIntentBody())));
  assert.ok(blocked); assert.equal(blocked.status, 409, await blocked.clone().text());
  assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionId! } }), 0);

  const selfApproval = await asAdmin(adminSubmitterId, () => decideRightsReview(request("/api/admin/creator-rights-reviews", "PATCH", {
    id: pending.id, status: "APPROVED", evidenceInspected: true, rightsScopeConfirmed: true,
    ownerApprovalConfirmed: true, legalApprovalConfirmed: true,
  })));
  assert.ok(selfApproval); assert.equal(selfApproval.status, 409);

  const incomplete = await asAdmin(adminReviewerId, () => decideRightsReview(request("/api/admin/creator-rights-reviews", "PATCH", {
    id: pending.id, status: "APPROVED", evidenceInspected: true, rightsScopeConfirmed: true,
    ownerApprovalConfirmed: false, legalApprovalConfirmed: true,
  })));
  assert.ok(incomplete); assert.equal(incomplete.status, 400);
  assert.equal(await prismaTest.creatorRightsReview.count({ where: { id: pending.id, status: "PENDING" } }), 1);

  const approved = await asAdmin(adminReviewerId, () => decideRightsReview(request("/api/admin/creator-rights-reviews", "PATCH", {
    id: pending.id, status: "APPROVED", evidenceInspected: true, rightsScopeConfirmed: true,
    ownerApprovalConfirmed: true, legalApprovalConfirmed: true,
  })));
  assert.ok(approved); assert.equal(approved.status, 200, await approved.clone().text());
  const approvedRecord = await prismaTest.creatorRightsReview.findUnique({ where: { id: pending.id } });
  assert.ok(approvedRecord); assert.equal(approvedRecord.status, "APPROVED");
  assert.equal(approvedRecord.reviewedByUserId, adminReviewerId); assert.ok(approvedRecord.reviewedAt);
  assert.equal(approvedRecord.evidenceInspected, true); assert.equal(approvedRecord.ownerApprovalConfirmed, true);

  const wrongTerritory = await asCreator(creatorId, () => createUploadIntent(request("/api/creator/upload-intents", "POST", creatorIntentBody({
    territoryCode: "US", idempotencyKey: "wrong-territory-" + randomUUID(),
  })));
  assert.ok(wrongTerritory); assert.equal(wrongTerritory.status, 409);
  const wrongRole = await asCreator(creatorId, () => createUploadIntent(request("/api/creator/upload-intents", "POST", creatorIntentBody({
    mediaRole: "POSTER", idempotencyKey: "wrong-role-" + randomUUID(),
  })));
  assert.ok(wrongRole); assert.equal(wrongRole.status, 409);
  assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionId! } }), 0);

  const allowed = await asCreator(creatorId, () => createUploadIntent(request("/api/creator/upload-intents", "POST", creatorIntentBody())));
  assert.ok(allowed); assert.equal(allowed.status, 201, await allowed.clone().text());
  const allowedData = await allowed.json() as { uploadIntent: { status: string; territoryCode: string; uploadUrl?: string } };
  assert.equal(allowedData.uploadIntent.status, "PENDING");
  assert.equal(allowedData.uploadIntent.territoryCode, "IN");
  assert.equal(allowedData.uploadIntent.uploadUrl, undefined);

  const expiredGate = await prismaTest.$transaction(tx => resolveCreatorUploadRightsGate(
    tx, revisionId!, "IN", CreatorMediaRole.PRIMARY_VIDEO, new Date(approvedRecord!.expiryDate.getTime() + 1),
  ));
  assert.deepEqual(expiredGate, { allowed: false, reason: "RIGHTS_REVIEW_NOT_EFFECTIVE" });

  const next = await asAdmin(adminSubmitterId, () => createRightsReview(request(
    "/api/admin/creator-rights-reviews", "POST",
    rightsBody({ evidenceReference: "LegalVault/NexaFilm/CREATOR-RIGHTS-002", evidenceSha256: "b".repeat(64) }),
  )));
  assert.ok(next); assert.equal(next.status, 201, await next.clone().text());
  const nextData = await next.json() as { reviewId: string; sequence: number };
  assert.equal(nextData.sequence, 2);
  assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionId!, status: "CANCELLED" } }), 1);

  const latestPendingBlocks = await asCreator(creatorId, () => createUploadIntent(request(
    "/api/creator/upload-intents", "POST", creatorIntentBody({ idempotencyKey: "new-rights-pending-" + randomUUID() }),
  )));
  assert.ok(latestPendingBlocks); assert.equal(latestPendingBlocks.status, 409);
  assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionId!, status: "PENDING" } }), 0);

  const rejected = await asAdmin(adminReviewerId, () => decideRightsReview(request("/api/admin/creator-rights-reviews", "PATCH", {
    id: nextData.reviewId, status: "REJECTED", reviewNotes: "Rights scope is insufficient.",
  })));
  assert.ok(rejected); assert.equal(rejected.status, 200);
  assert.equal(await prismaTest.creatorRightsReview.count({ where: { id: nextData.reviewId, status: "REJECTED", reviewedByUserId: adminReviewerId } }), 1);

  const queue = await asAdmin(adminReviewerId, () => getRightsReviews(request("/api/admin/creator-rights-reviews", "GET")));
  assert.ok(queue); assert.equal(queue.status, 200);
  const queueData = await queue.json() as { candidateRevisions: unknown[]; reviews: Array<{ id: string; evidenceReference: string }> };
  assert.ok(queueData.candidateRevisions.length > 0);
  assert.ok(queueData.reviews.some(item => item.id === pending.id && item.evidenceReference === "LegalVault/NexaFilm/CREATOR-RIGHTS-001"));

  await assert.rejects(prismaTest.creatorRightsReview.update({
    where: { id: pending.id }, data: { evidenceReference: "LegalVault/NexaFilm/ALTERED" },
  }));
  const terminal = await prismaTest.creatorRightsReview.findUnique({ where: { id: pending.id }, select: { status: true, evidenceReference: true, reviewedByUserId: true } });
  assert.deepEqual(terminal, { status: "APPROVED", evidenceReference: "LegalVault/NexaFilm/CREATOR-RIGHTS-001", reviewedByUserId: adminReviewerId });
});

test("C3-I4 refuses rights records that omit the exact original language and rejects incomplete streaming scope", async () => {
  assert.ok(adminSubmitterId && adminReviewerId && revisionId);
  const missingLanguage = await asAdmin(adminSubmitterId, () => createRightsReview(request(
    "/api/admin/creator-rights-reviews", "POST", rightsBody({
      evidenceReference: "LegalVault/NexaFilm/LANGUAGE-MISSING", allowedLanguages: ["en"],
    }),
  )));
  assert.ok(missingLanguage); assert.equal(missingLanguage.status, 400);

  const missingStreaming = await asAdmin(adminSubmitterId, () => createRightsReview(request(
    "/api/admin/creator-rights-reviews", "POST", rightsBody({
      evidenceReference: "LegalVault/NexaFilm/STREAMING-MISSING", ottVodStreamingAllowed: false,
    }),
  )));
  assert.ok(missingStreaming); assert.equal(missingStreaming.status, 201);
  const data = await missingStreaming.json() as { reviewId: string };
  const approval = await asAdmin(adminReviewerId, () => decideRightsReview(request("/api/admin/creator-rights-reviews", "PATCH", {
    id: data.reviewId, status: "APPROVED", evidenceInspected: true, rightsScopeConfirmed: true,
    ownerApprovalConfirmed: true, legalApprovalConfirmed: true,
  })));
  assert.ok(approval); assert.equal(approval.status, 409);
  assert.equal(await prismaTest.creatorRightsReview.count({ where: { id: data.reviewId, status: "PENDING" } }), 1);
});

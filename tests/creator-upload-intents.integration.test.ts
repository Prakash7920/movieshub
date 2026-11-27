import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  CreatorContentType,
  CreatorMediaRole,
  CreatorProfileStatus,
  CreatorSubmissionRevisionStatus,
  CreatorSubmissionStatus,
  Role,
  UploadIntentStatus,
} from "@prisma/client";
import { POST as createUploadIntentRoute, GET as getUploadIntentsRoute } from "../app/api/creator/upload-intents/route";
import { prisma } from "../lib/prisma";
import { createUploadIntentInTransaction, isUploadIntentExpired, UPLOAD_INTENT_TTL_MS } from "../lib/creator/upload-intent-service";
import { runWithApiSessionForIntegrationTest } from "../lib/security/api-session";

const prismaTest = prisma;
const suffix = randomUUID();
let creatorOneId: string | null = null;
let creatorTwoId: string | null = null;
let pendingCreatorId: string | null = null;
let adminId: string | null = null;
let creatorOneProfileId: string | null = null;
let creatorTwoProfileId: string | null = null;
let creatorOneSubmissionId: string | null = null;
let creatorTwoSubmissionId: string | null = null;
let approvedRevisionId: string | null = null;
let draftRevisionId: string | null = null;
let foreignRevisionId: string | null = null;

function jsonRequest(
  url: string,
  method: "POST",
  body: Record<string, unknown>,
  origin = new URL(url).origin,
): Request {
  return new Request(url, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function intentRequest(body: Record<string, unknown>, origin?: string) {
  return jsonRequest(
    "https://creator-upload-intents-test.example/api/creator/upload-intents",
    "POST",
    body,
    origin,
  );
}

function listRequest(revisionId?: string) {
  const query = revisionId ? `?submissionRevisionId=${encodeURIComponent(revisionId)}` : "";
  return new Request(`https://creator-upload-intents-test.example/api/creator/upload-intents${query}`);
}

async function asApi(
  userId: string | null,
  callback: () => Promise<Response | undefined>,
): Promise<Response> {
  const response = await runWithApiSessionForIntegrationTest(
    userId ? { user: { id: userId } } : null,
    callback,
  );
  assert.ok(response, "creator upload-intent route must return a response");
  return response;
}

const metadata = (title: string) => ({
  title,
  synopsis: "Synthetic work metadata for the isolated upload-intent lifecycle test.",
  originalLanguage: "ta",
  runtimeMinutes: 14,
  releaseYear: 2026,
  contentType: CreatorContentType.SHORT_FILM,
});

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Creator upload-intent tests require MOVIESHUB_E2E=true.");
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Creator upload-intent tests may only use the isolated movieshub_test database.");
  }

  await prismaTest.$connect();

  const users = await prismaTest.user.createManyAndReturn({
    data: [
      { email: `upload-intent-creator-one-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true },
      { email: `upload-intent-creator-two-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true },
      { email: `upload-intent-pending-${suffix}@example.invalid`, role: Role.USER, isEmailVerified: true },
      { email: `upload-intent-admin-${suffix}@example.invalid`, role: Role.ADMIN, isEmailVerified: true },
    ],
    select: { id: true, email: true },
  });

  creatorOneId = users.find(user => user.email.startsWith("upload-intent-creator-one-"))!.id;
  creatorTwoId = users.find(user => user.email.startsWith("upload-intent-creator-two-"))!.id;
  pendingCreatorId = users.find(user => user.email.startsWith("upload-intent-pending-"))!.id;
  adminId = users.find(user => user.email.startsWith("upload-intent-admin-"))!.id;

  const profileOne = await prismaTest.creatorProfile.create({
    data: {
      userId: creatorOneId!,
      publicName: `Upload Intent One ${suffix.slice(0, 6)}`,
      adultEligibilityConfirmed: true,
      status: CreatorProfileStatus.APPROVED,
    },
    select: { id: true },
  });
  creatorOneProfileId = profileOne.id;

  const profileTwo = await prismaTest.creatorProfile.create({
    data: {
      userId: creatorTwoId!,
      publicName: `Upload Intent Two ${suffix.slice(0, 6)}`,
      adultEligibilityConfirmed: true,
      status: CreatorProfileStatus.APPROVED,
    },
    select: { id: true },
  });
  creatorTwoProfileId = profileTwo.id;

  await prismaTest.creatorProfile.create({
    data: {
      userId: pendingCreatorId!,
      publicName: `Upload Intent Pending ${suffix.slice(0, 6)}`,
      adultEligibilityConfirmed: true,
      status: CreatorProfileStatus.PENDING,
    },
    select: { id: true },
  });

  const submissionOne = await prismaTest.creatorSubmission.create({
    data: {
      creatorProfileId: creatorOneProfileId!,
      ...metadata(`Approved Rights-Gate Test ${suffix.slice(0, 6)}`),
      status: CreatorSubmissionStatus.APPROVED_FOR_CATALOGUE,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: adminId!,
      reviewNotes: "Synthetic metadata approval only; no rights decision is implied.",
    },
    select: { id: true },
  });
  creatorOneSubmissionId = submissionOne.id;

  const approvedRevision = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorOneSubmissionId!,
      revisionNumber: 1,
      ...metadata(`Approved Rights-Gate Test ${suffix.slice(0, 6)}`),
      status: CreatorSubmissionRevisionStatus.APPROVED_FOR_CATALOGUE,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: adminId!,
      reviewNotes: "Synthetic metadata approval only; independent rights review remains absent.",
    },
    select: { id: true },
  });
  approvedRevisionId = approvedRevision.id;

  const draftRevision = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorOneSubmissionId,
      revisionNumber: 2,
      ...metadata(`Draft Rights-Gate Test ${suffix.slice(0, 6)}`),
    },
    select: { id: true },
  });
  draftRevisionId = draftRevision.id;

  const submissionTwo = await prismaTest.creatorSubmission.create({
    data: {
      creatorProfileId: creatorTwoProfileId!,
      ...metadata(`Foreign Rights-Gate Test ${suffix.slice(0, 6)}`),
      status: CreatorSubmissionStatus.APPROVED_FOR_CATALOGUE,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: adminId,
    },
    select: { id: true },
  });
  creatorTwoSubmissionId = submissionTwo.id;

  const foreignRevision = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorTwoSubmissionId!,
      revisionNumber: 1,
      ...metadata(`Foreign Rights-Gate Test ${suffix.slice(0, 6)}`),
      status: CreatorSubmissionRevisionStatus.APPROVED_FOR_CATALOGUE,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: adminId,
    },
    select: { id: true },
  });
  foreignRevisionId = foreignRevision.id;
});

after(async () => {
  try {
    if (creatorOneId) await prismaTest.user.deleteMany({ where: { id: creatorOneId } });
    if (creatorTwoId) await prismaTest.user.deleteMany({ where: { id: creatorTwoId } });
    if (pendingCreatorId) await prismaTest.user.deleteMany({ where: { id: pendingCreatorId } });
    if (adminId) await prismaTest.user.deleteMany({ where: { id: adminId } });
  } finally {
    await prismaTest.$disconnect();
  }
});

test("upload-intent routes enforce identity, creator ownership, revision status and the fail-closed rights gate", async () => {
  assert.ok(creatorOneId && creatorTwoId && pendingCreatorId && approvedRevisionId && draftRevisionId && foreignRevisionId);

  const unauthenticatedPost = await asApi(null, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `unauthenticated-${suffix}`,
  })));
  assert.equal(unauthenticatedPost.status, 401);

  const unauthenticatedGet = await asApi(null, () => getUploadIntentsRoute(listRequest()));
  assert.equal(unauthenticatedGet.status, 401);

  const pendingCreatorPost = await asApi(pendingCreatorId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `pending-creator-${suffix}`,
  })));
  assert.equal(pendingCreatorPost.status, 403);

  const crossOrigin = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `cross-origin-${suffix}`,
  }, "https://attacker.example")));
  assert.equal(crossOrigin.status, 403);

  const invalidBody = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `invalid-body-${suffix}`,
    uploadUrl: "https://example.invalid/should-never-be-accepted",
  })));
  assert.equal(invalidBody.status, 400);

  const invalidIdempotencyKey = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: "too-short",
  })));
  assert.equal(invalidIdempotencyKey.status, 400);

  const crossCreatorId = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: foreignRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `foreign-owner-${suffix}`,
  })));
  assert.equal(crossCreatorId.status, 404);

  const notApprovedRevision = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: draftRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `draft-revision-${suffix}`,
  })));
  assert.equal(notApprovedRevision.status, 409);
  const draftResult = await notApprovedRevision.json() as { code: string };
  assert.equal(draftResult.code, "SUBMISSION_REVISION_NOT_APPROVED");

  const metadataApprovedButRightsUnreviewed = await asApi(creatorOneId, () => createUploadIntentRoute(intentRequest({
    submissionRevisionId: approvedRevisionId!,
    mediaRole: "PRIMARY_VIDEO",
    idempotencyKey: `rights-blocked-${suffix}`,
  })));
  assert.equal(metadataApprovedButRightsUnreviewed.status, 409);
  const rightsBlock = await metadataApprovedButRightsUnreviewed.json() as { code: string };
  assert.equal(rightsBlock.code, "RIGHTS_REVIEW_REQUIRED");

  const ownIntents = await asApi(creatorOneId, () => getUploadIntentsRoute(listRequest(approvedRevisionId!)));
  assert.equal(ownIntents.status, 200);
  const ownIntentData = await ownIntents.json() as { uploadIntents: Array<{ id: string; status: string }> };
  assert.deepEqual(ownIntentData.uploadIntents, []);

  const foreignIntentList = await asApi(creatorOneId, () => getUploadIntentsRoute(listRequest(foreignRevisionId!)));
  assert.equal(foreignIntentList.status, 404);

  assert.equal(await prismaTest.uploadIntent.count({
    where: { submissionRevisionId: approvedRevisionId! },
  }), 0, "the production rights gate must not create an UploadIntent");
  assert.equal(await prismaTest.uploadIntent.count({
    where: { submissionRevisionId: draftRevisionId! },
  }), 0);

  assert.equal(await prismaTest.adminAuditLog.count({
    where: {
      resourceType: "CreatorSubmissionRevision",
      resourceId: approvedRevisionId!,
      action: "CREATOR_UPLOAD_INTENT_BLOCKED_RIGHTS_GATE",
      actorUserId: creatorOneId!,
    },
  }), 1);
});

test("internal upload-intent service applies server policy, idempotency and expiry after a synthetic approved rights decision", async () => {
  assert.ok(creatorOneId && creatorOneProfileId && adminId && approvedRevisionId);

  const now = new Date();
  const input = {
    creatorProfileId: creatorOneProfileId!,
    actorUserId: creatorOneId!,
    submissionRevisionId: approvedRevisionId!,
    mediaRole: CreatorMediaRole.PRIMARY_VIDEO,
    idempotencyKey: `service-created-${suffix}`,
  };
  const syntheticTestRightsDecision = {
    allowed: true as const,
    decisionReference: `synthetic-test-rights-${suffix}`,
    reviewerUserId: adminId!,
  };

  const created = await prismaTest.$transaction(tx =>
    createUploadIntentInTransaction(tx, input, syntheticTestRightsDecision, now),
  );
  assert.equal(created.kind, "CREATED");
  if (created.kind !== "CREATED") return;
  assert.equal(created.intent.status, UploadIntentStatus.PENDING);
  assert.deepEqual(created.intent.allowedMimeTypes, ["video/mp4"]);
  assert.equal(created.intent.maxFileSizeBytes, 4n * 1024n * 1024n * 1024n);
  assert.equal(created.intent.expiresAt.getTime(), now.getTime() + UPLOAD_INTENT_TTL_MS);

  const replayed = await prismaTest.$transaction(tx =>
    createUploadIntentInTransaction(tx, input, syntheticTestRightsDecision, new Date(now.getTime() + 1000)),
  );
  assert.equal(replayed.kind, "REPLAYED");
  if (replayed.kind !== "REPLAYED") return;
  assert.equal(replayed.intent.id, created.intent.id);

  const keyConflict = await prismaTest.$transaction(tx =>
    createUploadIntentInTransaction(
      tx,
      { ...input, mediaRole: CreatorMediaRole.TRAILER },
      syntheticTestRightsDecision,
      new Date(now.getTime() + 2000),
    ),
  );
  assert.equal(keyConflict.kind, "IDEMPOTENCY_CONFLICT");

  const expired = await prismaTest.$transaction(tx =>
    createUploadIntentInTransaction(
      tx,
      input,
      syntheticTestRightsDecision,
      new Date(now.getTime() + UPLOAD_INTENT_TTL_MS + 1000),
    ),
  );
  assert.equal(expired.kind, "EXPIRED");
  const persisted = await prismaTest.uploadIntent.findUnique({
    where: { id: created.intent.id },
    select: { status: true, expiresAt: true },
  });
  assert.equal(persisted?.status, UploadIntentStatus.EXPIRED);
  assert.equal(
    isUploadIntentExpired({ status: UploadIntentStatus.EXPIRED, expiresAt: persisted!.expiresAt }),
    true,
  );

  assert.equal(await prismaTest.adminAuditLog.count({
    where: {
      resourceType: "UploadIntent",
      resourceId: created.intent.id,
      action: "CREATOR_UPLOAD_INTENT_CREATED",
      actorUserId: creatorOneId!,
    },
  }), 1);
  assert.equal(await prismaTest.adminAuditLog.count({
    where: {
      resourceType: "UploadIntent",
      resourceId: created.intent.id,
      action: "CREATOR_UPLOAD_INTENT_EXPIRED",
      actorUserId: creatorOneId,
    },
  }), 1);
});

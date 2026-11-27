import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  CreatorContentType,
  CreatorMediaRole,
  CreatorProfileStatus,
  CreatorSubmissionRevisionStatus,
  CreatorSubmissionStatus,
  MediaAssetVersionStatus,
  UploadIntentStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";

const prismaTest = prisma;
const suffix = randomUUID();
const migrationConstraintsEnabled = process.env.MEDIA_CONTROL_PLANE_MIGRATION_TEST === "true";
let creatorUserId: string | null = null;
let creatorProfileId: string | null = null;
let creatorSubmissionId: string | null = null;
let revisionOneId: string | null = null;
let revisionTwoId: string | null = null;
let uploadIntentOneId: string | null = null;
let mediaAssetVersionOneId: string | null = null;

const revisionMetadata = (title: string) => ({
  title,
  synopsis: "Synthetic fixture metadata for isolated media control-plane database tests.",
  originalLanguage: "ta",
  runtimeMinutes: 12,
  releaseYear: 2026,
  contentType: CreatorContentType.SHORT_FILM,
});

async function createUploadIntent(revisionId: string, key: string) {
  return prismaTest.uploadIntent.create({
    data: {
      submissionRevisionId: revisionId,
      mediaRole: CreatorMediaRole.PRIMARY_VIDEO,
      idempotencyKey: key,
      maxFileSizeBytes: 100n * 1024n * 1024n,
      allowedMimeTypes: ["video/mp4"],
      maxDurationSeconds: 900,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
}

function assetData(input: {
  revisionId: string;
  uploadIntentId: string;
  versionNumber: number;
  sourceSha256?: string;
  status?: MediaAssetVersionStatus;
  validatedAt?: Date | null;
  storageProvider?: string | null;
  storageAssetRef?: string | null;
}) {
  return {
    submissionRevisionId: input.revisionId,
    uploadIntentId: input.uploadIntentId,
    versionNumber: input.versionNumber,
    status: input.status ?? MediaAssetVersionStatus.QUARANTINED,
    sourceSha256: input.sourceSha256 ?? "a".repeat(64),
    fileSizeBytes: 2_048n,
    detectedMimeType: "video/mp4",
    durationSeconds: 90,
    widthPixels: 1_920,
    heightPixels: 1_080,
    ...(input.validatedAt === undefined ? {} : { validatedAt: input.validatedAt }),
    ...(input.storageProvider === undefined ? {} : { storageProvider: input.storageProvider }),
    ...(input.storageAssetRef === undefined ? {} : { storageAssetRef: input.storageAssetRef }),
  };
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Media control-plane integration tests require MOVIESHUB_E2E=true.");
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  const databaseName = databaseUrl.pathname.replace(/^\//, "").split("?")[0];
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !["movieshub_test", "nexafilm_migration_test"].includes(databaseName)
  ) {
    throw new Error("Media control-plane tests may only use an isolated local test database.");
  }

  await prismaTest.$connect();
  const user = await prismaTest.user.create({
    data: {
      email: `media-control-plane-${suffix}@example.invalid`,
      role: "USER",
      isEmailVerified: true,
    },
    select: { id: true },
  });
  creatorUserId = user.id;

  const profile = await prismaTest.creatorProfile.create({
    data: {
      userId: creatorUserId!,
      publicName: `Media Test ${suffix.slice(0, 8)}`,
      adultEligibilityConfirmed: true,
      status: CreatorProfileStatus.APPROVED,
    },
    select: { id: true },
  });
  creatorProfileId = profile.id;

  const submission = await prismaTest.creatorSubmission.create({
    data: {
      creatorProfileId: creatorProfileId!,
      ...revisionMetadata("Control Plane Test Submission"),
      status: CreatorSubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  creatorSubmissionId = submission.id;

  const revision = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorSubmissionId!,
      revisionNumber: 1,
      ...revisionMetadata("Control Plane Test Submission"),
      status: CreatorSubmissionRevisionStatus.SUBMITTED,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  revisionOneId = revision.id;

  const revisionTwo = await prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorSubmissionId!,
      revisionNumber: 2,
      ...revisionMetadata("Control Plane Test Submission — revision two"),
    },
    select: { id: true },
  });
  revisionTwoId = revisionTwo.id;
});

after(async () => {
  try {
    if (creatorUserId) {
      await prismaTest.user.deleteMany({ where: { id: creatorUserId } });
    }

    if (revisionOneId) {
      assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionOneId } }), 0);
      assert.equal(await prismaTest.mediaAssetVersion.count({ where: { submissionRevisionId: revisionOneId } }), 0);
      assert.equal(await prismaTest.creatorSubmissionRevision.count({ where: { id: revisionOneId } }), 0);
    }
    if (revisionTwoId) {
      assert.equal(await prismaTest.uploadIntent.count({ where: { submissionRevisionId: revisionTwoId } }), 0);
      assert.equal(await prismaTest.mediaAssetVersion.count({ where: { submissionRevisionId: revisionTwoId } }), 0);
      assert.equal(await prismaTest.creatorSubmissionRevision.count({ where: { id: revisionTwoId } }), 0);
    }
    if (creatorSubmissionId) {
      assert.equal(await prismaTest.creatorSubmission.count({ where: { id: creatorSubmissionId } }), 0);
    }
    if (creatorProfileId) {
      assert.equal(await prismaTest.creatorProfile.count({ where: { id: creatorProfileId } }), 0);
    }
  } finally {
    await prismaTest.$disconnect();
  }
});

test("revision snapshots, upload intents and asset versions are revision-scoped and isolated", async () => {
  assert.ok(creatorUserId && creatorProfileId && creatorSubmissionId && revisionOneId && revisionTwoId);

  assert.deepEqual(Object.values(CreatorMediaRole), [
    "PRIMARY_VIDEO", "TRAILER", "POSTER", "BACKDROP", "CAPTION", "SUBTITLE",
  ]);
  assert.deepEqual(Object.values(UploadIntentStatus), [
    "PENDING", "AUTHORIZED", "COMPLETED", "CONSUMED", "EXPIRED", "CANCELLED", "FAILED",
  ]);
  assert.deepEqual(Object.values(MediaAssetVersionStatus), [
    "QUARANTINED", "PROCESSING", "TECHNICAL_REVIEW", "READY_FOR_REVIEW",
    "REJECTED", "TAKEDOWN_PENDING", "REMOVED", "FAILED",
  ]);

  const snapshot = await prismaTest.creatorSubmissionRevision.findUnique({
    where: { id: revisionOneId },
    include: { creatorSubmission: { select: { creatorProfile: { select: { userId: true } } } } },
  });
  assert.ok(snapshot);
  assert.equal(snapshot.revisionNumber, 1);
  assert.equal(snapshot.title, "Control Plane Test Submission");
  assert.equal(snapshot.creatorSubmission.creatorProfile.userId, creatorUserId);

  await assert.rejects(() => prismaTest.creatorSubmissionRevision.create({
    data: {
      creatorSubmissionId: creatorSubmissionId!,
      revisionNumber: 1,
      ...revisionMetadata("Duplicate revision number"),
    },
  }));

  const intent = await createUploadIntent(revisionOneId, `intent-${suffix}`);
  uploadIntentOneId = intent.id;
  assert.equal(intent.status, UploadIntentStatus.PENDING);
  assert.equal(intent.mediaRole, CreatorMediaRole.PRIMARY_VIDEO);
  assert.ok(intent.expiresAt.getTime() > intent.createdAt.getTime());
  assert.deepEqual(intent.allowedMimeTypes, ["video/mp4"]);

  await assert.rejects(() => createUploadIntent(revisionOneId!, `intent-${suffix}`));

  const asset = await prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId,
      uploadIntentId: intent.id,
      versionNumber: 1,
    }),
    include: { uploadIntent: true },
  });
  mediaAssetVersionOneId = asset.id;
  assert.equal(asset.status, MediaAssetVersionStatus.QUARANTINED);
  assert.equal(asset.uploadIntent.submissionRevisionId, revisionOneId);
  assert.equal(asset.uploadIntent.status, UploadIntentStatus.PENDING);
  assert.equal(asset.storageProvider, null);
  assert.equal(asset.storageAssetRef, null);

  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId!,
      uploadIntentId: intent.id,
      versionNumber: 2,
    }),
  }));

  const secondIntent = await createUploadIntent(revisionOneId, `intent-second-${suffix}`);
  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId,
      uploadIntentId: secondIntent.id,
      versionNumber: 1,
    }),
  }));

  const mismatchedIntent = await createUploadIntent(revisionOneId, `intent-mismatch-${suffix}`);
  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionTwoId,
      uploadIntentId: mismatchedIntent.id,
      versionNumber: 1,
    }),
  }));

  const linkedAsset = await prismaTest.mediaAssetVersion.findUnique({
    where: { id: mediaAssetVersionOneId },
    include: {
      submissionRevision: true,
      uploadIntent: { include: { submissionRevision: true } },
    },
  });
  assert.ok(linkedAsset);
  assert.equal(linkedAsset.submissionRevision.id, revisionOneId);
  assert.equal(linkedAsset.uploadIntent.submissionRevision.id, revisionOneId);
});

test("migration-only guards protect immutable snapshots and quarantined asset facts", {
  skip: !migrationConstraintsEnabled,
}, async () => {
  assert.ok(revisionOneId);
  assert.ok(revisionTwoId);

  await assert.rejects(() => prismaTest.creatorSubmissionRevision.update({
    where: { id: revisionOneId! },
    data: { title: "Attempted in-place rewrite" },
  }));

  await assert.rejects(() => prismaTest.uploadIntent.create({
    data: {
      submissionRevisionId: revisionOneId!,
      mediaRole: CreatorMediaRole.PRIMARY_VIDEO,
      idempotencyKey: `zero-size-${suffix}`,
      maxFileSizeBytes: 0n,
      allowedMimeTypes: ["video/mp4"],
      expiresAt: new Date(Date.now() + 60_000),
    },
  }));

  const badHashIntent = await createUploadIntent(revisionOneId, `bad-hash-${suffix}`);
  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId!,
      uploadIntentId: badHashIntent.id,
      versionNumber: 10,
      sourceSha256: "z".repeat(64),
    }),
  }));

  const urlRefIntent = await createUploadIntent(revisionOneId, `url-ref-${suffix}`);
  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId!,
      uploadIntentId: urlRefIntent.id,
      versionNumber: 11,
      storageProvider: "test-adapter",
      storageAssetRef: "https://example.invalid/public-source.mp4",
    }),
  }));

  const notValidatedIntent = await createUploadIntent(revisionOneId, `not-validated-${suffix}`);
  await assert.rejects(() => prismaTest.mediaAssetVersion.create({
    data: assetData({
      revisionId: revisionOneId!,
      uploadIntentId: notValidatedIntent.id,
      versionNumber: 12,
      status: MediaAssetVersionStatus.READY_FOR_REVIEW,
    }),
  }));
});

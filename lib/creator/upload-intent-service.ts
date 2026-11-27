import {
  CreatorMediaRole,
  MediaAssetVersionStatus,
  Prisma,
  UploadIntentStatus,
} from "@prisma/client";
import { writeAdminAuditEvent } from "@/lib/security/admin-audit-log";
import type { CreatorUploadRightsGateDecision } from "@/lib/creator/upload-rights-gate";

export const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;

const MEDIA_ROLE_POLICIES: Record<
  CreatorMediaRole,
  { maxFileSizeBytes: bigint; allowedMimeTypes: string[]; maxDurationSeconds: number | null }
> = {
  PRIMARY_VIDEO: {
    maxFileSizeBytes: 4n * 1024n * 1024n * 1024n,
    allowedMimeTypes: ["video/mp4"],
    maxDurationSeconds: 10_800,
  },
  TRAILER: {
    maxFileSizeBytes: 1n * 1024n * 1024n * 1024n,
    allowedMimeTypes: ["video/mp4"],
    maxDurationSeconds: 900,
  },
  POSTER: {
    maxFileSizeBytes: 20n * 1024n * 1024n,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxDurationSeconds: null,
  },
  BACKDROP: {
    maxFileSizeBytes: 20n * 1024n * 1024n,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxDurationSeconds: null,
  },
  CAPTION: {
    maxFileSizeBytes: 10n * 1024n * 1024n,
    allowedMimeTypes: ["text/vtt"],
    maxDurationSeconds: null,
  },
  SUBTITLE: {
    maxFileSizeBytes: 10n * 1024n * 1024n,
    allowedMimeTypes: ["text/vtt", "application/x-subrip"],
    maxDurationSeconds: null,
  },
};

const uploadIntentSelect = {
  id: true,
  submissionRevisionId: true,
  mediaRole: true,
  status: true,
  maxFileSizeBytes: true,
  allowedMimeTypes: true,
  maxDurationSeconds: true,
  expiresAt: true,
  authorizedAt: true,
  completedAt: true,
  consumedAt: true,
  createdAt: true,
} satisfies Prisma.UploadIntentSelect;

export type SafeUploadIntent = Prisma.UploadIntentGetPayload<{
  select: typeof uploadIntentSelect;
}>;

export type CreateUploadIntentResult =
  | { kind: "NOT_FOUND" }
  | { kind: "REVISION_NOT_APPROVED" }
  | { kind: "RIGHTS_REVIEW_REQUIRED" }
  | { kind: "IDEMPOTENCY_CONFLICT" }
  | { kind: "EXPIRED"; intent: SafeUploadIntent }
  | { kind: "CREATED"; intent: SafeUploadIntent }
  | { kind: "REPLAYED"; intent: SafeUploadIntent };

export async function createUploadIntentInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    creatorProfileId: string;
    actorUserId: string;
    submissionRevisionId: string;
    mediaRole: CreatorMediaRole;
    idempotencyKey: string;
  },
  rightsGate: CreatorUploadRightsGateDecision,
  now = new Date(),
): Promise<CreateUploadIntentResult> {
  const revision = await tx.creatorSubmissionRevision.findFirst({
    where: {
      id: input.submissionRevisionId,
      creatorSubmission: { creatorProfileId: input.creatorProfileId },
    },
    select: {
      id: true,
      status: true,
      creatorSubmission: { select: { id: true, status: true } },
    },
  });

  if (!revision) return { kind: "NOT_FOUND" };

  if (
    revision.status !== "APPROVED_FOR_CATALOGUE" ||
    revision.creatorSubmission.status !== "APPROVED_FOR_CATALOGUE"
  ) {
    return { kind: "REVISION_NOT_APPROVED" };
  }

  // Never infer rights from CreatorSubmission or revision metadata approval.
  if (!rightsGate.allowed) {
    await writeAdminAuditEvent(tx, {
      actorUserId: input.actorUserId,
      action: "CREATOR_UPLOAD_INTENT_BLOCKED_RIGHTS_GATE",
      resourceType: "CreatorSubmissionRevision",
      resourceId: revision.id,
      metadata: { reason: rightsGate.reason },
    });
    return { kind: "RIGHTS_REVIEW_REQUIRED" };
  }

  const policy = MEDIA_ROLE_POLICIES[input.mediaRole];
  const existing = await tx.uploadIntent.findUnique({
    where: {
      submissionRevisionId_idempotencyKey: {
        submissionRevisionId: revision.id,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: uploadIntentSelect,
  });

  if (existing) {
    const sameRequest =
      existing.mediaRole === input.mediaRole &&
      existing.maxFileSizeBytes === policy.maxFileSizeBytes &&
      existing.maxDurationSeconds === policy.maxDurationSeconds &&
      JSON.stringify(existing.allowedMimeTypes) === JSON.stringify(policy.allowedMimeTypes);

    if (!sameRequest) return { kind: "IDEMPOTENCY_CONFLICT" };

    const isExpirable =
      existing.status === UploadIntentStatus.PENDING ||
      existing.status === UploadIntentStatus.AUTHORIZED;

    if (isExpirable && existing.expiresAt.getTime() <= now.getTime()) {
      const expired = await tx.uploadIntent.update({
        where: { id: existing.id },
        data: { status: UploadIntentStatus.EXPIRED },
        select: uploadIntentSelect,
      });
      await writeAdminAuditEvent(tx, {
        actorUserId: input.actorUserId,
        action: "CREATOR_UPLOAD_INTENT_EXPIRED",
        resourceType: "UploadIntent",
        resourceId: expired.id,
        metadata: { submissionRevisionId: revision.id, mediaRole: expired.mediaRole },
      });
      return { kind: "EXPIRED", intent: expired };
    }

    return { kind: "REPLAYED", intent: existing };
  }

  const intent = await tx.uploadIntent.create({
    data: {
      submissionRevisionId: revision.id,
      mediaRole: input.mediaRole,
      idempotencyKey: input.idempotencyKey,
      maxFileSizeBytes: policy.maxFileSizeBytes,
      allowedMimeTypes: policy.allowedMimeTypes,
      maxDurationSeconds: policy.maxDurationSeconds,
      expiresAt: new Date(now.getTime() + UPLOAD_INTENT_TTL_MS),
      status: UploadIntentStatus.PENDING,
    },
    select: uploadIntentSelect,
  });

  await writeAdminAuditEvent(tx, {
    actorUserId: input.actorUserId,
    action: "CREATOR_UPLOAD_INTENT_CREATED",
    resourceType: "UploadIntent",
    resourceId: intent.id,
    metadata: {
      submissionRevisionId: revision.id,
      mediaRole: intent.mediaRole,
      rightsDecisionReference: rightsGate.decisionReference,
      rightsReviewerUserId: rightsGate.reviewerUserId,
    },
  });

  return { kind: "CREATED", intent };
}

export function isUploadIntentExpired(intent: Pick<SafeUploadIntent, "status" | "expiresAt">, now = new Date()): boolean {
  return (
    (intent.status === UploadIntentStatus.PENDING || intent.status === UploadIntentStatus.AUTHORIZED) &&
    intent.expiresAt.getTime() <= now.getTime()
  );
}

export function isSafeQuarantinedMediaStatus(status: MediaAssetVersionStatus): boolean {
  return status === MediaAssetVersionStatus.QUARANTINED;
}

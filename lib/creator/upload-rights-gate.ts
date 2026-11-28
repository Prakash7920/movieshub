import { CreatorMediaRole, Prisma } from "@prisma/client";

export type CreatorUploadRightsGateDecision =
  | {
      allowed: true;
      submissionRevisionId: string;
      territoryCode: string;
      mediaRole: CreatorMediaRole;
      decisionReference: string;
      reviewerUserId: string;
    }
  | {
      allowed: false;
      reason:
        | "RIGHTS_REVIEW_REQUIRED"
        | "RIGHTS_REVIEW_NOT_EFFECTIVE"
        | "RIGHTS_TERRITORY_NOT_GRANTED"
        | "RIGHTS_LANGUAGE_NOT_GRANTED"
        | "RIGHTS_MEDIA_ROLE_NOT_GRANTED"
        | "RIGHTS_REVIEW_INVALID";
    };

const RESTRICTED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,299}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function isValidRestrictedReference(value: string): boolean {
  return RESTRICTED_REFERENCE.test(value) && !value.includes("..") && !value.includes("://");
}

/** Resolves the latest review in the same serializable transaction as UploadIntent creation. */
export async function resolveCreatorUploadRightsGate(
  tx: Prisma.TransactionClient,
  submissionRevisionId: string,
  territoryCode: string,
  mediaRole: CreatorMediaRole,
  now = new Date(),
): Promise<CreatorUploadRightsGateDecision> {
  if (!/^[A-Z]{2}$/.test(territoryCode)) return { allowed: false, reason: "RIGHTS_REVIEW_INVALID" };

  const revision = await tx.creatorSubmissionRevision.findUnique({
    where: { id: submissionRevisionId },
    select: {
      id: true,
      status: true,
      originalLanguage: true,
      creatorSubmission: { select: { status: true } },
      rightsReviews: {
        orderBy: { sequence: "desc" },
        take: 1,
        select: {
          id: true, status: true, evidenceReference: true, evidenceSha256: true,
          ownerApprovalReference: true, legalApprovalReference: true,
          allowedTerritories: true, allowedLanguages: true, permittedMediaRoles: true,
          startDate: true, expiryDate: true, uploadAllowed: true, hostingAllowed: true,
          processingAllowed: true, ottVodStreamingAllowed: true, downloadsAllowed: true,
          evidenceInspected: true, rightsScopeConfirmed: true,
          ownerApprovalConfirmed: true, legalApprovalConfirmed: true,
          submittedByUserId: true, reviewedAt: true, reviewedByUserId: true,
          reviewedBy: { select: { id: true, role: true, isBanned: true } },
        },
      },
    },
  });

  if (!revision ||
      revision.status !== "APPROVED_FOR_CATALOGUE" ||
      revision.creatorSubmission.status !== "APPROVED_FOR_CATALOGUE") {
    return { allowed: false, reason: "RIGHTS_REVIEW_REQUIRED" };
  }
  const review = revision.rightsReviews[0];
  if (!review || review.status !== "APPROVED") return { allowed: false, reason: "RIGHTS_REVIEW_REQUIRED" };

  const reviewer = review.reviewedBy;
  const reviewerIsCurrentAdmin =
    reviewer !== null &&
    review.reviewedByUserId !== null &&
    reviewer.id === review.reviewedByUserId &&
    !reviewer.isBanned &&
    (reviewer.role === "ADMIN" || reviewer.role === "SUPERADMIN") &&
    review.reviewedByUserId !== review.submittedByUserId;

  const valid =
    isValidRestrictedReference(review.evidenceReference) &&
    isValidRestrictedReference(review.ownerApprovalReference) &&
    isValidRestrictedReference(review.legalApprovalReference) &&
    SHA256.test(review.evidenceSha256) &&
    review.reviewedAt !== null &&
    reviewerIsCurrentAdmin &&
    review.evidenceInspected &&
    review.rightsScopeConfirmed &&
    review.ownerApprovalConfirmed &&
    review.legalApprovalConfirmed &&
    review.uploadAllowed &&
    review.hostingAllowed &&
    review.processingAllowed &&
    review.ottVodStreamingAllowed &&
    !review.downloadsAllowed &&
    review.allowedTerritories.length > 0 &&
    review.allowedLanguages.length > 0 &&
    review.permittedMediaRoles.length > 0;
  if (!valid) return { allowed: false, reason: "RIGHTS_REVIEW_INVALID" };

  if (review.startDate.getTime() > now.getTime() || review.expiryDate.getTime() <= now.getTime()) {
    return { allowed: false, reason: "RIGHTS_REVIEW_NOT_EFFECTIVE" };
  }
  if (!review.allowedTerritories.includes(territoryCode)) {
    return { allowed: false, reason: "RIGHTS_TERRITORY_NOT_GRANTED" };
  }
  if (!review.allowedLanguages.includes(revision.originalLanguage.trim().toLowerCase())) {
    return { allowed: false, reason: "RIGHTS_LANGUAGE_NOT_GRANTED" };
  }
  if (!review.permittedMediaRoles.includes(mediaRole)) {
    return { allowed: false, reason: "RIGHTS_MEDIA_ROLE_NOT_GRANTED" };
  }

  return {
    allowed: true,
    submissionRevisionId: revision.id,
    territoryCode,
    mediaRole,
    decisionReference: review.id,
    reviewerUserId: review.reviewedByUserId!,
  };
}

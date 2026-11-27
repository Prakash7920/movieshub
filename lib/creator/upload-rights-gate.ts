/**
 * The current Creator schema has no independent work/version rights-review
 * record. Creator metadata approval is not a licence or upload permission.
 *
 * This adapter deliberately denies every upload-intent request until a later
 * rights-review increment supplies a persisted, reviewer-approved decision
 * tied to the exact submission revision and the signed rights evidence.
 */
export type CreatorUploadRightsGateDecision =
  | {
      allowed: true;
      decisionReference: string;
      reviewerUserId: string;
    }
  | {
      allowed: false;
      reason: "RIGHTS_REVIEW_NOT_IMPLEMENTED";
    };

export async function resolveCreatorUploadRightsGate(
  _submissionRevisionId: string,
): Promise<CreatorUploadRightsGateDecision> {
  return {
    allowed: false,
    reason: "RIGHTS_REVIEW_NOT_IMPLEMENTED",
  };
}

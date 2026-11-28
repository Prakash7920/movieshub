import { NextResponse } from "next/server";
import { CreatorMediaRole, CreatorRightsReviewStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/security/admin-session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/client-identity";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { writeAdminAuditEvent } from "@/lib/security/admin-audit-log";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,299}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const referenceSchema = z.string().trim().min(3).max(300).regex(REFERENCE_PATTERN)
  .refine(value => !value.includes("..") && !value.includes("://"), "Use a restricted legal-vault reference, not a URL.");

const createSchema = z.object({
  submissionRevisionId: z.string().min(1).max(64),
  rightsHolder: z.string().trim().min(3).max(200),
  evidenceReference: referenceSchema,
  evidenceSha256: z.string().trim().regex(SHA256_PATTERN).transform(value => value.toLowerCase()),
  ownerApprovalReference: referenceSchema,
  legalApprovalReference: referenceSchema,
  allowedTerritories: z.array(z.string().regex(/^[A-Za-z]{2}$/)).min(1).max(30),
  allowedLanguages: z.array(z.string().regex(/^[A-Za-z]{2,3}$/)).min(1).max(30),
  permittedMediaRoles: z.array(z.nativeEnum(CreatorMediaRole)).min(1).max(6),
  startDate: z.string().datetime(),
  expiryDate: z.string().datetime(),
  uploadAllowed: z.boolean(),
  hostingAllowed: z.boolean(),
  processingAllowed: z.boolean(),
  ottVodStreamingAllowed: z.boolean(),
}).strict();

const decisionSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().trim().min(3).max(1000).optional(),
  evidenceInspected: z.boolean().optional(),
  rightsScopeConfirmed: z.boolean().optional(),
  ownerApprovalConfirmed: z.boolean().optional(),
  legalApprovalConfirmed: z.boolean().optional(),
}).strict();

async function requireAdmin(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    if (ip) {
      const ipLimit = await consumeRateLimit("creator-rights-review-admin-ip", ip, 60, 60);
      if (!ipLimit.allowed) return {
        error: NextResponse.json({ error: "Too many administrative requests." }, {
          status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(ipLimit.retryAfterSeconds) },
        }),
      };
    }
    const session = await getAdminSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401, headers: PRIVATE_HEADERS }) };

    const userLimit = await consumeRateLimit("creator-rights-review-admin-user", userId, 120, 60);
    if (!userLimit.allowed) return {
      error: NextResponse.json({ error: "Too many administrative requests." }, {
        status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(userLimit.retryAfterSeconds) },
      }),
    };

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true } });
    if (!user || user.isBanned || !["ADMIN", "SUPERADMIN"].includes(user.role)) {
      return { error: NextResponse.json({ error: "Admin access required." }, { status: 403, headers: PRIVATE_HEADERS }) };
    }
    return { userId };
  } catch (error) {
    logSafeError("Creator rights-review admin authorization failed", error);
    return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503, headers: PRIVATE_HEADERS }) };
  }
}

const reviewSelect = {
  id: true, submissionRevisionId: true, sequence: true, status: true,
  rightsHolder: true, evidenceReference: true, evidenceSha256: true,
  ownerApprovalReference: true, legalApprovalReference: true,
  allowedTerritories: true, allowedLanguages: true, permittedMediaRoles: true,
  startDate: true, expiryDate: true, uploadAllowed: true, hostingAllowed: true,
  processingAllowed: true, ottVodStreamingAllowed: true, downloadsAllowed: true,
  evidenceInspected: true, rightsScopeConfirmed: true, ownerApprovalConfirmed: true,
  legalApprovalConfirmed: true, submittedByUserId: true, reviewedAt: true,
  reviewedByUserId: true, reviewNotes: true, createdAt: true,
  submissionRevision: {
    select: {
      id: true, revisionNumber: true, title: true, originalLanguage: true, status: true,
      creatorSubmission: {
        select: { id: true, title: true, status: true, creatorProfile: { select: { publicName: true } } },
      },
    },
  },
  submittedBy: { select: { id: true, email: true } },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.CreatorRightsReviewSelect;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  try {
    const [candidateRevisions, reviews] = await Promise.all([
      prisma.creatorSubmissionRevision.findMany({
        where: { status: "APPROVED_FOR_CATALOGUE", creatorSubmission: { status: "APPROVED_FOR_CATALOGUE" } },
        orderBy: [{ updatedAt: "desc" }, { revisionNumber: "desc" }],
        take: 100,
        select: {
          id: true, revisionNumber: true, title: true, originalLanguage: true, status: true,
          creatorSubmission: { select: { id: true, title: true, creatorProfile: { select: { publicName: true } } } },
        },
      }),
      prisma.creatorRightsReview.findMany({
        orderBy: [{ createdAt: "desc" }, { sequence: "desc" }],
        take: 100,
        select: reviewSelect,
      }),
    ]);
    return NextResponse.json({ candidateRevisions, reviews }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator rights-review queue lookup failed", error);
    return NextResponse.json({ error: "Unable to load creator rights-review queue." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  if (!(await hasValidJsonContentType(request, 8 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rights-evidence record." }, { status: 400, headers: PRIVATE_HEADERS });

    const data = parsed.data;
    const territories = data.allowedTerritories.map(code => code.toUpperCase());
    const languages = data.allowedLanguages.map(code => code.toLowerCase());
    const mediaRoles = data.permittedMediaRoles;
    if (new Set(territories).size !== territories.length || new Set(languages).size !== languages.length || new Set(mediaRoles).size !== mediaRoles.length) {
      return NextResponse.json({ error: "Territories, languages and media roles must be unique." }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const startDate = new Date(data.startDate);
    const expiryDate = new Date(data.expiryDate);
    const now = new Date();
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(expiryDate.getTime()) || expiryDate <= startDate || expiryDate <= now) {
      return NextResponse.json({ error: "The rights term must have a valid start date and a future expiry date." }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const result = await prisma.$transaction(async tx => {
      const revision = await tx.creatorSubmissionRevision.findUnique({
        where: { id: data.submissionRevisionId },
        select: { id: true, status: true, originalLanguage: true, creatorSubmission: { select: { status: true } } },
      });
      if (!revision) return { kind: "NOT_FOUND" as const };
      if (revision.status !== "APPROVED_FOR_CATALOGUE" || revision.creatorSubmission.status !== "APPROVED_FOR_CATALOGUE") {
        return { kind: "REVISION_NOT_APPROVED" as const };
      }
      if (!languages.includes(revision.originalLanguage.trim().toLowerCase())) return { kind: "LANGUAGE_SCOPE_MISMATCH" as const };

      const latest = await tx.creatorRightsReview.findFirst({
        where: { submissionRevisionId: revision.id },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const saved = await tx.creatorRightsReview.create({
        data: {
          submissionRevisionId: revision.id,
          sequence: (latest?.sequence ?? 0) + 1,
          status: CreatorRightsReviewStatus.PENDING,
          rightsHolder: data.rightsHolder,
          evidenceReference: data.evidenceReference,
          evidenceSha256: data.evidenceSha256,
          ownerApprovalReference: data.ownerApprovalReference,
          legalApprovalReference: data.legalApprovalReference,
          allowedTerritories: territories,
          allowedLanguages: languages,
          permittedMediaRoles: mediaRoles,
          startDate,
          expiryDate,
          uploadAllowed: data.uploadAllowed,
          hostingAllowed: data.hostingAllowed,
          processingAllowed: data.processingAllowed,
          ottVodStreamingAllowed: data.ottVodStreamingAllowed,
          downloadsAllowed: false,
          submittedByUserId: auth.userId,
        },
        select: { id: true, sequence: true, submissionRevisionId: true, status: true, evidenceSha256: true },
      });

      // New evidence sequence revokes any outstanding, not-yet-consumed intents for this revision.
      const openIntents = await tx.uploadIntent.findMany({
        where: { submissionRevisionId: revision.id, status: { in: ["PENDING", "AUTHORIZED"] } },
        select: { id: true },
      });
      if (openIntents.length) {
        await tx.uploadIntent.updateMany({ where: { id: { in: openIntents.map(item => item.id) } }, data: { status: "CANCELLED" } });
        for (const intent of openIntents) {
          await writeAdminAuditEvent(tx, {
            actorUserId: auth.userId,
            action: "CREATOR_UPLOAD_INTENT_CANCELLED_RIGHTS_REVIEW_RESET",
            resourceType: "UploadIntent",
            resourceId: intent.id,
            metadata: { submissionRevisionId: revision.id, rightsReviewId: saved.id },
          });
        }
      }

      await writeAdminAuditEvent(tx, {
        actorUserId: auth.userId,
        action: "CREATOR_RIGHTS_REVIEW_CREATED",
        resourceType: "CreatorRightsReview",
        resourceId: saved.id,
        metadata: {
          submissionRevisionId: revision.id, sequence: saved.sequence,
          evidenceSha256: saved.evidenceSha256,
          allowedTerritories: territories, allowedLanguages: languages,
          permittedMediaRoles: mediaRoles, uploadAllowed: data.uploadAllowed,
          hostingAllowed: data.hostingAllowed, processingAllowed: data.processingAllowed,
          ottVodStreamingAllowed: data.ottVodStreamingAllowed, downloadsAllowed: false,
          previousOpenUploadIntentsCancelled: openIntents.length,
        },
      });
      return { kind: "CREATED" as const, reviewId: saved.id, sequence: saved.sequence };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "NOT_FOUND") return NextResponse.json({ error: "Approved submission revision not found." }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === "REVISION_NOT_APPROVED") return NextResponse.json({ error: "The exact work revision and parent submission must both have metadata approval before rights review." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "LANGUAGE_SCOPE_MISMATCH") return NextResponse.json({ error: "The rights record must include the exact revision's original language." }, { status: 400, headers: PRIVATE_HEADERS });
    return NextResponse.json({
      message: "Rights evidence record saved as PENDING. It does not authorize upload until a different admin completes the human review.",
      reviewId: result.reviewId, sequence: result.sequence, status: "PENDING",
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: "The rights review changed concurrently. Reload the queue and retry." }, { status: 409, headers: PRIVATE_HEADERS });
    }
    logSafeError("Creator rights-evidence record creation failed", error);
    return NextResponse.json({ error: "Unable to save rights-evidence record." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  if (!(await hasValidJsonContentType(request, 8 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rights-review decision." }, { status: 400, headers: PRIVATE_HEADERS });
    const decision = parsed.data;

    if (decision.status === "APPROVED" && (
      decision.evidenceInspected !== true || decision.rightsScopeConfirmed !== true ||
      decision.ownerApprovalConfirmed !== true || decision.legalApprovalConfirmed !== true
    )) {
      return NextResponse.json({ error: "Approval requires explicit confirmation that the actual signed evidence, exact rights scope, owner authorization and legal review were inspected in their restricted systems." }, { status: 400, headers: PRIVATE_HEADERS });
    }
    if (decision.status === "REJECTED" && (!decision.reviewNotes || decision.reviewNotes.length < 3)) {
      return NextResponse.json({ error: "A rejection reason of at least three characters is required." }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const result = await prisma.$transaction(async tx => {
      const current = await tx.creatorRightsReview.findUnique({
        where: { id: decision.id },
        select: {
          id: true, sequence: true, status: true, evidenceReference: true, evidenceSha256: true,
          ownerApprovalReference: true, legalApprovalReference: true, allowedTerritories: true,
          allowedLanguages: true, permittedMediaRoles: true, startDate: true, expiryDate: true,
          uploadAllowed: true, hostingAllowed: true, processingAllowed: true,
          ottVodStreamingAllowed: true, downloadsAllowed: true, submittedByUserId: true,
          submissionRevisionId: true,
          submissionRevision: {
            select: {
              id: true, status: true, originalLanguage: true,
              creatorSubmission: { select: { status: true } },
            },
          },
        },
      });
      if (!current) return { kind: "NOT_FOUND" as const };
      if (current.status !== CreatorRightsReviewStatus.PENDING) return { kind: "LOCKED" as const };
      if (current.submittedByUserId === auth.userId) return { kind: "SAME_REVIEWER" as const };
      if (current.submissionRevision.status !== "APPROVED_FOR_CATALOGUE" || current.submissionRevision.creatorSubmission.status !== "APPROVED_FOR_CATALOGUE") {
        return { kind: "REVISION_NOT_APPROVED" as const };
      }

      const now = new Date();
      if (decision.status === "APPROVED") {
        if (current.expiryDate <= now || current.expiryDate <= current.startDate) return { kind: "EXPIRED" as const };
        if (
          !REFERENCE_PATTERN.test(current.evidenceReference) ||
          !REFERENCE_PATTERN.test(current.ownerApprovalReference) ||
          !REFERENCE_PATTERN.test(current.legalApprovalReference) ||
          current.evidenceReference.includes("..") || current.evidenceReference.includes("://") ||
          !SHA256_PATTERN.test(current.evidenceSha256) || !current.allowedTerritories.length ||
          !current.allowedLanguages.includes(current.submissionRevision.originalLanguage.trim().toLowerCase()) ||
          !current.permittedMediaRoles.length || !current.uploadAllowed || !current.hostingAllowed ||
          !current.processingAllowed || !current.ottVodStreamingAllowed || current.downloadsAllowed
        ) return { kind: "SCOPE_INCOMPLETE" as const };
      }

      const updated = await tx.creatorRightsReview.update({
        where: { id: current.id },
        data: {
          status: decision.status, reviewedAt: now, reviewedByUserId: auth.userId,
          reviewNotes: decision.reviewNotes ?? null,
          evidenceInspected: decision.status === "APPROVED",
          rightsScopeConfirmed: decision.status === "APPROVED",
          ownerApprovalConfirmed: decision.status === "APPROVED",
          legalApprovalConfirmed: decision.status === "APPROVED",
        },
        select: { id: true, status: true, submissionRevisionId: true, evidenceSha256: true, sequence: true },
      });

      await writeAdminAuditEvent(tx, {
        actorUserId: auth.userId,
        action: decision.status === "APPROVED" ? "CREATOR_RIGHTS_REVIEW_APPROVED" : "CREATOR_RIGHTS_REVIEW_REJECTED",
        resourceType: "CreatorRightsReview",
        resourceId: updated.id,
        metadata: {
          submissionRevisionId: updated.submissionRevisionId, sequence: updated.sequence,
          evidenceSha256: updated.evidenceSha256, territoryCodes: current.allowedTerritories,
          languages: current.allowedLanguages, permittedMediaRoles: current.permittedMediaRoles,
          evidenceInspected: decision.status === "APPROVED",
          rightsScopeConfirmed: decision.status === "APPROVED",
          ownerApprovalConfirmed: decision.status === "APPROVED",
          legalApprovalConfirmed: decision.status === "APPROVED",
        },
      });
      return { kind: "UPDATED" as const, status: updated.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "NOT_FOUND") return NextResponse.json({ error: "Rights-evidence review record not found." }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === "LOCKED") return NextResponse.json({ error: "This review record already has a terminal decision. Create a new sequence for changed evidence or scope." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "SAME_REVIEWER") return NextResponse.json({ error: "A different administrator must perform the independent human review." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "REVISION_NOT_APPROVED") return NextResponse.json({ error: "Metadata approval for this exact work revision is no longer current." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "EXPIRED") return NextResponse.json({ error: "An expired rights term cannot be approved. Obtain current evidence and create a new review sequence." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "SCOPE_INCOMPLETE") return NextResponse.json({ error: "The rights record does not cover every required upload, hosting, processing, OTT/VOD, territory and original-language condition." }, { status: 409, headers: PRIVATE_HEADERS });

    return NextResponse.json({
      message: decision.status === "APPROVED"
        ? "Independent rights review approved. UploadIntent creation is still subject to exact revision, media-role, language, territory and effective-term checks."
        : "Rights review rejected. UploadIntent creation remains blocked.",
      status: decision.status,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "The rights review changed during decision. Reload the queue and try again." }, { status: 409, headers: PRIVATE_HEADERS });
    }
    logSafeError("Creator rights-review decision failed", error);
    return NextResponse.json({ error: "Unable to record rights-review decision." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

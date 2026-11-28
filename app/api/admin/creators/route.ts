import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
const reviewSchema = z.discriminatedUnion("resourceType", [
  z.object({
    resourceType: z.literal("CREATOR_PROFILE"),
    id: z.string().min(1),
    status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
    ageVerificationReviewed: z.boolean().optional(),
    notes: z.string().trim().min(3).max(1000),
  }).strict(),
  z.object({
    resourceType: z.literal("CREATOR_SUBMISSION"),
    id: z.string().min(1),
    status: z.enum(["NEEDS_CHANGES", "REJECTED", "APPROVED_FOR_CATALOGUE"]),
    notes: z.string().trim().min(3).max(1000),
  }).strict(),
]);

async function requireAdmin(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    if (ip) {
      const ipLimit = await consumeRateLimit("admin-creator-api-ip", ip, 60, 60);
      if (!ipLimit.allowed) return { error: NextResponse.json({ error: "Too many administrative requests." }, { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(ipLimit.retryAfterSeconds) } }) };
    }
    const session = await getAdminSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401, headers: PRIVATE_HEADERS }) };
    const userLimit = await consumeRateLimit("admin-creator-api-user", userId, 120, 60);
    if (!userLimit.allowed) return { error: NextResponse.json({ error: "Too many administrative requests." }, { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(userLimit.retryAfterSeconds) } }) };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true } });
    if (!user || user.isBanned || !["ADMIN", "SUPERADMIN"].includes(user.role)) return { error: NextResponse.json({ error: "Admin access required." }, { status: 403, headers: PRIVATE_HEADERS }) };
    return { userId };
  } catch (error) {
    logSafeError("Creator admin authorisation failed", error);
    return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503, headers: PRIVATE_HEADERS }) };
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  try {
    const [creatorProfiles, submissions] = await Promise.all([
      prisma.creatorProfile.findMany({
        where: { status: "PENDING" },
        orderBy: { appliedAt: "asc" },
        select: { id: true, publicName: true, bio: true, adultEligibilityConfirmed: true, status: true, appliedAt: true, user: { select: { email: true } } },
      }),
      prisma.creatorSubmission.findMany({
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "asc" },
        select: {
          id: true, title: true, synopsis: true, originalLanguage: true, runtimeMinutes: true,
          releaseYear: true, contentType: true, status: true, submittedAt: true,
          creatorProfile: { select: { id: true, publicName: true, user: { select: { email: true } } } },
          revisions: {
            where: { status: "SUBMITTED" },
            orderBy: { revisionNumber: "desc" },
            take: 1,
            select: { id: true, revisionNumber: true, status: true, submittedAt: true },
          },
        },
      }),
    ]);
    return NextResponse.json({ creatorProfiles, submissions }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator review queue lookup failed", error);
    return NextResponse.json({ error: "Unable to load creator review queue." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  if (!(await hasValidJsonContentType(request, 8 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review decision." }, { status: 400, headers: PRIVATE_HEADERS });

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.resourceType === "CREATOR_PROFILE") {
        const current = await tx.creatorProfile.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true, adultEligibilityConfirmed: true } });
        if (!current) return { kind: "NOT_FOUND" as const };
        if (parsed.data.status === "APPROVED" && parsed.data.ageVerificationReviewed !== true) return { kind: "AGE_REVIEW_REQUIRED" as const };
        if (parsed.data.status === "APPROVED" && !current.adultEligibilityConfirmed) return { kind: "INELIGIBLE" as const };
        if (current.status !== "PENDING" && !(current.status === "APPROVED" && parsed.data.status === "SUSPENDED")) return { kind: "LOCKED" as const };
        const profile = await tx.creatorProfile.update({
          where: { id: current.id },
          data: { status: parsed.data.status, reviewedAt: new Date(), reviewedByUserId: auth.userId, reviewNotes: parsed.data.notes },
          select: { id: true, publicName: true, status: true },
        });
        await writeAdminAuditEvent(tx, {
          actorUserId: auth.userId,
          action: `CREATOR_PROFILE_${parsed.data.status}`,
          resourceType: "CreatorProfile",
          resourceId: profile.id,
          metadata: parsed.data.status === "APPROVED"
            ? { adultEligibilityConfirmed: true, ageVerificationReviewed: true }
            : { adultEligibilityConfirmed: current.adultEligibilityConfirmed },
        });
        return { kind: "UPDATED" as const, resource: profile };
      }

      const current = await tx.creatorSubmission.findUnique({
        where: { id: parsed.data.id },
        select: {
          id: true,
          status: true,
          revisions: {
            where: { status: "SUBMITTED" },
            orderBy: { revisionNumber: "desc" },
            take: 1,
            select: { id: true, revisionNumber: true, status: true },
          },
        },
      });
      if (!current) return { kind: "NOT_FOUND" as const };
      if (current.status !== "SUBMITTED") return { kind: "LOCKED" as const };
      const submittedRevision = current.revisions[0];
      const submission = await tx.creatorSubmission.update({
        where: { id: current.id },
        data: { status: parsed.data.status, reviewedAt: new Date(), reviewedByUserId: auth.userId, reviewNotes: parsed.data.notes },
        select: { id: true, title: true, status: true },
      });
      if (submittedRevision) {
        const reviewedRevision = await tx.creatorSubmissionRevision.update({
          where: { id: submittedRevision.id },
          data: {
            status: parsed.data.status,
            reviewedAt: new Date(),
            reviewedByUserId: auth.userId,
            reviewNotes: parsed.data.notes,
          },
          select: { id: true, revisionNumber: true, status: true },
        });
        await writeAdminAuditEvent(tx, {
          actorUserId: auth.userId,
          action: `CREATOR_SUBMISSION_REVISION_${parsed.data.status}`,
          resourceType: "CreatorSubmissionRevision",
          resourceId: reviewedRevision.id,
          metadata: { creatorSubmissionId: submission.id, revisionNumber: reviewedRevision.revisionNumber },
        });
      }

      await writeAdminAuditEvent(tx, {
        actorUserId: auth.userId,
        action: `CREATOR_SUBMISSION_${parsed.data.status}`,
        resourceType: "CreatorSubmission",
        resourceId: submission.id,
        metadata: submittedRevision
          ? { revisionId: submittedRevision.id, revisionNumber: submittedRevision.revisionNumber }
          : { legacySubmissionWithoutRevision: true },
      });
      return { kind: "UPDATED" as const, resource: submission };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "NOT_FOUND") return NextResponse.json({ error: "Review item not found." }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === "LOCKED") return NextResponse.json({ error: "This review item is no longer awaiting this decision." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "INELIGIBLE") return NextResponse.json({ error: "A creator must confirm the 18+ eligibility declaration before approval." }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === "AGE_REVIEW_REQUIRED") return NextResponse.json({ error: "Confirm that the creator's 18+ eligibility was independently checked through the approved restricted process." }, { status: 400, headers: PRIVATE_HEADERS });
    return NextResponse.json({ message: "Review decision recorded. This does not publish content or enable playback.", resource: result.resource }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "The review item changed. Reload the queue and try again." }, { status: 409, headers: PRIVATE_HEADERS });
    logSafeError("Creator review decision failed", error);
    return NextResponse.json({ error: "Unable to record the review decision." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

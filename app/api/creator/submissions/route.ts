import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/security/api-session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/client-identity";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { writeAdminAuditEvent } from "@/lib/security/admin-audit-log";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const metadataSchema = z.object({
  title: z.string().trim().min(2).max(160),
  synopsis: z.string().trim().min(20).max(3000),
  originalLanguage: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/),
  runtimeMinutes: z.number().int().min(1).max(1000),
  releaseYear: z.number().int().min(1888).max(new Date().getFullYear() + 1),
  contentType: z.enum(["SHORT_FILM", "EPISODE"]),
}).strict();
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SAVE_DRAFT"), id: z.string().min(1), ...metadataSchema.shape }).strict(),
  z.object({ action: z.literal("SUBMIT_FOR_REVIEW"), id: z.string().min(1) }).strict(),
]);

async function getApprovedCreator() {
  const session = await getApiSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Sign in to access Creator Studio." }, { status: 401, headers: PRIVATE_HEADERS }) };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isEmailVerified: true, isBanned: true } });
  if (!user) return { error: NextResponse.json({ error: "Account not found." }, { status: 404, headers: PRIVATE_HEADERS }) };
  if (user.isBanned || !user.isEmailVerified) {
    return { error: NextResponse.json({ error: "A verified, active account is required for Creator Studio." }, { status: 403, headers: PRIVATE_HEADERS }) };
  }
  const creatorProfile = await prisma.creatorProfile.findUnique({
    where: { userId },
    select: { id: true, status: true, publicName: true },
  });
  if (!creatorProfile) return { error: NextResponse.json({ error: "Submit a creator application first." }, { status: 403, headers: PRIVATE_HEADERS }) };
  if (creatorProfile.status !== "APPROVED") {
    return { error: NextResponse.json({ error: "Creator submissions are available after your application is approved.", creatorStatus: creatorProfile.status }, { status: 403, headers: PRIVATE_HEADERS }) };
  }
  return { user, creatorProfile };
}

async function applySubmissionRateLimit(request: Request, userId: string) {
  const ip = getClientIp(request.headers);
  const userLimit = await consumeRateLimit("creator-submission-user", userId, 30, 60 * 60);
  const ipLimit = ip ? await consumeRateLimit("creator-submission-ip", ip, 60, 60 * 60) : { allowed: true, retryAfterSeconds: 3600 };
  return { allowed: userLimit.allowed && ipLimit.allowed, retryAfterSeconds: Math.max(userLimit.retryAfterSeconds, ipLimit.retryAfterSeconds) };
}

export async function GET() {
  try {
    const creator = await getApprovedCreator();
    if ("error" in creator) return creator.error;
    const submissions = await prisma.creatorSubmission.findMany({
      where: { creatorProfileId: creator.creatorProfile.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, synopsis: true, originalLanguage: true, runtimeMinutes: true,
        releaseYear: true, contentType: true, status: true, submittedAt: true,
        reviewedAt: true, reviewNotes: true, createdAt: true, updatedAt: true,
      },
    });
    return NextResponse.json({ submissions }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator submissions lookup failed", error);
    return NextResponse.json({ error: "Unable to load creator submissions." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  if (!(await hasValidJsonContentType(request, 12 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });

  try {
    const creator = await getApprovedCreator();
    if ("error" in creator) return creator.error;
    let rate;
    try { rate = await applySubmissionRateLimit(request, creator.user.id); }
    catch { return NextResponse.json({ error: "Creator submissions are temporarily unavailable." }, { status: 503, headers: PRIVATE_HEADERS }); }
    if (!rate.allowed) return NextResponse.json({ error: "Too many submission attempts. Try again later." }, { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = metadataSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission metadata." }, { status: 400, headers: PRIVATE_HEADERS });

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.creatorSubmission.create({
        data: { creatorProfileId: creator.creatorProfile.id, ...parsed.data, status: "DRAFT" },
        select: { id: true, title: true, status: true, createdAt: true },
      });
      await writeAdminAuditEvent(tx, { actorUserId: creator.user.id, action: "CREATOR_SUBMISSION_DRAFT_CREATED", resourceType: "CreatorSubmission", resourceId: created.id });
      return created;
    });
    return NextResponse.json({ message: "Private draft created. Submit it when the metadata is ready.", submission }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator draft creation failed", error);
    return NextResponse.json({ error: "Unable to create a draft submission." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  if (!(await hasValidJsonContentType(request, 12 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });

  try {
    const creator = await getApprovedCreator();
    if ("error" in creator) return creator.error;
    let rate;
    try { rate = await applySubmissionRateLimit(request, creator.user.id); }
    catch { return NextResponse.json({ error: "Creator submissions are temporarily unavailable." }, { status: 503, headers: PRIVATE_HEADERS }); }
    if (!rate.allowed) return NextResponse.json({ error: "Too many submission attempts. Try again later." }, { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission update." }, { status: 400, headers: PRIVATE_HEADERS });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.creatorSubmission.findFirst({
        where: { id: parsed.data.id, creatorProfileId: creator.creatorProfile.id },
        select: { id: true, status: true },
      });
      if (!existing) return { kind: "NOT_FOUND" as const };
      if (parsed.data.action === "SAVE_DRAFT") {
        if (existing.status !== "DRAFT" && existing.status !== "NEEDS_CHANGES") return { kind: "LOCKED" as const };
        const saved = await tx.creatorSubmission.update({
          where: { id: existing.id },
          data: {
            title: parsed.data.title,
            synopsis: parsed.data.synopsis,
            originalLanguage: parsed.data.originalLanguage,
            runtimeMinutes: parsed.data.runtimeMinutes,
            releaseYear: parsed.data.releaseYear,
            contentType: parsed.data.contentType,
            status: "DRAFT",
            submittedAt: null,
            reviewedAt: null,
            reviewedByUserId: null,
            reviewNotes: null,
          },
          select: { id: true, title: true, status: true, updatedAt: true },
        });
        await writeAdminAuditEvent(tx, { actorUserId: creator.user.id, action: "CREATOR_SUBMISSION_DRAFT_UPDATED", resourceType: "CreatorSubmission", resourceId: saved.id });
        return { kind: "SAVED" as const, submission: saved };
      }
      if (existing.status !== "DRAFT" && existing.status !== "NEEDS_CHANGES") return { kind: "LOCKED" as const };
      const submitted = await tx.creatorSubmission.update({
        where: { id: existing.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, reviewedByUserId: null, reviewNotes: null },
        select: { id: true, title: true, status: true, submittedAt: true },
      });
      await writeAdminAuditEvent(tx, { actorUserId: creator.user.id, action: "CREATOR_SUBMISSION_SUBMITTED", resourceType: "CreatorSubmission", resourceId: submitted.id });
      return { kind: "SUBMITTED" as const, submission: submitted };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "NOT_FOUND") return NextResponse.json({ error: "Submission not found." }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === "LOCKED") return NextResponse.json({ error: "This submission can no longer be edited or submitted." }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ submission: result.submission }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "The submission changed during this request. Reload and try again." }, { status: 409, headers: PRIVATE_HEADERS });
    }
    logSafeError("Creator submission update failed", error);
    return NextResponse.json({ error: "Unable to update the submission." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

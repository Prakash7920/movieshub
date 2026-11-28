import { NextResponse } from "next/server";
import { Prisma, CreatorMediaRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_PRIVATE_HEADERS,
  getApprovedCreatorContext,
} from "@/lib/creator/creator-access";
import { resolveCreatorUploadRightsGate } from "@/lib/creator/upload-rights-gate";
import {
  createUploadIntentInTransaction,
  isUploadIntentExpired,
  type SafeUploadIntent,
} from "@/lib/creator/upload-intent-service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/client-identity";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const PRIVATE_HEADERS = CREATOR_PRIVATE_HEADERS;
const createIntentSchema = z.object({
  submissionRevisionId: z.string().min(1).max(64),
  mediaRole: z.nativeEnum(CreatorMediaRole),
  territoryCode: z.string().regex(/^[A-Z]{2}$/),
  idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

async function applyUploadIntentRateLimit(request: Request, userId: string) {
  const ip = getClientIp(request.headers);
  const userLimit = await consumeRateLimit("creator-upload-intent-user", userId, 10, 60 * 60);
  const ipLimit = ip
    ? await consumeRateLimit("creator-upload-intent-ip", ip, 30, 60 * 60)
    : { allowed: true, retryAfterSeconds: 3600 };

  return {
    allowed: userLimit.allowed && ipLimit.allowed,
    retryAfterSeconds: Math.max(userLimit.retryAfterSeconds, ipLimit.retryAfterSeconds),
  };
}

function serializeUploadIntent(intent: SafeUploadIntent) {
  return {
    ...intent,
    // Prisma BigInt values are not JSON serializable.
    maxFileSizeBytes: intent.maxFileSizeBytes.toString(),
  };
}

const intentResponseSelect = {
  id: true,
  submissionRevisionId: true,
  mediaRole: true,
  territoryCode: true,
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

export async function GET(request: Request) {
  try {
    const creator = await getApprovedCreatorContext();
    if (!creator.ok) {
      return NextResponse.json(
        { error: creator.error, ...(creator.creatorStatus ? { creatorStatus: creator.creatorStatus } : {}) },
        { status: creator.status, headers: PRIVATE_HEADERS },
      );
    }

    const url = new URL(request.url);
    const revisionId = url.searchParams.get("submissionRevisionId");
    if (revisionId) {
      const ownedRevision = await prisma.creatorSubmissionRevision.findFirst({
        where: {
          id: revisionId,
          creatorSubmission: { creatorProfileId: creator.creatorProfile.id },
        },
        select: { id: true },
      });
      if (!ownedRevision) {
        return NextResponse.json({ error: "Submission revision not found." }, { status: 404, headers: PRIVATE_HEADERS });
      }
    }

    const intents = await prisma.uploadIntent.findMany({
      where: {
        ...(revisionId ? { submissionRevisionId: revisionId } : {}),
        submissionRevision: {
          creatorSubmission: { creatorProfileId: creator.creatorProfile.id },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: intentResponseSelect,
    });

    const now = new Date();
    return NextResponse.json({
      uploadIntents: intents.map((intent) => ({
        ...serializeUploadIntent(intent),
        isExpired: isUploadIntentExpired(intent, now),
      })),
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator upload intent lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load upload intents." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  }
  if (!(await hasValidJsonContentType(request, 4 * 1024))) {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });
  }

  try {
    const creator = await getApprovedCreatorContext();
    if (!creator.ok) {
      return NextResponse.json(
        { error: creator.error, ...(creator.creatorStatus ? { creatorStatus: creator.creatorStatus } : {}) },
        { status: creator.status, headers: PRIVATE_HEADERS },
      );
    }

    let rate;
    try {
      rate = await applyUploadIntentRateLimit(request, creator.user.id);
    } catch {
      return NextResponse.json(
        { error: "Upload authorization is temporarily unavailable." },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many upload-intent requests. Try again later." },
        { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS }); }

    const parsed = createIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid upload-intent request." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const rightsGate = await resolveCreatorUploadRightsGate(
        tx,
        parsed.data.submissionRevisionId,
        parsed.data.territoryCode,
        parsed.data.mediaRole,
      );
      return createUploadIntentInTransaction(
        tx,
        {
          creatorProfileId: creator.creatorProfile.id,
          actorUserId: creator.user.id,
          ...parsed.data,
        },
        rightsGate,
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "NOT_FOUND") {
      return NextResponse.json({ error: "Submission revision not found." }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (result.kind === "REVISION_NOT_APPROVED") {
      return NextResponse.json({
        code: "SUBMISSION_REVISION_NOT_APPROVED",
        error: "The exact submission revision must be approved before an upload intent can be considered.",
      }, { status: 409, headers: PRIVATE_HEADERS });
    }
    if (result.kind === "RIGHTS_REVIEW_REQUIRED") {
      return NextResponse.json({
        code: "RIGHTS_REVIEW_REQUIRED",
        error: "Upload authorization is disabled until a separate human rights review approves this exact work and revision.",
      }, { status: 409, headers: PRIVATE_HEADERS });
    }
    if (result.kind === "IDEMPOTENCY_CONFLICT") {
      return NextResponse.json({
        code: "IDEMPOTENCY_KEY_REUSED",
        error: "This idempotency key was already used for a different media role or policy.",
      }, { status: 409, headers: PRIVATE_HEADERS });
    }
    if (result.kind === "EXPIRED") {
      return NextResponse.json({
        code: "UPLOAD_INTENT_EXPIRED",
        error: "This upload intent has expired. Create a new request with a new idempotency key.",
        uploadIntent: serializeUploadIntent(result.intent),
      }, { status: 410, headers: PRIVATE_HEADERS });
    }

    const status = result.kind === "CREATED" ? 201 : 200;
    return NextResponse.json({
      uploadIntent: serializeUploadIntent(result.intent),
      idempotentReplay: result.kind === "REPLAYED",
      // No upload URL, provider credential or file-transfer capability is returned.
    }, { status, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
      return NextResponse.json(
        { error: "The upload intent changed during this request. Retry with the same idempotency key." },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    logSafeError("Creator upload intent creation failed", error);
    return NextResponse.json(
      { error: "Unable to create an upload intent." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

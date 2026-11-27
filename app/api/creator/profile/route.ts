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
const applicationSchema = z.object({
  publicName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500).optional().default(""),
  adultEligibilityConfirmed: z.literal(true),
}).strict();

async function getAccount() {
  const session = await getApiSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Sign in to apply as a creator." }, { status: 401, headers: PRIVATE_HEADERS }) };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isEmailVerified: true, isBanned: true },
  });
  if (!user) return { error: NextResponse.json({ error: "Account not found." }, { status: 404, headers: PRIVATE_HEADERS }) };
  if (user.isBanned) return { error: NextResponse.json({ error: "This account cannot apply as a creator." }, { status: 403, headers: PRIVATE_HEADERS }) };
  if (!user.isEmailVerified) return { error: NextResponse.json({ error: "Verify your email before applying as a creator." }, { status: 403, headers: PRIVATE_HEADERS }) };
  return { user };
}

export async function GET() {
  try {
    const account = await getAccount();
    if ("error" in account) return account.error;
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: account.user.id },
      select: { id: true, publicName: true, bio: true, adultEligibilityConfirmed: true, status: true, appliedAt: true, reviewedAt: true, reviewNotes: true },
    });
    return NextResponse.json({ creatorProfile }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logSafeError("Creator profile lookup failed", error);
    return NextResponse.json({ error: "Unable to load creator application." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE_HEADERS });
  }
  if (!(await hasValidJsonContentType(request, 8 * 1024))) {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: PRIVATE_HEADERS });
  }

  try {
    const account = await getAccount();
    if ("error" in account) return account.error;
    const ip = getClientIp(request.headers);
    try {
      const userLimit = await consumeRateLimit("creator-application-user", account.user.id, 8, 60 * 60);
      const ipLimit = ip ? await consumeRateLimit("creator-application-ip", ip, 10, 60 * 60) : { allowed: true, retryAfterSeconds: 3600 };
      if (!userLimit.allowed || !ipLimit.allowed) {
        return NextResponse.json({ error: "Too many creator application attempts. Try again later." }, {
          status: 429,
          headers: { ...PRIVATE_HEADERS, "Retry-After": String(Math.max(userLimit.retryAfterSeconds, ipLimit.retryAfterSeconds)) },
        });
      }
    } catch {
      return NextResponse.json({ error: "Creator applications are temporarily unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid creator application." }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.creatorProfile.findUnique({ where: { userId: account.user.id }, select: { id: true, status: true } });
      if (existing) return { kind: "EXISTS" as const, existing };
      const creatorProfile = await tx.creatorProfile.create({
        data: {
          userId: account.user.id,
          publicName: parsed.data.publicName,
          bio: parsed.data.bio || null,
          adultEligibilityConfirmed: parsed.data.adultEligibilityConfirmed,
          status: "PENDING",
        },
        select: { id: true, publicName: true, bio: true, adultEligibilityConfirmed: true, status: true, appliedAt: true },
      });
      await writeAdminAuditEvent(tx, {
        actorUserId: account.user.id,
        action: "CREATOR_PROFILE_APPLIED",
        resourceType: "CreatorProfile",
        resourceId: creatorProfile.id,
      });
      return { kind: "CREATED" as const, creatorProfile };
    });

    if (result.kind === "EXISTS") {
      return NextResponse.json({ error: "A creator application already exists for this account.", status: result.existing.status }, { status: 409, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ message: "Creator application submitted for review.", creatorProfile: result.creatorProfile }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A creator application already exists for this account." }, { status: 409, headers: PRIVATE_HEADERS });
    }
    logSafeError("Creator application failed", error);
    return NextResponse.json({ error: "Unable to submit the creator application." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

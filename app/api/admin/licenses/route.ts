import { NextResponse } from "next/server";
import { logSafeError } from "@/lib/security/safe-log";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/client-identity";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { getAdminSession } from "@/lib/security/admin-session";
import { LicenseStatus, ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAdminAuditEvent } from "@/lib/security/admin-audit-log";

export const runtime = "nodejs";

function normalizeEvidenceReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reference = value.trim();
  if (
    reference.length < 3 ||
    reference.length > 300 ||
    /[\\u0000-\\u001f\\u007f]/.test(reference) ||
    /^[a-z][a-z0-9+.-]*:\\/\\//i.test(reference)
  ) return null;
  return reference;
}

function normalizeEvidenceSha256(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

async function requireAdmin(request: Request) {
  const ip = getClientIp(request.headers);
  if (ip) {
    try {
      const ipLimit = await consumeRateLimit("admin-api-ip", ip, 60, 60);
      if (!ipLimit.allowed) {
        return { error: NextResponse.json({ error: "Too many administrative requests. Please try again later." }, {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds), "Cache-Control": "no-store" },
        }) };
      }
    } catch {
      return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503 }) };
    }
  }
  let sessionUser: { id?: string } | undefined;
  try {
    const session = await getAdminSession();
    sessionUser = session?.user as { id?: string } | undefined;
  } catch (error) {
    logSafeError("Admin session lookup failed", error);
    return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503 }) };
  }
  if (!sessionUser?.id) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  try {
    const userLimit = await consumeRateLimit("admin-api-user", sessionUser.id, 120, 60);
    if (!userLimit.allowed) {
      return { error: NextResponse.json({ error: "Too many administrative requests. Please try again later." }, {
        status: 429,
        headers: { "Retry-After": String(userLimit.retryAfterSeconds), "Cache-Control": "no-store" },
      }) };
    }
  } catch {
    return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503 }) };
  }
  let user: { role: string; isBanned: boolean } | null;
  try {
    user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true, isBanned: true } });
  } catch (error) {
    logSafeError("Admin authorization lookup failed", error);
    return { error: NextResponse.json({ error: "Administrative service is temporarily unavailable." }, { status: 503 }) };
  }
  if (!user || user.isBanned || !["ADMIN", "SUPERADMIN"].includes(user.role)) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { userId: sessionUser.id };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  try {
    const movies = await prisma.movie.findMany({
      orderBy: { titleEn: "asc" },
      select: { id: true, titleEn: true, isPublished: true, license: { select: { id: true, owner: true, status: true, startDate: true, expiryDate: true, allowedCountries: true, notes: true, evidenceReference: true, evidenceSha256: true, rightsScopeConfirmed: true, reviewedAt: true, reviewedByUserId: true } } },
    });
    return NextResponse.json({ movies }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    logSafeError("Admin licence list failed", error);
    return NextResponse.json({ error: "Unable to load licence records." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!(await hasValidJsonContentType(request, 32 * 1024))) {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid licence data." }, { status: 400 });
    const b = body as Record<string, unknown>;
    if (typeof b.movieId !== "string" || typeof b.owner !== "string" || !b.owner.trim() ||
        typeof b.startDate !== "string" || typeof b.expiryDate !== "string" || typeof b.countries !== "string") {
      return NextResponse.json({ error: "Complete all required licence fields." }, { status: 400 });
    }
    const startDate = new Date(b.startDate);
    const expiryDate = new Date(b.expiryDate);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(expiryDate.getTime()) || expiryDate <= startDate) {
      return NextResponse.json({ error: "Expiry date must be after the start date." }, { status: 400 });
    }
    const allowedCountries = [...new Set(b.countries.split(",").map(x => x.trim().toUpperCase()).filter(Boolean))];
    if (!allowedCountries.length || allowedCountries.length > 30 || allowedCountries.some(x => !/^[A-Z]{2}$/.test(x))) {
      return NextResponse.json({ error: "Enter permitted countries as two-letter ISO codes, separated by commas (for example IN, SG)." }, { status: 400 });
    }
    const licenseResult = await prisma.$transaction(async tx => {
      const movie = await tx.movie.findUnique({
        where: { id: b.movieId as string },
        select: { id: true, isPublished: true },
      });
      if (!movie) return { kind: "NOT_FOUND" as const };

      const saved = await tx.license.upsert({
        where: { movieId: b.movieId as string },
        create: { movieId: b.movieId as string, owner: (b.owner as string).trim().slice(0, 200), status: LicenseStatus.PENDING, startDate, expiryDate, allowedCountries, downloadAllowed: false, notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 3000) : null, evidenceReference: null, evidenceSha256: null, rightsScopeConfirmed: false, reviewedAt: null, reviewedByUserId: null },
        update: { owner: (b.owner as string).trim().slice(0, 200), status: LicenseStatus.PENDING, startDate, expiryDate, allowedCountries, downloadAllowed: false, notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 3000) : null, evidenceReference: null, evidenceSha256: null, rightsScopeConfirmed: false, reviewedAt: null, reviewedByUserId: null },
        select: { id: true, owner: true, status: true, startDate: true, expiryDate: true, allowedCountries: true, evidenceReference: true, evidenceSha256: true, rightsScopeConfirmed: true, reviewedAt: true, reviewedByUserId: true },
      });
      if (movie.isPublished) {
        await tx.movie.update({
          where: { id: b.movieId as string },
          data: { isPublished: false, contentStatus: ContentStatus.UNPUBLISHED },
        });
      }
      await writeAdminAuditEvent(tx, { actorUserId: auth.userId, action: "LICENSE_SAVED_PENDING", resourceType: "License", resourceId: saved.id, metadata: { movieId: b.movieId as string } });
      return { kind: "SAVED" as const, license: saved };
    }, { isolationLevel: "Serializable" });
    if (licenseResult.kind === "NOT_FOUND") {
      return NextResponse.json({ error: "Movie not found." }, { status: 404 });
    }
    return NextResponse.json({ message: "Licence details saved as PENDING. Any previously published movie was unpublished and will require fresh approval and manual publishing.", license: licenseResult.license }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "The licence changed during this update. Reload the record and try again." }, { status: 409 });
    }
    logSafeError("Admin licence save failed", error);
    return NextResponse.json({ error: "Unable to save licence details." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!(await hasValidJsonContentType(request, 32 * 1024))) {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
    const b = body as Record<string, unknown>;
    if (typeof b.movieId !== "string" || (b.status !== "ACTIVE" && b.status !== "REJECTED")) {
      return NextResponse.json({ error: "Choose an approval or rejection action." }, { status: 400 });
    }
    const movieId = b.movieId as string;

    if (b.status === "ACTIVE") {
      const evidenceReference = normalizeEvidenceReference(b.evidenceReference);
      const evidenceSha256 = normalizeEvidenceSha256(b.evidenceSha256);
      if (
        b.confirmed !== true ||
        b.rightsScopeConfirmed !== true ||
        !evidenceReference ||
        !evidenceSha256
      ) {
        return NextResponse.json({
          error: "Approval requires a controlled signed-document reference, its 64-character SHA-256, and explicit confirmation that the inspected document covers upload, hosting, processing, OTT/VOD streaming, territories, term and usage restrictions.",
        }, { status: 400 });
      }
      const now = new Date();
      const updated = await prisma.$transaction(async tx => {
        const current = await tx.license.findUnique({ where: { movieId } });
        if (!current) return { kind: "NOT_FOUND" as const };
        if (
          current.status !== LicenseStatus.PENDING ||
          current.startDate > now ||
          current.expiryDate <= now ||
          !current.allowedCountries.length
        ) return { kind: "INVALID" as const };
        const result = await tx.license.update({
          where: { movieId },
          data: {
            status: LicenseStatus.ACTIVE,
            evidenceReference,
            evidenceSha256,
            rightsScopeConfirmed: true,
            reviewedAt: now,
            reviewedByUserId: auth.userId,
          },
        });
        await tx.movie.update({
          where: { id: movieId },
          data: { allowedCountries: current.allowedCountries, licenseOwner: current.owner, licenseStartDate: current.startDate, licenseExpiryDate: current.expiryDate, downloadPermission: false },
        });
        await writeAdminAuditEvent(tx, {
          actorUserId: auth.userId,
          action: "LICENSE_APPROVED",
          resourceType: "License",
          resourceId: movieId,
          metadata: { evidenceSha256, rightsScopeConfirmed: true },
        });
        return { kind: "UPDATED" as const, status: result.status };
      }, { isolationLevel: "Serializable" });
      if (updated.kind === "NOT_FOUND") return NextResponse.json({ error: "No licence record exists for this movie." }, { status: 404 });
      if (updated.kind === "INVALID") return NextResponse.json({ error: "Only a current PENDING licence with permitted countries can be approved. Save a fresh pending review before approving." }, { status: 400 });
      return NextResponse.json({ message: "Licence marked ACTIVE after recording the controlled evidence reference, SHA-256 and reviewer attestation. The hash does not independently prove the document grants rights. Downloads remain disabled.", status: updated.status });
    }

    if (typeof b.reason !== "string" || b.reason.trim().length < 3) {
      return NextResponse.json({ error: "Enter a brief rejection reason." }, { status: 400 });
    }
    const rejectionReason = b.reason.trim().slice(0, 500);
    const reviewedAt = new Date();
    const rejected = await prisma.$transaction(async tx => {
      const current = await tx.license.findUnique({ where: { movieId } });
      if (!current) return false;
      await tx.license.update({
        where: { movieId },
        data: {
          status: LicenseStatus.REJECTED,
          notes: [current.notes, "REJECTION REASON: " + rejectionReason, "REVIEWED AT: " + reviewedAt.toISOString()].filter(Boolean).join("\\n"),
          rightsScopeConfirmed: false,
          reviewedAt,
          reviewedByUserId: auth.userId,
        },
      });
      const movie = await tx.movie.findUnique({ where: { id: movieId }, select: { isPublished: true } });
      if (movie?.isPublished) {
        await tx.movie.update({
          where: { id: movieId },
          data: { isPublished: false, contentStatus: ContentStatus.UNPUBLISHED },
        });
      }
      await writeAdminAuditEvent(tx, { actorUserId: auth.userId, action: "LICENSE_REJECTED", resourceType: "License", resourceId: movieId, metadata: { rejectionReasonRecorded: true } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!rejected) return NextResponse.json({ error: "No licence record exists for this movie." }, { status: 404 });
    return NextResponse.json({ message: "Licence marked REJECTED. Any published movie was automatically unpublished; re-approval will require a fresh manual publish action.", status: "REJECTED" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "The licence changed during review. Reload the record and try again." }, { status: 409 });
    }
    logSafeError("Admin licence review failed", error);
    return NextResponse.json({ error: "Unable to review licence." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/security/api-session";
import { logSafeError } from "@/lib/security/safe-log";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { profileSettingsSchema } from "@/lib/validations/user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

async function getUserId(): Promise<string | null> {
  const session = await getApiSession();
  const user = session?.user as { id?: string } | undefined;
  return user?.id ?? null;
}

function unauthorized() {
  return NextResponse.json(
    { error: "Please sign in to manage your account settings." },
    { status: 401, headers: PRIVATE_HEADERS },
  );
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        isEmailVerified: true,
        profiles: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            displayName: true,
            languagePreference: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    const profile = user.profiles[0];
    return NextResponse.json(
      {
        profile: {
          displayName: profile?.displayName ?? user.name ?? "",
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          languagePreference: profile?.languagePreference === "ta" ? "ta" : "en",
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    logSafeError("Account settings fetch failed", error);
    return NextResponse.json(
      { error: "Unable to load account settings right now." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  if (!(await hasValidJsonContentType(request))) {
    return NextResponse.json(
      { error: "A valid JSON request is required." },
      { status: 415, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const userId = await getUserId();
    if (!userId) return unauthorized();

    const body: unknown = await request.json();
    const parsed = profileSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid account settings." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isEmailVerified: true },
      });
      if (!user) return null;

      const existingProfile = await tx.profile.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const profileData = {
        displayName: parsed.data.displayName,
        languagePreference: parsed.data.languagePreference,
      };

      const profile = existingProfile
        ? await tx.profile.update({
            where: { id: existingProfile.id },
            data: profileData,
            select: { displayName: true, languagePreference: true },
          })
        : await tx.profile.create({
            data: { userId, ...profileData },
            select: { displayName: true, languagePreference: true },
          });

      await tx.user.update({
        where: { id: userId },
        data: { name: parsed.data.displayName },
      });

      return { profile, email: user.email, isEmailVerified: user.isEmailVerified };
    });

    if (!saved) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        message: "Account settings saved.",
        profile: {
          displayName: saved.profile.displayName,
          email: saved.email,
          isEmailVerified: saved.isEmailVerified,
          languagePreference: saved.profile.languagePreference === "ta" ? "ta" : "en",
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    logSafeError("Account settings update failed", error);
    return NextResponse.json(
      { error: "Unable to save account settings right now." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

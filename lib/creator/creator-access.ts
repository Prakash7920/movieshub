import { getApiSession } from "@/lib/security/api-session";
import { prisma } from "@/lib/prisma";

export const CREATOR_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

type ApprovedCreatorUser = {
  id: string;
  isEmailVerified: boolean;
  isBanned: boolean;
};

type ApprovedCreatorProfile = {
  id: string;
  status: string;
  publicName: string;
};

export type ApprovedCreatorResult =
  | { ok: true; user: ApprovedCreatorUser; creatorProfile: ApprovedCreatorProfile }
  | { ok: false; status: 401 | 403 | 404; error: string; creatorStatus?: string };

export async function getApprovedCreatorContext(): Promise<ApprovedCreatorResult> {
  const session = await getApiSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return { ok: false, status: 401, error: "Sign in to access Creator Studio." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isEmailVerified: true, isBanned: true },
  });

  if (!user) {
    return { ok: false, status: 404, error: "Account not found." };
  }

  if (user.isBanned || !user.isEmailVerified) {
    return {
      ok: false,
      status: 403,
      error: "A verified, active account is required for Creator Studio.",
    };
  }

  const creatorProfile = await prisma.creatorProfile.findUnique({
    where: { userId },
    select: { id: true, status: true, publicName: true },
  });

  if (!creatorProfile) {
    return {
      ok: false,
      status: 403,
      error: "Submit a creator application first.",
    };
  }

  if (creatorProfile.status !== "APPROVED") {
    return {
      ok: false,
      status: 403,
      error: "Creator submissions are available after your application is approved.",
      creatorStatus: creatorProfile.status,
    };
  }

  return { ok: true, user, creatorProfile };
}

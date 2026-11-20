import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getVercelViewerCountry } from "@/lib/licensing/territory";
import { getUserEntitlements } from "@/lib/subscriptions/entitlements";
import { authorizePlaybackRequest } from "@/lib/media/playback-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string } | undefined;
    const { slug } = await context.params;

    const result = await authorizePlaybackRequest(
      {
        userId: sessionUser?.id ?? null,
        slug,
        viewerCountry: getVercelViewerCountry(request.headers),
      },
      {
        findAccount: (userId) =>
          prisma.user.findUnique({
            where: { id: userId },
            select: { isBanned: true },
          }),
        findMovie: (movieSlug) =>
          prisma.movie.findUnique({
            where: { slug: movieSlug },
            select: {
              isPublished: true,
              contentStatus: true,
              movieType: true,
              videoUrl: true,
              license: {
                select: {
                  status: true,
                  startDate: true,
                  expiryDate: true,
                  allowedCountries: true,
                },
              },
            },
          }),
        getPremiumEntitlement: async (userId) =>
          (await getUserEntitlements(userId)).isPremium,
      },
    );

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to authorize playback right now.", code: "PLAYBACK_AUTHORIZATION_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { ArrowRight, Bookmark, Clapperboard, History, Settings2, ShieldCheck } from "lucide-react";
import { WatchlistContent } from "@/components/movies/watchlist";
import { authOptions } from "@/lib/auth-options";
import { getUserEntitlements } from "@/lib/subscriptions/entitlements";
import { LocalizedText } from "@/components/i18n/localized-text";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  const entitlements = sessionUser?.id
    ? await getUserEntitlements(sessionUser.id).catch((error) => {
        console.error("Dashboard subscription lookup failed:", error);
        return null;
      })
    : null;

  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200"><LocalizedText k="dashboardEyebrow" /></p>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl"><LocalizedText k="myDashboard" /></h1>
          <p className="mt-2 text-sm text-gray-400"><LocalizedText k="dashboardDescription" /></p>
        </div>
        <Link href="/movies" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500">
          <LocalizedText k="exploreMoviesButton" /> <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7" aria-labelledby="subscription-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]"><LocalizedText k="myPlan" /></p>
            </div>
            <h2 id="subscription-heading" className="mt-2 text-2xl font-bold text-white">
              {entitlements ? <LocalizedText k={entitlements.plan === "PREMIUM" ? "premium" : "free"} /> : sessionUser?.id ? <LocalizedText k="statusUnavailable" /> : <LocalizedText k="signInToViewPlan" />}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              {entitlements
                ? entitlements.isPremium
                  ? <LocalizedText k="premiumEntitlementDescription" />
                  : <LocalizedText k="freeEntitlementDescription" />
                : sessionUser?.id
                  ? <LocalizedText k="planStatusUnavailableDescription" />
                  : <LocalizedText k="privatePlanDetails" />}
            </p>
          </div>
          {entitlements ? (
            <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-200">
              {entitlements.subscriptionStatus === "TRIALING" ? <LocalizedText k="trial" /> : entitlements.isPremium ? <LocalizedText k="active" /> : <LocalizedText k="freePlanStatus" />}
            </span>
          ) : null}
        </div>
        {entitlements?.validUntil ? (
          <p className="mt-4 text-xs text-gray-500">
            <LocalizedText k="currentAccessValidUntil" values={{ date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(entitlements.validUntil) }} />
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/subscription" className="inline-flex items-center gap-2 rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10">
            <LocalizedText k="viewPlans" /> <ArrowRight className="h-4 w-4" />
          </Link>
          {!sessionUser?.id ? (
            <Link href="/auth/login" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5">
              <LocalizedText k="signIn" />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard href="/dashboard/watchlist" icon={<Bookmark className="h-5 w-5" />} title={<LocalizedText k="myWatchlist" />} description={<LocalizedText k="watchlistCardDescription" />} />
        <DashboardCard href="/dashboard/history" icon={<History className="h-5 w-5" />} title={<LocalizedText k="watchHistory" />} description={<LocalizedText k="historyCardDescription" />} />
        <DashboardCard href="/dashboard/settings" icon={<Settings2 className="h-5 w-5" />} title={<LocalizedText k="settings" />} description={<LocalizedText k="settingsCardDescription" />} />
        <DashboardCard href="/creator/studio" icon={<Clapperboard className="h-5 w-5" />} title="Creator Studio" description="Apply to become a creator and submit original film metadata for review." />
      </div>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white"><LocalizedText k="savedMovies" /></h2>
            <p className="mt-1 text-sm text-gray-400"><LocalizedText k="accountWatchlist" /></p>
          </div>
          <Link href="/dashboard/watchlist" className="text-sm font-medium text-red-300 hover:text-red-200"><LocalizedText k="manageWatchlist" /></Link>
        </div>
        <WatchlistContent />
      </section>
      <p className="mt-6 text-xs leading-5 text-gray-500"><LocalizedText k="dashboardPreviewNotice" /></p>
    </div>
  );
}

function DashboardCard({ href, icon, title, description }: {
  href: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <Link href={href} className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-red-500/40 hover:bg-white/[0.07]">
      <span className="inline-flex rounded-xl border border-white/10 bg-black/20 p-3 text-red-200">{icon}</span>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
    </Link>
  );
}

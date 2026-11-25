import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ArrowLeft, UserRound } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/dashboard/account-settings-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) redirect("/auth/login?callbackUrl=%2Fdashboard%2Fsettings");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      isEmailVerified: true,
      profiles: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { displayName: true, languagePreference: true },
      },
    },
  });

  if (!user) redirect("/auth/login?callbackUrl=%2Fdashboard%2Fsettings");

  const profile = user.profiles[0];
  const initialLanguagePreference = profile?.languagePreference === "ta" ? "ta" : "en";

  return (
    <main className="page-shell pb-16 pt-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">Your account</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold text-white md:text-4xl">
            <UserRound className="h-7 w-7 text-red-300" />
            Account Settings
          </h1>
          <p className="mt-2 text-sm text-gray-400">Manage the profile details and language used by your NexaFilm account.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>

      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7" aria-labelledby="account-settings-heading">
        <div className="mb-6">
          <h2 id="account-settings-heading" className="text-xl font-semibold text-white">Profile details</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">Your email address is read-only here. Display name and language preference are saved securely to your account.</p>
        </div>
        <AccountSettingsForm
          initialDisplayName={profile?.displayName ?? user.name ?? ""}
          email={user.email}
          isEmailVerified={user.isEmailVerified}
          initialLanguagePreference={initialLanguagePreference}
        />
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ArrowLeft, UserRound, LockKeyhole } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/dashboard/account-settings-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { LocalizedText } from "@/components/i18n/localized-text";

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
      provider: true,
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
          <p className="text-sm uppercase tracking-[0.2em] text-red-200"><LocalizedText k="yourAccount" /></p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold text-white md:text-4xl">
            <UserRound className="h-7 w-7 text-red-300" />
            <LocalizedText k="accountSettings" />
          </h1>
          <p className="mt-2 text-sm text-gray-400"><LocalizedText k="settingsPageDescription" /></p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> <LocalizedText k="backToDashboard" />
        </Link>
      </div>

      <div className="mx-auto grid max-w-2xl gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7" aria-labelledby="account-settings-heading">
          <div className="mb-6">
            <h2 id="account-settings-heading" className="text-xl font-semibold text-white"><LocalizedText k="profileDetails" /></h2>
            <p className="mt-2 text-sm leading-6 text-gray-400"><LocalizedText k="profileDetailsDescription" /></p>
          </div>
          <AccountSettingsForm
            initialDisplayName={profile?.displayName ?? user.name ?? ""}
            email={user.email}
            isEmailVerified={user.isEmailVerified}
            initialLanguagePreference={initialLanguagePreference}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7" aria-labelledby="change-password-heading">
          <div className="mb-6 flex items-start gap-3">
            <span className="inline-flex rounded-xl border border-white/10 bg-black/20 p-3 text-red-200">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <h2 id="change-password-heading" className="text-xl font-semibold text-white"><LocalizedText k="changePassword" /></h2>
              <p className="mt-2 text-sm leading-6 text-gray-400"><LocalizedText k="changePasswordDescription" /></p>
            </div>
          </div>

          {user.provider === "CREDENTIALS" ? (
            <>
              <ChangePasswordForm />
              <p className="mt-4 text-xs text-gray-500">
                <LocalizedText k="forgotCurrentPassword" /> <Link href="/auth/forgot-password" className="underline underline-offset-2 hover:text-white"><LocalizedText k="resetItByEmail" /></Link>.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400"><LocalizedText k="passwordManagedByProvider" /></p>
          )}
        </section>
      </div>
    </main>
  );
}

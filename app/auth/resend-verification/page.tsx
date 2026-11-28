import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default function ResendVerificationPage() {
  return (
    <main className="page-shell flex min-h-[65vh] items-center justify-center py-16">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-card/80 p-8 md:p-10">
        <div className="mb-5 inline-flex rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-red-200">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
          Account verification
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Resend verification email
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-300">
          Enter the email address you used to register. For account privacy, the confirmation message is the same whether or not an unverified account exists.
        </p>

        <div className="mt-8">
          <ResendVerificationForm />
        </div>

        <Link
          href="/auth/login"
          className="mt-7 inline-flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </section>
    </main>
  );
}

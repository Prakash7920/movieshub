import Link from "next/link";

export default function SubscriptionFailurePage() {
  return (
    <div className="page-shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center md:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Payment status</p>
        <h1 className="mt-4 text-3xl font-bold text-white">Check your payment status</h1>
        <p className="mt-4 text-gray-300">
          Opening this page does not mean a payment was attempted or declined. Subscription status changes only after NexaFilm verifies the provider response. Check your account dashboard before trying again.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="inline-flex rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-500">
            View my dashboard
          </Link>
          <Link href="/subscription" className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">
            Return to plans
          </Link>
        </div>
      </div>
    </div>
  );
}

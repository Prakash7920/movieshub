import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";

export default function SubscriptionSuccessPage() {
  return (
    <div className="page-shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center md:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><LocalizedText k="paymentVerificationEyebrow" /></p>
        <h1 className="mt-4 text-3xl font-bold text-white"><LocalizedText k="checkSubscriptionStatus" /></h1>
        <p className="mt-4 text-gray-300"><LocalizedText k="subscriptionUrlNotConfirmation" /></p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="inline-flex rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-500">
            <LocalizedText k="viewMyDashboard" />
          </Link>
          <Link href="/subscription" className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">
            <LocalizedText k="returnToPlans" />
          </Link>
        </div>
      </div>
    </div>
  );
}

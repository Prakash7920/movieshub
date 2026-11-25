"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPrice,
  getSubscriptionPriceLabel,
  type SubscriptionBillingCycle,
  type SubscriptionPlanId,
} from "@/lib/subscriptions/plans";

type CheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type CheckoutFailure = {
  error?: { description?: string; reason?: string };
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme: { color: string };
  handler: (response: CheckoutSuccess) => void | Promise<void>;
  modal: { ondismiss: () => void };
};

type CheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: CheckoutFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance;
  }
}

type OrderResponse = {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  error?: string;
};

export default function SubscriptionCheckout({ previewTestModeEnabled }: { previewTestModeEnabled: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [billing, setBilling] = useState<SubscriptionBillingCycle>("MONTHLY");
  const [gatewayReady, setGatewayReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const orderIdempotencyKeys = useRef<Partial<Record<SubscriptionBillingCycle, string>>>({});

  const handleCheckout = async (plan: SubscriptionPlanId) => {
    if (plan === "FREE") {
      window.location.assign("/auth/register");
      return;
    }
    if (!previewTestModeEnabled || busy) return;
    const RazorpayCheckout = window.Razorpay;
    if (!RazorpayCheckout) {
      setError(t.secureCheckoutLoadingError);
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    let checkoutOpened = false;

    try {
      const idempotencyKey = orderIdempotencyKeys.current[billing] ?? crypto.randomUUID();
      orderIdempotencyKeys.current[billing] = idempotencyKey;
      const orderResponse = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "PREMIUM",
          billingCycle: billing,
          idempotencyKey,
        }),
      });
      const order = await orderResponse.json().catch(() => null) as OrderResponse | null;

      if (orderResponse.status === 401) {
        router.push("/auth/login?callbackUrl=%2Fsubscription");
        return;
      }
      if (!orderResponse.ok || !order || !order.paymentId || !order.orderId
        || !Number.isSafeInteger(order.amount) || order.amount <= 0
        || order.currency !== "INR" || !order.keyId?.startsWith("rzp_test_")) {
        throw new Error(order?.error || t.unableToStartTestCheckout);
      }

      const checkout = new RazorpayCheckout({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "NexaFilm",
        description: "Premium " + (billing === "YEARLY" ? "yearly" : "monthly") + " plan",
        order_id: order.orderId,
        theme: { color: "#dc2626" },
        handler: async (payment) => {
          setBusy(true);
          try {
            const verificationResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              }),
            });
            const verification = await verificationResponse.json().catch(() => null) as { verified?: boolean; error?: string } | null;
            if (!verificationResponse.ok || verification?.verified !== true) {
              throw new Error(verification?.error || t.paymentVerificationIncomplete);
            }
            delete orderIdempotencyKeys.current[billing];
            setNotice(t.testPaymentVerified);
            router.refresh();
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : t.paymentVerificationFailed);
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      checkout.on("payment.failed", (failure) => {
        setError(failure.error?.description || failure.error?.reason || t.testModePaymentIncomplete);
        setBusy(false);
      });
      checkout.open();
      checkoutOpened = true;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : t.unableToOpenTestCheckout);
    } finally {
      if (!checkoutOpened) setBusy(false);
    }
  };

  const freePlan = SUBSCRIPTION_PLANS.FREE;
  const premiumPlan = SUBSCRIPTION_PLANS.PREMIUM;

  return (
    <>
      {previewTestModeEnabled && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onReady={() => setGatewayReady(true)}
        />
      )}

      <div className="page-shell pb-16 pt-8">
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">{t.plansPricing}</p>
          <h1 className="mt-3 text-4xl font-black text-white">{t.choosePlan}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400">{t.billingDescription}</p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-card/80 p-1">
            <button type="button" aria-pressed={billing === "MONTHLY"} className={"rounded-full px-4 py-2 text-sm " + (billing === "MONTHLY" ? "bg-red-600 text-white" : "text-gray-300")} onClick={() => setBilling("MONTHLY")}>{t.monthly}</button>
            <button type="button" aria-pressed={billing === "YEARLY"} className={"rounded-full px-4 py-2 text-sm " + (billing === "YEARLY" ? "bg-red-600 text-white" : "text-gray-300")} onClick={() => setBilling("YEARLY")}>{t.yearly}</button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PlanCard plan={freePlan} billing={billing} onSelect={() => handleCheckout("FREE")} disabled={false} buttonLabel={t.createFreeAccount} t={t} />
          <PlanCard
            plan={premiumPlan}
            billing={billing}
            onSelect={() => handleCheckout("PREMIUM")}
            disabled={!previewTestModeEnabled || !gatewayReady || busy}
            buttonLabel={!previewTestModeEnabled ? t.premiumCheckoutComingSoon : !gatewayReady ? t.loadingCheckout : busy ? t.processing : t.payWithTestMode}
            t={t}
          />
        </div>

        <div className={"mt-10 rounded-2xl border p-5 " + (previewTestModeEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-300" />
            <h2 className="font-semibold text-white">{previewTestModeEnabled ? t.testModeBadge : t.paymentsDisabled}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            {previewTestModeEnabled
              ? t.testModeCheckoutDescription
              : t.paymentsDisabledDescription}
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
        </div>
      </div>
    </>
  );
}

function PlanCard({ plan, billing, onSelect, disabled, buttonLabel, t }: {
  plan: (typeof SUBSCRIPTION_PLANS)[SubscriptionPlanId];
  billing: SubscriptionBillingCycle;
  onSelect: () => void;
  disabled: boolean;
  buttonLabel: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const isPremium = plan.id === "PREMIUM";
  const price = getSubscriptionPrice(plan.id, billing);
  const priceLabel = getSubscriptionPriceLabel(plan.id, billing);
  const name = isPremium ? t.premiumPlanName : t.freePlanName;
  const description = isPremium ? t.premiumPlanDescription : t.freePlanDescription;
  const features = isPremium
    ? [t.premiumFeature1, t.premiumFeature2, t.premiumFeature3, t.premiumFeature4]
    : [t.freeFeature1, t.freeFeature2, t.freeFeature3, t.freeFeature4];

  return (
    <section className={"rounded-[1.75rem] border p-6 " + (isPremium ? "border-red-500/50 bg-red-500/5" : "border-white/10 bg-card/70")}>
      <p className="text-sm uppercase tracking-[0.22em] text-red-200">{name}</p>
      <h2 className="mt-3 text-4xl font-bold text-white">{priceLabel}</h2>
      <p className="mt-1 text-sm text-gray-500">{price === 0 ? t.alwaysFree : billing === "YEARLY" ? t.perYear : t.perMonth}</p>
      <p className="mt-4 text-sm text-gray-300">{description}</p>
      <ul className="mt-5 space-y-3 text-sm text-gray-200">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button type="button" className={"mt-6 w-full " + (isPremium ? "bg-red-600 hover:bg-red-500" : "")} variant={isPremium ? "default" : "secondary"} disabled={disabled} onClick={onSelect}>
        {buttonLabel}
      </Button>
      {isPremium && <p className="mt-3 text-center text-xs text-gray-500">{t.testModeOnlyNoProductionCharge}</p>}
    </section>
  );
}

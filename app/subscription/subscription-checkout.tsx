"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [billing, setBilling] = useState<SubscriptionBillingCycle>("MONTHLY");
  const [gatewayReady, setGatewayReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCheckout = async (plan: SubscriptionPlanId) => {
    if (plan === "FREE") {
      window.location.assign("/auth/register");
      return;
    }
    if (!previewTestModeEnabled || busy) return;
    const RazorpayCheckout = window.Razorpay;
    if (!RazorpayCheckout) {
      setError("Secure checkout is still loading. Please try again.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    let checkoutOpened = false;

    try {
      const orderResponse = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "PREMIUM",
          billingCycle: billing,
          idempotencyKey: crypto.randomUUID(),
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
        throw new Error(order?.error || "Unable to start Test Mode checkout.");
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
              throw new Error(verification?.error || "Payment verification did not complete.");
            }
            setNotice("Test payment verified. Your Preview subscription status has been updated.");
            router.refresh();
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Payment verification failed. Contact support before retrying.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      checkout.on("payment.failed", (failure) => {
        setError(failure.error?.description || failure.error?.reason || "The Test Mode payment did not complete.");
        setBusy(false);
      });
      checkout.open();
      checkoutOpened = true;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to open Test Mode checkout.");
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
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">Plans & pricing</p>
          <h1 className="mt-3 text-4xl font-black text-white">Choose your NexaFilm plan</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400">Choose monthly or annual billing. Paid checkout is enabled only for the Phase 5 Preview Test Mode.</p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-card/80 p-1">
            <button type="button" aria-pressed={billing === "MONTHLY"} className={"rounded-full px-4 py-2 text-sm " + (billing === "MONTHLY" ? "bg-red-600 text-white" : "text-gray-300")} onClick={() => setBilling("MONTHLY")}>Monthly</button>
            <button type="button" aria-pressed={billing === "YEARLY"} className={"rounded-full px-4 py-2 text-sm " + (billing === "YEARLY" ? "bg-red-600 text-white" : "text-gray-300")} onClick={() => setBilling("YEARLY")}>Yearly</button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PlanCard plan={freePlan} billing={billing} onSelect={() => handleCheckout("FREE")} disabled={false} buttonLabel="Create a free account" />
          <PlanCard
            plan={premiumPlan}
            billing={billing}
            onSelect={() => handleCheckout("PREMIUM")}
            disabled={!previewTestModeEnabled || !gatewayReady || busy}
            buttonLabel={!previewTestModeEnabled ? "Premium checkout coming soon" : !gatewayReady ? "Loading secure checkout…" : busy ? "Processing…" : "Pay with Razorpay Test Mode"}
          />
        </div>

        <div className={"mt-10 rounded-2xl border p-5 " + (previewTestModeEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-300" />
            <h2 className="font-semibold text-white">{previewTestModeEnabled ? "Razorpay Test Mode — Preview only" : "Payments are not enabled"}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            {previewTestModeEnabled
              ? "This checkout is restricted to the Phase 5 Preview branch and requires an rzp_test_ key. Do not enter real card or bank details. Production checkout remains disabled."
              : "No payment will be collected and no Premium entitlement will be granted from this environment. Checkout will remain disabled until a separately approved release."}
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
        </div>
      </div>
    </>
  );
}

function PlanCard({ plan, billing, onSelect, disabled, buttonLabel }: {
  plan: (typeof SUBSCRIPTION_PLANS)[SubscriptionPlanId];
  billing: SubscriptionBillingCycle;
  onSelect: () => void;
  disabled: boolean;
  buttonLabel: string;
}) {
  const isPremium = plan.id === "PREMIUM";
  const price = getSubscriptionPrice(plan.id, billing);
  const priceLabel = getSubscriptionPriceLabel(plan.id, billing);

  return (
    <section className={"rounded-[1.75rem] border p-6 " + (isPremium ? "border-red-500/50 bg-red-500/5" : "border-white/10 bg-card/70")}>
      <p className="text-sm uppercase tracking-[0.22em] text-red-200">{plan.name}</p>
      <h2 className="mt-3 text-4xl font-bold text-white">{priceLabel}</h2>
      <p className="mt-1 text-sm text-gray-500">{price === 0 ? "Always free" : billing === "YEARLY" ? "per year" : "per month"}</p>
      <p className="mt-4 text-sm text-gray-300">{plan.description}</p>
      <ul className="mt-5 space-y-3 text-sm text-gray-200">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button type="button" className={"mt-6 w-full " + (isPremium ? "bg-red-600 hover:bg-red-500" : "")} variant={isPremium ? "default" : "secondary"} disabled={disabled} onClick={onSelect}>
        {buttonLabel}
      </Button>
      {isPremium && <p className="mt-3 text-center text-xs text-gray-500">Test-mode payment only. No Production charge is possible from this page.</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockPaymentProvider, getPlanPrice } from "@/lib/payments/mock-payment";

export default function SubscriptionPage() {
  const [billing, setBilling] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCheckout = async (plan: "FREE" | "PREMIUM") => {
    const payment = await mockPaymentProvider.createCheckoutSession({
      plan,
      billingCycle: billing,
      amount: getPlanPrice(plan, billing),
      userId: "demo-user",
    });

    setResult({
      success: payment.success,
      message: payment.success ? payment.message ?? "Checkout successful" : payment.message ?? "Checkout failed",
    });
  };

  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-red-200">Plans & pricing</p>
        <h1 className="mt-3 text-4xl font-black text-white">Choose your MoviesHub plan</h1>
      </div>

      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-card/80 p-1">
          <button type="button" className={`rounded-full px-4 py-2 text-sm ${billing === "MONTHLY" ? "bg-red-600 text-white" : "text-gray-300"}`} onClick={() => setBilling("MONTHLY")}>Monthly</button>
          <button type="button" className={`rounded-full px-4 py-2 text-sm ${billing === "YEARLY" ? "bg-red-600 text-white" : "text-gray-300"}`} onClick={() => setBilling("YEARLY")}>Yearly</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-card/70 p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-gray-300">Free</p>
          <h2 className="mt-3 text-4xl font-bold text-white">₹0</h2>
          <p className="mt-2 text-gray-400">Good for casual viewing with selected free titles.</p>
          <ul className="mt-5 space-y-3 text-sm text-gray-200">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Selected free movies</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Standard quality</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Ads enabled</li>
          </ul>
          <Button type="button" variant="secondary" className="mt-6 w-full" onClick={() => handleCheckout("FREE")}>Start free</Button>
        </div>

        <div className="rounded-[1.75rem] border border-red-500/50 bg-red-500/5 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.22em] text-red-200">Premium</p>
            <Lock className="h-5 w-5 text-yellow-400" />
          </div>
          <h2 className="mt-3 text-4xl font-bold text-white">₹{billing === "MONTHLY" ? "299" : "2399"}</h2>
          <p className="mt-2 text-gray-300">Ad-free streaming, premium catalog, and all family features.</p>
          <ul className="mt-5 space-y-3 text-sm text-gray-200">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Ad-free streaming</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Premium movie access</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Full HD + multiple profiles</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-red-400" /> Advanced recommendations</li>
          </ul>
          <Button type="button" className="mt-6 w-full bg-red-600 hover:bg-red-500" onClick={() => handleCheckout("PREMIUM")}>Upgrade to premium</Button>
        </div>
      </div>

      {result && (
        <div className={`mt-8 rounded-2xl border p-4 text-sm ${result.success ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : "border-red-500/40 bg-red-500/5 text-red-300"}`}>
          {result.message}
        </div>
      )}

      <div className="mt-12 rounded-[2rem] border border-white/10 bg-card/70 p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-red-400" />
          <h2 className="text-xl font-semibold text-white">Why customers choose Premium</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FeatureItem title="No ads" description="Stream premium titles without interruptions." />
          <FeatureItem title="Instant access" description="Unlock hero titles and new releases first." />
          <FeatureItem title="Better recommendations" description="Receive personalized suggestions from the local recommendation engine." />
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  );
}

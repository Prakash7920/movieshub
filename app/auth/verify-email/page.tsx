"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is invalid or missing its token.");
      return;
    }
    const verify = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || "This verification link is invalid or expired.");
        setStatus("success");
        setMessage(data?.message || "Your email address has been verified.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to verify your email.");
      }
    };
    void verify();
  }, []);

  return (
    <main className="page-shell flex min-h-[65vh] items-center justify-center py-16">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-card/80 p-8 text-center">
        <h1 className="text-3xl font-bold text-white">Email verification</h1>
        <p role="status" aria-live="polite" className="mt-5 text-gray-300">{message}</p>
        {status !== "loading" && (
          <Link href={status === "success" ? "/auth/login" : "/auth/resend-verification"} className="mt-8 inline-flex rounded-xl bg-red-600 px-5 py-3 font-medium text-white hover:bg-red-500">
            {status === "success" ? "Continue to login" : "Try again"}
          </Link>
        )}
      </section>
    </main>
  );
}

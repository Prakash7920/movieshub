"use client";

import { useState, type FormEvent } from "react";

type ResendResponse = {
  message?: string;
  error?: string;
};

export function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const payload = (await response.json().catch(() => ({}))) as ResendResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to process your request right now.");
      }

      setMessage(
        payload.message ??
          "If an unverified account exists for that email, a verification link will be sent.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process your request right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="verification-email" className="mb-2 block text-sm font-medium text-gray-200">
          Account email
        </label>
        <input
          id="verification-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-400"
        />
      </div>

      {message ? (
        <p role="status" aria-live="polite" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Resend verification email"}
      </button>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useLanguage } from "@/components/providers/language-provider";

type ChangePasswordResponse = {
  message?: string;
  error?: string;
};

export function ChangePasswordForm() {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t.passwordConfirmationMismatch);
      return;
    }
    if (currentPassword === newPassword) {
      setError(t.passwordMustDiffer);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as ChangePasswordResponse;

      if (!response.ok) {
        const serverMessage = payload.error ?? t.unableToChangePassword;
        throw new Error(serverMessage === "Current password is incorrect." ? t.currentPasswordIncorrect : serverMessage);
      }

      // The server invalidates existing sessions after updating the hash.
      // A full navigation ensures NextAuth re-checks the revoked session.
      window.location.assign("/auth/login?passwordChanged=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.unableToChangePassword);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="current-password" className="mb-2 block text-sm font-medium text-gray-200">
          {t.currentPassword}
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          minLength={8}
          maxLength={128}
          required
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-400"
        />
      </div>

      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-200">
          {t.newPassword}
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-400"
        />
        <p className="mt-2 text-xs text-gray-500">{t.passwordMinLengthHelper}</p>
      </div>

      <div>
        <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium text-gray-200">
          {t.confirmNewPassword}
        </label>
        <input
          id="confirm-new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-400"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t.updatingPassword : t.updatePassword}
      </button>
    </form>
  );
}

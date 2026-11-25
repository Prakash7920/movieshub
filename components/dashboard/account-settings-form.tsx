"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";

type LanguagePreference = "en" | "ta";

type AccountSettingsFormProps = {
  initialDisplayName: string;
  email: string;
  isEmailVerified: boolean;
  initialLanguagePreference: LanguagePreference;
};

type ProfileResponse = {
  error?: string;
  profile?: {
    displayName: string;
    languagePreference: LanguagePreference;
  };
};

export function AccountSettingsForm({
  initialDisplayName,
  email,
  isEmailVerified,
  initialLanguagePreference,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(initialLanguagePreference);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ displayName, languagePreference }),
      });
      const payload = (await response.json().catch(() => ({}))) as ProfileResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save account settings.");
      }

      const savedName = payload.profile?.displayName ?? displayName;
      const savedLanguage = payload.profile?.languagePreference ?? languagePreference;
      setDisplayName(savedName);
      setLanguagePreference(savedLanguage);
      setLanguage(savedLanguage);
      setMessage("Settings saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save account settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-gray-200">
          Email address
        </label>
        <input
          id="account-email"
          type="email"
          value={email}
          readOnly
          aria-describedby="account-email-help"
          className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-gray-400"
        />
        <p id="account-email-help" className="mt-2 text-xs text-gray-500">
          {isEmailVerified
            ? "Your email address is verified. Email changes require a separate verification flow."
            : "Your email address is not verified yet. Complete email verification before using restricted account features."}
        </p>
      </div>

      <div>
        <label htmlFor="account-display-name" className="mb-2 block text-sm font-medium text-gray-200">
          Display name
        </label>
        <input
          id="account-display-name"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          minLength={2}
          maxLength={80}
          autoComplete="name"
          required
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-400"
        />
        <p className="mt-2 text-xs text-gray-500">This name appears on your NexaFilm account.</p>
      </div>

      <div>
        <label htmlFor="account-language" className="mb-2 block text-sm font-medium text-gray-200">
          Preferred language
        </label>
        <select
          id="account-language"
          name="languagePreference"
          value={languagePreference}
          onChange={(event) => setLanguagePreference(event.target.value as LanguagePreference)}
          className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-white outline-none transition focus:border-red-400"
        >
          <option value="en">English</option>
          <option value="ta">தமிழ் (Tamil)</option>
        </select>
        <p className="mt-2 text-xs text-gray-500">Your choice is saved to your account and applied to this browser.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save settings"}
        </button>
        <a href="/auth/forgot-password" className="text-sm text-gray-300 underline decoration-white/30 underline-offset-4 hover:text-white">
          Reset password
        </a>
      </div>
    </form>
  );
}

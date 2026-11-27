"use client";

import { useCallback, useEffect, useState } from "react";

type CreatorProfile = {
  id: string;
  publicName: string;
  bio: string | null;
  status: string;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  adultEligibilityConfirmed: boolean;
};

type Submission = {
  id: string;
  title: string;
  synopsis: string;
  originalLanguage: string;
  runtimeMinutes: number;
  releaseYear: number;
  contentType: "SHORT_FILM" | "EPISODE";
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  updatedAt: string;
};

type DraftForm = {
  title: string;
  synopsis: string;
  originalLanguage: string;
  runtimeMinutes: string;
  releaseYear: string;
  contentType: "SHORT_FILM" | "EPISODE";
};

const EMPTY_DRAFT: DraftForm = {
  title: "",
  synopsis: "",
  originalLanguage: "ta",
  runtimeMinutes: "10",
  releaseYear: String(new Date().getFullYear()),
  contentType: "SHORT_FILM",
};

export default function CreatorStudio() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [publicName, setPublicName] = useState("");
  const [bio, setBio] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/creator/profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load creator status.");
      setProfile(data.creatorProfile ?? null);
      if (data.creatorProfile?.status === "APPROVED") {
        const submissionsResponse = await fetch("/api/creator/submissions", { cache: "no-store" });
        const submissionsData = await submissionsResponse.json();
        if (!submissionsResponse.ok) throw new Error(submissionsData.error ?? "Unable to load submissions.");
        setSubmissions(submissionsData.submissions ?? []);
      } else {
        setSubmissions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Creator Studio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/creator/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicName, bio, adultEligibilityConfirmed: adultConfirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit creator application.");
      setMessage(data.message ?? "Application submitted.");
      await load();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Unable to submit creator application.");
    } finally {
      setBusy(false);
    }
  }

  function editSubmission(item: Submission) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      synopsis: item.synopsis,
      originalLanguage: item.originalLanguage,
      runtimeMinutes: String(item.runtimeMinutes),
      releaseYear: String(item.releaseYear),
      contentType: item.contentType,
    });
    setMessage("Draft loaded for editing.");
    setError("");
  }

  function clearDraft() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const metadata = {
      title: draft.title,
      synopsis: draft.synopsis,
      originalLanguage: draft.originalLanguage,
      runtimeMinutes: Number(draft.runtimeMinutes),
      releaseYear: Number(draft.releaseYear),
      contentType: draft.contentType,
    };
    try {
      const response = await fetch("/api/creator/submissions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { action: "SAVE_DRAFT", id: editingId, ...metadata } : metadata),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save draft.");
      if (!editingId) setEditingId(data.submission.id);
      setMessage("Private draft saved. It is not published or playable.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let submissionId = editingId;
      if (!submissionId) {
        const createResponse = await fetch("/api/creator/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            synopsis: draft.synopsis,
            originalLanguage: draft.originalLanguage,
            runtimeMinutes: Number(draft.runtimeMinutes),
            releaseYear: Number(draft.releaseYear),
            contentType: draft.contentType,
          }),
        });
        const created = await createResponse.json();
        if (!createResponse.ok) throw new Error(created.error ?? "Unable to create draft.");
        submissionId = created.submission.id as string;
      } else {
        const saveResponse = await fetch("/api/creator/submissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SAVE_DRAFT",
            id: submissionId,
            title: draft.title,
            synopsis: draft.synopsis,
            originalLanguage: draft.originalLanguage,
            runtimeMinutes: Number(draft.runtimeMinutes),
            releaseYear: Number(draft.releaseYear),
            contentType: draft.contentType,
          }),
        });
        const saved = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(saved.error ?? "Unable to save draft.");
      }

      const response = await fetch("/api/creator/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_FOR_REVIEW", id: submissionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit for review.");
      setMessage("Metadata submitted for admin review. Your work remains private and unpublished.");
      clearDraft();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit for review.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white";

  return (
    <main className="page-shell py-10">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">NexaFilm Creator Network</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Creator Studio</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
          Apply to become a NexaFilm creator and submit original film metadata for review. Video upload, publication and playback are not available in this step.
        </p>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-green-500/10 p-3 text-sm text-green-200">{message}</p>}

        {loading ? (
          <p className="mt-8 text-sm text-gray-400">Loading creator status…</p>
        ) : !profile ? (
          <form onSubmit={apply} className="mt-8 grid max-w-2xl gap-4">
            <h2 className="text-xl font-semibold text-white">Creator application</h2>
            <label className="text-sm text-gray-300">
              Public creator name
              <input className={inputClass} required minLength={2} maxLength={80} value={publicName} onChange={event => setPublicName(event.target.value)} />
            </label>
            <label className="text-sm text-gray-300">
              Short bio (optional)
              <textarea className={inputClass + " min-h-28"} maxLength={500} value={bio} onChange={event => setBio(event.target.value)} />
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input type="checkbox" required checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
              <span>I confirm that I am 18 years old or older. This is a self-declaration, not independent age verification; NexaFilm may require a separate check before onboarding.</span>
            </label>
            <p className="text-xs leading-5 text-gray-400">A verified email and active account are required. Do not submit identity or bank documents in this form. Applying does not grant any film rights or guarantee acceptance or earnings.</p>
            <button disabled={busy} className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Submitting…" : "Apply as creator"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-8">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{profile.publicName}</h2>
                  <p className="mt-1 text-sm text-gray-400">{profile.bio || "Creator profile"}</p>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-200">{profile.status.replaceAll("_", " ")}</span>
              </div>
              {profile.reviewNotes && <p className="mt-3 text-sm text-amber-200">Review note: {profile.reviewNotes}</p>}
              {profile.status === "PENDING" && <p className="mt-3 text-sm text-gray-400">Your application is waiting for admin review.</p>}
              {profile.status === "REJECTED" && <p className="mt-3 text-sm text-gray-400">Your application was not approved. Please contact NexaFilm support for the next steps.</p>}
              {profile.status === "SUSPENDED" && <p className="mt-3 text-sm text-gray-400">Creator access is suspended. Existing submissions remain unavailable for editing.</p>}
            </section>

            {profile.status === "APPROVED" && (
              <>
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                  <h2 className="text-xl font-semibold text-white">{editingId ? "Edit metadata draft" : "New metadata submission"}</h2>
                  <p className="mt-2 text-sm text-gray-400">Metadata only. Do not enter video links or upload files. Every submission is reviewed before any catalogue consideration.</p>
                  <form onSubmit={saveDraft} className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-gray-300 sm:col-span-2">
                      Film / episode title
                      <input className={inputClass} required minLength={2} maxLength={160} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="text-sm text-gray-300 sm:col-span-2">
                      Synopsis
                      <textarea className={inputClass + " min-h-28"} required minLength={20} maxLength={3000} value={draft.synopsis} onChange={event => setDraft(current => ({ ...current, synopsis: event.target.value }))} />
                    </label>
                    <label className="text-sm text-gray-300">
                      Original language code
                      <input className={inputClass} required minLength={2} maxLength={3} pattern="[A-Za-z]{2,3}" value={draft.originalLanguage} onChange={event => setDraft(current => ({ ...current, originalLanguage: event.target.value.toLowerCase() }))} />
                    </label>
                    <label className="text-sm text-gray-300">
                      Content type
                      <select className={inputClass} value={draft.contentType} onChange={event => setDraft(current => ({ ...current, contentType: event.target.value as DraftForm["contentType"] }))}>
                        <option value="SHORT_FILM">Short film</option>
                        <option value="EPISODE">Episode</option>
                      </select>
                    </label>
                    <label className="text-sm text-gray-300">
                      Runtime (minutes)
                      <input className={inputClass} required type="number" min={1} max={1000} value={draft.runtimeMinutes} onChange={event => setDraft(current => ({ ...current, runtimeMinutes: event.target.value }))} />
                    </label>
                    <label className="text-sm text-gray-300">
                      Release year
                      <input className={inputClass} required type="number" min={1888} max={new Date().getFullYear() + 1} value={draft.releaseYear} onChange={event => setDraft(current => ({ ...current, releaseYear: event.target.value }))} />
                    </label>
                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                      <button disabled={busy} type="submit" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button>
                      <button disabled={busy} type="button" onClick={() => void submitForReview()} className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for review"}</button>
                      {editingId && <button disabled={busy} type="button" onClick={clearDraft} className="rounded-full px-4 py-3 text-sm text-gray-300">Cancel editing</button>}
                    </div>
                  </form>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-white">Your submissions</h2>
                  <div className="mt-4 space-y-3">
                    {submissions.length === 0 ? <p className="text-sm text-gray-400">No submissions yet.</p> : submissions.map(item => (
                      <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white">{item.title}</h3>
                            <p className="mt-1 text-xs text-gray-400">{item.contentType.replaceAll("_", " ")} · {item.originalLanguage.toUpperCase()} · {item.runtimeMinutes} min · {item.releaseYear}</p>
                          </div>
                          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-200">{item.status.replaceAll("_", " ")}</span>
                        </div>
                        {item.reviewNotes && <p className="mt-3 text-sm text-amber-200">Review note: {item.reviewNotes}</p>}
                        {(item.status === "DRAFT" || item.status === "NEEDS_CHANGES") && (
                          <button type="button" onClick={() => editSubmission(item)} className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">Edit draft</button>
                        )}
                        {item.status === "APPROVED_FOR_CATALOGUE" && <p className="mt-3 text-xs text-gray-400">Metadata approved for the next catalogue review. This is not a licence, publication or playback approval.</p>}
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

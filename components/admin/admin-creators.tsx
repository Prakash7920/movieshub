"use client";

import { useCallback, useEffect, useState } from "react";

type CreatorApplication = {
  id: string;
  publicName: string;
  bio: string | null;
  status: string;
  appliedAt: string;
  user: { email: string };
};

type CreatorSubmission = {
  id: string;
  title: string;
  synopsis: string;
  originalLanguage: string;
  runtimeMinutes: number;
  releaseYear: number;
  contentType: string;
  status: string;
  submittedAt: string | null;
  creatorProfile: { id: string; publicName: string; user: { email: string } };
};

export default function AdminCreators() {
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [submissions, setSubmissions] = useState<CreatorSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/creators", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load creator review queue.");
      setApplications(data.creatorProfiles ?? []);
      setSubmissions(data.submissions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load creator review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(resourceType: "CREATOR_PROFILE" | "CREATOR_SUBMISSION", id: string, status: string) {
    const notes = window.prompt("Enter a review note (required):");
    if (!notes || notes.trim().length < 3) return;
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/creators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, id, status, notes: notes.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save review decision.");
      setMessage(data.message ?? "Review decision saved.");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to save review decision.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="page-shell pb-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Creator Network</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Creator review queue</h2>
        <p className="mt-2 text-sm text-gray-400">Approving a creator permits metadata submissions. Approving a submission does not create a catalogue movie, clear rights, upload video or publish playback.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-200">{message}</p>}
        {loading ? <p className="mt-5 text-sm text-gray-400">Loading review queue…</p> : (
          <div className="mt-6 space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-white">Pending creator applications ({applications.length})</h3>
              <div className="mt-3 space-y-3">
                {applications.length === 0 ? <p className="text-sm text-gray-400">No pending applications.</p> : applications.map(item => (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <h4 className="font-semibold text-white">{item.publicName}</h4>
                    <p className="mt-1 text-xs text-gray-400">{item.user.email} · Applied {new Date(item.appliedAt).toLocaleDateString()}</p>
                    <p className="mt-3 text-sm text-gray-300">{item.bio || "No bio supplied."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={busyId === item.id} onClick={() => void review("CREATOR_PROFILE", item.id, "APPROVED")} className="rounded-full bg-green-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve creator</button>
                      <button disabled={busyId === item.id} onClick={() => void review("CREATOR_PROFILE", item.id, "REJECTED")} className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-lg font-semibold text-white">Submitted film metadata ({submissions.length})</h3>
              <div className="mt-3 space-y-3">
                {submissions.length === 0 ? <p className="text-sm text-gray-400">No submissions awaiting review.</p> : submissions.map(item => (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-200">{item.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{item.creatorProfile.publicName} · {item.creatorProfile.user.email}</p>
                    <p className="mt-3 text-sm leading-6 text-gray-300">{item.synopsis}</p>
                    <p className="mt-2 text-xs text-gray-400">{item.contentType.replaceAll("_", " ")} · {item.originalLanguage.toUpperCase()} · {item.runtimeMinutes} min · {item.releaseYear}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={busyId === item.id} onClick={() => void review("CREATOR_SUBMISSION", item.id, "APPROVED_FOR_CATALOGUE")} className="rounded-full bg-green-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve metadata</button>
                      <button disabled={busyId === item.id} onClick={() => void review("CREATOR_SUBMISSION", item.id, "NEEDS_CHANGES")} className="rounded-full border border-amber-400/40 px-4 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50">Request changes</button>
                      <button disabled={busyId === item.id} onClick={() => void review("CREATOR_SUBMISSION", item.id, "REJECTED")} className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Reject submission</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

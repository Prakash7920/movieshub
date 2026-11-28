"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CandidateRevision = {
  id: string; revisionNumber: number; title: string; originalLanguage: string;
  creatorSubmission: { id: string; title: string; creatorProfile: { publicName: string } };
};
type RightsReview = {
  id: string; submissionRevisionId: string; sequence: number; status: string;
  rightsHolder: string; evidenceReference: string; evidenceSha256: string;
  ownerApprovalReference: string; legalApprovalReference: string;
  allowedTerritories: string[]; allowedLanguages: string[]; permittedMediaRoles: string[];
  startDate: string; expiryDate: string; uploadAllowed: boolean; hostingAllowed: boolean;
  processingAllowed: boolean; ottVodStreamingAllowed: boolean; downloadsAllowed: boolean;
  submittedByUserId: string; reviewedAt: string | null; reviewedByUserId: string | null;
  reviewNotes: string | null;
  submissionRevision: { id: string; revisionNumber: number; title: string; originalLanguage: string; creatorSubmission: { title: string; creatorProfile: { publicName: string } } };
  submittedBy: { id: string; email: string }; reviewedBy: { id: string; email: string } | null;
};
const initialForm = {
  submissionRevisionId: "", rightsHolder: "", evidenceReference: "", evidenceSha256: "",
  ownerApprovalReference: "", legalApprovalReference: "", allowedTerritories: "IN",
  allowedLanguages: "ta", permittedMediaRoles: ["PRIMARY_VIDEO"] as string[],
  startDate: "", expiryDate: "", uploadAllowed: false, hostingAllowed: false,
  processingAllowed: false, ottVodStreamingAllowed: false,
};
const mediaRoles = ["PRIMARY_VIDEO", "TRAILER", "POSTER", "BACKDROP", "CAPTION", "SUBTITLE"];

export default function AdminCreatorRightsReviews() {
  const [candidates, setCandidates] = useState<CandidateRevision[]>([]);
  const [reviews, setReviews] = useState<RightsReview[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCandidate = useMemo(() => candidates.find(item => item.id === form.submissionRevisionId), [candidates, form.submissionRevisionId]);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/creator-rights-reviews", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load rights-review queue.");
      setCandidates(data.candidateRevisions ?? []);
      setReviews(data.reviews ?? []);
      setForm(current => ({ ...current, submissionRevisionId: current.submissionRevisionId || data.candidateRevisions?.[0]?.id || "" }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load rights-review queue.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function setField<K extends keyof typeof initialForm>(key: K, value: typeof initialForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function toggleRole(role: string) {
    setForm(current => ({
      ...current,
      permittedMediaRoles: current.permittedMediaRoles.includes(role)
        ? current.permittedMediaRoles.filter(item => item !== role)
        : [...current.permittedMediaRoles, role],
    }));
  }

  async function createReview(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/creator-rights-reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionRevisionId: form.submissionRevisionId, rightsHolder: form.rightsHolder,
          evidenceReference: form.evidenceReference, evidenceSha256: form.evidenceSha256,
          ownerApprovalReference: form.ownerApprovalReference, legalApprovalReference: form.legalApprovalReference,
          allowedTerritories: form.allowedTerritories.split(",").map(x => x.trim()).filter(Boolean),
          allowedLanguages: form.allowedLanguages.split(",").map(x => x.trim()).filter(Boolean),
          permittedMediaRoles: form.permittedMediaRoles,
          startDate: new Date(form.startDate + "T00:00:00.000Z").toISOString(),
          expiryDate: new Date(form.expiryDate + "T23:59:59.999Z").toISOString(),
          uploadAllowed: form.uploadAllowed, hostingAllowed: form.hostingAllowed,
          processingAllowed: form.processingAllowed, ottVodStreamingAllowed: form.ottVodStreamingAllowed,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create rights review.");
      setMessage(data.message ?? "Pending rights review created.");
      setForm(current => ({ ...initialForm, submissionRevisionId: current.submissionRevisionId, startDate: current.startDate, expiryDate: current.expiryDate }));
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create rights review.");
    } finally { setBusy(false); }
  }

  async function decide(review: RightsReview, status: "APPROVED" | "REJECTED") {
    let reviewNotes: string | undefined;
    if (status === "REJECTED") {
      const promptedNotes = window.prompt("Reason for rejection?");
      if (!promptedNotes || promptedNotes.trim().length < 3) return;
      reviewNotes = promptedNotes.trim();
    } else {
      const confirmed = window.confirm(
        "Confirm: you inspected the actual signed evidence in the restricted legal store; verified this exact work revision, permitted media roles, languages, territories and term; and verified the recorded owner authorization and legal review. SHA-256 identifies the file only; it does not prove rights."
      );
      if (!confirmed) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/creator-rights-reviews", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: review.id, status,
          ...(reviewNotes ? { reviewNotes } : {}),
          ...(status === "APPROVED" ? {
            evidenceInspected: true, rightsScopeConfirmed: true,
            ownerApprovalConfirmed: true, legalApprovalConfirmed: true,
          } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to record rights decision.");
      setMessage(data.message ?? "Rights review decision recorded.");
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to record rights decision.");
    } finally { setBusy(false); }
  }

  const input = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white";
  const checkboxClass = "mt-1 h-4 w-4 accent-amber-500";
  return (
    <section className="page-shell pb-10">
      <div className="rounded-2xl border border-amber-400/20 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Restricted rights review</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Creator work/version rights evidence</h2>
        <p className="mt-2 text-sm text-gray-300">
          One record is bound to one immutable submission revision. Keep the signed instrument and owner/legal approvals in approved restricted stores; only opaque references and the exact SHA-256 are stored here. A hash identifies a file; it does not prove ownership or legal permission.
        </p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-200">{message}</p>}

        <form onSubmit={createReview} className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-300 sm:col-span-2">
            Exact approved work revision
            <select className={input + " mt-1"} required value={form.submissionRevisionId} onChange={event => setField("submissionRevisionId", event.target.value)}>
              <option value="">Select a revision</option>
              {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.creatorSubmission.creatorProfile.publicName} · {candidate.title} · v{candidate.revisionNumber} · {candidate.originalLanguage.toUpperCase()}</option>)}
            </select>
            {selectedCandidate && <span className="mt-1 block text-gray-500">Immutable revision ID: {selectedCandidate.id}</span>}
          </label>
          <label className="text-xs text-gray-300 sm:col-span-2">Rights holder / grantor
            <input className={input + " mt-1"} required minLength={3} maxLength={200} value={form.rightsHolder} onChange={event => setField("rightsHolder", event.target.value)} />
          </label>
          <label className="text-xs text-gray-300 sm:col-span-2">Restricted signed-evidence reference (not a URL)
            <input className={input + " mt-1"} required maxLength={300} value={form.evidenceReference} onChange={event => setField("evidenceReference", event.target.value)} placeholder="LegalVault/Record-ID" />
          </label>
          <label className="text-xs text-gray-300 sm:col-span-2">Exact signed-document SHA-256
            <input className={input + " mt-1 font-mono"} required minLength={64} maxLength={64} value={form.evidenceSha256} onChange={event => setField("evidenceSha256", event.target.value)} spellCheck={false} autoCapitalize="none" />
          </label>
          <label className="text-xs text-gray-300">Owner authorization reference
            <input className={input + " mt-1"} required maxLength={300} value={form.ownerApprovalReference} onChange={event => setField("ownerApprovalReference", event.target.value)} />
          </label>
          <label className="text-xs text-gray-300">Legal review reference
            <input className={input + " mt-1"} required maxLength={300} value={form.legalApprovalReference} onChange={event => setField("legalApprovalReference", event.target.value)} />
          </label>
          <label className="text-xs text-gray-300">Permitted territories (ISO alpha-2)
            <input className={input + " mt-1"} required value={form.allowedTerritories} onChange={event => setField("allowedTerritories", event.target.value)} placeholder="IN,SG" />
          </label>
          <label className="text-xs text-gray-300">Permitted languages (ISO 639)
            <input className={input + " mt-1"} required value={form.allowedLanguages} onChange={event => setField("allowedLanguages", event.target.value)} placeholder="ta,en" />
          </label>
          <label className="text-xs text-gray-300">Rights effective from (UTC date)
            <input className={input + " mt-1"} required type="date" value={form.startDate} onChange={event => setField("startDate", event.target.value)} />
          </label>
          <label className="text-xs text-gray-300">Last valid rights date (UTC; inclusive)
            <input className={input + " mt-1"} required type="date" value={form.expiryDate} onChange={event => setField("expiryDate", event.target.value)} />
          </label>
          <fieldset className="rounded-xl border border-white/10 p-3 sm:col-span-2">
            <legend className="px-1 text-xs text-gray-300">Permitted media roles (exact revision)</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {mediaRoles.map(role => <label key={role} className="flex items-center gap-2 text-xs text-gray-300">
                <input className={checkboxClass} type="checkbox" checked={form.permittedMediaRoles.includes(role)} onChange={() => toggleRole(role)} />
                {role.replaceAll("_", " ")}
              </label>)}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-white/10 p-3 sm:col-span-2">
            <legend className="px-1 text-xs text-gray-300">Required rights scope for upload eligibility</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["uploadAllowed", "Upload / digital copy"],
                ["hostingAllowed", "Private hosting / storage"],
                ["processingAllowed", "Encoding / transcoding / packaging"],
                ["ottVodStreamingAllowed", "OTT / VOD / CDN streaming"],
              ] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-xs text-gray-300">
                <input className={checkboxClass} type="checkbox" checked={form[key]} onChange={event => setField(key,event.target.checked)} />{label}
              </label>)}
            </div>
            <p className="mt-2 text-xs text-amber-200">All four scopes are required. Download rights are not registered or enabled in C3-I4.</p>
          </fieldset>
          <button disabled={busy || !candidates.length} className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving..." : "Save as pending human review"}</button>
        </form>

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white">Review history ({reviews.length})</h3>
          <div className="mt-3 space-y-3">
            {reviews.length === 0 ? <p className="text-sm text-gray-400">No rights-evidence review records.</p> : reviews.map(review => <article key={review.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-white">{review.submissionRevision.creatorSubmission.creatorProfile.publicName} · {review.submissionRevision.title} · v{review.submissionRevision.revisionNumber} · review {review.sequence}</h4>
                  <p className="mt-1 text-xs text-gray-400">Revision {review.submissionRevisionId} · {review.submissionRevision.originalLanguage.toUpperCase()}</p>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-amber-100">{review.status}</span>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-gray-300 sm:grid-cols-2">
                <p>Rights holder: {review.rightsHolder}</p><p>Submitted by: {review.submittedBy.email}</p>
                <p>Signed evidence ref: {review.evidenceReference}</p><p className="break-all font-mono">SHA-256: {review.evidenceSha256}</p>
                <p>Owner authorization ref: {review.ownerApprovalReference}</p><p>Legal review ref: {review.legalApprovalReference}</p>
                <p>Territories: {review.allowedTerritories.join(", ")}</p><p>Languages: {review.allowedLanguages.join(", ")}</p>
                <p>Media roles: {review.permittedMediaRoles.join(", ")}</p>
                <p>Term: {new Date(review.startDate).toLocaleDateString()} – {new Date(review.expiryDate).toLocaleDateString()}</p>
                <p>Upload / host / process / stream: {[review.uploadAllowed,review.hostingAllowed,review.processingAllowed,review.ottVodStreamingAllowed].every(Boolean) ? "All recorded" : "Incomplete"}</p>
                <p>Downloads: Disabled</p><p>Reviewer: {review.reviewedBy?.email ?? "Pending independent review"}</p>
                <p>Reviewed at: {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : "Pending"}</p>
                {review.reviewNotes && <p className="sm:col-span-2">Review note: {review.reviewNotes}</p>}
              </div>
              {review.status === "PENDING" && <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void decide(review,"APPROVED")} className="rounded-full bg-green-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve after independent review</button>
                <button type="button" disabled={busy} onClick={() => void decide(review,"REJECTED")} className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Reject</button>
              </div>}
            </article>)}
          </div>
        </div>
        <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
          Approval records a human attestation only. NexaFilm does not validate contract authenticity, chain of title or legal interpretation. No real work is cleared until genuine signed evidence and referenced owner/legal approvals have actually been inspected by the responsible reviewers.
        </p>
      </div>
    </section>
  );
}

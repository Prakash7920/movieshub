"use client";

import { useCallback, useEffect, useState } from "react";

type LicenceRecord = {
  id: string;
  owner: string;
  status: string;
  startDate: string;
  expiryDate: string;
  allowedCountries: string[];
  notes: string | null;
  evidenceReference: string | null;
  evidenceSha256: string | null;
  rightsScopeConfirmed: boolean;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
};

type MovieOption = {
  id: string;
  titleEn: string;
  isPublished: boolean;
  license: LicenceRecord | null;
};

type Form = {
  movieId: string;
  owner: string;
  startDate: string;
  expiryDate: string;
  countries: string;
  notes: string;
};

const empty: Form = {
  movieId: "",
  owner: "",
  startDate: "",
  expiryDate: "",
  countries: "IN",
  notes: "",
};

const sha256Pattern = /^[a-f0-9]{64}$/i;

export default function AdminLicenses() {
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [evidenceReferences, setEvidenceReferences] = useState<Record<string, string>>({});
  const [evidenceHashes, setEvidenceHashes] = useState<Record<string, string>>({});
  const [scopeChecks, setScopeChecks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/licenses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMovies(data.movies);
      if (!form.movieId && data.movies.length) {
        setForm(current => ({ ...current, movieId: data.movies[0].id }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load licences.");
    }
  }, [form.movieId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save licence.");
    } finally {
      setBusy(false);
    }
  }

  async function review(movie: MovieOption, status: "ACTIVE" | "REJECTED") {
    const evidenceReference = evidenceReferences[movie.id] ?? "";
    const evidenceSha256 = evidenceHashes[movie.id] ?? "";
    const rightsScopeConfirmed = scopeChecks[movie.id] === true;

    if (
      status === "ACTIVE" &&
      (
        evidenceReference.trim().length < 3 ||
        evidenceReference.trim().length > 300 ||
        /^https?:\/\//i.test(evidenceReference.trim()) ||
        !sha256Pattern.test(evidenceSha256.trim()) ||
        !rightsScopeConfirmed
      )
    ) {
      setError("Enter a controlled document reference, a valid 64-character SHA-256, and confirm the rights-scope review.");
      return;
    }

    const reason = status === "REJECTED"
      ? window.prompt("Reason for rejection?")
      : undefined;
    if (status === "REJECTED" && (!reason || reason.trim().length < 3)) {
      setError("Rejection cancelled or reason too short.");
      return;
    }

    const confirmationMessage = status === "ACTIVE"
      ? "Confirm that you opened and reviewed the actual signed document in controlled storage and verified its rights scope. The hash alone does not establish legal rights."
      : "Confirm rejection of this licence?";
    if (!window.confirm(confirmationMessage)) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: movie.id,
          status,
          confirmed: status === "ACTIVE",
          rightsScopeConfirmed,
          evidenceReference,
          evidenceSha256,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review licence.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white";
  const selected = movies.find(movie => movie.id === form.movieId);

  return (
    <section className="page-shell pb-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Rights & compliance</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Content licensing & verification</h2>
        <p className="mt-2 text-sm text-gray-400">
          New or edited licence records stay PENDING until the actual rights document is reviewed.
        </p>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-200">{message}</p>}

        {movies.length === 0 ? (
          <p className="mt-5 text-sm text-gray-400">Add a movie draft first.</p>
        ) : (
          <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-400 sm:col-span-2">
              Movie
              <select
                className={input + " mt-1"}
                value={form.movieId}
                onChange={event => setForm(current => ({ ...current, movieId: event.target.value }))}
              >
                {movies.map(movie => <option key={movie.id} value={movie.id}>{movie.titleEn}</option>)}
              </select>
            </label>

            <label className="text-xs text-gray-400 sm:col-span-2">
              Rights owner
              <input
                required
                maxLength={200}
                className={input + " mt-1"}
                value={form.owner}
                onChange={event => setForm(current => ({ ...current, owner: event.target.value }))}
              />
            </label>

            <label className="text-xs text-gray-400">
              Start date
              <input
                required
                type="date"
                className={input + " mt-1"}
                value={form.startDate}
                onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))}
              />
            </label>

            <label className="text-xs text-gray-400">
              Expiry date
              <input
                required
                type="date"
                className={input + " mt-1"}
                value={form.expiryDate}
                onChange={event => setForm(current => ({ ...current, expiryDate: event.target.value }))}
              />
            </label>

            <label className="text-xs text-gray-400 sm:col-span-2">
              Permitted countries (ISO codes)
              <input
                required
                className={input + " mt-1"}
                value={form.countries}
                onChange={event => setForm(current => ({ ...current, countries: event.target.value }))}
              />
            </label>

            <label className="text-xs text-gray-400 sm:col-span-2">
              Internal notes only (do not paste contract text, private URLs or personal data)
              <textarea
                className={input + " mt-1 min-h-20"}
                value={form.notes}
                onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
              />
            </label>

            <p className="text-xs text-gray-400 sm:col-span-2">
              Saving new or edited details resets any previous evidence approval and returns the licence to PENDING.
            </p>
            <button
              disabled={busy}
              className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              {busy ? "Saving..." : "Save as pending review"}
            </button>
          </form>
        )}

        <div className="mt-7">
          <h3 className="text-lg font-semibold text-white">Licence review queue</h3>
          <div className="mt-3 space-y-3">
            {movies.map(movie => (
              <article key={movie.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-white">{movie.titleEn}</p>
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
                    {movie.license?.status ?? "NO LICENCE"}
                  </span>
                </div>

                {movie.license && (
                  <>
                    <p className="mt-2 text-xs text-gray-400">
                      {movie.license.owner} · {movie.license.allowedCountries.join(", ")} ·{" "}
                      {new Date(movie.license.startDate).toLocaleDateString()} –{" "}
                      {new Date(movie.license.expiryDate).toLocaleDateString()}
                    </p>

                    {movie.license.status === "PENDING" && (
                      <div className="mt-3 space-y-3">
                        <label className="block text-xs text-gray-300">
                          Controlled signed-document reference
                          <input
                            className={input + " mt-1"}
                            value={evidenceReferences[movie.id] ?? ""}
                            onChange={event => setEvidenceReferences(current => ({ ...current, [movie.id]: event.target.value }))}
                            placeholder="Legal vault record ID (not a public URL)"
                            maxLength={300}
                          />
                        </label>

                        <label className="block text-xs text-gray-300">
                          Exact signed-document SHA-256
                          <input
                            className={input + " mt-1 font-mono"}
                            value={evidenceHashes[movie.id] ?? ""}
                            onChange={event => setEvidenceHashes(current => ({ ...current, [movie.id]: event.target.value }))}
                            placeholder="64 hexadecimal characters"
                            maxLength={64}
                            autoCapitalize="none"
                            spellCheck={false}
                          />
                        </label>

                        <label className="flex items-start gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={scopeChecks[movie.id] ?? false}
                            onChange={event => setScopeChecks(current => ({ ...current, [movie.id]: event.target.checked }))}
                          />
                          <span>
                            I opened and reviewed the actual signed document in controlled storage and confirmed that it covers the intended upload, hosting, copying, processing/transcoding, packaging, OTT/VOD streaming, platform/language, permitted territories, term and usage restrictions. Download permission remains disabled unless separately approved.
                          </span>
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void review(movie, "ACTIVE")}
                            className="rounded-full bg-green-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Approve verified licence
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void review(movie, "REJECTED")}
                            className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {movie.license.status === "ACTIVE" && (
                      <div className="mt-3 space-y-1 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-100">
                        <p>Reviewed by: {movie.license.reviewedByUserId ?? "Legacy / not recorded"}</p>
                        <p>Reviewed at: {movie.license.reviewedAt ? new Date(movie.license.reviewedAt).toLocaleString() : "Not recorded"}</p>
                        <p className="break-all">Evidence reference: {movie.license.evidenceReference ?? "Legacy / not recorded"}</p>
                        <p className="break-all font-mono">SHA-256: {movie.license.evidenceSha256 ?? "Legacy / not recorded"}</p>
                        <p>Rights-scope attestation: {movie.license.rightsScopeConfirmed ? "Recorded" : "Not recorded"}</p>
                        <p className="pt-1">Approval records a reviewer attestation; the hash does not independently prove ownership or legal permission. Downloads remain disabled.</p>
                      </div>
                    )}

                    {movie.license.status !== "ACTIVE" && movie.license.status !== "PENDING" && (
                      <p className="mt-3 text-xs text-amber-200">
                        Save fresh licence details to reopen review. Evidence approval is not carried forward.
                      </p>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
          Store the actual agreement only in your approved, access-controlled legal document system. NexaFilm stores its reference and hash, not the document. Approval does not enable playback or downloads.
        </p>
      </div>
    </section>
  );
}

"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";

export default function AssistantErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-shell pb-16 pt-8">
      <div
        className="rounded-[2rem] border border-red-500/30 bg-red-500/10 p-6 text-red-50"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold">Recommendation assistant unavailable</h2>
            <p className="mt-2 text-sm text-red-100/90">
              {error.message || "We couldn’t load your recommendations right now."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-200/40 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

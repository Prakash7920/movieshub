import { Loader2 } from "lucide-react";

export default function AssistantLoading() {
  return (
    <div className="page-shell pb-16 pt-8" aria-live="polite" aria-busy="true">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3 text-red-200">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-sm uppercase tracking-[0.2em]">Loading recommendations</span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

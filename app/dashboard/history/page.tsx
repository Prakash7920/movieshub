import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { mockWatchHistory } from "@/lib/mock-user";

export default function WatchHistoryPage() {
  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">History</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Watch History</h1>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <div className="space-y-4">
        {mockWatchHistory.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-card/70 p-4 md:flex-row md:items-center">
            <div className="relative h-28 w-20 overflow-hidden rounded-xl">
              <Image src={entry.posterUrl} alt={entry.title} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-white">{entry.title}</p>
              <p className="text-sm text-gray-400">Watched on {entry.lastWatchedAt}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${entry.progress}%` }} />
              </div>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20">
              <PlayCircle className="h-4 w-4" />
              Resume
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

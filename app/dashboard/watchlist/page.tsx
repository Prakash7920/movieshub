import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockWatchHistory, mockWatchlist } from "@/lib/mock-user";

export default function WatchlistPage() {
  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">Library</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Watchlist</h1>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mockWatchlist.map((entry) => (
          <div key={entry.id} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-card/70">
            <div className="relative h-72">
              <Image src={entry.posterUrl} alt={entry.title} fill className="object-cover" />
            </div>
            <div className="p-4">
              <p className="text-lg font-semibold text-white">{entry.title}</p>
              <p className="mt-2 text-sm text-gray-400">Added {entry.addedAt}</p>
              <div className="mt-4 flex gap-3">
                <Button className="flex-1 bg-red-600 hover:bg-red-500">Watch</Button>
                <Button variant="secondary" className="flex-1">Remove</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

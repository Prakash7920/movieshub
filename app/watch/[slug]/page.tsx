"use client";

import Link from "next/link";
import { useState } from "react";
import { PlayCircle, AlertCircle } from "lucide-react";
import { VideoPlayer } from "@/components/player/video-player";
import { mockMovies } from "@/lib/mock-data";

export default function WatchPage({ params }: { params: { slug: string } }) {
  const movie = mockMovies.find((entry) => entry.slug === params.slug) ?? mockMovies[0];
  const [isPremiumUser, setIsPremiumUser] = useState(false);

  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">Now watching</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{movie.titleEn}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <button type="button" onClick={() => setIsPremiumUser((value) => !value)} className="rounded-full border border-white/10 px-3 py-2 hover:border-white/20">
            {isPremiumUser ? "Premium mode on" : "Preview mode"}
          </button>
          <Link href={`/movies/${movie.slug}`} className="rounded-full border border-white/10 px-3 py-2 hover:border-white/20">
            Back to details
          </Link>
        </div>
      </div>

      <VideoPlayer
        title={movie.titleEn}
        src={movie.videoUrl}
        poster={movie.posterUrl}
        premiumOnly={movie.movieType === "PREMIUM"}
        isPremiumUser={isPremiumUser}
      />

      <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-card/70 p-5 text-sm text-gray-300">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-400" />
          <div>
            <p className="font-medium text-white">Secure playback note</p>
            <p className="mt-1">Production videos must use signed temporary URLs to prevent direct access to private media assets.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

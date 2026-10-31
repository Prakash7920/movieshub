"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Captions, Gauge, SkipForward } from "lucide-react";

type VideoPlayerProps = {
  title: string;
  src: string;
  poster?: string;
  premiumOnly?: boolean;
  isPremiumUser?: boolean;
};

export function VideoPlayer({
  title,
  src,
  poster,
  premiumOnly = false,
  isPremiumUser = false,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showCaption, setShowCaption] = useState(false);

  const overlayMessage = premiumOnly && !isPremiumUser ? "Premium access required. Upgrade to continue watching without ads." : "";

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
      <div className="relative">
        <video
          className="h-[420px] w-full object-cover md:h-[520px]"
          controls
          controlsList="nodownload"
          poster={poster}
          preload="metadata"
          aria-label={`${title} video player`}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {overlayMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center backdrop-blur-sm">
            <div className="max-w-md rounded-2xl border border-yellow-500/40 bg-black/50 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-yellow-300">Premium required</p>
              <h3 className="mt-3 text-2xl font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm text-gray-300">{overlayMessage}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white">Upgrade</button>
                <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Preview</button>
              </div>
              <p className="mt-4 text-xs text-gray-400">Production playback should use signed temporary URLs.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-gray-200">
        <button aria-label="Play" className="rounded-full bg-white/5 p-2 hover:bg-white/10" type="button" onClick={() => setIsPlaying((value) => !value)}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button aria-label="Skip forward" className="rounded-full bg-white/5 p-2 hover:bg-white/10" type="button">
          <SkipForward className="h-4 w-4" />
        </button>
        <button aria-label="Mute" className="rounded-full bg-white/5 p-2 hover:bg-white/10" type="button" onClick={() => setMuted((value) => !value)}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button aria-label="Toggle captions" className="rounded-full bg-white/5 p-2 hover:bg-white/10" type="button" onClick={() => setShowCaption((value) => !value)}>
          <Captions className="h-4 w-4" />
        </button>
        <select
          aria-label="Playback speed"
          className="rounded-full border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-white"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        >
          {[0.75, 1, 1.25, 1.5, 2].map((option) => (
            <option key={option} value={option}>{option}x</option>
          ))}
        </select>
        <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-gray-300">
          <Gauge className="h-3.5 w-3.5 text-red-400" />
          {showCaption ? "CC On" : "CC Off"}
        </div>
        <button aria-label="Fullscreen" className="rounded-full bg-white/5 p-2 hover:bg-white/10" type="button">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

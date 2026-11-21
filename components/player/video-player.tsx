"use client";

import React, { useEffect, useRef, useState } from "react";
import { parsePlaybackGrant, type PlaybackGrant } from "@/lib/media/playback-grant";

export type VideoPlayerProps = {
  title: string;
  slug: string;
  playbackEnabled: boolean;
};

type PlayerState = "disabled" | "loading" | "ready" | "error";

const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";
const GRANT_REFRESH_EARLY_MS = 30_000;

function PlaybackDisabled({ title }: { title: string }) {
  return (
    <section
      aria-label={`${title} playback`}
      className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black"
    >
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 bg-[#080808] px-6 py-12 text-center md:min-h-[480px]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <span aria-hidden="true" className="text-2xl text-gray-400">▶</span>
        </div>
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Playback disabled
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Secure streaming is not enabled. Playback requires separate approval and a valid server-authorized media grant.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-gray-400">
          Secure delivery pending
        </span>
      </div>
    </section>
  );
}

export function VideoPlayer({
  title,
  slug,
  playbackEnabled,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(
    playbackEnabled ? "loading" : "disabled",
  );

  useEffect(() => {
    if (!playbackEnabled) {
      setPlayerState("disabled");
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let hlsInstance: import("hls.js").default | null = null;
    let HlsConstructor: typeof import("hls.js").default | null = null;
    let nativeHls = false;
    let refreshTimer: number | null = null;

    async function requestPlaybackGrant(): Promise<PlaybackGrant> {
      const response = await fetch(
        `/api/media/${encodeURIComponent(slug)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error("Secure playback is currently unavailable.");
      }

      const grant = parsePlaybackGrant(await response.json());
      if (!grant) {
        throw new Error("The playback service returned an invalid or expired grant.");
      }

      return grant;
    }

    function scheduleGrantRefresh(grant: PlaybackGrant) {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      const expiresAt = Date.parse(grant.expiresAt);
      const refreshIn = Math.max(
        1_000,
        expiresAt - Date.now() - GRANT_REFRESH_EARLY_MS,
      );

      refreshTimer = window.setTimeout(() => {
        void refreshPlaybackGrant();
      }, refreshIn);
    }

    async function refreshPlaybackGrant() {
      try {
        const nextGrant = await requestPlaybackGrant();
        if (disposed) return;

        const video = videoRef.current;
        if (!video) return;

        const previousTime = video.currentTime;
        const shouldResume = !video.paused;

        if (nativeHls) {
          const restorePlayback = () => {
            if (disposed) return;
            if (Number.isFinite(previousTime) && previousTime > 0) {
              video.currentTime = previousTime;
            }
            if (shouldResume) {
              void video.play().catch(() => undefined);
            }
          };

          video.addEventListener("loadedmetadata", restorePlayback, { once: true });
          video.src = nextGrant.manifestUrl;
          video.load();
        } else if (hlsInstance && HlsConstructor) {
          hlsInstance.once(HlsConstructor.Events.MANIFEST_PARSED, () => {
            if (disposed) return;
            if (Number.isFinite(previousTime) && previousTime > 0) {
              video.currentTime = previousTime;
            }
            if (shouldResume) {
              void video.play().catch(() => undefined);
            }
          });
          hlsInstance.loadSource(nextGrant.manifestUrl);
        } else {
          return;
        }

        scheduleGrantRefresh(nextGrant);
      } catch {
        if (controller.signal.aborted || disposed) return;
        if (refreshTimer !== null) {
          window.clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        setPlayerState("error");
      }
    }

    async function preparePlayback() {
      const video = videoRef.current;
      if (!video) return;

      setPlayerState("loading");

      try {
        const grant = await requestPlaybackGrant();
        if (disposed) return;

        // Prefer native HLS where Managed Media Source is available.
        if (
          video.canPlayType(HLS_MIME_TYPE) &&
          "ManagedMediaSource" in window
        ) {
          nativeHls = true;
          video.src = grant.manifestUrl;
          scheduleGrantRefresh(grant);
          setPlayerState("ready");
          return;
        }

        const Hls = (await import("hls.js")).default;
        if (disposed) return;

        if (Hls.isSupported()) {
          HlsConstructor = Hls;
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
          });

          hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !disposed) {
              if (refreshTimer !== null) {
                window.clearTimeout(refreshTimer);
                refreshTimer = null;
              }
              setPlayerState("error");
              hlsInstance?.destroy();
              hlsInstance = null;
            }
          });

          hlsInstance.loadSource(grant.manifestUrl);
          hlsInstance.attachMedia(video);
          scheduleGrantRefresh(grant);
          setPlayerState("ready");
          return;
        }

        // Last-resort native fallback for browsers exposing HLS but not MSE.
        if (video.canPlayType(HLS_MIME_TYPE)) {
          nativeHls = true;
          video.src = grant.manifestUrl;
          scheduleGrantRefresh(grant);
          setPlayerState("ready");
          return;
        }

        throw new Error("This browser does not support secure HLS playback.");
      } catch {
        if (controller.signal.aborted || disposed) return;
        setPlayerState("error");
      }
    }

    void preparePlayback();

    return () => {
      disposed = true;
      controller.abort();

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      hlsInstance?.destroy();
      hlsInstance = null;

      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [playbackEnabled, slug]);

  if (!playbackEnabled) {
    return <PlaybackDisabled title={title} />;
  }

  return (
    <section
      aria-label={`${title} playback`}
      className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black"
    >
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        className="aspect-video w-full bg-black"
        aria-label={`${title} video player`}
        onError={() => setPlayerState("error")}
      />
      <div className="border-t border-white/10 px-4 py-3 text-sm text-gray-400" aria-live="polite">
        {playerState === "loading" && "Preparing secure stream…"}
        {playerState === "ready" && "Secure stream ready. Press play when you are ready."}
        {playerState === "error" && "Secure playback could not be started. Please try again later."}
      </div>
    </section>
  );
}

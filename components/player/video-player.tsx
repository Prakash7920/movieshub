"use client";

export type VideoPlayerProps = {
  title: string;
};

/**
 * Fail-closed player shell.
 *
 * Deliberately has no src/playbackUrl prop and renders no <video>/<source>.
 * A provider-backed signed playback grant must be implemented and reviewed
 * before this component can render playable media.
 */
export function VideoPlayer({ title }: VideoPlayerProps) {
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
            Secure streaming is not configured yet. Playback will remain unavailable until a server-authorized, short-lived media grant is ready.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-gray-400">
          Secure delivery pending
        </span>
      </div>
    </section>
  );
}

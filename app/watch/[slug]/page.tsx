import Link from "next/link";
import { VideoPlayer } from "@/components/player/video-player";
import { getCloudflareStreamConfigFromEnv } from "@/lib/media/cloudflare-stream";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const playbackEnabled = getCloudflareStreamConfigFromEnv() !== null;

  return (
    <div className="page-shell mx-auto w-full max-w-6xl py-10 md:py-16">
      <div className="mb-6 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
          NexaFilm playback
        </p>
        <h1 className="text-3xl font-bold text-white md:text-5xl">
          {title || "Secure playback"}
        </h1>
        <p className="max-w-3xl text-gray-300">
          Playback remains disabled unless both the Stream integration and separate playback approval gates are enabled with valid server-side credentials. No sample or unlicensed video is used.
        </p>
      </div>

      <VideoPlayer
        title={title || "Secure playback"}
        slug={slug}
        playbackEnabled={playbackEnabled}
      />

      <Link
        href="/movies"
        className="mt-8 inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
      >
        Browse licensed catalogue
      </Link>
    </div>
  );
}

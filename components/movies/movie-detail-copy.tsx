"use client";

import { useLanguage } from "@/components/providers/language-provider";

type MovieDetailCopyPart = "back" | "eyebrow" | "languages" | "playback" | "genre";

export function MovieDetailCopy({
  part,
  value,
  audioLanguages,
  subtitleLanguages,
}: {
  part: MovieDetailCopyPart;
  value?: string;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
}) {
  const { t } = useLanguage();

  switch (part) {
    case "back":
      return <>{t.backToMovies}</>;
    case "eyebrow":
      return <>{t.catalogueMetadata}</>;
    case "languages":
      return <>{t.audioLabel}: {audioLanguages?.join(", ") ?? ""} · {t.subtitlesLabel}: {subtitleLanguages?.join(", ") ?? ""}</>;
    case "playback":
      return <>{t.playbackDisabledNotice}</>;
    case "genre":
      return <>{value || t.uncategorised}</>;
  }
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Star, Globe, MessageSquare, Share2, Plus, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockMovies } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockMovies.map((movie) => ({ slug: movie.slug }));
}

export default function MovieDetailsPage({ params }: { params: { slug: string } }) {
  const movie = mockMovies.find((entry) => entry.slug === params.slug);

  if (!movie) {
    notFound();
  }

  const similar = mockMovies.filter((entry) => entry.genre === movie.genre && entry.slug !== movie.slug).slice(0, 4);

  return (
    <div className="page-shell pb-16 pt-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black">
        <div className="absolute inset-0">
          <Image src={movie.backdropUrl} alt={movie.titleEn} fill className="object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/50" />
        </div>

        <div className="relative grid gap-8 px-5 py-8 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div className="relative h-[420px] overflow-hidden rounded-[1.5rem] border border-white/10">
            <Image src={movie.posterUrl} alt={movie.titleEn} fill className="object-cover" />
          </div>
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-red-200">
              {movie.movieType}
            </div>
            <h1 className="text-4xl font-black text-white md:text-5xl">{movie.titleEn}</h1>
            <p className="mt-2 text-xl text-gray-200">{movie.titleTa}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-gray-200">
              <span>{movie.genre}</span>
              <span>•</span>
              <span>{movie.releaseYear}</span>
              <span>•</span>
              <span>{movie.runtimeMinutes} min</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {movie.rating}
              </span>
            </div>
            <p className="mt-5 max-w-2xl text-base text-gray-300">{movie.descriptionEn}</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="bg-red-600 hover:bg-red-500">
                <PlayCircle className="mr-2 h-5 w-5" />
                Watch Now
              </Button>
              <Button size="lg" variant="secondary">
                <Plus className="mr-2 h-5 w-5" />
                Add to Watchlist
              </Button>
              <Button size="lg" variant="outline">
                <Share2 className="mr-2 h-5 w-5" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-white">Overview</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Genre" value={movie.genre} />
              <InfoRow label="Language" value={movie.language === "ta" ? "Tamil" : "Dubbed"} />
              <InfoRow label="Audio" value={movie.audioLanguages.join(", ")} />
              <InfoRow label="Subtitles" value={movie.subtitleLanguages.join(", ")} />
              <InfoRow label="Age Rating" value={movie.ageRating} />
              <InfoRow label="Free / Premium" value={movie.movieType} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-white">Trailer</h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                className="h-[320px] w-full object-cover"
                controls
                preload="metadata"
                poster={movie.posterUrl}
              >
                <source src={movie.trailerUrl} type="video/mp4" />
              </video>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-white">Cast & Crew</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {movie.cast.map((person) => (
                <div key={person.name} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="font-medium text-white">{person.name}</p>
                  <p className="text-sm text-gray-400">{person.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">Movie Info</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-red-400" /> Runtime: {movie.runtimeMinutes} min</li>
              <li className="flex items-center gap-2"><Globe className="h-4 w-4 text-red-400" /> Countries: {movie.allowedCountries.join(", ")}</li>
              <li className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-red-400" /> License: {movie.licenseOwner}</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">Similar Movies</h3>
            <div className="space-y-4">
              {similar.map((entry) => (
                <Link key={entry.id} href={`/movies/${entry.slug}`} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-2 transition hover:border-red-500/50">
                  <div className="relative h-20 w-16 overflow-hidden rounded-lg">
                    <Image src={entry.posterUrl} alt={entry.titleEn} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{entry.titleEn}</p>
                    <p className="text-xs text-gray-400">{entry.genre}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-yellow-300">
                      <Star className="h-3 w-3 fill-current" />
                      {entry.rating}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-base text-white">{value}</p>
    </div>
  );
}

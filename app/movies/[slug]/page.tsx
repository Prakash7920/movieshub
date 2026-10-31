import Link from "next/link";
import Image from "next/image";
import { PlayCircle, Star, Clock3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockMovies, type Movie } from "@/lib/mock-data";
import { useLanguage } from "@/components/providers/language-provider";

const featuredMovie = mockMovies[0];

function MovieSection({ title, movies }: { title: string; movies: Movie[] }) {
  return (
    <section className="mb-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="section-title">{title}</h2>
        <Link href="/movies" className="inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {movies.map((movie) => (
          <Link key={movie.id} href={`/movies/${movie.slug}`} className="group block overflow-hidden rounded-2xl border border-white/10 bg-card/80 transition hover:-translate-y-1 hover:border-red-500/50">
            <div className="relative h-72 overflow-hidden">
              <Image src={movie.posterUrl} alt={movie.titleEn} fill className="object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full border border-red-500/60 bg-red-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">
                {movie.movieType}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="line-clamp-1 text-lg font-semibold text-white">{movie.titleEn}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-300">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {movie.rating}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-gray-400">{movie.descriptionEn}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{movie.releaseYear}</span>
                <span>{movie.runtimeMinutes} min</span>
                <span>{movie.language === "ta" ? "Tamil" : "Dubbed"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="page-shell pb-16 pt-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111]">
        <div className="absolute inset-0">
          <Image src={featuredMovie.backdropUrl} alt={featuredMovie.titleEn} fill className="object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />
        </div>

        <div className="relative grid gap-10 px-5 py-8 md:px-10 md:py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-200">
              <Star className="h-3.5 w-3.5 fill-current" />
              Featured Cinema
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white md:text-6xl">
              {featuredMovie.titleEn}
            </h1>
            <p className="mt-4 max-w-xl text-base text-gray-200 md:text-lg">{featuredMovie.descriptionEn}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-gray-200">
              <span>{featuredMovie.genre}</span>
              <span>•</span>
              <span>{featuredMovie.releaseYear}</span>
              <span>•</span>
              <span>{featuredMovie.runtimeMinutes} min</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {featuredMovie.rating}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="bg-red-600 hover:bg-red-500">
                <PlayCircle className="mr-2 h-5 w-5" />
                {t.watchNow}
              </Button>
              <Button size="lg" variant="secondary">
                {t.viewDetails}
              </Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
            <div className="relative h-80 overflow-hidden rounded-[1.25rem]">
              <Image src={featuredMovie.posterUrl} alt={featuredMovie.titleEn} fill className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-12 space-y-10">
        <MovieSection title={t.continueWatching} movies={mockMovies.slice(0, 4)} />
        <MovieSection title={t.trending} movies={mockMovies.slice(1, 5)} />
        <MovieSection title={t.newReleases} movies={mockMovies.slice(2, 6)} />
        <MovieSection title={t.tamilMovies} movies={mockMovies.filter((movie) => movie.language === "ta").slice(0, 4)} />
        <MovieSection title={t.dubbedMovies} movies={mockMovies.filter((movie) => movie.language !== "ta").slice(0, 4)} />
        <MovieSection title={t.recommended} movies={mockMovies.slice(3, 7)} />
      </div>

      <section className="mt-12 rounded-[2rem] border border-red-500/20 bg-gradient-to-r from-red-950/70 to-black p-8 md:p-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.22em] text-red-200">MoviesHub Premium</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Watch unlimited blockbusters without ads.</h2>
          </div>
          <Button size="lg" className="bg-white text-red-600 hover:bg-red-50">Upgrade to Premium</Button>
        </div>
      </section>
    </div>
  );
}

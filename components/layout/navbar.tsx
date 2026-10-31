import Image from "next/image";
import Link from "next/link";
import { BrainCircuit, PlayCircle, Sparkles, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecommendationAssistantData } from "@/lib/recommendation-engine";

export default async function RecommendationAssistantPage() {
  const data = await getRecommendationAssistantData();

  return (
    <div className="page-shell pb-16 pt-8">
      <section className="rounded-[2rem] border border-red-500/20 bg-gradient-to-br from-red-950/60 via-slate-950 to-slate-900 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-red-200">AI assistant</p>
            <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">MoviesHub recommendation engine</h1>
            <p className="mt-4 text-base text-gray-300">
              Personalized picks generated from your watch history, language preferences, subscription plan, and the local MoviesHub catalog.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            <BrainCircuit className="h-4 w-4" />
            Personalized for {data.userName}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetaCard label="Watch history" value={`${data.watchCount} titles`} icon={<TrendingUp className="h-4 w-4" />} />
        <MetaCard label="Language preference" value={data.preferredLanguage === "ta" ? "Tamil" : "English"} icon={<Sparkles className="h-4 w-4" />} />
        <MetaCard label="Plan" value={data.subscription === "PREMIUM" ? "Premium" : "Free"} icon={<Star className="h-4 w-4" />} />
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Recommended for you</h2>
            <span className="text-sm text-gray-400">Based on local DB signals</span>
          </div>

          {data.recommendations.map((movie) => (
            <article key={movie.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-card/70 p-4 md:flex-row md:items-center">
              <div className="relative h-28 w-20 overflow-hidden rounded-xl border border-white/10">
                <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white">{movie.title}</h3>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-200">
                    {movie.movieType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-400">{movie.titleTa}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-300">
                  <span>⭐ {movie.rating}</span>
                  <span>{movie.genre}</span>
                  <span>{movie.releaseYear}</span>
                </div>
                <p className="mt-3 text-sm text-gray-300">{movie.reason}</p>
              </div>

              <div className="flex items-center gap-2 md:flex-col">
                <div className="text-right text-sm text-red-100">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Match</div>
                  <div className="text-lg font-bold text-red-300">{Math.round(movie.score)}</div>
                </div>
                <Link href={`/movies/${movie.slug}`}>
                  <Button variant="secondary" size="sm">
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Watch
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-5">
            <h3 className="text-lg font-semibold text-white">Top signals</h3>
            <div className="mt-4 space-y-3">
              {data.signals.length ? (
                data.signals.map((signal) => (
                  <div key={signal.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between text-sm text-gray-300">
                      <span>{signal.name}</span>
                      <span className="text-red-200">{signal.count}x</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min((signal.count / Math.max(data.signals[0].count, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No explicit watch signals yet. The engine is using broad catalog popularity.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-5">
            <h3 className="text-lg font-semibold text-white">AI insight</h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              <li>• Best genre affinity is derived from local watch history and movie metadata.</li>
              <li>• Language preference is pulled from the user profile table.</li>
              <li>• Subscription status influences free-vs-premium recommendation bias.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetaCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-5">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="text-red-300">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
























































































































































































































































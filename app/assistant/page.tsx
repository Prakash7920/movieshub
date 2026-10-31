import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type RecommendationSignal = {
  name: string;
  count: number;
};

export type RecommendationMovie = {
  id: string;
  slug: string;
  title: string;
  titleTa: string;
  posterUrl: string;
  backdropUrl: string;
  rating: number;
  score: number;
  reason: string;
  movieType: string;
  genre: string;
  releaseYear: number;
};

export async function getRecommendationAssistantData(userEmail = "premium@movieshub.local") {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      profiles: true,
      subscriptions: {
        orderBy: { startDate: "desc" },
        take: 1,
      },
      watchHistory: {
        orderBy: { lastWatchedAt: "desc" },
        take: 10,
        include: {
          movie: {
            include: {
              genres: {
                include: {
                  genre: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const preferredLanguage = user?.profiles[0]?.languagePreference ?? "ta";
  const activeSubscription = user?.subscriptions[0]?.plan ?? "FREE";
  const watchedHistory = user?.watchHistory ?? [];

  const genreCounts = new Map<string, number>();

  for (const item of watchedHistory) {
    for (const movieGenre of item.movie.genres) {
      const currentCount = genreCounts.get(movieGenre.genre.name) ?? 0;
      genreCounts.set(movieGenre.genre.name, currentCount + 1);
    }
  }

  const topSignals: RecommendationSignal[] = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const watchedIds = new Set(watchedHistory.map((item) => item.movieId));

  const candidateMovies = await prisma.movie.findMany({
    where: {
      isPublished: true,
    },
    include: {
      genres: {
        include: {
          genre: true,
        },
      },
    },
    orderBy: {
      rating: "desc",
    },
  });

  const recommendations = candidateMovies
    .filter((movie) => !watchedIds.has(movie.id))
    .map((movie) => {
      const genreNames = movie.genres.map((entry) => entry.genre.name);
      const matchedGenres = genreNames.filter((genreName) => genreCounts.has(genreName));
      const languageBonus = movie.language === preferredLanguage ? 10 : 0;
      const premiumBias = activeSubscription === "PREMIUM" && movie.movieType === "PREMIUM" ? 8 : 0;
      const freeBias = activeSubscription !== "PREMIUM" && movie.movieType === "FREE" ? 6 : 0;
      const genreBoost = matchedGenres.length * 12;
      const popularityBoost = Math.min(movie.watchCount / 10000, 12);
      const score = movie.rating * 10 + genreBoost + languageBonus + premiumBias + freeBias + popularityBoost + (movie.isFeatured ? 5 : 0);

      const reason = matchedGenres.length
        ? `Your recent picks lean toward ${matchedGenres[0]} stories, and this title matches that mood.`
        : `Recent preference for ${preferredLanguage === "ta" ? "Tamil" : "English"} cinema makes this a strong match.`;

      return {
        id: movie.id,
        slug: movie.slug,
        title: movie.titleEn,
        titleTa: movie.titleTa,
        posterUrl: movie.posterUrl,
        backdropUrl: movie.backdropUrl,
        rating: movie.rating,
        score,
        reason,
        movieType: movie.movieType,
        genre: genreNames[0] ?? "Drama",
        releaseYear: movie.releaseYear,
      } satisfies RecommendationMovie;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    userName: user?.name ?? "Tamil Viewer",
    preferredLanguage,
    subscription: activeSubscription,
    watchCount: watchedHistory.length,
    recommendations,
    signals: topSignals,
  };
}

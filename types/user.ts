export type MovieListItem = {
  id: string;
  slug: string;
  titleEn: string;
  titleTa: string;
  posterUrl: string;
  rating: number;
  movieType: "FREE" | "PREMIUM";
  genre: string;
  language: "ta" | "en";
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  languagePreference: "en" | "ta";
  subscriptionStatus: "Free" | "Premium";
};

export type WatchlistEntry = {
  id: string;
  movieId: string;
  title: string;
  posterUrl: string;
  addedAt: string;
};

export type WatchHistoryEntry = {
  id: string;
  movieId: string;
  title: string;
  posterUrl: string;
  progress: number;
  lastWatchedAt: string;
};

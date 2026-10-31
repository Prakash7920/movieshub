import { z } from "zod";

export const watchlistSchema = z.object({
  movieId: z.string().min(1, "Movie ID is required."),
});

export const watchHistorySchema = z.object({
  movieId: z.string().min(1, "Movie ID is required."),
  progress: z.number().min(0).max(100),
});

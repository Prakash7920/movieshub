import { z } from "zod";

export const watchlistSchema = z.object({
  movieId: z.string().min(1, "Movie ID is required."),
});

export const watchHistorySchema = z.object({
  movieId: z.string().min(1, "Movie ID is required."),
  progress: z.number().min(0).max(100),
});

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters.").max(80, "Display name must be 80 characters or fewer."),
  languagePreference: z.enum(["en", "ta"], {
    errorMap: () => ({ message: "Choose English or Tamil." }),
  }),
}).strict();

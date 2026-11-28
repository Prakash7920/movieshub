ALTER TABLE "Movie"
  ADD COLUMN "cloudflareStreamUid" TEXT;

CREATE UNIQUE INDEX "Movie_cloudflareStreamUid_key"
  ON "Movie"("cloudflareStreamUid");

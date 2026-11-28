CREATE TYPE "CreatorProfileStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED'
);

CREATE TYPE "CreatorSubmissionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'NEEDS_CHANGES',
  'REJECTED',
  'APPROVED_FOR_CATALOGUE'
);

CREATE TYPE "CreatorContentType" AS ENUM (
  'SHORT_FILM',
  'EPISODE'
);

CREATE TABLE "CreatorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "publicName" VARCHAR(80) NOT NULL,
  "bio" VARCHAR(500),
  "status" "CreatorProfileStatus" NOT NULL DEFAULT 'PENDING',
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewNotes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorSubmission" (
  "id" TEXT NOT NULL,
  "creatorProfileId" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "synopsis" VARCHAR(3000) NOT NULL,
  "originalLanguage" VARCHAR(3) NOT NULL,
  "runtimeMinutes" INTEGER NOT NULL,
  "releaseYear" INTEGER NOT NULL,
  "contentType" "CreatorContentType" NOT NULL,
  "status" "CreatorSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewNotes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");
CREATE INDEX "CreatorProfile_status_appliedAt_idx" ON "CreatorProfile"("status", "appliedAt");
CREATE INDEX "CreatorProfile_reviewedByUserId_idx" ON "CreatorProfile"("reviewedByUserId");

CREATE INDEX "CreatorSubmission_creatorProfileId_status_updatedAt_idx"
  ON "CreatorSubmission"("creatorProfileId", "status", "updatedAt");
CREATE INDEX "CreatorSubmission_status_submittedAt_idx"
  ON "CreatorSubmission"("status", "submittedAt");
CREATE INDEX "CreatorSubmission_reviewedByUserId_idx"
  ON "CreatorSubmission"("reviewedByUserId");

ALTER TABLE "CreatorProfile"
  ADD CONSTRAINT "CreatorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreatorProfile"
  ADD CONSTRAINT "CreatorProfile_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreatorSubmission"
  ADD CONSTRAINT "CreatorSubmission_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreatorSubmission"
  ADD CONSTRAINT "CreatorSubmission_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

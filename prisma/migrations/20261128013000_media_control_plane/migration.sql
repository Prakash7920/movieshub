CREATE TYPE "CreatorSubmissionRevisionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'NEEDS_CHANGES',
  'REJECTED',
  'APPROVED_FOR_CATALOGUE',
  'SUPERSEDED',
  'WITHDRAWN'
);

CREATE TYPE "CreatorMediaRole" AS ENUM (
  'PRIMARY_VIDEO',
  'TRAILER',
  'POSTER',
  'BACKDROP',
  'CAPTION',
  'SUBTITLE'
);

CREATE TYPE "UploadIntentStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'COMPLETED',
  'CONSUMED',
  'EXPIRED',
  'CANCELLED',
  'FAILED'
);

CREATE TYPE "MediaAssetVersionStatus" AS ENUM (
  'QUARANTINED',
  'PROCESSING',
  'TECHNICAL_REVIEW',
  'READY_FOR_REVIEW',
  'REJECTED',
  'TAKEDOWN_PENDING',
  'REMOVED',
  'FAILED'
);

CREATE TABLE "CreatorSubmissionRevision" (
  "id" TEXT NOT NULL,
  "creatorSubmissionId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "synopsis" VARCHAR(3000) NOT NULL,
  "originalLanguage" VARCHAR(3) NOT NULL,
  "runtimeMinutes" INTEGER NOT NULL,
  "releaseYear" INTEGER NOT NULL,
  "contentType" "CreatorContentType" NOT NULL,
  "status" "CreatorSubmissionRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewNotes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorSubmissionRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreatorSubmissionRevision_revisionNumber_check" CHECK ("revisionNumber" > 0),
  CONSTRAINT "CreatorSubmissionRevision_runtimeMinutes_check" CHECK ("runtimeMinutes" BETWEEN 1 AND 1000)
);

CREATE TABLE "UploadIntent" (
  "id" TEXT NOT NULL,
  "submissionRevisionId" TEXT NOT NULL,
  "mediaRole" "CreatorMediaRole" NOT NULL,
  "status" "UploadIntentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "maxFileSizeBytes" BIGINT NOT NULL,
  "allowedMimeTypes" TEXT[] NOT NULL,
  "maxDurationSeconds" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "authorizedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadIntent_idempotencyKey_check" CHECK (length(btrim("idempotencyKey")) > 0),
  CONSTRAINT "UploadIntent_maxFileSizeBytes_check" CHECK ("maxFileSizeBytes" > 0),
  CONSTRAINT "UploadIntent_allowedMimeTypes_check" CHECK (cardinality("allowedMimeTypes") > 0),
  CONSTRAINT "UploadIntent_maxDurationSeconds_check" CHECK ("maxDurationSeconds" IS NULL OR "maxDurationSeconds" > 0),
  CONSTRAINT "UploadIntent_expiresAt_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "UploadIntent_authorizedAt_check" CHECK ("status" NOT IN ('AUTHORIZED', 'COMPLETED', 'CONSUMED') OR "authorizedAt" IS NOT NULL),
  CONSTRAINT "UploadIntent_completedAt_check" CHECK ("status" NOT IN ('COMPLETED', 'CONSUMED') OR "completedAt" IS NOT NULL),
  CONSTRAINT "UploadIntent_consumedAt_check" CHECK ("status" <> 'CONSUMED' OR "consumedAt" IS NOT NULL)
);

CREATE TABLE "MediaAssetVersion" (
  "id" TEXT NOT NULL,
  "submissionRevisionId" TEXT NOT NULL,
  "uploadIntentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "MediaAssetVersionStatus" NOT NULL DEFAULT 'QUARANTINED',
  "sourceSha256" CHAR(64) NOT NULL,
  "fileSizeBytes" BIGINT NOT NULL,
  "detectedMimeType" VARCHAR(127) NOT NULL,
  "durationSeconds" INTEGER,
  "widthPixels" INTEGER,
  "heightPixels" INTEGER,
  "storageProvider" VARCHAR(64),
  "storageAssetRef" VARCHAR(512),
  "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAssetVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAssetVersion_versionNumber_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "MediaAssetVersion_sourceSha256_check" CHECK ("sourceSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "MediaAssetVersion_fileSizeBytes_check" CHECK ("fileSizeBytes" > 0),
  CONSTRAINT "MediaAssetVersion_durationSeconds_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0),
  CONSTRAINT "MediaAssetVersion_widthPixels_check" CHECK ("widthPixels" IS NULL OR "widthPixels" > 0),
  CONSTRAINT "MediaAssetVersion_heightPixels_check" CHECK ("heightPixels" IS NULL OR "heightPixels" > 0),
  CONSTRAINT "MediaAssetVersion_storageReference_pair_check" CHECK (("storageProvider" IS NULL) = ("storageAssetRef" IS NULL)),
  CONSTRAINT "MediaAssetVersion_storageReference_not_url_check" CHECK ("storageAssetRef" IS NULL OR ("storageAssetRef" !~* '^https?://' AND length(btrim("storageAssetRef")) > 0)),
  CONSTRAINT "MediaAssetVersion_validatedAt_check" CHECK ("status" NOT IN ('TECHNICAL_REVIEW', 'READY_FOR_REVIEW') OR "validatedAt" IS NOT NULL),
  CONSTRAINT "MediaAssetVersion_removedAt_check" CHECK ("status" <> 'REMOVED' OR "removedAt" IS NOT NULL)
);

CREATE UNIQUE INDEX "CreatorSubmissionRevision_creatorSubmissionId_revisionNumber_key"
  ON "CreatorSubmissionRevision"("creatorSubmissionId", "revisionNumber");
CREATE INDEX "CreatorSubmissionRevision_status_submittedAt_idx"
  ON "CreatorSubmissionRevision"("status", "submittedAt");
CREATE INDEX "CreatorSubmissionRevision_reviewedByUserId_idx"
  ON "CreatorSubmissionRevision"("reviewedByUserId");

CREATE UNIQUE INDEX "UploadIntent_submissionRevisionId_idempotencyKey_key"
  ON "UploadIntent"("submissionRevisionId", "idempotencyKey");
CREATE UNIQUE INDEX "UploadIntent_id_submissionRevisionId_key"
  ON "UploadIntent"("id", "submissionRevisionId");
CREATE INDEX "UploadIntent_submissionRevisionId_status_expiresAt_idx"
  ON "UploadIntent"("submissionRevisionId", "status", "expiresAt");
CREATE INDEX "UploadIntent_status_expiresAt_idx"
  ON "UploadIntent"("status", "expiresAt");

CREATE UNIQUE INDEX "MediaAssetVersion_uploadIntentId_key"
  ON "MediaAssetVersion"("uploadIntentId");
CREATE UNIQUE INDEX "MediaAssetVersion_uploadIntentId_submissionRevisionId_key"
  ON "MediaAssetVersion"("uploadIntentId", "submissionRevisionId");
CREATE UNIQUE INDEX "MediaAssetVersion_submissionRevisionId_versionNumber_key"
  ON "MediaAssetVersion"("submissionRevisionId", "versionNumber");
CREATE INDEX "MediaAssetVersion_submissionRevisionId_status_createdAt_idx"
  ON "MediaAssetVersion"("submissionRevisionId", "status", "createdAt");
CREATE INDEX "MediaAssetVersion_status_createdAt_idx"
  ON "MediaAssetVersion"("status", "createdAt");

ALTER TABLE "CreatorSubmissionRevision"
  ADD CONSTRAINT "CreatorSubmissionRevision_creatorSubmissionId_fkey"
  FOREIGN KEY ("creatorSubmissionId") REFERENCES "CreatorSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorSubmissionRevision"
  ADD CONSTRAINT "CreatorSubmissionRevision_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UploadIntent"
  ADD CONSTRAINT "UploadIntent_submissionRevisionId_fkey"
  FOREIGN KEY ("submissionRevisionId") REFERENCES "CreatorSubmissionRevision"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAssetVersion"
  ADD CONSTRAINT "MediaAssetVersion_submissionRevisionId_fkey"
  FOREIGN KEY ("submissionRevisionId") REFERENCES "CreatorSubmissionRevision"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetVersion"
  ADD CONSTRAINT "MediaAssetVersion_uploadIntentId_submissionRevisionId_fkey"
  FOREIGN KEY ("uploadIntentId", "submissionRevisionId")
  REFERENCES "UploadIntent"("id", "submissionRevisionId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Submission metadata snapshots cannot be rewritten after creation. Review state
-- and reviewer fields remain mutable; a correction creates a new revision.
CREATE FUNCTION "prevent_creator_submission_revision_snapshot_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    NEW."creatorSubmissionId",
    NEW."revisionNumber",
    NEW."title",
    NEW."synopsis",
    NEW."originalLanguage",
    NEW."runtimeMinutes",
    NEW."releaseYear",
    NEW."contentType",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."creatorSubmissionId",
    OLD."revisionNumber",
    OLD."title",
    OLD."synopsis",
    OLD."originalLanguage",
    OLD."runtimeMinutes",
    OLD."releaseYear",
    OLD."contentType",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Creator submission revision snapshots are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreatorSubmissionRevision_snapshot_immutable"
  BEFORE UPDATE OF
    "creatorSubmissionId",
    "revisionNumber",
    "title",
    "synopsis",
    "originalLanguage",
    "runtimeMinutes",
    "releaseYear",
    "contentType",
    "createdAt"
  ON "CreatorSubmissionRevision"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_creator_submission_revision_snapshot_mutation"();

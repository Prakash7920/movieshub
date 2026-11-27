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


-- Submission revision review-state transitions are forward-only. A material
-- correction creates a new revision rather than reopening an approved snapshot.
CREATE FUNCTION "guard_creator_submission_revision_status_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('SUBMITTED', 'WITHDRAWN'))
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('NEEDS_CHANGES', 'REJECTED', 'APPROVED_FOR_CATALOGUE', 'WITHDRAWN'))
    OR (OLD."status" = 'NEEDS_CHANGES' AND NEW."status" IN ('SUBMITTED', 'WITHDRAWN'))
    OR (OLD."status" = 'APPROVED_FOR_CATALOGUE' AND NEW."status" = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'Invalid creator submission revision status transition: % -> %', OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreatorSubmissionRevision_status_transition_guard"
  BEFORE UPDATE OF "status" ON "CreatorSubmissionRevision"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_creator_submission_revision_status_transition"();

-- Upload capabilities follow a one-way intent lifecycle; consumed/expired/
-- cancelled/failed intents cannot be re-authorized.
CREATE FUNCTION "guard_upload_intent_status_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('AUTHORIZED', 'EXPIRED', 'CANCELLED', 'FAILED'))
    OR (OLD."status" = 'AUTHORIZED' AND NEW."status" IN ('COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED'))
    OR (OLD."status" = 'COMPLETED' AND NEW."status" IN ('CONSUMED', 'FAILED'))
  ) THEN
    RAISE EXCEPTION 'Invalid upload intent status transition: % -> %', OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "UploadIntent_status_transition_guard"
  BEFORE UPDATE OF "status" ON "UploadIntent"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_upload_intent_status_transition"();

-- Only a successfully completed upload intent can mint a quarantined asset row.
CREATE FUNCTION "require_completed_upload_intent_for_asset"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  intent_status "UploadIntentStatus";
BEGIN
  SELECT "status" INTO intent_status
  FROM "UploadIntent"
  WHERE "id" = NEW."uploadIntentId"
    AND "submissionRevisionId" = NEW."submissionRevisionId";

  IF intent_status IS NULL OR intent_status NOT IN ('COMPLETED', 'CONSUMED') THEN
    RAISE EXCEPTION 'Media asset version requires a completed matching upload intent'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MediaAssetVersion_completed_intent_guard"
  BEFORE INSERT ON "MediaAssetVersion"
  FOR EACH ROW
  EXECUTE FUNCTION "require_completed_upload_intent_for_asset"();

-- File identity and detected source facts never change in place. A changed
-- source is represented by a new MediaAssetVersion.
CREATE FUNCTION "prevent_media_asset_version_fact_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    NEW."submissionRevisionId",
    NEW."uploadIntentId",
    NEW."versionNumber",
    NEW."sourceSha256",
    NEW."fileSizeBytes",
    NEW."detectedMimeType",
    NEW."durationSeconds",
    NEW."widthPixels",
    NEW."heightPixels",
    NEW."storageProvider",
    NEW."storageAssetRef",
    NEW."quarantinedAt",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."submissionRevisionId",
    OLD."uploadIntentId",
    OLD."versionNumber",
    OLD."sourceSha256",
    OLD."fileSizeBytes",
    OLD."detectedMimeType",
    OLD."durationSeconds",
    OLD."widthPixels",
    OLD."heightPixels",
    OLD."storageProvider",
    OLD."storageAssetRef",
    OLD."quarantinedAt",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Media asset version source facts are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MediaAssetVersion_source_facts_immutable"
  BEFORE UPDATE OF
    "submissionRevisionId",
    "uploadIntentId",
    "versionNumber",
    "sourceSha256",
    "fileSizeBytes",
    "detectedMimeType",
    "durationSeconds",
    "widthPixels",
    "heightPixels",
    "storageProvider",
    "storageAssetRef",
    "quarantinedAt",
    "createdAt"
  ON "MediaAssetVersion"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_media_asset_version_fact_mutation"();

-- Asset-processing status transitions are explicit; terminal states do not
-- re-open. Takedown only moves toward physical/logical removal.
CREATE FUNCTION "guard_media_asset_version_status_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'QUARANTINED' AND NEW."status" IN ('PROCESSING', 'REJECTED', 'FAILED', 'TAKEDOWN_PENDING'))
    OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('TECHNICAL_REVIEW', 'REJECTED', 'FAILED', 'TAKEDOWN_PENDING'))
    OR (OLD."status" = 'TECHNICAL_REVIEW' AND NEW."status" IN ('READY_FOR_REVIEW', 'REJECTED', 'FAILED', 'TAKEDOWN_PENDING'))
    OR (OLD."status" = 'READY_FOR_REVIEW' AND NEW."status" IN ('REJECTED', 'TAKEDOWN_PENDING'))
    OR (OLD."status" = 'TAKEDOWN_PENDING' AND NEW."status" = 'REMOVED')
  ) THEN
    RAISE EXCEPTION 'Invalid media asset version status transition: % -> %', OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MediaAssetVersion_status_transition_guard"
  BEFORE UPDATE OF "status" ON "MediaAssetVersion"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_media_asset_version_status_transition"();


-- Persist only the initial state for an upload intent. Authorization is a
-- separate, later transition after all server-side gates have passed.
CREATE FUNCTION "guard_upload_intent_initial_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" <> 'PENDING'
    OR NEW."authorizedAt" IS NOT NULL
    OR NEW."completedAt" IS NOT NULL
    OR NEW."consumedAt" IS NOT NULL
  THEN
    RAISE EXCEPTION 'Upload intents must be created in PENDING state without lifecycle timestamps'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "UploadIntent_initial_state_guard"
  BEFORE INSERT ON "UploadIntent"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_upload_intent_initial_state"();

-- No external/provider state may skip the quarantine entry point.
CREATE FUNCTION "guard_media_asset_version_initial_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" <> 'QUARANTINED' OR NEW."validatedAt" IS NOT NULL OR NEW."removedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Media asset versions must be created in QUARANTINED state'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MediaAssetVersion_initial_quarantine_guard"
  BEFORE INSERT ON "MediaAssetVersion"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_media_asset_version_initial_state"();

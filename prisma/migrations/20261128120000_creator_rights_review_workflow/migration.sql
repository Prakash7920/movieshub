CREATE TYPE "CreatorRightsReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "UploadIntent"
  ADD COLUMN "territoryCode" VARCHAR(2);
ALTER TABLE "UploadIntent"
  ADD CONSTRAINT "UploadIntent_territoryCode_format_check"
  CHECK ("territoryCode" IS NULL OR "territoryCode" ~ '^[A-Z]{2}$');

CREATE TABLE "CreatorRightsReview" (
  "id" TEXT NOT NULL,
  "submissionRevisionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "CreatorRightsReviewStatus" NOT NULL DEFAULT 'PENDING',
  "rightsHolder" VARCHAR(200) NOT NULL,
  "evidenceReference" VARCHAR(300) NOT NULL,
  "evidenceSha256" CHAR(64) NOT NULL,
  "ownerApprovalReference" VARCHAR(300) NOT NULL,
  "legalApprovalReference" VARCHAR(300) NOT NULL,
  "allowedTerritories" TEXT[] NOT NULL,
  "allowedLanguages" TEXT[] NOT NULL,
  "permittedMediaRoles" "CreatorMediaRole"[] NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "uploadAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "hostingAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "processingAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "ottVodStreamingAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "downloadsAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "evidenceInspected" BOOLEAN NOT NULL DEFAULT FALSE,
  "rightsScopeConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "ownerApprovalConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "legalApprovalConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "submittedByUserId" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewNotes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorRightsReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreatorRightsReview_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "CreatorRightsReview_rightsHolder_check" CHECK (length(btrim("rightsHolder")) BETWEEN 3 AND 200),
  CONSTRAINT "CreatorRightsReview_evidenceReference_check" CHECK (
    length("evidenceReference") BETWEEN 3 AND 300
    AND "evidenceReference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]+$'
    AND "evidenceReference" NOT LIKE '%..%'
    AND "evidenceReference" NOT LIKE '%://%'
  ),
  CONSTRAINT "CreatorRightsReview_ownerApprovalReference_check" CHECK (
    length("ownerApprovalReference") BETWEEN 3 AND 300
    AND "ownerApprovalReference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]+$'
    AND "ownerApprovalReference" NOT LIKE '%..%'
    AND "ownerApprovalReference" NOT LIKE '%://%'
  ),
  CONSTRAINT "CreatorRightsReview_legalApprovalReference_check" CHECK (
    length("legalApprovalReference") BETWEEN 3 AND 300
    AND "legalApprovalReference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]+$'
    AND "legalApprovalReference" NOT LIKE '%..%'
    AND "legalApprovalReference" NOT LIKE '%://%'
  ),
  CONSTRAINT "CreatorRightsReview_evidenceSha256_check" CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "CreatorRightsReview_effectiveDates_check" CHECK ("expiryDate" > "startDate"),
  CONSTRAINT "CreatorRightsReview_downloads_disabled_check" CHECK ("downloadsAllowed" = FALSE),
  CONSTRAINT "CreatorRightsReview_territory_array_check" CHECK (
    cardinality("allowedTerritories") BETWEEN 1 AND 30
    AND array_position("allowedTerritories", NULL) IS NULL
  ),
  CONSTRAINT "CreatorRightsReview_language_array_check" CHECK (
    cardinality("allowedLanguages") BETWEEN 1 AND 30
    AND array_position("allowedLanguages", NULL) IS NULL
  ),
  CONSTRAINT "CreatorRightsReview_media_roles_array_check" CHECK (
    cardinality("permittedMediaRoles") BETWEEN 1 AND 6
    AND array_position("permittedMediaRoles", NULL) IS NULL
  ),
  CONSTRAINT "CreatorRightsReview_decision_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "reviewedAt" IS NULL
      AND "reviewedByUserId" IS NULL
      AND NOT "evidenceInspected"
      AND NOT "rightsScopeConfirmed"
      AND NOT "ownerApprovalConfirmed"
      AND NOT "legalApprovalConfirmed"
    )
    OR
    (
      "status" = 'APPROVED'
      AND "reviewedAt" IS NOT NULL
      AND "reviewedByUserId" IS NOT NULL
      AND "reviewedByUserId" <> "submittedByUserId"
      AND "evidenceInspected"
      AND "rightsScopeConfirmed"
      AND "ownerApprovalConfirmed"
      AND "legalApprovalConfirmed"
      AND "uploadAllowed"
      AND "hostingAllowed"
      AND "processingAllowed"
      AND "ottVodStreamingAllowed"
      AND cardinality("allowedTerritories") > 0
      AND cardinality("allowedLanguages") > 0
      AND cardinality("permittedMediaRoles") > 0
    )
    OR
    (
      "status" = 'REJECTED'
      AND "reviewedAt" IS NOT NULL
      AND "reviewedByUserId" IS NOT NULL
      AND "reviewedByUserId" <> "submittedByUserId"
      AND length(btrim(COALESCE("reviewNotes", ''))) >= 3
    )
  )
);

CREATE UNIQUE INDEX "CreatorRightsReview_submissionRevisionId_sequence_key"
  ON "CreatorRightsReview"("submissionRevisionId", "sequence");
CREATE INDEX "CreatorRightsReview_submissionRevisionId_status_sequence_idx"
  ON "CreatorRightsReview"("submissionRevisionId", "status", "sequence");
CREATE INDEX "CreatorRightsReview_status_expiryDate_idx"
  ON "CreatorRightsReview"("status", "expiryDate");
CREATE INDEX "CreatorRightsReview_reviewedByUserId_idx"
  ON "CreatorRightsReview"("reviewedByUserId");
CREATE INDEX "CreatorRightsReview_submittedByUserId_idx"
  ON "CreatorRightsReview"("submittedByUserId");

ALTER TABLE "CreatorRightsReview"
  ADD CONSTRAINT "CreatorRightsReview_submissionRevisionId_fkey"
  FOREIGN KEY ("submissionRevisionId") REFERENCES "CreatorSubmissionRevision"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorRightsReview"
  ADD CONSTRAINT "CreatorRightsReview_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorRightsReview"
  ADD CONSTRAINT "CreatorRightsReview_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "validate_creator_rights_review_insert"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" <> 'PENDING'
    OR NEW."reviewedAt" IS NOT NULL
    OR NEW."reviewedByUserId" IS NOT NULL
    OR NEW."evidenceInspected"
    OR NEW."rightsScopeConfirmed"
    OR NEW."ownerApprovalConfirmed"
    OR NEW."legalApprovalConfirmed"
  THEN
    RAISE EXCEPTION 'Creator rights reviews must begin PENDING without reviewer attestations'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW."allowedTerritories") AS item(code)
    WHERE code !~ '^[A-Z]{2}$'
  ) OR cardinality(NEW."allowedTerritories") <>
      (SELECT count(DISTINCT code) FROM unnest(NEW."allowedTerritories") AS item(code)) THEN
    RAISE EXCEPTION 'Creator rights territories must be unique uppercase ISO alpha-2 codes'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW."allowedLanguages") AS item(code)
    WHERE code !~ '^[a-z]{2,3}$'
  ) OR cardinality(NEW."allowedLanguages") <>
      (SELECT count(DISTINCT code) FROM unnest(NEW."allowedLanguages") AS item(code)) THEN
    RAISE EXCEPTION 'Creator rights languages must be unique lowercase ISO 639 codes'
      USING ERRCODE = 'check_violation';
  END IF;

  IF cardinality(NEW."permittedMediaRoles") <>
      (SELECT count(DISTINCT role) FROM unnest(NEW."permittedMediaRoles") AS item(role)) THEN
    RAISE EXCEPTION 'Creator rights media roles must be unique'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreatorRightsReview_initial_state_guard"
  BEFORE INSERT ON "CreatorRightsReview"
  FOR EACH ROW EXECUTE FUNCTION "validate_creator_rights_review_insert"();

CREATE FUNCTION "guard_creator_rights_review_update"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'Reviewed creator rights decisions are immutable; create a new review sequence'
      USING ERRCODE = 'check_violation';
  END IF;

  IF ROW(
    NEW."submissionRevisionId", NEW."sequence", NEW."rightsHolder",
    NEW."evidenceReference", NEW."evidenceSha256", NEW."ownerApprovalReference",
    NEW."legalApprovalReference", NEW."allowedTerritories", NEW."allowedLanguages",
    NEW."permittedMediaRoles", NEW."startDate", NEW."expiryDate",
    NEW."uploadAllowed", NEW."hostingAllowed", NEW."processingAllowed",
    NEW."ottVodStreamingAllowed", NEW."downloadsAllowed",
    NEW."submittedByUserId", NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."submissionRevisionId", OLD."sequence", OLD."rightsHolder",
    OLD."evidenceReference", OLD."evidenceSha256", OLD."ownerApprovalReference",
    OLD."legalApprovalReference", OLD."allowedTerritories", OLD."allowedLanguages",
    OLD."permittedMediaRoles", OLD."startDate", OLD."expiryDate",
    OLD."uploadAllowed", OLD."hostingAllowed", OLD."processingAllowed",
    OLD."ottVodStreamingAllowed", OLD."downloadsAllowed",
    OLD."submittedByUserId", OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Creator rights evidence and scope are immutable; create a new review sequence'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" NOT IN ('APPROVED', 'REJECTED')
    OR NEW."reviewedAt" IS NULL
    OR NEW."reviewedByUserId" IS NULL
    OR NEW."reviewedByUserId" = NEW."submittedByUserId"
  THEN
    RAISE EXCEPTION 'A pending creator rights review requires a distinct human admin reviewer and a terminal decision'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" = 'APPROVED' AND NOT (
    NEW."evidenceInspected" AND NEW."rightsScopeConfirmed"
    AND NEW."ownerApprovalConfirmed" AND NEW."legalApprovalConfirmed"
    AND NEW."uploadAllowed" AND NEW."hostingAllowed"
    AND NEW."processingAllowed" AND NEW."ottVodStreamingAllowed"
  ) THEN
    RAISE EXCEPTION 'Creator rights approval requires evidence, scope, owner and legal attestations plus all upload scopes'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" = 'REJECTED' AND length(btrim(COALESCE(NEW."reviewNotes", ''))) < 3 THEN
    RAISE EXCEPTION 'Creator rights rejection requires a recorded reason'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreatorRightsReview_immutable_after_submission"
  BEFORE UPDATE ON "CreatorRightsReview"
  FOR EACH ROW EXECUTE FUNCTION "guard_creator_rights_review_update"();

ALTER TABLE "License"
  ADD COLUMN "evidenceReference" VARCHAR(300),
  ADD COLUMN "evidenceSha256" CHAR(64),
  ADD COLUMN "rightsScopeConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT;

CREATE INDEX "License_reviewedByUserId_idx"
  ON "License"("reviewedByUserId");

ALTER TABLE "License"
  ADD CONSTRAINT "License_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "License"
  ADD CONSTRAINT "License_evidenceSha256_format_check"
  CHECK ("evidenceSha256" IS NULL OR "evidenceSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "License"
  ADD CONSTRAINT "License_rightsScopeConfirmed_evidence_check"
  CHECK (
    NOT "rightsScopeConfirmed"
    OR (
      "evidenceReference" IS NOT NULL
      AND "evidenceSha256" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "reviewedByUserId" IS NOT NULL
    )
  );

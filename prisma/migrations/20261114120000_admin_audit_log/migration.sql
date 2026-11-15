-- Reuse the audit table shape already present in existing Neon databases.
-- Older deployments use targetType/targetId and require actorEmail; Prisma maps
-- resourceType/resourceId onto those legacy column names.
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT NOT NULL DEFAULT 'unknown',
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminAuditLog"
  ADD COLUMN IF NOT EXISTS "actorEmail" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_createdAt_idx"
  ON "AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_createdAt_idx"
  ON "AdminAuditLog"("targetType", "targetId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog"("action", "createdAt");

CREATE OR REPLACE FUNCTION prevent_admin_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AdminAuditLog_prevent_update_delete" ON "AdminAuditLog";
CREATE TRIGGER "AdminAuditLog_prevent_update_delete"
  BEFORE UPDATE OR DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();

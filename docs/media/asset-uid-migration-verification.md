# Movie Cloudflare Stream Asset UID Migration Verification

- **Checkpoint:** Phase 5.27
- **Verification date:** 2026-11-21
- **Result:** PASS — migration is already applied and schema matches
- **Method:** Read-only Vercel metadata inspection and SELECT/catalog queries only

## Exact non-production target

The Vercel project `movieshub` Preview environment metadata scoped to Git branch `phase-5/consolidated-security-ops` labels:
- `DATABASE_URL`: “Isolated NexaFilm E2E test database; Preview branch only for phase-5/consolidated-security-ops.”
- `DIRECT_URL`: “Migration-only owner connection for isolated NexaFilm E2E test database; Preview branch only for phase-5/consolidated-security-ops.”

The matching isolated Neon target is:
- Project: `nexafilm-e2e-isolated`
- Project ID: `autumn-surf-26965712`
- Branch: `test` (`br-delicate-breeze-b3s9x6pu`, default branch of this isolated project)
- Database: `movieshub_test`

This is the dedicated E2E/Preview database, not a Production database. Environment values were not decrypted or exposed.

## Repository migration contract

Migration file:
`prisma/migrations/20261121100000_add_cloudflare_stream_asset_uid/migration.sql`

Contents:

```sql
ALTER TABLE "Movie"
  ADD COLUMN "cloudflareStreamUid" TEXT;

CREATE UNIQUE INDEX "Movie_cloudflareStreamUid_key"
  ON "Movie"("cloudflareStreamUid");
```

The current PR-head Prisma model declares `cloudflareStreamUid String? @unique`, which matches a nullable PostgreSQL `text` column and unique index.

Expected SHA-256 of the exact migration file:
`46a54021ff2c5ceb1e4483d55597f6a8f03918b93acdaeacb41a155ef00a8e17`

## Read-only database evidence

| Check | Observed result | Status |
|---|---|---|
| Migration ledger row | Exactly one row for `20261121100000_add_cloudflare_stream_asset_uid` | **PASS** |
| Migration completion | `finished_at = 2026-11-21T06:02:04.199Z` | **PASS** |
| Rollback state | `rolled_back_at IS NULL`; no migration log error | **PASS** |
| Checksum | Database checksum exactly matches SHA-256 of current GitHub migration file | **PASS** |
| Column | `public."Movie"."cloudflareStreamUid"`, type `text`, nullable `YES`, no default | **PASS** |
| Unique index | `Movie_cloudflareStreamUid_key` exists as a unique btree index on `cloudflareStreamUid` | **PASS** |
| Full ledger health | 14 total rows; 14 successful; 0 unresolved; 0 rolled back | **PASS** |

Queries used were SELECT statements against `public."_prisma_migrations"`, `information_schema.columns`, `pg_indexes`, and a read-only aggregate of the migration ledger. No DDL, DML, `prisma migrate deploy`, branch creation, or environment change was performed.

## Decision

**Phase 5.27: PASS — the asset UID migration is already successfully applied to the intended isolated Preview/E2E database, its checksum matches the repository migration file, and the expected nullable column plus unique index exist.**

No migration rerun was necessary. No Preview or Production database was modified. No Production environment, payment, media asset, Cloudflare credential, or playback flag was touched.

This verifies the schema prerequisite only. It does not authorize Cloudflare playback or real media delivery.

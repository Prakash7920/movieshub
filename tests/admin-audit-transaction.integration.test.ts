import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Role } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { writeAdminAuditEvent } from "../lib/security/admin-audit-log";

const prisma = new PrismaClient();
const suffix = randomUUID();
const movieSlug = `audit-rollback-${suffix}`;
let actorUserId: string | null = null;

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Database integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Audit rollback tests may only use the isolated movieshub_test database.");
  }
  await prisma.$connect();
});

after(async () => {
  await prisma.movie.deleteMany({ where: { slug: movieSlug } });
  if (actorUserId) {
    await prisma.user.deleteMany({ where: { id: actorUserId } });
  }
  await prisma.$disconnect();
});

test("business mutation rolls back when audit persistence fails in the same transaction", async () => {
  const actor = await prisma.user.create({
    data: {
      email: `audit-rollback-${suffix}@example.invalid`,
      role: Role.ADMIN,
    },
    select: { id: true },
  });
  actorUserId = actor.id;

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.movie.create({
        data: {
          titleEn: "Audit rollback test",
          titleTa: "Audit rollback test",
          slug: movieSlug,
          descriptionEn: "Isolated transaction rollback test",
          descriptionTa: "Isolated transaction rollback test",
          posterUrl: "https://example.invalid/poster.jpg",
          backdropUrl: "https://example.invalid/backdrop.jpg",
          language: "en",
          audioLanguages: ["en"],
          subtitleLanguages: [],
          releaseYear: 2026,
          runtimeMinutes: 90,
          ageRating: "U",
          allowedCountries: ["IN"],
          isPublished: false,
          contentStatus: "DRAFT",
        },
      });

      // Deliberately violate the non-null audit action constraint after the
      // business write. Prisma must reject the audit insert and roll back both.
      await writeAdminAuditEvent(tx, {
        actorUserId: actor.id,
        action: null as unknown as string,
        resourceType: "Movie",
        resourceId: movieSlug,
      });
    }),
  );

  const persistedMovie = await prisma.movie.findUnique({
    where: { slug: movieSlug },
    select: { id: true },
  });
  assert.equal(persistedMovie, null, "movie must not persist when audit insertion fails");
});

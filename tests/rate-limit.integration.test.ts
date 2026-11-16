import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { consumeRateLimit } from "../lib/security/rate-limit";

const prisma = new PrismaClient();
const testKeys: string[] = [];

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Database integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
      !databaseUrl.pathname.includes("movieshub_test")) {
    throw new Error("Database integration tests may only use the isolated movieshub_test database.");
  }
  await prisma.$connect();
});

after(async () => {
  if (testKeys.length) await prisma.rateLimitBucket.deleteMany({ where: { key: { in: testKeys } } });
  await prisma.$disconnect();
});

test("rate limits are atomic and shared across concurrent requests", async () => {
  const scope = "integration-test";
  const identifier = randomUUID();
  const secret = process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET;
  assert.ok(secret && secret.length >= 32);
  const key = createHmac("sha256", secret).update(`${scope}:${identifier.trim().toLowerCase()}`, "utf8").digest("hex");
  testKeys.push(key);

  const results = await Promise.all(
    Array.from({ length: 8 }, () => consumeRateLimit(scope, identifier, 3, 60)),
  );

  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal(results.filter((result) => !result.allowed).length, 5);
});


test("rate limit boundary reports remaining capacity and rejects the next request", async () => {
  const scope = "integration-boundary";
  const identifier = randomUUID();
  const secret = process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET;
  assert.ok(secret && secret.length >= 32);
  const key = createHmac("sha256", secret).update(`${scope}:${identifier.trim().toLowerCase()}`, "utf8").digest("hex");
  testKeys.push(key);

  const first = await consumeRateLimit(scope, identifier, 1, 60);
  assert.equal(first.allowed, true);
  assert.equal(first.limit, 1);
  assert.equal(first.remaining, 0);
  assert.ok(first.retryAfterSeconds >= 1 && first.retryAfterSeconds <= 60);

  const second = await consumeRateLimit(scope, identifier, 1, 60);
  assert.equal(second.allowed, false);
  assert.equal(second.remaining, 0);
  assert.ok(second.retryAfterSeconds >= 1 && second.retryAfterSeconds <= 60);
});

test("rate limit identifiers are normalized before hashing", async () => {
  const scope = "integration-normalization";
  const identifier = randomUUID();
  const secret = process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET;
  assert.ok(secret && secret.length >= 32);
  const key = createHmac("sha256", secret).update(`${scope}:${identifier.trim().toLowerCase()}`, "utf8").digest("hex");
  testKeys.push(key);

  const first = await consumeRateLimit(scope, identifier.toUpperCase(), 1, 60);
  const second = await consumeRateLimit(scope, `  ${identifier.toLowerCase()}  `, 1, 60);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});

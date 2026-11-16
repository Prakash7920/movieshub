import assert from "node:assert/strict";
import { test } from "node:test";
import { createOneTimeToken, hashOneTimeToken, isWellFormedOneTimeToken } from "../lib/security/tokens";
import { getClientIp } from "../lib/security/client-identity";
import { hasValidJsonContentType, isSameOriginRequest } from "../lib/security/request-guards";
import { getVercelViewerCountry } from "../lib/licensing/territory";
import { getSessionRevocationId } from "../lib/security/session-revocation";
import { consumeRateLimit } from "../lib/security/rate-limit";
import { createHmac } from "node:crypto";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "../lib/payments/razorpay";

test("one-time tokens are cryptographically random, fixed-length and hashable", () => {
  const first = createOneTimeToken();
  const second = createOneTimeToken();

  assert.equal(first.token.length, 64);
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashOneTimeToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(isWellFormedOneTimeToken(first.token), true);
  assert.equal(isWellFormedOneTimeToken(first.token + "0"), false);
  assert.equal(isWellFormedOneTimeToken("not-a-token"), false);
  assert.equal(isWellFormedOneTimeToken(null), false);
});

test("client IP extraction prefers the proxy real-IP header", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.10",
    "x-forwarded-for": "198.51.100.5, 203.0.113.11",
  });
  assert.equal(getClientIp(headers), "203.0.113.10");
});

test("client IP extraction uses the final forwarded hop as a fallback", () => {
  assert.equal(
    getClientIp({ "X-Forwarded-For": "198.51.100.5, 203.0.113.11" }),
    "203.0.113.11",
  );
  assert.equal(getClientIp({}), null);
});

test("state-changing API requests require a same-origin source", () => {
  const expectedOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : "https://movieshub.example";
  const sameOrigin = new Request(`${expectedOrigin}/api/auth/register`, {
    method: "POST",
    headers: { origin: expectedOrigin },
  });
  const sameOriginReferer = new Request(`${expectedOrigin}/api/auth/register`, {
    method: "POST",
    headers: { referer: `${expectedOrigin}/auth/register` },
  });
  const foreignOrigin = new Request(`${expectedOrigin}/api/auth/register`, {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  });
  const missingOrigin = new Request(`${expectedOrigin}/api/auth/register`, { method: "POST" });

  assert.equal(isSameOriginRequest(sameOrigin), true);
  assert.equal(isSameOriginRequest(sameOriginReferer), true);
  assert.equal(isSameOriginRequest(foreignOrigin), false);
  assert.equal(isSameOriginRequest(missingOrigin), false);
});

test("JSON content type and actual body size are enforced", async () => {
  const valid = new Request("https://movieshub.example/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const wrongType = new Request("https://movieshub.example/api", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  const oversized = new Request("https://movieshub.example/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "x".repeat(17 * 1024),
  });

  assert.equal(await hasValidJsonContentType(valid), true);
  assert.equal(await hasValidJsonContentType(wrongType), false);
  assert.equal(await hasValidJsonContentType(oversized), false);
});

test("territory resolver normalizes valid proxy country codes and fails closed", () => {
  assert.equal(getVercelViewerCountry(new Headers({ "x-vercel-ip-country": "in" })), "IN");
  assert.equal(getVercelViewerCountry(new Headers({ "x-vercel-ip-country": "US" })), "US");
  assert.equal(getVercelViewerCountry(new Headers({ "x-vercel-ip-country": "India" })), null);
  assert.equal(getVercelViewerCountry(new Headers()), null);
});

test("session revocation IDs are stable and prefer the JWT identifier", () => {
  assert.equal(getSessionRevocationId({ sid: "stable-session" }), "sid:stable-session");
  assert.equal(getSessionRevocationId({ jti: "session-jti" }), "jti:session-jti");
  const first = getSessionRevocationId({ sub: "user-1", iat: 100, exp: 200 });
  const second = getSessionRevocationId({ sub: "user-1", iat: 100, exp: 200 });
  const different = getSessionRevocationId({ sub: "user-1", iat: 101, exp: 200 });
  assert.ok(first);
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.equal(getSessionRevocationId({ sub: "user-1" }), null);
});


test("same-origin guard rejects malformed sources and does not fall back from a supplied foreign origin", () => {
  const requestUrl = "https://movieshub.example/api/admin/movies";
  assert.equal(isSameOriginRequest(new Request(requestUrl, {
    method: "POST",
    headers: { origin: "not a URL", referer: "https://movieshub.example/admin" },
  })), false);
  assert.equal(isSameOriginRequest(new Request(requestUrl, {
    method: "POST",
    headers: { origin: "https://attacker.example", referer: "https://movieshub.example/admin" },
  })), false);
  assert.equal(isSameOriginRequest(new Request(requestUrl, {
    method: "POST",
    headers: { referer: "https://movieshub.example.evil.example/admin" },
  })), false);
});

test("JSON guard rejects invalid, negative and oversized declared content lengths", async () => {
  const makeRequest = (contentLength: string) => new Request("https://movieshub.example/api", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": contentLength },
    body: "{}",
  });
  assert.equal(await hasValidJsonContentType(makeRequest("not-a-number")), false);
  assert.equal(await hasValidJsonContentType(makeRequest("-1")), false);
  assert.equal(await hasValidJsonContentType(makeRequest("16385")), false);
  assert.equal(await hasValidJsonContentType(makeRequest("2")), true);
});


test("rate limiter rejects invalid limits and missing signing secrets before database access", async () => {
  const previousRateLimitSecret = process.env.RATE_LIMIT_SECRET;
  const previousNextAuthSecret = process.env.NEXTAUTH_SECRET;
  try {
    await assert.rejects(
      consumeRateLimit("test", "identifier", 0, 60),
      /Invalid rate-limit configuration/,
    );
    delete process.env.RATE_LIMIT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    await assert.rejects(
      consumeRateLimit("test", "identifier", 1, 60),
      /Rate-limit signing secret is not configured/,
    );
  } finally {
    if (previousRateLimitSecret === undefined) delete process.env.RATE_LIMIT_SECRET;
    else process.env.RATE_LIMIT_SECRET = previousRateLimitSecret;
    if (previousNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousNextAuthSecret;
  }
});


test("Razorpay webhook signatures verify exact raw bytes and reject tampering", () => {
  const secret = "unit-test-razorpay-webhook-secret";
  const raw = Buffer.from('{"event":"payment.captured","payload":{}}');
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from(raw.toString() + " "), signature, secret), false);
  assert.equal(verifyRazorpayWebhookSignature(raw, "0".repeat(64), secret), false);
  assert.equal(verifyRazorpayWebhookSignature(raw, null, secret), false);
  assert.equal(verifyRazorpayWebhookSignature(raw, "bad", secret), false);
});

test("Razorpay checkout callback signature binds the exact order and payment IDs", () => {
  const secret = "unit-test-razorpay-api-secret";
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const signature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret), true);
  assert.equal(verifyRazorpayPaymentSignature("order_other", paymentId, signature, secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, "pay_other", signature, secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, null, secret), false);
});

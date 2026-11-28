import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { sendTransactionalEmail } from "../lib/email/resend";

const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
let errorLogs: unknown[][] = [];

const email = {
  to: "recipient@example.com",
  subject: "NexaFilm test",
  html: "<p>Test message</p>",
};

function configureProvider(): void {
  process.env.RESEND_API_KEY = "unit-test-api-key";
  process.env.RESEND_FROM_EMAIL = "NexaFilm <onboarding@resend.dev>";
}

function captureErrorLogs(): void {
  errorLogs = [];
  console.error = (...args: unknown[]) => {
    errorLogs.push(args);
  };
}

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;

  if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = originalFrom;

  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

test("missing provider configuration returns not_configured without exposing values", async () => {
  configureProvider();
  delete process.env.RESEND_FROM_EMAIL;
  captureErrorLogs();

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  const result = await sendTransactionalEmail(email);

  assert.deepEqual(result, { sent: false, reason: "not_configured" });
  assert.equal(fetchCalled, false);
  assert.equal(errorLogs.length, 1);
  const logged = JSON.stringify(errorLogs);
  assert.match(logged, /apiKeyConfigured/);
  assert.match(logged, /fromConfigured/);
  assert.doesNotMatch(logged, /unit-test-api-key/);
  assert.doesNotMatch(logged, /recipient@example.com/);
});

test("provider rejection logs HTTP status and a safe error type, not the response message", async () => {
  configureProvider();
  captureErrorLogs();
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      name: "validation_error",
      message: "recipient@example.com must not appear in logs; unit-test-api-key must not appear",
    }),
    { status: 422, headers: { "Content-Type": "application/json" } },
  )) as typeof fetch;

  const result = await sendTransactionalEmail(email);

  assert.deepEqual(result, { sent: false, reason: "provider_rejected" });
  const logged = JSON.stringify(errorLogs);
  assert.match(logged, /422/);
  assert.match(logged, /validation_error/);
  assert.doesNotMatch(logged, /recipient@example.com/);
  assert.doesNotMatch(logged, /unit-test-api-key/);
  assert.doesNotMatch(logged, /must not appear/);
});

test("network failures retain only the safe error name and code", async () => {
  configureProvider();
  captureErrorLogs();
  const failure = Object.assign(
    new Error("recipient@example.com and unit-test-api-key must not be logged"),
    { code: "ECONNRESET" },
  );
  globalThis.fetch = (async () => {
    throw failure;
  }) as typeof fetch;

  const result = await sendTransactionalEmail(email);

  assert.deepEqual(result, { sent: false, reason: "network_error" });
  const logged = JSON.stringify(errorLogs);
  assert.match(logged, /Error/);
  assert.match(logged, /ECONNRESET/);
  assert.doesNotMatch(logged, /recipient@example.com/);
  assert.doesNotMatch(logged, /unit-test-api-key/);
});

test("successful provider response preserves the sent result", async () => {
  configureProvider();
  captureErrorLogs();
  let requestBody: Record<string, unknown> | undefined;
  let authorization: string | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    authorization = new Headers(init?.headers).get("Authorization");
    return new Response(JSON.stringify({ id: "re_test_provider_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const result = await sendTransactionalEmail(email);

  assert.deepEqual(result, { sent: true });
  assert.deepEqual(requestBody?.to, ["recipient@example.com"]);
  assert.equal(authorization, "Bearer unit-test-api-key");
  assert.equal(errorLogs.length, 0);
});

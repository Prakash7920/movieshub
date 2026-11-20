import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { POST as createPaymentOrder } from "../app/api/payments/orders/route";
import { getSubscriptionPrice } from "../lib/subscriptions/plans";
import { runWithApiSessionForIntegrationTest } from "../lib/security/api-session";
import { prisma } from "../lib/prisma";

const suffix = randomUUID();
const monthlyAmount = getSubscriptionPrice("PREMIUM", "MONTHLY");
const rateLimitKeys: string[] = [];
const createdPaymentIds: string[] = [];
let userId: string | null = null;
let previousFetch: typeof fetch;
const previousEnv = {
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  rateLimitSecret: process.env.RATE_LIMIT_SECRET,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function providerOrder(paymentId: string, paymentOwnerId: string, id = `order-${suffix}`) {
  return {
    id,
    amount: Math.round(monthlyAmount * 100),
    currency: "INR",
    receipt: paymentId,
    status: "created",
    attempts: 0,
    notes: { paymentId, userId: paymentOwnerId },
  };
}

function requestFor(idempotencyKey: string): Request {
  const origin = "https://payments-order-test.example";
  return new Request(`${origin}/api/payments/orders`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      plan: "PREMIUM",
      billingCycle: "MONTHLY",
      idempotencyKey,
    }),
  });
}

async function invokeOrderRoute(idempotencyKey: string) {
  return runWithApiSessionForIntegrationTest(
    { user: { id: userId! } },
    () => createPaymentOrder(requestFor(idempotencyKey)),
  );
}

async function createOrphanedPayment(requestKey: string) {
  const payment = await prisma.payment.create({
    data: {
      userId: userId!,
      amount: monthlyAmount,
      currency: "INR",
      provider: "razorpay",
      status: "FAILED",
      plan: "PREMIUM",
      billingCycle: "MONTHLY",
      requestKey,
    },
    select: { id: true },
  });
  createdPaymentIds.push(payment.id);
  return payment.id;
}

function installFetchStub(handler: (url: URL, init?: RequestInit) => Promise<Response>) {
  global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
    return handler(url, init);
  }) as typeof fetch;
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Payment order integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Payment order integration tests may only use the isolated movieshub_test database.");
  }

  previousFetch = global.fetch;
  process.env.RAZORPAY_KEY_ID = "rzp_test_ci_order_recovery";
  process.env.RAZORPAY_KEY_SECRET = "ci-only-order-recovery-secret";
  process.env.RATE_LIMIT_SECRET = "ci-only-rate-limit-secret-for-order-recovery";
  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: `payment-orders-${suffix}@example.invalid` },
    select: { id: true },
  });
  userId = user.id;

  const rateKey = createHmac("sha256", process.env.RATE_LIMIT_SECRET!)
    .update(`payment-order:${userId}`, "utf8")
    .digest("hex");
  rateLimitKeys.push(rateKey);
});

after(async () => {
  global.fetch = previousFetch;
  if (createdPaymentIds.length) {
    await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
  }
  if (userId) {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateLimitKeys } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  if (previousEnv.razorpayKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = previousEnv.razorpayKeyId;
  if (previousEnv.razorpayKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = previousEnv.razorpayKeySecret;
  if (previousEnv.rateLimitSecret === undefined) delete process.env.RATE_LIMIT_SECRET;
  else process.env.RATE_LIMIT_SECRET = previousEnv.rateLimitSecret;
  await prisma.$disconnect();
});

test("retries recover an orphaned Razorpay order by its unique receipt", async () => {
  const requestKey = randomUUID();
  const paymentId = await createOrphanedPayment(requestKey);
  let postCalls = 0;
  installFetchStub(async (url, init) => {
    assert.equal(url.pathname, "/v1/orders");
    assert.equal(url.searchParams.get("receipt"), paymentId);
    assert.equal(url.searchParams.get("count"), "100");
    assert.equal((init?.method ?? "GET").toUpperCase(), "GET");
    return jsonResponse({ items: [providerOrder(paymentId, userId!, `order-recovered-${suffix}`)] });
  });

  const response = await invokeOrderRoute(requestKey);
  assert.ok(response);
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json() as { paymentId: string; orderId: string };
  assert.equal(result.paymentId, paymentId);
  assert.equal(result.orderId, `order-recovered-${suffix}`);
  assert.equal(postCalls, 0);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, razorpayOrderId: true },
  });
  assert.equal(payment?.status, "PENDING");
  assert.equal(payment?.razorpayOrderId, result.orderId);
});

test("new checkout creates one provider order after confirming the receipt is absent", async () => {
  const requestKey = randomUUID();
  let getCalls = 0;
  let postCalls = 0;
  installFetchStub(async (url, init) => {
    assert.equal(url.pathname, "/v1/orders");
    if ((init?.method ?? "GET").toUpperCase() === "GET") {
      getCalls += 1;
      return jsonResponse({ items: [] });
    }
    postCalls += 1;
    const body = JSON.parse(String(init?.body)) as { receipt: string; amount: number; notes: { paymentId: string; userId: string } };
    assert.equal(body.amount, Math.round(monthlyAmount * 100));
    assert.equal(body.receipt, body.notes.paymentId);
    assert.equal(body.notes.userId, userId);
    return jsonResponse({
      id: `order-created-${suffix}`,
      amount: body.amount,
      currency: "INR",
      status: "created",
    });
  });

  const response = await invokeOrderRoute(requestKey);
  assert.ok(response);
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json() as { paymentId: string; orderId: string };
  assert.equal(result.orderId, `order-created-${suffix}`);
  assert.equal(getCalls, 1);
  assert.equal(postCalls, 1);
  createdPaymentIds.push(result.paymentId);

  const payment = await prisma.payment.findUnique({
    where: { id: result.paymentId },
    select: { status: true, razorpayOrderId: true },
  });
  assert.equal(payment?.status, "PENDING");
  assert.equal(payment?.razorpayOrderId, result.orderId);
});

test("an ambiguous provider POST is reconciled by receipt before returning failure", async () => {
  const requestKey = randomUUID();
  let getCalls = 0;
  let postCalls = 0;
  installFetchStub(async (url, init) => {
    assert.equal(url.pathname, "/v1/orders");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") {
      getCalls += 1;
      if (getCalls === 1) return jsonResponse({ items: [] });
      const receipt = url.searchParams.get("receipt");
      assert.ok(receipt);
      return jsonResponse({ items: [providerOrder(receipt, userId!, `order-after-timeout-${suffix}`)] });
    }
    postCalls += 1;
    return jsonResponse({ error: { description: "Simulated lost/failed provider response" } }, 500);
  });

  const response = await invokeOrderRoute(requestKey);
  assert.ok(response);
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json() as { paymentId: string; orderId: string };
  assert.equal(result.orderId, `order-after-timeout-${suffix}`);
  assert.equal(getCalls, 2);
  assert.equal(postCalls, 1);
  createdPaymentIds.push(result.paymentId);
});

test("a receipt lookup with mismatched order details is not linked or returned", async () => {
  const requestKey = randomUUID();
  const paymentId = await createOrphanedPayment(requestKey);
  installFetchStub(async () => jsonResponse({
    items: [{
      ...providerOrder(paymentId, userId!),
      amount: Math.round(monthlyAmount * 100) + 100,
    }],
  }));

  const response = await invokeOrderRoute(requestKey);
  assert.ok(response);
  assert.equal(response.status, 503, await response.clone().text());

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, razorpayOrderId: true },
  });
  assert.equal(payment?.status, "FAILED");
  assert.equal(payment?.razorpayOrderId, null);
});

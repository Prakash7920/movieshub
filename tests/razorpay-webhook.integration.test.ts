import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { POST as razorpayWebhook } from "../app/api/webhooks/razorpay/route";
import { prisma } from "../lib/prisma";

const suffix = randomUUID();
const webhookSecret = "ci-only-razorpay-webhook-secret-value";
const eventIds = [
  `evt-captured-${suffix}`,
  `evt-mismatch-${suffix}`,
  `evt-failed-valid-${suffix}`,
  `evt-failed-amount-${suffix}`,
  `evt-failed-currency-${suffix}`,
  `evt-failed-status-${suffix}`,
  `evt-captured-missing-order-${suffix}`,
  `evt-captured-missing-payment-${suffix}`,
  `evt-captured-unknown-order-${suffix}`,
  `evt-captured-local-currency-${suffix}`,
  `evt-captured-event-currency-${suffix}`,
  `evt-captured-status-${suffix}`,
];
let userId: string | null = null;
let paymentId: string | null = null;
let mismatchPaymentId: string | null = null;
let failedPaymentId: string | null = null;
let failedAmountPaymentId: string | null = null;
let failedCurrencyPaymentId: string | null = null;
let failedStatusPaymentId: string | null = null;
let reviewPaymentId: string | null = null;
let nonInrPaymentId: string | null = null;
const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

function webhookRequest(eventId: string, event: string, entity: Record<string, unknown>, signatureOverride?: string) {
  const raw = Buffer.from(JSON.stringify({ event, payload: { payment: { entity } } }));
  const signature = signatureOverride ?? createHmac("sha256", webhookSecret).update(raw).digest("hex");
  return new Request("https://nexafilm.example/api/webhooks/razorpay", {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-event-id": eventId, "x-razorpay-signature": signature },
    body: raw,
  });
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") throw new Error("Payment integration tests require MOVIESHUB_E2E=true.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) || !databaseUrl.pathname.includes("movieshub_test")) {
    throw new Error("Payment integration tests may only use the isolated movieshub_test database.");
  }
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  await prisma.$connect();
  const user = await prisma.user.create({ data: { email: `payment-${suffix}@example.invalid` }, select: { id: true } });
  userId = user.id;
  const payment = await prisma.payment.create({
    data: { userId, amount: 299, currency: "INR", provider: "razorpay", status: "PENDING", plan: "PREMIUM", billingCycle: "MONTHLY", requestKey: `request-${suffix}`, razorpayOrderId: `order-${suffix}` },
    select: { id: true },
  });
  paymentId = payment.id;
  const mismatch = await prisma.payment.create({
    data: { userId, amount: 299, currency: "INR", provider: "razorpay", status: "PENDING", plan: "PREMIUM", billingCycle: "YEARLY", requestKey: `request-mismatch-${suffix}`, razorpayOrderId: `order-mismatch-${suffix}` },
    select: { id: true },
  });
  mismatchPaymentId = mismatch.id;

  const failedFixtures = await Promise.all(
    ["valid", "amount", "currency", "status"].map((label) =>
      prisma.payment.create({
        data: {
          userId: userId!,
          amount: 299,
          currency: "INR",
          provider: "razorpay",
          status: "PENDING",
          plan: "PREMIUM",
          billingCycle: "MONTHLY",
          requestKey: `request-failed-${label}-${suffix}`,
          razorpayOrderId: `order-failed-${label}-${suffix}`,
        },
        select: { id: true },
      }),
    ),
  );
  [failedPaymentId, failedAmountPaymentId, failedCurrencyPaymentId, failedStatusPaymentId] =
    failedFixtures.map((fixture) => fixture.id);

  const reviewPayment = await prisma.payment.create({
    data: {
      userId,
      amount: 299,
      currency: "INR",
      provider: "razorpay",
      status: "PENDING",
      plan: "PREMIUM",
      billingCycle: "MONTHLY",
      requestKey: `request-review-${suffix}`,
      razorpayOrderId: `order-review-${suffix}`,
    },
    select: { id: true },
  });
  reviewPaymentId = reviewPayment.id;

  const nonInrPayment = await prisma.payment.create({
    data: {
      userId,
      amount: 299,
      currency: "USD",
      provider: "razorpay",
      status: "PENDING",
      plan: "PREMIUM",
      billingCycle: "MONTHLY",
      requestKey: `request-local-currency-${suffix}`,
      razorpayOrderId: `order-local-currency-${suffix}`,
    },
    select: { id: true },
  });
  nonInrPaymentId = nonInrPayment.id;
});

after(async () => {
  await prisma.paymentWebhookEvent.deleteMany({ where: { eventId: { in: eventIds } } });
  if (userId) {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  await prisma.$disconnect();
});

test("Razorpay webhook rejects invalid signatures without persisting events", async () => {
  const response = await razorpayWebhook(webhookRequest(eventIds[0], "payment.captured", {
    id: "pay-invalid", order_id: `order-${suffix}`, amount: 29900, currency: "INR", status: "captured",
  }, "0".repeat(64)));
  assert.equal(response.status, 401);
  assert.equal(await prisma.paymentWebhookEvent.count({ where: { eventId: eventIds[0] } }), 0);
});

test("Razorpay captured webhook atomically grants one subscription and deduplicates retries", async () => {
  const entity = { id: `pay-${suffix}`, order_id: `order-${suffix}`, amount: 29900, currency: "INR", status: "captured" };
  const response = await razorpayWebhook(webhookRequest(eventIds[0], "payment.captured", entity));
  assert.equal(response.status, 200, await response.clone().text());

  const receipt = await prisma.paymentWebhookEvent.findUnique({ where: { eventId: eventIds[0] }, select: { processingStatus: true, razorpayOrderId: true, gatewayPaymentId: true } });
  assert.equal(receipt?.processingStatus, "PROCESSED", JSON.stringify(receipt));
  const payment = await prisma.payment.findUnique({ where: { id: paymentId! }, select: { status: true, transactionId: true, subscriptionId: true } });
  assert.equal(payment?.status, "PAID");
  assert.equal(payment?.transactionId, entity.id);
  assert.ok(payment?.subscriptionId);
  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);

  const duplicate = await razorpayWebhook(webhookRequest(eventIds[0], "payment.captured", entity));
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);
});

test("Razorpay webhook amount mismatch is durably flagged and never grants Premium", async () => {
  const response = await razorpayWebhook(webhookRequest(eventIds[1], "payment.captured", {
    id: `pay-mismatch-${suffix}`, order_id: `order-mismatch-${suffix}`, amount: 1, currency: "INR", status: "captured",
  }));
  assert.equal(response.status, 200);
  const payment = await prisma.payment.findUnique({ where: { id: mismatchPaymentId! }, select: { status: true, subscriptionId: true } });
  assert.equal(payment?.status, "PENDING");
  assert.equal(payment?.subscriptionId, null);
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { eventId: eventIds[1] }, select: { processingStatus: true } });
  assert.equal(event?.processingStatus, "REVIEW");
  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);
});


test("Razorpay failed webhook validates the matching order and marks only the pending payment failed", async () => {
  const entity = {
    id: `pay-failed-valid-${suffix}`,
    order_id: `order-failed-valid-${suffix}`,
    amount: 29900,
    currency: "INR",
    status: "failed",
  };
  const response = await razorpayWebhook(webhookRequest(eventIds[2], "payment.failed", entity));
  assert.equal(response.status, 200, await response.clone().text());

  const receipt = await prisma.paymentWebhookEvent.findUnique({
    where: { eventId: eventIds[2] },
    select: { processingStatus: true, razorpayOrderId: true, gatewayPaymentId: true },
  });
  assert.equal(receipt?.processingStatus, "PROCESSED");
  assert.equal(receipt?.razorpayOrderId, entity.order_id);
  assert.equal(receipt?.gatewayPaymentId, entity.id);

  const payment = await prisma.payment.findUnique({
    where: { id: failedPaymentId! },
    select: { status: true, transactionId: true, subscriptionId: true },
  });
  assert.equal(payment?.status, "FAILED");
  assert.equal(payment?.transactionId, entity.id);
  assert.equal(payment?.subscriptionId, null);
  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);
});

test("Razorpay failed webhook amount, currency, and status mismatches remain REVIEW without changing payment state", async () => {
  const cases = [
    {
      eventIndex: 3,
      paymentId: failedAmountPaymentId!,
      orderId: `order-failed-amount-${suffix}`,
      entity: { id: `pay-failed-amount-${suffix}`, amount: 100, currency: "INR", status: "failed" },
    },
    {
      eventIndex: 4,
      paymentId: failedCurrencyPaymentId!,
      orderId: `order-failed-currency-${suffix}`,
      entity: { id: `pay-failed-currency-${suffix}`, amount: 29900, currency: "USD", status: "failed" },
    },
    {
      eventIndex: 5,
      paymentId: failedStatusPaymentId!,
      orderId: `order-failed-status-${suffix}`,
      entity: { id: `pay-failed-status-${suffix}`, amount: 29900, currency: "INR", status: "captured" },
    },
  ];

  for (const item of cases) {
    const response = await razorpayWebhook(webhookRequest(eventIds[item.eventIndex], "payment.failed", {
      ...item.entity,
      order_id: item.orderId,
    }));
    assert.equal(response.status, 200, await response.clone().text());

    const receipt = await prisma.paymentWebhookEvent.findUnique({
      where: { eventId: eventIds[item.eventIndex] },
      select: { processingStatus: true },
    });
    assert.equal(receipt?.processingStatus, "REVIEW");

    const payment = await prisma.payment.findUnique({
      where: { id: item.paymentId },
      select: { status: true, transactionId: true, subscriptionId: true },
    });
    assert.equal(payment?.status, "PENDING");
    assert.equal(payment?.transactionId, null);
    assert.equal(payment?.subscriptionId, null);
  }

  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);
});

test("Razorpay captured webhook REVIEW branches cover missing IDs, unknown orders, and currency/status mismatches", async () => {
  const cases = [
    {
      eventIndex: 6,
      name: "missing order ID",
      paymentId: reviewPaymentId!,
      entity: { id: `pay-missing-order-${suffix}`, amount: 29900, currency: "INR", status: "captured" },
      expectedOrderId: null,
      expectedGatewayPaymentId: `pay-missing-order-${suffix}`,
    },
    {
      eventIndex: 7,
      name: "missing payment ID",
      paymentId: reviewPaymentId!,
      entity: { order_id: `order-review-${suffix}`, amount: 29900, currency: "INR", status: "captured" },
      expectedOrderId: `order-review-${suffix}`,
      expectedGatewayPaymentId: null,
    },
    {
      eventIndex: 8,
      name: "unknown order",
      paymentId: null,
      entity: { id: `pay-unknown-order-${suffix}`, order_id: `order-unknown-${suffix}`, amount: 29900, currency: "INR", status: "captured" },
      expectedOrderId: `order-unknown-${suffix}`,
      expectedGatewayPaymentId: `pay-unknown-order-${suffix}`,
    },
    {
      eventIndex: 9,
      name: "local payment currency is not INR",
      paymentId: nonInrPaymentId!,
      entity: { id: `pay-local-currency-${suffix}`, order_id: `order-local-currency-${suffix}`, amount: 29900, currency: "USD", status: "captured" },
      expectedOrderId: `order-local-currency-${suffix}`,
      expectedGatewayPaymentId: `pay-local-currency-${suffix}`,
    },
    {
      eventIndex: 10,
      name: "captured event currency mismatch",
      paymentId: reviewPaymentId!,
      entity: { id: `pay-event-currency-${suffix}`, order_id: `order-review-${suffix}`, amount: 29900, currency: "USD", status: "captured" },
      expectedOrderId: `order-review-${suffix}`,
      expectedGatewayPaymentId: `pay-event-currency-${suffix}`,
    },
    {
      eventIndex: 11,
      name: "captured event status mismatch",
      paymentId: reviewPaymentId!,
      entity: { id: `pay-captured-status-${suffix}`, order_id: `order-review-${suffix}`, amount: 29900, currency: "INR", status: "authorized" },
      expectedOrderId: `order-review-${suffix}`,
      expectedGatewayPaymentId: `pay-captured-status-${suffix}`,
    },
  ];

  for (const item of cases) {
    const response = await razorpayWebhook(
      webhookRequest(eventIds[item.eventIndex], "payment.captured", item.entity),
    );
    assert.equal(response.status, 200, `${item.name}: ${await response.clone().text()}`);

    const receipt = await prisma.paymentWebhookEvent.findUnique({
      where: { eventId: eventIds[item.eventIndex] },
      select: { processingStatus: true, razorpayOrderId: true, gatewayPaymentId: true },
    });
    assert.equal(receipt?.processingStatus, "REVIEW", item.name);
    assert.equal(receipt?.razorpayOrderId, item.expectedOrderId, item.name);
    assert.equal(receipt?.gatewayPaymentId, item.expectedGatewayPaymentId, item.name);

    if (item.paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: item.paymentId },
        select: { status: true, transactionId: true, subscriptionId: true },
      });
      assert.equal(payment?.status, "PENDING", item.name);
      assert.equal(payment?.transactionId, null, item.name);
      assert.equal(payment?.subscriptionId, null, item.name);
    }
  }

  assert.equal(await prisma.subscription.count({ where: { userId: userId! } }), 1);
});

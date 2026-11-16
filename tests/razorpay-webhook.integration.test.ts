import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { POST as razorpayWebhook } from "../app/api/webhooks/razorpay/route";
import { prisma } from "../lib/prisma";

const suffix = randomUUID();
const webhookSecret = "ci-only-razorpay-webhook-secret-value";
const eventIds = [`evt-captured-${suffix}`, `evt-mismatch-${suffix}`];
let userId: string | null = null;
let paymentId: string | null = null;
let mismatchPaymentId: string | null = null;
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

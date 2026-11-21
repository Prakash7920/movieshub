import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function isRazorpayTestModePreviewEnabled(runtimeEnv: NodeJS.ProcessEnv = process.env): boolean {
  return runtimeEnv.VERCEL_ENV === "preview"
    && runtimeEnv.VERCEL_GIT_COMMIT_REF === "phase-5/consolidated-security-ops"
    && runtimeEnv.RAZORPAY_KEY_ID?.startsWith("rzp_test_") === true
    && Boolean(runtimeEnv.RAZORPAY_KEY_SECRET?.trim())
    && Boolean(runtimeEnv.RAZORPAY_WEBHOOK_SECRET?.trim());
}

export function isRazorpayPaymentsAllowed(runtimeEnv: NodeJS.ProcessEnv = process.env): boolean {
  if (runtimeEnv.NODE_ENV !== "production") return true;
  return isRazorpayTestModePreviewEnabled(runtimeEnv);
}


type RazorpayOrderResponse = { id: string; amount: number; currency: string; status: string };

function requiredPaymentEnv(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET" | "RAZORPAY_WEBHOOK_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Payment provider is not configured.");
  return value;
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !orderId || !paymentId || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`, "utf8").digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{ id: string; order_id: string; amount: number; currency: string; status: string }> {
  const keyId = requiredPaymentEnv("RAZORPAY_KEY_ID");
  const keySecret = requiredPaymentEnv("RAZORPAY_KEY_SECRET");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Payment provider verification failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Payment provider returned an invalid payment.");
  const payment = data as Record<string, unknown>;
  if (typeof payment.id !== "string" || typeof payment.order_id !== "string" || typeof payment.amount !== "number" || typeof payment.currency !== "string" || typeof payment.status !== "string") {
    throw new Error("Payment provider returned an unexpected payment.");
  }
  return { id: payment.id, order_id: payment.order_id, amount: payment.amount, currency: payment.currency, status: payment.status };
}

export async function createRazorpayOrder(input: { paymentId: string; amountPaise: number; userId: string }): Promise<RazorpayOrderResponse> {
  const keyId = requiredPaymentEnv("RAZORPAY_KEY_ID");
  const keySecret = requiredPaymentEnv("RAZORPAY_KEY_SECRET");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new Error("Invalid order amount.");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.paymentId,
      notes: { paymentId: input.paymentId, userId: input.userId },
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Payment provider order creation failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Payment provider returned an invalid order.");
  const order = data as Record<string, unknown>;
  if (typeof order.id !== "string" || order.amount !== input.amountPaise || order.currency !== "INR" || order.status !== "created") {
    throw new Error("Payment provider returned an unexpected order.");
  }
  return { id: order.id, amount: order.amount as number, currency: "INR", status: "created" };
}


type RazorpayOrderLookup = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, unknown>;
};

export async function findRazorpayOrderByReceipt(input: {
  paymentId: string;
  amountPaise: number;
  userId: string;
}): Promise<RazorpayOrderResponse | null> {
  const keyId = requiredPaymentEnv("RAZORPAY_KEY_ID");
  const keySecret = requiredPaymentEnv("RAZORPAY_KEY_SECRET");
  const url = new URL("https://api.razorpay.com/v1/orders");
  url.searchParams.set("receipt", input.paymentId);
  url.searchParams.set("count", "100");

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Payment provider order reconciliation failed.");

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) {
    throw new Error("Payment provider returned an invalid order collection.");
  }

  const matches = ((data as { items: unknown[] }).items).filter((item): item is Record<string, unknown> =>
    Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).receipt === input.paymentId
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("Multiple provider orders matched one local payment receipt.");

  const order = matches[0] as unknown as RazorpayOrderLookup;
  if (
    typeof order.id !== "string" ||
    order.receipt !== input.paymentId ||
    order.amount !== input.amountPaise ||
    order.currency !== "INR" ||
    !order.notes ||
    typeof order.notes !== "object" ||
    Array.isArray(order.notes) ||
    order.notes.paymentId !== input.paymentId ||
    order.notes.userId !== input.userId ||
    order.status !== "created" ||
    order.attempts !== 0
  ) {
    throw new Error("Existing provider order does not match a safely recoverable checkout.");
  }

  return { id: order.id, amount: order.amount, currency: order.currency, status: order.status };
}

export async function createOrRecoverRazorpayOrder(input: {
  paymentId: string;
  amountPaise: number;
  userId: string;
}): Promise<RazorpayOrderResponse> {
  const existing = await findRazorpayOrderByReceipt(input);
  if (existing) return existing;

  try {
    return await createRazorpayOrder(input);
  } catch (creationError) {
    // The provider may have accepted the POST even when the response was lost.
    // Reconcile by the unique receipt before deciding that order creation failed.
    const recovered = await findRazorpayOrderByReceipt(input);
    if (recovered) return recovered;
    throw creationError;
  }
}

type WebhookPayload = {
  payment?: { entity?: { id?: unknown; order_id?: unknown; amount?: unknown; currency?: unknown; status?: unknown } };
};

export async function acceptRazorpayWebhook(input: { eventId: string; event: string; payload: WebhookPayload }): Promise<"accepted" | "duplicate"> {
  const entity = input.payload.payment?.entity;
  const orderId = typeof entity?.order_id === "string" ? entity.order_id : null;
  const gatewayPaymentId = typeof entity?.id === "string" ? entity.id : null;

  try {
    await prisma.$transaction(async (tx) => {
      const eventRecord = await tx.paymentWebhookEvent.create({
        data: {
          eventId: input.eventId,
          event: input.event,
          razorpayOrderId: orderId,
          gatewayPaymentId,
          processingStatus: "RECEIVED",
        },
      });

      if (input.event !== "payment.captured" && input.event !== "payment.failed") {
        await tx.paymentWebhookEvent.update({ where: { id: eventRecord.id }, data: { processingStatus: "IGNORED", processedAt: new Date() } });
        return;
      }
      if (!orderId || !gatewayPaymentId) {
        await tx.paymentWebhookEvent.update({ where: { id: eventRecord.id }, data: { processingStatus: "REVIEW", processedAt: new Date() } });
        return;
      }

      const payment = await tx.payment.findUnique({ where: { razorpayOrderId: orderId } });
      if (!payment || payment.currency !== "INR") {
        await tx.paymentWebhookEvent.update({ where: { id: eventRecord.id }, data: { processingStatus: "REVIEW", processedAt: new Date() } });
        return;
      }

      if (input.event === "payment.captured") {
        const amount = entity?.amount;
        if (amount !== Math.round(payment.amount * 100) || entity?.currency !== "INR" || entity?.status !== "captured") {
          await tx.paymentWebhookEvent.update({ where: { id: eventRecord.id }, data: { processingStatus: "REVIEW", processedAt: new Date() } });
          return;
        }

        if (payment.status !== PaymentStatus.PAID) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          if (payment.billingCycle === "YEARLY") endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
          else endDate.setUTCMonth(endDate.getUTCMonth() + 1);

          const subscription = await tx.subscription.create({
            data: {
              userId: payment.userId,
              plan: payment.plan,
              billingCycle: payment.billingCycle,
              status: "ACTIVE",
              startDate,
              endDate,
              price: payment.amount,
              isAutoRenew: false,
            },
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.PAID, transactionId: gatewayPaymentId, subscriptionId: subscription.id },
          });
        }
      } else if (payment.status === PaymentStatus.PENDING) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, transactionId: gatewayPaymentId } });
      }

      await tx.paymentWebhookEvent.update({ where: { id: eventRecord.id }, data: { processingStatus: "PROCESSED", processedAt: new Date() } });
    });
    return "accepted";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
}

export function getRazorpayWebhookSecret(): string {
  return requiredPaymentEnv("RAZORPAY_WEBHOOK_SECRET");
}

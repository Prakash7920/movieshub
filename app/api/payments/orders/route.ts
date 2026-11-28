import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/security/api-session";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { getSubscriptionPrice } from "@/lib/subscriptions/plans";
import { createOrRecoverRazorpayOrder, createRazorpayOrder, isRazorpayPaymentsAllowed } from "@/lib/payments/razorpay";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const requestSchema = z.object({
  plan: z.literal("PREMIUM"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  if (!isRazorpayPaymentsAllowed()) return NextResponse.json({ error: "Payments are not enabled in this environment." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (!(await hasValidJsonContentType(request, 8 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: { "Cache-Control": "no-store" } });

  const session = await getApiSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });

  let createdPaymentId: string | null = null;
  try {
    const limit = await consumeRateLimit("payment-order", userId, 5, 15 * 60);
    if (!limit.allowed) return NextResponse.json({ error: "Too many checkout attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });

    const { billingCycle, idempotencyKey } = parsed.data;
    const amount = getSubscriptionPrice("PREMIUM", billingCycle);
    const existing = await prisma.payment.findUnique({ where: { requestKey: idempotencyKey } });
    if (existing) {
      if (existing.userId !== userId || existing.amount !== amount || existing.plan !== "PREMIUM" || existing.billingCycle !== billingCycle) {
        return NextResponse.json({ error: "Idempotency key was already used for a different checkout." }, { status: 409 });
      }
      if (existing.razorpayOrderId) return NextResponse.json({ paymentId: existing.id, orderId: existing.razorpayOrderId, amount: Math.round(existing.amount * 100), currency: existing.currency, keyId: process.env.RAZORPAY_KEY_ID }, { headers: { "Cache-Control": "no-store" } });

      const recoveredOrder = await createOrRecoverRazorpayOrder({
        paymentId: existing.id,
        amountPaise: Math.round(existing.amount * 100),
        userId,
      });
      if (recoveredOrder.status !== "created") {
        return NextResponse.json({ error: "Existing checkout requires payment reconciliation before retrying." }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }

      await prisma.payment.updateMany({
        where: { id: existing.id, razorpayOrderId: null, status: { in: ["PENDING", "FAILED"] } },
        data: { razorpayOrderId: recoveredOrder.id, status: "PENDING" },
      });
      const linkedPayment = await prisma.payment.findUnique({
        where: { id: existing.id },
        select: { razorpayOrderId: true, status: true },
      });
      if (!linkedPayment || linkedPayment.razorpayOrderId !== recoveredOrder.id || linkedPayment.status !== "PENDING") {
        return NextResponse.json({ error: "Checkout order could not be safely linked. Retry shortly with the same key." }, { status: 409, headers: { "Retry-After": "3", "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ paymentId: existing.id, orderId: recoveredOrder.id, amount: recoveredOrder.amount, currency: recoveredOrder.currency, keyId: process.env.RAZORPAY_KEY_ID }, { headers: { "Cache-Control": "no-store" } });
    }

    const payment = await prisma.payment.create({
      data: { userId, amount, currency: "INR", provider: "razorpay", status: "PENDING", plan: "PREMIUM", billingCycle, requestKey: idempotencyKey },
      select: { id: true, amount: true, currency: true },
    });
    createdPaymentId = payment.id;
    const order = await createRazorpayOrder({ paymentId: payment.id, amountPaise: Math.round(payment.amount * 100), userId });
    await prisma.payment.update({ where: { id: payment.id }, data: { razorpayOrderId: order.id } });
    return NextResponse.json({ paymentId: payment.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Checkout request is already being processed. Retry with the same key." }, { status: 409, headers: { "Retry-After": "3", "Cache-Control": "no-store" } });
    if (createdPaymentId) {
      try { await prisma.payment.update({ where: { id: createdPaymentId }, data: { status: "FAILED" } }); }
      catch (updateError) { logSafeError("Failed to mark incomplete Razorpay order as failed", updateError); }
    }
    logSafeError("Razorpay order creation failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

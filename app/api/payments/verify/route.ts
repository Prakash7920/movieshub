import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { hasValidJsonContentType, isSameOriginRequest } from "@/lib/security/request-guards";
import { acceptRazorpayWebhook, fetchRazorpayPayment, isRazorpayPaymentsAllowed, verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const callbackSchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export async function POST(request: Request) {
  if (!isRazorpayPaymentsAllowed()) return NextResponse.json({ error: "Payments are not enabled in this environment." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (!(await hasValidJsonContentType(request, 8 * 1024))) return NextResponse.json({ error: "A valid JSON request is required." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment verification details." }, { status: 400 });

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
  const localPayment = await prisma.payment.findFirst({ where: { razorpayOrderId: orderId, userId }, select: { id: true, amount: true, currency: true } });
  if (!localPayment) return NextResponse.json({ error: "Payment order not found." }, { status: 404 });

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret)) {
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const gatewayPayment = await fetchRazorpayPayment(paymentId);
    if (gatewayPayment.order_id !== orderId || gatewayPayment.amount !== Math.round(localPayment.amount * 100) || gatewayPayment.currency !== localPayment.currency || gatewayPayment.status !== "captured") {
      return NextResponse.json({ error: "Payment is not captured or does not match the order." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const result = await acceptRazorpayWebhook({
      eventId: `callback:${paymentId}`,
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: gatewayPayment.amount, currency: gatewayPayment.currency, status: "captured" } } },
    });
    return NextResponse.json({ verified: true, duplicate: result === "duplicate" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logSafeError("Razorpay checkout callback verification failed", error);
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { acceptRazorpayWebhook, getRazorpayWebhookSecret, verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { logSafeError } from "@/lib/security/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return NextResponse.json({ error: "JSON required." }, { status: 415, headers: { "Cache-Control": "no-store" } });

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.byteLength === 0 || rawBody.byteLength > 1024 * 1024) return NextResponse.json({ error: "Invalid webhook body size." }, { status: 413, headers: { "Cache-Control": "no-store" } });

  let secret: string;
  try { secret = getRazorpayWebhookSecret(); }
  catch { return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }

  if (!verifyRazorpayWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const eventId = request.headers.get("x-razorpay-event-id")?.trim();
  if (!eventId || eventId.length > 255 || !/^[A-Za-z0-9_.:-]+$/.test(eventId)) {
    return NextResponse.json({ error: "Invalid webhook event identifier." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody.toString("utf8")); }
  catch { return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }

  if (!payload || typeof payload !== "object" || typeof (payload as { event?: unknown }).event !== "string") {
    return NextResponse.json({ error: "Invalid webhook event." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const eventPayload = (payload as { payload?: unknown }).payload;
  if (!eventPayload || typeof eventPayload !== "object" || !("payment" in eventPayload)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await acceptRazorpayWebhook({
      eventId,
      event: (payload as { event: string }).event,
      payload: eventPayload as Parameters<typeof acceptRazorpayWebhook>[0]["payload"],
    });
    return NextResponse.json({ received: true, duplicate: result === "duplicate" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logSafeError("Razorpay webhook persistence failed", error);
    return NextResponse.json({ error: "Webhook could not be durably accepted." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

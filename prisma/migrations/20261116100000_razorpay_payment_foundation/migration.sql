ALTER TABLE "Payment"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "razorpayOrderId" TEXT,
  ADD COLUMN "plan" "PlanType" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';

CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "razorpayOrderId" TEXT,
  "gatewayPaymentId" TEXT,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");
CREATE INDEX "PaymentWebhookEvent_razorpayOrderId_receivedAt_idx" ON "PaymentWebhookEvent"("razorpayOrderId", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_processingStatus_receivedAt_idx" ON "PaymentWebhookEvent"("processingStatus", "receivedAt");

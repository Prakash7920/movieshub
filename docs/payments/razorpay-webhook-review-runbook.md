# NexaFilm — Razorpay Webhook REVIEW Operations Runbook

**Status:** Operational procedure draft; not evidence of Razorpay Test-mode validation or Production readiness  
**Roadmap item:** Phase 5 release gate — webhook REVIEW reconciliation and recovery  
**Change boundary:** Documentation only. No database, payment-provider account, credential, deployment, or customer payment is accessed or changed.

## 1. Purpose and safety boundary

This runbook explains how an authorized payments operator should investigate a `PaymentWebhookEvent` whose `processingStatus` is `REVIEW`.

A `REVIEW` receipt means the webhook was authenticated and durably received, but the application deliberately did not grant Premium access because it could not establish that the event matched a valid local payment. It is **not** proof that the customer paid, and it is **not** a failed-payment determination.

The current application has no dedicated admin endpoint or automated workflow that resolves a `REVIEW` receipt. This runbook is an investigation and escalation procedure, not permission to edit payment records. Do not directly update `Payment`, `PaymentWebhookEvent`, or `Subscription` rows; do not manually grant Premium; do not mark a receipt `PROCESSED`; and do not replay an event with a fabricated event ID.

Production payment activity remains out of scope until the separate provider, monitoring, and release approvals are completed.

## 2. What the current implementation does

The webhook route at `app/api/webhooks/razorpay/route.ts`:

1. Accepts JSON only and reads the original raw request bytes.
2. Rejects an empty body or a body larger than 1 MiB.
3. Verifies `x-razorpay-signature` against the raw bytes using `RAZORPAY_WEBHOOK_SECRET`.
4. Validates `x-razorpay-event-id` (non-empty, at most 255 characters, restricted character set) and the expected event/payload structure.
5. Calls `acceptRazorpayWebhook` to persist and process the event.

The handler in `lib/payments/razorpay.ts` creates a `PaymentWebhookEvent` receipt with `processingStatus = RECEIVED` inside a database transaction. It then applies these outcomes:

| Condition | Receipt result | Payment / subscription effect |
|---|---|---|
| Event is not `payment.captured` or `payment.failed` | `IGNORED` | No payment or subscription change |
| Supported event is missing order ID or payment ID | `REVIEW` | No payment or subscription change |
| No local payment matches the order, or local currency is not INR | `REVIEW` | No payment or subscription change |
| Captured amount, currency, or status does not match the local order | `REVIEW` | No payment or subscription change |
| Valid captured event matches the local order | `PROCESSED` | Payment becomes `PAID` and one subscription is created unless the payment is already `PAID` |
| `payment.failed` event includes order ID and payment ID, and the order resolves to a local INR payment | `PROCESSED` | If the local payment is `PENDING`, it becomes `FAILED`; otherwise payment and subscription state remain unchanged. The current handler does **not** compare the event amount, currency, or `entity.status` with the local order on this path |
| Duplicate event ID violates the unique constraint | Existing receipt remains unchanged; route reports duplicate | No second processing or subscription grant |
| Durable persistence fails | No success acknowledgement; route returns HTTP 503 | Event was not confirmed as durably accepted |

The `REVIEW` branches set `processedAt`, but do not alter the payment or create a subscription. The webhook handler does not independently query Razorpay for the payment; it evaluates the authenticated event payload against the local order.

**Failed-event validation limitation:** for `payment.failed`, the current handler requires an order ID and payment ID, resolves the order to a local INR payment, and marks a pending payment as failed. It does not independently compare the payload amount, currency, or `entity.status`, and it does not fetch the payment from Razorpay on this webhook path. A `PROCESSED` receipt therefore means the handler completed its current processing logic; it is not a separate provider-side verification. Verify provider records before making customer-impacting decisions.

Invalid signatures and malformed requests are rejected before a durable event receipt is created.

## 3. Initial triage

Only an operator with approved, least-privilege access may investigate payment records or the Razorpay merchant dashboard.

For each `REVIEW` receipt, record in the approved incident/ticket system:

- Receipt event ID and event type.
- Receipt time.
- Razorpay order ID and payment ID, if present.
- Local payment status, amount, currency, plan, and billing cycle, if a matching payment exists.
- Exact reason for review, based on the matching fields.
- Razorpay dashboard evidence and the operator/ticket reference.
- Decision, approver, and follow-up owner.

Do not put API secrets, webhook secrets, signatures, private environment values, customer credentials, or unnecessary personal data in the ticket.

### Read-only receipt inventory

If an approved read-only database session is available, an operator may use the following query to list review receipts and matching local payment details. It is an inspection query only; it does not resolve or modify anything.

```sql
SELECT
  e."eventId",
  e."event",
  e."razorpayOrderId",
  e."gatewayPaymentId",
  e."receivedAt",
  p."id" AS "paymentId",
  p."status" AS "paymentStatus",
  p."amount",
  p."currency",
  p."plan",
  p."billingCycle"
FROM "PaymentWebhookEvent" AS e
LEFT JOIN "Payment" AS p
  ON p."razorpayOrderId" = e."razorpayOrderId"
WHERE e."processingStatus" = 'REVIEW'
ORDER BY e."receivedAt" ASC;
```

Use only the approved environment and read-only credentials. Do not run this query against Production unless the responsible owner has separately approved that read access. Never paste connection URLs or credentials into chat or tickets.

## 4. Verify the gateway facts

Using the authorized Razorpay merchant dashboard or an approved provider API client, independently establish:

- Whether the payment ID exists.
- Whether it belongs to the recorded order ID.
- Whether provider status is `captured` (not merely created, authorized, failed, or pending).
- Whether its amount, expressed in paise, exactly matches the local payment amount multiplied by 100.
- Whether its currency matches the local payment currency (the current order flow expects INR).
- Whether event ID, payment ID, order ID, and timestamps align with the provider delivery record.

Do not infer capture from a successful checkout redirect, a customer screenshot, a webhook HTTP 200 alone, or an order-created response. Retain the provider's delivery/payment reference in the ticket.

### Common REVIEW reasons

- **Missing order/payment ID:** the payload cannot be associated safely with a local order. Escalate to the payments owner and compare the provider delivery record with order history.
- **No local order / unknown order ID:** investigate whether order creation or local persistence was interrupted. Do not create a replacement payment or subscription merely to clear the receipt.
- **Amount/currency/status mismatch:** do not grant access. Confirm paise-versus-rupee conversion, order association, and provider capture state with the payments owner.
- **Provider reports no captured payment:** keep entitlement ungranted and follow the normal customer support/payment-failure process.
- **Provider reports a captured payment but local state is pending or failed:** preserve the evidence and proceed only through the supported authenticated callback path below, when its exact requirements are met. Otherwise escalate; do not repair rows manually.

## 5. Supported customer callback path

The current `POST /api/payments/verify` route is not an admin recovery endpoint. It is an authenticated, same-origin customer checkout callback. It requires:

- A logged-in user.
- An order ID belonging to that user.
- The Razorpay payment ID.
- The Razorpay checkout signature.

The server verifies the callback signature, fetches the payment from Razorpay using configured server-side credentials, and checks provider order ID, amount, currency, and `captured` status before invoking the common payment acceptance logic.

When a customer can complete this genuine callback flow, it may independently process the valid captured payment. It creates a separate synthetic receipt ID in the form `callback:<paymentId>`; it does **not** update or close the original webhook receipt in `REVIEW`.

Therefore:

- A successful customer callback may reconcile the **payment entitlement** while the original webhook receipt remains `REVIEW`.
- The original receipt must remain visible as an operational exception until a separately reviewed receipt-closure mechanism exists.
- Do not ask a customer to disclose their signature, secrets, or account credentials to support staff.
- Do not impersonate the customer or fabricate callback details.

If the customer cannot complete the supported callback, or the callback returns an error, stop and escalate to the payments owner. The current code does not provide an operator-controlled reprocess or REVIEW-resolution API.

## 6. Resolution and escalation rules

An operator may close the external incident/ticket only when the payment owner has recorded a provider-backed decision and the customer entitlement state has been independently confirmed through approved application evidence.

Possible outcomes:

1. **Confirmed captured payment; supported callback completed:** record verified payment/subscription evidence. Keep the original `REVIEW` receipt as-is; note that the original receipt remains unresolved at the data level.
2. **Confirmed not captured / failed / cancelled:** keep Premium ungranted and follow the existing customer support/refund policy. Do not change the review receipt manually.
3. **Provider/local mismatch or ambiguous evidence:** leave entitlement unchanged, retain the receipt, and escalate to the payments owner/provider support.
4. **Suspected duplicate, fraud, signature, or account compromise:** preserve evidence and invoke the security/incident response process.

A durable data-level resolution for the original `REVIEW` receipt requires a separately designed, access-controlled, audited recovery mechanism with tests for authorization, provider verification, idempotency, payment/subscription transactionality, and receipt linkage. That mechanism is not implemented by this runbook.

## 7. Monitoring and release gate

The current implementation records receipt status but this code does not include an operational alerting/dashboard workflow for `REVIEW` receipts. Until that is implemented and tested, an operator must not assume that review cases will be proactively surfaced.

Before enabling real payments or treating this gate as passed, require:

- Razorpay Test-mode credentials configured through the approved secret-management process.
- Provider-hosted test checkout and webhook delivery exercised end-to-end.
- Verified tests for each `REVIEW` condition and the customer callback recovery path.
- An owner-approved alert/queue for new and aging `REVIEW` receipts, with escalation ownership and response targets.
- A separately reviewed and tested data-level receipt-resolution design, or an explicit documented decision to retain original review receipts as immutable exception evidence.
- Evidence that duplicate events cannot create duplicate subscriptions and mismatches never grant Premium.

**This runbook is a documentation deliverable only. It does not pass the Razorpay operational release gate, enable checkout, configure credentials, authorize Production use, or imply that a REVIEW receipt has been resolved.**

## 8. Implementation references

- Webhook intake: `app/api/webhooks/razorpay/route.ts`
- Receipt and payment processing: `lib/payments/razorpay.ts`
- Authenticated customer callback: `app/api/payments/verify/route.ts`
- Receipt and payment schema: `prisma/schema.prisma`
- Integration coverage: `tests/razorpay-webhook.integration.test.ts`

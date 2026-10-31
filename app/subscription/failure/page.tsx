import { PaymentFailureState } from "@/components/subscription/subscription-card";

export default function SubscriptionFailurePage() {
  return <PaymentFailureState reason="Your payment method was declined. Please update your details and try again." />;
}

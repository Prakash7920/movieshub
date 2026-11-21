import SubscriptionCheckout from "./subscription-checkout";
import { isRazorpayTestModePreviewEnabled } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

export default function SubscriptionPage() {
  const previewTestModeEnabled = isRazorpayTestModePreviewEnabled();
  return <SubscriptionCheckout previewTestModeEnabled={previewTestModeEnabled} />;
}

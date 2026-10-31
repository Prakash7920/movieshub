export type PaymentProvider = {
  createCheckoutSession: (payload: { plan: "FREE" | "PREMIUM"; billingCycle: "MONTHLY" | "YEARLY"; amount: number; userId?: string }) => Promise<{ success: boolean; paymentId?: string; message?: string }>;
};

export const mockPaymentProvider: PaymentProvider = {
  async createCheckoutSession({ plan, billingCycle, amount }) {
    const isValidAmount = typeof amount === "number" && amount >= 0;

    if (!isValidAmount) {
      return { success: false, message: "Invalid payment data." };
    }

    return {
      success: true,
      paymentId: `pay_mock_${plan.toLowerCase()}_${billingCycle.toLowerCase()}`,
      message: `${plan} plan checkout initialized successfully.`,
    };
  },
};

export const getPlanPrice = (plan: "FREE" | "PREMIUM", billingCycle: "MONTHLY" | "YEARLY") => {
  if (plan === "FREE") return 0;
  return billingCycle === "YEARLY" ? 2399 : 299;
};

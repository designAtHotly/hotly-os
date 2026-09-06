import { createCoffeeCheckoutSession } from "@/lib/api/creator";
import { ApiError } from "@/lib/api/impl/base";
import type { CoffeeCreator, CoffeeTier, ChargeAmount } from "@/types/coffee.types";

interface CreateCheckoutParams {
  creator: CoffeeCreator;
  selectedTier: CoffeeTier;
  message: string;
  chargeAmount: ChargeAmount;
  isRecurring: boolean;
  email?: string;
}

interface CheckoutResult {
  url: string;
}

export async function createCheckout({
  message,
  isRecurring,
  email,
}: CreateCheckoutParams): Promise<CheckoutResult> {
  try {
    const { body } = await createCoffeeCheckoutSession({
      message: message.trim(),
      recurring: isRecurring,
      email: email || undefined,
    });

    if (!body?.url) {
      throw new Error("No checkout URL returned");
    }

    return { url: body.url };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      throw new ApiError({
        status: 503,
        statusText: "Payments are not configured on this instance.",
        url: err.url,
        method: err.method,
        body: err.response,
      });
    }
    throw err;
  }
}

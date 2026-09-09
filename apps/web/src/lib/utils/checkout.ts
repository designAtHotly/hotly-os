import { createCoffeeCheckoutSession } from "@/lib/api/creator";
import { ApiError } from "@/lib/api/impl/base";
import type {
  CoffeeCreator,
  CoffeeTier,
  ChargeAmount,
} from "@/types/coffee.types";

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
  selectedTier,
  message,
  chargeAmount,
  isRecurring,
  email,
}: CreateCheckoutParams): Promise<CheckoutResult> {
  try {
    const { body } = await createCoffeeCheckoutSession({
      custom_amount_cents: selectedTier.is_custom
        ? chargeAmount.price_in_cents
        : undefined,
      email: email || undefined,
      message: message.trim(),
      recurring: isRecurring,
      tier: selectedTier.key,
    });

    if (!body?.url) {
      throw new Error("No checkout URL returned");
    }

    return { url: body.url };
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      throw new ApiError({
        status: 503,
        statusText: "Payments are not configured on this instance.",
        url: error.url,
        method: error.method,
        body: error.response,
      });
    }
    throw error;
  }
}

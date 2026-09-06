import type { CoffeeCreator, CreatorPricing } from "@/types/coffee.types";

import { appMediaUrl } from "@/lib/media/url";
import { fetchPenpalOffer } from "@/lib/penpal/offer";

export async function loadPenpalCreator(): Promise<{
  creator: CoffeeCreator;
  pricing: CreatorPricing;
  stripeConfigured: boolean;
}> {
  const offer = await fetchPenpalOffer();
  return {
    creator: {
      id: 1,
      uuid: "creator",
      user_id: offer.creator_user_id || 0,
      name: offer.display_name,
      username: "creator",
      bio: offer.description || undefined,
      avatar_url: appMediaUrl(offer.avatar_url),
      variant: "penpal",
      support_theme: offer.support_item,
    },
    pricing: {
      currencyCode: "usd",
      price_250: offer.one_time_price_cents,
      price_500: offer.one_time_price_cents,
      price_1000: offer.one_time_price_cents,
      character_limit: offer.one_time_character_limit,
      weekly_price_cents: offer.weekly_price_cents,
      weekly_allowance_chars: offer.weekly_allowance_chars,
    },
    stripeConfigured: offer.stripe_configured,
  };
}

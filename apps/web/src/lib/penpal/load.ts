import { appMediaUrl } from "@/lib/media/url";
import { fetchPenpalOffer } from "@/lib/penpal/offer";
import type { CoffeeCreator, CreatorPricing } from "@/types/coffee.types";

export async function loadPenpalCreator(): Promise<{
  creator: CoffeeCreator;
  pricing: CreatorPricing;
  stripeConfigured: boolean;
}> {
  const offer = await fetchPenpalOffer();
  return {
    creator: {
      avatar_url: appMediaUrl(offer.avatar_url),
      bio: offer.description || undefined,
      id: 1,
      name: offer.display_name,
      support_theme: offer.support_item,
      user_id: offer.creator_user_id || 0,
      username: "creator",
      uuid: "creator",
      variant: "penpal",
    },
    pricing: {
      character_limit: 250,
      currencyCode: "usd",
      price_1000: offer.price_1000_cents,
      price_250: offer.price_250_cents || offer.one_time_price_cents,
      price_500: offer.price_500_cents,
      weekly_allowance_chars: offer.weekly_allowance_chars,
      weekly_price_cents: offer.weekly_price_cents,
    },
    stripeConfigured: offer.stripe_configured,
  };
}

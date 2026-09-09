export type SupportItem = "coffee" | "cocktail" | "lemonade";

export interface PenpalOffer {
  display_name: string;
  description: string;
  support_item: SupportItem;
  one_time_price_cents: number;
  one_time_character_limit: number;
  price_250_cents: number;
  price_500_cents: number;
  price_1000_cents: number;
  weekly_price_cents: number;
  weekly_allowance_chars: number;
  currency: "usd";
  stripe_configured: boolean;
  creator_user_id?: number;
  avatar_url?: string;
}

export async function fetchPenpalOffer(): Promise<PenpalOffer> {
  const res = await fetch("/api/penpal", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("penpal_offer_failed");
  }
  return (await res.json()) as PenpalOffer;
}

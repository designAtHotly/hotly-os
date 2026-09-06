import { BrandVariant } from "@/lib/utils/variant";

export interface CoffeeTier {
  id: number;
  name: string;
  price_in_cents: number; // in cents (price * 100)
  char_limit: number; // undefined = no limit
  is_custom?: boolean; // true if this is the "Custom" tier where users can enter their own amount
}


export interface CreatorPricing {
  price_250: number
  price_500: number
  price_1000: number
  currencyCode: string;
  character_limit?: number;
  weekly_price_cents?: number;
  weekly_allowance_chars?: number;
}

export const DEFAULT_PRICING: CreatorPricing = {
  currencyCode: "usd",
  price_250: 500,
  price_500: 1000,
  price_1000: 1500,
}

export const getMinCustomAmount = (pricing: CreatorPricing): number => {
  if (pricing.currencyCode == "ngn") {
    return pricing.price_1000 + (1000 * 100)
  }
  return pricing.price_1000 + 100
};

export interface ChargeAmount {
  price_in_cents: number;
  currency_code: string;
  usd_equivalent?: number;
}

/** Resolves the actual amount and currency to send to Stripe (converts NGN → USD if needed) */
export function getStripeCharge(charge: ChargeAmount): { amount: number; currency_code: string } {
  return {
    amount: charge.usd_equivalent ?? charge.price_in_cents,
    currency_code: charge.usd_equivalent != null ? "usd" : charge.currency_code,
  };
}

export function getChargeAmount(
  pricing: CreatorPricing,
  selectedTier: CoffeeTier,
  customAmountCents?: number,
): ChargeAmount {
  const price_in_cents = selectedTier.is_custom
    ? customAmountCents || 0
    : selectedTier.price_in_cents;

  const result: ChargeAmount = {
    price_in_cents,
    currency_code: pricing.currencyCode,
  };

  // Calculate USD equivalent for NGN currency
  if (pricing.currencyCode.toLowerCase() === "ngn") {
    if (!selectedTier.is_custom) {
      // to make sure if its not custom then user dont see decimal
      result.usd_equivalent = Math.round(ngnToUsd(price_in_cents) / 100) * 100;
    } else {
      result.usd_equivalent = Math.round(ngnToUsd(price_in_cents));

    }
  }

  return result;
}

export const getPricingTiers = (tip: SupportTheme, pricing: CreatorPricing): CoffeeTier[] => {
  const productNames: Record<SupportTheme, string> = {
    coffee: "Coffee",
    cocktail: "Cocktail",
    lemonade: "Lemonade",
  };
  return [
    {
      id: 1,
      name: productNames[tip] || "Coffee",
      price_in_cents: pricing.price_250,
      char_limit: pricing.character_limit || 250,
    },
  ];
};



export const MIN_COFFEE_AMOUNT = 100; // minimum $1 (in cents)

export type SupportTheme = "coffee" | "cocktail" | "lemonade";

export interface CoffeeCreator {
  id: number;
  uuid: string;
  user_id: number;
  name: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  variant?: BrandVariant;
  support_theme: SupportTheme;
  response_day?: string;
  supporterCount?: number;
}

// NGN to USD conversion rate
export const NGN_TO_USD_RATE = 1420;

// Convert NGN to USD
export function ngnToUsd(ngnAmountInCents: number): number {
  return Math.round(ngnAmountInCents / NGN_TO_USD_RATE)
}



export function capitalize(str?: string): string {
  if (!str || str.length === 0) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Get emoji based on support_theme
export function getThemeEmoji(support_theme?: SupportTheme): string {
  switch (support_theme) {
    case "cocktail":
      return "🍹";
    case "lemonade":
      return "🧃";
    case "coffee":
    default:
      return "☕";
  }
}

// Get label based on support_theme (e.g., "Coffee", "Cocktail")
export function getThemeLabel(support_theme?: SupportTheme): string {
  switch (support_theme) {
    case "cocktail":
      return "Cocktail";
    case "lemonade":
      return "Lemonade";
    case "coffee":
    default:
      return "Coffee";
  }
}

// Supported currencies (Stripe-supported)
export const CURRENCIES = [
  { code: "usd", label: "US Dollar (USD)", symbol: "$" },
  { code: "aed", label: "UAE Dirham (AED)", symbol: "د.إ" },
  { code: "ars", label: "Argentine Peso (ARS)", symbol: "AR$" },
  { code: "aud", label: "Australian Dollar (AUD)", symbol: "A$" },
  { code: "bgn", label: "Bulgarian Lev (BGN)", symbol: "лв" },
  { code: "brl", label: "Brazilian Real (BRL)", symbol: "R$" },
  { code: "cad", label: "Canadian Dollar (CAD)", symbol: "CA$" },
  { code: "chf", label: "Swiss Franc (CHF)", symbol: "CHF" },
  { code: "clp", label: "Chilean Peso (CLP)", symbol: "CL$" },
  { code: "cny", label: "Chinese Yuan (CNY)", symbol: "¥" },
  { code: "cop", label: "Colombian Peso (COP)", symbol: "CO$" },
  { code: "czk", label: "Czech Koruna (CZK)", symbol: "Kč" },
  { code: "dkk", label: "Danish Krone (DKK)", symbol: "kr" },
  { code: "egp", label: "Egyptian Pound (EGP)", symbol: "E£" },
  { code: "eur", label: "Euro (EUR)", symbol: "€" },
  { code: "gbp", label: "British Pound (GBP)", symbol: "£" },
  { code: "ghs", label: "Ghanaian Cedi (GHS)", symbol: "₵" },
  { code: "hkd", label: "Hong Kong Dollar (HKD)", symbol: "HK$" },
  { code: "huf", label: "Hungarian Forint (HUF)", symbol: "Ft" },
  { code: "idr", label: "Indonesian Rupiah (IDR)", symbol: "Rp" },
  { code: "inr", label: "Indian Rupee (INR)", symbol: "₹" },
  { code: "jpy", label: "Japanese Yen (JPY)", symbol: "¥" },
  { code: "kes", label: "Kenyan Shilling (KES)", symbol: "KSh" },
  { code: "krw", label: "South Korean Won (KRW)", symbol: "₩" },
  { code: "mxn", label: "Mexican Peso (MXN)", symbol: "MX$" },
  { code: "myr", label: "Malaysian Ringgit (MYR)", symbol: "RM" },
  { code: "ngn", label: "Nigerian Naira (NGN)", symbol: "₦" },
  { code: "nok", label: "Norwegian Krone (NOK)", symbol: "kr" },
  { code: "nzd", label: "New Zealand Dollar (NZD)", symbol: "NZ$" },
  { code: "pen", label: "Peruvian Sol (PEN)", symbol: "S/." },
  { code: "php", label: "Philippine Peso (PHP)", symbol: "₱" },
  { code: "pln", label: "Polish Zloty (PLN)", symbol: "zł" },
  { code: "ron", label: "Romanian Leu (RON)", symbol: "lei" },
  { code: "sar", label: "Saudi Riyal (SAR)", symbol: "﷼" },
  { code: "sek", label: "Swedish Krona (SEK)", symbol: "kr" },
  { code: "sgd", label: "Singapore Dollar (SGD)", symbol: "S$" },
  { code: "thb", label: "Thai Baht (THB)", symbol: "฿" },
  { code: "try", label: "Turkish Lira (TRY)", symbol: "₺" },
  { code: "zar", label: "South African Rand (ZAR)", symbol: "R" },
];

// Get currency symbol from currency code
export function getCurrencySymbol(currencyCode?: string): string {
  return CURRENCIES.find((c) => c.code === currencyCode?.toLowerCase())?.symbol ?? "$";
}

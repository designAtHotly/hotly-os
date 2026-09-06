import React from "react";
import { ChargeAmount } from "@/types/coffee.types";

/**
 * How much a fan may write to a creator per billing period.
 *
 * Deliberately counts every letter in the period, however it was paid for —
 * a one-off letter costs the creator the same reading time as a subscription
 * one, and reading time is what this protects. In practice the distinction
 * almost never arises: the window opens when a subscription starts, so letters
 * bought before subscribing fall outside it.
 *
 * Mirrors WeeklyMessageCharBudget in hotly_backend/pkg/creator/router.go — the
 * server is the one that enforces it, so this value must stay in step. That
 * duplication is deliberate but load-bearing: the two counts must follow
 * identical rules, so change them together or move counting to the server.
 */
export const WEEKLY_MESSAGE_CHAR_BUDGET = 2000;

/** Where the quiet counter starts showing: 75% of the way to the warning. */
export const BUDGET_COUNTER_AT = 1125;

/** Where the warning replaces the counter, leaving 500 of the budget. */
export const BUDGET_WARNING_AT = 1500;

/** Mirrors WeeklyBudgetMaxWindow in the Go constant block. */
const WEEKLY_BUDGET_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface CountableMessage {
  sender_type: "fan" | "artist";
  content: string;
  created_at: string;
}

/**
 * Start of the budget window: the billing period, clamped to a rolling week.
 *
 * The clamp matters — if a renewal webhook is missed, current_period_start goes
 * stale and an unclamped window would keep widening, counting old letters and
 * locking the fan out early. Must match the Go side exactly, or the number shown
 * here disagrees with the one the server enforces.
 */
export function budgetWindowStart(currentPeriodStart: string | null): Date {
  const rolling = new Date(Date.now() - WEEKLY_BUDGET_MAX_WINDOW_MS);
  if (!currentPeriodStart) return rolling;
  const periodStart = new Date(currentPeriodStart);
  if (Number.isNaN(periodStart.getTime())) return rolling;
  return periodStart > rolling ? periodStart : rolling;
}

/**
 * Characters the fan has written since the window opened. Counted client-side
 * from the messages already loaded — the chat returns full history, so no extra
 * request is needed. The server still decides; this only drives what's shown.
 */
export function countCharsUsedSince(messages: CountableMessage[], windowStart: Date): number {
  return messages.reduce((total, message) => {
    if (message.sender_type !== "fan") return total;
    const sentAt = new Date(message.created_at);
    if (Number.isNaN(sentAt.getTime()) || sentAt < windowStart) return total;
    return total + countMessageChars(message.content);
  }, 0);
}

/**
 * When the budget refills.
 *
 * Uses the billing period end, but only while it is still ahead of us. A missed
 * renewal webhook leaves current_period_end in the past, and showing a fan a
 * reset date that has already been and gone reads as broken. Falls back to a
 * week from the window start, which the clamp guarantees is never stale.
 */
export function budgetResetAt(currentPeriodEnd: string | null, windowStart: Date): Date {
  const fallback = new Date(windowStart.getTime() + WEEKLY_BUDGET_MAX_WINDOW_MS);
  if (!currentPeriodEnd) return fallback;
  const periodEnd = new Date(currentPeriodEnd);
  if (Number.isNaN(periodEnd.getTime()) || periodEnd.getTime() <= Date.now()) return fallback;
  return periodEnd;
}

/** The day the budget refills, phrased for the fan: "Friday, 29 August". */
export function formatBudgetReset(resetsAt: Date): string {
  return resetsAt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Count a message the same way the backend does, so the counter shown to a fan
 * never disagrees with the limit the server enforces. Plain String.length would
 * count an emoji as two and reject letters the server would have accepted.
 */
export function countMessageChars(text: string): number {
  return [...text].length;
}

/**
 * Extract first name from full name
 */
export function getFirstName(name: string): string {
  return name.split(" ")[0] || name;
}

/**
 * Format tier name for display
 */
export function formatTierLabel(tierName: string | null): string | null {
  if (!tierName) return null;
  return tierName.charAt(0).toUpperCase() + tierName.slice(1).replace("_", " ");
}

/**
 * Get tier label from tier name
 */
export function getTierLabel(tierName: string | null): string | null {
  if (!tierName) return null;
  return tierName;
}

/**
 * Format currency amount for display
 * @param amountInCents - Amount in cents (e.g., 500 for $5.00)
 * @param currencyCode - ISO 4217 currency code (e.g., "usd", "eur", "gbp", "ngn")
 * @returns Formatted currency string (e.g., "$5", "€10", "£15", "₦5,000")
 */
export function beautifyAmount(amountInCents: number, currencyCode: string = "usd"): string {
  const code = (currencyCode || "usd").toUpperCase();
  try {
    const amount = amountInCents / 100;
    const useCompact = (amount >= 1000 && amount % 1000 === 0) || (amount >= 1000000 && amount % 1000000 === 0);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      notation: useCompact ? "compact" : "standard",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (err) {
    // Fallback for unsupported currency codes
    return `${code}${amountInCents / 100}`;
  }
}

/**
 * Format relative time from date string
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

/**
 * Heart icon component for Penpal badges
 */
export function HeartIcon({ className = "w-3 h-3" }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

/**
 * Format charge amount for display with USD equivalent if applicable
 * @param charge - ChargeAmount object with price_in_cents, currency_code, and optional usd_equivalent
 * @param isSubscription - Whether this is a subscription (adds "/wk" suffix)
 * @param variant - Optional variant label like "Penpal" or "VIP Fan" (adds "Become a {variant} · " prefix)
 * @returns Formatted string like "$15", "₦5,000 (~$3.52)/wk", or "Enter Velvet Rope experience · $15/wk"
 */
export function formatChargeDisplay(charge: ChargeAmount, isSubscription: boolean = false, recurringLabel?: string): string {
  const displayAmount = beautifyAmount(charge.price_in_cents, charge.currency_code);
  const suffix = isSubscription ? "/wk" : "";
  const prefix = recurringLabel ? `${recurringLabel} · ` : "";

  if (charge.usd_equivalent != null) {
    const usdAmount = beautifyAmount(charge.usd_equivalent, "usd");
    return `${prefix}${displayAmount} (~${usdAmount}${suffix})`;
  }

  return `${prefix}${displayAmount}${suffix}`;
}

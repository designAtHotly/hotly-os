"use client";

/**
 * SUBSCRIPTION BANNER — Cozy Capsule Design
 *
 * Mental model: This is a gentle note about your relationship status,
 * not a system notification. It lives inside the warm world of the chat,
 * using the same visual language as everything else.
 *
 * Key design decisions:
 * 1. Nested capsule containment (outer wrapper → inner content)
 * 2. Warm cream backgrounds, never flat system colors
 * 3. Soft shadows instead of hard borders
 * 4. Subtle dashed border for "note" feeling
 * 5. Accent color adapts to brand variant
 */

import { BrandVariant, DEFAULT_VARIANT, getVariantColorTheme } from "@/lib/utils/variant";

interface SubscriptionBannerProps {
  artistName: string;
  onResubscribe?: () => void;
  isLoading?: boolean;
  variant?: BrandVariant;
}

export default function SubscriptionBanner({
  artistName,
  onResubscribe,
  isLoading,
  variant = DEFAULT_VARIANT,
}: SubscriptionBannerProps) {
  const colorTheme = getVariantColorTheme(variant);

  // Cancelled state - warm neutral, not cold gray
  return (
    <div className="flex-shrink-0 px-4 py-3">
      {/* Outer capsule - warmer tone than pure gray */}
      <div
        className="
          rounded-2xl
          bg-gradient-to-b from-stone-100/80 to-stone-50
          border border-stone-200/60
          shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.8)]
          p-3
        "
      >
        <div className="flex items-center gap-3">
          {/* Icon - muted but still warm */}
          <div
            className="
              w-10 h-10 rounded-xl
              bg-gradient-to-br from-stone-300 to-stone-400
              flex items-center justify-center
              shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.2)]
            "
          >
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-700">
              Subscription ended
            </p>
            <p className="text-xs text-stone-500">
              Resubscribe for unlimited messages with {artistName}
            </p>
          </div>

          <button
            onClick={onResubscribe}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-out"
            style={{
              background: colorTheme.ctaGradient,
              boxShadow: colorTheme.ctaShadow
            }}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </span>
            ) : (
              "Resubscribe"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Inter } from "next/font/google";
import CustomButton from "@/components/ui/custom-button";
import CoffeeSuccessPage from "./CoffeeSuccessPage";
import CoffeeTierSelector from "./CoffeeTierSelector";
import { captureError } from "@/lib/utils/error-handler";
import { ApiError } from "@/lib/api/impl/base";
import { createCheckout } from "@/lib/utils/checkout";
import { useAuth } from "@/hooks/useAuth";
import {
  CoffeeCreator,
  CoffeeTier,
  MIN_COFFEE_AMOUNT,
  getThemeEmoji,
  CreatorPricing,
  getPricingTiers,
  getChargeAmount,
  getMinCustomAmount,
  getStripeCharge,
} from "@/types/coffee.types";
import { beautifyAmount, formatChargeDisplay, WEEKLY_MESSAGE_CHAR_BUDGET } from "@/lib/utils/chat";
import { BrandVariant, DEFAULT_SUPPORT_THEME, DEFAULT_VARIANT, getRecurringLabel, getVariantColorTheme } from "@/lib/utils/variant";
import { getDomePage } from "@/lib/utils/page-helper";
import CrossNavPill from "@/components/ui/CrossNavPill";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

interface CoffeePageImplProps {
  creator: CoffeeCreator;
  noteDescription?: string;
  pricing: CreatorPricing;
  variantOverride?: BrandVariant;
  hasCommunity?: boolean;
  stripeConfigured?: boolean;
}

export default function CoffeePageImpl({
  creator,
  noteDescription,
  pricing,
  variantOverride,
  hasCommunity = false,
  stripeConfigured = true,
}: CoffeePageImplProps) {
  const variant = variantOverride || (creator?.variant as BrandVariant) || DEFAULT_VARIANT;
  const colorTheme = getVariantColorTheme(variant);
  const recurringLabel = getRecurringLabel(variant);
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const tiers = getPricingTiers(creator.support_theme, pricing);
  const { currentUser } = useAuth();
  const prefillMessage = searchParams.get("message") || "";
  const [selectedTier, setSelectedTier] = useState<CoffeeTier>(() => {
    if (!prefillMessage) return tiers[0];
    const len = prefillMessage.length;
    // Pick the cheapest tier that fits the message, fall back to custom (last tier)
    return tiers.find(t => t.char_limit > 0 && len <= t.char_limit) || tiers[tiers.length - 1];
  });
  const [customAmount, setCustomAmount] = useState(0);
  const [message, setMessage] = useState(prefillMessage);
  const [isRecurring, setIsRecurring] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showMessagePrompt, setShowMessagePrompt] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [showAmountError, setShowAmountError] = useState(false);

  // Extract first name from creator name
  const nameParts = creator.name?.split(' ');
  const firstName = nameParts && nameParts.length > 0 ? nameParts[0] : creator.name;


  // Dynamic perks text for Praiz based on selected tier
  const getPraizNoteDescription = () => {
    const tierIndex = tiers.findIndex(t => t.price_in_cents === selectedTier.price_in_cents && t.is_custom === selectedTier.is_custom);
    const perksMap: Record<number, number> = {
      0: 5,  // Tier 1
      1: 8,  // Tier 2
      2: 10, // Tier 3
    };
    // Custom tier or unknown tier gets 10% perks
    const perks = selectedTier.is_custom ? 10 : (perksMap[tierIndex] ?? 10);
    return `Send a note each week and Praiz replies every Friday. Plus, get ${perks}% discount on table seats for the RNBROOM! 🍹`;
  };

  // Get character limit based on selected tier (undefined = no limit)
  const weeklyLimit = pricing.weekly_allowance_chars || WEEKLY_MESSAGE_CHAR_BUDGET;
  const charLimit = isRecurring ? weeklyLimit : (selectedTier.char_limit > 0 ? selectedTier.char_limit : undefined);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chargeAmount = isRecurring
    ? { price_in_cents: pricing.weekly_price_cents || 1500, currency_code: pricing.currencyCode || "usd" }
    : getChargeAmount(pricing, selectedTier, customAmount);


  const handleShare = async () => {
    const shareUrl = window.location.href;

    // Only use Web Share API on mobile devices where it's reliably supported
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `Support ${firstName}`,
          text: `Support ${firstName} on Hotly!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed - fall back to clipboard
      }
    }

    // Desktop: copy to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCheckout = async () => {
    if (!stripeConfigured) {
      return;
    }
    const amountInCents = getStripeCharge(chargeAmount).amount;

    // Validate minimum amount
    if (amountInCents < MIN_COFFEE_AMOUNT) {
      setShowAmountError(true);
      setTimeout(() => setShowAmountError(false), 2500);
      return;
    }

    if (!message.trim()) {
      // Focus the textarea and show prompt
      textareaRef.current?.focus();
      setShowMessagePrompt(true);
      setTimeout(() => setShowMessagePrompt(false), 2500);
      return;
    }

    const checkoutEmail = currentUser?.email || guestEmail.trim();
    if (!checkoutEmail || !checkoutEmail.includes("@")) {
      setShowEmailPrompt(true);
      setTimeout(() => setShowEmailPrompt(false), 2500);
      return;
    }

    setIsProcessing(true);


    try {

      const { url } = await createCheckout({
        creator,
        selectedTier,
        message,
        chargeAmount,
        isRecurring,
        email: checkoutEmail,
      });

      window.location.href = url;
    } catch (error: any) {
      captureError(error, { action: 'checkout', component: 'CoffeePageImpl' });
      // A 400 is a validation failure the writer can act on (e.g. a subscribe
      // letter over the weekly budget). "Try again" would send them in circles.
      alert(
        error instanceof ApiError && error.status === 400
          ? error.message
          : error instanceof ApiError && error.status === 503
            ? "Payments are not configured on this instance."
            : "Failed to process checkout. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };


  // Success view - delegate to separate component
  if (isSuccess) {
    return <CoffeeSuccessPage creator={creator} />;
  }

  return (
    <div
      className={`${inter.variable} w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-center p-0  relative`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      {/* Warm ambient background */}
      <div className="absolute inset-0" style={{ backgroundColor: colorTheme.ambientBg }} />
      <div className={`absolute inset-0 bg-gradient-to-b ${colorTheme.ambientGradient}`} />

      {/* Card */}
      <div
        className={`
          relative w-full max-w-[480px] h-full md:max-h-[1640px]
          flex flex-col
          md:rounded-[32px]
          transform transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${colorTheme.cardBg}
          ${mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.98]"}
        `}
      >
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0">

          {/* PROFILE HEADER */}
          <div
            className={`
              relative
              transform transition-all duration-700 delay-75 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
            `}
          >
            {/* Warm Banner */}
            <div className={`h-24 bg-gradient-to-br ${colorTheme.banner} md:rounded-t-[32px] relative overflow-hidden`}>
              {colorTheme.hasBannerShimmer && (
                <>
                  {/* Silk shimmer layers */}
                  <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.12)_42%,rgba(255,255,255,0.06)_44%,transparent_55%),linear-gradient(250deg,transparent_60%,rgba(255,255,255,0.04)_68%,rgba(255,255,255,0.09)_70%,rgba(255,255,255,0.04)_72%,transparent_80%)]" />
                  {/* Purple glow from bottom */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[180px] h-[70px] bg-[radial-gradient(ellipse,rgba(167,139,250,0.25)_0%,transparent_70%)]" />
                </>
              )}
            </div>

            {/* Share Button — top left */}
            <button
              onClick={handleShare}
              type="button"
              aria-label="Copy page link"
              className="
                absolute top-4 left-4 z-10
                w-10 h-10 rounded-full
                backdrop-blur-md
                flex items-center justify-center
                active:scale-90
                transition-all duration-150 ease-out
                focus:outline-none
                cursor-pointer
                bg-white/90 text-gray-600 hover:bg-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] shadow-[0_2px_12px_rgba(0,0,0,0.08)]
              "
            >
              {showCopied ? (
                <svg className="w-[18px] h-[18px] text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              )}
            </button>

            {/* Dome / Community Button — top right */}
            {hasCommunity && (
              <CrossNavPill
                href={getDomePage(creator.username)}
                icon={<span className="text-xl">🏠</span>}
                label="Dome"
                badge="Free"
                variant="light"
                className="absolute top-4 right-4 z-10"
              />
            )}

            {/* Copied Toast */}
            <div
              className={`
                absolute top-5 left-16 z-50
                px-3 py-1.5 rounded-full
                text-white text-xs font-medium
                transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${colorTheme.toastBg}
                ${showCopied ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"}
              `}
            >
              Link copied!
            </div>

            {/* Avatar */}
            <div className="relative -mt-14 md:-mt-16 mb-5 flex justify-center">
              <div className="relative">
                <div className={`absolute -inset-1 rounded-full ${colorTheme.avatarRingShadow}`} />
                <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-gradient-to-br ${colorTheme.avatarBg} ring-[5px] ${colorTheme.avatarRingColor}`}>
                  {creator.avatar_url ? (
                    <img
                      src={creator.avatar_url}
                      alt={creator.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">
                      {getThemeEmoji(creator.support_theme)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Name & Info */}
            <div className="text-center px-6 pb-3 md:px-10">
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-[-0.03em] leading-none mb-2 text-gray-900">
                {creator.name}
              </h1>


              {creator.bio && (
                <p className="text-[15px] mx-auto leading-relaxed text-gray-500">
                  {creator.bio}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className={`mx-6 md:mx-10 h-px bg-gradient-to-r from-transparent to-transparent ${colorTheme.dividerVia}`} />

          {/* ACTION SECTION */}
          <div className="px-6 pt-4 pb-6 md:px-6 md:pt-4">

            {/* Tier Selection */}
            <div
              className={`
                mb-1
                transform transition-all duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
            >
              <h2 className="mb-4 text-sm font-semibold text-center tracking-wide uppercase text-gray-400">
                Penpal chat with {firstName}
              </h2>

              {/* Tier Grid */}
              <CoffeeTierSelector
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                pricing={pricing}
                supportTheme={creator.support_theme || DEFAULT_SUPPORT_THEME}
                variant={variant}
              />
              {/* Minimum amount error */}
              <div
                className={`
                  mt-2 text-xs font-medium text-red-500
                  transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${showAmountError ? "opacity-100" : "opacity-0"}
                `}
              >
                Minimum amount is {beautifyAmount(getMinCustomAmount(pricing), pricing.currencyCode)}
              </div>
            </div>

            {/* Message Input */}
            <div
              className={`
                mb-4
                transform transition-all duration-700 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="penpal-message" className="block text-sm font-semibold tracking-wide uppercase text-gray-400">
                  Your message
                </label>
                {/* Character limit chip or prompt hint */}
                {showMessagePrompt ? (
                  <span className={`text-xs font-medium ${colorTheme.promptHintColor}`}>
                    ✍️ Write something first!
                  </span>
                ) : (
                  <span
                    className={`
                      px-2 py-0.5 rounded-full text-[10px] font-bold
                      transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                      ${charLimit ? colorTheme.charBadgeOver : colorTheme.charBadgeUnder}
                    `}
                  >
                    {charLimit ? `${charLimit} characters` : "No limit ✨"}
                  </span>
                )}
              </div>
              <div className="relative">
                <textarea
                  id="penpal-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(charLimit ? e.target.value.slice(0, charLimit) : e.target.value)}
                  placeholder={`What would you say to ${firstName}?`}
                  rows={3}
                  className={`
                    w-full px-4 py-4
                    rounded-2xl
                    border-2
                    transition-all duration-200 ease-out
                    resize-none
                    focus:outline-none
                    ${colorTheme.textareaFocus}
                    ${showMessagePrompt ? colorTheme.textareaError : "border-transparent"}
                  `}
                />
                {charLimit && (
                  <div
                    className={`
                      absolute bottom-3 right-4 text-[10px] font-semibold tracking-wide
                      transition-all duration-200
                      ${message.length > 0 ? "opacity-100" : "opacity-0"}
                      ${message.length > charLimit * 0.9 ? colorTheme.charCounterOver : "text-gray-300"}
                    `}
                  >
                    {message.length}/{charLimit}
                  </div>
                )}
              </div>
            </div>

            {!currentUser?.email ? (
            <div
              className={`
                mb-4
                transform transition-all duration-700 delay-250 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
            >
              <label htmlFor="penpal-email" className="block text-sm font-semibold tracking-wide uppercase text-gray-400 mb-2">
                Your email
              </label>
              <input
                id="penpal-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@example.com"
                className={`
                  w-full px-4 py-3 rounded-2xl border-2 focus:outline-none
                  ${colorTheme.textareaFocus}
                  ${showEmailPrompt ? colorTheme.textareaError : "border-transparent"}
                `}
              />
              {showEmailPrompt ? (
                <p className={`text-xs font-medium mt-2 ${colorTheme.promptHintColor}`}>
                  Add an email so we can open your chat after payment.
                </p>
              ) : null}
            </div>
            ) : null}

            <div
              className={`
                transform transition-all duration-700 delay-250 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
            >
              <button
                type="button"
                aria-pressed={isRecurring}
                onClick={() => setIsRecurring(!isRecurring)}
                className={`
                  w-full flex items-start gap-4 p-4 rounded-2xl border-2
                  transition-all duration-200 ease-out
                  ${isRecurring
                    ? colorTheme.recurringBg
                    : "bg-transparent border-gray-100 hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100"
                  }
                `}
              >
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                  transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                  ${isRecurring ? colorTheme.recurringIconBg : "bg-gray-100 text-gray-400"}
                `}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-gray-800">{recurringLabel}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isRecurring ? colorTheme.recurringBadge : "bg-gray-100 text-gray-500"}`}>
                      Weekly
                    </span>
                  </div>
                  <p className={`text-[13px] mt-1 leading-relaxed ${isRecurring ? colorTheme.recurringText : "text-gray-500"}`}>
                    {noteDescription || `2,000 characters each billing week. ${firstName} writes back when they can.`}
                  </p>
                </div>
                <div className={`flex-shrink-0 relative w-12 h-7 rounded-full p-1 mt-0.5 ${isRecurring ? colorTheme.recurringToggleOn : "bg-gray-200"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${isRecurring ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* CTA FOOTER */}
        <div
          className={`
            flex-shrink-0 px-6 md:px-6 pt-4 md:pt-5 pb-2 md:pb-3
            md:rounded-b-[32px]
            transform transition-all duration-700 delay-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${colorTheme.footerBar}
            ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          `}
        >
          <CustomButton
            onClick={handleCheckout}
            loading={isProcessing}
            disabled={!stripeConfigured}
            className="!w-full"
            variant={colorTheme.buttonVariant}
          >
            <span className="flex items-center justify-center gap-2.5">
              {(() => {
                if (!stripeConfigured) {
                  return "Payments unavailable";
                }
                if (isProcessing) {
                  return "Processing...";
                }
                if (isRecurring) {
                  return (
                    <>
                      {formatChargeDisplay(chargeAmount, true, recurringLabel)}
                      <span className="text-lg">✉️</span>
                    </>
                  );
                }
                return (
                  <>
                    Send {formatChargeDisplay(chargeAmount)} + your note
                    <span className="text-lg">{getThemeEmoji(creator.support_theme)}</span>
                  </>
                );
              })()}
            </span>
          </CustomButton>

          {/* Footer */}
          {/* <div className={`flex items-center justify-center gap-1.5 mt-2 text-[11px] font-medium text-gray-400`}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Secure payment</span>
            <span className="text-gray-300">·</span>
            <a
              href="https://hotly.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-gray-500`}
            >
              Powered by Hotly
            </a>
          </div> */}

          {!stripeConfigured ? (
            <p className="mt-3 mb-0 text-center text-[11px] font-medium text-rose-600">
              Stripe is not configured on this instance. Checkout is disabled.
            </p>
          ) : null}
          <p className="mt-3 mb-1 text-center text-[11px] font-medium text-gray-400">
            Powered by Hotly
          </p>
        </div>
      </div>
    </div>
  );
}
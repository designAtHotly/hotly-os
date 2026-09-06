"use client";

import { useState, useEffect } from "react";
import { CoffeeCreator, getThemeEmoji, getThemeLabel, } from "@/types/coffee.types";
import CustomButton from "@/components/ui/custom-button";
import { beautifyAmount } from "@/lib/utils/chat";
import { appMediaUrl } from "@/lib/media/url";
import { BrandVariant, DEFAULT_SUPPORT_THEME, DEFAULT_VARIANT, getBadgeLabel, getVariantColorTheme, getWelcomeMessage } from "@/lib/utils/variant";

interface CoffeeSuccessViewProps {
  creator: CoffeeCreator;
  amount: number | null;
  currency: string | null;
  isRecurring?: boolean;
  onSendAnother: () => void;
  onGoToChat?: () => void;
  productName?: string;
  variant?: BrandVariant;
}

export default function CoffeeSuccessView({
  creator,
  amount,
  currency,
  isRecurring = false,
  onSendAnother,
  onGoToChat,
  productName,
  variant,
}: CoffeeSuccessViewProps) {
  const [mounted, setMounted] = useState(false);
  const resolvedVariant = variant || (creator.variant as BrandVariant) || DEFAULT_VARIANT;
  const colorTheme = getVariantColorTheme(resolvedVariant);
  const supportTheme = creator.support_theme || DEFAULT_SUPPORT_THEME
  const pName = productName || getThemeLabel(supportTheme).toLowerCase();
  const drinkEmoji = getThemeEmoji(supportTheme);
  const variantLabel = getBadgeLabel(resolvedVariant);

  // Extract first name from creator name
  const nameParts = creator.name?.split(' ');
  const firstName = nameParts && nameParts.length > 0 ? nameParts[0] : creator.name;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 md:px-10">
      {/* Success checkmark */}
      <div
        className={`
          mb-6
          transform transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-50"}
        `}
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      {/* Thank you message */}
      <div
        className={`
          text-center mb-8
          transform transition-all duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <h1 className="text-[28px] md:text-[32px] font-bold text-gray-900 tracking-[-0.03em] leading-tight mb-3">
          {isRecurring ? getWelcomeMessage(resolvedVariant) : `Thanks for the ${getThemeLabel(supportTheme).toLowerCase()}!`} {isRecurring ? "💌" : drinkEmoji}
        </h1>
        <p className="text-[15px] text-gray-500 max-w-[280px] mx-auto leading-relaxed">
          {isRecurring ? (
            <>You and <span className="font-semibold text-gray-700">{firstName}</span> are now connected</>
          ) : (
            <>You just supported <span className="font-semibold text-gray-700">{creator.name}</span> with a {pName}</>
          )}
        </p>
      </div>

      {/* Amount badge */}
      <div
        className={`
          mb-8
          transform transition-all duration-700 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full ${colorTheme.successBadgeBg}`}>
          <span className="text-2xl">{isRecurring ? "✉️" : drinkEmoji}</span>
          <span className={`text-lg font-bold ${colorTheme.successBadgeText}`}>{amount != null ? beautifyAmount(amount, currency || "usd") : "Thank you!"} {isRecurring ? "/week" : ""}</span>
          <span className={`text-sm font-medium uppercase tracking-wide ${colorTheme.successBadgeLabel}`}>{isRecurring ? variantLabel : pName}</span>
        </div>
      </div>

      {/* Creator card */}
      <div
        className={`
          w-full mb-6
          transform transition-all duration-700 delay-250 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-100">
          {/* Creator avatar */}
          <div className="relative flex-shrink-0">
            <div className={`w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br ${colorTheme.avatarBg} ring-3 ring-white shadow-md`}>
              {appMediaUrl(creator.avatar_url) ? (
                <img
                  src={appMediaUrl(creator.avatar_url)}
                  alt={creator.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  {drinkEmoji}
                </div>
              )}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
          </div>

          {/* Creator info */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-gray-800 truncate">
              {creator.name}
            </p>
            <p className="text-[13px] text-gray-500">
              {isRecurring ? "Send them a message anytime ✨" : "Will receive your message soon ✉️"}
            </p>
          </div>

          {/* Heart icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Receipt notice */}
      <div
        className={`
          w-full mb-8
          transform transition-all duration-700 delay-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className={`flex items-center gap-3 p-4 rounded-2xl ${colorTheme.successReceiptBg}`}>
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${colorTheme.successReceiptIconBg}`}>
            <svg className={`w-5 h-5 ${colorTheme.successReceiptIconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <p className={`text-[14px] font-medium ${colorTheme.successReceiptText}`}>
            A receipt is on its way to your email
          </p>
        </div>
      </div>

      {/* Send another CTA */}
      <div
        className={`
          w-full
          transform transition-all duration-700 delay-350 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <CustomButton onClick={isRecurring && onGoToChat ? onGoToChat : onSendAnother} className="!w-full" variant={colorTheme.buttonVariant}>
          <span className="flex items-center justify-center gap-2.5">
            {isRecurring ? "Go to inbox" : `Send another ${getThemeLabel(supportTheme).toLowerCase()}`}
            <span className="text-lg">{isRecurring ? "💬" : drinkEmoji}</span>
          </span>
        </CustomButton>
      </div>

      {/* Footer */}
      <div
        className={`
          mt-8
          transform transition-all duration-700 delay-400 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mounted ? "opacity-100" : "opacity-0"}
        `}
      >
        <a
          href="https://hotly.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-medium hover:text-gray-500 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>Powered by Hotly</span>
        </a>
      </div>
    </div>
  );
}
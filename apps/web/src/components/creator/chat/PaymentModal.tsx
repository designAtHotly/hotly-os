"use client";

import { useState, useEffect } from "react";
import { CoffeeTier, CreatorPricing, getPricingTiers, SupportTheme, getChargeAmount } from "@/types/coffee.types";
import { getFirstName, formatChargeDisplay } from "@/lib/utils/chat";
import CoffeeTierSelector from "../CoffeeTierSelector";
import { BrandVariant, DEFAULT_SUPPORT_THEME, DEFAULT_VARIANT, getBadgeLabel, getRecurringLabel, getVariantColorTheme } from "@/lib/utils/variant";

interface PaymentModalProps {
  isOpen: boolean;
  artistName: string;
  messageContent: string;
  onClose: () => void;
  onConfirm: (tier: CoffeeTier, customAmount?: number) => void;
  onSubscribeAndSend: (tier: CoffeeTier, customAmount?: number) => void;
  isLoading?: boolean;
  mode?: "send_message" | "resubscribe";
  variant?: BrandVariant;
  pricing: CreatorPricing
  supportTheme?: SupportTheme;
}

export default function PaymentModal({
  isOpen,
  artistName,
  messageContent,
  onClose,
  onConfirm,
  onSubscribeAndSend,
  isLoading,
  mode = "send_message",
  variant = DEFAULT_VARIANT,
  supportTheme = DEFAULT_SUPPORT_THEME,
  pricing,
}: PaymentModalProps) {
  const colorTheme = getVariantColorTheme(variant);
  const tiers = getPricingTiers(supportTheme, pricing);
  const [selectedTier, setSelectedTier] = useState<CoffeeTier>(tiers[0]);
  const [customAmount, setCustomAmount] = useState(0);
  const [penpalActive, setPenpalActive] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset penpal toggle and custom amount
      setPenpalActive(false);
      setCustomAmount(0);

      // Auto-select appropriate tier based on message length
      if (messageContent) {
        const appropriateTier = tiers.find(
          (t) => !t.is_custom && t.char_limit && t.char_limit >= messageContent.length
        );
        if (appropriateTier) {
          setSelectedTier(appropriateTier);
        }
      }
    }
  }, [isOpen, messageContent]);

  const handleConfirm = () => {
    if (mode === "resubscribe" || penpalActive) {
      onSubscribeAndSend(selectedTier, selectedTier.is_custom ? customAmount : undefined);
    } else {
      onConfirm(selectedTier, selectedTier.is_custom ? customAmount : undefined);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const firstName = getFirstName(artistName);

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-5
        transition-all duration-250
        ${isVisible ? "bg-black/30 backdrop-blur-[4px]" : "bg-transparent"}
      `}
      onClick={handleBackdropClick}
    >
      <div
        className={`
          w-full max-w-[400px] bg-white rounded-[28px] overflow-hidden
          transition-all duration-250
          ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-5"}
        `}
        style={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" }}
      >
        {/* Header */}
        <div className="text-center px-6 pt-6 pb-5">
          <div className="text-[32px] mb-3">{mode === "resubscribe" ? "✉️" : "💌"}</div>
          <h2 className="text-xl font-semibold text-stone-900 mb-1">
            {mode === "resubscribe" ? `Resubscribe to ${firstName}` : `Send to ${firstName}`}
          </h2>
          <p className="text-sm text-stone-500">
            {mode === "resubscribe" ? `Choose your ${getBadgeLabel(variant)} tier` : "Choose your message tier"}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {/* Tier Selection */}
          <CoffeeTierSelector
            supportTheme={supportTheme}
            pricing={pricing}
            selectedTier={selectedTier}
            onSelectTier={setSelectedTier}
            customAmount={customAmount}
            onCustomAmountChange={setCustomAmount}
            variant={variant}
          />

          {/* Penpal Upsell - only show in send_message mode */}
          {mode === "send_message" && (
            <div
              className={`
                mt-4 rounded-[20px] p-4 flex items-center gap-3.5
                transition-all duration-200 border
                ${penpalActive ? colorTheme.recurringBg : "bg-[#fdfbf8] border-[#f0ebe3]"}
              `}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                  ${penpalActive ? colorTheme.recurringIconBg : "bg-stone-100"}`}
              >
                ✉️
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-stone-900">{getRecurringLabel(variant)}</span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                      ${penpalActive ? colorTheme.recurringBadge : "bg-stone-200 text-stone-500"}`}
                  >
                    Weekly
                  </span>
                </div>
                <p className={`text-xs ${penpalActive ? colorTheme.recurringText : "text-stone-500"}`}>
                  Unlimited messages & {firstName} replies weekly
                </p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => setPenpalActive(!penpalActive)}
                className={`w-11 h-6 rounded-full p-[2px] flex-shrink-0 transition-all duration-200
                  ${penpalActive ? colorTheme.recurringToggleOn : "bg-stone-300"}`}
              >
                <div
                  className="w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{
                    transform: penpalActive ? "translateX(20px)" : "translateX(0)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}
                />
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-[#fdfbf8] border-t border-[#f0ebe3]">
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full py-4 rounded-[20px] text-white text-[15px] font-semibold
              transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: colorTheme.ctaGradient,
              boxShadow: colorTheme.ctaShadow
            }}
          >
            {(() => {
              const charge = getChargeAmount(pricing, selectedTier, customAmount);
              if (isLoading) {
                return <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />;
              }
              if (mode === "resubscribe") {
                return `Resubscribe · ${formatChargeDisplay(charge, true)}`;
              }
              if (penpalActive) {
                return formatChargeDisplay(charge, true, getRecurringLabel(variant));
              }
              return `Send for ${formatChargeDisplay(charge)}`;
            })()}
          </button>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="block w-full text-center mt-3.5 text-[13px] text-stone-400 hover:text-stone-500 transition-colors disabled:opacity-50"
          >
            Go back to editing
          </button>
        </div>
      </div>
    </div>
  );
}

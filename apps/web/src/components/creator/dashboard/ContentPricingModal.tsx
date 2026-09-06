"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { CreatorPricing, DEFAULT_PRICING, getCurrencySymbol } from "@/types/coffee.types";
import { beautifyAmount } from "@/lib/utils/chat";

interface ContentPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPaid: (priceInCents: number, currencyCode: string) => void;
  onSendFree?: () => void;
  pricing: CreatorPricing;
  isLoading?: boolean;
}

const MULTIPLIERS = [1, 2, 3, 5];

export default function ContentPricingModal({
  isOpen,
  onClose,
  onSendPaid,
  onSendFree,
  pricing = DEFAULT_PRICING,
  isLoading,
}: ContentPricingModalProps) {
  const basePriceCents = pricing.price_1000;
  const presets = useMemo(
    () => MULTIPLIERS.map((m) => ({ multiplier: m, cents: basePriceCents * m })),
    [basePriceCents]
  );

  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(MULTIPLIERS[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMultiplier(MULTIPLIERS[0]);
      setCustomMode(false);
      setCustomValue("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (customMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [customMode]);

  const currentAmountCents = customMode
    ? (parseInt(customValue) || 0) * 100
    : basePriceCents * selectedMultiplier;

  const minCustomCents = basePriceCents;
  const customAmountValid = currentAmountCents >= minCustomCents;

  const handleSendPaid = () => {
    if (currentAmountCents <= 0 || (customMode && !customAmountValid)) return;
    onSendPaid(currentAmountCents, pricing.currencyCode);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const symbol = getCurrencySymbol(pricing.currencyCode);

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
          w-full max-w-[360px] bg-white rounded-[24px] overflow-hidden relative
          transition-all duration-250
          ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-5"}
        `}
        style={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center px-6 pt-6 pb-4">
          <div className="text-[28px] mb-2">🔒</div>
          <h2 className="text-lg font-semibold text-stone-900 mb-1">
            Set unlock price
          </h2>
          <p className="text-sm text-stone-500">
            Based on your top tier ({beautifyAmount(basePriceCents, pricing.currencyCode)})
          </p>
        </div>

        {/* Multiplier options */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-4 gap-2">
            {presets.map(({ multiplier, cents }) => (
              <button
                key={multiplier}
                onClick={() => { setSelectedMultiplier(multiplier); setCustomMode(false); }}
                className={`py-3 rounded-xl text-sm font-semibold transition-all
                  ${!customMode && selectedMultiplier === multiplier
                    ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
              >
                <div className="text-[10px] opacity-60 mb-0.5">{multiplier}x</div>
                {beautifyAmount(cents, pricing.currencyCode)}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <button
            onClick={() => { setCustomMode(true); setSelectedMultiplier(0); }}
            className={`mt-2 w-full rounded-xl transition-all ${customMode
              ? "bg-amber-50 ring-2 ring-amber-400"
              : "bg-stone-100 hover:bg-stone-200"
              }`}
          >
            {customMode ? (
              <div className="flex flex-col items-center py-3 gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-amber-800">{symbol}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customValue}
                    onChange={(e) => {
                      if (e.target.value === "" || /^\d+$/.test(e.target.value)) {
                        setCustomValue(e.target.value);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0"
                    className="w-16 text-sm font-semibold text-amber-800 bg-transparent outline-none text-center placeholder:text-amber-400"
                  />
                </div>
                <span className="text-[10px] text-stone-400">
                  Min {beautifyAmount(minCustomCents, pricing.currencyCode)}
                </span>
              </div>
            ) : (
              <div className="py-3 text-sm font-medium text-stone-500">
                Custom amount
              </div>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#fdfbf8] border-t border-[#f0ebe3]">
          <button
            onClick={handleSendPaid}
            disabled={isLoading || currentAmountCents <= 0 || (customMode && !customAmountValid)}
            className="w-full py-3.5 rounded-2xl text-white text-[15px] font-semibold
              transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: "linear-gradient(145deg, #fbbf24, #f59e0b)",
              boxShadow: "0 2px 12px rgba(245, 158, 11, 0.2)",
            }}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              `Send for ${beautifyAmount(currentAmountCents, pricing.currencyCode)}`
            )}
          </button>
          {onSendFree ? (
            <button
              type="button"
              onClick={onSendFree}
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-2xl text-stone-600 text-[14px] font-medium bg-white border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Send free
            </button>
          ) : null}

        </div>
      </div>
    </div>
  );
}

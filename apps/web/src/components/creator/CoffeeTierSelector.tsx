"use client";

import { useState, useRef, useEffect } from "react";
import { CoffeeTier, CreatorPricing, getCurrencySymbol, getMinCustomAmount, getPricingTiers, getThemeEmoji, SupportTheme } from "@/types/coffee.types";
import { beautifyAmount } from "@/lib/utils/chat";
import { BrandVariant, getVariantColorTheme } from "@/lib/utils/variant";

interface CoffeeTierSelectorProps {
  selectedTier: CoffeeTier;
  onSelectTier: (tier: CoffeeTier) => void;
  supportTheme: SupportTheme;
  pricing: CreatorPricing;
  customAmount: number;
  onCustomAmountChange: (amount: number) => void;
  variant?: BrandVariant;
}

export default function CoffeeTierSelector({
  selectedTier,
  onSelectTier,
  onCustomAmountChange,
  customAmount,
  pricing,
  supportTheme,
  variant = "penpal",
}: CoffeeTierSelectorProps) {
  const colorTheme = getVariantColorTheme(variant);
  const { currencyCode } = pricing;
  const minCustomAmount = getMinCustomAmount(pricing);
  const tiers = getPricingTiers(supportTheme, pricing);
  const [pressedTier, setPressedTier] = useState<number | null>(null);
  const minDisplayAmount = Math.floor(minCustomAmount / 100);
  // Display value derived from prop (convert cents to whole units)
  const displayValue = customAmount > 0 ? Math.floor(customAmount / 100).toString() : "";
  const [inputValue, setInputValue] = useState(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when customAmount prop changes
  useEffect(() => {
    const newDisplayValue = customAmount > 0 ? Math.floor(customAmount / 100).toString() : "";
    setInputValue(newDisplayValue);
  }, [customAmount]);

  // Focus input when custom tier is selected
  useEffect(() => {
    if (selectedTier.is_custom && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedTier.is_custom]);

  const handleCustomAmountChange = (value: string) => {
    // Allow empty string or numbers only
    if (value === "" || /^\d+$/.test(value)) {
      setInputValue(value);
      const displayValue = parseInt(value) || 0;
      // Convert display value to cents
      const cents = displayValue * 100;
      onCustomAmountChange(cents);
    }
  };

  const handleCustomAmountBlur = () => {
    // Enforce minimum for custom tier on blur
    const currentCents = (parseInt(inputValue) || 0) * 100;
    if (inputValue !== "" && currentCents < minCustomAmount) {
      setInputValue(minDisplayAmount.toString());
      onCustomAmountChange(minCustomAmount);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {tiers.map((tier) => {
        const isSelected = selectedTier.id === tier.id;
        const isPressed = pressedTier !== null && pressedTier === tier.id;

        if (tier.is_custom) {
          return (
            <button
              key={tier.id}
              onClick={() => {
                onSelectTier(tier);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              onTouchStart={() => setPressedTier(tier.id)}
              onTouchEnd={() => setPressedTier(null)}
              onMouseDown={() => setPressedTier(tier.id)}
              onMouseUp={() => setPressedTier(null)}
              onMouseLeave={() => setPressedTier(null)}
              className={`
                relative py-5 px-2 rounded-2xl
                transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                ${colorTheme.tierFocusRing}
                ${isPressed ? "scale-[0.94]" : "scale-100"}
                ${isSelected
                  ? colorTheme.tierSelectedBg
                  : "bg-white hover:bg-gray-50 active:bg-gray-100"
                }
              `}
            >
              {/* Selection Ring */}
              <div
                className={`
                  absolute inset-0 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${isSelected ? colorTheme.tierSelectionRing + " opacity-100" : "border-transparent opacity-0"}
                `}
              />

              {/* Radio Indicator */}
              <div className="absolute top-2.5 right-2.5">
                <div
                  className={`
                    relative w-[18px] h-[18px] rounded-full
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${isSelected
                      ? colorTheme.tierRadioSelected
                      : "bg-white border-2 border-gray-200 hover:border-gray-300"
                    }
                  `}
                >
                  {/* Checkmark */}
                  <div
                    className={`
                      absolute inset-0 flex items-center justify-center
                      transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                      ${isSelected ? "opacity-100 scale-100" : "opacity-0 scale-0"}
                    `}
                  >
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  {/* Inner shadow for unselected */}
                  {!isSelected && (
                    <div className="absolute inset-0.5 rounded-full bg-gradient-to-b from-gray-50 to-white" />
                  )}
                </div>
              </div>

              {/* Edit Icon */}
              <div className={`
                text-2xl mb-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isSelected ? "scale-110" : "scale-100"}
              `}>
                ✏️
              </div>

              {/* Custom Amount Input or Placeholder */}
              {isSelected ? (
                <div className="relative">
                  <span className={`absolute left-1 top-1/2 -translate-y-1/2 text-lg font-bold ${colorTheme.tierCustomSymbolColor}`}>{getCurrencySymbol(currencyCode)}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    onBlur={handleCustomAmountBlur}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0"
                    className={`
                      w-full text-lg font-bold text-center bg-transparent
                      border-none outline-none pl-4
                      ${colorTheme.tierCustomInputColor}
                    `}
                    style={{ width: "100%" }}
                  />
                </div>
              ) : (
                <div className="text-lg font-bold tracking-tight text-gray-700">
                  Other
                </div>
              )}

              {/* Tier Name */}
              <div className={`
                text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors duration-200
                ${isSelected ? colorTheme.tierNameColor : "text-gray-400"}
              `}>
                {isSelected && customAmount >= minCustomAmount ? beautifyAmount(customAmount, currencyCode) : `${beautifyAmount(minCustomAmount, currencyCode)}+`}
              </div>
              {/* Char Limit */}
              <div className={`
                text-[8px] font-medium mt-0.5 transition-colors duration-200
                ${isSelected ? colorTheme.tierCharLimitColor : "text-gray-300"}
              `}>
                No character limit
              </div>
            </button>
          );
        }

        return (
          <button
            key={tier.id}
            onClick={() => onSelectTier(tier)}
            onTouchStart={() => setPressedTier(tier.id)}
            onTouchEnd={() => setPressedTier(null)}
            onMouseDown={() => setPressedTier(tier.id)}
            onMouseUp={() => setPressedTier(null)}
            onMouseLeave={() => setPressedTier(null)}
            className={`
              relative py-5 px-2 rounded-2xl
              transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              ${colorTheme.tierFocusRing}
              ${isPressed ? "scale-[0.94]" : "scale-100"}
              ${isSelected
                ? colorTheme.tierSelectedBg
                : "bg-white hover:bg-gray-50 active:bg-gray-100"
              }
            `}
          >
            {/* Selection Ring */}
            <div
              className={`
                absolute inset-0 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${isSelected ? colorTheme.tierSelectionRing + " opacity-100" : "border-transparent opacity-0"}
              `}
            />

            {/* Radio Indicator */}
            <div className="absolute top-2.5 right-2.5">
              <div
                className={`
                  relative w-[18px] h-[18px] rounded-full
                  transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${isSelected
                    ? colorTheme.tierRadioSelected
                    : "bg-white border-2 border-gray-200 hover:border-gray-300"
                  }
                `}
              >
                {/* Checkmark */}
                <div
                  className={`
                    absolute inset-0 flex items-center justify-center
                    transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${isSelected ? "opacity-100 scale-100" : "opacity-0 scale-0"}
                  `}
                >
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                {/* Inner shadow for unselected */}
                {!isSelected && (
                  <div className="absolute inset-0.5 rounded-full bg-gradient-to-b from-gray-50 to-white" />
                )}
              </div>
            </div>

            {/* Coffee/Cocktail Icon */}
            <div className={`
              text-2xl mb-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${isSelected ? "scale-110" : "scale-100"}
            `}>
              {getThemeEmoji(supportTheme)}
            </div>

            {/* Price */}
            <div className={`
              text-lg font-bold tracking-tight transition-colors duration-200
              ${isSelected ? colorTheme.tierPriceColor : "text-gray-700"}
            `}>
              {beautifyAmount(tier.price_in_cents, currencyCode)}
            </div>

            {/* Tier Name */}
            <div className={`
              text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors duration-200
              ${isSelected ? colorTheme.tierNameColor : "text-gray-400"}
            `}>
              {tier.name}
            </div>
            {/* Char Limit */}
            <div className={`
              text-[8px] font-medium mt-0.5 transition-colors duration-200
              ${isSelected ? colorTheme.tierCharLimitColor : "text-gray-300"}
            `}>
              {tier.char_limit} characters
            </div>
          </button>
        );
      })}
    </div>
  );
}

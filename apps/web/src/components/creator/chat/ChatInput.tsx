"use client";

import { useState, useRef, useEffect } from "react";
import { FanState } from "@/types/subscriber.types";
import {
  getFirstName,
  formatTierLabel,
  HeartIcon,
  WEEKLY_MESSAGE_CHAR_BUDGET,
  BUDGET_COUNTER_AT,
  BUDGET_WARNING_AT,
  countMessageChars,
} from "@/lib/utils/chat";
import { BrandVariant, DEFAULT_VARIANT, getBadgeLabel, getVariantColorTheme } from "@/lib/utils/variant";

interface ChatInputProps {
  fanState: FanState;
  artistName: string;
  subscriptionTier: string | null;
  onPayPerMessageSend: (content: string) => void;
  /** Resolves true when the letter sent. Anything else keeps the fan's text. */
  onUnlimitedSend: (content: string) => Promise<boolean>;
  isSending?: boolean;
  /** Characters this fan has already written in the current billing period. */
  charsUsedThisPeriod?: number;
  preservedMessage?: string;
  variant?: BrandVariant;
  onMessageChange?: (content: string) => void;
}

export default function ChatInput({
  fanState,
  artistName,
  subscriptionTier,
  onPayPerMessageSend,
  onUnlimitedSend,
  isSending,
  charsUsedThisPeriod = 0,
  preservedMessage = "",
  variant = DEFAULT_VARIANT,
  onMessageChange,
}: ChatInputProps) {
  const isUnlimited = fanState === "unlimited";
  const [messageText, setMessageText] = useState(isUnlimited ? "" : preservedMessage);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = getFirstName(artistName);

  // The weekly budget applies to subscribers only. Pay-per-message letters are
  // already bounded by the tier the fan picks in PaymentModal.
  //
  // Thresholds count the draft as spent, so the counter appears while the fan is
  // still typing rather than only after they send.
  const charCount = countMessageChars(messageText);
  const consumed = charsUsedThisPeriod + charCount;
  const left = WEEKLY_MESSAGE_CHAR_BUDGET - consumed;

  const isOverBudget = isUnlimited && left < 0;
  const isWarning = isUnlimited && consumed >= BUDGET_WARNING_AT;
  // Stay out of the way until the fan is close enough for it to matter.
  const showBudget = isUnlimited && consumed >= BUDGET_COUNTER_AT;

  const canSend = messageText.trim().length > 0 && !isSending && !isOverBudget;
  const tierLabel = formatTierLabel(subscriptionTier) || "2,000 characters each week";
  const colorTheme = getVariantColorTheme(variant);
  const badgeLabel = getBadgeLabel(variant);

  // Sync preserved message for pay-per-message mode
  useEffect(() => {
    if (!isUnlimited && preservedMessage && preservedMessage !== messageText) {
      setMessageText(preservedMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preservedMessage, isUnlimited]); // messageText intentionally omitted to avoid infinite loop

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageText]);

  const handleSend = async () => {
    if (!canSend) return;

    if (isUnlimited) {
      const attempted = messageText;
      const sent = await onUnlimitedSend(attempted);
      if (!sent) return; // rejected — leave their words where they are
      // Only clear what was actually sent, in case they kept typing meanwhile.
      setMessageText((current) => (current === attempted ? "" : current));
    } else {
      onPayPerMessageSend(messageText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="flex-shrink-0 px-4 pb-2 pt-4"
      style={{
        background: "linear-gradient(180deg, transparent 0%, rgba(250, 248, 245, 0.5) 100%)"
      }}
    >
      <div
        className="bg-white rounded-[28px] p-1.5 transition-all duration-250"
        style={{
          boxShadow: isFocused
            ? colorTheme.inputRingFocus
            : colorTheme.inputRingIdle
        }}
      >
        <div className="bg-[#fdfbf8] rounded-[22px] py-2 pl-4 pr-2">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                onMessageChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={`Write to ${firstName}...`}
              rows={1}
              className="
                flex-1 py-2.5 bg-transparent border-none
                leading-[1.5] text-stone-900
                placeholder:text-stone-400
                resize-none min-h-[44px] max-h-[120px]
                focus:outline-none
              "
            />

            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              className={`
                w-11 h-11 flex items-center justify-center rounded-[20px] flex-shrink-0
                transition-all duration-150
                ${canSend
                  ? "text-white hover:scale-[1.06] active:scale-[0.96]"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
                }
              `}
              style={
                canSend
                  ? {
                    background: colorTheme.ctaGradient,
                    boxShadow: `${colorTheme.ctaShadow}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  }
                  : {}
              }
            >
              {isSending ? (
                <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hint text - different for each mode */}
      {isUnlimited ? (
        showBudget ? (
          // The budget line gets the whole row. Sharing it with the badge left no
          // space for a sentence, which is why these used to be bare counts.
          <p
            className={`text-center text-[11px] font-medium mt-2 px-2 ${isOverBudget || isWarning ? colorTheme.charCounterOver : "text-stone-400"}`}
          >
            {isOverBudget
              ? `You've got a lot to say — trim ${-left} and it's ready 💌`
              : isWarning
                ? `Weeks stay light here, so ${firstName} never has to rush yours. ${left} left 💌`
                : `Take your time — ${left} left`}
          </p>
        ) : (
          <div className="flex items-center justify-center gap-2.5 mt-2">
            <span className={`inline-flex items-center gap-[5px] text-[11px] font-semibold ${colorTheme.promptHintColor}`}>
              <HeartIcon className="w-[13px] h-[13px] opacity-85" />
              {badgeLabel}
            </span>
            <div className="w-[3px] h-[3px] rounded-full bg-stone-300" />
            <span className="text-[11px] font-medium text-stone-400">{tierLabel}</span>
          </div>
        )
      ) : (
        <p className="text-center text-[11px] text-stone-400 mt-2">
          Press send to choose your tip
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { beautifyAmount } from "@/lib/utils/chat";
import { createManageSubscriptionURL } from "@/lib/api";
import { BrandVariant, DEFAULT_VARIANT, getBadgeLabel, getVariantColorTheme } from "@/lib/utils/variant";

interface SubscriptionModalProps {
  isOpen: boolean;
  artistName: string;
  tier: string | null;
  amountInCents: number | null;
  currencyCode: string | null;
  currentPeriodEnd: string | null;
  subscriptionUuid: string | null;
  jwtToken: string | null;
  onClose: () => void;
  variant?: BrandVariant;
}

export default function SubscriptionModal({
  isOpen,
  artistName,
  tier,
  amountInCents,
  currencyCode,
  currentPeriodEnd,
  subscriptionUuid,
  jwtToken,
  onClose,
  variant = DEFAULT_VARIANT,
}: SubscriptionModalProps) {
  const colorTheme = getVariantColorTheme(variant);
  const badgeLabel = getBadgeLabel(variant);
  // TODO use color theme
  const isPurple = colorTheme.buttonVariant === "purple";
  const [isVisible, setIsVisible] = useState(false);
  const [isLoadingManage, setIsLoadingManage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleManageClick = async () => {
    if (!subscriptionUuid || !jwtToken) return;
    setIsLoadingManage(true);
    try {
      const res = await createManageSubscriptionURL(subscriptionUuid, jwtToken);
      if (res.body?.url) {
        window.location.href = res.body.url;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      // silently fail — button stays enabled for retry
    } finally {
      setIsLoadingManage(false);
    }
  };

  if (!isOpen) return null;

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
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-stone-900">Subscription Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
          >
            <svg className="w-5 h-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Plan */}
        <div className="px-6 pb-6">
          <div className={`rounded-2xl p-4 ${isPurple ? "bg-violet-50 border border-violet-100" : "bg-amber-50 border border-amber-100"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isPurple ? "bg-violet-100" : "bg-amber-100"}`}>
                <span>&#9993;</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-900">
                  {tier || badgeLabel} with {artistName}
                </p>
                {amountInCents && (
                  <p className="text-xs text-stone-500">
                    {beautifyAmount(amountInCents, currencyCode || "usd")}
                    /week
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Manage Subscription Button */}
          <div className="mt-5">
            <button
              onClick={handleManageClick}
              disabled={!subscriptionUuid || !jwtToken || isLoadingManage}
              className={`w-full py-3 px-4 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isPurple
                ? "border-violet-200 text-violet-700 hover:bg-violet-50"
                : "border-amber-200 text-amber-700 hover:bg-amber-50"
                }`}
            >
              {isLoadingManage ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                "Manage subscription"
              )}
            </button>
            <p className="mt-2 text-xs text-stone-400 text-center">
              Update payment method, pause, or cancel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

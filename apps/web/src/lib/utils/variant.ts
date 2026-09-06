export type BrandVariant = "penpal" | "vipfan" | "velvetrope";

export function getBadgeLabel(variant: BrandVariant): string {
  switch (variant) {
    case "vipfan":
      return "VIP Fan";
    case "velvetrope":
      return "Velvet Rope";
    default:
      return "Penpal";
  }
}

export function getRecurringLabel(variant: BrandVariant): string {
  switch (variant) {
    case "vipfan":
      return "Become a VIP Fan";
    case "velvetrope":
      return "Enter Velvet Rope experience";
    default:
      return "Become a Penpal";
  }
}

export function getWelcomeMessage(variant: BrandVariant): string {
  switch (variant) {
    case "vipfan":
      return "Welcome, VIP Fan!";
    case "velvetrope":
      return "Welcome to the Velvet Rope Experience!";
    default:
      return "Welcome, Penpal!";
  }
}

export function getPluralLabel(variant: BrandVariant): string {
  switch (variant) {
    case "vipfan":
      return "VIP Fans";
    case "velvetrope":
      return "Velvet Rope";
    default:
      return "Penpals";
  }
}

export const DEFAULT_VARIANT = "penpal"

export const DEFAULT_SUPPORT_THEME = "coffee"

export interface VariantColorTheme {
  // Page
  ambientBg: string;
  ambientGradient: string;
  // Card
  cardBg: string;
  hasBannerShimmer: boolean;
  banner: string;
  // Toast
  toastBg: string;
  // Avatar
  avatarBg: string;
  avatarRingShadow: string;
  avatarRingColor: string;
  // Divider
  dividerVia: string;
  // Message input
  promptHintColor: string;
  charBadgeOver: string;
  charBadgeUnder: string;
  textareaFocus: string;
  textareaError: string;
  charCounterOver: string;
  // Recurring section
  recurringBg: string;
  recurringIconBg: string;
  recurringBadge: string;
  recurringText: string;
  recurringToggleOn: string;
  // Footer
  footerBar: string;
  buttonVariant: "purple" | "amber";
  // CTA button inline styles
  ctaGradient: string;
  ctaShadow: string;
  // Chat input ring inline styles
  inputRingFocus: string;
  inputRingIdle: string;
  // Tier selector
  tierFocusRing: string;
  tierSelectedBg: string;
  tierSelectionRing: string;
  tierRadioSelected: string;
  tierPriceColor: string;
  tierNameColor: string;
  tierCharLimitColor: string;
  tierCustomSymbolColor: string;
  tierCustomInputColor: string;
  // Chat message bubble (sent by fan)
  messageBubbleBg: string;
  messageBubbleShadow: string;
  messageTierColor: string;
  // Success page
  successBadgeBg: string;
  successBadgeText: string;
  successBadgeLabel: string;
  successReceiptBg: string;
  successReceiptIconBg: string;
  successReceiptIconColor: string;
  successReceiptText: string;
}

export function getVariantColorTheme(variant: BrandVariant): VariantColorTheme {
  switch (variant) {
    case "velvetrope":
      return {
        ambientBg: "#faf8f5",
        ambientGradient: "from-violet-100/40 via-purple-50/20 to-violet-50/30",
        cardBg: "bg-white/85 backdrop-blur-[40px] md:shadow-[0_25px_80px_-12px_rgba(76,29,149,0.10),inset_0_0_0_1px_rgba(255,255,255,0.5)]",
        hasBannerShimmer: true,
        banner: "from-[#3b0764] via-[#4c1d95] via-[#6d28d9] via-[#8b5cf6] to-[#a78bfa]",
        toastBg: "bg-violet-900 shadow-[0_8px_24px_rgba(76,29,149,0.35)]",
        avatarBg: "from-[#4c1d95] to-[#8b5cf6]",
        avatarRingShadow: "shadow-[0_4px_24px_rgba(76,29,149,0.12)] bg-violet-50",
        avatarRingColor: "ring-violet-50",
        dividerVia: "via-violet-200",
        promptHintColor: "text-violet-600",
        charBadgeOver: "bg-violet-500/10 text-violet-700",
        charBadgeUnder: "bg-violet-500/10 text-violet-600",
        textareaFocus: "bg-gray-50 text-gray-700 placeholder:text-gray-400 focus:bg-white focus:border-violet-400/40 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.08)]",
        textareaError: "border-violet-400/40 bg-violet-50/80 ring-4 ring-violet-500/10",
        charCounterOver: "text-violet-600",
        recurringBg: "bg-gradient-to-br from-purple-100 to-purple-100/60 border-violet-500/30 backdrop-blur-lg",
        recurringIconBg: "bg-gradient-to-br from-violet-900 to-violet-700 text-white shadow-[0_4px_14px_rgba(76,29,149,0.25)]",
        recurringBadge: "bg-violet-500/20 text-violet-600",
        recurringText: "text-purple-800 opacity-75",
        recurringToggleOn: "bg-gradient-to-br from-violet-900 to-violet-700",
        footerBar: "bg-white/85 backdrop-blur-[20px] shadow-[0_-1px_0_rgba(139,92,246,0.12),0_-12px_32px_-8px_rgba(76,29,149,0.06)]",
        buttonVariant: "purple",
        ctaGradient: "linear-gradient(145deg, #7c3aed, #5b21b6)",
        ctaShadow: "0 2px 12px rgba(124, 58, 237, 0.2)",
        inputRingFocus: "0 4px 12px rgba(0, 0, 0, 0.03), 0 8px 32px rgba(0, 0, 0, 0.06), 0 0 0 2px #8b5cf6",
        inputRingIdle: "0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02), 0 0 0 1px rgba(139, 92, 246, 0.15)",
        tierFocusRing: "focus-visible:ring-violet-500",
        tierSelectedBg: "bg-gradient-to-b from-purple-100 to-purple-100/85 backdrop-blur-[16px]",
        tierSelectionRing: "border-2 border-violet-600/45 shadow-[0_8px_28px_-6px_rgba(109,40,217,0.14),inset_0_1px_0_rgba(255,255,255,0.6)]",
        tierRadioSelected: "bg-gradient-to-br from-violet-700 to-violet-600 shadow-[0_2px_8px_rgba(124,58,237,0.45)]",
        tierPriceColor: "text-violet-900",
        tierNameColor: "text-violet-700",
        tierCharLimitColor: "text-[#6d28d9]",
        tierCustomSymbolColor: "text-violet-900",
        tierCustomInputColor: "text-violet-900 placeholder:text-violet-400",
        messageBubbleBg: "linear-gradient(145deg, #f3f0ff 0%, #ede9fe 100%)",
        messageBubbleShadow: "0 1px 3px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        messageTierColor: "text-violet-700",
        successBadgeBg: "bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 shadow-[0_2px_12px_rgba(124,58,237,0.15)]",
        successBadgeText: "text-violet-700",
        successBadgeLabel: "text-violet-600/70",
        successReceiptBg: "bg-gradient-to-r from-violet-50/80 to-purple-50/60 border border-violet-200/50",
        successReceiptIconBg: "bg-violet-100",
        successReceiptIconColor: "text-violet-600",
        successReceiptText: "text-violet-800",
      };
    default:
      return {
        ambientBg: "#faf8f5",
        ambientGradient: "from-amber-100/40 via-transparent to-orange-50/20",
        cardBg: "bg-white md:shadow-[0_25px_80px_-12px_rgba(0,0,0,0.12)]",
        hasBannerShimmer: false,
        banner: "from-[#fef3c7] via-[#fde68a]/60 to-[#fed7aa]/40",
        toastBg: "bg-gray-900 shadow-xl",
        avatarBg: "from-amber-50 to-orange-50",
        avatarRingShadow: "shadow-[0_4px_20px_rgba(0,0,0,0.1)] bg-white",
        avatarRingColor: "ring-white",
        dividerVia: "via-gray-200",
        promptHintColor: "text-amber-600",
        charBadgeOver: "bg-amber-100 text-amber-700",
        charBadgeUnder: "bg-emerald-100 text-emerald-700",
        textareaFocus: "bg-gray-50 text-gray-700 placeholder:text-gray-400 focus:bg-white focus:border-amber-300 focus:shadow-[0_0_0_4px_rgba(251,191,36,0.1)]",
        textareaError: "border-amber-400 bg-amber-50/50 ring-4 ring-amber-100",
        charCounterOver: "text-amber-600",
        recurringBg: "bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200",
        recurringIconBg: "bg-amber-400 text-white shadow-[0_4px_12px_rgba(251,191,36,0.4)]",
        recurringBadge: "bg-amber-200 text-amber-700",
        recurringText: "text-gray-500",
        recurringToggleOn: "bg-amber-400",
        footerBar: "bg-white shadow-[0_-1px_0_rgba(0,0,0,0.04),0_-12px_32px_-8px_rgba(0,0,0,0.08)]",
        buttonVariant: "amber",
        ctaGradient: "linear-gradient(145deg, #fbbf24, #f59e0b)",
        ctaShadow: "0 2px 12px rgba(245, 158, 11, 0.2)",
        inputRingFocus: "0 4px 12px rgba(0, 0, 0, 0.03), 0 8px 32px rgba(0, 0, 0, 0.06), 0 0 0 2px #fcd34d",
        inputRingIdle: "0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02), 0 0 0 1px rgba(245, 158, 11, 0.15)",
        tierFocusRing: "focus-visible:ring-amber-400",
        tierSelectedBg: "bg-gradient-to-b from-amber-50 to-amber-100/80",
        tierSelectionRing: "border-2 border-amber-400",
        tierRadioSelected: "bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_2px_8px_rgba(245,158,11,0.4)]",
        tierPriceColor: "text-amber-700",
        tierNameColor: "text-amber-600/70",
        tierCharLimitColor: "text-amber-500/60",
        tierCustomSymbolColor: "text-amber-700",
        tierCustomInputColor: "text-amber-700 placeholder:text-amber-400",
        messageBubbleBg: "linear-gradient(145deg, #fef7e8 0%, #fef3d4 100%)",
        messageBubbleShadow: "0 1px 3px rgba(245, 158, 11, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        messageTierColor: "text-amber-700",
        successBadgeBg: "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 shadow-[0_2px_12px_rgba(251,191,36,0.15)]",
        successBadgeText: "text-amber-700",
        successBadgeLabel: "text-amber-600/70",
        successReceiptBg: "bg-gradient-to-r from-amber-50/80 to-orange-50/60 border border-amber-200/50",
        successReceiptIconBg: "bg-amber-100",
        successReceiptIconColor: "text-amber-600",
        successReceiptText: "text-amber-800",
      };
  }
}
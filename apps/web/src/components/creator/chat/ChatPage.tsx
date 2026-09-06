"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Route } from "next";
import { Inter } from "next/font/google";
import {
  getCreatorChatByUsername,
  sendChatMessage,
  setChatAuthToken,
  getChatAuthToken,
  clearChatAuthToken,
  createSubscriptionCheckout,
  requestChatMagicLink,
  CreatorChatResponse,
  ChatMessage
} from "@/lib/api";

// Components
import ChatHeader from "@/components/creator/chat/ChatHeader";
import MessageList from "@/components/creator/chat/MessageList";
import ChatInput from "@/components/creator/chat/ChatInput";
import PaymentModal from "@/components/creator/chat/PaymentModal";
import Toast, { ToastType } from "@/components/creator/chat/Toast";
import SubscriptionBanner from "@/components/creator/chat/SubscriptionBanner";
import WeeklyLimitNotice from "@/components/creator/chat/WeeklyLimitNotice";
import SubscriptionModal from "@/components/creator/chat/SubscriptionModal";
import { CoffeeCreator, CoffeeTier, CreatorPricing, getChargeAmount, getStripeCharge } from "@/types/coffee.types";
import { createCoffeeCheckoutSession, createContentUnlockCheckout } from "@/lib/api/creator";
import { ApiError } from "@/lib/api/impl/base";
import { captureError } from "@/lib/utils/error-handler";
import {
  budgetWindowStart,
  budgetResetAt,
  countCharsUsedSince,
  WEEKLY_MESSAGE_CHAR_BUDGET,
} from "@/lib/utils/chat";
import { BrandVariant, getBadgeLabel, DEFAULT_VARIANT, DEFAULT_SUPPORT_THEME } from "@/lib/utils/variant";
import { getCreatorVariantPage, getCreatorChatPage } from "@/lib/utils/page-helper";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

type FanState = "pay_per_message" | "unlimited";
type ErrorState = "invalid_token" | "expired" | "artist_deleted" | "not_found" | null;

interface ChatPageProps {
  creator: CoffeeCreator
  pricing: CreatorPricing;
}

// TODO use boolean
function determineFanState(subscriptionStatus: string): FanState {
  if (subscriptionStatus === "active") {
    return "unlimited";
  }
  return "pay_per_message";
}


export default function ChatPage({ pricing, creator }: ChatPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const urlToken = searchParams.get("token");
  const creatorUsername = creator.username
  const supportTheme = creator.support_theme || DEFAULT_SUPPORT_THEME
  const variant = (creator.variant as BrandVariant) || DEFAULT_VARIANT

  // Variant-specific values
  const badgeLabel = getBadgeLabel(variant);

  // Server state
  const [chat, setChat] = useState<CreatorChatResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorState>(null);

  // Local UI state
  const [isSending, setIsSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<{ type: ToastType; message?: string } | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const draftMessageRef = useRef(draftMessage);
  // TODO
  draftMessageRef.current = draftMessage;
  const hasLoadedOnce = useRef(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentModalMode, setPaymentModalMode] = useState<"send_message" | "resubscribe">("send_message");

  // Magic link request state
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [isRequestingMagicLink, setIsRequestingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

  // Subscription management state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Derived state
  const fanState = chat ? determineFanState(chat.subscription.status) : "pay_per_message";

  // Weekly letter budget. Counted from the messages already loaded — the chat
  // returns full history, so this costs no extra request. The server is still
  // the one that enforces it; this only drives what the composer shows.
  const budgetWindow = budgetWindowStart(chat?.subscription.current_period_start ?? null);
  const charsUsedThisPeriod =
    fanState === "unlimited" ? countCharsUsedSince(messages, budgetWindow) : 0;
  const isOutOfLetters =
    fanState === "unlimited" && charsUsedThisPeriod >= WEEKLY_MESSAGE_CHAR_BUDGET;
  const budgetResetsAt = budgetResetAt(
    chat?.subscription.current_period_end ?? null,
    budgetWindow
  );
  const artistName = chat?.artist.name || "Creator";

  // Load chat data
  const loadChat = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Check if we have a stored JWT or use the one from URL (magic link)
    let jwtToken = getChatAuthToken(creatorUsername);

    if (urlToken) {
      routerRef.current.replace(`/auth/chat-recovery?token=${encodeURIComponent(urlToken)}` as Route);
      return;
    }

    try {
      const result = await getCreatorChatByUsername(creatorUsername, jwtToken || undefined);
      if (!result.body) {
        setError("invalid_token");
        setIsLoading(false);
        return;
      }
      setChat(result.body);
      setMessages(result.body.messages);
      setIsLoading(false);
      hasLoadedOnce.current = true;
    } catch (err) {
      captureError(err);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          clearChatAuthToken(creatorUsername);
          setError("expired");
        } else if (err.status === 403) {
          setError("artist_deleted");
        } else if (err.status === 404) {
          setError("not_found");
        } else {
          setError("invalid_token");
        }
      } else {
        setError("invalid_token");
      }
      setIsLoading(false);
    }
  }, [urlToken, creatorUsername, variant]);

  // Initial load
  useEffect(() => {
    setMounted(true);
    loadChat();
  }, [loadChat]);

  // Handle unlimited subscriber send
  /**
   * Returns whether the letter actually sent. The composer keeps the fan's text
   * until this resolves true — a rejected send used to empty the box and drop
   * the optimistic message, losing everything they had written.
   */
  const handleUnlimitedSend = async (content: string): Promise<boolean> => {
    if (!content.trim() || !chat) return false;

    const jwtToken = getChatAuthToken(creatorUsername);
    if (!jwtToken) {
      setToast({ type: "error", message: "Session expired. Please refresh." });
      return false;
    }

    setIsSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      sender_type: "fan",
      content,
      tier: null,
      amount_cents: null,
      currency_code: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);

    let sent = false;
    try {
      const result = await sendChatMessage(chat.chat.id, content, jwtToken);
      // Replace temp message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? result.body! : m))
      );
      sent = true;
    } catch (err) {
      captureError(err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));

      if (err instanceof ApiError) {
        if (err.status === 403) {
          setToast({ type: "error", message: "Active subscription required to send messages" });
        } else if (err.status === 402) {
          setToast({ type: "error", message: err.message || "Buy another note or start weekly Penpal to send more." });
        } else if (err.status === 400) {
          // Validation failure (e.g. over the length cap). Retrying an identical
          // letter fails identically, so show what the server actually objected to.
          setToast({ type: "error", message: err.message });
        } else if (err.status === 401) {
          setToast({ type: "error", message: "Session expired. Please refresh." });
          clearChatAuthToken(creatorUsername);
        } else {
          setToast({ type: "error", message: "Failed to send message. Please try again." });
        }
      } else {
        setToast({ type: "error", message: "Failed to send message. Please try again." });
      }
    }

    setIsSending(false);
    return sent;
  };

  // Handle pay-per-message send - opens payment modal
  const handlePayPerMessageSend = (content: string) => {
    if (!content.trim()) return;
    setPaymentModalMode("send_message");
    setShowPaymentModal(true);
  };

  // Handle payment confirmation (one-time payment)
  const handlePaymentConfirm = async (tier: CoffeeTier, customAmount?: number) => {
    if (!chat) return;

    setIsProcessingPayment(true);

    const currentUrl = window.location.href;
    const chargeAmount = getChargeAmount(pricing, tier, customAmount);

    try {
      const stripeCharge = getStripeCharge(chargeAmount);
      const result = await createCoffeeCheckoutSession({
        creator_username: creatorUsername,
        amount: stripeCharge.amount,
        message: draftMessageRef.current || undefined,
        recurring: false,
        success_url: currentUrl,
        cancel_url: currentUrl,
        product_name: tier.name,
        currency_code: stripeCharge.currency_code,
        email: chat.fan.email,
      });

      // Redirect to Stripe checkout
      const checkoutUrl = result.body?.url;
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL in payment checkout response");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      captureError(err);
      setToast({ type: "error", message: "Failed to create checkout. Please try again." });
      setIsProcessingPayment(false);
    }
  };

  // Handle subscription checkout
  const handleSubscribeAndSend = async (tier: CoffeeTier, customAmount?: number) => {
    if (!chat) return;

    setIsProcessingPayment(true);

    const currentUrl = window.location.href;

    const chargeAmount = getChargeAmount(pricing, tier, customAmount);

    try {
      const stripeCharge = getStripeCharge(chargeAmount);
      const result = await createSubscriptionCheckout({
        username: creatorUsername,
        amount: stripeCharge.amount,
        message: draftMessageRef.current || undefined,
        success_url: currentUrl,
        cancel_url: currentUrl,
        email: chat.fan.email,
        currency_code: stripeCharge.currency_code,
      });

      // Redirect to Stripe checkout
      const checkoutUrl = result.body?.url;
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL in payment checkout response");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      captureError(err);
      setToast({ type: "error", message: "Failed to create checkout. Please try again." });
      setIsProcessingPayment(false);
    }
  };

  // Handle magic link request
  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicLinkEmail.trim() || isRequestingMagicLink) return;

    setIsRequestingMagicLink(true);
    setMagicLinkError(null);

    try {
      await requestChatMagicLink(creatorUsername, magicLinkEmail.trim());
      setMagicLinkSent(true);
    } catch (err) {
      captureError(err);
      if (err instanceof ApiError && err.status === 404) {
        setError("not_found");
        return;
      } else {
        setMagicLinkError("Something went wrong. Please try again.");
      }
    }
    setIsRequestingMagicLink(false);
  };


  // Handle content unlock checkout
  const handleUnlockContent = async (messageId: string) => {
    if (!chat) return;

    const currentUrl = window.location.href;
    try {
      const result = await createContentUnlockCheckout({
        message_uuid: messageId,
        success_url: currentUrl,
        cancel_url: currentUrl,
        email: chat.fan.email,
      });

      const checkoutUrl = result.body?.url;
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL in content unlock response");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      captureError(err);
      setToast({ type: "error", message: "Failed to create checkout. Please try again." });
    }
  };

  const handleResubscribe = () => {
    setPaymentModalMode("resubscribe");
    setShowPaymentModal(true);
  };

  // =============================================================================
  // LOADING STATE
  // =============================================================================
  if (isLoading) {
    return (
      <PageWrapper mounted={mounted}>
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-stone-200 border-t-amber-400 rounded-full animate-spin" />
          </div>
          <p className="text-stone-400 text-sm tracking-wide">Loading conversation...</p>
        </div>
      </PageWrapper>
    );
  }

  // =============================================================================
  // ERROR STATES
  // =============================================================================
  if (error === "expired" || error === "invalid_token") {
    return (
      <PageWrapper mounted={mounted}>
        <div className="flex flex-col items-center justify-center h-full px-8">
          <div className="w-full max-w-sm">
            {magicLinkSent ? (
              <>
                <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-green-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-stone-900 text-center mb-2">
                  Check your email
                </h1>
                <p className="text-stone-500 text-center text-sm leading-relaxed">
                  We sent a magic link to <span className="font-medium text-stone-700">{magicLinkEmail}</span>. Click the link to access your chat.
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-stone-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>

                <h1 className="text-2xl font-bold text-stone-900 text-center mb-2">
                  {error === "expired" ? "Link expired" : "Access your chat"}
                </h1>
                <p className="text-stone-500 text-center text-sm leading-relaxed mb-6">
                  Enter your email to receive a new magic link.
                </p>

                <form onSubmit={handleRequestMagicLink} className="space-y-3">
                  <input
                    type="email"
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-900 text-sm
                      placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    required
                  />

                  {magicLinkError && (
                    <p className="text-red-500 text-xs text-center">{magicLinkError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isRequestingMagicLink || !magicLinkEmail.trim()}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold
                      transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    style={{
                      background: "linear-gradient(145deg, #fbbf24, #f59e0b)",
                      boxShadow: "0 2px 12px rgba(245, 158, 11, 0.2)"
                    }}
                  >
                    {isRequestingMagicLink ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      "Send magic link"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <BrandFooter />
        </div>
      </PageWrapper>
    );
  }

  if (error === "not_found") {
    return (
      <PageWrapper mounted={mounted}>
        <div className="flex flex-col items-center justify-center h-full px-8">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-stone-100 flex items-center justify-center text-2xl">
              💬
            </div>

            <h1 className="text-2xl font-bold text-stone-900 mb-2">
              No chat found
            </h1>
            <p className="text-stone-500 text-sm leading-relaxed mb-6">
              Send {creator.name || creator.username} a note to start a conversation.
            </p>
            <a
              href={getCreatorVariantPage(creator.username, variant)}
              className="inline-block px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: "#FDE68A", color: "#92400E" }}
            >
              Write a note
            </a>
          </div>

          <BrandFooter />
        </div>
      </PageWrapper>
    );
  }

  if (error === "artist_deleted") {
    return (
      <PageWrapper mounted={mounted}>
        <div className="flex flex-col items-center justify-center h-full px-8">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-stone-100 flex items-center justify-center text-2xl">
              👋
            </div>

            <h1 className="text-2xl font-bold text-stone-900 mb-2">
              Conversation unavailable
            </h1>
            <p className="text-stone-500 text-sm leading-relaxed">
              This conversation is no longer available.
            </p>
          </div>

          <BrandFooter />
        </div>
      </PageWrapper>
    );
  }

  // =============================================================================
  // MAIN CHAT VIEW
  // =============================================================================
  if (!chat) {
    return (
      <PageWrapper mounted={mounted}>
        <div className="flex flex-col items-center justify-center h-full px-8">
          <p className="text-stone-500">Something went wrong</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-amber-600 font-medium hover:text-amber-700 underline underline-offset-2 transition-colors"
          >
            Refresh
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper mounted={mounted}>
      <div className="relative flex flex-col h-full">
        {/* Header */}
        <ChatHeader
          artistName={chat.artist.name}
          artistAvatarUrl={chat.artist.avatar_url}
          responsePromise={chat.artist.response_promise}
          creatorUsername={creatorUsername}
          subscriptionStatus={chat.subscription.status as "none" | "active" | "cancelled"}
          onSettingsClick={() => setShowSubscriptionModal(true)}
          variant={variant}
        />

        {/* Subscription Banner - show when paused or cancelled */}
        {(chat.subscription.status === "cancelled") && (
          <SubscriptionBanner
            artistName={chat.artist.name}
            onResubscribe={handleResubscribe}
            variant={variant}
          />
        )}

        {/* Messages */}
        <MessageList messages={messages} variant={variant} onUnlockContent={handleUnlockContent} />

        {/* Input — replaced by a warm close-out once the week's letters are spent */}
        {isOutOfLetters ? (
          <WeeklyLimitNotice artistName={chat.artist.name} resetsAt={budgetResetsAt} />
        ) : (
          <ChatInput
            fanState={fanState}
            artistName={chat.artist.name}
            subscriptionTier={chat.subscription.tier}
            onPayPerMessageSend={handlePayPerMessageSend}
            onUnlimitedSend={handleUnlimitedSend}
            isSending={isSending}
            charsUsedThisPeriod={charsUsedThisPeriod}
            preservedMessage=""
            variant={variant}
            onMessageChange={setDraftMessage}
          />
        )}

        <BrandFooter compact />

        {/* Toast */}
        {toast && (
          <Toast
            type={toast.type}
            artistName={artistName}
            onDismiss={() => setToast(null)}
            message={toast.message}
            variant={badgeLabel}
          />
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          artistName={chat.artist.name}
          messageContent={draftMessage}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentModalMode("send_message");
          }}
          onConfirm={handlePaymentConfirm}
          onSubscribeAndSend={handleSubscribeAndSend}
          isLoading={isProcessingPayment}
          mode={paymentModalMode}
          variant={variant}
          pricing={pricing}
          supportTheme={supportTheme}
        />

        {/* Subscription Settings Modal */}
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          artistName={chat.artist.name}
          tier={chat.subscription.tier}
          amountInCents={chat.subscription.amount_in_cents}
          currencyCode={chat.subscription.currency_code}
          currentPeriodEnd={chat.subscription.current_period_end}
          subscriptionUuid={chat.subscription.subscription_uuid}
          jwtToken={getChatAuthToken(creatorUsername)}
          onClose={() => setShowSubscriptionModal(false)}
          variant={variant}
        />
      </div>
    </PageWrapper>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PageWrapper({
  children,
  mounted,
}: {
  children: React.ReactNode;
  mounted: boolean;
}) {
  return (
    <div
      className={`${inter.variable} w-full h-[100dvh] flex items-center justify-center p-0 sm:p-6`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      {/* Warm cream background - hidden on mobile, visible on desktop */}
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background: "#f5f2ed",
          backgroundImage: "linear-gradient(165deg, #faf8f4 0%, #f0ebe3 100%)"
        }}
      />

      {/* Chat card container */}
      <div
        className={`
          relative w-full h-full
          sm:max-w-[460px] sm:max-h-[780px]
          bg-white flex flex-col
          rounded-none sm:rounded-[32px]
          overflow-hidden
          transform transition-all duration-500
          sm:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)]
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        {/* Top gradient border effect - desktop only */}
        <div
          className="absolute inset-0 rounded-inherit pointer-events-none hidden sm:block"
          style={{
            borderRadius: "inherit",
            padding: "1px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 50%)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude"
          }}
        />
        {children}
      </div>
    </div>
  );
}

function BrandFooter({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "pb-3" : "absolute bottom-6 left-0 right-0"}`}>
      <a
        href="https://hotly.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-stone-300 font-semibold tracking-[0.12em] uppercase hover:text-stone-400 transition-colors"
      >
        Hotly
      </a>
    </div>
  );
}

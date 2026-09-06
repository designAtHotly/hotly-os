"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Inter } from "next/font/google";
import { SortOption, TabOption } from "@/types/dashboard.types";
import { ThreadCard } from "./ThreadCard";
import { TabsBar } from "./TabsBar";
import { EmptyState } from "./EmptyState";
import { CompletionCard } from "./CompletionCard";
import { DashboardHeader } from "./DashboardHeader";
import SettingsModal from "./SettingsModal";
import {
  replyToMessage,
  fetchCreatorDashboard,
  fetchCreatorPricing,
  ApiCreatorChat,
  AuthCreator,
  ChatAttachmentRequest,
} from "@/lib/api";
import { blockChat, unblockChat } from "@/lib/api/chat";
import { CreatorPricing, SupportTheme } from "@/types/coffee.types";
import { captureError } from "@/lib/utils/error-handler";
import { toastError } from "@/lib/utils/toast";
import { getBadgeLabel, getPluralLabel, DEFAULT_VARIANT } from "@/lib/utils/variant";
import { getCreatorVariantShareUrl } from "@/lib/utils/page-helper";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

interface PenpalDashboardScreenProps {
  creator: AuthCreator;
  onLogout?: () => void;
  hideHeader?: boolean;
  embedded?: boolean;
}

export function PenpalDashboardScreen({
  creator,
  onLogout,
  hideHeader = false,
  embedded = false,
}: PenpalDashboardScreenProps) {
  const [supportTheme, setSupportTheme] = useState(creator.support_theme || "coffee");
  const [displayName, setDisplayName] = useState(creator.name || "");
  const [description, setDescription] = useState(creator.bio || "");
  const chatAttachmentPolicy = creator.chat_attachment_policy || "none";
  const variant = creator.variant || DEFAULT_VARIANT
  const badgeLabel = getBadgeLabel(variant);

  // Data - chats with last message
  const [chats, setChats] = useState<ApiCreatorChat[]>([]);
  const [pricing, setPricing] = useState<CreatorPricing | null>(null);
  const [loading, setLoading] = useState(true);

  // UI
  const [activeTab, setActiveTab] = useState<TabOption>("needs-reply");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Progress tracking
  const [repliedCount, setRepliedCount] = useState(0);
  const [showCompletionCard, setShowCompletionCard] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const firstInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [response, creatorPricing] = await Promise.all([
        fetchCreatorDashboard(),
        fetchCreatorPricing(creator.username),
      ]);
      if (response.body) {
        setChats(response.body.chats || []);
      }
      setPricing(creatorPricing);
    } catch (err) {
      captureError(err, { action: 'load_dashboard', component: 'PenpalDashboardScreen' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if chat needs reply (last message is from fan, not creator)
  const chatNeedsReply = useCallback((chat: ApiCreatorChat) => {
    if (!chat.last_message_uuid) return false;
    return chat.last_message_sender_id === chat.fan_user_id;
  }, []);

  // Filter and sort chats by tab
  const sortedChats = useMemo(() => {
    const unblocked = (chats || []).filter(c => !c.blocked_at);
    const blocked = (chats || []).filter(c => !!c.blocked_at);

    // Filter by tab first
    const filtered = activeTab === "needs-reply"
      ? unblocked.filter(chatNeedsReply)
      : activeTab === "blocked"
        ? blocked
        : unblocked;

    // Default sort: needs-reply = oldest first (longest waiting), all = newest first
    const defaultSort = activeTab === "needs-reply" ? "oldest" : "newest";
    const effectiveSort = sortBy || defaultSort;

    return [...filtered].sort((a, b) => {
      const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;

      switch (effectiveSort) {
        case "newest": return bUpdated - aUpdated;
        case "oldest": return aUpdated - bUpdated;
        case "highest-tip":
        case "lowest-tip":
          return effectiveSort === "highest-tip"
            ? (b.total_paid_cents || 0) - (a.total_paid_cents || 0)
            : (a.total_paid_cents || 0) - (b.total_paid_cents || 0);
        case "most-given": return (b.total_paid_cents || 0) - (a.total_paid_cents || 0);
        case "least-given": return (a.total_paid_cents || 0) - (b.total_paid_cents || 0);
        case "penpals-first":
          // Penpals first, then by oldest first within each group
          if (a.is_subscriber !== b.is_subscriber) {
            return a.is_subscriber ? -1 : 1;
          }
          return aUpdated - bUpdated;
        default:
          // Fallback based on tab
          return activeTab === "needs-reply" ? aUpdated - bUpdated : bUpdated - aUpdated;
      }
    });
  }, [chats, sortBy, activeTab, chatNeedsReply]);

  // Count chats that need reply / are blocked
  const needsReplyCount = (chats || []).filter(c => !c.blocked_at && chatNeedsReply(c)).length;
  const blockedCount = (chats || []).filter(c => !!c.blocked_at).length;
  const blockedUnrepliedCount = (chats || []).filter(c => !!c.blocked_at && chatNeedsReply(c)).length;


  // Reply handler - called from ThreadCard with message content
  const handleSendReply = useCallback(async (messageUuid: string, fanUserId: number, content: string, attachments?: ChatAttachmentRequest[], priceInCents?: number, priceCurrencyCode?: string): Promise<boolean> => {
    const isLastOne = needsReplyCount === 1;

    try {
      const response = await replyToMessage(messageUuid, content, attachments, priceInCents, priceCurrencyCode);

      if (response.body) {
        const replied = response.body;
        setRepliedCount(prev => prev + 1);
        // Update the chat to reflect the reply (instead of removing it)
        setChats(prev => prev.map(c => {
          if (c.fan_user_id !== fanUserId) return c;
          const now = new Date().toISOString();
          return {
            ...c,
            last_message_sender_id: creator.user_id,
            last_message_content: content,
            last_message_created_at: now,
            updated_at: now,
            last_message_attachments: replied.attachments,
          };
        }));
        if (isLastOne) setShowCompletionCard(true);
        return true;
      }
      toastError("Failed to send reply. Please try again.");
      return false;
    } catch (err) {
      captureError(err, { action: 'reply_to_message', component: 'PenpalDashboardScreen' });
      toastError("Failed to send reply. Please try again.");
      return false;
    }
  }, [needsReplyCount, creator.user_id]);

  const handleBlockChat = useCallback(async (chatId: number, chatUuid: string) => {
    await blockChat(chatUuid);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, blocked_at: new Date().toISOString() } : c));
  }, []);

  const handleUnblockChat = useCallback(async (chatId: number, chatUuid: string) => {
    await unblockChat(chatUuid);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, blocked_at: null } : c));
  }, []);


  // Hide completion card when new chats come in
  useEffect(() => {
    if (chats.length > 0) setShowCompletionCard(false);
  }, [chats.length]);

  // Auto-select first card in needs-reply tab
  useEffect(() => {
    if (activeTab === "needs-reply" && sortedChats.length > 0 && !loading) {
      setActiveChatId(sortedChats[0].id);
      setTimeout(() => firstInputRef.current?.focus(), 150);
    } else if (activeTab !== "needs-reply") {
      setActiveChatId(null);
    }
  }, [activeTab, loading, sortedChats.length > 0 ? sortedChats[0]?.id : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select next card and focus after sending a reply
  const prevRepliedCount = useRef(repliedCount);
  useEffect(() => {
    if (repliedCount > prevRepliedCount.current && needsReplyCount > 0) {
      // Select the first card in the updated sorted list (which is now the "next" card)
      if (sortedChats.length > 0) {
        setActiveChatId(sortedChats[0].id);
      }
      setTimeout(() => firstInputRef.current?.focus(), 150);
    }
    prevRepliedCount.current = repliedCount;
  }, [repliedCount, needsReplyCount, sortedChats]);

  // Utilities
  const getShareLink = () => {
    if (typeof window === "undefined") return "";
    return getCreatorVariantShareUrl(creator.username, variant);
  };

  if (loading) {
    return (
      <div className={`w-full ${embedded ? "" : "min-h-[100dvh]"} bg-[#faf8f5] flex items-center justify-center`}>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`${inter.variable} w-full ${embedded ? "" : "min-h-[100dvh] bg-[#faf8f5]"}`} style={{ fontFamily: "var(--font-sans)" }}>
      <div className={`max-w-2xl mx-auto ${embedded ? "px-4 pt-6 md:px-6 md:pt-8" : "px-4 py-6 md:px-6 md:py-8"}`}>

        {/* Header — hidden on mobile when embedded (shell header covers it) */}
        {!hideHeader && (
          <div className={embedded ? "hidden lg:block" : ""}>
            <DashboardHeader shareLink={getShareLink()} onLogout={onLogout} variant={variant} onOpenSettings={() => setShowSettingsModal(true)} />
          </div>
        )}

        {/* Tabs + Sort */}
        <TabsBar
          activeTab={activeTab}
          sortBy={sortBy}
          needsReplyCount={needsReplyCount}
          blockedCount={blockedCount}
          blockedUnrepliedCount={blockedUnrepliedCount}
          showSortDropdown={showSortDropdown}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSortBy(tab === "needs-reply" ? "oldest" : "newest");
          }}
          onSortChange={setSortBy}
          onToggleSortDropdown={() => setShowSortDropdown(!showSortDropdown)}
          onCloseSortDropdown={() => setShowSortDropdown(false)}
          variant={getPluralLabel(variant)}
        />

        {/* Cards */}
        <div className="space-y-3">
          {/* Completion card - only in needs-reply tab */}
          {showCompletionCard && activeTab === "needs-reply" && (
            <CompletionCard repliedCount={repliedCount} />
          )}

          {/* Empty State - don't show if completion card is visible */}
          {sortedChats.length === 0 && !showCompletionCard && (
            <EmptyState activeTab={activeTab} />
          )}

          {/* Chat Cards */}
          {sortedChats.map((chat, chatIndex) => (
            <ThreadCard
              key={chat.fan_user_id}
              chat={chat}
              creatorUserId={creator.user_id}
              isFirst={chatIndex === 0}
              firstInputRef={firstInputRef}
              onSendReply={handleSendReply}
              isActive={activeChatId === chat.id}
              onActivate={() => setActiveChatId(chat.id)}
              onDeactivate={() => setActiveChatId(null)}
              variant={badgeLabel}
              chatAttachmentPolicy={chatAttachmentPolicy}
              pricing={pricing ?? undefined}
              onBlock={() => handleBlockChat(chat.id, chat.uuid)}
              onUnblock={() => handleUnblockChat(chat.id, chat.uuid)}
            />
          ))}
        </div>
      </div>

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        displayName={displayName}
        description={description}
        supportTheme={(supportTheme as SupportTheme) || "coffee"}
        pricing={pricing ?? { currencyCode: "usd", price_250: 500, price_500: 500, price_1000: 500, weekly_price_cents: 1500, character_limit: 250 }}
        onSaved={(updates) => {
          setDisplayName(updates.displayName);
          setDescription(updates.description);
          setSupportTheme(updates.supportTheme);
          setPricing(updates.pricing);
        }}
      />
    </div>
  );
}

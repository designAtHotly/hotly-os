"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ApiCreatorChat, ApiChatMessage, ChatMessageAttachment, fetchChatMessages, ChatAttachmentRequest } from "@/lib/api";
import { CreatorPricing } from "@/types/coffee.types";
import { beautifyAmount } from "@/lib/utils/chat";
import { captureError } from "@/lib/utils/error-handler";
import { AttachmentViewer, Attachment } from "./AttachmentViewer";
import { ThreadReplyInput } from "./ThreadReplyInput";
import { ConfirmBlockDialog } from "./ConfirmBlockDialog";

// Constants
const MS_PER_DAY = 86400000;
const SCROLL_DELAY_MS = 50;
const WARNING_DAYS = 5;
const CRITICAL_DAYS = 7;

// Utility functions
const getWaitingDays = (date: Date) => Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);

const formatWaitingTime = (date: Date) => {
  const days = getWaitingDays(date);
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  return `${Math.floor(days / 7)}w`;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};


// TODO
function AttachmentPreview({ attachments }: { attachments?: ChatMessageAttachment[] }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!attachments || attachments.length === 0) return null;

  const viewableAttachments: Attachment[] = attachments
    .filter(a => (a.type === "image" || a.type === "video") && a.signed_url)
    .map(a => ({
      url: a.signed_url!,
      type: a.type as "image" | "video",
      name: a.filename,
    }));

  const getViewerIndex = (idx: number) => {
    const attachment = attachments[idx];
    if (attachment.type !== "image" && attachment.type !== "video") return -1;
    return viewableAttachments.findIndex(v => v.url === attachment.signed_url);
  };

  const handleClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const vi = getViewerIndex(index);
    if (vi >= 0) {
      setSelectedIndex(vi);
      setViewerOpen(true);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((attachment, index) => (
          <div key={index}>
            {attachment.type === "image" ? (
              <button type="button" onClick={e => handleClick(index, e)} className="group cursor-pointer">
                <div className="w-[120px] h-[90px] rounded-lg overflow-hidden bg-stone-100 border border-stone-200 group-hover:border-amber-400 transition-colors">
                  <img src={attachment.signed_url} alt={attachment.filename || "Attachment"} className="w-full h-full object-cover" />
                </div>
              </button>
            ) : attachment.type === "video" && attachment.signed_thumbnail_url ? (
              <button type="button" onClick={e => handleClick(index, e)} className="group cursor-pointer">
                <div className="relative w-[120px] h-[90px] rounded-lg overflow-hidden bg-stone-100 border border-stone-200 group-hover:border-amber-400 transition-colors">
                  <img src={attachment.signed_thumbnail_url} alt={attachment.filename || "Video"} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-black/70 transition-colors">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                </div>
              </button>
            ) : attachment.type === "video" ? (
              <button type="button" onClick={e => handleClick(index, e)} className="group cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 rounded-lg group-hover:bg-amber-50 transition-colors">
                  <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-stone-600 truncate max-w-[150px]">{attachment.filename || "Video"}</span>
                </div>
              </button>
            ) : (
              <a href={attachment.signed_url} target="_blank" rel="noopener noreferrer" className="group" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 rounded-lg group-hover:bg-amber-50 transition-colors">
                  <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-sm text-stone-600 truncate max-w-[150px]">{attachment.filename || "File"}</span>
                </div>
              </a>
            )}
          </div>
        ))}
      </div>
      <AttachmentViewer
        attachments={viewableAttachments}
        initialIndex={selectedIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

// ============================================
// MessageBubble Component
// ============================================
interface MessageBubbleProps {
  message: ApiChatMessage;
  showDate: boolean;
  dateLabel: string;
}

function MessageBubble({ message, showDate, dateLabel }: MessageBubbleProps) {
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div className={`flex items-end gap-2 ${message.is_creator ? 'flex-row-reverse' : ''}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${message.is_creator
        ? 'bg-amber-100 rounded-br-sm'
        : 'bg-white rounded-bl-sm shadow-sm'
        }`}>
        {message.content && (
          <p className={`text-sm leading-relaxed ${message.is_creator ? 'text-amber-900' : 'text-stone-700'}`}>
            {message.content}
          </p>
        )}
        {hasAttachments && (
          <AttachmentPreview attachments={message.attachments} />
        )}
      </div>
      {showDate && (
        <span className="text-[10px] text-stone-400 pb-1 flex-shrink-0">
          {dateLabel}
        </span>
      )}
    </div>
  );
}

// ============================================
// HistoryToggle Component
// ============================================
interface HistoryToggleProps {
  isExpanded: boolean;
  prevMessageContent: string | null;
  prevMessageIsCreator: boolean;
  onToggle: () => void;
  expandedLabel?: string;
  collapsedLabel?: string;
  isActive?: boolean;
}

function HistoryToggle({
  isExpanded,
  prevMessageContent,
  prevMessageIsCreator,
  onToggle,
  expandedLabel = "Hide history",
  collapsedLabel = "View history",
  isActive = false,
}: HistoryToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-stone-50 transition-colors border-b border-stone-100"
    >
      {!isExpanded && prevMessageContent ? (
        <p className="text-sm text-stone-400 truncate text-left pr-4 flex-1">
          {prevMessageIsCreator && <span className="text-amber-600 font-medium">You: </span>}
          {prevMessageContent}
        </p>
      ) : (
        <p className="text-sm text-stone-400">
          {isExpanded ? expandedLabel : collapsedLabel}
        </p>
      )}
      <span
        className={`flex-shrink-0 transition-all duration-200 rounded-full ${isExpanded ? '' : isActive ? 'bg-amber-100 p-1.5' : ''}`}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-stone-400' : isActive ? 'text-amber-600' : 'text-stone-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>
  );
}

// ============================================
// HistoryDrawer Component
// ============================================
interface HistoryDrawerProps {
  isExpanded: boolean;
  isLoading: boolean;
  messages: ApiChatMessage[];
  historyRef: React.RefObject<HTMLDivElement | null>;
  maxHeight?: string;
}

function HistoryDrawer({
  isExpanded,
  isLoading,
  messages,
  historyRef,
  maxHeight = "240px",
}: HistoryDrawerProps) {
  const containerMaxHeight = parseInt(maxHeight) + 20;

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-out"
      style={{ maxHeight: isExpanded ? containerMaxHeight : 0 }}
    >
      <div
        ref={historyRef}
        className="px-5 py-3 bg-stone-50/70 border-b border-stone-100 overflow-y-auto"
        style={{ maxHeight }}
      >
        {isLoading ? (
          <div className="text-sm text-stone-400 py-2">Loading...</div>
        ) : messages.length > 0 ? (
          <div className="space-y-2">
            {messages.map((msg, index) => {
              const msgDate = formatDate(new Date(msg.created_at));
              const prevDate = index > 0 ? formatDate(new Date(messages[index - 1].created_at)) : null;
              const showDate = index === 0 || prevDate !== msgDate;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  showDate={showDate}
                  dateLabel={msgDate}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-stone-400 py-2">No previous messages</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// BlockButton Component — icon only, confirmation handled by parent dialog
// ============================================
function BlockButton({ onBlock }: { onBlock?: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onBlock?.(); }}
      title="Block user"
      className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </button>
  );
}

function UnblockButton({ onUnblock }: { onUnblock?: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onUnblock?.(); }}
      title="Unblock user"
      className="px-2 py-1 rounded-lg text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
    >
      Unblock
    </button>
  );
}

// ============================================
// ThreadCard Component
// ============================================
export interface ThreadCardProps {
  chat: ApiCreatorChat;
  creatorUserId: number;
  isFirst: boolean;
  firstInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSendReply: (messageUuid: string, fanUserId: number, content: string, attachments?: ChatAttachmentRequest[], priceInCents?: number, priceCurrencyCode?: string) => Promise<boolean>;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  variant?: string;
  chatAttachmentPolicy?: string;
  pricing?: CreatorPricing;
  onBlock?: () => void;
  onUnblock?: () => void;
}

export function ThreadCard({
  chat,
  creatorUserId,
  isFirst,
  firstInputRef,
  onSendReply,
  isActive,
  onActivate,
  // onDeactivate, // TODO: Re-enable for follow-up messages feature
  variant = "Penpal",
  chatAttachmentPolicy,
  pricing,
  onBlock,
  onUnblock,
}: ThreadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const canAttach = chatAttachmentPolicy === "creator";

  const fanName = chat.fan_name || "Fan";
  // TODO safe case
  const fanInitials = fanName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const needsReply = Boolean(chat.last_message_uuid && chat.last_message_sender_id === chat.fan_user_id);

  // Sneak peek: second-to-last message from API (available immediately without loading)
  // Show history if prev message has content or if last message has attachments (indicating conversation activity)
  const hasPrevMessage = Boolean(chat.prev_message_content) || Boolean(chat.last_message_attachments?.length);
  const prevMessageIsCreator = chat.prev_message_sender_id === creatorUserId;

  const loadMessages = useCallback(async () => {
    if (hasLoadedMessages || isLoadingMessages) return;

    setIsLoadingMessages(true);
    try {
      const response = await fetchChatMessages(chat.uuid);
      if (response.body) {
        setMessages(response.body);
      }
    } catch (err) {
      captureError(err, { action: 'load_messages', component: 'ThreadCard' });
    } finally {
      setIsLoadingMessages(false);
      setHasLoadedMessages(true);
    }
  }, [chat.id, hasLoadedMessages, isLoadingMessages]);

  const handleToggleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && !hasLoadedMessages) {
      loadMessages();
    }
  };

  // Scroll to bottom when expanded
  useEffect(() => {
    if (isExpanded && historyRef.current) {
      setTimeout(() => {
        if (historyRef.current) {
          historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
      }, SCROLL_DELAY_MS);
    }
  }, [isExpanded, messages]);

  const lastMessageDate = chat.last_message_created_at ? new Date(chat.last_message_created_at) : null;
  const waitingTime = needsReply && lastMessageDate ? formatWaitingTime(lastMessageDate) : null;
  const waitingDays = lastMessageDate ? getWaitingDays(lastMessageDate) : 0;
  const chatCreatedDate = new Date(chat.created_at);

  // History messages (exclude current/last exchange)
  // In needs-reply: exclude only the last message (the one being replied to)
  // In replied: exclude last 2 messages (fan message + creator reply shown in main content)
  const historyMessages = needsReply
    ? messages.slice(0, -1)
    : messages.slice(0, -2);

  // Determine if there's history to show (used for both replied and needs-reply states)
  const hasHistory = hasLoadedMessages
    ? historyMessages.length > 0
    : hasPrevMessage; // Use prev_message as indicator before loading

  // ============================================
  // REPLIED STATE
  // ============================================
  if (!needsReply) {
    return (
      <div
        className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all ${isActive ? "shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_4px_20px_rgba(251,191,36,0.15)]" : "shadow-sm hover:shadow-md"}`}
        onClick={onActivate}
      >
        {/* History toggle - only show if there are previous messages */}
        {hasHistory && (
          <>
            <HistoryToggle
              isExpanded={isExpanded}
              prevMessageContent={chat.prev_message_content}
              prevMessageIsCreator={prevMessageIsCreator}
              onToggle={handleToggleExpand}
              expandedLabel="Hide history"
              collapsedLabel="View history"
              isActive={isActive}
            />

            {/* History drawer */}
            <HistoryDrawer
              isExpanded={isExpanded}
              isLoading={isLoadingMessages}
              messages={historyMessages}
              historyRef={historyRef}
              maxHeight="220px"
            />
          </>
        )}

        {/* Main content */}
        <div className="p-5">
          {/* Fan's message (what the creator replied to) */}
          {chat.last_fan_message_content && (
            <p className="text-base text-stone-700 leading-relaxed mb-3">
              {chat.last_fan_message_content}
            </p>
          )}

          {/* Creator's reply - highlighted */}
          {(chat.last_message_content || (chat.last_message_attachments && chat.last_message_attachments.length > 0)) && (
            <div className="bg-amber-50 rounded-xl px-4 py-3 mb-4 border-l-2 border-amber-400">
              {chat.last_message_content ? (
                <p className="text-base text-amber-900 leading-relaxed">
                  <span className="text-amber-600 font-medium">You: </span>
                  {chat.last_message_content}
                </p>
              ) : (
                <p className="text-sm text-amber-600 font-medium">You sent:</p>
              )}
              {chat.last_message_attachments && chat.last_message_attachments.length > 0 && (
                <AttachmentPreview attachments={chat.last_message_attachments} />
              )}
            </div>
          )}

          {/* Person row */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-stone-500">{fanInitials}</span>
            </div>
            <span className="font-medium text-stone-600">{fanName}</span>
            {chat.is_subscriber && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase text-amber-600 bg-amber-50">
                {variant}
              </span>
            )}
            <span className="text-stone-300">·</span>
            <span className="text-stone-400">{beautifyAmount(chat.total_paid_cents, chat.currency_code)}</span>
            <span className="flex-1" />
            <span className="text-stone-400 text-xs flex items-center gap-1.5">
              {!chat.blocked_at && (
                <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {chat.blocked_at ? formatDate(new Date(chat.blocked_at)) : `Replied ${formatDate(lastMessageDate || chatCreatedDate)}`}
            </span>
            {!chat.blocked_at && (
              <BlockButton onBlock={() => setShowBlockDialog(true)} />
            )}
            {chat.blocked_at && (
              <UnblockButton onUnblock={onUnblock} />
            )}
          </div>

          {!chat.blocked_at && isActive && chat.last_message_uuid && (
            <div className="mt-4" onClick={(e) => e.stopPropagation()}>
              <ThreadReplyInput
                chatUuid={chat.uuid}
                lastMessageUuid={chat.last_message_uuid}
                fanUserId={chat.fan_user_id}
                fanName={fanName}
                isActive={isActive}
                isFirst={isFirst}
                firstInputRef={firstInputRef}
                canAttach={canAttach}
                pricing={pricing}
                onSendReply={onSendReply}
              />
            </div>
          )}
        </div>

        <ConfirmBlockDialog
          isOpen={showBlockDialog}
          fanName={fanName}
          onCancel={() => setShowBlockDialog(false)}
          onConfirm={async () => {
            await onBlock?.();
            setShowBlockDialog(false);
          }}
        />
      </div>
    );
  }

  // ============================================
  // NEEDS REPLY STATE
  // ============================================
  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all ${isActive ? "shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_4px_20px_rgba(251,191,36,0.15)]" : "shadow-sm hover:shadow-md"}`}
      onClick={onActivate}
    >
      {/* History toggle - only show if there are previous messages */}
      {hasHistory && (
        <>
          <HistoryToggle
            isExpanded={isExpanded}
            prevMessageContent={chat.prev_message_content}
            prevMessageIsCreator={prevMessageIsCreator}
            onToggle={handleToggleExpand}
            expandedLabel="Hide conversation"
            collapsedLabel="View conversation"
            isActive={isActive}
          />

          {/* History drawer - uses historyMessages (excludes last message being replied to) */}
          <HistoryDrawer
            isExpanded={isExpanded}
            isLoading={isLoadingMessages}
            messages={historyMessages}
            historyRef={historyRef}
            maxHeight="260px"
          />
        </>
      )}

      {/* Main content */}
      <div className="p-5">
        {/* Current message */}
        {chat.last_message_content ? (
          <p className="text-lg text-stone-900 leading-relaxed mb-4">
            {chat.last_message_content}
          </p>
        ) : !(chat.last_message_attachments && chat.last_message_attachments.length > 0) && (
          <p className="text-lg text-stone-400 italic leading-relaxed mb-4">No messages yet</p>
        )}

        {/* Last message attachments */}
        {chat.last_message_attachments && chat.last_message_attachments.length > 0 && (
          <div className="mb-4">
            <AttachmentPreview attachments={chat.last_message_attachments} />
          </div>
        )}

        {/* Person row */}
        <div className="flex items-center gap-2 text-sm mb-4">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-amber-700">{fanInitials}</span>
          </div>
          <span className="font-medium text-stone-700">{fanName}</span>
          {chat.is_subscriber ? (
            <>
              <span className="text-stone-300">·</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase text-amber-600 bg-amber-50">
                {variant} {chat.subscription_amount_cents ? beautifyAmount(chat.subscription_amount_cents, chat.currency_code) : ''}
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-400">{beautifyAmount(chat.total_paid_cents, chat.currency_code)}</span>
            </>
          ) : (
            <>
              <span className="text-stone-300">·</span>
              {chat.last_message_payment_cents ? (
                <>
                  <span className="text-amber-600 font-medium">
                    ❤️ {beautifyAmount(chat.last_message_payment_cents, chat.currency_code)}
                    {chat.last_message_product_name && ` ${chat.last_message_product_name}`}
                  </span>
                  {chat.total_paid_cents > (chat.last_message_payment_cents || 0) && (
                    <>
                      <span className="text-stone-300">·</span>
                      <span className="text-stone-400">{beautifyAmount(chat.total_paid_cents, chat.currency_code)}</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-stone-400">{beautifyAmount(chat.total_paid_cents, chat.currency_code)}</span>
              )}
            </>
          )}
          <span className="flex-1" />
          {waitingTime && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${waitingDays >= CRITICAL_DAYS
              ? "bg-red-50 text-red-600"
              : waitingDays >= WARNING_DAYS
                ? "bg-amber-50 text-amber-600"
                : "bg-stone-100 text-stone-500"
              }`}>
              {waitingTime}
            </span>
          )}
          {!chat.blocked_at && (
            <BlockButton onBlock={() => setShowBlockDialog(true)} />
          )}
          {chat.blocked_at && (
            <UnblockButton onUnblock={onUnblock} />
          )}
        </div>

        {/* Reply input - only show when active and not blocked */}
        {!chat.blocked_at && isActive && chat.last_message_uuid && (
          <ThreadReplyInput
            chatUuid={chat.uuid}
            lastMessageUuid={chat.last_message_uuid}
            fanUserId={chat.fan_user_id}
            fanName={fanName}
            isActive={isActive}
            isFirst={isFirst}
            firstInputRef={firstInputRef}
            canAttach={canAttach}
            pricing={pricing}
            onSendReply={onSendReply}
          />
        )}
      </div>

      <ConfirmBlockDialog
        isOpen={showBlockDialog}
        fanName={fanName}
        onCancel={() => setShowBlockDialog(false)}
        onConfirm={async () => {
          await onBlock?.();
          setShowBlockDialog(false);
        }}
      />
    </div>
  );
}
"use client";

import { useRef, useEffect, useState } from "react";
import { Message, MessageAttachment } from "@/types/subscriber.types";
import { HeartIcon, getTierLabel, formatRelativeTime, beautifyAmount } from "@/lib/utils/chat";
import { BrandVariant, DEFAULT_VARIANT, getBadgeLabel, getVariantColorTheme } from "@/lib/utils/variant";
import { AttachmentViewer, Attachment } from "@/components/creator/dashboard/AttachmentViewer";

interface MessageListProps {
  messages: Message[];
  variant?: BrandVariant;
  onUnlockContent?: (messageId: string) => Promise<void>;
}

export default function MessageList({ messages, variant = DEFAULT_VARIANT, onUnlockContent }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Use instant scroll on initial load, smooth scroll for new messages
    const behavior = isInitialMount.current ? "instant" : "smooth";
    messagesEndRef.current?.scrollIntoView({ behavior });
    isInitialMount.current = false;
  }, [messages]);

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5"
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 20px, black 100%)"
      }}
    >
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} variant={variant} onUnlockContent={onUnlockContent} />
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ message, variant = DEFAULT_VARIANT, onUnlockContent }: { message: Message; variant?: BrandVariant; onUnlockContent?: (messageId: string) => void }) {
  const isFromFan = message.sender_type === "fan";
  const tierLabel = getTierLabel(message.tier);
  const colorTheme = getVariantColorTheme(variant);
  const badgeLabel = getBadgeLabel(variant);

  return (
    <div className={`flex ${isFromFan ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[85%] px-[18px] py-[14px] relative
          ${isFromFan
            ? "rounded-[24px] rounded-br-[6px]"
            : "rounded-[24px] rounded-bl-[6px] border border-[#f0ebe3]"
          }
        `}
        style={
          isFromFan
            ? {
              background: colorTheme.messageBubbleBg,
              boxShadow: colorTheme.messageBubbleShadow
            }
            : {
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)"
            }
        }
      >
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentGroup
            attachments={message.attachments}
            locked={message.is_unlocked === false && message.price_in_cents != null}
            priceInCents={message.price_in_cents}
            priceCurrencyCode={message.price_currency_code}
            onUnlock={onUnlockContent ? () => onUnlockContent(message.id) : undefined}
            variant={variant}
          />
        )}

        {message.content && (
          <p className={`text-[15px] text-stone-900 whitespace-pre-wrap leading-[1.55] break-words ${message.attachments && message.attachments.length > 0 ? "mt-2" : ""}`}>
            {message.content}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {isFromFan && message.tier && message.amount_cents && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${colorTheme.messageTierColor}`}>
              <HeartIcon />
              {beautifyAmount(message.amount_cents, message.currency_code || "usd")} {tierLabel}
            </span>
          )}

          {isFromFan && !message.tier && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${colorTheme.messageTierColor}`}>
              <HeartIcon />
              {badgeLabel}
            </span>
          )}

          <span className="text-[11px] text-stone-400">
            {formatRelativeTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AttachmentGroupProps {
  attachments: MessageAttachment[];
  locked?: boolean;
  priceInCents?: number | null;
  priceCurrencyCode?: string | null;
  onUnlock?: () => Promise<void> | void;
  variant?: BrandVariant;
}

function AttachmentGroup({ attachments, locked, priceInCents, priceCurrencyCode, onUnlock, variant = DEFAULT_VARIANT }: AttachmentGroupProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const colorTheme = getVariantColorTheme(variant);

  // Locked content — show lock icon + price badge
  if (locked) {
    const fileCount = attachments.length;
    const hasImages = attachments.some(a => a.type === "image");
    const hasVideos = attachments.some(a => a.type === "video");
    const label = hasVideos ? "video" : hasImages ? "photo" : "file";
    const countLabel = fileCount > 1 ? `${fileCount} ${label}s` : `1 ${label}`;

    return (
      <div className="w-[240px] rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          {/* Unlock button */}
          {priceInCents != null && priceInCents > 0 && onUnlock ? (
            <button
              onClick={async () => {
                if (isUnlocking) return;
                setIsUnlocking(true);
                try {
                  await onUnlock();
                } catch {
                  setIsUnlocking(false);
                }
              }}
              disabled={isUnlocking}
              className="px-4 py-2 rounded-full text-white text-[13px] font-semibold transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
              style={{
                background: colorTheme.ctaGradient,
                boxShadow: colorTheme.ctaShadow
              }}
            >
              {isUnlocking ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Unlocking…
                </span>
              ) : (
                <>Unlock for {beautifyAmount(priceInCents, priceCurrencyCode || "usd")}</>
              )}
            </button>
          ) : priceInCents != null && priceInCents > 0 ? (
            <span className={`px-3 py-1 rounded-full text-[13px] font-semibold ${colorTheme.charBadgeOver}`}>
              {beautifyAmount(priceInCents, priceCurrencyCode || "usd")}
            </span>
          ) : null}
          <p className="text-[13px] text-stone-500">
            {countLabel}
          </p>
        </div>
      </div>
    );
  }

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

  const handleClick = (index: number) => {
    const vi = getViewerIndex(index);
    if (vi >= 0) {
      setSelectedIndex(vi);
      setViewerOpen(true);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {attachments.map((attachment, index) => {
          if (attachment.type === "image" && attachment.signed_url) {
            return (
              <button key={index} type="button" onClick={() => handleClick(index)} className="block text-left">
                <div className="w-[240px] h-[180px] rounded-xl overflow-hidden bg-stone-100">
                  <img
                    src={attachment.signed_thumbnail_url || attachment.signed_url}
                    alt={attachment.filename || "Image"}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                </div>
              </button>
            );
          }

          if (attachment.type === "video") {
            return (
              <button key={index} type="button" onClick={() => handleClick(index)} className="block text-left">
                <div className="w-[260px] aspect-video rounded-xl overflow-hidden bg-stone-900 relative">
                  {attachment.signed_thumbnail_url ? (
                    <>
                      <img src={attachment.signed_thumbnail_url} alt={attachment.filename || "Video"} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                          <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          }

          // Generic file
          if (!attachment.signed_url) return null;
          return (
            <a
              key={index}
              href={attachment.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors max-w-[240px]"
            >
              <svg className="w-5 h-5 text-stone-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="min-w-0">
                <p className="text-[13px] text-stone-700 font-medium truncate">{attachment.filename || "File"}</p>
                {attachment.size > 0 && (
                  <p className="text-[11px] text-stone-400">
                    {attachment.size < 1024 * 1024
                      ? `${(attachment.size / 1024).toFixed(1)} KB`
                      : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                )}
              </div>
            </a>
          );
        })}
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

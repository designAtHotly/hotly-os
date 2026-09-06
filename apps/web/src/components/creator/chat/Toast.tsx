"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export type ToastType = "message_sent" | "subscribed" | "error";

interface ToastProps {
  type: ToastType;
  artistName: string;
  onDismiss: () => void;
  message?: string; // Optional custom message for error toasts
  variant?: string;
}

export default function Toast({ type, artistName, onDismiss, message, variant = "Penpal" }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const firstName = artistName.split(" ")[0] || artistName;

  // Unified exit handler - prevents double-triggering and cleans up properly
  const startExit = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    exitTimerRef.current = setTimeout(onDismiss, 300);
  }, [isLeaving, onDismiss]);

  useEffect(() => {
    // Trigger enter animation
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-dismiss (subscribed gets longer to savor the moment)
    const duration = type === "subscribed" ? 5000 : 4000;
    const dismissTimer = setTimeout(startExit, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [type, startExit]);

  // Warmer, more personal content
  const content = {
    message_sent: {
      emoji: "💌",
      title: `${firstName} will see this soon`,
      subtitle: null as string | null,
    },
    subscribed: {
      emoji: "💛",
      title: `Welcome, ${variant}`,
      subtitle: `You and ${firstName} are now connected`,
    },
    error: {
      emoji: "😕",
      title: message || "Something went wrong",
      subtitle: message ? null : "Please try again",
    },
  };

  const { emoji, title, subtitle } = content[type];

  return (
    <div
      className={`
        absolute bottom-[100px] left-4 right-4 z-50
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
        }
      `}
    >
      <div
        className="
          w-full
          px-4 py-3.5
          bg-white
          border border-stone-200/80
          rounded-2xl
          flex items-center gap-3.5
          shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)]
        "
      >
        {/* Emoji — simple, warm */}
        <span className="text-2xl flex-shrink-0">{emoji}</span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-stone-800">
            {title}
          </p>
          {subtitle && (
            <p className="text-sm text-stone-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Subtle dismiss */}
        <button
          onClick={startExit}
          className="
            flex-shrink-0 w-8 h-8 -mr-1
            rounded-full
            flex items-center justify-center
            text-stone-300
            hover:text-stone-400 hover:bg-stone-100
            transition-colors
          "
          aria-label="Dismiss"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
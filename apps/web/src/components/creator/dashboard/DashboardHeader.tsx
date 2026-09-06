"use client";

import { useState } from "react";
import { BrandVariant, DEFAULT_VARIANT, getBadgeLabel } from "@/lib/utils/variant";

interface DashboardHeaderProps {
  shareLink: string;
  onLogout?: () => void;
  variant?: BrandVariant;
  onOpenSettings?: () => void;
}

const variantStyles: Record<BrandVariant, { modalIconBg: string; emoji: string; copyBg: string; copyHover: string; subtitle: string }> = {
  penpal: {
    modalIconBg: "bg-amber-100", emoji: "\u{1F48C}",
    copyBg: "bg-amber-500", copyHover: "hover:bg-amber-600",
    subtitle: "Let your fans become your penpal",
  },
  vipfan: {
    modalIconBg: "bg-rose-100", emoji: "\u{2B50}",
    copyBg: "bg-rose-500", copyHover: "hover:bg-rose-600",
    subtitle: "Let your fans become a VIP",
  },
  velvetrope: {
    modalIconBg: "bg-violet-100", emoji: "\u{1F525}",
    copyBg: "bg-violet-500", copyHover: "hover:bg-violet-600",
    subtitle: "Invite fans to your Velvetrope experience",
  },
};

export function DashboardHeader({ shareLink, onLogout, variant = DEFAULT_VARIANT, onOpenSettings }: DashboardHeaderProps) {
  const styles = variantStyles[variant];
  const label = getBadgeLabel(variant);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyShareLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{label} Chat</h1>
        <div className="flex items-center gap-3">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          {onLogout && (
            <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600">
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowShareModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className={`w-12 h-12 rounded-full ${styles.modalIconBg} flex items-center justify-center mx-auto mb-3`}>
                <span className="text-2xl">{styles.emoji}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Share Your {label} Page</h3>
              <p className="text-sm text-gray-500 mt-1">{styles.subtitle}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Your penpal link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none"
                />
                <button
                  onClick={copyShareLink}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    linkCopied
                      ? "bg-green-100 text-green-700"
                      : `${styles.copyBg} text-white ${styles.copyHover}`
                  }`}
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Share this link on social media, your website, or anywhere your fans can find you
            </p>
          </div>
        </div>
      )}
    </>
  );
}

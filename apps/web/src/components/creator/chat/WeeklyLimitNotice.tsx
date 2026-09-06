"use client";

/**
 * WEEKLY LIMIT NOTICE
 *
 * Replaces the composer once a subscriber has spent their weekly letters.
 *
 * The emotional job is completion, not denial — the week closed, the letters
 * landed, someone is holding them. Nothing here says reached, exceeded, or
 * blocked, and the practical detail (when the budget refills) comes last and
 * quietly, framed as a page waiting rather than a door reopening.
 *
 * Deliberately says "answered with care" and not "answered personally" or "by
 * hand": Saddie drafts replies for some creators, and a promise about how a
 * reply gets written could quietly become untrue. What is always true — and is
 * the thing the fan actually wants — is that their words get read.
 */

import { getFirstName, formatBudgetReset } from "@/lib/utils/chat";

interface WeeklyLimitNoticeProps {
  artistName: string;
  /** When the budget refills. */
  resetsAt: Date;
}

export default function WeeklyLimitNotice({ artistName, resetsAt }: WeeklyLimitNoticeProps) {
  const firstName = getFirstName(artistName);

  return (
    <div className="flex-shrink-0 px-4 pb-2 pt-4">
      <div
        className="
          rounded-[22px]
          bg-gradient-to-b from-stone-100/80 to-stone-50
          border border-stone-200/60
          shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.8)]
          px-5 py-4 text-center
        "
      >
        <p className="text-sm font-semibold text-stone-700">
          Your words are with {firstName} now 💌
        </p>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
          They&apos;ll be read slowly, and answered with care. A fresh page is
          waiting for you on {formatBudgetReset(resetsAt)}.
        </p>
      </div>
    </div>
  );
}

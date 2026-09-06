"use client";

import { TabOption } from "@/types/dashboard.types";

interface EmptyStateProps {
  activeTab: TabOption;
}

export function EmptyState({ activeTab }: EmptyStateProps) {
  const emoji = activeTab === "needs-reply" ? "✨" : activeTab === "blocked" ? "🚫" : "💬";
  const label = activeTab === "needs-reply" ? "All caught up!" : activeTab === "blocked" ? "No blocked chats" : "No conversations yet";

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
      <span className="text-4xl block mb-3">{emoji}</span>
      <p className="text-gray-600 font-medium">{label}</p>
    </div>
  );
}

"use client";

import { PenpalDashboardScreen } from "@/components/creator/dashboard/DashboardScreen";
import { CreatorProvider, useCreator } from "@/hooks/useCreator";
import { useAuth } from "@/hooks/useAuth";

function InboxBody() {
  const { creator, loading } = useCreator();
  const { signOut } = useAuth();
  if (loading || !creator) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-gray-500">Loading inbox…</div>;
  }
  return <PenpalDashboardScreen creator={creator} onLogout={signOut} />;
}

export default function CreatorInboxPage() {
  return (
    <CreatorProvider>
      <InboxBody />
    </CreatorProvider>
  );
}

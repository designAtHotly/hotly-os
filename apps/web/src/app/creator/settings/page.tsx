"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import SettingsModal from "@/components/creator/dashboard/SettingsModal";
import { CreatorProvider, useCreator } from "@/hooks/useCreator";
import { fetchCreatorPricing } from "@/lib/api";
import { DEFAULT_PRICING, type CreatorPricing, type SupportTheme } from "@/types/coffee.types";

function SettingsBody() {
  const router = useRouter();
  const { creator, loading, updateCreatorData } = useCreator();
  const [open, setOpen] = useState(true);
  const [pricing, setPricing] = useState<CreatorPricing>(DEFAULT_PRICING);

  useEffect(() => {
    fetchCreatorPricing()
      .then(setPricing)
      .catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-gray-500">
        Loading settings…
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-gray-500">Sign in with the configured creator account to edit settings.</p>
        <a href="/creator" className="text-sm font-medium text-amber-700 underline-offset-2 hover:underline">
          Open creator console
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#faf8f5]">
      <SettingsModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          router.push("/creator/inbox");
        }}
        displayName={creator.name || ""}
        description={creator.bio || ""}
        supportTheme={(creator.support_theme as SupportTheme) || "coffee"}
        pricing={pricing}
        onSaved={(updates) => {
          updateCreatorData({
            name: updates.displayName,
            bio: updates.description,
            support_theme: updates.supportTheme,
          });
          setPricing(updates.pricing);
          setOpen(true);
        }}
      />
    </div>
  );
}

export default function CreatorSettingsPage() {
  return (
    <CreatorProvider>
      <SettingsBody />
    </CreatorProvider>
  );
}

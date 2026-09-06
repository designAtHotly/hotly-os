"use client";

import { useEffect, useState } from "react";

import CommunityPage from "@/components/community/CommunityPage";
import { loadDomeHome, emptyCommunity, type DomePageData } from "@/lib/dome/load";
import { loadPenpalCreator } from "@/lib/penpal/load";
import type { CoffeeCreator } from "@/types/coffee.types";

export default function DomeClient() {
  const [creator, setCreator] = useState<CoffeeCreator | null>(null);
  const [dome, setDome] = useState<DomePageData | null>(null);

  useEffect(() => {
    Promise.all([loadPenpalCreator(), loadDomeHome()])
      .then(([penpal, page]) => {
        setCreator(penpal.creator);
        setDome(page);
      })
      .catch(() => {
        setCreator(null);
        setDome({ community: emptyCommunity, prompts: [], notes: [], totalCount: 0 });
      });
  }, []);

  if (!creator || !dome) {
    return <main className="relative h-screen w-full bg-[#0f0d13]" />;
  }

  return (
    <main className="relative h-screen w-full">
      <CommunityPage
        creator={creator}
        community={dome.community}
        prompts={dome.prompts}
        initialNotes={dome.notes}
        initialTotalCount={dome.totalCount}
      />
    </main>
  );
}

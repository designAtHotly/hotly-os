"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import CommunityPage from "@/components/community/CommunityPage";
import { loadDomePrompt, emptyCommunity, noteIdFromLocation, type DomePageData } from "@/lib/dome/load";
import { loadPenpalCreator } from "@/lib/penpal/load";
import type { CoffeeCreator } from "@/types/coffee.types";

export default function DomePromptClient() {
  const params = useParams<{ promptSlug: string }>();
  const slug = params.promptSlug;
  const [creator, setCreator] = useState<CoffeeCreator | null>(null);
  const [dome, setDome] = useState<DomePageData | null>(null);
  const [noteId, setNoteId] = useState<string | undefined>();

  useEffect(() => {
    setNoteId(noteIdFromLocation());
    Promise.all([loadPenpalCreator(), loadDomePrompt(slug)])
      .then(([penpal, page]) => {
        setCreator(penpal.creator);
        setDome(page);
      })
      .catch(() => {
        setCreator(null);
        setDome({ community: emptyCommunity, prompts: [], notes: [], totalCount: 0 });
      });
  }, [slug]);

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
        initialNoteId={noteId}
      />
    </main>
  );
}

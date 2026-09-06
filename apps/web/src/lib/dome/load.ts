import { apiCall } from "@/lib/api/impl/base";
import type { Community, CommunityNote, CommunityPrompt } from "@/lib/api";

export const emptyCommunity: Community = {
  id: 1,
  uuid: "dome",
  creator_id: 0,
  title: "Dome",
  description: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export interface DomePageData {
  community: Community;
  prompts: CommunityPrompt[];
  notes: CommunityNote[];
  totalCount: number;
}

function asCommunity(row: Community | null | undefined): Community {
  return row ?? emptyCommunity;
}

export async function loadDomeHome(): Promise<DomePageData> {
  const res = await apiCall<{
    community: Community | null;
    prompts: CommunityPrompt[];
    notes: CommunityNote[];
    total_count: number;
  }>("/api/dome");
  return {
    community: asCommunity(res.body?.community),
    prompts: res.body?.prompts || [],
    notes: res.body?.notes || [],
    totalCount: res.body?.total_count || 0,
  };
}

export async function loadDomePrompt(slug: string): Promise<DomePageData> {
  const home = await loadDomeHome();
  try {
    const res = await apiCall<{
      community: Community | null;
      prompt: CommunityPrompt;
      notes: CommunityNote[];
      total_count: number;
    }>(`/api/dome/prompts/${encodeURIComponent(slug)}`);
    const selected = res.body?.prompt;
    const rest = home.prompts.filter((p) => p.share_slug !== slug && p.uuid !== slug);
    return {
      community: asCommunity(res.body?.community ?? home.community),
      prompts: selected ? [selected, ...rest] : home.prompts,
      notes: res.body?.notes || [],
      totalCount: res.body?.total_count || 0,
    };
  } catch {
    return home;
  }
}

export function noteIdFromLocation(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const hash = window.location.hash;
  if (hash.startsWith("#note-")) {
    return hash.slice("#note-".length);
  }
  return new URLSearchParams(window.location.search).get("s") || undefined;
}

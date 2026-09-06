import { cache } from "react";

import type { CommunityPrompt } from "@/lib/api";
import type { PenpalOffer } from "@/lib/penpal/offer";
import { internalApiUrl } from "@/lib/site";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(internalApiUrl(path), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Per-request Penpal offer for metadata. */
export const loadSeoPenpal = cache(async (): Promise<PenpalOffer | null> => {
  return fetchJson<PenpalOffer>("/api/penpal");
});

/** Public Dome prompts for sitemap and prompt-page titles. */
export const loadSeoDomePrompts = cache(async (): Promise<CommunityPrompt[]> => {
  const body = await fetchJson<CommunityPrompt[] | { prompts?: CommunityPrompt[] }>("/api/dome/prompts");
  if (Array.isArray(body)) {
    return body;
  }
  if (body && Array.isArray(body.prompts)) {
    return body.prompts;
  }
  return [];
});

/**
 * One prompt page payload.
 *
 * @param slug - Prompt share slug.
 * @returns Prompt content when found.
 */
export async function loadSeoDomePrompt(slug: string): Promise<CommunityPrompt | null> {
  const body = await fetchJson<{ prompt?: CommunityPrompt }>(
    `/api/dome/prompts/${encodeURIComponent(slug)}`,
  );
  return body?.prompt ?? null;
}

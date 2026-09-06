import type { MetadataRoute } from "next";

import { loadSeoDomePrompts } from "@/lib/seo-data";
import { publicUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: publicUrl("/penpal"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: publicUrl("/dome"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
  const prompts = await loadSeoDomePrompts();
  for (const prompt of prompts) {
    const slug = prompt.share_slug?.trim();
    if (!slug) {
      continue;
    }
    entries.push({
      url: publicUrl(`/dome/${slug}`),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }
  return entries;
}

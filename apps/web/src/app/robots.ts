import type { MetadataRoute } from "next";

import { publicAppUrl, publicUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = publicAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/penpal", "/dome"],
        disallow: ["/creator", "/chat", "/auth"],
      },
    ],
    sitemap: publicUrl("/sitemap.xml"),
    host: origin,
  };
}

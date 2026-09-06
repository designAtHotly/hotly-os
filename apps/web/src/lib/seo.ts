import type { Metadata } from "next";

import type { PenpalOffer } from "@/lib/penpal/offer";
import { publicAppUrl, publicUrl } from "@/lib/site";
import { getThemeLabel, type SupportTheme } from "@/types/coffee.types";

const PRODUCT_DESCRIPTION = "A tip jar that writes back.";

/**
 * Tab / home-screen chrome copied from live Hotly public files.
 * Live `hotly.com` ships the PNGs at well-known URLs but does not declare them in
 * `<head>` and 404s `/site.webmanifest`. OSS links the files and ships the
 * missing manifest so Android/iOS actually use them. Favicon.ico stays a file
 * in `app/` so Next emits the tab icon (do not also list it here or the head
 * duplicates `/favicon.ico`).
 *
 * @returns Apple-touch, android-chrome, and manifest metadata.
 */
export function chromeMetadata(): Pick<Metadata, "icons" | "manifest"> {
  return {
    icons: {
      icon: [
        { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/site.webmanifest",
  };
}

/**
 * First whitespace-separated token of a display name.
 *
 * @param displayName - Creator display name.
 * @returns First name, or the full string when it has no spaces.
 */
export function firstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "Creator";
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function supportLabel(item: string | undefined): string {
  return getThemeLabel(item as SupportTheme | undefined).toLowerCase();
}

function ogImage(avatarPath: string | undefined): string | undefined {
  if (!avatarPath) {
    return undefined;
  }
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return avatarPath;
  }
  return publicUrl(avatarPath.startsWith("/") ? avatarPath : `/${avatarPath}`);
}

/**
 * Instance metadata for a public path. Canonical and OG URLs use PUBLIC_APP_URL.
 *
 * @param opts - Title, description, path, and optional image path.
 * @returns Next.js Metadata including Open Graph and Twitter cards.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = publicUrl(opts.path);
  const image = ogImage(opts.image);
  const twitterCard = image ? "summary_large_image" : "summary";
  return {
    title: { absolute: opts.title },
    description: opts.description,
    metadataBase: new URL(publicAppUrl()),
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      siteName: "Hotly",
      url,
      title: opts.title,
      description: opts.description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: twitterCard,
      title: opts.title,
      description: opts.description,
      ...(image ? { images: [image] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Default instance metadata when the API is unreachable.
 *
 * @returns Layout-level Metadata.
 */
export function fallbackMetadata(): Metadata {
  return pageMetadata({
    title: "Hotly",
    description: PRODUCT_DESCRIPTION,
    path: "/penpal",
  });
}

/**
 * Penpal landing card: “Buy {first} a {coffee}” plus bio.
 *
 * @param offer - Public Penpal offer JSON, or null when the API is down.
 * @returns Metadata for `/penpal`.
 */
export function penpalMetadata(offer: PenpalOffer | null): Metadata {
  if (!offer) {
    return fallbackMetadata();
  }
  const first = firstName(offer.display_name);
  const item = supportLabel(offer.support_item);
  const title = `Buy ${first} a ${item} · Hotly`;
  const description = offer.description?.trim() || `Support ${first} with a ${item}. ${PRODUCT_DESCRIPTION}`;
  return pageMetadata({
    title,
    description,
    path: "/penpal",
    image: offer.avatar_url,
  });
}

/**
 * Dome listing or a specific prompt.
 *
 * @param offer - Public Penpal offer (name + avatar).
 * @param promptContent - Prompt body when on `/dome/[slug]`.
 * @param path - Canonical path.
 * @returns Metadata for a Dome URL.
 */
export function domeMetadata(
  offer: PenpalOffer | null,
  promptContent: string | undefined,
  path: string,
): Metadata {
  const name = firstName(offer?.display_name || "Creator");
  const prompt = promptContent?.trim();
  const title = prompt ? `${prompt} — ${name}'s Dome · Hotly` : `${name}'s Dome · Hotly`;
  const description = prompt || `Join ${name}'s community on Hotly.`;
  return pageMetadata({
    title,
    description,
    path,
    image: offer?.avatar_url,
  });
}

/** Private operator/guest surfaces must not appear in search or sitemaps. */
export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

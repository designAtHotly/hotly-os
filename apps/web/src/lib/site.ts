/**
 * Browser-facing origin (canonical, Open Graph, robots, sitemap).
 * Read at request time from PUBLIC_APP_URL so a domain change does not require a Next rebuild.
 *
 * @returns Absolute origin with no trailing slash.
 */
export function publicAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL?.trim() || "http://localhost";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost";
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost";
  }
}

/**
 * Go API origin for server-side fetches from Next (generateMetadata, sitemap).
 * Compose sets SERVER_ORIGIN=http://server:8080. Local `bun run dev` defaults to :8080.
 *
 * @param path - Path including `/api`, e.g. `/api/penpal`.
 * @returns Absolute URL on the API host.
 */
export function internalApiUrl(path: string): string {
  const origin = (process.env.SERVER_ORIGIN?.trim() || "http://localhost:8080").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

/**
 * Turn a same-app path into a public absolute URL.
 *
 * @param path - Path beginning with `/`.
 * @returns Absolute URL on PUBLIC_APP_URL.
 */
export function publicUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicAppUrl()}${suffix}`;
}

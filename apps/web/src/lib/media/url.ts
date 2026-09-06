/** Allow only same-app media paths. Remote http(s) hosts are dropped. */
export function appMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/")) {
    return trimmed;
  }
  try {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const parsed = new URL(trimmed, origin);
    if (parsed.origin === origin && parsed.pathname.startsWith("/api/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

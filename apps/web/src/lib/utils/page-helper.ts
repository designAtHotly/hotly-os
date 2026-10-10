export function getCreatorVariantPage(_creatorUsername?: string, _variant?: string) {
  return "/";
}

export function getCreatorChatPage(_creatorUsername?: string) {
  return "/chat";
}

export function getCreatorVariantShareUrl(_creatorUsername?: string, _variant?: string) {
  return typeof window === "undefined" ? "/" : `${window.location.origin}/`;
}

export function getTermsOfServicePage() {
  return "/";
}

export function getPrivacyPolicyPage() {
  return "/";
}

export function getDomePage(_creatorUsername?: string) {
  return "/dome";
}

export function getCommunityPromptPage(_creatorUsername: string, promptSlug: string) {
  return `/dome/${promptSlug}`;
}

export function getCommunityPromptShareUrl(_creatorUsername: string, promptSlug: string) {
  return typeof window === "undefined"
    ? `/dome/${promptSlug}`
    : `${window.location.origin}/dome/${promptSlug}`;
}

export function getCommunityNoteShareUrl(
  _creatorSlug: string,
  promptSlug: string,
  shareSlug: string,
): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/dome/${promptSlug}#note-${shareSlug}`;
}

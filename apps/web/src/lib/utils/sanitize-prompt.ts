const UNSAFE_CHARS = /["\u201C\u201D<>]/g;

export function sanitizePrompt(value: string): string {
  return value.replace(UNSAFE_CHARS, '');
}

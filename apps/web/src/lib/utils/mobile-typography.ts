/**
 * Mobile-responsive typography scale.
 *
 * Provides a single source of truth for font sizes across mobile and desktop.
 * Currently used by the community feature; any feature can opt in by importing.
 *
 * Usage:
 *   import { useIsMobile } from '@/hooks/useIsMobile';
 *   import { fontScale } from '@/lib/utils/mobile-typography';
 *
 *   const isMobile = useIsMobile();
 *   const f = fontScale(isMobile);
 *   <h1 style={{ fontSize: f.heading }}>...</h1>
 */

export interface FontScale {
    /** 56-80px — Big decorative emojis, hero icons */
    displayLg: number;
    /** 36-48px — Medium emojis, modal icons */
    display: number;
    /** 28-36px — Small display, note emojis in expanded view */
    displaySm: number;

    /** 24-32px — Page titles, prompt headings */
    heading: number;
    /** 18-22px — Modal titles, section titles */
    title: number;

    /** 17-20px — Textarea, primary input text */
    bodyLg: number;
    /** 16-18px — Card headings, note content text */
    subtitle: number;
    /** 14-16px — Buttons, form inputs, standard body text */
    body: number;

    /** 11-13px — Secondary text, filter labels, meta text */
    caption: number;
    /** 10-11px — Dates, minor labels, micro labels */
    small: number;
}

const DESKTOP: FontScale = {
    displayLg: 80,
    display: 48,
    displaySm: 36,
    heading: 32,
    title: 22,
    bodyLg: 20,
    subtitle: 18,
    body: 16,
    caption: 13,
    small: 11,
};

const MOBILE: FontScale = {
    displayLg: 56,
    display: 36,
    displaySm: 28,
    heading: 24,
    title: 18,
    bodyLg: 17,
    subtitle: 16,
    body: 14,
    caption: 11,
    small: 10,
};

/** Returns the font scale for the current viewport. */
export function fontScale(isMobile: boolean): FontScale {
    return isMobile ? MOBILE : DESKTOP;
}

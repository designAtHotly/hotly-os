import type React from 'react';

// ============================================
// TYPES
// ============================================
export interface ColorPalette {
    id: string;
    bg: string;
    bgSolid: string;
    bgGradient: string;
    text: string;
    glow: string;
    accent: string;
}

export interface CardDesign {
    id: string;
    name: string;
}

export interface CardProps {
    text: string;
    emoji: string;
    author: string;
    color: ColorPalette;
    size: 'sm' | 'md' | 'lg';
}

export interface NoteDraft {
    content: string;
    emoji: string;
    color: string;
    shape: string;
    author_name: string;
    is_anonymous: boolean;
}

// ============================================
// CONSTANTS
// ============================================
export const COLORS: ColorPalette[] = [
    { id: 'cream', bg: '#FDF6E3', bgSolid: '#FDF6E3', bgGradient: 'linear-gradient(145deg, #FDF6E3, #F5E6C8)', text: '#5C4B37', glow: 'rgba(253,246,227,0.4)', accent: 'rgba(92,75,55,0.15)' },
    { id: 'blush', bg: '#FFE4E6', bgSolid: '#FFE4E6', bgGradient: 'linear-gradient(145deg, #FFF0F1, #FFE4E6)', text: '#9F3949', glow: 'rgba(255,228,230,0.4)', accent: 'rgba(159,57,73,0.15)' },
    { id: 'lavender', bg: '#EDE9FE', bgSolid: '#EDE9FE', bgGradient: 'linear-gradient(145deg, #F5F3FF, #EDE9FE)', text: '#5B21B6', glow: 'rgba(237,233,254,0.4)', accent: 'rgba(91,33,182,0.15)' },
    { id: 'mint', bg: '#D1FAE5', bgSolid: '#D1FAE5', bgGradient: 'linear-gradient(145deg, #ECFDF5, #D1FAE5)', text: '#065F46', glow: 'rgba(209,250,229,0.4)', accent: 'rgba(6,95,70,0.15)' },
    { id: 'sky', bg: '#DBEAFE', bgSolid: '#DBEAFE', bgGradient: 'linear-gradient(145deg, #EFF6FF, #DBEAFE)', text: '#1E40AF', glow: 'rgba(219,234,254,0.4)', accent: 'rgba(30,64,175,0.15)' },
];

export const EMOJIS: string[] = ['🌙', '✨', '💫', '🌸', '💜', '🌿', '🦋', '☀️', '🔥', '🫶', '💭', '🎵', '🍀'];

export const DESIGNS: CardDesign[] = [
    { id: 'classic', name: 'Classic' },
    { id: 'popcard', name: 'Pop' },
    { id: 'popcircle', name: 'Pop Circle' },
    { id: 'softcard', name: 'Soft' },
    { id: 'softcircle', name: 'Soft Circle' },
];

const COLOR_MAP = new Map(COLORS.map(c => [c.id, c]));
const DESIGN_MAP = new Map(DESIGNS.map(d => [d.id, d]));

export function getColor(id: string | null | undefined): ColorPalette {
    return (id && COLOR_MAP.get(id)) || COLORS[0];
}

export function getDesign(id: string | null | undefined): CardDesign {
    return (id && DESIGN_MAP.get(id)) || DESIGNS[0];
}

export function randomColorId(exclude?: string | null): string {
    const pool = exclude ? COLORS.filter(c => c.id !== exclude) : COLORS;
    return pool[Math.floor(Math.random() * pool.length)].id;
}

export function randomDesignId(): string {
    return DESIGNS[Math.floor(Math.random() * DESIGNS.length)].id;
}

export function nextDesignId(current: string): string {
    const idx = DESIGNS.findIndex(d => d.id === current);
    return DESIGNS[(idx + 1) % DESIGNS.length].id;
}

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trim() + '\u2026';
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// UTILS
// ============================================
export function adjustColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

export function formatTimestamp(date: Date | undefined): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
}

export const clamp = (v: number, min: number, max: number): number =>
    Math.min(Math.max(v, min), max);

// ============================================
// FONT CONSTANTS
// ============================================
export const FONT_SANS = 'system-ui, -apple-system, sans-serif';
export const FONT_SERIF = 'Georgia, serif';

// ============================================
// COMMUNITY DARK-THEME PALETTE
// ============================================
export const C_AMBER = 'rgba(184,134,74,1)';
export const C_AMBER_90 = 'rgba(184,134,74,0.9)';
export const C_AMBER_30 = 'rgba(184,134,74,0.3)';
export const C_AMBER_20 = 'rgba(184,134,74,0.2)';
export const C_AMBER_15 = 'rgba(184,134,74,0.15)';
export const C_AMBER_12 = 'rgba(184,134,74,0.12)';
export const C_AMBER_10 = 'rgba(184,134,74,0.1)';
export const C_AMBER_08 = 'rgba(184,134,74,0.08)';

export const C_ERROR_BG = 'rgba(239,68,68,0.95)';

export const C_SUCCESS = '#6B8F6B';
export const C_SUCCESS_30 = 'rgba(107,143,107,0.3)';
export const C_SUCCESS_15 = 'rgba(107,143,107,0.15)';

export const C_WHITE_55 = 'rgba(255,255,255,0.55)';
export const C_WHITE_45 = 'rgba(255,255,255,0.45)';
export const C_WHITE_40 = 'rgba(255,255,255,0.4)';
export const C_WHITE_15 = 'rgba(255,255,255,0.15)';
export const C_WHITE_10 = 'rgba(255,255,255,0.1)';
export const C_WHITE_08 = 'rgba(255,255,255,0.08)';
export const C_WHITE_06 = 'rgba(255,255,255,0.06)';

// ============================================
// SHARED INLINE STYLE OBJECTS
// ============================================

/** Bottom sheet backdrop */
export const SHEET_BACKDROP: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease',
};

/** Bottom sheet card */
export const SHEET_CARD: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(30,26,35,0.98)',
    backdropFilter: 'blur(20px)',
    borderTop: `1px solid ${C_WHITE_10}`,
    borderRadius: '20px 20px 0 0',
    padding: '28px 24px 36px',
    animation: 'sheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
};

/** Drag handle for bottom sheets */
export const DRAG_HANDLE: React.CSSProperties = {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: C_WHITE_15,
    margin: '0 auto',
};

// ============================================
// MODAL STYLES
// ============================================
export const MODAL_BG = '#1a1a1f';
export const MODAL_CARD_SHADOW = '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)';

// ============================================
// FILTER UTILS
// ============================================
export type FilterType = 'all' | 'creator-notes' | 'your-notes';

/** Toggle filter: clicking active filter resets to 'all' */
export function toggleFilter(current: FilterType, clicked: FilterType): FilterType {
    return current === clicked ? 'all' : clicked;
}

/** User display name with fallback */
export function displayName(name: string | null | undefined): string {
    return name || 'Signed in';
}
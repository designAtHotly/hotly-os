'use client';

import React, { memo } from 'react';
import type { CardProps } from './shared';
import { getColor, adjustColor, FONT_SERIF } from './shared';

/** Minimal fields needed to render a note card */
export interface NoteDisplay {
    content: string;
    emoji: string | null;
    is_anonymous?: boolean;
    author_name?: string | null;
    color: string | null;
    shape: string | null;
}

// ============================================
// SIZE PRESETS
// ============================================
interface SizeConfig {
    emoji: number;
    body: number;
    author: number;
    lineClamp: number;
    padding: number;
    borderRadius: number;
    badgeSize: number;
}

const SIZE_CONFIG: Record<CardProps['size'], SizeConfig> = {
    sm: { emoji: 20, body: 11, author: 9, lineClamp: 4, padding: 14, borderRadius: 16, badgeSize: 36 },
    md: { emoji: 24, body: 14, author: 12, lineClamp: 4, padding: 20, borderRadius: 20, badgeSize: 44 },
    lg: { emoji: 28, body: 16, author: 14, lineClamp: 0, padding: 28, borderRadius: 24, badgeSize: 52 },
};

function textStyle(s: SizeConfig, color: string, center = false): React.CSSProperties {
    const base: React.CSSProperties = {
        fontSize: s.body, lineHeight: 1.5, color, margin: 0,
        flex: s.lineClamp ? 1 : undefined,
        fontFamily: FONT_SERIF,
        overflowWrap: 'break-word', wordBreak: 'break-word',
        whiteSpace: 'pre-line',
        textAlign: center ? 'center' : undefined,
    };
    if (s.lineClamp) {
        Object.assign(base, {
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: s.lineClamp, WebkitBoxOrient: 'vertical',
        });
    }
    return base;
}

function authorStyle(s: SizeConfig, color: string): React.CSSProperties {
    return {
        fontSize: s.author, color, opacity: 0.6,
        marginTop: s.padding / 2,
        fontFamily: FONT_SERIF, fontStyle: 'italic', flexShrink: 0,
    };
}

// ============================================
// 1. CLASSIC — Dashed border
// ============================================
const ClassicCard = memo(function ClassicCard({ text, emoji, author, color, size }: CardProps) {
    const s = SIZE_CONFIG[size];
    return (
        <div style={{
            width: '100%', height: '100%', borderRadius: s.borderRadius,
            background: color.bg, border: `2px dashed ${color.text}40`,
            padding: s.padding, paddingTop: s.padding * 0.65, display: 'flex', flexDirection: 'column',
            boxShadow: `0 8px 32px ${color.glow}`, boxSizing: 'border-box', overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: s.padding / 2, marginBottom: s.padding * 0.4, flexShrink: 0 }}>
                <span style={{ fontSize: s.emoji }}>{emoji}</span>
                <div style={{ flex: 1, height: 1, background: `repeating-linear-gradient(90deg, ${color.text}30, ${color.text}30 4px, transparent 4px, transparent 8px)` }} />
            </div>
            <p style={textStyle(s, color.text)}>{text}</p>
            <div style={authorStyle(s, color.text)}>— {author}</div>
        </div>
    );
});

// ============================================
// 2. POP CARD — Floating badge square
// ============================================
const PopCard = memo(function PopCard({ text, emoji, author, color, size }: CardProps) {
    const s = SIZE_CONFIG[size];
    return (
        <div style={{
            width: '100%', height: '100%', borderRadius: s.borderRadius + 4,
            background: color.bgSolid, padding: s.padding, paddingTop: s.padding + s.badgeSize / 3,
            display: 'flex', flexDirection: 'column', position: 'relative',
            boxShadow: `0 8px 32px ${color.glow}`, boxSizing: 'border-box',
        }}>
            <div style={{
                position: 'absolute', top: -(s.badgeSize / 3), left: '50%', transform: 'translateX(-50%)',
                width: s.badgeSize, height: s.badgeSize,
                background: `linear-gradient(135deg, ${color.text}dd, ${color.text})`,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.emoji, boxShadow: `0 4px 12px ${color.glow}`,
            }}>{emoji}</div>
            <p style={{ ...textStyle(s, color.text, true), marginTop: 4 }}>{text}</p>
            <div style={{ ...authorStyle(s, color.text), textAlign: 'center' }}>— {author}</div>
        </div>
    );
});

// ============================================
// 3. POP CIRCLE — Floating badge circle
// ============================================
const PopCircle = memo(function PopCircle({ text, emoji, author, color, size }: CardProps) {
    const s = SIZE_CONFIG[size];
    const cl = s.lineClamp ? Math.max(s.lineClamp - 1, 2) : 0;
    const circlePad = s.padding + Math.round(s.padding * 0.3);
    return (
        <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: color.bgSolid, padding: circlePad, paddingTop: circlePad + s.padding,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            position: 'relative', boxShadow: `0 8px 32px ${color.glow}`, boxSizing: 'border-box',
        }}>
            <div style={{
                position: 'absolute', top: -(s.badgeSize * 0.25), left: '50%', transform: 'translateX(-50%)',
                width: s.badgeSize * 1, height: s.badgeSize * 1,
                background: `linear-gradient(135deg, ${color.text}dd, ${color.text})`,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.emoji - 2, boxShadow: `0 4px 12px ${color.glow}`,
            }}>{emoji}</div>
            <p style={{ ...textStyle(s, color.text, true), fontSize: s.body - 1, lineHeight: 1.4, width: '80%', ...(cl ? { WebkitLineClamp: cl } : {}) }}>{text}</p>
            <div style={{ ...authorStyle(s, color.text), fontSize: s.author - 1 }}>— {author}</div>
        </div>
    );
});

// ============================================
// 4. SOFT CARD — Bubbles square
// ============================================
const SoftCard = memo(function SoftCard({ text, emoji, author, color, size }: CardProps) {
    const s = SIZE_CONFIG[size];
    const bL = s.badgeSize * 1.3, bS = s.badgeSize;
    return (
        <div style={{
            width: '100%', height: '100%', borderRadius: s.borderRadius + 4,
            background: `linear-gradient(145deg, ${color.bg}, ${adjustColor(color.bg, -10)})`,
            padding: s.padding, paddingTop: s.padding * 0.65, display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 32px ${color.glow}`, boxSizing: 'border-box',
        }}>
            <div style={{ position: 'absolute', top: -bL / 3, left: -bL / 3, width: bL, height: bL, background: color.accent, borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -bS / 3, right: -bS / 3, width: bS, height: bS, background: color.accent, borderRadius: '50%', opacity: 0.7 }} />
            <span style={{ fontSize: s.emoji + 4, marginBottom: s.padding * 0.05, position: 'relative', flexShrink: 0 }}>{emoji}</span>
            <p style={{ ...textStyle(s, color.text, true), position: 'relative', width: '100%' }}>{text}</p>
            <div style={{ ...authorStyle(s, color.text), position: 'relative' }}>♡ {author}</div>
        </div>
    );
});

// ============================================
// 5. SOFT CIRCLE — Bubbles circle
// ============================================
const SoftCircle = memo(function SoftCircle({ text, emoji, author, color, size }: CardProps) {
    const s = SIZE_CONFIG[size];
    const cl = s.lineClamp ? Math.max(s.lineClamp - 1, 2) : 0;
    const circlePad = s.padding + Math.round(s.padding * 0.3);
    return (
        <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: `linear-gradient(145deg, ${color.bg}, ${adjustColor(color.bg, -10)})`,
            padding: circlePad, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 32px ${color.glow}`, boxSizing: 'border-box',
        }}>
            <div style={{ position: 'absolute', top: -12, left: -12, width: 40, height: 40, background: color.accent, borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -10, right: -10, width: 32, height: 32, background: color.accent, borderRadius: '50%', opacity: 0.7 }} />
            <span style={{ fontSize: s.emoji* 1.1, position: 'relative' }}>{emoji}</span>
            <p style={{ ...textStyle(s, color.text, true), fontSize: s.body - 1, lineHeight: 1.4, position: 'relative', width: '80%', ...(cl ? { WebkitLineClamp: cl } : {}) }}>{text}</p>
            <div style={{ ...authorStyle(s, color.text), fontSize: s.author - 1, position: 'relative' }}>♡ {author}</div>
        </div>
    );
});

// ============================================
// REGISTRY — maps design ID → component
// ============================================
const CARD_BY_ID: Record<string, React.ComponentType<CardProps>> = {
    classic: ClassicCard,
    popcard: PopCard,
    popcircle: PopCircle,
    softcard: SoftCard,
    softcircle: SoftCircle,
};

// ============================================
// PUBLIC API
// ============================================

/** Render a note card. size: 'sm' (dome), 'md' (compose preview), 'lg' (expanded) */
export const NoteCard = memo(function NoteCard({
    note, size, onClick,
}: {
    note: NoteDisplay;
    size: CardProps['size'];
    onClick?: () => void;
}) {
    const color = getColor(note.color);
    const Card = CARD_BY_ID[note.shape || 'classic'] || ClassicCard;
    return (
        <div onClick={onClick} style={{ width: '100%', height: '100%', cursor: onClick ? 'pointer' : 'default' }}>
            <Card text={note.content} emoji={note.emoji || '🌙'} author={note.is_anonymous ? 'Anonymous' : (note.author_name || 'Anonymous')} color={color} size={size} />
        </div>
    );
});

const CIRCLE_DESIGNS = new Set(['popcircle', 'softcircle']);

/** Scales a card down to fit a dome tile container */
export const NoteCardScaled = memo(function NoteCardScaled({
    note, containerSize, onClick,
}: {
    note: NoteDisplay;
    containerSize: number;
    onClick?: () => void;
}) {
    const isCircle = CIRCLE_DESIGNS.has(note.shape || '');
    const BASE_W = isCircle ? 220 : 200;
    const BASE_H = isCircle ? 220 : 220;
    const scale = Math.min(containerSize / BASE_W, containerSize / BASE_H);
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: 'center', flexShrink: 0 }}>
                <NoteCard note={note} size="md" onClick={onClick} />
            </div>
        </div>
    );
});

export { nextDesignId } from './shared';
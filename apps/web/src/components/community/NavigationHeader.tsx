'use client';

import React from 'react';
import type { CommunityNote } from '@/lib/api';
import type { NoteWithChildren } from './threadUtils';
import CloseButton from './CloseButton';
import Minimap from './Minimap';
import { useFontScale } from './useFontScale';

interface NavigationHeaderProps {
    root: NoteWithChildren;
    flatNotes: Array<{ note: NoteWithChildren; depth: number; path: CommunityNote[] }>;
    currentIndex: number;
    onNavigate: (index: number) => void;
    onClose: () => void;
}

export default function NavigationHeader({
    root,
    flatNotes,
    currentIndex,
    onNavigate,
    onClose,
}: NavigationHeaderProps) {
    const { isMobile, f } = useFontScale();
    const total = flatNotes.length;
    const canPrev = currentIndex > 0;
    const canNext = currentIndex < total - 1;

    const arrowBtn = (direction: 'prev' | 'next', enabled: boolean, onClick: () => void) => (
        <button
            onClick={enabled ? onClick : undefined}
            style={{
                width: isMobile ? 36 : 44,
                height: isMobile ? 36 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: enabled ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: enabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                color: enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                fontSize: f.subtitle,
                cursor: enabled ? 'pointer' : 'default',
                transition: 'all 0.2s',
                flexShrink: 0,
            }}
        >
            {direction === 'prev' ? '‹' : '›'}
        </button>
    );

    return (
        <div style={{ width: '100%' }}>
            {/* Title + Close */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isMobile ? 6 : 12,
                padding: '0 4px',
            }}>
                <span className="section-label" style={{ fontSize: f.small, letterSpacing: 1.2 }}>
                    This conversation
                </span>
                <CloseButton onClick={onClose} />
            </div>

            {/* Minimap */}
            <Minimap
                root={root}
                flatNotes={flatNotes}
                currentIndex={currentIndex}
                onNavigate={onNavigate}
                isMobile={isMobile}
            />

            {/* Nav arrows + counter */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobile ? 10 : 16,
                marginTop: isMobile ? 6 : 12,
                paddingBottom: isMobile ? 2 : 4,
            }}>
                {arrowBtn('prev', canPrev, () => onNavigate(currentIndex - 1))}
                <span style={{
                    fontSize: f.caption,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.4)',
                    minWidth: 60,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    {currentIndex + 1} of {total}
                </span>
                {arrowBtn('next', canNext, () => onNavigate(currentIndex + 1))}
            </div>
        </div>
    );
}

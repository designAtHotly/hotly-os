'use client';

import React from 'react';
import type { CommunityPrompt } from '@/lib/api';
import { truncateText, formatDate, FONT_SANS, FONT_SERIF } from './shared';
import { useFontScale } from './useFontScale';

interface PromptListItemProps {
    prompt: CommunityPrompt;
    isSelected: boolean;
    onClick: () => void;
    disabled?: boolean;
    padding?: string;
}

/** Shared prompt list item — used in PromptWeekSelector and MobileMenuDrawer */
export default function PromptListItem({
    prompt,
    isSelected,
    onClick,
    disabled,
    padding = '12px 16px',
}: PromptListItemProps) {
    const { f } = useFontScale();

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: '100%',
                padding,
                background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none',
                color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
                fontSize: f.caption,
                fontFamily: FONT_SERIF,
                fontStyle: 'italic',
                cursor: disabled ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s ease',
            }}
            className={!isSelected && !disabled ? 'hover-list-item' : ''}
        >
            <span style={{
                width: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(134, 239, 172, 0.9)" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
                &ldquo;{truncateText(prompt.content, 30)}&rdquo;
            </span>
            <span style={{
                fontSize: f.caption,
                fontFamily: FONT_SANS,
                fontStyle: 'normal',
                color: 'rgba(255,255,255,0.3)',
                flexShrink: 0,
                marginLeft: 8,
            }}>
                {formatDate(prompt.created_at)}
            </span>
        </button>
    );
}

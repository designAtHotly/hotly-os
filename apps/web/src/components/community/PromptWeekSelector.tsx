"use client";

import React, { useCallback } from 'react';
import type { CommunityPrompt } from '@/lib/api';
import { useDropdown, DROPDOWN_STYLE } from './useDropdown';
import { FONT_SANS } from './shared';
import { useFontScale } from './useFontScale';
import PromptListItem from './PromptListItem';
import ScrollArea from './ScrollArea';

interface PromptWeekSelectorProps {
    prompts: CommunityPrompt[];
    selectedPrompt: CommunityPrompt | null;
    onSelectPrompt: (prompt: CommunityPrompt) => void;
    loading?: boolean;
}

export default function PromptWeekSelector({
    prompts,
    selectedPrompt,
    onSelectPrompt,
    loading,
}: PromptWeekSelectorProps) {
    const { isOpen, ref, toggle, close } = useDropdown();
    const { f } = useFontScale();

    const handleSelect = useCallback((prompt: CommunityPrompt) => {
        close();
        onSelectPrompt(prompt);
    }, [close, onSelectPrompt]);

    // Don't render if only one or zero prompts
    if (prompts.length <= 1) return null;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Dropdown trigger */}
            <button
                onClick={toggle}
                disabled={loading}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 0',
                    background: 'none',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    transition: 'opacity 0.2s ease',
                    opacity: loading ? 0.4 : 0.7,
                }}
                onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = loading ? '0.4' : '0.7';
                }}
            >
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: f.caption, margin: '0 2px' }}>|</span>
                <span style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: f.caption,
                    fontFamily: FONT_SANS,
                    fontWeight: 500,
                }}>
                    View past prompts
                </span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div style={{ ...DROPDOWN_STYLE, left: 0, minWidth: 320, maxWidth: 380 }}>
                    <ScrollArea style={{
                        padding: '8px 0',
                        maxHeight: 300,
                        overflowY: 'auto',
                    }}>
                        {prompts.map((prompt) => (
                            <PromptListItem
                                key={prompt.uuid}
                                prompt={prompt}
                                isSelected={prompt.uuid === selectedPrompt?.uuid}
                                onClick={() => handleSelect(prompt)}
                            />
                        ))}
                    </ScrollArea>
                </div>
            )}

        </div>
    );
}

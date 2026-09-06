"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { CommunityPrompt } from '@/lib/api';
import { toggleFilter, displayName, FONT_SANS, type FilterType } from './shared';
import { useFontScale } from './useFontScale';
import UserAvatar from './UserAvatar';
import PromptListItem from './PromptListItem';
import ScrollArea from './ScrollArea';

interface MobileMenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: { name: string | null; photo: string | null } | null;
    onLogout: () => void;
    onLogin?: () => void;
    onCreatePrompt?: () => void;
    penpalUrl?: string;
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    creatorName: string;
    prompts: CommunityPrompt[];
    selectedPrompt: CommunityPrompt | null;
    onSelectPrompt: (prompt: CommunityPrompt) => void;
    loadingNotes: boolean;
}

export default function MobileMenuDrawer({
    isOpen,
    onClose,
    user,
    onLogout,
    onLogin,
    onCreatePrompt,
    penpalUrl,
    activeFilter,
    onFilterChange,
    creatorName,
    prompts,
    selectedPrompt,
    onSelectPrompt,
    loadingNotes,
}: MobileMenuDrawerProps) {
    const { f } = useFontScale();

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    const handleFilterClick = useCallback((filterId: FilterType) => {
        onFilterChange(toggleFilter(activeFilter, filterId));
    }, [onFilterChange, activeFilter]);

    const handlePromptSelect = useCallback((prompt: CommunityPrompt) => {
        onSelectPrompt(prompt);
    }, [onSelectPrompt]);

    const handleLogout = useCallback(() => {
        onClose();
        onLogout();
    }, [onClose, onLogout]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 50,
                    animation: 'drawerFadeIn 0.2s ease',
                }}
            />

            {/* Panel */}
            <div
                style={{
                    position: 'fixed', top: 0, left: 0, bottom: 0,
                    width: 'min(320px, 85vw)',
                    background: 'rgba(20, 18, 26, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    zIndex: 51,
                    display: 'flex', flexDirection: 'column',
                    animation: 'drawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Header with close button */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <span className="section-label" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Menu
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close menu"
                        style={{
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer', padding: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Fixed top: User + Logout / Sign in */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {user ? (
                        <div style={{
                            padding: '16px 20px',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <UserAvatar photo={user.photo} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="text-truncate" style={{
                                    color: 'rgba(255,255,255,0.9)', fontSize: f.body, fontWeight: 600,
                                    fontFamily: FONT_SANS,
                                }}>
                                    {displayName(user.name)}
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'rgba(255,255,255,0.35)', fontSize: f.caption,
                                    fontFamily: FONT_SANS,
                                    fontWeight: 500, cursor: 'pointer',
                                    padding: '4px 0', flexShrink: 0,
                                }}
                            >
                                Log out
                            </button>
                        </div>
                    ) : onLogin ? (
                        <div style={{ padding: '16px 20px' }}>
                            <button
                                onClick={onLogin}
                                style={{
                                    width: '100%', padding: '12px 14px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: f.body, fontFamily: FONT_SANS,
                                    fontWeight: 500, transition: 'all 0.2s ease',
                                }}
                            >
                                Sign in
                            </button>
                        </div>
                    ) : null}
                </div>

                {/* Penpal chat link */}
                {penpalUrl && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <Link
                            href={penpalUrl as Route}
                            onClick={onClose}
                            style={{
                                width: '100%', padding: '12px 14px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 12,
                                display: 'flex', alignItems: 'center', gap: 10,
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: f.body, fontFamily: FONT_SANS,
                                fontWeight: 500, textDecoration: 'none',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <span className="text-xl">💬</span>
                            <span style={{ flex: 1 }}>Chat with {creatorName.split(' ')[0]}</span>
                        </Link>
                    </div>
                )}

                {/* Fixed middle: Filters */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <DrawerButton
                        icon="⭐"
                        label={`${creatorName}'s notes`}
                        isActive={activeFilter === 'creator-notes'}
                        onClick={() => handleFilterClick('creator-notes')}
                    />
                    {user && (
                        <DrawerButton
                            icon="💬"
                            label="Your notes"
                            isActive={activeFilter === 'your-notes'}
                            onClick={() => handleFilterClick('your-notes')}
                        />
                    )}
                </div>


                {/* Creator: New prompt */}
                {onCreatePrompt && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                            onClick={onCreatePrompt}
                            style={{
                                width: '100%', padding: '12px 14px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 12, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: f.body, fontFamily: FONT_SANS,
                                fontWeight: 500, transition: 'all 0.2s ease',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            New prompt
                        </button>
                    </div>
                )}

                {/* Scrollable: Past prompts (load 10 at a time) */}
                {prompts.length > 1 && (
                    <PastPromptsList
                        prompts={prompts}
                        selectedPrompt={selectedPrompt}
                        onSelectPrompt={handlePromptSelect}
                        loadingNotes={loadingNotes}
                    />
                )}
            </div>

        </>
    );
}

/* Past prompts list with load-more (10 at a time) */
function PastPromptsList({
    prompts,
    selectedPrompt,
    onSelectPrompt,
    loadingNotes,
}: {
    prompts: CommunityPrompt[];
    selectedPrompt: CommunityPrompt | null;
    onSelectPrompt: (prompt: CommunityPrompt) => void;
    loadingNotes: boolean;
}) {
    const { f } = useFontScale();
    const PAGE_SIZE = 10;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const visiblePrompts = prompts.slice(0, visibleCount);
    const hasMore = visibleCount < prompts.length;

    return (
        <ScrollArea style={{ flex: 1, overflowY: 'auto' }}>
            <div className="section-label" style={{ color: 'rgba(255,255,255,0.3)', padding: '16px 20px 8px' }}>
                Past prompts
            </div>
            {visiblePrompts.map((p) => (
                <PromptListItem
                    key={p.uuid}
                    prompt={p}
                    isSelected={p.uuid === selectedPrompt?.uuid}
                    onClick={() => onSelectPrompt(p)}
                    disabled={loadingNotes}
                    padding="10px 20px"
                />
            ))}
            {hasMore && (
                <button
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    style={{
                        width: '100%', padding: '14px 20px',
                        background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.4)', fontSize: f.caption,
                        fontFamily: FONT_SANS,
                        fontWeight: 500, cursor: 'pointer',
                        textAlign: 'center',
                    }}
                >
                    Show more ({prompts.length - visibleCount} remaining)
                </button>
            )}
        </ScrollArea>
    );
}

/* Reusable drawer button for filter items */
function DrawerButton({
    icon,
    label,
    isActive,
    onClick,
}: {
    icon: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    const { f } = useFontScale();

    return (
        <button
            onClick={onClick}
            className={`press-scale${isActive ? ' hover-filter-active' : ' hover-filter'}`}
            style={{
                width: '100%', padding: '12px 14px',
                background: isActive ? 'rgba(255,255,255,0.80)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.85)' : '1px solid transparent',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 6,
                transition: 'all 0.2s ease',
            }}
        >
            <span style={{ fontSize: f.body }}>{icon}</span>
            <span style={{
                color: isActive ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.6)',
                fontSize: f.body, fontFamily: FONT_SANS,
                fontWeight: isActive ? 600 : 500,
                flex: 1, textAlign: 'left',
            }}>
                {label}
            </span>
            {isActive && (
                <span style={{
                    fontSize: f.body, color: 'rgba(0,0,0,0.4)',
                }}>
                    ✕
                </span>
            )}
        </button>
    );
}

"use client";

import { useCallback } from 'react';
import { toggleFilter, FONT_SANS, C_AMBER, C_AMBER_30, type FilterType } from './shared';
import { useFontScale } from './useFontScale';

export type { FilterType } from './shared';

interface CommunityFiltersProps {
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    creatorName?: string;
    isLoggedIn: boolean;
    onCreateDome?: () => void;
    createDomeNudge?: boolean;
    onCreateDomeNudgeClear?: () => void;
}

export default function CommunityFilters({
    activeFilter,
    onFilterChange,
    creatorName = 'Creator',
    isLoggedIn,
    onCreateDome,
    createDomeNudge,
    onCreateDomeNudgeClear,
}: CommunityFiltersProps) {
    const { f } = useFontScale();

    const handleClick = useCallback((id: FilterType) => {
        onFilterChange(toggleFilter(activeFilter, id));
    }, [onFilterChange, activeFilter]);

    const pill = (id: FilterType, icon: string, label: string) => {
        const active = activeFilter === id;
        return (
            <button
                onClick={() => handleClick(id)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 14px', minHeight: 44, borderRadius: 22,
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    background: active ? 'rgba(255,255,255,0.85)' : 'transparent',
                    backdropFilter: active ? 'none' : 'blur(12px)',
                    border: `1px solid rgba(255,255,255,${active ? 0.85 : 0.12})`,
                }}
                className={`press-scale ${active ? 'hover-filter-active' : 'hover-filter'}`}
            >
                <span style={{ fontSize: f.caption }}>{icon}</span>
                <span style={{
                    color: active ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.55)',
                    fontSize: f.caption, fontFamily: FONT_SANS,
                    fontWeight: active ? 600 : 500,
                }}>
                    {label}
                </span>
                {active && (
                    <span style={{ fontSize: f.body, color: 'rgba(0,0,0,0.4)', marginLeft: 4, lineHeight: 1 }}>
                        ✕
                    </span>
                )}
            </button>
        );
    };

    return (
        <div style={{ width: '100%', marginTop: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pill('creator-notes', '⭐', `${creatorName}'s notes`)}
                {isLoggedIn && pill('your-notes', '💬', 'Your notes')}
                {onCreateDome && (
                    <button
                        onClick={onCreateDome}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 14px', minHeight: 44, borderRadius: 22,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                            background: 'rgba(30, 25, 10, 0.85)',
                            backdropFilter: 'blur(12px)',
                            border: `1px solid ${C_AMBER_30}`,
                            ...(createDomeNudge ? { animation: 'createDomeNudge 0.8s ease-out 1' } : {}),
                        }}
                        onAnimationEnd={onCreateDomeNudgeClear}
                        className="press-scale hover-glass-subtle"
                    >
                        <svg width={f.caption} height={f.caption} viewBox="0 0 24 24" fill="none" stroke={C_AMBER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span style={{
                            color: C_AMBER,
                            textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.3)',
                            fontSize: f.caption, fontFamily: FONT_SANS,
                            fontWeight: 600,
                        }}>
                            Create your dome
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}

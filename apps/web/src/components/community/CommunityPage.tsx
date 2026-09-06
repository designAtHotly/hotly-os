"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { FONT_SANS, FONT_SERIF, C_AMBER, C_AMBER_30 } from './shared';
import './community.css';
import ParticleBackground from './ParticleBackground';
import DomeBackground from './DomeBackground';
import UserMenu from './UserMenu';
import { CommunityNote, CommunityPrompt, Community } from '@/lib/api';
import PromptWeekSelector from './PromptWeekSelector';
import CommunityFilters from './CommunityFilters';
import CommunityOverlays from './CommunityOverlays';
import { useCommunityState } from './useCommunityState';
import type { CoffeeCreator } from '@/lib/api/creator';
import * as pageHelper from '@/lib/utils/page-helper';
import { appMediaUrl } from '@/lib/media/url';

const BG_COLOR = '#0f0d13';

function truncateName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[1][0]}.`;
}

interface CommunityPageProps {
    creator: CoffeeCreator;
    community: Community;
    prompts: CommunityPrompt[];
    initialNotes: CommunityNote[];
    initialTotalCount: number;
    initialNoteId?: string;
    celebrate?: boolean;
}

export default function CommunityPage({ creator, community, prompts, initialNotes, initialTotalCount, initialNoteId, celebrate }: CommunityPageProps) {
    const pageState = useCommunityState({ creator, community, prompts, initialNotes, initialTotalCount, initialNoteId, celebrate });

    // Auto-open share overlay — 3s on empty dome for creator, once per session
    useEffect(() => {
        if (!pageState.isCreator || pageState.notes.length > 0) return;
        const key = 'dome_share_nudge_shown';
        if (sessionStorage.getItem(key)) return;
        const timer = setTimeout(() => {
            sessionStorage.setItem(key, '1');
            pageState.setOverlay({ type: 'share' });
        }, 3000);
        return () => clearTimeout(timer);
    }, [pageState.isCreator, pageState.notes.length, pageState.setOverlay]);

    return (
        <div style={{ width: '100%', height: '100vh', background: BG_COLOR, overflow: 'hidden', overscrollBehavior: 'none', position: 'fixed', inset: 0 }}>
            <ParticleBackground isStatic={pageState.notes.length >= 35} />
            {/* LAYER 1: Dome */}
            <DomeBackground
                notes={pageState.filteredNotes}
                onTileClick={pageState.handleTileClick}
                disabled={pageState.isDomeDisabled}
                highlightedNoteId={pageState.highlightedNoteId}
                onHighlightComplete={() => pageState.setHighlightedNoteId(null)}
            />

            {/* Edge gradients */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '30%', background: `linear-gradient(to bottom, ${BG_COLOR} 5%, transparent 100%)`, zIndex: 2, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '30%', background: `linear-gradient(to top, ${BG_COLOR} 5%, transparent 100%)`, zIndex: 2, pointerEvents: 'none' }} />
            <div style={{
                position: 'fixed', top: 0, left: 0,
                width: pageState.isMobile ? '100%' : '65%',
                height: pageState.isMobile ? '35%' : '65%',
                ...(pageState.isMobile
                    ? { background: `linear-gradient(to bottom, ${BG_COLOR} 0%, rgba(15,13,19,0.85) 40%, transparent 100%)` }
                    : { backgroundImage: 'url(/BGgradient.svg)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'top left' }
                ),
                opacity: pageState.isMobile ? 1 : 0.9,
                zIndex: 2, pointerEvents: 'none',
            }} />

            {/* LAYER 2: UI Overlay */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
                {/* Mobile: prompt + hamburger in one row */}
                {pageState.isMobile && (
                    <div style={{
                        position: 'absolute', top: 20, left: 20, right: 20,
                        pointerEvents: 'auto',
                    }}>
                        {/* Top row: Hamburger (left) + Chat (right) */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: 8,
                        }}>
                            <button
                                onClick={() => pageState.setOverlay({ type: 'mobileMenu' })}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 4,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                                }}
                                aria-label="Open menu"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                            <Link
                                href={pageHelper.getCreatorVariantPage(creator.username, creator.variant || 'penpal') as Route}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    height: 40,
                                    paddingLeft: 10, paddingRight: 12,
                                    background: 'rgba(30,27,35,0.85)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                                    borderRadius: 50,
                                    color: 'rgba(255,255,255,0.9)',
                                    textDecoration: 'none',
                                    fontFamily: FONT_SANS,
                                    transition: 'all 0.15s ease',
                                }}
                                className="hover-glass-subtle"
                            >
                                <span className="text-2xl">💬</span>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Chat with {pageState.creatorName.split(' ')[0]}</span>
                            </Link>
                        </div>

                        {/* Prompt text — full width */}
                        <h1 style={{
                            color: 'white',
                            fontSize: pageState.f.heading,
                            fontWeight: 400, margin: 0,
                            fontFamily: FONT_SERIF, fontStyle: 'italic',
                            lineHeight: 1.2,
                        }}>
                            &ldquo;{pageState.promptText}&rdquo;
                        </h1>

                        {/* Attribution + Create dome — single row */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginTop: 6,
                            fontSize: pageState.f.body,
                            fontFamily: FONT_SANS,
                            whiteSpace: 'nowrap',
                        }}>
                            {appMediaUrl(pageState.creatorAvatar) && (
                                <img src={appMediaUrl(pageState.creatorAvatar)} alt="" style={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    objectFit: 'cover', opacity: 0.7, flexShrink: 0,
                                }} />
                            )}
                            <span style={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                {truncateName(pageState.creatorName)}
                                {pageState.totalCount > 0 && (
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: pageState.f.caption, marginLeft: 4 }}>
                                        ({pageState.totalCount} {pageState.totalCount === 1 ? 'thought' : 'thoughts'})
                                    </span>
                                )}
                            </span>
                            {!pageState.isCreator && (
                                <button
                                    type="button"
                                    onClick={pageState.handleStartDomeCreation}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px',
                                        marginLeft: 2, flexShrink: 0,
                                        background: 'rgba(30, 25, 10, 0.7)',
                                        backdropFilter: 'blur(12px)',
                                        borderRadius: 50,
                                        border: `1px solid ${C_AMBER_30}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        color: C_AMBER,
                                        fontSize: pageState.f.caption,
                                        fontFamily: FONT_SANS,
                                        fontWeight: 600,
                                        ...(pageState.createDomeNudge ? { animation: 'createDomeNudge 0.8s ease-out 1' } : {}),
                                    }}
                                    onAnimationEnd={() => pageState.rearmCreateDomeNudge()}
                                    className="hover-glass-subtle"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="16" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                    Create your dome
                                </button>
                            )}
                        </div>
                        {pageState.activeFilter !== 'all' && (
                            <CommunityFilters
                                activeFilter={pageState.activeFilter}
                                onFilterChange={pageState.setActiveFilter}
                                creatorName={pageState.creatorName}
                                isLoggedIn={!!pageState.currentUser}
                            />
                        )}
                    </div>
                )}

                {/* Desktop: Prompt */}
                {!pageState.isMobile && (
                    <div style={{
                        position: 'absolute', top: 40, left: 32,
                        maxWidth: 400, pointerEvents: 'auto',
                    }}>
                        <h1 style={{
                            color: 'white',
                            fontSize: pageState.f.heading,
                            fontWeight: 400, margin: 0,
                            fontFamily: FONT_SERIF, fontStyle: 'italic',
                            lineHeight: 1.3, transition: 'font-size 0.6s ease',
                        }}>
                            &ldquo;{pageState.promptText}&rdquo;
                            {pageState.notes.length > 0 && (
                                <span
                                    onClick={() => pageState.setPromptCollapsed(c => !c)}
                                    className="hover-text-bright"
                                    style={{ color: 'rgba(255,255,255,0.5)', fontSize: pageState.f.caption, cursor: 'pointer', userSelect: 'none', fontFamily: FONT_SANS, fontStyle: 'normal', marginLeft: 8, fontWeight: 400, transition: 'color 0.2s ease' }}
                                >
                                    {pageState.promptCollapsed ? 'SHOW DETAILS' : 'HIDE'}
                                </span>
                            )}
                        </h1>
                        {!pageState.promptCollapsed && (
                            <div style={{ animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                    {appMediaUrl(pageState.creatorAvatar) && (
                                        <img src={appMediaUrl(pageState.creatorAvatar)} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', opacity: 0.7 }} />
                                    )}
                                    <span style={{ color: 'white', fontSize: pageState.f.body, fontFamily: FONT_SERIF, fontStyle: 'italic' }}>
                                        {pageState.creatorName}
                                    </span>
                                    <PromptWeekSelector
                                        prompts={pageState.allPrompts}
                                        selectedPrompt={pageState.prompt}
                                        onSelectPrompt={pageState.handleSelectPrompt}
                                        loading={pageState.loadingNotes}
                                    />
                                </div>
                                {pageState.totalCount > 0 && (
                                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: pageState.f.caption, margin: '12px 0 0', fontFamily: FONT_SANS }}>
                                        {pageState.activeFilter === 'all'
                                            ? `${pageState.totalCount} ${pageState.totalCount === 1 ? 'note' : 'notes'} from the community`
                                            : `${pageState.filteredNotes.length} of ${pageState.totalCount} notes`
                                        }
                                    </p>
                                )}
                                {pageState.notes.length > 0 && (
                                    <CommunityFilters
                                        activeFilter={pageState.activeFilter}
                                        onFilterChange={pageState.setActiveFilter}
                                        creatorName={pageState.creatorName}
                                        isLoggedIn={!!pageState.currentUser}
                                        onCreateDome={!pageState.isCreator ? pageState.handleStartDomeCreation : undefined}
                                        createDomeNudge={pageState.createDomeNudge}
                                        onCreateDomeNudgeClear={() => pageState.rearmCreateDomeNudge()}
                                    />
                                )}
                                {pageState.isCreator && (
                                    <button
                                        onClick={() => pageState.setOverlay({ type: 'createPrompt' })}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '8px 14px',
                                            marginTop: 12,
                                            background: 'rgba(255,255,255,0.08)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: 50,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            cursor: 'pointer', transition: 'all 0.2s ease',
                                            color: 'rgba(255,255,255,0.6)',
                                            fontSize: pageState.f.caption,
                                            fontFamily: FONT_SANS,
                                            fontWeight: 500,
                                        }}
                                        className="hover-glass-subtle"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        New prompt
                                    </button>
                                )}
                            </div>
                        )}
                        {/* Fallback CTA chip when no notes / filters not visible */}
                        {pageState.notes.length === 0 && !pageState.isCreator && (
                            <CommunityFilters
                                activeFilter={pageState.activeFilter}
                                onFilterChange={pageState.setActiveFilter}
                                creatorName={pageState.creatorName}
                                isLoggedIn={!!pageState.currentUser}
                                onCreateDome={pageState.handleStartDomeCreation}
                                createDomeNudge={pageState.createDomeNudge}
                                onCreateDomeNudgeClear={() => pageState.rearmCreateDomeNudge()}
                            />
                        )}
                    </div>
                )}

                {/* Desktop: Chat + User Menu */}
                {!pageState.isMobile && (
                    <div style={{ position: 'absolute', top: 40, right: 32, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Link
                                href={pageHelper.getCreatorVariantPage(creator.username, creator.variant || 'penpal') as Route}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 14px 8px 10px',
                                background: 'rgba(255,255,255,0.10)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 50,
                                color: 'rgba(255,255,255,0.85)',
                                textDecoration: 'none',
                                fontSize: pageState.f.body,
                                fontFamily: FONT_SANS,
                                fontWeight: 500,
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                            }}
                            className="hover-glass-subtle"
                        >
                            <span className="text-2xl">💬</span>
                            <span>Chat with {pageState.creatorName.split(' ')[0]}</span>
                        </Link>
                        <UserMenu
                            user={pageState.userMenuData}
                            onLogout={pageState.signOut}
                            onLogin={() => pageState.setOverlay({ type: 'auth' })}
                            isCreator={pageState.isCreator}
                        />
                    </div>
                )}

                {/* Loading State - Switching prompts */}
                {pageState.loadingNotes && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: FONT_SANS, textAlign: 'center', padding: 40 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.1)',
                            borderTopColor: 'rgba(255,255,255,0.4)',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    </div>
                )}

                {/* Empty State - No notes at all */}
                {!pageState.loadingNotes && pageState.notes.length === 0 && pageState.overlay.type !== 'composer' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: FONT_SERIF, textAlign: 'center', padding: 40 }}>
                        {pageState.isCreator ? (
                            <>
                                <span style={{ fontSize: pageState.f.displayLg, marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(255,220,150,0.3))', animation: 'moonGlow 4s ease-in-out infinite' }}>🌙</span>
                                <p style={{ fontSize: pageState.f.heading, margin: 0, fontStyle: 'italic', letterSpacing: '0.02em' }}>Your question is out there</p>
                                <p style={{ fontSize: pageState.f.subtitle, margin: '14px 0 0', color: 'rgba(255,255,255,0.22)', fontFamily: FONT_SANS, fontStyle: 'normal', letterSpacing: '0.04em' }}>The first note will change everything.</p>
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: pageState.f.displayLg, marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(255,220,150,0.3))', animation: 'moonGlow 4s ease-in-out infinite' }}>🌙</span>
                                <p style={{ fontSize: pageState.f.subtitle, margin: 0, fontStyle: 'italic', letterSpacing: '0.02em' }}>Your thoughts are welcome here</p>
                                <p style={{ fontSize: pageState.f.caption, margin: '12px 0 0', color: 'rgba(255,255,255,0.18)', fontFamily: FONT_SANS, fontStyle: 'normal', letterSpacing: '0.04em' }}>A space for real thoughts from real people</p>
                            </>
                        )}
                    </div>
                )}

                {/* Empty State - Filter returned no results */}
                {!pageState.loadingNotes && pageState.notes.length > 0 && pageState.filteredNotes.length === 0 && pageState.overlay.type !== 'composer' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: FONT_SERIF, textAlign: 'center', padding: 40 }}>
                        {pageState.activeFilter === 'creator-notes' ? (
                            <>
                                <p style={{ fontSize: pageState.f.body, margin: 0, fontStyle: 'italic' }}>{pageState.creatorName} hasn&rsquo;t shared yet this week.</p>
                                <p style={{ fontSize: pageState.f.caption, margin: '10px 0 0', color: 'rgba(255,255,255,0.2)', fontFamily: FONT_SANS, fontStyle: 'normal' }}>Check back soon.</p>
                            </>
                        ) : pageState.activeFilter === 'your-notes' ? (
                            <>
                                <p style={{ fontSize: pageState.f.body, margin: 0, fontStyle: 'italic' }}>You haven&rsquo;t added a note yet.</p>
                                <p style={{ fontSize: pageState.f.caption, margin: '10px 0 0', color: 'rgba(255,255,255,0.2)', fontFamily: FONT_SANS, fontStyle: 'normal' }}>Your thoughts are welcome here.</p>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: pageState.f.body, margin: 0, fontStyle: 'italic' }}>Nothing here yet.</p>
                                <button
                                    onClick={() => pageState.setActiveFilter('all')}
                                    className="hover-glass-subtle"
                                    style={{
                                        marginTop: 16,
                                        padding: '8px 16px',
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: 20,
                                        color: 'rgba(255,255,255,0.6)',
                                        fontSize: pageState.f.caption,
                                        fontFamily: FONT_SANS,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    Show all notes
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Bottom actions */}
                <div style={{
                    position: 'absolute',
                    bottom: pageState.isMobile ? 24 : 32,
                    ...(pageState.isMobile
                        ? { left: 16, right: 16 }
                        : { right: 32 }
                    ),
                    display: 'flex', alignItems: 'center', justifyContent: pageState.isMobile ? 'center' : 'flex-end', gap: 10,
                    pointerEvents: 'none',
                }}>
                    {/* Share button — creator only, empty dome */}
                    {pageState.isCreator && pageState.notes.length === 0 && (
                        <button
                            type="button"
                            onClick={() => pageState.setOverlay({ type: 'share' })}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)',
                                padding: pageState.isMobile ? '16px 20px' : '14px 20px',
                                borderRadius: 50,
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'rgba(255,255,255,0.6)', fontFamily: FONT_SANS,
                                fontSize: pageState.f.body, fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.2s ease', pointerEvents: 'auto',
                                whiteSpace: 'nowrap',
                            }}
                            className="hover-glass-subtle"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            {pageState.isMobile ? 'Invite' : 'Invite someone in'}
                        </button>
                    )}

                    {/* Add Note Button */}
                    <button
                        type="button"
                        onClick={() => pageState.setOverlay({ type: 'composer' })}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                            padding: pageState.isMobile ? '16px 20px' : '14px 24px',
                            borderRadius: 50,
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white', fontFamily: FONT_SANS,
                            fontSize: pageState.f.body, fontWeight: 500, cursor: 'pointer',
                            touchAction: 'manipulation', transition: 'all 0.2s ease', pointerEvents: 'auto',
                            whiteSpace: 'nowrap',
                            ...(pageState.idleNudge ? { animation: 'idleNudge 0.6s ease-out 1' } : {}),
                        }}
                        onAnimationEnd={() => pageState.rearmIdleNudge()}
                        className="hover-glass hover-scale"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {pageState.notes.length === 0
                            ? (pageState.isCreator ? 'Add Your Thought' : 'Start the conversation')
                            : 'Add Your Thought'}
                    </button>
                </div>

            </div>

            {/* LAYER 3: Overlays (modals, drawers, toast) */}
            <CommunityOverlays pageState={pageState} onCelebrationClose={() => {
                const key = 'dome_share_nudge_shown';
                if (sessionStorage.getItem(key)) return;
                sessionStorage.setItem(key, '1');
                setTimeout(() => pageState.setOverlay({ type: 'share' }), 600);
            }} />
        </div>
    );
}

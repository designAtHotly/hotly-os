"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { getColor, formatTimestamp, FONT_SANS, FONT_SERIF } from './shared';
import type { CommunityNote } from '@/lib/api';
import CloseButton from './CloseButton';
import { SCROLL_CLASS } from './ScrollArea';
import { useFontScale } from './useFontScale';
import { buildHierarchy, flattenThread, getNotesById, findThreadRoot, getThreadNotes } from './threadUtils';
import NavigationHeader from './NavigationHeader';
import { useNudgeTimer } from './useNudgeTimer';

interface NoteThreadViewProps {
    notes: CommunityNote[];
    selectedNote: CommunityNote;
    onReply: (note: CommunityNote) => void;
    onShare: (note: CommunityNote) => void;
    onClose: () => void;
    highlightedNoteId?: string | null;
    onHighlightComplete?: () => void;
    onCreateDome?: () => void;
}

export default function NoteThreadView({
    notes,
    selectedNote,
    onReply,
    onShare,
    onClose,
    highlightedNoteId,
    onHighlightComplete,
    onCreateDome,
}: NoteThreadViewProps): React.JSX.Element {
    const { isMobile, f } = useFontScale();

    // Subtle glow on share button after 3.5s of reading, twice then stop
    const { nudge: shareNudge, rearm: rearmShareNudge } = useNudgeTimer({
        enabled: true,
        delay: 5500,
        maxFires: 2,
    });

    // Clear highlight after animation
    useEffect(() => {
        if (!highlightedNoteId) return;
        const timer = setTimeout(() => {
            onHighlightComplete?.();
        }, 6000);
        return () => clearTimeout(timer);
    }, [highlightedNoteId, onHighlightComplete]);

    // Thread data — build one shared index, reuse everywhere
    const allNotesById = useMemo(() => getNotesById(notes), [notes]);
    const rootId = useMemo(
        () => findThreadRoot(allNotesById, selectedNote.uuid),
        [allNotesById, selectedNote.uuid]
    );
    const threadNotes = useMemo(
        () => getThreadNotes(notes, allNotesById, rootId),
        [notes, allNotesById, rootId]
    );
    const root = useMemo(
        () => buildHierarchy(threadNotes, rootId),
        [threadNotes, rootId]
    );
    const flatNotes = useMemo(
        () => (root ? flattenThread(root) : []),
        [root]
    );
    const notesById = allNotesById;

    const hasReplies = flatNotes.length > 1;

    // Navigation state — start at the note they tapped
    const initialIndex = useMemo(() => {
        const idx = flatNotes.findIndex(entry => entry.note.uuid === selectedNote.uuid);
        return idx >= 0 ? idx : 0;
    }, [flatNotes, selectedNote.uuid]);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [animKey, setAnimKey] = useState(0);

    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex]);

    const navigate = useCallback(
        (idx: number) => {
            if (idx >= 0 && idx < flatNotes.length && idx !== currentIndex) {
                setAnimKey(k => k + 1);
                setCurrentIndex(idx);
            }
        },
        [flatNotes.length, currentIndex]
    );

    // Keyboard: Escape to close, arrows to navigate
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (hasReplies) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
                    navigate(currentIndex + 1);
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
                    navigate(currentIndex - 1);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, hasReplies, currentIndex, navigate]);

    // Touch/swipe handling
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!hasReplies) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0) navigate(currentIndex + 1);
            else navigate(currentIndex - 1);
        }
    }, [hasReplies, navigate, currentIndex]);

    // Derived state
    const currentNote = flatNotes[currentIndex]?.note;
    const fallbackNote = currentNote || selectedNote;
    const parentNote = currentNote?.parent_uuid ? notesById[currentNote.parent_uuid] : null;
    const color = getColor(fallbackNote.color);
    const parentColor = parentNote ? getColor(parentNote.color) : null;
    const isHighlighted = currentNote?.uuid === highlightedNoteId;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000,
                alignItems: 'center',
                justifyContent: hasReplies ? 'flex-start' : 'center',
                background: 'rgba(8, 10, 14, 0.88)',
                fontFamily: FONT_SANS,
                padding: hasReplies
                    ? (isMobile ? '3vh 0 0' : '10vh 20px 20px')
                    : (isMobile ? '20px 0' : 20),
                overflowY: 'auto',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Outer dark card — wraps everything when thread has replies */}
            <div
                style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : (hasReplies ? 414 : 380),
                    position: 'relative',
                    ...(hasReplies ? {
                        background: 'rgba(20, 22, 28, 0.95)',
                        borderRadius: isMobile ? 0 : 28,
                        border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        padding: isMobile ? '12px 10px 10px' : '16px 17px 17px',
                    } : {}),
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Close button — only when single note (no replies) */}
                {!hasReplies && (
                    <CloseButton onClick={onClose} style={{ position: 'absolute', top: -48, right: 0, zIndex: 10 }} />
                )}

                {/* Navigation header — only when replies exist */}
                {hasReplies && root && (
                    <div style={{ marginBottom: isMobile ? 8 : 16 }}>
                        <NavigationHeader
                            root={root}
                            flatNotes={flatNotes}
                            currentIndex={currentIndex}
                            onNavigate={navigate}
                            onClose={onClose}
                        />
                    </div>
                )}

                {/* Note card — nested inside with visible rounded corners */}
                <div
                    key={animKey}
                    className={SCROLL_CLASS}
                    style={{
                        width: '100%',
                        borderRadius: 20,
                        overflow: 'hidden',
                        overflowY: 'auto',
                        maxHeight: hasReplies
                            ? (isMobile ? 'calc(97vh - 200px)' : 'calc(90vh - 320px)')
                            : '80vh',
                        boxShadow: hasReplies ? 'none' : '0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
                        position: 'relative',
                        animation: animKey > 0 ? 'cardFadeIn 0.25s ease-out' : undefined,
                    }}
                >
                    {/* Shimmer overlay for highlighted note */}
                    {isHighlighted && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: 20,
                                overflow: 'hidden',
                                pointerEvents: 'none',
                                zIndex: 10,
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
                                    animation: 'noteShimmer 1.5s ease-in-out 4',
                                }}
                            />
                        </div>
                    )}

                    {/* Parent context */}
                    {parentNote && parentColor && (
                        <div
                            onClick={() => {
                                const idx = flatNotes.findIndex(entry => entry.note.uuid === parentNote.uuid);
                                if (idx >= 0) navigate(idx);
                            }}
                            style={{
                                padding: '14px 20px',
                                background: parentColor.bg,
                                color: parentColor.text,
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 6,
                            }}>
                                <span style={{ fontSize: f.body, opacity: 0.45, flexShrink: 0 }}>↩</span>
                                <span style={{ fontSize: f.subtitle, lineHeight: 1, flexShrink: 0 }}>
                                    {parentNote.emoji || '🌙'}
                                </span>
                                <span style={{
                                    fontSize: f.small,
                                    opacity: 0.5,
                                    fontWeight: 500,
                                }}>
                                    {parentNote.is_anonymous ? 'Anonymous' : (parentNote.author_name || 'Anonymous')}
                                </span>
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: f.body,
                                    lineHeight: 1.5,
                                    opacity: 0.65,
                                    fontStyle: 'italic',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                &ldquo;{parentNote.content}&rdquo;
                            </p>
                        </div>
                    )}

                    {/* Note content */}
                    <div
                        style={{
                            padding: '28px 24px 24px',
                            textAlign: 'center',
                            background: color.bg,
                        }}
                    >
                        <div style={{ fontSize: f.displaySm, marginBottom: 20, lineHeight: 1 }}>
                            {fallbackNote.emoji || '🌙'}
                        </div>

                        <p
                            style={{
                                fontFamily: FONT_SERIF,
                                fontSize: f.subtitle,
                                lineHeight: 1.65,
                                margin: '0 0 20px',
                                color: color.text,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {fallbackNote.content}
                        </p>

                        <div
                            style={{
                                fontSize: f.caption,
                                color: color.text,
                                opacity: 0.4,
                                marginBottom: 24,
                            }}
                        >
                            {fallbackNote.is_anonymous ? 'Anonymous' : (fallbackNote.author_name || 'Anonymous')} · {formatTimestamp(new Date(fallbackNote.created_at))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <button
                                onClick={() => onReply(fallbackNote)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '10px 22px',
                                    background: 'rgba(0,0,0,0.06)',
                                    border: 'none',
                                    borderRadius: 20,
                                    fontSize: f.body,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    color: color.text,
                                    opacity: 0.7,
                                    transition: 'all 0.2s',
                                }}
                            >
                                ↩ Reply
                            </button>
                            <button
                                onClick={() => onShare(fallbackNote)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '10px 22px',
                                    background: 'rgba(0,0,0,0.06)',
                                    border: 'none',
                                    borderRadius: 20,
                                    fontSize: f.body,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    color: color.text,
                                    opacity: 0.7,
                                    transition: 'all 0.2s',
                                    ...(shareNudge ? { animation: 'shareNudgeGlow 1s ease-out 1' } : {}),
                                }}
                                onAnimationEnd={() => rearmShareNudge()}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reflective CTA — below the note card, in the dark backdrop */}
            {onCreateDome && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCreateDome(); }}
                    style={{
                        marginTop: 20,
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        opacity: 0.55,
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        fontFamily: FONT_SERIF,
                        fontStyle: 'italic',
                        fontSize: f.caption,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                        pointerEvents: 'auto',
                        textAlign: 'center',
                    }}
                    className="hover-text-bright"
                >
                    What would you ask?
                </button>
            )}

        </div>
    );
}

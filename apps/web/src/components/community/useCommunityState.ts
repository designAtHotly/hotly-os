import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { NoteDraft } from './shared';
import {
    getCommunityNotesByPromptV2,
    getCommunityNotesByUser,
    createCommunityNote,
    createCommunityPrompt,
    CommunityNote,
    CommunityPrompt,
    Community,
} from '@/lib/api';
import type { FilterType } from './CommunityFilters';
import type { CoffeeCreator } from '@/lib/api/creator';
import { useAuth } from '@/hooks/useAuth';
import { PENDING_NOTE_KEY, PENDING_ACTION_KEY, PENDING_ACTION_CREATE_DOME } from '@/lib/firebase/auth';
import { isSignedIn } from '@/lib/utils/token-service';
import { getCommunityPromptPage } from '@/lib/utils/page-helper';
import { useFontScale } from './useFontScale';
import { useToast } from './useToast';
import { useNudgeTimer } from './useNudgeTimer';

async function loadNotes(promptUuid: string): Promise<{ notes: CommunityNote[]; totalCount: number }> {
    const res = await getCommunityNotesByPromptV2(promptUuid);
    return { notes: res.body?.notes || [], totalCount: res.body?.total_count || 0 };
}

/** Merge paginated notes with user's own notes, deduplicating by uuid */
function mergeNotes(paginatedNotes: CommunityNote[], userNotes: CommunityNote[]): CommunityNote[] {
    const seen = new Set(paginatedNotes.map(n => n.uuid));
    const extra = userNotes.filter(n => !seen.has(n.uuid));
    return [...paginatedNotes, ...extra];
}

export type Overlay =
    | { type: 'none' }
    | { type: 'composer'; replyTo?: CommunityNote }
    | { type: 'thread'; note: CommunityNote }
    | { type: 'share'; note?: CommunityNote }
    | { type: 'auth'; pendingAction?: 'createDome' }
    | { type: 'mobileMenu' }
    | { type: 'createPrompt' }
    | { type: 'createDome' }
    | { type: 'domeExplainer' }
    | { type: 'celebration'; promptContent: string };

interface UseCommunityStateProps {
    creator: CoffeeCreator;
    community: Community;
    prompts: CommunityPrompt[];
    initialNotes: CommunityNote[];
    initialTotalCount: number;
    initialNoteId?: string;
    celebrate?: boolean;
}

export function useCommunityState({ creator, community, prompts, initialNotes, initialTotalCount, initialNoteId, celebrate }: UseCommunityStateProps) {
    const { currentUser, signOut } = useAuth();
    const { isMobile, f } = useFontScale();

    const updatePromptSlug = useCallback((slug: string, replace = false) => {
        const url = getCommunityPromptPage(creator.username || '', slug);
        if (replace) {
            window.history.replaceState(null, '', url);
        } else {
            window.history.pushState(null, '', url);
        }
    }, [creator.username]);

    // On mount, set URL to /[creator]/dome/[slug] if not already there
    useEffect(() => {
        const initialPrompt = prompts[0];
        if (!initialPrompt?.share_slug) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('s')) return;
        if (window.location.hash.startsWith('#note-')) return;
        // If already on the correct dome route, skip
        if (window.location.pathname.includes('/dome/')) return;
        updatePromptSlug(initialPrompt.share_slug, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updatePromptSlug]);

    const [notes, setNotes] = useState<CommunityNote[]>(initialNotes);
    const [totalCount, setTotalCount] = useState(initialTotalCount);
    const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
    const [pendingHighlightOnClose, setPendingHighlightOnClose] = useState<string | null>(null);

    const [overlay, setOverlay] = useState<Overlay>(
        celebrate ? { type: 'celebration', promptContent: prompts[0]?.content || '' } : { type: 'none' }
    );

    // Clean up ?celebrate param from URL after reading it
    useEffect(() => {
        if (!celebrate) return;
        const url = new URL(window.location.href);
        url.searchParams.delete('celebrate');
        window.history.replaceState(null, '', url.pathname + (url.search || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [prompt, setPrompt] = useState<CommunityPrompt | null>(prompts[0] || null);
    const promptRef = useRef(prompt);
    promptRef.current = prompt;
    const [loadingNotes, setLoadingNotes] = useState(false);
    const submittingRef = useRef(false);

    const isCreator = Boolean(currentUser?.is_creator) || (currentUser != null && currentUser.id === creator.user_id && creator.user_id !== 0);
    const creatorName = (isCreator && currentUser?.name) || creator.name || creator.username || 'Creator';
    const creatorSlug = creator.username || '';
    const creatorVariant = creator.variant || 'penpal';
    const creatorAvatar = creator.avatar_url || null;

    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const { toastMessage, setToastMessage } = useToast();
    const [promptCollapsed, setPromptCollapsed] = useState(false);

    const userHasNote = currentUser?.id ? notes.some(n => n.author_id === currentUser.id) : false;

    // "Add your thought" idle nudge — jiggles after 5.5s of inactivity when user hasn't posted
    const { nudge: idleNudge, rearm: rearmIdleNudge } = useNudgeTimer({
        enabled: notes.length > 0 && !userHasNote,
        delay: 5500,
        resetOnActivity: true,
    });

    const [domeNudge, setDomeNudge] = useState(false);
    const domeNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up dome nudge timer on unmount
    useEffect(() => {
        return () => {
            if (domeNudgeTimer.current) clearTimeout(domeNudgeTimer.current);
        };
    }, []);

    // "Create your dome" nudge — animate every 20s on dome view for non-creators
    const { nudge: createDomeNudge, rearm: rearmCreateDomeNudge } = useNudgeTimer({
        enabled: overlay.type === 'none' && !isCreator,
        delay: 20000,
    });


    // Auto-restore state after auth redirect
    useEffect(() => {
        if (!isSignedIn()) return;
        const pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY);
        if (pendingAction === PENDING_ACTION_CREATE_DOME) {
            sessionStorage.removeItem(PENDING_ACTION_KEY);
            setOverlay({ type: PENDING_ACTION_CREATE_DOME });
        } else if (sessionStorage.getItem(PENDING_NOTE_KEY)) {
            setOverlay({ type: 'composer' });
        }
    }, []);

    const handleAuthSuccess = useCallback(() => {
        sessionStorage.removeItem(PENDING_ACTION_KEY);
        if (overlay.type === 'auth' && overlay.pendingAction === 'createDome') {
            setOverlay({ type: 'createDome' });
        } else {
            setOverlay({ type: 'none' });
        }
    }, [overlay]);

    const handleTileClick = useCallback((note: CommunityNote) => setOverlay({ type: 'thread', note }), []);

    const handleReply = useCallback((note: CommunityNote) => {
        setOverlay({ type: 'composer', replyTo: note });
    }, []);

    const handleShare = useCallback((note: CommunityNote) => {
        setOverlay({ type: 'share', note });
    }, []);

    const handleAddNote = useCallback(async (draft: NoteDraft, replyTo?: CommunityNote): Promise<boolean> => {
        if (!community) return false;
        if (submittingRef.current) return false;

        submittingRef.current = true;
        try {
            const result = await createCommunityNote({
                community_uuid: community.uuid,
                prompt_uuid: prompt?.uuid,
                author_name: !draft.is_anonymous ? draft.author_name : undefined,
                content: draft.content,
                emoji: draft.emoji,
                shape: draft.shape,
                color: draft.color,
                is_anonymous: draft.is_anonymous,
                parent_uuid: replyTo?.uuid,
            });

            if (result.body) {
                const newNote = {
                    ...result.body,
                    parent_uuid: replyTo?.uuid || null,
                };
                setNotes(prev => [...prev, newNote]);
                if (replyTo) {
                    setOverlay({ type: 'thread', note: newNote });
                    setPendingHighlightOnClose(newNote.uuid);
                } else {
                    setOverlay({ type: 'none' });
                    setHighlightedNoteId(newNote.uuid);
                }
                // Post-contribution dome nudge — first 1 per session for non-creators
                if (!isCreator) {
                    const key = 'dome_post_nudge_count';
                    const count = parseInt(sessionStorage.getItem(key) || '0', 10);
                    if (count < 1) {
                        sessionStorage.setItem(key, String(count + 1));
                        setDomeNudge(true);
                        if (domeNudgeTimer.current) clearTimeout(domeNudgeTimer.current);
                        domeNudgeTimer.current = setTimeout(() => setDomeNudge(false), 6000);
                    }
                }
                return true;
            } else {
                setToastMessage('Failed to add your note. Please try again.');
                return false;
            }
        } catch {
            setToastMessage('Failed to add your note. Please try again.');
            return false;
        } finally {
            submittingRef.current = false;
        }
    }, [community, prompt, isCreator, setToastMessage]);

    const handleSelectPrompt = useCallback(async (selectedPrompt: CommunityPrompt) => {
        if (selectedPrompt.uuid === prompt?.uuid) return;
        setPrompt(selectedPrompt);
        setNotes([]);
        setLoadingNotes(true);
        updatePromptSlug(selectedPrompt.share_slug);
        try {
            const { notes: paginatedNotes, totalCount: count } = await loadNotes(selectedPrompt.uuid);
            setTotalCount(count);
            if (currentUser) {
                const userRes = await getCommunityNotesByUser(selectedPrompt.uuid);
                setNotes(mergeNotes(paginatedNotes, userRes.body || []));
            } else {
                setNotes(paginatedNotes);
            }
        } catch {
            // Failed to fetch notes for this prompt
        } finally {
            setLoadingNotes(false);
        }
    }, [prompt, currentUser, updatePromptSlug]);

    // When user logs in, fetch their notes and merge with existing paginated notes
    useEffect(() => {
        if (!currentUser || !promptRef.current) return;
        let cancelled = false;
        getCommunityNotesByUser(promptRef.current.uuid).then(res => {
            if (cancelled || !res.body?.length) return;
            setNotes(prev => mergeNotes(prev, res.body!));
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [currentUser]);

    // Derive effective filter — reset to 'all' if logged out while on 'your-notes'
    const effectiveFilter = (!currentUser && activeFilter === 'your-notes') ? 'all' : activeFilter;

    const filteredNotes = useMemo(() => {
        switch (effectiveFilter) {
            case 'creator-notes':
                return notes.filter(n => n.author_id === creator.user_id);
            case 'your-notes':
                return notes.filter(n => n.author_id === currentUser?.id);
            default:
                return notes;
        }
    }, [notes, effectiveFilter, currentUser, creator]);

    const userMenuData = useMemo(() =>
        currentUser ? {
            name: currentUser.name || currentUser.email?.split('@')[0] || null,
            photo: currentUser.avatar_url || null,
        } : null,
        [currentUser]);

    // Deep-link: auto-open a specific note on mount
    const initialNoteHandled = useRef(false);
    useEffect(() => {
        if (!initialNoteId || initialNoteHandled.current || notes.length === 0) return;
        const targetNote = notes.find(n => n.uuid === initialNoteId || n.share_slug === initialNoteId);
        if (targetNote) {
            initialNoteHandled.current = true;
            setOverlay({ type: 'thread', note: targetNote });
            setHighlightedNoteId(targetNote.uuid);
        }
    }, [initialNoteId, notes]);

    const isDomeDisabled = overlay.type === 'thread' || overlay.type === 'composer' || overlay.type === 'share';
    const promptText = prompt?.content || 'Share your thoughts with the community';

    const handleCloseThread = useCallback(() => {
        setOverlay({ type: 'none' });
        if (pendingHighlightOnClose) {
            setHighlightedNoteId(pendingHighlightOnClose);
            setPendingHighlightOnClose(null);
        }
        if (prompt?.share_slug) {
            updatePromptSlug(prompt.share_slug, true);
        }
    }, [pendingHighlightOnClose, prompt?.share_slug, updatePromptSlug]);

    const handleCloseOverlay = useCallback(() => {
        setOverlay({ type: 'none' });
        if (prompt?.share_slug) {
            updatePromptSlug(prompt.share_slug, true);
        }
    }, [prompt?.share_slug, updatePromptSlug]);

    /** Centralized dome-creation flow: mobile → explainer, desktop → createDome/auth */
    const handleStartDomeCreation = useCallback(() => {
        if (isMobile) {
            setOverlay({ type: 'domeExplainer' });
        } else if (currentUser) {
            setOverlay({ type: PENDING_ACTION_CREATE_DOME });
        } else {
            sessionStorage.setItem(PENDING_ACTION_KEY, PENDING_ACTION_CREATE_DOME);
            setOverlay({ type: 'auth', pendingAction: 'createDome' });
        }
    }, [isMobile, currentUser]);

    const handleMobileFilterChange = useCallback((filter: FilterType) => {
        setActiveFilter(filter);
        setOverlay({ type: 'none' });
    }, []);

    const handleMobileSelectPrompt = useCallback((p: CommunityPrompt) => {
        handleSelectPrompt(p);
        setOverlay({ type: 'none' });
    }, [handleSelectPrompt]);

    const [allPrompts, setAllPrompts] = useState<CommunityPrompt[]>(prompts);

    const handleCreatePrompt = useCallback(async (content: string): Promise<boolean> => {
        if (!community || submittingRef.current) return false;
        submittingRef.current = true;
        try {
            const result = await createCommunityPrompt({ community_uuid: community.uuid, content });
            if (result.body) {
                const newPrompt = result.body;
                setAllPrompts(prev => [newPrompt, ...prev]);
                setPrompt(newPrompt);
                setNotes([]);
                setOverlay({ type: 'none' });
                updatePromptSlug(newPrompt.share_slug);
                setToastMessage('New prompt created!');
                return true;
            } else {
                setToastMessage('Failed to create prompt. Please try again.');
                return false;
            }
        } catch {
            setToastMessage('Failed to create prompt. Please try again.');
            return false;
        } finally {
            submittingRef.current = false;
        }
    }, [community, updatePromptSlug]);

    return {
        currentUser, signOut,
        isMobile, f,
        notes, totalCount, filteredNotes, highlightedNoteId, setHighlightedNoteId,
        overlay, setOverlay,
        prompt, allPrompts, promptText, loadingNotes,
        promptCollapsed, setPromptCollapsed,
        creatorName, creatorSlug, creatorVariant, creatorAvatar,
        activeFilter: effectiveFilter, setActiveFilter,
        toastMessage, setToastMessage,
        idleNudge, rearmIdleNudge,
        domeNudge, setDomeNudge,
        createDomeNudge, rearmCreateDomeNudge,
        isDomeDisabled, userMenuData, isCreator,
        handleTileClick, handleReply, handleShare, handleAddNote,
        handleSelectPrompt, handleAuthSuccess, handleCreatePrompt,
        handleCloseThread, handleCloseOverlay, handleStartDomeCreation,
        handleMobileFilterChange, handleMobileSelectPrompt,
    };
}

export type CommunityState = ReturnType<typeof useCommunityState>;

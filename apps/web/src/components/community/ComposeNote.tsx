'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAccessToken, isSignedIn } from '@/lib/utils/token-service';
import { PENDING_NOTE_KEY } from '@/lib/firebase/auth';
import { useFontScale } from './useFontScale';
import AuthModal from './AuthModal';
import type { NoteDraft } from './shared';
import { COLORS, EMOJIS, getColor, getDesign, randomColorId, randomDesignId, FONT_SANS, FONT_SERIF } from './shared';
import ModalOverlay from './ModalOverlay';
import { NoteCard, nextDesignId } from './cards';
import type { CommunityNote } from '@/lib/api';
import CloseButton from './CloseButton';
import ScrollArea from './ScrollArea';
import { Filter } from 'bad-words';
import { getCreatorVariantPage } from '@/lib/utils/page-helper';

const profanityFilter = new Filter();

interface ComposeNoteProps {
    onAdd: (draft: NoteDraft, replyTo?: CommunityNote) => Promise<boolean>;
    onClose: () => void;
    replyToNote?: CommunityNote;
    creatorName?: string;
    creatorUsername?: string;
    creatorVariant?: string;
    promptText?: string;
}

export default function ComposeNote({
    onAdd, onClose, replyToNote, creatorName, creatorUsername, creatorVariant = 'penpal', promptText = 'Share your thoughts...',
}: ComposeNoteProps) {
    const [text, setText] = useState('');
    const [emoji, setEmoji] = useState(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    const [colorId, setColorId] = useState(() => randomColorId(replyToNote?.color));
    const [designId, setDesignId] = useState(randomDesignId);
    // Emoji picker: closed | grid | custom input
    type EmojiPickerState = 'closed' | 'grid' | 'custom';
    const [emojiPicker, setEmojiPicker] = useState<EmojiPickerState>('closed');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [alias, setAlias] = useState('');
    const [dismissedPrivatePrompt, setDismissedPrivatePrompt] = useState(false);
    // Auth flow: idle = no modal, pending = modal open + submit on success
    type AuthFlow = 'idle' | 'pending';
    const [authFlow, setAuthFlow] = useState<AuthFlow>('idle');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [missingField, setMissingField] = useState<'text' | 'author' | 'profanity' | null>(null);
    const [customEmojiValue, setCustomEmojiValue] = useState('');

    const { isMobile, f } = useFontScale();
    const textRef = useRef<HTMLTextAreaElement>(null);
    const authorRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const emojiGridRef = useRef<HTMLDivElement>(null);
    const color = getColor(colorId);
    const design = getDesign(designId);
    const previewText = text || 'Your words here...';
    const showPrivatePrompt = text.length >= 50 && !dismissedPrivatePrompt;
    const hasText = text.trim().length > 0;


    const submitDraft = useCallback(async (draft: NoteDraft) => {
        setIsSubmitting(true);
        try {
            await onAdd(draft, replyToNote);
        } finally {
            setIsSubmitting(false);
        }
    }, [onAdd, replyToNote]);

    // Restore pending draft from sessionStorage (after auth redirect) and auto-submit
    const didRestoreRef = useRef(false);
    useEffect(() => {
        if (didRestoreRef.current) return;
        try {
            const saved = sessionStorage.getItem(PENDING_NOTE_KEY);
            if (saved && isSignedIn()) {
                sessionStorage.removeItem(PENDING_NOTE_KEY);
                const parsed = JSON.parse(saved);
                const FIVE_MINUTES = 5 * 60 * 1000;
                if (parsed._ts && Date.now() - parsed._ts > FIVE_MINUTES) return;
                didRestoreRef.current = true;
                const { _ts, ...draftFields } = parsed;
                const draft: NoteDraft = draftFields;
                setText(draft.content);
                setEmoji(draft.emoji);
                setColorId(draft.color);
                setDesignId(draft.shape);
                setIsAnonymous(draft.is_anonymous);
                setAlias(draft.author_name);
                submitDraft(draft);
            }
        } catch { /* ignore */ }
    }, [submitDraft]);

    // Scroll emoji grid into view when it opens
    useEffect(() => {
        if (emojiPicker !== 'closed' && emojiGridRef.current) {
            setTimeout(() => {
                emojiGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }, [emojiPicker]);

    const cycleDesign = () => {
        setDesignId(nextDesignId(designId));
        setEmojiPicker('closed');
    };

    const previewNote = {
        content: previewText,
        emoji,
        is_anonymous: isAnonymous,
        author_name: isAnonymous ? undefined : (alias.trim() || 'Your name'),
        color: colorId,
        shape: designId,
    };

    const submitNote = useCallback(() => {
        const draft: NoteDraft = {
            content: text.trim(),
            emoji,
            is_anonymous: isAnonymous,
            author_name: alias.trim() || '',
            color: colorId,
            shape: designId,
        };
        submitDraft(draft);
    }, [text, emoji, isAnonymous, alias, colorId, designId, submitDraft]);

    const showMissing = (field: 'text' | 'author' | 'profanity') => {
        setMissingField(field);
        setTimeout(() => setMissingField(null), 2500);
    };

    const handleSubmit = () => {
        if (isSubmitting) return;
        const token = getAccessToken();
        if (!text.trim()) {
            showMissing('text');
            textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            textRef.current?.focus();
            return;
        }
        if (!isAnonymous && !alias.trim()) {
            showMissing('author');
            authorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            authorRef.current?.focus();
            return;
        }
        if (profanityFilter.isProfane(text)) {
            showMissing('profanity');
            textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            textRef.current?.focus();
            return;
        }
        if (!token) {
            // Save draft so it survives the auth redirect
            const draft: NoteDraft = {
                content: text.trim(), emoji, color: colorId, shape: designId,
                is_anonymous: isAnonymous, author_name: alias.trim() || '',
            };
            sessionStorage.setItem(PENDING_NOTE_KEY, JSON.stringify({ ...draft, _ts: Date.now() }));
            setAuthFlow('pending');
            return;
        }
        submitNote();
    };

    const handleAuthSuccess = useCallback(() => {
        setAuthFlow('idle');
        sessionStorage.removeItem(PENDING_NOTE_KEY);
        submitNote();
    }, [submitNote]);

    return (
        <ModalOverlay
            onClose={onClose}
            zIndex={200}
            maxWidth={isMobile ? 10000 : 480}
            padding={isMobile ? 0 : 16}
            borderRadius={isMobile ? 0 : 28}
            backdropStyle={{ overflow: 'hidden', boxSizing: 'border-box' }}
            cardStyle={{
                display: 'flex', flexDirection: 'column',
                flex: 1, maxHeight: '100%',
                margin: '0 auto',
            }}
        >
            {/* Header — prompt echo as emotional anchor */}
            <div style={{ padding: '20px 18px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <span className="text-truncate" style={{
                        color: 'rgba(255,255,255,0.85)', fontSize: f.subtitle, fontFamily: FONT_SERIF,
                        fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2,
                        flex: 1, minWidth: 0,
                    }}>
                        {replyToNote ? `Reply to ${replyToNote.is_anonymous ? 'Anonymous' : (replyToNote.author_name || 'Anonymous')}` : promptText}
                    </span>
                    <CloseButton onClick={onClose} />
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginTop: 16 }} />
            </div>

            {/* Reply preview */}
            {replyToNote && (
                <div style={{
                    margin: '16px 24px 16px', padding: '14px 16px',
                    background: getColor(replyToNote.color).bg,
                    borderRadius: 16, display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                    <span style={{ fontSize: f.bodyLg }}>{replyToNote.emoji || '🌙'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: f.small, fontWeight: 600, color: getColor(replyToNote.color).text, opacity: 0.6, marginBottom: 4 }}>
                            Replying to {replyToNote.is_anonymous ? 'Anonymous' : (replyToNote.author_name || 'Anonymous')}
                        </div>
                        <p style={{
                            fontSize: f.body, lineHeight: 1.4, color: getColor(replyToNote.color).text,
                            margin: 0, fontFamily: FONT_SERIF, overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>{replyToNote.content}</p>
                    </div>
                </div>
            )}

            {/* Scrollable content — words first, decoration second */}
            <ScrollArea style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
                {/* 1. Text area (HERO) */}
                <div style={{ paddingTop: 16, marginBottom: 16 }}>
                    <textarea
                        ref={textRef}
                        value={text} onChange={e => setText(e.target.value)}
                        placeholder="What would you say..."
                        autoFocus
                        style={{
                            width: '100%', minHeight: isMobile ? 150 : 250, padding: 0, border: 'none',
                            background: 'transparent', color: 'rgba(255,255,255,0.85)',
                            fontSize: f.bodyLg, lineHeight: 1.6, resize: 'none', outline: 'none',
                            fontFamily: FONT_SERIF, fontStyle: 'italic', boxSizing: 'border-box',
                        }}
                    />
                    {missingField === 'text' && (
                        <span style={{ color: '#f87171', fontSize: f.caption, marginTop: 8, display: 'block' }}>Write something to share</span>
                    )}
                    {missingField === 'profanity' && (
                        <span style={{ color: '#f87171', fontSize: f.caption, marginTop: 8, display: 'block' }}>Please remove inappropriate language</span>
                    )}
                </div>

                {/* 2. Subtle private nudge — non-blocking, one line, opens penpal in new tab */}
                {showPrivatePrompt && creatorUsername && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', marginBottom: 8,
                        background: 'rgba(139,92,246,0.12)', borderRadius: 12,
                    }}>
                        <a
                            href={`${getCreatorVariantPage(creatorUsername || '', creatorVariant)}?message=${encodeURIComponent(text.trim())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'rgba(255,255,255,0.55)', fontSize: f.caption,
                                cursor: 'pointer', lineHeight: 1.4,
                                textDecoration: 'none',
                            }}
                        >
                            💌 You could also send this to {creatorName || 'them'} directly
                        </a>
                        <button
                            onClick={() => setDismissedPrivatePrompt(true)}
                            aria-label="Dismiss"
                            style={{
                                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                                fontSize: 16, cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1,
                                flexShrink: 0,
                            }}
                        >×</button>
                    </div>
                )}

                {/* 3. Name field + Anonymous toggle */}
                <div style={{ marginBottom: 24 }}>
                    {!isAnonymous && (
                        <div style={{ marginBottom: 16 }}>
                            <input
                                ref={authorRef}
                                type="text" value={alias} onChange={e => setAlias(e.target.value)}
                                placeholder="What should we call you?"
                                style={{
                                    width: '100%', padding: '16px 18px', borderRadius: 16, border: 'none',
                                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
                                    fontSize: f.body, outline: 'none', fontFamily: FONT_SERIF, fontStyle: 'italic',
                                    boxSizing: 'border-box',
                                }}
                            />
                            {missingField === 'author' && (
                                <span style={{ color: '#f87171', fontSize: f.caption, marginTop: 8, display: 'block' }}>Add a name or post anonymously</span>
                            )}
                        </div>
                    )}

                    {/* Anonymous toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setIsAnonymous(!isAnonymous)} style={{
                            width: 52, height: 30, borderRadius: 15, border: 'none',
                            background: isAnonymous ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.15)',
                            cursor: 'pointer', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
                        }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: '50%', background: 'white',
                                position: 'absolute', top: 3, left: isAnonymous ? 25 : 3,
                                transition: 'left 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }} />
                        </button>
                        <div>
                            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: f.body }}>Post anonymously</span>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: f.caption, marginTop: 2 }}>Your words, not your name</div>
                        </div>
                    </div>
                </div>

                {/* Divider between writing section and preview */}
                {hasText && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 24 }} />
                )}

                {/* 4. Capsule preview + customization (appears after typing) */}
                {hasText && (
                    <div ref={previewRef} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 24, marginBottom: 24,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: f.caption, fontWeight: 600, letterSpacing: '0.02em' }}>How it'll look</span>
                        <div style={{ width: 200, height: 220, cursor: 'pointer' }} onClick={cycleDesign}>
                            <NoteCard note={previewNote} size="md" />
                        </div>

                        {/* Shape + Color picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                            <button onClick={cycleDesign} style={{ padding: '8px 12px', borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: f.caption, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                {design.name} <span style={{ fontSize: 9, opacity: 0.5 }}>▲▼</span>
                            </button>

                            <button onClick={() => setEmojiPicker(emojiPicker === 'closed' ? 'grid' : 'closed')} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {emoji}
                            </button>

                            {COLORS.map(c => (
                                <button key={c.id} onClick={() => setColorId(c.id)} style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    border: colorId === c.id ? '3px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                                    background: c.bg, cursor: 'pointer',
                                    transform: colorId === c.id ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'transform 0.15s ease',
                                }} />
                            ))}
                        </div>

                        {emojiPicker !== 'closed' && (
                            <div ref={emojiGridRef} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }}>
                                {EMOJIS.map(e => (
                                    <button key={e} onClick={() => { setEmoji(e); setEmojiPicker('closed'); }} style={{
                                        width: 44, height: 44, borderRadius: '50%', border: 'none',
                                        background: emoji === e ? 'rgba(255,255,255,0.15)' : 'transparent',
                                        fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>{e}</button>
                                ))}
                                {emojiPicker !== 'custom' ? (
                                    <button onClick={() => { setEmojiPicker('custom'); setCustomEmojiValue(''); }} style={{
                                        width: 44, height: 44, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.2)',
                                        background: 'transparent', fontSize: 20, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'rgba(255,255,255,0.4)',
                                    }}>+</button>
                                ) : (
                                    <input
                                        autoFocus
                                        value={customEmojiValue}
                                        onChange={e => {
                                            const val = e.target.value;
                                            // Extract only emoji characters
                                            const emojis = [...val].filter(ch => /\p{Extended_Pictographic}/u.test(ch));
                                            if (emojis.length > 0) {
                                                const picked = emojis[emojis.length - 1];
                                                setEmoji(picked);
                                                setEmojiPicker('closed');
                                            }
                                        }}
                                        onBlur={() => setEmojiPicker('grid')}
                                        placeholder="😀"
                                        style={{
                                            width: 44, height: 44, borderRadius: '50%',
                                            border: '2px solid rgba(139,92,246,0.6)',
                                            background: 'rgba(255,255,255,0.08)', fontSize: 20,
                                            textAlign: 'center', outline: 'none', padding: 0,
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Submit button */}
            <div style={{ padding: '16px 24px 24px', background: 'linear-gradient(to top, #1a1a1f 60%, transparent 100%)', flexShrink: 0 }}>
                <button onClick={handleSubmit} disabled={isSubmitting} style={{
                    width: '100%', padding: '18px 24px', borderRadius: 20, border: 'none',
                    background: isSubmitting ? 'rgba(255,255,255,0.08)' : 'white',
                    color: isSubmitting ? 'rgba(255,255,255,0.25)' : '#1a1a1f',
                    fontSize: f.body, fontWeight: 600,
                    cursor: isSubmitting ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                }}>
                    {isSubmitting ? 'Adding...' : 'Add to the dome'}
                </button>
            </div>

            {/* Auth Modal (sign in to post) */}
            {authFlow === 'pending' && (
                <AuthModal
                    onSuccess={handleAuthSuccess}
                    onClose={() => setAuthFlow('idle')}
                    pendingNote={{
                        content: text.trim(), emoji, color: colorId, shape: designId,
                        is_anonymous: isAnonymous,
                        author_name: alias.trim() || '',
                    }}
                    creatorName={creatorName}
                />
            )}
        </ModalOverlay>
    );
}
"use client";

import React, { useRef, useState, useCallback } from 'react';
import type { CommunityNote, CommunityPrompt } from '@/lib/api';
import { NoteCard } from './cards';
import { FONT_SANS, FONT_SERIF } from './shared';
import { useFontScale } from './useFontScale';
import ModalOverlay from './ModalOverlay';
import {
    buildNoteShareUrl,
    buildShareText,
    captureShareImage,
    dataUrlToBlob,
    downloadImage,
    nativeShare,
    openTwitterShare,
} from './shareUtils';

// ─── Constants ───────────────────────────────────────────
const CAPTURE_SIZE = 1080;
const CARD_DISPLAY_SIZE = 320;
const CARD_RENDER_SIZE = 400;

interface ShareNoteModalProps {
    note: CommunityNote;
    prompt: CommunityPrompt | null;
    creatorName: string;
    creatorSlug: string;
    creatorAvatar: string | null;
    onClose: () => void;
    onToast?: (message: string) => void;
}

export default function ShareNoteModal({
    note,
    prompt,
    creatorName,
    creatorSlug,
    creatorAvatar,
    onClose,
    onToast,
}: ShareNoteModalProps) {
    const captureRef = useRef<HTMLDivElement>(null);
    const busyRef = useRef(false);
    const [capturing, setCapturing] = useState(false);
    const { isMobile, f } = useFontScale();

    const shareUrl = buildNoteShareUrl(creatorSlug, prompt?.share_slug || '', note.share_slug);
    const shareText = buildShareText(note.content, creatorName);

    const handleCapture = useCallback(async (): Promise<string | null> => {
        if (!captureRef.current || busyRef.current) return null;
        busyRef.current = true;
        setCapturing(true);
        try {
            return await captureShareImage(captureRef.current);
        } catch {
            onToast?.('Failed to generate image');
            return null;
        } finally {
            busyRef.current = false;
            setCapturing(false);
        }
    }, [onToast]);

    const handleCopyLink = useCallback(async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            onToast?.('Link copied!');
        } catch {
            onToast?.('Failed to copy link');
        }
    }, [shareUrl, onToast]);

    const handleDownload = useCallback(async () => {
        if (busyRef.current) return;
        const dataUrl = await handleCapture();
        if (dataUrl) {
            downloadImage(dataUrl);
        } else {
            onToast?.('Failed to download image. Please try again.');
        }
    }, [handleCapture, onToast]);

    const handleTwitter = useCallback(() => {
        openTwitterShare(shareText, shareUrl);
    }, [shareText, shareUrl]);

    const handleNativeShare = useCallback(async () => {
        if (busyRef.current) return;
        const dataUrl = await handleCapture();
        if (!dataUrl) return;
        const blob = await dataUrlToBlob(dataUrl);
        const shared = await nativeShare(blob, shareUrl, shareText);
        if (!shared) {
            // Fallback: copy link if native share not available
            handleCopyLink();
        }
    }, [handleCapture, shareUrl, shareText, handleCopyLink]);

    const displaySize = isMobile ? CARD_DISPLAY_SIZE : CARD_RENDER_SIZE;
    const scale = displaySize / CAPTURE_SIZE;

    return (
        <ModalOverlay
            onClose={onClose}
            zIndex={1100}
            maxWidth={480}
            animation="popup"
            cardStyle={{ background: 'transparent', boxShadow: 'none' }}
            backdropStyle={{ background: 'rgba(0,0,0,0.9)' }}
        >
            <div style={{ padding: isMobile ? '20px 16px' : '28px 24px', fontFamily: FONT_SANS }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: f.title,
                        fontWeight: 600,
                        color: 'white',
                    }}>
                        Share Note
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.6)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Card preview — scaled-down view of the capture element */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: 28,
                }}>
                    <div style={{
                        width: displaySize,
                        height: displaySize,
                        overflow: 'hidden',
                        borderRadius: 16,
                        position: 'relative',
                    }}>
                        <div
                            style={{
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                width: CAPTURE_SIZE,
                                height: CAPTURE_SIZE,
                            }}
                        >
                            {/* ─── Capture target ─── */}
                            <div
                                ref={captureRef}
                                style={{
                                    width: CAPTURE_SIZE,
                                    height: CAPTURE_SIZE,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 60,
                                    boxSizing: 'border-box',
                                }}
                            >
                                {/* Prompt question */}
                                {prompt && (
                                    <p style={{
                                        fontFamily: FONT_SERIF,
                                        fontStyle: 'italic',
                                        fontSize: 36,
                                        lineHeight: 1.3,
                                        color: 'rgba(255,255,255,0.7)',
                                        textAlign: 'center',
                                        margin: '0 0 24px',
                                        maxWidth: 800,
                                    }}>
                                        &ldquo;{prompt.content}&rdquo;
                                    </p>
                                )}

                                {/* Note card — render at 380px and scale 2x for crisp text */}
                                <div style={{ width: 760, height: 800, paddingTop: 40 }}>
                                    <div style={{ width: 380, height: 380, transform: 'scale(2)', transformOrigin: 'top left' }}>
                                        <NoteCard note={note} size="lg" />
                                    </div>
                                </div>

                                {/* Attribution footer */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 16,
                                    marginTop: 24,
                                }}>
                                    {creatorAvatar && (
                                        /* eslint-disable-next-line @next/next/no-img-element -- Intentional: inside html-to-image capture target, next/image breaks capture */
                                        <img
                                            src={creatorAvatar}
                                            alt=""
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    )}
                                    <span style={{
                                        fontFamily: FONT_SANS,
                                        fontSize: 28,
                                        color: 'rgba(255,255,255,0.5)',
                                        fontWeight: 500,
                                    }}>
                                        {creatorName}&rsquo;s Community
                                    </span>
                                    <span style={{
                                        fontFamily: FONT_SANS,
                                        fontSize: 24,
                                        color: 'rgba(255,255,255,0.3)',
                                    }}>
                                        &middot;
                                    </span>
                                    <span style={{
                                        fontFamily: FONT_SANS,
                                        fontSize: 24,
                                        color: 'rgba(255,255,255,0.3)',
                                        fontWeight: 400,
                                    }}>
                                        hotly.com
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Share actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: isMobile ? 16 : 20,
                }}>
                    <ShareAction
                        label="Copy link"
                        icon={<LinkIcon />}
                        onClick={handleCopyLink}
                        disabled={!shareUrl}
                        fontSize={f.caption}
                    />
                    {!isMobile && (
                        <ShareAction
                            label="Download"
                            icon={<DownloadIcon />}
                            onClick={handleDownload}
                            disabled={capturing}
                            fontSize={f.caption}
                        />
                    )}
                    <ShareAction
                        label="Twitter / X"
                        icon={<TwitterIcon />}
                        onClick={handleTwitter}
                        disabled={!shareUrl}
                        fontSize={f.caption}
                    />
                    <ShareAction
                        label="Share"
                        icon={<ShareIcon />}
                        onClick={handleNativeShare}
                        disabled={capturing}
                        fontSize={f.caption}
                    />
                </div>
            </div>
        </ModalOverlay>
    );
}

// ─── Share action button ──────────────────────────────────
function ShareAction({ label, icon, onClick, disabled, fontSize }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    fontSize: number;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: 'all 0.2s',
                padding: '8px 4px',
            }}
        >
            <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
            }}>
                {icon}
            </div>
            <span style={{
                fontSize,
                color: 'rgba(255,255,255,0.6)',
                fontFamily: FONT_SANS,
                whiteSpace: 'nowrap',
            }}>
                {label}
            </span>
        </button>
    );
}

// ─── Inline SVG icons ─────────────────────────────────────
function LinkIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

function TwitterIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

function ShareIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
    );
}

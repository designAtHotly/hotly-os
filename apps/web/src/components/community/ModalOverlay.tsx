'use client';

import React, { useEffect } from 'react';
import { MODAL_BG, MODAL_CARD_SHADOW } from './shared';

type ModalAnimation = 'fade' | 'popup';

const ANIMATIONS: Record<ModalAnimation, string> = {
    fade: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    popup: 'popUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
};

interface ModalOverlayProps {
    children: React.ReactNode;
    onClose: () => void;
    zIndex?: number;
    maxWidth?: number;
    padding?: number;
    borderRadius?: number;
    animation?: ModalAnimation;
    backdropStyle?: React.CSSProperties;
    cardStyle?: React.CSSProperties;
    labelledBy?: string;
}

export default function ModalOverlay({
    children,
    onClose,
    zIndex = 100,
    maxWidth = 480,
    padding = 24,
    borderRadius = 28,
    animation = 'fade',
    backdropStyle,
    cardStyle,
    labelledBy,
}: ModalOverlayProps) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch' as never,
                zIndex,
                padding,
                ...backdropStyle,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                style={{
                    width: '100%',
                    maxWidth,
                    background: MODAL_BG,
                    borderRadius,
                    boxShadow: MODAL_CARD_SHADOW,
                    overflow: 'hidden',
                    flexShrink: 0,
                    margin: 'auto 0',
                    animation: ANIMATIONS[animation],
                    ...cardStyle,
                }}
            >
                {children}
            </div>
        </div>
    );
}

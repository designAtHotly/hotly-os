'use client';

import React, { useEffect } from 'react';
import { SHEET_BACKDROP, SHEET_CARD, DRAG_HANDLE } from './shared';
import CloseButton from './CloseButton';

interface BottomSheetProps {
    children: React.ReactNode;
    onClose: () => void;
    zIndex?: number;
    maxWidth?: number;
}

export default function BottomSheet({
    children,
    onClose,
    zIndex = 200,
    maxWidth = 420,
}: BottomSheetProps) {
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
            onClick={onClose}
            style={{ ...SHEET_BACKDROP, zIndex }}
        >
            <div
                role="dialog"
                aria-modal="true"
                onClick={e => e.stopPropagation()}
                style={{ ...SHEET_CARD, maxWidth }}
            >
                <div style={{ position: 'relative', marginBottom: 18 }}>
                    <div style={DRAG_HANDLE} />
                    <CloseButton onClick={onClose} size={28} style={{ position: 'absolute', top: -8, right: 0 }} />
                </div>
                {children}
            </div>
        </div>
    );
}

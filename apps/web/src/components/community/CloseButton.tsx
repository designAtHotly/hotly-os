'use client';

import React from 'react';
import { useFontScale } from './useFontScale';

interface CloseButtonProps {
    onClick: () => void;
    size?: number;
    style?: React.CSSProperties;
}

/** Reusable close button — rounded square with subtle glass background */
export default function CloseButton({ onClick, size = 32, style }: CloseButtonProps) {
    const { f } = useFontScale();

    return (
        <button
            onClick={onClick}
            aria-label="Close"
            className="hover-text-bright"
            style={{
                width: size,
                height: size,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.4)',
                fontSize: f.body,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                ...style,
            }}
        >
            &#x2715;
        </button>
    );
}

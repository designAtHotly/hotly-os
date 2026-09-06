import React, { useState, useCallback } from 'react';
import { FONT_SANS, C_AMBER_90, C_AMBER_20, C_AMBER_10, C_SUCCESS, C_SUCCESS_15, C_SUCCESS_30 } from './shared';

interface CopyButtonProps {
    text: string;
    fontSize: number;
    label?: string;
    copiedLabel?: string;
    style?: React.CSSProperties;
}

export default function CopyButton({
    text,
    fontSize,
    label = 'Copy',
    copiedLabel = 'Copied',
    style,
}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            style={{
                padding: '7px 16px', fontSize, fontWeight: 600,
                fontFamily: FONT_SANS,
                color: copied ? C_SUCCESS : C_AMBER_90,
                background: copied ? C_SUCCESS_15 : C_AMBER_10,
                border: `1px solid ${copied ? C_SUCCESS_30 : C_AMBER_20}`,
                borderRadius: 50, cursor: 'pointer',
                transition: 'all 0.2s ease', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 5,
                ...style,
            }}
            className={copied ? undefined : 'hover-glass'}
        >
            {copied ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{copiedLabel}</>
            ) : label}
        </button>
    );
}

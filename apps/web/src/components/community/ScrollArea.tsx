'use client';

import React from 'react';

interface ScrollAreaProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export const SCROLL_CLASS = 'hotly-scroll';
const CLS = SCROLL_CLASS;

export default function ScrollArea({ children, style, className }: ScrollAreaProps) {
    return (
        <>
            <div
                className={`${CLS}${className ? ` ${className}` : ''}`}
                style={style}
            >
                {children}
            </div>
            <style>{`
                .${CLS} {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.15) transparent;
                }
                .${CLS}::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .${CLS}::-webkit-scrollbar-track {
                    background: transparent;
                }
                .${CLS}::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.12);
                    border-radius: 3px;
                }
                .${CLS}::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.25);
                }
            `}</style>
        </>
    );
}

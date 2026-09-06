'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/** Shared dropdown panel styles used by UserMenu and PromptWeekSelector */
export const DROPDOWN_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    background: 'rgba(30, 28, 36, 0.98)',
    backdropFilter: 'blur(20px)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
    overflow: 'hidden',
    animation: 'dropdownIn 0.15s ease-out',
    zIndex: 999,
};

/**
 * Hook for dropdown menus — handles open/close state, outside click, and Escape key.
 * Used by UserMenu and PromptWeekSelector.
 */
export function useDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const close = useCallback(() => setIsOpen(false), []);

    return { isOpen, ref, toggle, close };
}

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FONT_SANS, FONT_SERIF } from './shared';
import { useFontScale } from './useFontScale';
import CloseButton from './CloseButton';
import ModalOverlay from './ModalOverlay';
import { sanitizePrompt } from '@/lib/utils/sanitize-prompt';

interface CreatePromptProps {
    onSubmit: (content: string) => Promise<boolean>;
    onClose: () => void;
}

export default function CreatePrompt({ onSubmit, onClose }: CreatePromptProps) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { f } = useFontScale();

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSubmit = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        const success = await onSubmit(trimmed);
        if (!success) setSubmitting(false);
    }, [text, submitting, onSubmit]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <ModalOverlay onClose={onClose}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px 0',
            }}>
                <h2 style={{
                    margin: 0,
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: f.subtitle,
                    fontFamily: FONT_SERIF,
                    fontStyle: 'italic',
                    fontWeight: 400,
                }}>
                    New prompt
                </h2>
                <CloseButton onClick={onClose} />
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px 24px' }}>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(sanitizePrompt(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="What would you ask your community?"
                    maxLength={280}
                    rows={3}
                    style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 14,
                        padding: '14px 16px',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: f.body,
                        fontFamily: FONT_SERIF,
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                        resize: 'none',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />

                {/* Footer: char count + submit */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 16,
                }}>
                    <span style={{
                        color: text.length > 250 ? 'rgba(255,150,150,0.7)' : 'rgba(255,255,255,0.25)',
                        fontSize: f.small,
                        fontFamily: FONT_SANS,
                    }}>
                        {text.length}/280
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() || submitting}
                        style={{
                            padding: '10px 24px',
                            background: text.trim()
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(255,255,255,0.04)',
                            border: text.trim()
                                ? '1px solid rgba(255,255,255,0.2)'
                                : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 50,
                            color: text.trim()
                                ? 'rgba(255,255,255,0.9)'
                                : 'rgba(255,255,255,0.3)',
                            fontSize: f.body,
                            fontFamily: FONT_SANS,
                            fontWeight: 500,
                            cursor: text.trim() && !submitting ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            opacity: submitting ? 0.5 : 1,
                        }}
                        className={text.trim() && !submitting ? 'hover-glass' : ''}
                    >
                        {submitting ? 'Creating...' : 'Create prompt'}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}

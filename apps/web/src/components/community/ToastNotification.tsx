import React from 'react';
import { FONT_SANS, C_ERROR_BG } from './shared';

export default function ToastNotification({ message, fontSize, onDismiss }: {
    message: string;
    fontSize: number;
    onDismiss: () => void;
}) {
    return (
        <div style={{
            position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
            background: C_ERROR_BG, backdropFilter: 'blur(10px)',
            padding: '14px 24px', borderRadius: 12,
            color: 'white', fontSize, fontWeight: 500,
            fontFamily: FONT_SANS,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 500, display: 'flex', alignItems: 'center', gap: 10,
            animation: 'slideUp 0.3s ease',
        }}>
            <span>{message}</span>
            <button
                onClick={onDismiss}
                style={{
                    background: 'none', border: 'none', color: 'white',
                    cursor: 'pointer', padding: 4, opacity: 0.8,
                }}
            >
                ✕
            </button>
        </div>
    );
}

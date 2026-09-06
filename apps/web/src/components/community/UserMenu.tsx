"use client";

import React, { useCallback } from 'react';
import { useDropdown, DROPDOWN_STYLE } from './useDropdown';
import { displayName, FONT_SANS } from './shared';
import { useFontScale } from './useFontScale';
import UserAvatar from './UserAvatar';

interface UserMenuProps {
    user: { name: string | null; photo: string | null } | null;
    onLogout: () => void;
    onLogin?: () => void;
    isCreator?: boolean;
}

export default function UserMenu({ user, onLogout, onLogin, isCreator }: UserMenuProps) {
    const { isOpen, ref, toggle, close } = useDropdown();
    const { f } = useFontScale();

    const handleLogout = useCallback(() => {
        close();
        onLogout();
    }, [close, onLogout]);

    if (!user) {
        return onLogin ? (
            <button
                onClick={onLogin}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '50px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: f.body, fontFamily: FONT_SANS,
                    fontWeight: 500,
                }}
                className="hover-glass-dark"
            >
                Sign in
            </button>
        ) : null;
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Main pill button */}
            <button
                onClick={toggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 14px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '50px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                className="hover-glass-dark"
            >
                {/* Avatar */}
                <UserAvatar photo={user.photo} size={28} />

                {/* Label */}
                <span className="text-truncate" style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: f.body, fontFamily: FONT_SANS,
                    fontWeight: 500, maxWidth: 120,
                }}>
                    {displayName(user.name)}
                </span>

                {/* Chevron */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{ ...DROPDOWN_STYLE, right: 0, minWidth: 200 }}>
                    {/* User info */}
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <UserAvatar photo={user.photo} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="text-truncate" style={{ color: 'rgba(255,255,255,0.9)', fontSize: f.body, fontWeight: 600, fontFamily: FONT_SANS }}>
                                {displayName(user.name)}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: f.small, fontFamily: FONT_SANS, marginTop: 2 }}>
                                {isCreator ? 'Community creator' : 'Community member'}
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
                            color: 'rgba(255,255,255,0.6)', fontSize: f.caption, fontFamily: FONT_SANS,
                            fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'all 0.15s ease', textAlign: 'left',
                        }}
                        className="hover-danger"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Log out
                    </button>
                </div>
            )}
        </div>
    );
}

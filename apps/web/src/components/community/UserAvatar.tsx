'use client';

import React from 'react';

import { appMediaUrl } from '@/lib/media/url';

interface UserAvatarProps {
    photo: string | null;
    size?: number;
}

/** Shared user avatar with green fallback — used in UserMenu and MobileMenuDrawer */
export default function UserAvatar({ photo, size = 28 }: UserAvatarProps) {
    const src = appMediaUrl(photo);
    if (src) {
        return (
            <img src={src} alt="" style={{
                width: size, height: size, borderRadius: '50%', objectFit: 'cover',
            }} />
        );
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: 'rgba(134, 239, 172, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size > 30 ? 18 : 14,
        }}>
            👤
        </div>
    );
}

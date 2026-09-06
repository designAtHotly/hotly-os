import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

interface CrossNavPillProps {
    href: string;
    icon: ReactNode;
    label: string;
    badge: string;
    variant: 'light' | 'dark';
    className?: string;
}

const styles = {
    light: {
        pill: 'bg-white/90 text-gray-700 hover:bg-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        label: 'text-gray-800',
        badge: 'bg-emerald-500/15 text-emerald-600',
    },
    dark: {
        pill: 'bg-[rgba(30,27,35,0.85)] text-white/90 hover:bg-[rgba(50,47,55,0.9)] shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
        label: 'text-white/90',
        badge: 'bg-[rgba(184,134,74,0.25)] text-[#B8864A]',
    },
};

export default function CrossNavPill({ href, icon, label, badge, variant, className = '' }: CrossNavPillProps) {
    const s = styles[variant];

    return (
        <Link
            href={href as Route}
            className={`
                h-10 pl-2.5 pr-3 rounded-full
                backdrop-blur-md
                flex items-center gap-1.5
                active:scale-90
                transition-all duration-150 ease-out
                focus:outline-none cursor-pointer
                border border-white/[0.12]
                ${s.pill}
                ${className}
            `}
        >
            <span className="text-xl leading-none">{icon}</span>
            <span className={`text-[13px] font-semibold ${s.label}`}>{label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${s.badge}`}>
                {badge}
            </span>
        </Link>
    );
}

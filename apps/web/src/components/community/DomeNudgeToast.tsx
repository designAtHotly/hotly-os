import { C_AMBER, C_AMBER_30 } from './shared';

export default function DomeNudgeToast({ message, fontSize, onAction, onDismiss }: {
    message: string;
    fontSize: number;
    onAction: () => void;
    onDismiss: () => void;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onAction}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAction(); } }}
            style={{
                position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                padding: '16px 26px', borderRadius: 50,
                background: 'rgba(40, 32, 18, 0.85)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${C_AMBER_30}`,
                color: C_AMBER,
                fontSize: fontSize * 1.15,
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                zIndex: 500,
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: 16,
                animation: 'slideUp 0.35s ease',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                maxWidth: 'calc(100vw - 32px)',
                width: 'max-content',
            }}
            className="hover-nudge-toast"
        >
            <span style={{ lineHeight: 1.4 }}>{message}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                style={{
                    background: 'none', border: 'none', color: C_AMBER,
                    cursor: 'pointer', padding: 4, opacity: 0.4,
                    fontSize: fontSize * 1.1,
                    flexShrink: 0,
                }}
            >
                ✕
            </button>
        </div>
    );
}

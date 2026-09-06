import React from 'react';
import { FONT_SANS, FONT_SERIF, C_AMBER, C_AMBER_90, C_AMBER_30, C_AMBER_20, C_AMBER_10, C_AMBER_15, C_WHITE_45 } from './shared';
import BottomSheet from './BottomSheet';

export default function DomeExplainerSheet({ onClose, onCreateDome, f }: {
    onClose: () => void;
    onCreateDome: () => void;
    f: { body: number; caption: number; subtitle: number; heading: number };
}) {
    return (
        <BottomSheet onClose={onClose}>
            {/* Icon */}
            <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: C_AMBER_10,
                border: `1px solid ${C_AMBER_20}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '6px auto 20px',
            }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C_AMBER_90} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
            </div>

            {/* Title */}
            <h3 style={{
                color: 'white', fontFamily: FONT_SERIF, fontStyle: 'italic',
                fontSize: f.heading, fontWeight: 400,
                textAlign: 'center', margin: '0 0 10px',
            }}>
                Your own corner of the internet
            </h3>

            {/* Description */}
            <p style={{
                color: C_WHITE_45,
                fontFamily: FONT_SANS, fontSize: f.body,
                textAlign: 'center', margin: '0 0 28px',
                lineHeight: 1.5, padding: '0 8px',
            }}>
                Ask something real once a week. Watch the answers gather like
                notes on a wall. No algorithms, no likes &mdash; just real thoughts
                from real people.
            </p>

            {/* CTA */}
            <button
                onClick={onCreateDome}
                style={{
                    width: '100%', padding: '16px 24px',
                    background: C_AMBER_15,
                    border: `1px solid ${C_AMBER_30}`,
                    borderRadius: 50, cursor: 'pointer',
                    color: C_AMBER,
                    fontFamily: FONT_SANS, fontSize: f.body,
                    fontWeight: 600, transition: 'all 0.2s ease',
                }}
                className="hover-glass"
            >
                Create my dome
            </button>
        </BottomSheet>
    );
}

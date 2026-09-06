import React, { useEffect } from 'react';
import { FONT_SANS, FONT_SERIF, C_AMBER_08, C_AMBER_12 } from './shared';
import ModalOverlay from './ModalOverlay';
import CloseButton from './CloseButton';

const CONFETTI_COLORS = ['#D4A24E', '#E8C47A', '#F5DDA0', '#FFFFFF'];
const CELEBRATION_INK = '#3D2E14';
const CELEBRATION_INK_LIGHT = '#5A4528';

export default function DomeCelebration({ promptContent, onClose }: { promptContent: string; onClose: () => void }) {
    useEffect(() => {
        let cancelled = false;
        import('canvas-confetti').then(mod => {
            if (cancelled) return;
            const confetti = mod.default;
            const duration = 3000;
            const end = Date.now() + duration;
            const frame = () => {
                confetti({ particleCount: 2, angle: 60, spread: 50, origin: { x: 0, y: 0.7 }, colors: CONFETTI_COLORS });
                confetti({ particleCount: 2, angle: 120, spread: 50, origin: { x: 1, y: 0.7 }, colors: CONFETTI_COLORS });
                if (Date.now() < end && !cancelled) requestAnimationFrame(frame);
            };
            frame();
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <ModalOverlay onClose={onClose} maxWidth={400} borderRadius={28} cardStyle={{
            background: 'linear-gradient(170deg, #FFF8EC 0%, #FCEFD6 40%, #F5E1B8 100%)',
            border: '1px solid rgba(212,162,78,0.2)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 120px rgba(212,162,78,0.12)',
            position: 'relative',
        }}>
            <CloseButton onClick={onClose} size={28} style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'rgba(90,69,40,0.08)', border: '1px solid rgba(90,69,40,0.1)', color: 'rgba(90,69,40,0.4)' }} />
            <div style={{
                padding: '52px 32px 40px',
                textAlign: 'center',
                animation: 'celebrationIn 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                <h1 style={{
                    fontFamily: FONT_SERIF,
                    fontStyle: 'italic',
                    fontSize: 30,
                    fontWeight: 400,
                    color: CELEBRATION_INK,
                    margin: '0 0 28px',
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                }}>
                    Your dome is live
                </h1>

                {promptContent && (
                    <div style={{
                        background: C_AMBER_08,
                        borderRadius: 16,
                        padding: '20px 24px',
                        marginBottom: 36,
                        border: `1px solid ${C_AMBER_12}`,
                    }}>
                        <p style={{
                            fontFamily: FONT_SERIF,
                            fontStyle: 'italic',
                            fontSize: 16,
                            color: CELEBRATION_INK_LIGHT,
                            margin: 0,
                            lineHeight: 1.55,
                        }}>
                            &ldquo;{promptContent}&rdquo;
                        </p>
                    </div>
                )}

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '15px 24px',
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: FONT_SANS,
                        color: 'white',
                        background: 'linear-gradient(135deg, #D4A24E 0%, #B8864A 100%)',
                        border: 'none',
                        borderRadius: 50,
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 4px 20px rgba(184,134,74,0.35)',
                        letterSpacing: '0.01em',
                    }}
                >
                    Explore your dome
                </button>
            </div>
            <style>{`
                @keyframes celebrationIn {
                    0% { opacity: 0; transform: scale(0.95) translateY(16px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </ModalOverlay>
    );
}

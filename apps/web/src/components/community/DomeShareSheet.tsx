import React from 'react';
import { FONT_SANS, FONT_SERIF, C_WHITE_06, C_WHITE_08, C_WHITE_40, C_WHITE_55 } from './shared';
import ModalOverlay from './ModalOverlay';
import BottomSheet from './BottomSheet';
import CloseButton from './CloseButton';
import CopyButton from './CopyButton';

export default function DomeShareSheet({ domeShareUrl, onClose, isMobile, f }: {
    domeShareUrl: string;
    onClose: () => void;
    isMobile: boolean;
    f: { body: number; caption: number; subtitle: number; heading: number };
}) {
    const displayUrl = domeShareUrl.replace(/^https?:\/\//, '');
    const shareMessage = `I started something - come answer this week\u2019s question: ${domeShareUrl}`;

    const content = (
        <>
            {/* Title */}
            <h3 id="dome-share-title" style={{
                fontFamily: FONT_SERIF, fontStyle: 'italic',
                fontSize: f.heading, fontWeight: 400,
                color: 'white', margin: '0 0 12px',
            }}>
                Invite someone in
            </h3>

            {/* Subtitle */}
            <p style={{
                fontFamily: FONT_SANS, fontSize: f.body,
                color: C_WHITE_40, margin: '0 0 24px',
                lineHeight: 1.5,
            }}>
                Start with one person you&rsquo;d want to hear from. That&rsquo;s all it takes.
            </p>

            {/* LINK section */}
            <p className="section-label" style={{ margin: '0 0 8px' }}>
                Link
            </p>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 16px',
                background: C_WHITE_06,
                border: `1px solid ${C_WHITE_08}`,
                borderRadius: 14,
                marginBottom: 20,
            }}>
                <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: FONT_SANS, fontSize: f.body,
                    color: C_WHITE_55,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {displayUrl}
                </span>
                <CopyButton text={domeShareUrl} fontSize={f.caption} />
            </div>

            {/* READY-MADE MESSAGE section */}
            <p className="section-label" style={{ margin: '0 0 8px' }}>
                Ready-made message
            </p>
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '14px 16px',
                background: C_WHITE_06,
                border: `1px solid ${C_WHITE_08}`,
                borderRadius: 14,
            }}>
                <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: FONT_SANS, fontSize: f.body,
                    color: C_WHITE_55,
                    lineHeight: 1.5,
                }}>
                    {shareMessage}
                </span>
                <CopyButton text={shareMessage} fontSize={f.caption} style={{ marginTop: 2 }} />
            </div>
        </>
    );

    if (isMobile) {
        return <BottomSheet onClose={onClose}>{content}</BottomSheet>;
    }

    return (
        <ModalOverlay onClose={onClose} maxWidth={380} borderRadius={20} labelledBy="dome-share-title" cardStyle={{ position: 'relative' }}>
            <CloseButton onClick={onClose} size={26} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} />
            <div style={{ padding: '24px 24px 22px' }}>
                {content}
            </div>
        </ModalOverlay>
    );
}

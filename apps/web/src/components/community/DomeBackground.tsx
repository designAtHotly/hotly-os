'use client';

import { useEffect, useMemo, memo } from 'react';
import type { CommunityNote } from '@/lib/api';
import { NoteCardScaled } from './cards';
import { useSphereInteraction } from './useSphereInteraction';
import { useIsMobile } from '../../hooks/useIsMobile';

const SEGMENTS = 34;
const RADIUS = 800;
const ITEM_SIZE = (RADIUS * 3.14) / SEGMENTS;
const SPHERE_ITEM_SIZE = 133;

interface Coord { x: number; y: number }
interface GridItem extends Coord { note: CommunityNote }

let cachedCoords: Coord[] | null = null;

function getSortedGridCoords(): Coord[] {
    if (cachedCoords) return cachedCoords;
    const xCols = Array.from({ length: SEGMENTS }, (_, i) => -37 + i * 2);
    const evenYs = [-4, -2, 0, 2, 4];
    const oddYs = [-3, -1, 1, 3, 5];
    cachedCoords = xCols
        .flatMap((x, c) => (c % 2 === 0 ? evenYs : oddYs).map(y => ({ x, y })))
        .sort((a, b) => {
            const dA = Math.hypot(a.x, a.y);
            const dB = Math.hypot(b.x, b.y);
            if (Math.abs(dA - dB) < 0.5) return Math.atan2(a.x, -a.y) - Math.atan2(b.x, -b.y);
            return dA - dB;
        });
    return cachedCoords;
}

function buildItems(notes: CommunityNote[]) {
    if (!notes.length) return { items: [] as GridItem[], minX: 0, maxX: 0 };
    const coords = getSortedGridCoords();
    const used = coords.slice(0, Math.min(coords.length, notes.length));
    let minX = Infinity, maxX = -Infinity;
    for (const c of used) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
    }
    return { items: used.map((c, i) => ({ ...c, note: notes[i] })), minX, maxX };
}

const DomeTile = memo(function DomeTile({ note, onClick }: { note: CommunityNote; onClick: () => void }) {
    return <NoteCardScaled note={note} containerSize={SPHERE_ITEM_SIZE} onClick={onClick} />;
});

interface DomeBackgroundProps {
    notes: CommunityNote[];
    onTileClick: (note: CommunityNote) => void;
    disabled?: boolean;
    highlightedNoteId?: string | null;
    onHighlightComplete?: () => void;
}

export default function DomeBackground({ notes, onTileClick, disabled = false, highlightedNoteId, onHighlightComplete }: DomeBackgroundProps) {
    const isMobile = useIsMobile();
    useMemo(() => getSortedGridCoords(), []);

    const { items, minX, maxX } = useMemo(() => buildItems(notes), [notes]);

    const rotYPerUnit = (360 / SEGMENTS) / 2;
    const padding = 0.5;
    const fullSpan = (SEGMENTS - 1) * 2;
    const domeIsFull = notes.length > 0 && (maxX - minX) >= fullSpan;
    const minRotY = domeIsFull ? -Infinity : (notes.length > 0 ? -(maxX + padding) * rotYPerUnit : -180);
    const maxRotY = domeIsFull ? Infinity : (notes.length > 0 ? -(minX - padding) * rotYPerUnit : 180);
    const centerRotY = notes.length > 0 ? -((minX + maxX) / 2) * rotYPerUnit : 0;

    const { sphereRef, containerRef, zoom, isDraggingRef, handlers, setRotation, animateToRotation } = useSphereInteraction({
        minRotY, maxRotY, disabled,
        zoom: notes.length < 7
            ? (isMobile ? 0.8 : 1)
            : (isMobile ? 0.65 : 0.8),
    });

    // Tilt dome upward so top-row notes are visible below the header
    const defaultTiltX = isMobile ? 10 : 0;

    useEffect(() => {
        if (notes.length > 0) {
            setRotation(defaultTiltX, centerRotY);
        } else {
            setRotation(defaultTiltX, 0);
        }
    }, [setRotation, centerRotY, notes.length, defaultTiltX]);

    // Center on highlighted note and trigger shimmer
    useEffect(() => {
        if (!highlightedNoteId) return;

        // Find the highlighted note's position
        const highlightedItem = items.find(it => it.note.uuid === highlightedNoteId);
        if (!highlightedItem) return;

        // Calculate the rotation needed to center this note
        const targetRotY = -highlightedItem.x * rotYPerUnit;
        const MAX_VERTICAL = 15;
        const idealRotX = defaultTiltX + (-highlightedItem.y * rotYPerUnit);
        const targetRotX = Math.max(-MAX_VERTICAL, Math.min(MAX_VERTICAL, idealRotX));
        animateToRotation(targetRotX, targetRotY, 600);

        // Clear highlight after drop-in animation completes
        const timer = setTimeout(() => {
            onHighlightComplete?.();
        }, isMobile ? 1200 : 1000);

        return () => clearTimeout(timer);
    }, [highlightedNoteId, items, rotYPerUnit, animateToRotation, onHighlightComplete, isMobile]);

    const getItemTransform = (x: number, y: number) =>
        `rotateY(${rotYPerUnit * x}deg) rotateX(${rotYPerUnit * y}deg) translateZ(${RADIUS}px)`;

    const itemW = ITEM_SIZE * 1.8;
    const itemH = ITEM_SIZE * 1.8;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', inset: 0,
                touchAction: 'none', userSelect: 'none',
                WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                overscrollBehavior: 'none', zIndex: 1,
            }}
            {...handlers}
        >
            {/* stage */}
            <div style={{
                width: '100%', height: '100%',
                display: 'grid', placeItems: 'center',
                position: 'absolute',
                top: isMobile ? '8%' : 0,
                right: 0, bottom: 0, left: 0,
                perspective: 1600, perspectiveOrigin: '50% 50%',
                transform: `scale(${zoom})`,
            }}>
                {/* sphere */}
                <div
                    ref={sphereRef}
                    style={{ position: 'absolute', willChange: 'transform', transformStyle: 'preserve-3d' }}
                >
                    {items.map(it => {
                        const isHighlighted = it.note.uuid === highlightedNoteId;
                        return (
                            <div
                                key={it.note.uuid}
                                style={{
                                    width: itemW, height: itemH,
                                    position: 'absolute',
                                    top: -999, bottom: -999, left: -999, right: -999,
                                    margin: 'auto',
                                    transformOrigin: '50% 50%',
                                    backfaceVisibility: 'hidden',
                                    transformStyle: 'preserve-3d',
                                    transform: getItemTransform(it.x, it.y),
                                }}
                            >
                                <div
                                    onClick={() => { if (!isDraggingRef.current) onTileClick(it.note); }}
                                    style={{
                                        position: 'absolute', inset: 4,
                                        backfaceVisibility: 'hidden',
                                        transformStyle: 'preserve-3d',
                                        transition: 'transform 0.2s ease',
                                        cursor: 'pointer',
                                        animation: isHighlighted
                                            ? isMobile
                                                ? 'dropInMobile 1.6s cubic-bezier(0.25, 0.1, 0.25, 1)'
                                                : 'dropIn 1.4s cubic-bezier(0.25, 0.1, 0.25, 1)'
                                            : undefined,
                                    }}
                                    className="hover-dome-tile"
                                >
                                    <DomeTile note={it.note} onClick={() => onTileClick(it.note)} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
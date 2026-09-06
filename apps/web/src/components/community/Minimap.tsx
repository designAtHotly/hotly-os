'use client';

import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { getColor } from './shared';
import type { CommunityNote } from '@/lib/api';
import type { NoteWithChildren } from './threadUtils';
import { SCROLL_CLASS } from './ScrollArea';

interface NodePos {
    x: number;
    y: number;
    node: NoteWithChildren;
}

interface MinimapProps {
    root: NoteWithChildren;
    flatNotes: Array<{ note: NoteWithChildren; depth: number; path: CommunityNote[] }>;
    currentIndex: number;
    onNavigate: (index: number) => void;
    isMobile?: boolean;
}

const Minimap = memo(function Minimap({
    root,
    flatNotes,
    currentIndex,
    onNavigate,
    isMobile,
}: MinimapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const currentPath = flatNotes[currentIndex]?.path || [];
    const currentNoteId = flatNotes[currentIndex]?.note.uuid;

    const NODE_SIZE = isMobile ? 10 : 56;
    const H_GAP = isMobile ? 6 : 28;
    const V_GAP = isMobile ? 3 : 18;
    const PADDING = isMobile ? 6 : 20;
    const MAX_HEIGHT = isMobile ? 70 : 200;

    const { positions, width, height } = useMemo(() => {
        const positions: NodePos[] = [];
        let maxX = 0;
        let maxY = 0;

        const calc = (node: NoteWithChildren, x: number, y: number): number => {
            positions.push({ x, y, node });
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            if (node.children.length === 0) return y;

            let currentY = y;
            node.children.forEach((child, i) => {
                if (i > 0) currentY += NODE_SIZE + V_GAP;
                currentY = calc(child, x + NODE_SIZE + H_GAP, currentY);
            });
            return currentY;
        };

        calc(root, PADDING, PADDING);

        return {
            positions,
            width: maxX + NODE_SIZE + PADDING * 2,
            height: maxY + NODE_SIZE + PADDING * 2,
        };
    }, [root, NODE_SIZE, H_GAP, V_GAP, PADDING]);

    const [containerWidth, setContainerWidth] = useState(340);
    useEffect(() => {
        if (containerRef.current) {
            const obs = new ResizeObserver(entries => {
                for (const entry of entries) setContainerWidth(entry.contentRect.width);
            });
            obs.observe(containerRef.current);
            return () => obs.disconnect();
        }
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            const pos = positions.find(p => p.node.uuid === currentNoteId);
            if (pos) {
                const scrollX = pos.x - containerRef.current.clientWidth / 2 + NODE_SIZE / 2;
                const scrollY = pos.y - containerRef.current.clientHeight / 2 + NODE_SIZE / 2;
                containerRef.current.scrollTo({
                    left: Math.max(0, scrollX),
                    top: Math.max(0, scrollY),
                    behavior: 'smooth',
                });
            }
        }
    }, [currentIndex, positions, currentNoteId]);

    const getIdx = (uuid: string) => flatNotes.findIndex(f => f.note.uuid === uuid);
    const isOnPath = (uuid: string) => currentPath.some(n => n.uuid === uuid);

    return (
        <div
            ref={containerRef}
            className={SCROLL_CLASS}
            style={{
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: MAX_HEIGHT,
                display: 'flex',
                justifyContent: width <= containerWidth ? 'center' : 'flex-start',
            }}
        >
            <svg
                style={{ display: 'block', flexShrink: 0 }}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {/* Bezier curve connections */}
                {positions.map(({ node, x, y }) => {
                    const parent = positions.find(p =>
                        p.node.children.some(c => c.uuid === node.uuid)
                    );
                    if (!parent) return null;

                    const x1 = parent.x + NODE_SIZE;
                    const y1 = parent.y + NODE_SIZE / 2;
                    const x2 = x;
                    const y2 = y + NODE_SIZE / 2;
                    const midX = (x1 + x2) / 2;
                    const active = isOnPath(node.uuid) && isOnPath(parent.node.uuid);

                    return (
                        <path
                            key={`c-${node.uuid}`}
                            d={`M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                            fill="none"
                            stroke={active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'}
                            strokeWidth={isMobile ? (active ? 1.5 : 1) : (active ? 2.5 : 1.5)}
                            strokeLinecap="round"
                        />
                    );
                })}

                {/* Nodes */}
                {positions.map(({ node, x, y }) => {
                    const color = getColor(node.color);
                    const isCurrent = node.uuid === currentNoteId;
                    const onPath = isOnPath(node.uuid);
                    const dimmed = !onPath && !isCurrent;

                    return (
                        <g
                            key={node.uuid}
                            transform={`translate(${x}, ${y})`}
                            onClick={() => onNavigate(getIdx(node.uuid))}
                            style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.3s' }}
                        >
                            {isCurrent && (
                                <circle
                                    cx={NODE_SIZE / 2}
                                    cy={NODE_SIZE / 2}
                                    r={NODE_SIZE / 2 + (isMobile ? 2 : 4)}
                                    fill="none"
                                    stroke="rgba(255,255,255,0.25)"
                                    strokeWidth={isMobile ? 1 : 1.5}
                                >
                                    <animate
                                        attributeName="r"
                                        values={`${NODE_SIZE / 2 + (isMobile ? 1 : 2)};${NODE_SIZE / 2 + (isMobile ? 3 : 5)};${NODE_SIZE / 2 + (isMobile ? 1 : 2)}`}
                                        dur="3s"
                                        repeatCount="indefinite"
                                    />
                                    <animate
                                        attributeName="opacity"
                                        values="0.3;0.15;0.3"
                                        dur="3s"
                                        repeatCount="indefinite"
                                    />
                                </circle>
                            )}
                            <circle
                                cx={NODE_SIZE / 2}
                                cy={NODE_SIZE / 2}
                                r={NODE_SIZE / 2 - (isMobile ? 0.5 : 1)}
                                fill={isCurrent ? color.bg : onPath ? color.bg : 'rgba(255,255,255,0.06)'}
                                stroke={isCurrent ? 'rgba(255,255,255,0.5)' : onPath ? color.accent : 'rgba(255,255,255,0.1)'}
                                strokeWidth={isCurrent ? (isMobile ? 1.5 : 2.5) : (isMobile ? 1 : 1.5)}
                                style={{ transition: 'all 0.3s ease' }}
                            />
                            {!isMobile && (
                                <text
                                    x={NODE_SIZE / 2}
                                    y={NODE_SIZE / 2 + 7}
                                    textAnchor="middle"
                                    style={{ fontSize: 24, pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {node.emoji || '🌙'}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
});

export default Minimap;

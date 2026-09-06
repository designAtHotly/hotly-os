'use client';

import { useRef, useCallback, useEffect, PointerEvent, TouchEvent } from 'react';
import { clamp } from './shared';

interface SphereInteractionConfig {
    minRotY: number;
    maxRotY: number;
    maxVertical?: number;
    dragSensitivity?: number;
    disabled?: boolean;
    zoom?: number;
}

interface SphereInteractionReturn {
    sphereRef: React.RefObject<HTMLDivElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    zoom: number;
    isDraggingRef: React.RefObject<boolean>;
    handlers: {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
        onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
        onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
        onTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
        onTouchEnd: (e: TouchEvent<HTMLDivElement>) => void;
        onTouchCancel: (e: TouchEvent<HTMLDivElement>) => void;
    };
    setRotation: (x: number, y: number) => void;
    animateToRotation: (x: number, y: number, duration?: number) => void;
}

export function useSphereInteraction(config: SphereInteractionConfig): SphereInteractionReturn {
    const {
        minRotY, maxRotY,
        maxVertical = 15, dragSensitivity = 20,
        disabled = false,
    } = config;

    const zoom = config.zoom ?? 0.3;
    const sphereRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rotationRef = useRef({ x: 0, y: 0 });
    const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);
    const velocityRef = useRef({ x: 0, y: 0 });
    const lastPosRef = useRef({ x: 0, y: 0, time: 0 });
    const inertiaRef = useRef<number | null>(null);
    const animationRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);

    const applyTransform = useCallback((rx: number, ry: number) => {
        if (sphereRef.current) {
            sphereRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        }
    }, []);

    const setRotation = useCallback((x: number, y: number) => {
        rotationRef.current = { x, y };
        applyTransform(x, y);
    }, [applyTransform]);

    const stopInertia = useCallback(() => {
        if (inertiaRef.current) {
            cancelAnimationFrame(inertiaRef.current);
            inertiaRef.current = null;
        }
    }, []);

    const startInertia = useCallback(() => {
        const step = () => {
            velocityRef.current.x *= 0.95;
            velocityRef.current.y *= 0.95;
            if (Math.abs(velocityRef.current.x) < 0.01 && Math.abs(velocityRef.current.y) < 0.01) {
                inertiaRef.current = null;
                return;
            }
            const nextX = clamp(rotationRef.current.x - velocityRef.current.y, -maxVertical, maxVertical);
            const nextY = clamp(rotationRef.current.y + velocityRef.current.x, minRotY, maxRotY);
            if (nextY === minRotY || nextY === maxRotY) velocityRef.current.x = 0;
            rotationRef.current = { x: nextX, y: nextY };
            applyTransform(nextX, nextY);
            inertiaRef.current = requestAnimationFrame(step);
        };
        stopInertia();
        inertiaRef.current = requestAnimationFrame(step);
    }, [applyTransform, stopInertia, minRotY, maxRotY, maxVertical]);

    const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        stopInertia();
        dragStartRef.current = { x: e.clientX, y: e.clientY, rotX: rotationRef.current.x, rotY: rotationRef.current.y };
        lastPosRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
        velocityRef.current = { x: 0, y: 0 };
        isDraggingRef.current = false;
    }, [disabled, stopInertia]);

    const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current || disabled) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) >= 5) {
            isDraggingRef.current = true;
        }
        const nextX = clamp(dragStartRef.current.rotX - dy / dragSensitivity, -maxVertical, maxVertical);
        const nextY = clamp(dragStartRef.current.rotY + dx / dragSensitivity, minRotY, maxRotY);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        const now = performance.now();
        const dt = now - lastPosRef.current.time;
        if (dt > 0) {
            velocityRef.current = {
                x: ((e.clientX - lastPosRef.current.x) / dt) * (16 / dragSensitivity),
                y: ((e.clientY - lastPosRef.current.y) / dt) * (16 / dragSensitivity),
            };
        }
        lastPosRef.current = { x: e.clientX, y: e.clientY, time: now };
    }, [applyTransform, disabled, minRotY, maxRotY, maxVertical, dragSensitivity]);

    const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        dragStartRef.current = null;
        const tapThreshold = e.pointerType === 'touch' ? 10 : 5;
        if (dist < tapThreshold) return;
        if (Math.abs(velocityRef.current.x) > 0.05 || Math.abs(velocityRef.current.y) > 0.05) {
            startInertia();
        }
        // Reset isDragging after a frame so the synthetic click event sees it as true
        if (isDraggingRef.current) {
            requestAnimationFrame(() => { isDraggingRef.current = false; });
        }
    }, [startInertia]);

    const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.touches.length === 1) {
            stopInertia();
            const t = e.touches[0];
            dragStartRef.current = { x: t.clientX, y: t.clientY, rotX: rotationRef.current.x, rotY: rotationRef.current.y };
            lastPosRef.current = { x: t.clientX, y: t.clientY, time: performance.now() };
            velocityRef.current = { x: 0, y: 0 };
        }
    }, [disabled, stopInertia]);

    const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.touches.length === 1 && dragStartRef.current) {
            e.preventDefault();
            const t = e.touches[0];
            const dx = t.clientX - dragStartRef.current.x;
            const dy = t.clientY - dragStartRef.current.y;
            const nextX = clamp(dragStartRef.current.rotX - dy / dragSensitivity, -maxVertical, maxVertical);
            const nextY = clamp(dragStartRef.current.rotY + dx / dragSensitivity, minRotY, maxRotY);
            rotationRef.current = { x: nextX, y: nextY };
            applyTransform(nextX, nextY);
            const now = performance.now();
            const dt = now - lastPosRef.current.time;
            if (dt > 0) {
                velocityRef.current = {
                    x: ((t.clientX - lastPosRef.current.x) / dt) * (16 / dragSensitivity),
                    y: ((t.clientY - lastPosRef.current.y) / dt) * (16 / dragSensitivity),
                };
            }
            lastPosRef.current = { x: t.clientX, y: t.clientY, time: now };
        }
    }, [applyTransform, disabled, minRotY, maxRotY, maxVertical, dragSensitivity]);

    const handleTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 0) {
            if (dragStartRef.current) {
                if (Math.abs(velocityRef.current.x) > 0.05 || Math.abs(velocityRef.current.y) > 0.05) {
                    startInertia();
                }
            }
            dragStartRef.current = null;
        }
    }, [startInertia]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const prevent = (e: globalThis.TouchEvent) => {
            if (e.touches.length > 0) e.preventDefault();
        };
        container.addEventListener('touchmove', prevent, { passive: false });
        return () => container.removeEventListener('touchmove', prevent);
    }, []);

    const stopAnimation = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    const animateToRotation = useCallback((targetX: number, targetY: number, duration = 600) => {
        stopInertia();
        stopAnimation();
        const startX = rotationRef.current.x;
        const startY = rotationRef.current.y;
        const startTime = performance.now();

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);

            const newX = startX + (targetX - startX) * eased;
            const newY = startY + (targetY - startY) * eased;
            rotationRef.current = { x: newX, y: newY };
            applyTransform(newX, newY);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                animationRef.current = null;
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [applyTransform, stopInertia, stopAnimation]);

    return {
        sphereRef, containerRef, zoom, isDraggingRef,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd,
        },
        setRotation,
        animateToRotation,
    };
}

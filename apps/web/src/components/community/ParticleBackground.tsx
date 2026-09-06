'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    opacitySpeed: number;
    opacityDirection: number;
    maxOpacity: number;
    spriteIndex: number;
}

/**
 * Dreamy drifting particles — fireflies/stars that float gently.
 * Uses a single <canvas> element. Very light on performance.
 */
export default function ParticleBackground({ isStatic = false }: { isStatic?: boolean } = {}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let particles: Particle[] = [];

        // Palette-matching colors (lavender, blush, mint, cream, sky)
        const HUES = [260, 340, 160, 40, 210];

        // Pre-render a sprite for each hue (glow + core baked in)
        const SPRITE_SIZE = 64;
        const sprites = HUES.map(hue => {
            const s = document.createElement('canvas');
            s.width = s.height = SPRITE_SIZE;
            const sCtx = s.getContext('2d')!;
            const r = SPRITE_SIZE / 2;
            // Outer glow
            const g = sCtx.createRadialGradient(r, r, 0, r, r, r);
            g.addColorStop(0, `hsla(${hue}, 60%, 80%, 0.6)`);
            g.addColorStop(1, `hsla(${hue}, 60%, 80%, 0)`);
            sCtx.fillStyle = g;
            sCtx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
            // Sharp core dot (matches original's separate core circle)
            const coreR = r * 0.25;
            sCtx.beginPath();
            sCtx.arc(r, r, coreR, 0, Math.PI * 2);
            sCtx.fillStyle = `hsla(${hue}, 50%, 90%, 1)`;
            sCtx.fill();
            return s;
        });

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const createParticles = () => {
            const count = Math.floor((canvas.width * canvas.height) / 18000);
            particles = Array.from({ length: count }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.8,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: -Math.random() * 0.2 - 0.05,
                opacity: Math.random() * 0.4,
                opacitySpeed: Math.random() * 0.003 + 0.001,
                opacityDirection: 1,
                maxOpacity: Math.random() * 0.35 + 0.15,
                spriteIndex: Math.floor(Math.random() * HUES.length),
            }));
        };

        const drawStatic = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                const drawSize = p.size * 8;
                ctx.globalAlpha = p.maxOpacity * 0.7;
                ctx.drawImage(sprites[p.spriteIndex], p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
            }
            ctx.globalAlpha = 1;
        };

        let lastTime = 0;
        const draw = (time: number) => {
            const dt = lastTime ? Math.min((time - lastTime) / 16.67, 3) : 1; // normalize to 60fps, cap at 3x
            lastTime = time;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const p of particles) {
                // Move (speed × delta so it's consistent regardless of FPS)
                p.x += p.speedX * dt;
                p.y += p.speedY * dt;

                // Pulse opacity
                p.opacity += p.opacitySpeed * p.opacityDirection * dt;
                if (p.opacity >= p.maxOpacity) {
                    p.opacityDirection = -1;
                } else if (p.opacity <= 0.02) {
                    p.opacityDirection = 1;
                    // Respawn at bottom when faded out and drifted off
                    if (p.y < -10) {
                        p.y = canvas.height + 10;
                        p.x = Math.random() * canvas.width;
                    }
                }

                // Wrap horizontally
                if (p.x < -10) p.x = canvas.width + 10;
                if (p.x > canvas.width + 10) p.x = -10;

                // Soft wrap vertically
                if (p.y < -20) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                }

                // Draw sprite
                const drawSize = p.size * 8;
                ctx.globalAlpha = p.opacity;
                ctx.drawImage(sprites[p.spriteIndex], p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
                ctx.globalAlpha = 1;
            }

            animId = requestAnimationFrame(draw);
        };

        resize();
        createParticles();

        if (isStatic) {
            drawStatic();
        } else {
            animId = requestAnimationFrame(draw);
        }

        const handleResize = () => {
            resize();
            createParticles();
            if (isStatic) drawStatic();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, [isStatic]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
            }}
        />
    );
}
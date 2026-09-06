import { useState, useCallback, useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'touchstart', 'scroll', 'keydown'] as const;

interface UseNudgeTimerOptions {
    /** Whether the nudge is eligible to fire */
    enabled: boolean;
    /** Delay in ms before the nudge fires */
    delay: number;
    /** If true, resets the timer on user activity (mousemove, touch, scroll, keydown) */
    resetOnActivity?: boolean;
    /** Max number of times the nudge can fire. Unlimited if omitted. */
    maxFires?: number;
}

/**
 * Generic nudge timer — fires a boolean after `delay` ms while `enabled` is true.
 * Optionally resets on user activity for idle-based nudges.
 */
export function useNudgeTimer({ enabled, delay, resetOnActivity = false, maxFires }: UseNudgeTimerOptions) {
    const [nudge, setNudge] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fireCountRef = useRef(0);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        if (maxFires !== undefined && fireCountRef.current >= maxFires) return;
        clearTimer();
        timerRef.current = setTimeout(() => {
            fireCountRef.current += 1;
            setNudge(true);
        }, delay);
    }, [clearTimer, delay, maxFires]);

    /** Call after animation ends to re-arm the timer (useful for repeating nudges) */
    const rearm = useCallback(() => {
        setNudge(false);
        startTimer();
    }, [startTimer]);

    /** Call to just clear without re-arming */
    const clear = useCallback(() => {
        setNudge(false);
    }, []);

    useEffect(() => {
        if (!enabled) {
            setNudge(false);
            clearTimer();
            return;
        }

        startTimer();

        if (resetOnActivity) {
            const reset = () => {
                setNudge(false);
                startTimer();
            };
            ACTIVITY_EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }));
            return () => {
                ACTIVITY_EVENTS.forEach(e => document.removeEventListener(e, reset));
                clearTimer();
            };
        }

        return clearTimer;
    }, [enabled, startTimer, clearTimer, resetOnActivity]);

    return { nudge, rearm, clear };
}

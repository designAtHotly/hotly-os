import { useState, useEffect } from 'react';

export function useToast(duration = 4000) {
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), duration);
            return () => clearTimeout(timer);
        }
    }, [toastMessage, duration]);

    return { toastMessage, setToastMessage };
}

import { useIsMobile } from '@/hooks/useIsMobile';
import { fontScale } from '@/lib/utils/mobile-typography';

/** Combines useIsMobile + fontScale into a single call */
export function useFontScale() {
    const isMobile = useIsMobile();
    return { isMobile, f: fontScale(isMobile) };
}

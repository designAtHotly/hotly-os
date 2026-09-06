import { toPng } from 'html-to-image';
import { getCommunityNoteShareUrl } from '@/lib/utils/page-helper';

/** Build the deep-link URL for a shared note */
export function buildNoteShareUrl(
    creatorSlug: string,
    promptSlug: string,
    shareSlug: string
): string {
    return getCommunityNoteShareUrl(creatorSlug, promptSlug, shareSlug);
}

/** Build the share text for Twitter */
export function buildShareText(
    noteContent: string,
    creatorName: string
): string {
    const truncated = noteContent.length > 60
        ? noteContent.slice(0, 59).trim() + '\u2026'
        : noteContent;
    return `\u201c${truncated}\u201d\n\n\u2014 ${creatorName.trim()} on Hotly`;
}

/** Capture a DOM element as a PNG data URL */
export async function captureShareImage(
    element: HTMLElement
): Promise<string> {
    return toPng(element, {
        backgroundColor: 'transparent',
        pixelRatio: 2,
    });
}

/** Convert a data URL to a Blob */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}

/** Trigger a PNG download from a data URL */
export function downloadImage(dataUrl: string, filename = 'hotly-note.png'): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/** Try native share with image, fall back to URL-only share */
export async function nativeShare(
    blob: Blob,
    url: string,
    text: string
): Promise<boolean> {
    if (!navigator.share) return false;
    const file = new File([blob], 'hotly-note.png', { type: 'image/png' });
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text, url });
        } else {
            await navigator.share({ text, url });
        }
        return true;
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return true;
        return false;
    }
}

/** Open Twitter/X intent with text and URL */
export function openTwitterShare(text: string, url: string): void {
    const fullText = `${text}\n\n${url}`;
    const params = new URLSearchParams({ text: fullText });
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

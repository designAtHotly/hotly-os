export function isVideoThumbnailSupported(): boolean {
  return false;
}

export async function extractVideoThumbnail(
  _file: File,
  _options?: { seekTime?: number; maxWidth?: number; maxHeight?: number; quality?: number },
): Promise<File | null> {
  return null;
}

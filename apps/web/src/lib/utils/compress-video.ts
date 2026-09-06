export function isVideoCompressionSupported(): boolean {
  return false;
}

export async function compressVideo(
  file: File,
  _options?: Record<string, unknown>,
): Promise<File> {
  return file;
}

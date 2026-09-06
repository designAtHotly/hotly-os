export function isHeicFile(_file: File): boolean {
  return false;
}

export async function compressImage(
  file: File,
  _options?: Record<string, unknown>,
): Promise<File> {
  return file;
}

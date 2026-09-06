export function captureError(error: unknown, extraContext?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.error(error, extraContext);
  }
}

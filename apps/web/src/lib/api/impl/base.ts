export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  method: string;
  response: unknown;

  constructor(response: { status: number; statusText: string; url: string; method: string; body?: unknown }) {
    super(
      typeof response.body === "object" && response.body && "message" in response.body
        ? String((response.body as { message: string }).message)
        : response.statusText || "API Error",
    );
    this.name = "ApiError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.method = response.method;
    this.response = response.body;
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  body?: T;
}

export async function apiCall<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });
  let body: unknown;
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  }
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      method: options.method || "GET",
      body,
    });
  }
  return { status: response.status, body: body as T };
}

export function ok<T>(body?: T): ApiResponse<T> {
  return { status: 200, body };
}

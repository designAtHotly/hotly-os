export interface SessionUser {
  email: string;
  display_name: string;
  is_creator: boolean;
  user_id: number;
}

export interface AuthConfig {
  configured: boolean;
  projectId: string;
  apiKey: string;
  authDomain: string;
}

async function readJSON<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch("/api/auth/config");
  if (!res.ok) {
    throw new Error("auth_config_failed");
  }
  return readJSON<AuthConfig>(res);
}

export async function fetchMe(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error("session_lookup_failed");
  }
  return readJSON<SessionUser>(res);
}

export async function exchangeFirebaseToken(idToken: string): Promise<SessionUser> {
  const res = await fetch("/api/auth/firebase", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (res.status === 503) {
    throw new Error("firebase_not_configured");
  }
  if (!res.ok) {
    throw new Error("firebase_exchange_failed");
  }
  return readJSON<SessionUser>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

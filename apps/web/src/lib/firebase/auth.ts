import { fetchAuthConfig } from "@/lib/auth/session";
import { signInWithGooglePopup } from "@/lib/auth/google";

export const AUTH_REDIRECT = "__AUTH_REDIRECT__";
export const AUTH_REDIRECT_DISMISSED = "__AUTH_REDIRECT_DISMISSED__";
export const AUTH_NOT_CONFIGURED = "__AUTH_NOT_CONFIGURED__";
export const PENDING_NOTE_KEY = "pending_note_draft";
export const PENDING_ACTION_KEY = "pending_auth_action";
export const PENDING_ACTION_CREATE_DOME = "createDome";

export async function signInWithGoogle(): Promise<string | null> {
  const config = await fetchAuthConfig();
  if (!config.configured) {
    return AUTH_NOT_CONFIGURED;
  }
  return signInWithGooglePopup(config);
}

import type { AuthConfig } from "./session";

export async function signInWithGooglePopup(config: AuthConfig): Promise<string> {
  const { initializeApp, getApps } = await import("firebase/app");
  const { GoogleAuthProvider, getAuth, signInWithPopup } = await import("firebase/auth");

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
    });
  const result = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  return result.user.getIdToken();
}

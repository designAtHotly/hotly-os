"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { signInWithGooglePopup } from "@/lib/auth/google";
import {
  type AuthConfig,
  exchangeFirebaseToken,
  fetchAuthConfig,
  fetchMe,
  logout,
  type SessionUser,
} from "@/lib/auth/session";

export default function FirebaseAuthPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAuthConfig(), fetchMe()])
      .then(([nextConfig, nextSession]) => {
        if (cancelled) {
          return;
        }
        setConfig(nextConfig);
        setSession(nextSession);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load authentication status.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    if (!config?.configured) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGooglePopup(config);
      const nextSession = await exchangeFirebaseToken(idToken);
      setSession(nextSession);
      if (nextSession.is_creator) {
        router.replace("/creator");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
        return;
      }
      setError("Google sign-in failed. The server did not create a session.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await logout();
    setSession(null);
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center px-4">
      <div className="absolute inset-0 bg-canvas" />
      <div className="absolute inset-0 bg-gradient-to-b from-amber-100/40 via-transparent to-orange-50/20" />
      <main className="relative w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.12)]">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          <Link href="/penpal" className="hover:text-ink">
            Penpal
          </Link>
        </p>
        <h1 className="mb-2 text-[28px] font-bold tracking-[-0.03em] text-gray-900">Sign in</h1>
        <p className="mb-6 text-[15px] leading-relaxed text-gray-500">
          Google proves your identity. The server creates an HTTP-only session and decides whether you
          are the configured creator.
        </p>
        {config && !config.configured ? (
          <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            Firebase is not configured on this instance. Set the operator Firebase environment
            variables and restart the API.
          </p>
        ) : null}
        {session ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Signed in as <span className="font-semibold">{session.email}</span>
              {session.is_creator ? " (creator)" : ""}.
            </p>
            {!session.is_creator ? (
              <p className="text-sm text-ink-light">
                This identity is not the configured creator and cannot open creator routes.
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={signOut}
              className="h-14 w-full rounded-2xl border-2 border-rule bg-white text-lg font-semibold text-ink transition-all hover:bg-amber-faint disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !config?.configured}
            onClick={signIn}
            className="h-14 w-full rounded-2xl bg-gradient-to-br from-[#fde047] via-[#facc15] to-[#eab308] text-lg font-semibold text-gray-900 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Sign in with Google
          </button>
        )}
        {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
      </main>
    </div>
  );
}

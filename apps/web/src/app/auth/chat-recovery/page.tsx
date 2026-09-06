"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import { consumeChatRecovery, requestChatMagicLink } from "@/lib/api/oss";
import { ApiError } from "@/lib/api/impl/base";

function RecoveryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "consuming" | "error">(
    token ? "consuming" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    consumeChatRecovery(token)
      .then(() => {
        if (!cancelled) {
          router.replace("/chat");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError("This conversation is no longer available.");
        } else {
          setError("That recovery link is invalid or already used. Request a new one.");
        }
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || status === "sending") {
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await requestChatMagicLink("creator", email.trim());
      setStatus("sent");
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError("Recovery email is not configured on this instance.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setStatus("error");
    }
  };

  return (
    <main className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.12)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Penpal</p>
      <h1 className="mb-2 text-[28px] font-bold tracking-[-0.03em] text-gray-900">Recover your chat</h1>
      {status === "consuming" ? (
        <p className="text-[15px] leading-relaxed text-gray-500">Opening your conversation…</p>
      ) : status === "sent" ? (
        <p className="text-[15px] leading-relaxed text-gray-500">
          If we have a paid conversation for that address, a single-use link is on the way. It expires
          in 24 hours.
        </p>
      ) : (
        <>
          <p className="mb-6 text-[15px] leading-relaxed text-gray-500">
            Enter the email you used at Checkout. We will send a single-use link to reopen the
            conversation.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700" htmlFor="recovery-email">
              Email
            </label>
            <input
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="you@example.com"
            />
            {error ? <p className="text-center text-xs text-red-500">{error}</p> : null}
            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "linear-gradient(145deg, #fbbf24, #f59e0b)" }}
            >
              {status === "sending" ? "Sending…" : "Send recovery link"}
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-gray-400">
        <Link href="/penpal" className="underline-offset-2 hover:underline">
          Back to Penpal
        </Link>
      </p>
    </main>
  );
}

export default function ChatRecoveryPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#faf8f5] px-4">
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <RecoveryForm />
      </Suspense>
    </div>
  );
}

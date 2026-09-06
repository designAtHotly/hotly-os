"use client";

import { useEffect, useState } from "react";
import GoogleSignInButton from "./GoogleSignInButton";
import { SocialUser } from "@/types/auth.types";
import { getPrivacyPolicyPage, getTermsOfServicePage } from "@/lib/utils/page-helper";

interface SocialLoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: SocialUser) => void;
  externalError?: string | null;
  title?: string;
  description?: string;
}

export default function SocialLoginModal({
  isOpen,
  onOpenChange,
  onSuccess,
  externalError,
  title = "Almost there!",
  description = "Sign in to Hotly",
}: SocialLoginModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSuccess = (user: SocialUser) => {
    setIsProcessing(true);
    setError(null);
    onSuccess(user);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsProcessing(false);
  };

  const handleClose = (open: boolean) => {
    if (!isProcessing) {
      setError(null);
      onOpenChange(open);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isProcessing]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        disabled={isProcessing}
        onClick={() => handleClose(false)}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-login-title"
        className="relative mx-4 w-full max-w-[380px] rounded-2xl bg-white shadow-xl"
      >
          {/* Header with warm gradient */}
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-amber-50 via-amber-50/50 to-white rounded-t-2xl">
            {/* Close button */}
            {/* <button
              onClick={() => handleClose(false)}
              disabled={isProcessing}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button> */}

            {/* Header - centered */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">☕</span>
              </div>
              <h2 id="social-login-title" className="text-2xl font-bold text-gray-900 mb-1">
                {title}
              </h2>
              <p className="text-gray-500">
                {description}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-4">

            {(error || externalError) && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600 text-center">
                {error || externalError}
              </div>
            )}

            {/* Buttons - Google more prominent */}
            <div className="space-y-3">
              <GoogleSignInButton
                onSuccess={handleSuccess}
                onError={handleError}
                disabled={isProcessing}
              />

              {/* <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <AppleSignInButton
                onSuccess={handleSuccess}
                onError={handleError}
                disabled={isProcessing}
              /> */}
            </div>

            {/* Privacy Note - very subtle */}
            <p className="mt-8 text-[11px] text-gray-400 text-center leading-relaxed px-8">
              By signing in, you agree to our{" "}
              <a href={getTermsOfServicePage()} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-500">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href={getPrivacyPolicyPage()} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-500">
                Privacy Policy
              </a>
            </p>
          </div>
      </div>
    </div>
  );
}
"use client";

import { Inter } from "next/font/google";
import SocialLoginModal from "../SocialLoginModal";
import { SocialUser } from "@/types/auth.types";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

interface LoginScreenProps {
  authError: string | null;
  onLoginSuccess: (socialUser: SocialUser) => void;
  title?: string;
  description?: string;
}

export function LoginScreen({ authError, onLoginSuccess, title = "Creator Dashboard", description = "Sign in to continue" }: LoginScreenProps) {
  return (
    <div className={`${inter.variable} w-full min-h-[100dvh] bg-[#faf8f5]`} style={{ fontFamily: "var(--font-sans)" }}>
      <div className="flex items-center justify-center min-h-[100dvh] px-4">
        <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 pt-8 pb-6 bg-gradient-to-b from-amber-50 to-white text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">☕</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
            <p className="text-gray-500">{description}</p>
          </div>
          <div className="px-6 pb-6 pt-4">
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {authError}
              </div>
            )}
            <SocialLoginModal
              isOpen={true}
              title={title}
              description={description}
              onOpenChange={() => { }}
              onSuccess={onLoginSuccess}
              externalError={authError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

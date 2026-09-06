"use client";

import { useState, useEffect } from "react";
import { SocialUser } from "@/types/auth.types";
import { LoginScreen } from "./LoginScreen";
import { PenpalDashboardScreen } from "./DashboardScreen";
import { getCreatorProfile, AuthCreator } from "@/lib/api";
import { ApiError } from "@/lib/api/impl/base";
import { captureError } from "@/lib/utils/error-handler";
import { BrandVariant } from "@/lib/utils/variant";
import { useAuth } from "@/hooks/useAuth";

interface CreatorDashboardProps {
  variant?: BrandVariant;
}

export default function CreatorDashboard({ variant = "penpal" }: CreatorDashboardProps) {
  const { currentUser, loading, signIn, signOut } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [creator, setCreator] = useState<AuthCreator | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchCreatorProfile = async () => {
    try {
      const response = await getCreatorProfile();
      if (response.body) {
        setCreator(response.body);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          await signOut();
        } else if (err.status === 403 || err.status === 404) {
          setCreator(null);
        } else {
          captureError(err, { action: 'check_creator_status', component: 'CreatorDashboard' });
          setAuthError(err.message || "Failed to check creator status");
        }
      } else {
        captureError(err, { action: 'check_creator_status', component: 'CreatorDashboard' });
      }
    }
    setProfileLoaded(true);
  };

  useEffect(() => {
    if (loading || !currentUser) {
      setProfileLoaded(false);
      setCreator(null);
      return;
    }
    fetchCreatorProfile();
  }, [loading, currentUser, signOut]);

  const handleLoginSuccess = async (socialUser: SocialUser) => {
    try {
      const success = await signIn(socialUser.id_token);
      if (!success) {
        setAuthError("Authentication failed. Please try again.");
      }
    } catch (err) {
      captureError(err, { action: 'login', component: 'CreatorDashboard' });
      setAuthError(err instanceof ApiError ? err.message : "Authentication failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    setAuthError(null);
  };

  // Loading auth or fetching creator profile
  if (loading || (currentUser && !profileLoaded)) {
    return (
      <div className="w-full min-h-[100dvh] bg-[#faf8f5] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!currentUser) {
    return (
      <LoginScreen
        authError={authError}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (!creator) {
    return (
      <div className="w-full min-h-[100dvh] bg-[#faf8f5] flex items-center justify-center px-4">
        <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-xl overflow-hidden text-center">
          <div className="px-6 pt-10 pb-6 bg-gradient-to-b from-amber-50 to-white">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✉️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              This is not the creator account
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Only the Google identity configured for this instance can open creator tools.
            </p>
          </div>
          <div className="px-6 pb-8 pt-4">
            <a
              href="/penpal"
              className="block w-full py-3 px-6 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              Back to Penpal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <PenpalDashboardScreen
      creator={creator}
      onLogout={handleLogout}
    />
  );
}

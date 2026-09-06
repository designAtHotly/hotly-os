"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { exchangeFirebaseToken, fetchMe, logout as serverLogout } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/impl/base";
import { captureError } from "@/lib/utils/error-handler";
import { setSignedInFlag } from "@/lib/utils/token-service";

interface User {
  id: number;
  uuid: string;
  firebase_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  is_creator?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (firebaseIdToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar_url?: string }) => Promise<boolean>;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(email: string, name: string, userId: number, isCreator: boolean): User {
  return {
    id: userId,
    uuid: email,
    firebase_id: "",
    email,
    name,
    is_creator: isCreator,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const me = await fetchMe();
      if (!me) {
        setCurrentUser(null);
        setSignedInFlag(false);
        return false;
      }
      setCurrentUser(toUser(me.email, me.display_name, me.user_id, me.is_creator));
      setSignedInFlag(true);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCurrentUser(null);
        setSignedInFlag(false);
        return false;
      }
      captureError(error, { action: "refresh_auth", component: "useAuth" });
      return false;
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  const signIn = async (firebaseIdToken: string): Promise<boolean> => {
    try {
      const session = await exchangeFirebaseToken(firebaseIdToken);
      setCurrentUser(toUser(session.email, session.display_name, session.user_id, session.is_creator));
      setSignedInFlag(true);
      return true;
    } catch (error) {
      captureError(error, { action: "sign_in", component: "useAuth" });
      return false;
    }
  };

  const signOut = async () => {
    await serverLogout();
    setCurrentUser(null);
    setSignedInFlag(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        signIn,
        signOut,
        updateProfile: async () => true,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

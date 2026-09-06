"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getCreatorProfile, type AuthCreator } from "@/lib/api";

interface CreatorContextType {
  creator: AuthCreator | null;
  loading: boolean;
  updateCreatorData: (next: Partial<AuthCreator>) => void;
}

const CreatorContext = createContext<CreatorContextType | undefined>(undefined);

export function CreatorProvider({ children }: { children: ReactNode }) {
  const [creator, setCreator] = useState<AuthCreator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCreatorProfile()
      .then((res) => setCreator(res.body || null))
      .catch(() => setCreator(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CreatorContext.Provider
      value={{
        creator,
        loading,
        updateCreatorData: (next) => setCreator((prev) => (prev ? { ...prev, ...next } : prev)),
      }}
    >
      {children}
    </CreatorContext.Provider>
  );
}

export function useCreator(): CreatorContextType {
  const ctx = useContext(CreatorContext);
  if (!ctx) {
    throw new Error("useCreator must be used within a CreatorProvider");
  }
  return ctx;
}

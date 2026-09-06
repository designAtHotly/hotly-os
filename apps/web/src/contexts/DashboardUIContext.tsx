"use client";

import { createContext, useContext, useState } from "react";

interface DashboardUIContextValue {
  hideShare: boolean;
  setHideShare: (v: boolean) => void;
}

const DashboardUIContext = createContext<DashboardUIContextValue>({
  hideShare: false,
  setHideShare: () => {},
});

export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [hideShare, setHideShare] = useState(false);
  return (
    <DashboardUIContext.Provider value={{ hideShare, setHideShare }}>
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI() {
  return useContext(DashboardUIContext);
}

"use client";

import CreatorDomeScreen from "@/components/creator/dome/CreatorDomeScreen";
import { CreatorProvider } from "@/hooks/useCreator";
import { DashboardUIProvider } from "@/contexts/DashboardUIContext";

export default function CreatorDomePage() {
  return (
    <CreatorProvider>
      <DashboardUIProvider>
        <CreatorDomeScreen />
      </DashboardUIProvider>
    </CreatorProvider>
  );
}

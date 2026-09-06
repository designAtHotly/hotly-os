"use client";

import { Suspense, useEffect, useState } from "react";

import ChatPage from "@/components/creator/chat/ChatPage";
import { loadPenpalCreator } from "@/lib/penpal/load";
import type { CoffeeCreator, CreatorPricing } from "@/types/coffee.types";

function ChatBody() {
  const [data, setData] = useState<{ creator: CoffeeCreator; pricing: CreatorPricing } | null>(null);

  useEffect(() => {
    loadPenpalCreator()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center">
        <div className="animate-pulse text-4xl">✉️</div>
      </div>
    );
  }

  return <ChatPage creator={data.creator} pricing={data.pricing} />;
}

export default function ChatRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center">
          <div className="animate-pulse text-4xl">✉️</div>
        </div>
      }
    >
      <ChatBody />
    </Suspense>
  );
}

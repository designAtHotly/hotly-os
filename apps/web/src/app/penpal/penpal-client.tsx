"use client";

import { Suspense, useEffect, useState } from "react";

import CoffeePageImpl from "@/components/creator/CoffeePageImpl";
import { loadPenpalCreator } from "@/lib/penpal/load";
import type { CoffeeCreator, CreatorPricing } from "@/types/coffee.types";

function PenpalBody() {
  const [data, setData] = useState<{
    creator: CoffeeCreator;
    pricing: CreatorPricing;
    stripeConfigured: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPenpalCreator()
      .then(setData)
      .catch(() => setError("Could not load this Penpal page."));
  }, []);

  if (error) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-gray-500">{error}</div>;
  }
  if (!data) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center">
        <div className="animate-pulse text-4xl">☕</div>
      </div>
    );
  }

  return (
    <CoffeePageImpl
      creator={data.creator}
      pricing={data.pricing}
      hasCommunity
      stripeConfigured={data.stripeConfigured}
    />
  );
}

export default function PenpalClient() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center">
          <div className="animate-pulse text-4xl">☕</div>
        </div>
      }
    >
      <PenpalBody />
    </Suspense>
  );
}

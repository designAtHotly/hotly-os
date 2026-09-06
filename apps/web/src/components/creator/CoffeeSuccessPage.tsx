"use client";

import { useSearchParams } from "next/navigation";
import { Inter } from "next/font/google";
import CoffeeSuccessView from "./CoffeeSuccessView";
import { getCheckoutToken } from "@/lib/api";
import {
  CoffeeCreator,
} from "@/types/coffee.types";
import { BrandVariant, DEFAULT_VARIANT, getVariantColorTheme } from "@/lib/utils/variant";
import { getCreatorVariantPage, getCreatorChatPage } from "@/lib/utils/page-helper";
import { captureError } from "@/lib/utils/error-handler";
import { ApiError } from "@/lib/api/impl/base";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

interface CoffeeSuccessPageProps {
  creator: CoffeeCreator;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CoffeeSuccessPage({
  creator,
}: CoffeeSuccessPageProps) {
  const searchParams = useSearchParams();
  const successAmount = searchParams.get("amount");
  const isRecurringSuccess = searchParams.get("recurring") === "true";
  const successCurrency = searchParams.get("currency");
  const productName = searchParams.get("product_name");

  const variant = (creator?.variant as BrandVariant) || DEFAULT_VARIANT;
  const colorTheme = getVariantColorTheme(variant);

  const handleSendAnother = () => {
    window.location.href = getCreatorVariantPage(creator.username, variant);
  };

  const handleGoToChat = async () => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      alert("Payment is still confirming. Refresh this page in a moment.");
      return;
    }

    for (let i = 0; i < 15; i++) {
      try {
        await getCheckoutToken(sessionId);
        window.location.href = getCreatorChatPage(creator.username);
        return;
      } catch (error) {
        captureError(error);
        if (error instanceof ApiError && error.status === 409) {
          await wait(1000);
          continue;
        }
        break;
      }
    }
    alert("Payment is still confirming. Refresh this page in a moment.");
  };

  const parsedAmount = successAmount ? parseInt(successAmount) : NaN;
  const displayAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

  return (
    <div
      className={`${inter.variable} w-full h-[100dvh] flex items-center justify-center p-0 md:p-5 relative overflow-hidden`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: colorTheme.ambientBg }} />
      <div className={`absolute inset-0 bg-gradient-to-b ${colorTheme.ambientGradient}`} />

      <div className={`relative w-full overflow-hidden max-w-[480px] h-full md:h-auto md:min-h-0 flex flex-col md:rounded-[32px] ${colorTheme.cardBg}`}>
        <CoffeeSuccessView
          creator={creator}
          amount={displayAmount}
          currency={successCurrency}
          isRecurring={isRecurringSuccess}
          onSendAnother={handleSendAnother}
          onGoToChat={handleGoToChat}
          productName={productName || undefined}
          variant={variant}
        />
      </div>
    </div>
  );
}

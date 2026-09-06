import type { Metadata } from "next";

import DomePromptClient from "./dome-prompt-client";
import { domeMetadata } from "@/lib/seo";
import { loadSeoDomePrompt, loadSeoPenpal } from "@/lib/seo-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ promptSlug: string }>;
}): Promise<Metadata> {
  const { promptSlug } = await params;
  const [offer, prompt] = await Promise.all([loadSeoPenpal(), loadSeoDomePrompt(promptSlug)]);
  return domeMetadata(offer, prompt?.content, `/dome/${promptSlug}`);
}

export default function DomePromptRoute() {
  return <DomePromptClient />;
}

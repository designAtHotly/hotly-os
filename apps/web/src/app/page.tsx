import type { Metadata } from "next";

import PenpalClient from "./penpal/penpal-client";
import { penpalMetadata } from "@/lib/seo";
import { loadSeoPenpal } from "@/lib/seo-data";

export async function generateMetadata(): Promise<Metadata> {
  const offer = await loadSeoPenpal();
  return penpalMetadata(offer);
}

export default function Home() {
  return <PenpalClient />;
}

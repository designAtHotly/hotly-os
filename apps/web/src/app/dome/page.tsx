import type { Metadata } from "next";

import DomeClient from "./dome-client";
import { domeMetadata } from "@/lib/seo";
import { loadSeoPenpal } from "@/lib/seo-data";

export async function generateMetadata(): Promise<Metadata> {
  const offer = await loadSeoPenpal();
  return domeMetadata(offer, undefined, "/dome");
}

export default function DomeRoute() {
  return <DomeClient />;
}

import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

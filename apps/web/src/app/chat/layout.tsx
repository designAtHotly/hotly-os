import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}

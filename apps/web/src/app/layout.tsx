import type { Metadata, Viewport } from "next";
import { Inter, Spectral } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { chromeMetadata } from "@/lib/seo";
import { publicAppUrl } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-spectral",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#2a2318",
};

export function generateMetadata(): Metadata {
  const origin = publicAppUrl();
  return {
    metadataBase: new URL(origin),
    applicationName: "Hotly",
    title: {
      default: "Hotly",
      template: "%s · Hotly",
    },
    description: "A tip jar that writes back.",
    openGraph: {
      type: "website",
      siteName: "Hotly",
      url: origin,
    },
    ...chromeMetadata(),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spectral.variable}`}>
      <body className="min-h-svh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


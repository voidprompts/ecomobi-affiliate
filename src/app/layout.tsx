/******************************************************************************
 * ROOT LAYOUT
 * File: src/app/layout.tsx
 *
 * Defines the document shell, the default metadata (metadataBase resolves
 * relative OpenGraph/canonical URLs — it auto-detects the Vercel production
 * domain with zero configuration) and the html/body semantic roots.
 ******************************************************************************/

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const DEFAULT_TITLE = "Ecomobi Affiliate Dashboard — Shopee, Lazada & TikTok Shop PH";
const DEFAULT_DESCRIPTION =
  "Search, compare, and generate tracked affiliate links for Shopee, Lazada, and TikTok Shop items instantly";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · Ecomobi Affiliate Dashboard",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "Ecomobi Affiliate Dashboard",
  keywords: [
    "ecomobi",
    "affiliate dashboard",
    "shopee affiliate",
    "lazada affiliate",
    "tiktok shop affiliate",
    "sub-id tracking",
    "philippines",
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PH" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

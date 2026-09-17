/******************************************************************************
 * PAGE SHELL — SERVER COMPONENT (SEO CORE)
 * File: src/app/page.tsx
 *
 * This is a React SERVER component (no "use client"): Next.js pre-renders the
 * entire shell into static HTML at build time (○ SSG), which is the fastest
 * possible delivery for crawlers and mobile users — the HTML arrives fully
 * formed from the CDN with zero execution cost for the content sections.
 *
 * WHAT LIVES HERE (crawler-critical, zero-JavaScript content):
 *   • Programmatic Metadata API export — title, meta description, canonical,
 *     OpenGraph, Twitter cards and robots directives.
 *   • Semantic HTML5 outline: <header> → <main> → <section> → <article> →
 *     <footer>, with a single keyword-rich <h1> and a strict h2/h3 cascade.
 *   • The keyword hero, the interactive search island, the pre-rendered
 *     "Trending Products in the Philippines" grid, and a "How it works"
 *     section — all indexable without executing JavaScript.
 *   • JSON-LD structured data: WebSite + SearchAction.
 *
 * The only hydrated part of the page is <SearchDashboard /> (client island).
 ******************************************************************************/

import type { Metadata } from "next";
import SearchDashboard from "@/components/SearchDashboard";
import LinkGenerator from "@/components/LinkGenerator";
import TrendingSection from "@/components/TrendingSection";
import { BoltIcon, LinkIcon, SearchIcon, SparkIcon, TagIcon } from "@/components/ui";
import { SITE_URL } from "@/lib/site";

/* ══════════════════════════════════════════════════════════════════════════
 * 1. PROGRAMMATIC METADATA — Next.js Metadata API
 * ════════════════════════════════════════════════════════════════════════ */

const SEO_TITLE = "Affiliate Product Search — Shopee, Lazada & TikTok Shop PH";
const SEO_DESCRIPTION =
  "Search, compare, and generate tracked affiliate links for Shopee, Lazada, and TikTok Shop items instantly";
const OG_IMAGE_ALT =
  "Ecomobi Affiliate Dashboard — search Shopee, Lazada and TikTok Shop and generate tracked affiliate links.";

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  keywords: [
    "shopee affiliate links",
    "lazada affiliate program",
    "tiktok shop affiliate",
    "ecomobi",
    "affiliate dashboard philippines",
    "product price comparison philippines",
    "sub-id tracking",
  ],
  category: "affiliate marketing",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Ecomobi Affiliate Dashboard",
    title: "Ecomobi Affiliate Dashboard — Search Shopee, Lazada & TikTok Shop PH",
    description: SEO_DESCRIPTION,
    locale: "en_PH",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * 2. STRUCTURED DATA — WebSite + SearchAction (sitelinks searchbox)
 * ════════════════════════════════════════════════════════════════════════ */

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ecomobi Affiliate Dashboard",
  url: SITE_URL,
  description: SEO_DESCRIPTION,
  inLanguage: "en-PH",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?keyword={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * 3. HOW IT WORKS — static, keyword-rich explainer for crawlers
 * ════════════════════════════════════════════════════════════════════════ */

const WORKFLOW_STEPS = [
  {
    step: "01",
    icon: "search",
    title: "Search & open real results",
    text: "Type any keyword and tap Shopee or Lazada — the dashboard opens the store's live search results with your Ecomobi affiliate tracking already attached to the click.",
  },
  {
    step: "02",
    icon: "tag",
    title: "Pick a product, tag your channel",
    text: "Choose a product in the store, copy its link, and paste it into the Instant Link Generator with your Sub-ID channel label — fb-reels, tiktok-bio, youtube-07.",
  },
  {
    step: "03",
    icon: "bolt",
    title: "Share and earn commissions",
    text: "Share your tracked link anywhere. Shoppers land on the product with your publisher tracking attached, and every order is credited in your Ecomobi reports.",
  },
] as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 4. PAGE — semantic HTML5 shell
 * ════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Structured data: WebSite + SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Ambient background (decorative, hidden from assistive tech) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.20),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_95%_100%,rgba(217,70,239,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_35%_30%_at_0%_80%,rgba(56,189,248,0.07),transparent)]" />
      </div>

      {/* ── Site header (banner landmark) ─────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="Ecomobi Affiliate Dashboard — home"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-glow">
              <LinkIcon className="h-5 w-5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-white sm:text-base">
                Ecomobi Affiliate Dashboard
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                Shopee · Lazada · TikTok Shop — Philippines
              </span>
            </span>
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            <a
              href="#search"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Search
            </a>
            <a
              href="#generator"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Link Generator
            </a>
            <a
              href="#trending"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Trending
            </a>
            <a
              href="#how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              How it works
            </a>
          </nav>
        </div>
      </header>

      {/* ── Main content (main landmark) ──────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {/* Hero — the single h1 of the page, keyword-rich for crawlers */}
        <section aria-labelledby="hero-heading" className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-400/30">
            <SparkIcon className="h-3.5 w-3.5" />
            Powered by the Ecomobi Publisher API
          </p>
          <h1
            id="hero-heading"
            className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-tight"
          >
            Search, compare &amp; monetize products from{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Shopee, Lazada &amp; TikTok Shop
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
            Instantly generate Sub-ID-tracked Ecomobi affiliate links for millions of
            products in the Philippines — compare prices, commissions and ratings
            before you share.
          </p>
          <ul
            className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
            aria-label="Supported marketplaces"
          >
            <li className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-[#EE4D2D]" aria-hidden="true" />
              Shopee
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />
              Lazada
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
              TikTok Shop
            </li>
          </ul>
        </section>

        {/* Interactive search island (client component, hydrated on load) */}
        <SearchDashboard />

        {/* Instant link generator — the real Ecomobi Dynamic Link pipeline */}
        <section
          id="generator"
          aria-labelledby="generator-heading"
          className="scroll-mt-20 pt-12 sm:pt-16"
        >
          <header className="mb-5 max-w-2xl">
            <h2
              id="generator-heading"
              className="text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              Instant affiliate link generator
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Paste any product URL from an approved store — Shopee PH, Lazada PH and your
              other Ecomobi campaigns — and get a ready-to-share tracked affiliate link
              through the Ecomobi Dynamic Link service, tagged to your chosen Sub-ID
              channel.
            </p>
          </header>
          <LinkGenerator />
        </section>

        {/* Pre-rendered trending products — fully crawlable, zero-JS grid */}
        <TrendingSection />

        {/* How it works — semantic explainer with the h2/h3 cascade */}
        <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 pt-12 sm:pt-16">
          <header className="max-w-2xl">
            <h2 id="how-heading" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              How affiliate link tracking works
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Turn any Shopee, Lazada or TikTok Shop listing into a commission-earning
              Ecomobi affiliate link in three steps.
            </p>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {WORKFLOW_STEPS.map((item) => (
              <article
                key={item.step}
                className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-white/10"
              >
                <p className="flex items-center gap-2.5 font-mono text-xs font-bold text-indigo-400">
                  {item.step}
                  {item.icon === "search" && <SearchIcon className="h-4 w-4" />}
                  {item.icon === "tag" && <TagIcon className="h-4 w-4" />}
                  {item.icon === "bolt" && <BoltIcon className="h-4 w-4" />}
                </p>
                <h3 className="mt-2.5 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-400">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ── Site footer (contentinfo landmark) ────────────────────────── */}
      <footer className="mt-6 border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
            <a href="#search" className="transition hover:text-white">
              Product search
            </a>
            <a href="#generator" className="transition hover:text-white">
              Link generator
            </a>
            <a href="#trending" className="transition hover:text-white">
              Trending products
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              How it works
            </a>
            <a href="/sitemap.xml" className="transition hover:text-white">
              Sitemap
            </a>
          </nav>
          <p className="text-[11px] leading-5 text-slate-500">
            © {new Date().getFullYear()} Ecomobi Affiliate Dashboard · Built with Next.js 14
            App Router &amp; Tailwind CSS · Powered by the Ecomobi Publisher API.
          </p>
          <p className="max-w-2xl text-[11px] leading-5 text-slate-600">
            Shopee, Lazada and TikTok Shop are trademarks of their respective owners.
            Outbound deal links are Ecomobi-tracked affiliate links (rel=&quot;sponsored&quot;)
            that may earn us a commission. Prices and availability are subject to change
            on the marketplace.
          </p>
        </div>
      </footer>
    </div>
  );
}

/******************************************************************************
 * TRENDING PRODUCTS SECTION — STATIC, CRAWLABLE, ZERO-JAVASCRIPT
 * File: src/components/TrendingSection.tsx
 *
 * A pure React SERVER component (no "use client", no hooks, no event
 * handlers). Next.js bakes this section into the pre-rendered HTML at build
 * time, so web crawlers (Googlebot, Bingbot, social link expanders) instantly
 * index:
 *
 *   • the "Trending Products in the Philippines" heading and copy,
 *   • every product <article> — title, price, store, rating, sales, platform,
 *   • descriptive alt text on every product image,
 *   • the outbound Ecomobi affiliate links (marked rel="sponsored", exactly
 *     how Google asks affiliate outbound links to be annotated),
 *   • an ItemList JSON-LD structured-data block describing the grid.
 *
 * Because nothing here hydrates, it adds ZERO kilobytes to the client bundle
 * and keeps LCP/FCP at their floor for mobile users in the Philippines.
 ******************************************************************************/

import type { Product } from "@/lib/types";
import {
  DEFAULT_TRENDING_SUB_ID,
  TRENDING_PRODUCTS,
} from "@/lib/trending-products";
import {
  PLATFORM_LABELS,
  buildAffiliateLink,
  discountPercent,
  formatPrice,
  formatSold,
} from "@/lib/format";
import { ExternalIcon, PlatformBadge, StarIcon, StoreIcon } from "./ui";

/** schema.org ItemList describing the trending grid for rich results. */
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Trending Products in the Philippines",
  description:
    "Most-shared Shopee, Lazada and TikTok Shop deals in the Philippines with Ecomobi tracked affiliate links.",
  numberOfItems: TRENDING_PRODUCTS.length,
  itemListElement: TRENDING_PRODUCTS.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: product.title,
    url: buildAffiliateLink(product.product_url, DEFAULT_TRENDING_SUB_ID),
  })),
};

function TrendingCard({ product, index }: { product: Product; index: number }) {
  const href = buildAffiliateLink(product.product_url, DEFAULT_TRENDING_SUB_ID);
  const discount = discountPercent(product.price, product.original_price);
  const label = PLATFORM_LABELS[product.platform];
  const ctaLabel = label === "Partner Store" ? "View Deal" : `View Deal on ${label}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/70 shadow-card ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-white/25">
      <div className="relative aspect-square overflow-hidden bg-slate-800/80">
        {/* eslint-disable-next-line @next/next/no-img-element -- build-time local assets; next/image adds optimization overhead without benefit for co-located SVGs. */}
        <img
          src={product.image_url}
          alt={`${product.title} — ${label} product photo`}
          width={600}
          height={600}
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <PlatformBadge platform={product.platform} className="absolute left-2.5 top-2.5" />
        {product.commission_rate !== null && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur">
            up to {product.commission_rate}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-5 text-slate-100 sm:text-sm">
          <a
            href={href}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="transition hover:text-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {product.title}
          </a>
        </h3>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {product.price !== null ? (
            <span className="text-base font-bold tracking-tight text-white sm:text-lg">
              {formatPrice(product.price, product.currency)}
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-400">Price unavailable</span>
          )}
          {product.original_price !== null && (
            <span className="text-[11px] text-slate-500 line-through">
              {formatPrice(product.original_price, product.currency)}
            </span>
          )}
          {discount !== null && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              -{discount}%
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex min-w-0 items-center gap-1">
            <StoreIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{product.store_name}</span>
          </span>
          {(product.rating !== null || product.sold !== null) && (
            <span className="flex shrink-0 items-center gap-1">
              {product.rating !== null && (
                <>
                  <StarIcon className="h-3.5 w-3.5 text-amber-400" />
                  {product.rating.toFixed(1)}
                </>
              )}
              {product.sold !== null && (
                <span className="text-slate-500">· {formatSold(product.sold)} sold</span>
              )}
            </span>
          )}
        </div>

        <a
          href={href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 active:scale-[0.98] sm:text-sm"
        >
          {ctaLabel}
          <ExternalIcon className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

export default function TrendingSection() {
  return (
    <section
      id="trending"
      aria-labelledby="trending-heading"
      className="scroll-mt-20 pt-10 sm:pt-14"
    >
      {/* Structured data for the trending grid (rich results / programmatic SEO). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="mb-5 flex flex-col gap-1">
        <h2
          id="trending-heading"
          className="text-xl font-bold tracking-tight text-white sm:text-2xl"
        >
          Trending Products in the Philippines
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          The most-shared deals across{" "}
          <strong className="font-semibold text-slate-300">Shopee</strong>,{" "}
          <strong className="font-semibold text-slate-300">Lazada</strong> and{" "}
          <strong className="font-semibold text-slate-300">TikTok Shop</strong> —
          hand-picked for the PH market and pre-rendered so search engines can index
          every price, store and commission rate instantly.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
        {TRENDING_PRODUCTS.map((product, index) => (
          <TrendingCard key={product.id} product={product} index={index} />
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Deal links open the merchant listing through the Ecomobi tracking pipeline and
        are tagged with the{" "}
        <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-400">
          web-trending
        </code>{" "}
        Sub-ID channel. Prices and availability are subject to change on the
        marketplace.
      </p>
    </section>
  );
}

/******************************************************************************
 * MARKETPLACE DEFINITIONS — TRACKED DEEP SEARCH
 * File: src/lib/marketplaces.ts
 *
 * Ecomobi's public API exposes no product catalog, and the marketplaces block
 * product-listing requests from server/datacenter IPs (Shopee's search API
 * answers 403; Lazada serves a JS shell). The production-correct pattern is
 * therefore TRACKED DEEP SEARCH:
 *
 *   1. The affiliate searches a keyword in this dashboard.
 *   2. One tracked click (through /api/go → goeco.mobi, verified live) opens
 *      the REAL marketplace search results for that keyword — dropping the
 *      publisher's affiliate cookie (7–15 day windows) on the store domain.
 *   3. The affiliate picks any product, copies its URL, and generates their
 *      tracked link in the Instant Link Generator.
 *
 * Commission rates below mirror the live campaign values from
 * /api/v3/advertisers for this publisher's account (Shopee PH 3.2%,
 * Lazada PH 9.6%); TikTok Shop's campaign exists but is not currently
 * active for dynamic links (err_code: campaign_not_running).
 ******************************************************************************/

import type { Platform } from "./types";

export interface MarketplaceDef {
  /** Matches the Product platform tag for consistent branding. */
  id: Platform;
  /** Display name. */
  name: string;
  /** Live campaign commission label (null when unknown/not active). */
  commission: string | null;
  /** Builds the marketplace's on-site search URL for a keyword. */
  searchUrl: (keyword: string) => string;
  /** Whether dynamic links currently work for this store. */
  enabled: boolean;
  /** Shown when disabled. */
  disabledNote?: string;
  /** Tailwind classes for the deep-search button. */
  buttonClass: string;
}

export const MARKETPLACES: MarketplaceDef[] = [
  {
    id: "shopee",
    name: "Shopee PH",
    commission: "3.2%",
    enabled: true,
    searchUrl: (keyword) =>
      `https://shopee.ph/search?keyword=${encodeURIComponent(keyword)}`,
    buttonClass:
      "bg-[#EE4D2D] text-white shadow-lg shadow-[#EE4D2D]/25 hover:bg-[#d53f22]",
  },
  {
    id: "lazada",
    name: "Lazada PH",
    commission: "9.6%",
    enabled: true,
    searchUrl: (keyword) =>
      `https://www.lazada.com.ph/catalog/?q=${encodeURIComponent(keyword)}`,
    buttonClass:
      "bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/25 hover:bg-[#1d4ed8]",
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    commission: null,
    enabled: false,
    disabledNote:
      "Your TikTok Shop campaign isn't active for dynamic links yet — it turns on automatically the moment Ecomobi enables it.",
    searchUrl: (keyword) =>
      `https://shop.tiktok.com/search?q=${encodeURIComponent(keyword)}`,
    buttonClass: "bg-white/10 text-slate-400 ring-1 ring-white/10",
  },
];

/** Fallback channel Sub-ID when the affiliate hasn't set one. */
export const DEFAULT_SEARCH_CHANNEL = "web-search";

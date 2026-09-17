/******************************************************************************
 * SHARED FORMATTING & LINK UTILITIES
 * File: src/lib/format.ts
 *
 * Pure, dependency-free helpers shared by the server-rendered trending
 * section and the client dashboard. Because they are plain functions, the
 * server components pay zero JavaScript cost while the client bundles only
 * the few kilobytes it actually imports.
 ******************************************************************************/

import type { Platform } from "./types";

/* ── Affiliate tracking pipeline ─────────────────────────────────────── */

/** Query parameter Ecomobi uses for channel-level Sub-ID attribution. */
export const SUB_ID_PARAM = "sub_id";

export const SUB_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export const SUB_ID_ERROR_TEXT =
  "Sub-ID may only contain letters, numbers, dots, dashes and underscores (max 64 characters).";

/** Validate a Sub-ID channel label; returns an error message or null. */
export function validateSubId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return SUB_ID_PATTERN.test(trimmed) ? null : SUB_ID_ERROR_TEXT;
}

/**
 * Append (or replace) the Sub-ID on an Ecomobi tracking link.
 * Uses the URL API so existing campaign parameters are preserved exactly.
 */
export function buildAffiliateLink(productUrl: string, subId: string | null): string {
  if (!productUrl) return "";
  const value = (subId ?? "").trim();
  try {
    const url = new URL(productUrl);
    if (value) url.searchParams.set(SUB_ID_PARAM, value);
    else url.searchParams.delete(SUB_ID_PARAM);
    return url.toString();
  } catch {
    // Extremely defensive path for malformed upstream links.
    if (!value) return productUrl;
    const separator = productUrl.includes("?") ? "&" : "?";
    return `${productUrl}${separator}${SUB_ID_PARAM}=${encodeURIComponent(value)}`;
  }
}

/* ── Platform presentation ───────────────────────────────────────────── */

export const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  other: "Partner Store",
};

/** Tailwind classes behind the platform-specific tag colors. */
export const PLATFORM_META: Record<Platform, { label: string; badgeClass: string }> = {
  shopee: {
    label: "Shopee",
    badgeClass: "bg-[#EE4D2D]/15 text-[#FF8A5F] ring-[#EE4D2D]/40", // Orange — Shopee
  },
  lazada: {
    label: "Lazada",
    badgeClass: "bg-[#2563EB]/15 text-[#6FA8FF] ring-[#2563EB]/40", // Blue — Lazada
  },
  tiktok: {
    label: "TikTok Shop",
    badgeClass: "bg-white/10 text-white ring-white/25", // Monochrome — TikTok Shop
  },
  other: {
    label: "Partner Store",
    badgeClass: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  },
};

/* ── Price / number formatting ───────────────────────────────────────── */

const CURRENCY_FALLBACK = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "₱";

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  VND: "₫",
  THB: "฿",
  MYR: "RM",
  IDR: "Rp",
  SGD: "S$",
  TWD: "NT$",
};

export function currencySymbol(currency: string | null): string {
  if (!currency) return CURRENCY_FALLBACK;
  const trimmed = currency.trim();
  if (!trimmed) return CURRENCY_FALLBACK;
  const symbol = CURRENCY_SYMBOLS[trimmed.toUpperCase()];
  return symbol ?? trimmed;
}

export function formatPrice(price: number, currency: string | null): string {
  const decimals = Number.isInteger(price) ? 0 : 2;
  const formatted = price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currencySymbol(currency)}${formatted}`;
}

export function formatSold(sold: number): string {
  if (sold >= 1000) {
    const thousands = sold / 1000;
    const rounded =
      thousands >= 10 || Number.isInteger(thousands)
        ? Math.round(thousands)
        : Number(thousands.toFixed(1));
    return `${rounded}k`;
  }
  return String(sold);
}

export function discountPercent(
  price: number | null,
  original: number | null,
): number | null {
  if (price === null || original === null || original <= price || price <= 0) return null;
  return Math.round((1 - price / original) * 100);
}

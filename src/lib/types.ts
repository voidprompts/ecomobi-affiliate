/******************************************************************************
 * SHARED PRODUCT CONTRACT
 * File: src/lib/types.ts
 *
 * The single source of truth for the product schema used by:
 *   • the API route  (src/app/api/search/route.ts — response building)
 *   • server components (src/components/TrendingSection.tsx — pre-rendered HTML)
 *   • the client dashboard (src/components/SearchDashboard.tsx — live results)
 *
 * Keeping the contract in a dependency-free module means the server shell
 * never pulls client code into the bundle (Core Web Vitals) while every layer
 * stays type-safe against the same shape.
 ******************************************************************************/

/** Marketplace a product belongs to, detected from the Ecomobi payload. */
export type Platform = "shopee" | "lazada" | "tiktok" | "other";

/** Uniform product shape returned by /api/search and rendered by the UI. */
export interface Product {
  /** Stable unique id (upstream id, or a deterministic hash fallback). */
  id: string;
  /** Product title (also used as the descriptive image `alt` text). */
  title: string;
  /** Current selling price in the market's currency, or null if unknown. */
  price: number | null;
  /** Original/list price before discount, or null. */
  original_price: number | null;
  /** Currency code/symbol if the upstream payload provides one ("PHP", "₱"...). */
  currency: string | null;
  /** Store / merchant name (e.g. "Shopee · Xiaomi Official Store"). */
  store_name: string;
  /** Detected marketplace. */
  platform: Platform;
  /** Primary product thumbnail (absolute URL, or "" when unavailable). */
  image_url: string;
  /** The primary Ecomobi product reference link (tracking-ready). */
  product_url: string;
  /** Commission percentage (e.g. 4.5 = 4.5%), or null. */
  commission_rate: number | null;
  /** Average rating 0–5, or null. */
  rating: number | null;
  /** Historical units sold, or null. */
  sold: number | null;
}

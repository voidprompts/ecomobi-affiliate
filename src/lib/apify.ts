/******************************************************************************
 * APIFY MARKETPLACE SEARCH PROVIDER — REAL IN-SITE PRODUCT RESULTS
 * File: src/lib/apify.ts
 *
 * Powered by actors from the ecommerce-intelligence-apis catalog
 * (github.com/cporter202/ecommerce-intelligence-apis — a curated directory
 * of Apify/CoreClaw ecommerce actors). This module turns the dashboard's
 * search into REAL marketplace product grids rendered inside the site —
 * no external prompting — while "Generate Link" converts each real product
 * URL into an Ecomobi tracked affiliate link (goeco.mobi).
 *
 * VERIFIED DEFAULT ACTOR CONTRACT (gio21/shopee-scraper — 46k+ runs, PH):
 *   input : { keywords: ["…"], country: "PH", maxItems: 40 }
 *   output: [{ itemId, shopId, name, price, currency, originalPrice,
 *              discountPercent, rating, reviewCount, historicalSoldEstimated,
 *              shopName, location, images: [url], url }]
 *
 * IMPORTANT — Apify free plan: some actors (including the default Shopee
 * actor) return clearly-labelled MOCK records ({"_mock": true}) on free
 * plans; live data requires a paid Apify plan. Mock records are filtered
 * out here and surfaced as an actionable notice instead of fake results.
 *
 * ENVIRONMENT VARIABLES (all optional — provider activates with APIFY_TOKEN):
 *   APIFY_TOKEN             Apify API token (console.apify.com → Settings →
 *                           API & Integration). Activates live search.
 *   APIFY_SHOPEE_ACTOR      Default: gio21/shopee-scraper
 *   APIFY_LAZADA_ACTOR      Default: fatihtahta/lazada-scraper
 *   APIFY_COUNTRY           Default: PH (marketplace country code)
 *   APIFY_INPUT_TEMPLATE    Optional JSON template with {keyword}/{limit}
 *                           placeholders overriding the built-in input
 *                           builder — use it when your actor expects
 *                           different field names (see the actor's Input tab
 *                           on Apify).
 ******************************************************************************/

import type { Product, Platform } from "./types";

/* ── Configuration ──────────────────────────────────────────────────── */

const APIFY_TOKEN = (process.env.APIFY_TOKEN ?? "").trim();
const APIFY_BASE = (process.env.APIFY_BASE_URL ?? "https://api.apify.com")
  .trim()
  .replace(/\/+$/, "");
const SHOPEE_ACTOR = (process.env.APIFY_SHOPEE_ACTOR ?? "gio21/shopee-scraper").trim();
const LAZADA_ACTOR = (process.env.APIFY_LAZADA_ACTOR ?? "fatihtahta/lazada-scraper").trim();
const COUNTRY = (process.env.APIFY_COUNTRY ?? "PH").trim().toUpperCase();

/** Apify run-sync budget (seconds, query param) + local abort (ms). */
const RUN_TIMEOUT_SEC = 30;
const ABORT_TIMEOUT_MS = 34_000;

/** Cache completed searches for this long to conserve Apify credits. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

export function isApifyConfigured(): boolean {
  return APIFY_TOKEN !== "";
}

/* ── Input builders (per-actor + generic + template override) ───────── */

type InputBuilder = (keyword: string, limit: number) => Record<string, unknown>;

const ACTOR_INPUT_BUILDERS: Record<string, InputBuilder> = {
  // Verified contract: keywords array + country + maxItems.
  "gio21/shopee-scraper": (keyword, limit) => ({
    keywords: [keyword],
    country: COUNTRY,
    maxItems: limit,
  }),
};

const GENERIC_INPUT_BUILDER: InputBuilder = (keyword, limit) => ({
  keyword,
  query: keyword,
  limit,
  maxItems: limit,
});

function buildActorInput(actor: string, keyword: string, limit: number): Record<string, unknown> {
  const template = process.env.APIFY_INPUT_TEMPLATE?.trim();
  if (template) {
    try {
      const parsed = JSON.parse(template);
      const resolve = (value: unknown): unknown =>
        typeof value === "string"
          ? value
              .replaceAll("{keyword}", keyword)
              .replaceAll("{limit}", String(limit))
          : Array.isArray(value)
            ? value.map(resolve)
            : value !== null && typeof value === "object"
              ? Object.fromEntries(
                  Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolve(v)]),
                )
              : value;
      return resolve(parsed) as Record<string, unknown>;
    } catch {
      // Invalid template JSON — fall through to the built-in builders.
    }
  }
  const builder = ACTOR_INPUT_BUILDERS[actor] ?? GENERIC_INPUT_BUILDER;
  return builder(keyword, limit);
}

/* ── Result shape ───────────────────────────────────────────────────── */

export interface MarketplaceSearchResult {
  /** Normalized real products (mock records excluded). */
  products: Product[];
  /** True when the actor(s) answered but ONLY with mock (free-plan) data. */
  mockOnly: boolean;
  /** Non-fatal problems per actor (logged + folded into the notice). */
  warnings: string[];
}

/* ── Normalization — actor output → Product schema ──────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Parse sold-volume brackets like "5k+", "1m+", "<100" into approximations. */
function parseSoldBracket(value: unknown): number | null {
  const raw = str(value);
  if (raw === null) return null;
  const match = raw.match(/^<?\s*([\d.]+)\s*([kmb])?\s*\+?$/i);
  if (match === null) {
    const plain = num(raw);
    return plain !== null && plain >= 0 ? Math.round(plain) : null;
  }
  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;
  const mult = (match[2] ?? "").toLowerCase();
  const factor = mult === "k" ? 1_000 : mult === "m" ? 1_000_000 : mult === "b" ? 1_000_000_000 : 1;
  return Math.round(base * factor);
}

function toMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function firstImage(item: Record<string, unknown>): string {
  for (const key of ["images", "image_urls", "imageUrls", "photos"]) {
    const value = item[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const url = typeof entry === "string" ? entry : isRecord(entry) ? str(entry.url ?? entry.src) : null;
        if (url && /^https?:\/\//i.test(url)) return url;
      }
    }
  }
  for (const key of ["image", "imageUrl", "image_url", "thumbnail", "thumb", "picture"]) {
    const url = str(item[key]);
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return "";
}

function detectPlatform(url: string, fallbackHint: string): Platform {
  const haystack = `${url} ${fallbackHint}`.toLowerCase();
  if (haystack.includes("shopee")) return "shopee";
  if (haystack.includes("lazada")) return "lazada";
  if (haystack.includes("tiktok")) return "tiktok";
  return "other";
}

function normalizeActorItem(item: Record<string, unknown>, actorHint: string): Product | null {
  // Skip the default actor's free-plan mock records (handled by the caller
  // for the notice) — real records only.
  if (item._mock === true) return null;

  const title = str(item.name ?? item.title ?? item.product_name ?? item.productName);
  if (title === null) return null;

  // Product URL: direct url/itemUrl fields, or build from Shopee ids.
  let url = str(item.url ?? item.itemUrl ?? item.link ?? item.productUrl ?? item.product_url) ?? "";
  const itemId = str(item.itemId ?? item.itemid ?? item.item_id);
  const shopId = str(item.shopId ?? item.shopid ?? item.shop_id);
  if (url === "" && itemId !== null && shopId !== null) {
    url = `https://shopee.ph/product/${shopId}/${itemId}`;
  }
  if (url === "") return null; // nothing to track → useless for affiliate flow

  const platform = detectPlatform(url, actorHint);
  const price = toMoney(num(item.price ?? item.priceMin ?? item.productPrice ?? item.salePrice));
  const original = toMoney(num(item.originalPrice ?? item.original_price ?? item.priceMax ?? item.listPrice));
  const rating = num(item.rating ?? item.ratingScore ?? item.rating_star ?? item.stars);
  const sold = parseSoldBracket(
    item.historicalSoldEstimated ?? item.historical_sold ?? item.sold ?? item.soldCount,
  );
  const shopName =
    str(item.shopName ?? item.sellerName ?? item.seller_name ?? item.shop_name ?? item.seller) ??
    (platform === "shopee" ? "Shopee Store" : platform === "lazada" ? "Lazada Store" : "Store");
  const currency = str(item.currency ?? item.currencyCode);
  const id = str(item.itemId ?? item.itemid ?? item.id ?? item.productId) ?? `${platform}-${url.slice(-42)}`;

  return {
    id,
    title: title.length > 300 ? `${title.slice(0, 300).trimEnd()}…` : title,
    price,
    original_price: original !== null && price !== null && original > price ? original : null,
    currency,
    store_name: shopName,
    platform,
    image_url: firstImage(item),
    product_url: url,
    commission_rate: null,
    rating: rating !== null && rating >= 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
    sold,
  };
}

/* ── Actor runner ───────────────────────────────────────────────────── */

interface ActorRunOutcome {
  products: Product[];
  mockCount: number;
  warning: string | null;
}

async function runActor(actor: string, keyword: string, limit: number): Promise<ActorRunOutcome> {
  const actorPath = actor.replace("/", "~");
  const url =
    `${APIFY_BASE}/v2/acts/${actorPath}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(APIFY_TOKEN)}&timeout=${RUN_TIMEOUT_SEC}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildActorInput(actor, keyword, limit)),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 140);
      if (res.status === 401 || res.status === 403) {
        return { products: [], mockCount: 0, warning: `Apify rejected the API token (HTTP ${res.status}).` };
      }
      if (res.status === 400 && snippet.toLowerCase().includes("input")) {
        return {
          products: [],
          mockCount: 0,
          warning: `Actor ${actor} rejected the input schema — set APIFY_INPUT_TEMPLATE to match its Input tab.`,
        };
      }
      return { products: [], mockCount: 0, warning: `Actor ${actor} failed (HTTP ${res.status}). ${snippet}` };
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return { products: [], mockCount: 0, warning: `Actor ${actor} returned a non-JSON response.` };
    }
    if (!Array.isArray(payload)) {
      return { products: [], mockCount: 0, warning: `Actor ${actor} returned an unexpected payload shape.` };
    }

    const products: Product[] = [];
    let mockCount = 0;
    const seen = new Set<string>();
    for (const entry of payload) {
      if (!isRecord(entry)) continue;
      if (entry._mock === true) {
        mockCount += 1;
        continue;
      }
      const product = normalizeActorItem(entry, actor);
      if (product === null || seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
      if (products.length >= limit) break;
    }
    return { products, mockCount, warning: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { products: [], mockCount: 0, warning: `Actor ${actor} timed out after ${RUN_TIMEOUT_SEC}s.` };
    }
    const detail = error instanceof Error ? error.message : "unknown error";
    return { products: [], mockCount: 0, warning: `Could not reach Apify for ${actor} (${detail}).` };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Search cache ───────────────────────────────────────────────────── */

const searchCache = new Map<string, { at: number; result: MarketplaceSearchResult }>();

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Search Shopee (and Lazada, when configured) through Apify actors and
 * return normalized, real products for in-site rendering. Runs actors in
 * parallel; failures on one actor never block the others.
 */
export async function searchMarketplaces(
  keyword: string,
  limit: number,
): Promise<MarketplaceSearchResult> {
  const cacheKey = `${keyword.trim().toLowerCase()}|${limit}|${SHOPEE_ACTOR}|${LAZADA_ACTOR}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  const actors = [SHOPEE_ACTOR, LAZADA_ACTOR].filter(
    (actor, index, all) => actor !== "" && all.indexOf(actor) === index,
  );

  const outcomes = await Promise.all(
    actors.map((actor) => runActor(actor, keyword, limit)),
  );

  const products: Product[] = [];
  const warnings: string[] = [];
  let mockCount = 0;
  let realCount = 0;

  // Interleave actors so results are mixed across marketplaces.
  const maxLen = Math.max(0, ...outcomes.map((o) => o.products.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const outcome of outcomes) {
      const product = outcome.products[i];
      if (product) products.push(product);
    }
  }
  for (const outcome of outcomes) {
    realCount += outcome.products.length;
    mockCount += outcome.mockCount;
    if (outcome.warning) warnings.push(outcome.warning);
  }

  const result: MarketplaceSearchResult = {
    products: products.slice(0, limit),
    mockOnly: realCount === 0 && mockCount > 0,
    warnings,
  };

  if (searchCache.size >= CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(cacheKey, { at: Date.now(), result });
  return result;
}

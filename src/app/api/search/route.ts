/******************************************************************************
 * ECOMOBI SEARCH & AFFILIATE DASHBOARD — BACKEND ENGINE
 * File: src/app/api/search/route.ts
 *
 * A secure, error-resilient API route that:
 *   1. Accepts a product `keyword` (required) and a `subId` (optional channel
 *      tracking label) via POST (JSON body) or GET (query string).
 *   2. Validates every input explicitly — types, lengths, patterns, ranges.
 *   3. Forwards the search to the Ecomobi Product Search API, authenticated
 *      with the server-side ECOMOBI_API_TOKEN. The token never reaches the
 *      browser (the client only ever talks to /api/search).
 *   4. Normalizes Ecomobi's payload into a uniform product schema:
 *      { title, price, store_name, image_url, product_url, ... }
 *   5. Always answers with a strict JSON envelope:
 *        success → { ok: true,  source, keyword, sub_id, count, products }
 *        failure → { ok: false, error: { code, message } }
 *
 * ENVIRONMENT VARIABLES (defined in .env.local)
 *   ECOMOBI_API_TOKEN        REQUIRED. Publisher API token (Passio → API Settings)
 *   ECOMOBI_API_BASE_URL     Optional. Default: https://api.ecotrackings.com
 *                            (verified host of the Ecomobi/Passio publisher API)
 *   ECOMOBI_SEARCH_ENDPOINT  Optional. Default: /api/v3/products
 *   ECOMOBI_AUTH_SCHEME      Optional. "query" (default — token as a URL query
 *                            parameter, per the Passio pub-API docs), "bearer"
 *                            (Authorization: Bearer) or "apikey" (X-API-Key)
 *   ECOMOBI_TOKEN_PARAM      Optional. Query-parameter name for the token when
 *                            AUTH_SCHEME=query. Default: token
 *   DEMO_MODE                Optional. "auto" | "true" | "false". Default: auto
 *                            (auto = sample data only while no token is set)
 *   RATE_LIMIT_MAX           Optional. Searches per window per IP. Default: 30
 *   RATE_LIMIT_WINDOW_MS     Optional. Window length (ms). Default: 60000
 *
 * NOTE — Verified upstream contract (Passio publisher API documentation,
 * affiliate.passio.eco/pub-api-document): the API host is
 * api.ecotrackings.com, endpoints live under /api/v3/*, authentication is a
 * `token` (or `token_private`) URL query parameter, and some errors are
 * returned as HTTP 200 with a JSON error body — both are handled below.
 * If your account documents a different path or auth style, override it in
 * .env.local — no code changes are required. The normalizer also tolerates a
 * wide range of payload shapes (data/products/items containers and common
 * field aliases), so minor upstream schema drift degrades gracefully.
 ******************************************************************************/

import { NextRequest, NextResponse } from "next/server";
import type { Platform, Product } from "@/lib/types";
import { TRENDING_PRODUCTS } from "@/lib/trending-products";
import { isApifyConfigured, searchMarketplaces } from "@/lib/apify";

export type { Platform, Product };
/** Uniform product shape shared with the UI — single source of truth. */
type EcomobiProduct = Product;

// Route handlers must never be statically cached — every search is dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ══════════════════════════════════════════════════════════════════════════
 * 1. PUBLIC CONTRACT — the uniform product schema is defined once in
 *    src/lib/types.ts and re-exported above for API consumers.
 * ════════════════════════════════════════════════════════════════════════ */

interface SearchSuccess {
  ok: true;
  source: "ecomobi" | "demo" | "marketplace";
  keyword: string;
  sub_id: string | null;
  page: number;
  limit: number;
  count: number;
  products: EcomobiProduct[];
  notice?: string;
}

interface SearchFailure {
  ok: false;
  error: { code: string; message: string; upstream_status?: number };
}

type SearchResponse = SearchSuccess | SearchFailure;

/* ══════════════════════════════════════════════════════════════════════════
 * 2. SERVER CONFIGURATION — environment + tuning constants
 * ════════════════════════════════════════════════════════════════════════ */

const API_TOKEN = (process.env.ECOMOBI_API_TOKEN ?? "").trim();

const API_BASE_URL = (
  process.env.ECOMOBI_API_BASE_URL ?? "https://api.ecotrackings.com"
)
  .trim()
  .replace(/\/+$/, "");

const SEARCH_ENDPOINT = (
  process.env.ECOMOBI_SEARCH_ENDPOINT ?? "/api/v3/products"
).trim();

/**
 * Auth transport for the upstream API:
 *   "query"  → token as a URL query parameter (Passio publisher API style)
 *   "bearer" → Authorization: Bearer <token>
 *   "apikey" → X-API-Key: <token>
 */
const AUTH_SCHEME = (process.env.ECOMOBI_AUTH_SCHEME ?? "query")
  .trim()
  .toLowerCase();

/** Query-parameter name used when AUTH_SCHEME === "query". */
const TOKEN_QUERY_PARAM =
  (process.env.ECOMOBI_TOKEN_PARAM ?? "token").trim() || "token";

const DEMO_MODE = (process.env.DEMO_MODE ?? "auto").trim().toLowerCase();

/** Abort the upstream call after this long (ms). */
const REQUEST_TIMEOUT_MS = 12_000;

/** Input validation rules. */
const KEYWORD_MAX_LENGTH = 120;
const SUB_ID_MAX_LENGTH = 64;
const SUB_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const LIMIT_MIN = 1;
const LIMIT_MAX = 60;
const LIMIT_DEFAULT = 24;
const PAGE_MIN = 1;
const PAGE_MAX = 50;
const PAGE_DEFAULT = 1;

/** Best-effort, per-instance rate limiting (see README for serverless notes). */
const RATE_LIMIT_MAX = envInt("RATE_LIMIT_MAX", 30);
const RATE_LIMIT_WINDOW_MS = envInt("RATE_LIMIT_WINDOW_MS", 60_000);

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3. SMALL UTILITIES
 * ════════════════════════════════════════════════════════════════════════ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON response helper — always no-store, never leaks the token. */
function json(
  data: SearchResponse,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

/** Remove the API token from any upstream text before echoing it. */
function sanitizeSnippet(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const masked = API_TOKEN ? collapsed.split(API_TOKEN).join("***") : collapsed;
  return masked.length > 220 ? `${masked.slice(0, 220)}…` : masked;
}

/** Deterministic id for products that arrive without one. */
function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `p-${hash.toString(36)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4. RATE LIMITER — in-memory sliding window, best-effort on serverless
 * ════════════════════════════════════════════════════════════════════════ */

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  if (RATE_LIMIT_MAX <= 0) return { allowed: true, retryAfterSec: 0 };

  const now = Date.now();

  // Opportunistic cleanup so the map can never grow unbounded.
  if (rateBuckets.size > 5_000) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const bucket = rateBuckets.get(ip);
  if (bucket === undefined || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count < RATE_LIMIT_MAX) {
    bucket.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5. INPUT VALIDATION — explicit, order-independent, injection-safe
 * ════════════════════════════════════════════════════════════════════════ */

interface ValidatedSearch {
  keyword: string;
  subId: string | null;
  limit: number;
  page: number;
}

type ParseResult =
  | { ok: true; value: ValidatedSearch }
  | { ok: false; message: string };

/** Return the first non-empty string among `keys` (trimmed), or null. */
function readString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** Parse an optional bounded integer, or return a human-readable error. */
function readBoundedInt(
  source: Record<string, unknown>,
  keys: string[],
  field: string,
  fallback: number,
  min: number,
  max: number,
): number | string {
  let raw: unknown;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      raw = value;
      break;
    }
  }
  if (raw === undefined) return fallback;

  let parsed: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    parsed = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    parsed = Number(raw.trim());
  } else {
    return `${field} must be a number.`;
  }

  if (!Number.isInteger(parsed) || parsed < min) {
    return `${field} must be a whole number of at least ${min}.`;
  }
  return Math.min(parsed, max);
}

function validateInput(source: Record<string, unknown>): ParseResult {
  // ── keyword (required) ──────────────────────────────────────────────
  const keyword = readString(source, [
    "keyword",
    "q",
    "query",
    "search",
    "kw",
  ]);
  if (keyword === null) {
    return {
      ok: false,
      message:
        'A search keyword is required and cannot be empty. Send { "keyword": "wireless earbuds" } or ?keyword=wireless+earbuds.',
    };
  }
  if (keyword.length > KEYWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keyword must be ${KEYWORD_MAX_LENGTH} characters or fewer (received ${keyword.length}).`,
    };
  }

  // ── subId (optional, URL-safe channel label) ────────────────────────
  const subIdRaw = readString(source, ["subId", "sub_id", "subid", "sub"]);
  let subId: string | null = null;
  if (subIdRaw !== null) {
    if (subIdRaw.length > SUB_ID_MAX_LENGTH) {
      return {
        ok: false,
        message: `Sub-ID must be ${SUB_ID_MAX_LENGTH} characters or fewer (received ${subIdRaw.length}).`,
      };
    }
    if (!SUB_ID_PATTERN.test(subIdRaw)) {
      return {
        ok: false,
        message:
          "Sub-ID may only contain letters, numbers, dots (.), dashes (-) and underscores (_).",
      };
    }
    subId = subIdRaw;
  }

  // ── limit / page (optional, clamped) ────────────────────────────────
  const limit = readBoundedInt(
    source,
    ["limit", "page_size", "pageSize"],
    "Limit",
    LIMIT_DEFAULT,
    LIMIT_MIN,
    LIMIT_MAX,
  );
  if (typeof limit === "string") return { ok: false, message: limit };

  const page = readBoundedInt(
    source,
    ["page"],
    "Page",
    PAGE_DEFAULT,
    PAGE_MIN,
    PAGE_MAX,
  );
  if (typeof page === "string") return { ok: false, message: page };

  return { ok: true, value: { keyword, subId, limit, page } };
}

function querySource(request: NextRequest): Record<string, string> {
  const source: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    source[key] = value;
  });
  return source;
}

type PostBody =
  | { kind: "parsed"; data: Record<string, unknown> }
  | { kind: "invalid"; message: string };

async function parsePostRequest(request: NextRequest): Promise<PostBody> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    // Body wasn't JSON — gracefully fall back to query params if present.
    const query = querySource(request);
    if (query.keyword !== undefined || query.q !== undefined) {
      return { kind: "parsed", data: query };
    }
    return {
      kind: "invalid",
      message: 'Request body must be valid JSON, e.g. { "keyword": "air fryer" }.',
    };
  }
  if (!isRecord(data)) {
    return {
      kind: "invalid",
      message: 'Request body must be a JSON object, e.g. { "keyword": "air fryer" }.',
    };
  }
  return { kind: "parsed", data };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6. ECOMOBI UPSTREAM CALL — authenticated fetch with method fallback
 *
 * The verified Passio publisher API (api.ecotrackings.com) authenticates via
 * a `token` URL query parameter and serves GET requests; some errors are
 * returned as HTTP 200 with a JSON error body. The call therefore:
 *   • sends the token as a query param (or header, per ECOMOBI_AUTH_SCHEME),
 *   • tries GET first when using query auth (POST first otherwise),
 *   • falls back to the other method on 405/415,
 *   • inspects every "successful" body for an embedded error envelope.
 * ════════════════════════════════════════════════════════════════════════ */

interface UpstreamProblem {
  httpStatus: number;
  code: string;
  message: string;
  upstreamStatus?: number;
}

type UpstreamResult =
  | { ok: true; payload: unknown }
  | { ok: false; problem: UpstreamProblem };

/**
 * Detect Ecomobi's JSON error envelopes. Their API sometimes answers
 * HTTP 200 with a body like {"error":{"status_code":500,"messsage":"…"}}
 * (note their "messsage" typo — both keys are read) or
 * {"success":false,"message":"Not Found","status":404}.
 */
function detectPayloadError(payload: unknown): UpstreamProblem | null {
  if (!isRecord(payload)) return null;

  const nested = payload.error;
  if (isRecord(nested)) {
    const rawMessage =
      typeof nested.message === "string"
        ? nested.message
        : typeof nested.messsage === "string"
          ? nested.messsage
          : "";
    if (rawMessage !== "") {
      return payloadProblemFromMessage(rawMessage);
    }
  }

  if (payload.success === false) {
    const message =
      typeof payload.message === "string" && payload.message !== ""
        ? payload.message
        : "The Ecomobi API rejected the request.";
    return payloadProblemFromMessage(message);
  }

  return null;
}

function payloadProblemFromMessage(message: string): UpstreamProblem {
  const trimmed = message.toLowerCase();
  if (trimmed.includes("token")) {
    return {
      httpStatus: 502,
      code: "ECOMOBI_AUTH_FAILED",
      message:
        `Ecomobi rejected the API token ("${sanitizeSnippet(message)}"). Verify ECOMOBI_API_TOKEN in .env.local / Vercel — ` +
        `copy the exact token value from your Passio dashboard → API Settings (no spaces, correct casing).`,
    };
  }
  return {
    httpStatus: 502,
    code: "ECOMOBI_UPSTREAM_ERROR",
    message: `Ecomobi returned an error: ${sanitizeSnippet(message)}`,
  };
}

function mapUpstreamStatus(status: number, snippet: string): UpstreamProblem {
  if (status === 400) {
    return {
      httpStatus: 502,
      code: "ECOMOBI_BAD_REQUEST",
      message:
        `Ecomobi rejected the search request (HTTP 400). The endpoint may expect different parameter names — ` +
        `compare with your publisher API docs. Upstream said: ${snippet}`,
      upstreamStatus: status,
    };
  }
  if (status === 401 || status === 403) {
    return {
      httpStatus: 502,
      code: "ECOMOBI_AUTH_FAILED",
      message:
        `Ecomobi rejected the API token (HTTP ${status}). Verify ECOMOBI_API_TOKEN in .env.local — ` +
        `generate a fresh key from your Passio dashboard → API Settings, then restart the server.`,
      upstreamStatus: status,
    };
  }
  if (status === 404) {
    return {
      httpStatus: 502,
      code: "ECOMOBI_ENDPOINT_NOT_FOUND",
      message:
        `The Ecomobi search endpoint returned 404. Set ECOMOBI_SEARCH_ENDPOINT in .env.local to the exact ` +
        `path documented in your publisher API settings (current value: ${SEARCH_ENDPOINT}).`,
      upstreamStatus: status,
    };
  }
  if (status === 429) {
    return {
      httpStatus: 429,
      code: "ECOMOBI_RATE_LIMITED",
      message:
        "Ecomobi's rate limit was reached. Wait a moment and try again.",
      upstreamStatus: status,
    };
  }
  return {
    httpStatus: 502,
    code: "ECOMOBI_UPSTREAM_ERROR",
    message:
      `Ecomobi returned an unexpected response (HTTP ${status}). ${snippet ? `Upstream said: ${snippet}` : "Try again shortly."}`,
    upstreamStatus: status,
  };
}

async function readErrorSnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return sanitizeSnippet(text);
  } catch {
    return "";
  }
}

async function fetchEcomobiProducts(
  params: ValidatedSearch,
): Promise<UpstreamResult> {
  const endpoint = `${API_BASE_URL}${SEARCH_ENDPOINT}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (AUTH_SCHEME === "bearer") {
    headers["Authorization"] = `Bearer ${API_TOKEN}`;
  } else if (AUTH_SCHEME === "apikey") {
    headers["X-API-Key"] = API_TOKEN;
  }

  const query = new URLSearchParams({
    keyword: params.keyword,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.subId) query.set("sub_id", params.subId);
  if (AUTH_SCHEME === "query") query.set(TOKEN_QUERY_PARAM, API_TOKEN);

  const requestBody = JSON.stringify({
    keyword: params.keyword,
    sub_id: params.subId ?? undefined,
    page: params.page,
    limit: params.limit,
  });

  // Query-param APIs (Passio style) are GET-first; header-auth APIs POST-first.
  const methods: readonly ("GET" | "POST")[] =
    AUTH_SCHEME === "query" ? ["GET", "POST"] : ["POST", "GET"];

  for (const method of methods) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const url = method === "GET" ? `${endpoint}?${query.toString()}` : endpoint;
      const requestHeaders: Record<string, string> = { ...headers };
      if (method === "POST") requestHeaders["Content-Type"] = "application/json";

      const res = await fetch(url, {
        method,
        headers: requestHeaders,
        body: method === "POST" ? requestBody : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.ok) {
        let payload: unknown;
        try {
          payload = await res.json();
        } catch {
          return {
            ok: false,
            problem: {
              httpStatus: 502,
              code: "ECOMOBI_INVALID_RESPONSE",
              message:
                "Ecomobi answered with a non-JSON payload. Verify ECOMOBI_SEARCH_ENDPOINT points at the product search API.",
              upstreamStatus: res.status,
            },
          };
        }
        // Their API reports some failures as HTTP 200 + error body.
        const embedded = detectPayloadError(payload);
        if (embedded !== null) {
          console.warn(
            `[/api/search] Ecomobi error envelope on ${method} ${endpoint}: ${embedded.message}`,
          );
          return { ok: false, problem: embedded };
        }
        return { ok: true, payload };
      }

      // First method rejected for method/media-type → try the other once.
      if (
        method !== methods[methods.length - 1] &&
        (res.status === 405 || res.status === 415)
      ) {
        continue;
      }

      const problem = mapUpstreamStatus(res.status, await readErrorSnippet(res));
      console.warn(
        `[/api/search] Ecomobi upstream error ${res.status} on ${method} ${endpoint}: ${problem.message}`,
      );
      return { ok: false, problem };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          problem: {
            httpStatus: 504,
            code: "ECOMOBI_TIMEOUT",
            message: `Ecomobi did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Try again.`,
          },
        };
      }
      const detail = error instanceof Error ? error.message : "unknown error";
      return {
        ok: false,
        problem: {
          httpStatus: 502,
          code: "ECOMOBI_NETWORK_ERROR",
          message: `Could not reach the Ecomobi API (${sanitizeSnippet(detail)}). Check ECOMOBI_API_BASE_URL and your network.`,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Unreachable in practice (the second attempt always returns), kept for safety.
  return {
    ok: false,
    problem: {
      httpStatus: 502,
      code: "ECOMOBI_METHOD_UNSUPPORTED",
      message: "The Ecomobi endpoint rejected both GET and POST requests.",
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 7. RESPONSE NORMALIZER — upstream payload → uniform EcomobiProduct[]
 *
 * Affiliate-network payloads drift. Instead of assuming one schema, we scan
 * common container keys and field aliases. Unknown shapes degrade to an empty
 * result (with a notice) instead of crashing the dashboard.
 * ════════════════════════════════════════════════════════════════════════ */

const LIST_CONTAINER_KEYS = [
  "products",
  "items",
  "results",
  "data",
  "list",
  "rows",
  "records",
] as const;

const NESTED_CONTAINER_KEYS = ["data", "result", "payload", "response"] as const;

const TITLE_KEYS = [
  "title",
  "name",
  "product_name",
  "productName",
  "product_title",
  "item_name",
] as const;

const URL_KEYS = [
  "product_url",
  "productUrl",
  "url",
  "link",
  "affiliate_url",
  "affiliate_link",
  "deeplink",
  "deep_link",
  "tracking_link",
  "ecomobi_url",
  "offer_url",
  "short_url",
  "short_link",
] as const;

const IMAGE_KEYS = [
  "image_url",
  "imageUrl",
  "image",
  "img_url",
  "img",
  "thumbnail_url",
  "thumbnail",
  "thumb_url",
  "thumb",
  "picture",
  "pic_url",
  "photo",
  "cover_url",
  "cover",
  "main_image",
  "mainImage",
  "image_main",
  "original_img",
] as const;

const PRICE_KEYS = [
  "price",
  "sale_price",
  "salePrice",
  "product_price",
  "final_price",
  "offer_price",
  "price_now",
  "discount_price",
  "selling_price",
  "price_min",
  "min_price",
] as const;

const ORIGINAL_PRICE_KEYS = [
  "original_price",
  "list_price",
  "old_price",
  "market_price",
  "retail_price",
  "price_max",
] as const;

const CURRENCY_KEYS = ["currency", "currency_code", "price_currency"] as const;

const STORE_KEYS = [
  "store_name",
  "storeName",
  "shop_name",
  "shopName",
  "seller_name",
  "sellerName",
  "merchant_name",
  "merchantName",
  "store",
  "shop",
  "seller",
  "merchant",
  "marketplace",
] as const;

const PLATFORM_HINT_KEYS = [
  "platform",
  "network",
  "source",
  "channel",
  "market",
  "marketplace",
  "campaign_name",
  "campaignName",
  "domain",
  "site",
] as const;

const COMMISSION_KEYS = [
  "commission_rate",
  "commissionRate",
  "commission_percent",
  "cps_rate",
  "commission",
  "rate",
] as const;

const RATING_KEYS = ["rating", "rating_average", "ratingAverage", "stars", "star"] as const;

const SOLD_KEYS = ["sold", "sales", "sold_count", "historical_sold", "quantity_sold", "orders"] as const;

const ID_KEYS = ["id", "product_id", "productId", "item_id", "itemId", "sku", "_id"] as const;

const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  other: "Ecomobi Partner Store",
};

function pickString(
  item: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(
  item: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") continue;
      const parsed = Number.parseFloat(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function toMoney(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function extractProductList(payload: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload) || depth > 2) return null;

  for (const key of LIST_CONTAINER_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  for (const key of NESTED_CONTAINER_KEYS) {
    const value = payload[key];
    if (isRecord(value)) {
      const nested = extractProductList(value, depth + 1);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function coerceImageUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    return null;
  }
  if (isRecord(value)) {
    for (const key of ["url", "src", "path", "link", "image", "image_url", "imageUrl"]) {
      const nested = value[key];
      if (typeof nested === "string" && nested.trim() !== "") {
        return coerceImageUrl(nested);
      }
    }
  }
  return null;
}

function extractImage(item: Record<string, unknown>): string {
  for (const key of IMAGE_KEYS) {
    const url = coerceImageUrl(item[key]);
    if (url !== null) return url;
  }
  for (const key of ["images", "image_list", "imageList", "pictures", "gallery", "thumbs"]) {
    const value = item[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const url = coerceImageUrl(entry);
        if (url !== null) return url;
      }
    }
  }
  return "";
}

function detectPlatform(
  item: Record<string, unknown>,
  storeName: string,
  productUrl: string,
): Platform {
  const signals: string[] = [storeName, productUrl];
  for (const key of PLATFORM_HINT_KEYS) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") signals.push(value);
  }
  const haystack = signals.join(" ").toLowerCase();
  if (haystack.includes("shopee")) return "shopee";
  if (haystack.includes("lazada")) return "lazada";
  if (haystack.includes("tiktok") || haystack.includes("tik tok")) return "tiktok";
  return "other";
}

function tidyStoreName(raw: string, platform: Platform): string {
  const normalized = raw.toLowerCase();
  if (
    normalized === "shopee" ||
    normalized === "lazada" ||
    normalized === "tiktok" ||
    normalized === "tiktok shop"
  ) {
    return PLATFORM_LABELS[platform];
  }
  return raw;
}

function normalizeOne(item: Record<string, unknown>): EcomobiProduct | null {
  const titleRaw = pickString(item, TITLE_KEYS);
  const productUrl = pickString(item, URL_KEYS);

  // Skip entries without at least a title — nothing useful to render.
  if (titleRaw === null) return null;
  const title =
    titleRaw.length > 300 ? `${titleRaw.slice(0, 300).trimEnd()}…` : titleRaw;

  const platform = detectPlatform(
    item,
    pickString(item, STORE_KEYS) ?? "",
    productUrl ?? "",
  );

  const storeRaw = pickString(item, STORE_KEYS);
  const storeName = storeRaw
    ? tidyStoreName(storeRaw, platform)
    : PLATFORM_LABELS[platform];

  const price = toMoney(pickNumber(item, PRICE_KEYS) ?? Number.NaN);
  const originalPriceRaw = toMoney(
    pickNumber(item, ORIGINAL_PRICE_KEYS) ?? Number.NaN,
  );
  const originalPrice =
    originalPriceRaw !== null && price !== null && originalPriceRaw > price
      ? originalPriceRaw
      : null;

  const currency = pickString(item, CURRENCY_KEYS);

  // Commission: values < 1 are treated as fractions (0.12 → 12%).
  let commission = pickNumber(item, COMMISSION_KEYS);
  if (commission !== null) {
    if (commission > 0 && commission < 1) commission *= 100;
    if (commission <= 0 || commission > 95) commission = null;
    else commission = Math.round(commission * 10) / 10;
  }

  const ratingRaw = pickNumber(item, RATING_KEYS);
  const rating =
    ratingRaw !== null && ratingRaw >= 0 && ratingRaw <= 5
      ? Math.round(ratingRaw * 10) / 10
      : null;

  const soldRaw = pickNumber(item, SOLD_KEYS);
  const sold = soldRaw !== null && soldRaw >= 0 ? Math.round(soldRaw) : null;

  const id = pickString(item, ID_KEYS) ?? hashId(`${title}|${productUrl ?? ""}|${price ?? ""}`);

  return {
    id,
    title,
    price,
    original_price: originalPrice,
    currency,
    store_name: storeName,
    platform,
    image_url: extractImage(item),
    product_url: productUrl ?? "",
    commission_rate: commission,
    rating,
    sold,
  };
}

function normalizeProducts(payload: unknown): EcomobiProduct[] {
  const list = extractProductList(payload);
  if (list === null) return [];

  const seen = new Set<string>();
  const products: EcomobiProduct[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const product = normalizeOne(entry);
    if (product === null || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
  }
  return products;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8. DEMO CATALOG — used when DEMO_MODE=true, or auto with no token
 * ════════════════════════════════════════════════════════════════════════ */

const DEMO_NOTICE =
  "Showing sample products. Add your ECOMOBI_API_TOKEN in .env.local to search the live Ecomobi catalog.";

/**
 * Demo catalog — the same PH trending dataset that powers the pre-rendered
 * "Trending Products in the Philippines" section, kept in a single shared
 * module (src/lib/trending-products.ts) so the static grid and the demo API
 * can never drift apart.
 */
const DEMO_PRODUCTS: EcomobiProduct[] = TRENDING_PRODUCTS;

function buildDemoProducts(keyword: string): {
  products: EcomobiProduct[];
  notice: string;
} {
  const needle = keyword.toLowerCase();
  const matches = DEMO_PRODUCTS.filter((product) =>
    `${product.title} ${product.store_name}`.toLowerCase().includes(needle),
  );
  if (matches.length > 0) {
    return { products: matches, notice: DEMO_NOTICE };
  }
  return {
    products: DEMO_PRODUCTS,
    notice: `${DEMO_NOTICE} (No sample product matched “${keyword}” — showing the full demo catalog.)`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 9. REQUEST HANDLERS — GET + POST share one resilient pipeline
 * ════════════════════════════════════════════════════════════════════════ */

async function handleSearch(request: NextRequest): Promise<NextResponse> {
  try {
    // ── 9.1 Rate limit (per-IP, best-effort) ──────────────────────────
    const rateLimit = checkRateLimit(clientIp(request));
    if (!rateLimit.allowed) {
      return json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many searches from this client. Try again in ${rateLimit.retryAfterSec}s.`,
          },
        },
        429,
        { "Retry-After": String(rateLimit.retryAfterSec) },
      );
    }

    // ── 9.2 Parse + validate input ────────────────────────────────────
    let parseResult: ParseResult;
    if (request.method === "POST") {
      const body = await parsePostRequest(request);
      if (body.kind === "invalid") {
        parseResult = { ok: false, message: body.message };
      } else {
        // Body wins over query params when both are supplied.
        parseResult = validateInput({ ...querySource(request), ...body.data });
      }
    } else {
      parseResult = validateInput(querySource(request));
    }

    if (!parseResult.ok) {
      return json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: parseResult.message } },
        400,
      );
    }
    const params = parseResult.value;

    // ── 9.3 Resolve token / demo mode ────────────────────────────────
    const tokenPresent = API_TOKEN.length > 0;
    const demoActive =
      DEMO_MODE === "true" || (DEMO_MODE === "auto" && !tokenPresent);

    if (!tokenPresent && !demoActive) {
      return json(
        {
          ok: false,
          error: {
            code: "CONFIG_ERROR",
            message:
              "ECOMOBI_API_TOKEN is not configured. Add it to .env.local (see README.md) and restart the server.",
          },
        },
        503,
      );
    }

    // ── 9.4 Demo mode shortcut ────────────────────────────────────────
    if (demoActive) {
      const { products, notice } = buildDemoProducts(params.keyword);
      return json(
        {
          ok: true,
          source: "demo",
          keyword: params.keyword,
          sub_id: params.subId,
          page: 1,
          limit: params.limit,
          count: products.length,
          products,
          notice,
        },
        200,
      );
    }

    // ── 9.4b LIVE MARKETPLACE SEARCH (Apify actors — real in-site results) ─
    // Activates when APIFY_TOKEN is set. On success the dashboard renders a
    // real product grid inside the site (no external prompting); each card's
    // Generate Link converts the real product URL into a tracked goeco.mobi
    // affiliate link. Failures degrade gracefully to the Ecomobi path below.
    if (isApifyConfigured()) {
      const market = await searchMarketplaces(params.keyword, params.limit);
      if (market.products.length > 0) {
        return json(
          {
            ok: true,
            source: "marketplace",
            keyword: params.keyword,
            sub_id: params.subId,
            page: 1,
            limit: params.limit,
            count: market.products.length,
            products: market.products,
            notice:
              "Live marketplace results via Apify — prices and stock update when the store's page changes. Generate Link creates your tracked Ecomobi affiliate URL for any product.",
          },
          200,
        );
      }
      if (market.mockOnly) {
        const { products: samples } = buildDemoProducts(params.keyword);
        return json(
          {
            ok: true,
            source: "demo",
            keyword: params.keyword,
            sub_id: params.subId,
            page: 1,
            limit: params.limit,
            count: samples.length,
            products: samples,
            notice:
              "Your Apify plan returned MOCK data (some actors — including the default Shopee scraper — " +
              "only serve live results on paid Apify plans). Showing sample products instead. Upgrade your " +
              "Apify plan or pick a free-tier actor from the ecommerce-intelligence-apis catalog.",
          },
          200,
        );
      }
      if (market.warnings.length > 0) {
        console.warn(
          `[/api/search] Apify providers degraded for "${params.keyword}": ${market.warnings.join(" | ")}`,
        );
      }
      // Empty/error → fall through to the Ecomobi product endpoint.
    }

    // ── 9.5 Live Ecomobi search ───────────────────────────────────────
    const upstream = await fetchEcomobiProducts(params);
    if (!upstream.ok) {
      const { problem } = upstream;
      return json(
        {
          ok: false,
          error: {
            code: problem.code,
            message: problem.message,
            upstream_status: problem.upstreamStatus,
          },
        },
        problem.httpStatus,
      );
    }

    // ── 9.6 Normalize + respond ───────────────────────────────────────
    const products = normalizeProducts(upstream.payload);

    // Live catalog came back empty (Ecomobi only serves product data to
    // accounts with product feeds enabled). Fall back to the labeled sample
    // catalog so the search experience stays useful, with a transparent
    // notice directing users to the Instant Link Generator for real links.
    if (products.length === 0) {
      const { products: samples } = buildDemoProducts(params.keyword);
      return json(
        {
          ok: true,
          source: "demo",
          keyword: params.keyword,
          sub_id: params.subId,
          page: 1,
          limit: params.limit,
          count: samples.length,
          products: samples,
          notice:
            `Live product results aren't available — Ecomobi's API doesn't serve a product catalog for ` +
            `your campaigns yet, so these are sample products for “${params.keyword}”. Use the tracked store ` +
            `buttons above to open the real marketplace results, then paste any product URL into the Instant ` +
            `Link Generator to create your affiliate link.`,
        },
        200,
      );
    }

    return json(
      {
        ok: true,
        source: "ecomobi",
        keyword: params.keyword,
        sub_id: params.subId,
        page: params.page,
        limit: params.limit,
        count: products.length,
        products,
      },
      200,
    );
  } catch (error) {
    console.error("[/api/search] Unexpected error:", error);
    return json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected server error occurred. Check the server logs.",
        },
      },
      500,
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSearch(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSearch(request);
}

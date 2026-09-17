/******************************************************************************
 * SEARCH DASHBOARD — CLIENT INTERACTIVE ISLAND
 * File: src/components/SearchDashboard.tsx
 *
 * The hydrated half of the dashboard: the product search form, the live
 * results grid with platform filter chips, and the affiliate link modal
 * wizard. It is mounted by the statically pre-rendered server shell
 * (src/app/page.tsx), which keeps every crawler-critical section (hero,
 * trending products, how-it-works) in pure server-rendered HTML.
 *
 * PROGRAMMATIC SEO / DEEP LINKING
 *   • On mount, ?keyword= / ?q= and ?sub_id= are read from the URL and the
 *     search runs automatically — so /?keyword=wireless+earbuds is a
 *     shareable, crawlable search landing page.
 *   • Every search mirrors its state back to the address bar via
 *     history.replaceState (no reload, no history spam).
 *   • Popular-search chips render as real <a href="/?keyword=…"> links that
 *     crawlers can follow; on the client, clicks are intercepted for an
 *     instant no-reload experience.
 *
 * PERFORMANCE CONTRACT (Core Web Vitals)
 *   • No external libraries — React + shared pure helpers only.
 *   • All product images lazy-load with intrinsic width/height (zero CLS).
 *   • The modal wizard mounts only when a "Generate Link" action occurs.
 *   • aria-live results region keeps screen readers and crawlers in sync.
 ******************************************************************************/

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Platform, Product } from "@/lib/types";
import {
  SUB_ID_PARAM,
  SUB_ID_PARAM_NOTE,
  SUB_ID_PATTERN,
  discountPercent,
  formatPrice,
  formatSold,
  PLATFORM_META,
  validateSubId,
} from "@/lib/format";
import {
  AlertIcon,
  CopyIcon,
  ExternalIcon,
  LinkIcon,
  PlatformBadge,
  SearchIcon,
  Spinner,
  StarIcon,
  StoreIcon,
  TagIcon,
  XIcon,
} from "./ui";

/* ══════════════════════════════════════════════════════════════════════════
 * 1. TYPES — mirror of the /api/search response contract
 * ════════════════════════════════════════════════════════════════════════ */

interface SearchSuccessPayload {
  ok: true;
  source: "ecomobi" | "demo";
  keyword: string;
  sub_id: string | null;
  count: number;
  products: Product[];
  notice?: string;
}

interface ApiErrorPayload {
  ok: false;
  error: { code: string; message: string };
}

type SearchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "success";
      products: Product[];
      source: "ecomobi" | "demo";
      keyword: string;
      notice: string | null;
    }
  | { phase: "error"; message: string; code: string | null };

/** Lifecycle of the real affiliate-link generation call in the modal. */
type ModalLinkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; link: string; resolved: string | null }
  | { status: "error"; message: string; code: string };

/* ══════════════════════════════════════════════════════════════════════════
 * 2. LOCAL CONSTANTS & PURE HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

/** Crawlable internal links for the most valuable PH search queries. */
const POPULAR_SEARCHES = [
  "wireless earbuds",
  "power bank",
  "running shoes",
  "tumbler",
  "galaxy",
  "charger",
];

const FILTER_PLATFORMS: { id: Platform; label: string }[] = [
  { id: "shopee", label: "Shopee" },
  { id: "lazada", label: "Lazada" },
  { id: "tiktok", label: "TikTok Shop" },
  { id: "other", label: "Partner" },
];

const SUB_ID_STORAGE_KEY = "ecomobi-dashboard:sub-id";

/** Neutral inline SVG shown when a product thumbnail fails to load. */
const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><rect width="480" height="480" fill="#1e293b"/><g fill="none" stroke="#475569" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M175 205v-25a65 65 0 0 1 130 0v25"/><rect x="155" y="205" width="170" height="130" rx="18"/></g><circle cx="240" cy="270" r="14" fill="#475569"/></svg>`,
)}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.product_url === "string"
  );
}

function isSearchSuccess(value: unknown): value is SearchSuccessPayload {
  if (!isRecord(value) || value.ok !== true) return false;
  if (typeof value.keyword !== "string") return false;
  if (value.source !== "ecomobi" && value.source !== "demo") return false;
  return Array.isArray(value.products) && value.products.every(isProduct);
}

function isApiError(value: unknown): value is ApiErrorPayload {
  if (!isRecord(value) || value.ok !== false) return false;
  const error = value.error;
  return (
    isRecord(error) &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

/** Clipboard write with a legacy fallback for restricted browsing contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path (e.g. sandboxed iframes).
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}

function readStoredSubId(): string {
  try {
    return window.localStorage.getItem(SUB_ID_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeSubId(value: string): void {
  try {
    if (value) window.localStorage.setItem(SUB_ID_STORAGE_KEY, value);
    else window.localStorage.removeItem(SUB_ID_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode / sandboxed iframe) — non-fatal.
  }
}

function selectNodeContents(node: Node): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3. PRESENTATIONAL COMPONENTS
 * ════════════════════════════════════════════════════════════════════════ */

function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = !failed && product.image_url ? product.image_url : FALLBACK_IMAGE;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- affiliate CDN images are dynamic and unregistered; next/image would require remotePatterns maintenance.
    <img
      src={src}
      alt={`${product.title} — product photo`}
      width={600}
      height={600}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function ProductCard({
  product,
  onGenerate,
}: {
  product: Product;
  onGenerate: (product: Product) => void;
}) {
  const discount = discountPercent(product.price, product.original_price);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/70 shadow-card ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-white/25">
      <div className="relative aspect-square overflow-hidden bg-slate-800/80">
        <ProductImage
          product={product}
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
          {product.title}
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

        <button
          type="button"
          onClick={() => onGenerate(product)}
          disabled={!product.product_url}
          title={
            product.product_url
              ? "Generate your tracked affiliate link"
              : "No tracking link available for this product"
          }
          className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:text-sm"
        >
          <LinkIcon className="h-4 w-4" />
          Generate Link
        </button>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-slate-900/70 ring-1 ring-white/10">
          <div className="aspect-square animate-pulse bg-slate-800/70" />
          <div className="space-y-3 p-4">
            <div className="h-3.5 w-11/12 animate-pulse rounded bg-slate-800/70" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-800/70" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-slate-800/70" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({
  message,
  code,
  onRetry,
}: {
  message: string;
  code: string | null;
  onRetry: (() => void) | null;
}) {
  return (
    <div className="mx-auto max-w-xl animate-rise-in rounded-2xl border border-rose-500/25 bg-rose-500/10 p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-400/30">
        <AlertIcon className="h-5 w-5 text-rose-400" />
      </div>
      <h3 className="mt-4 text-base font-bold text-white">Search failed</h3>
      <p className="mt-2 text-sm leading-6 text-rose-200/90">{message}</p>
      {code && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-rose-300/60">
          error: {code}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function EmptyState({ keyword, notice }: { keyword: string; notice: string | null }) {
  return (
    <div className="mx-auto max-w-xl animate-rise-in rounded-2xl bg-slate-900/70 p-8 text-center ring-1 ring-white/10 sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 ring-1 ring-white/10">
        <SearchIcon className="h-5 w-5 text-slate-400" />
      </div>
      <h3 className="mt-4 text-base font-bold text-white">No products found</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Nothing matched <span className="font-semibold text-slate-200">“{keyword}”</span>.{" "}
        {notice ?? "Try a broader keyword or check the spelling."}
      </p>
    </div>
  );
}

function LinkModal({
  product,
  linkState,
  subId,
  onSubIdChange,
  subIdError,
  copied,
  copyFailed,
  onCopy,
  onClose,
}: {
  product: Product;
  linkState: ModalLinkState;
  subId: string;
  onSubIdChange: (value: string) => void;
  subIdError: string | null;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const subIdInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    subIdInputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="affiliate-modal-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default animate-fade-in bg-slate-950/80 backdrop-blur-sm"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-lg animate-scale-in overflow-y-auto rounded-t-3xl bg-slate-900 shadow-2xl ring-1 ring-white/15 sm:rounded-3xl">
        {/* Modal header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
              <LinkIcon className="h-4 w-4 text-white" />
            </span>
            <h2 id="affiliate-modal-title" className="text-sm font-bold text-white">
              Affiliate link ready
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Modal body */}
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10">
              <ProductImage product={product} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <PlatformBadge platform={product.platform} />
              <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-5 text-slate-100">
                {product.title}
              </p>
              {product.price !== null && (
                <p className="mt-1 text-base font-bold text-white">
                  {formatPrice(product.price, product.currency)}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="modal-subid" className="field-label">
              Sub-ID / channel tracking
            </label>
            <input
              id="modal-subid"
              ref={subIdInputRef}
              value={subId}
              onChange={(event) => onSubIdChange(event.target.value)}
              maxLength={64}
              placeholder="e.g. fb-reels, tiktok-bio, youtube-07"
              className={`h-11 w-full rounded-xl bg-slate-800/80 px-3.5 text-sm text-slate-100 outline-none ring-1 ring-inset transition placeholder:text-slate-500 ${
                subIdError
                  ? "ring-rose-500/60 focus:ring-2 focus:ring-rose-500"
                  : "ring-white/10 focus:ring-2 focus:ring-indigo-500"
              }`}
            />
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              {subIdError ? (
                <span className="text-rose-400">{subIdError}</span>
              ) : (
                <>
                  Sent through the Ecomobi tracking pipeline as{" "}
                  <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-slate-300">
                    {SUB_ID_PARAM}
                  </code>
                  . {SUB_ID_PARAM_NOTE}
                </>
              )}
            </p>
          </div>

          <div>
            <p className="field-label">Your tracked affiliate link</p>
            {linkState.status === "ready" ? (
              <div
                role="button"
                tabIndex={0}
                onClick={(event) => selectNodeContents(event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectNodeContents(event.currentTarget);
                  }
                }}
                className="cursor-pointer select-all break-all rounded-xl bg-slate-950/70 p-3.5 font-mono text-xs leading-5 text-slate-300 ring-1 ring-white/10 transition hover:ring-white/25"
              >
                {linkState.link}
              </div>
            ) : linkState.status === "loading" ? (
              <div className="flex items-center gap-3 rounded-xl bg-slate-950/70 p-3.5 ring-1 ring-white/10">
                <Spinner className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
                <p className="text-xs leading-5 text-slate-400">
                  Generating your tracked Ecomobi link…
                </p>
              </div>
            ) : linkState.status === "error" ? (
              <div className="rounded-xl bg-rose-500/10 p-3.5 ring-1 ring-rose-400/30">
                <p className="text-xs leading-5 text-rose-300">{linkState.message}</p>
                {product.product_url && (
                  <p className="mt-2 break-all font-mono text-[10px] leading-4 text-slate-500">
                    source URL: {product.product_url}
                  </p>
                )}
              </div>
            ) : subIdError ? (
              <div className="rounded-xl bg-slate-950/70 p-3.5 text-xs leading-5 text-slate-400 ring-1 ring-white/10">
                Fix the Sub-ID above to generate your tracked link.
              </div>
            ) : (
              <div className="rounded-xl bg-rose-500/10 p-3.5 text-xs leading-5 text-rose-300 ring-1 ring-rose-400/30">
                No product URL was returned for this item, so an affiliate link cannot be
                generated. Use the Instant Link Generator below with a URL copied from the
                store.
              </div>
            )}
            {linkState.status === "ready" && linkState.resolved && (
              <p className="mt-1.5 text-xs text-slate-500">
                Resolves through Ecomobi to{" "}
                <span className="font-semibold text-slate-300">
                  {(() => {
                    try {
                      return new URL(linkState.resolved).hostname;
                    } catch {
                      return "the store";
                    }
                  })()}
                </span>
              </p>
            )}
            {copyFailed && (
              <p className="mt-1.5 text-xs text-amber-400">
                Automatic copy was blocked by the browser — click the link above and press
                Ctrl/Cmd+C.
              </p>
            )}
          </div>
        </div>

        {/* Modal actions */}
        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:px-6">
          <button
            type="button"
            onClick={onCopy}
            disabled={linkState.status !== "ready"}
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              copied
                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-400"
            }`}
          >
            {copied ? (
              "Copied! ✅"
            ) : (
              <>
                <CopyIcon className="h-4 w-4" />
                Copy Link
              </>
            )}
          </button>
          {linkState.status === "ready" && (
            <a
              href={linkState.link}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white/5 px-5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 transition hover:bg-white/10"
            >
              <ExternalIcon className="h-4 w-4" />
              Open
            </a>
          )}
        </div>

        <p className="px-5 pb-5 text-center text-[11px] leading-4 text-slate-500 sm:px-6">
          Clicks and orders are tracked by Ecomobi when shoppers use this link.
          Commissions are credited to your publisher account.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4. DASHBOARD — state orchestration
 * ════════════════════════════════════════════════════════════════════════ */

export default function SearchDashboard() {
  const [keywordInput, setKeywordInput] = useState("");
  const [subIdInput, setSubIdInput] = useState("");
  const [search, setSearch] = useState<SearchState>({ phase: "idle" });
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [modalSubId, setModalSubId] = useState("");
  const [modalLink, setModalLink] = useState<ModalLinkState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const lastQueryRef = useRef<{ keyword: string; subId: string } | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const isFirstRenderRef = useRef(true);

  const subIdTrimmed = subIdInput.trim();
  const subIdError = validateSubId(subIdInput);

  /* ── URL deep-linking: restore ?keyword / ?sub_id and auto-search ──── */
  useEffect(() => {
    const storedSubId = readStoredSubId();
    setSubIdInput(storedSubId);

    const params = new URLSearchParams(window.location.search);
    const urlSubId = (params.get("sub_id") ?? "").trim();
    const effectiveSubId =
      urlSubId !== "" && SUB_ID_PATTERN.test(urlSubId) ? urlSubId : storedSubId;

    const urlKeyword = (params.get("keyword") ?? params.get("q") ?? "").trim();
    if (urlKeyword !== "") {
      setKeywordInput(urlKeyword);
      void runSearch(urlKeyword, effectiveSubId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only deep-link bootstrap
  }, []);

  /* ── Persist the Sub-ID as it changes (skip the hydration pass). ───── */
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    storeSubId(subIdInput.trim());
  }, [subIdInput]);

  /* ── Search pipeline ───────────────────────────────────────────────── */
  const runSearch = useCallback(async (rawKeyword: string, rawSubId: string) => {
    const keyword = rawKeyword.trim().slice(0, 120);
    const subId = rawSubId.trim();

    if (keyword === "") {
      setSearch({
        phase: "error",
        message: "Type a product keyword before searching.",
        code: "VALIDATION_ERROR",
      });
      return;
    }
    const subIdIssue = validateSubId(subId);
    if (subIdIssue) {
      setSearch({
        phase: "error",
        message: `Fix the Sub-ID field: ${subIdIssue}`,
        code: "VALIDATION_ERROR",
      });
      return;
    }

    lastQueryRef.current = { keyword, subId };
    setSearch({ phase: "loading" });

    // Mirror the search into the address bar → shareable + crawlable URLs.
    try {
      const params = new URLSearchParams({ keyword });
      if (subId) params.set("sub_id", subId);
      window.history.replaceState(null, "", `/?${params.toString()}`);
    } catch {
      // History API unavailable (rare embedded contexts) — non-fatal.
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, subId: subId || undefined }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setSearch({
          phase: "error",
          message: `The server returned an unreadable response (HTTP ${response.status}).`,
          code: "BAD_RESPONSE",
        });
        return;
      }

      if (response.ok && isSearchSuccess(data)) {
        setPlatformFilter("all");
        setSearch({
          phase: "success",
          products: data.products,
          source: data.source,
          keyword: data.keyword,
          notice: typeof data.notice === "string" ? data.notice : null,
        });
        return;
      }

      if (isApiError(data)) {
        setSearch({ phase: "error", message: data.error.message, code: data.error.code });
        return;
      }

      setSearch({
        phase: "error",
        message: `Unexpected server response (HTTP ${response.status}).`,
        code: "BAD_RESPONSE",
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      setSearch({
        phase: "error",
        message: timedOut
          ? "The search took too long and was cancelled. Please try again."
          : "Could not reach the search API. Check your connection and try again.",
        code: timedOut ? "TIMEOUT" : "NETWORK",
      });
    }
  }, []);

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void runSearch(keywordInput, subIdInput);
    },
    [runSearch, keywordInput, subIdInput],
  );

  /** Popular-search chips: real crawlable links, intercepted for instant UX. */
  const handleChipClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, keyword: string) => {
      event.preventDefault();
      setKeywordInput(keyword);
      void runSearch(keyword, subIdInput);
    },
    [runSearch, subIdInput],
  );

  const handleRetry = useCallback(() => {
    const last = lastQueryRef.current;
    if (last) void runSearch(last.keyword, last.subId);
  }, [runSearch]);

  /* ── Modal wizard ──────────────────────────────────────────────────── */
  const closeModal = useCallback(() => {
    setActiveProduct(null);
    setModalSubId("");
    setModalLink({ status: "idle" });
    setCopied(false);
    setCopyFailed(false);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  const openModal = useCallback(
    (product: Product) => {
      setActiveProduct(product);
      setModalSubId(subIdInput.trim());
      setCopied(false);
      setCopyFailed(false);
    },
    [subIdInput],
  );

  const modalSubIdError = validateSubId(modalSubId);

  /* ── Real link generation (debounced while the Sub-ID is edited) ──── */
  useEffect(() => {
    if (!activeProduct || !activeProduct.product_url || modalSubIdError) {
      setModalLink({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setModalLink({ status: "loading" });
      fetch("/api/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: activeProduct.product_url,
          subId: modalSubId.trim() || undefined,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data: unknown = await response.json().catch(() => null);
          if (
            response.ok &&
            typeof data === "object" &&
            data !== null &&
            (data as Record<string, unknown>).ok === true
          ) {
            const record = data as Record<string, unknown>;
            setModalLink({
              status: "ready",
              link: typeof record.link === "string" ? record.link : "",
              resolved: typeof record.resolved === "string" ? record.resolved : null,
            });
            return;
          }
          const maybeError =
            typeof data === "object" && data !== null
              ? (data as Record<string, unknown>).error
              : null;
          const err =
            typeof maybeError === "object" && maybeError !== null
              ? (maybeError as Record<string, unknown>)
              : null;
          setModalLink({
            status: "error",
            message:
              typeof err?.message === "string"
                ? err.message
                : `The link service returned HTTP ${response.status}.`,
            code: typeof err?.code === "string" ? err.code : "BAD_RESPONSE",
          });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setModalLink({
            status: "error",
            message: "Could not reach the link service. Check your connection and try again.",
            code: "NETWORK",
          });
        });
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeProduct, modalSubId, modalSubIdError]);

  /* Close on Escape + lock body scroll while the modal is open. */
  useEffect(() => {
    if (!activeProduct) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeProduct, closeModal]);

  const handleCopy = useCallback(async () => {
    if (modalLink.status !== "ready") return;
    const succeeded = await copyToClipboard(modalLink.link);
    setCopyFailed(!succeeded);
    if (succeeded) {
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }, [modalLink]);

  /* ── Derived data ──────────────────────────────────────────────────── */
  const platformCounts = useMemo(() => {
    const counts = new Map<Platform, number>();
    if (search.phase === "success") {
      for (const product of search.products) {
        counts.set(product.platform, (counts.get(product.platform) ?? 0) + 1);
      }
    }
    return counts;
  }, [search]);

  const visibleProducts = useMemo(() => {
    if (search.phase !== "success") return [];
    if (platformFilter === "all") return search.products;
    return search.products.filter((product) => product.platform === platformFilter);
  }, [search, platformFilter]);

  const isSearching = search.phase === "loading";
  const canSubmit = keywordInput.trim() !== "" && subIdError === null && !isSearching;

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <section id="search" aria-labelledby="search-heading" className="scroll-mt-20 pt-8 sm:pt-10">
      {/* Screen-reader heading keeps the h1→h2→h3 outline valid for crawlers. */}
      <h2 id="search-heading" className="sr-only">
        Product search
      </h2>

      {/* Search panel */}
      <div className="rounded-2xl bg-slate-900/70 p-4 shadow-card ring-1 ring-white/10 backdrop-blur sm:p-5">
        <form role="search" aria-label="Search Shopee, Lazada and TikTok Shop products" onSubmit={handleFormSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="keyword" className="field-label">
              Product keyword
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="keyword"
                name="keyword"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                maxLength={120}
                placeholder="e.g. wireless earbuds, air fryer, running shoes…"
                autoComplete="off"
                className="h-12 w-full rounded-xl bg-slate-800/80 pl-10 pr-4 text-sm text-slate-100 outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="min-w-0 lg:w-72">
            <label htmlFor="subid" className="field-label flex items-center justify-between">
              Sub-ID / channel tracking
              <span className="font-medium normal-case tracking-normal text-slate-600">
                optional
              </span>
            </label>
            <div className="relative">
              <TagIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="subid"
                name="sub_id"
                value={subIdInput}
                onChange={(event) => setSubIdInput(event.target.value)}
                maxLength={64}
                placeholder="e.g. fb-reels, tiktok-bio"
                autoComplete="off"
                spellCheck={false}
                className={`h-12 w-full rounded-xl bg-slate-800/80 pl-10 pr-4 text-sm text-slate-100 outline-none ring-1 ring-inset transition placeholder:text-slate-500 ${
                  subIdError
                    ? "ring-rose-500/60 focus:ring-2 focus:ring-rose-500"
                    : "ring-white/10 focus:ring-2 focus:ring-indigo-500"
                }`}
              />
            </div>
            {subIdError && <p className="mt-1.5 text-xs text-rose-400">{subIdError}</p>}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {isSearching ? (
              <>
                <Spinner className="h-4 w-4 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <SearchIcon className="h-4 w-4" />
                Search
              </>
            )}
          </button>
        </form>
      </div>

      {/* Results / state region */}
      <div aria-live="polite" className="space-y-6 pt-6">
        {search.phase === "idle" && (
          <div className="animate-rise-in">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Popular searches
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((keyword) => (
                <li key={keyword}>
                  <a
                    href={`/?keyword=${encodeURIComponent(keyword)}`}
                    onClick={(event) => handleChipClick(event, keyword)}
                    className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-slate-800 hover:text-white hover:ring-white/25"
                  >
                    {keyword}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {search.phase === "loading" && <SkeletonGrid />}

        {search.phase === "error" && (
          <ErrorPanel
            message={search.message}
            code={search.code}
            onRetry={lastQueryRef.current ? handleRetry : null}
          />
        )}

        {search.phase === "success" && (
          <>
            {search.source === "demo" && search.notice && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{search.notice}</p>
              </div>
            )}

            {search.products.length === 0 ? (
              <EmptyState keyword={search.keyword} notice={search.notice} />
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    <span className="font-bold text-white">{visibleProducts.length}</span>{" "}
                    {visibleProducts.length === 1 ? "product" : "products"} for{" "}
                    <span className="font-semibold text-slate-200">“{search.keyword}”</span>
                    {subIdTrimmed !== "" && subIdError === null && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-violet-400/30">
                        <TagIcon className="h-3 w-3" />
                        <span className="font-mono">{subIdTrimmed}</span>
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter results by platform">
                    <button
                      type="button"
                      onClick={() => setPlatformFilter("all")}
                      aria-pressed={platformFilter === "all"}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                        platformFilter === "all"
                          ? "bg-white text-slate-900 ring-white"
                          : "bg-slate-900/70 text-slate-300 ring-white/10 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      All ({search.products.length})
                    </button>
                    {FILTER_PLATFORMS.filter(
                      (option) => (platformCounts.get(option.id) ?? 0) > 0,
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPlatformFilter(option.id)}
                        aria-pressed={platformFilter === option.id}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                          platformFilter === option.id
                            ? "bg-white text-slate-900 ring-white"
                            : "bg-slate-900/70 text-slate-300 ring-white/10 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {option.label} ({platformCounts.get(option.id)})
                      </button>
                    ))}
                  </div>
                </div>

                {visibleProducts.length === 0 ? (
                  <EmptyState
                    keyword={search.keyword}
                    notice={`No ${platformFilter === "all" ? "" : PLATFORM_META[platformFilter].label.toLowerCase() + " "}products in these results. Switch filters or search again.`}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {visibleProducts.map((product) => (
                      <ProductCard key={product.id} product={product} onGenerate={openModal} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal wizard — real Ecomobi link generation */}
      {activeProduct && (
        <LinkModal
          product={activeProduct}
          linkState={modalLink}
          subId={modalSubId}
          onSubIdChange={setModalSubId}
          subIdError={modalSubIdError}
          copied={copied}
          copyFailed={copyFailed}
          onCopy={() => void handleCopy()}
          onClose={closeModal}
        />
      )}
    </section>
  );
}

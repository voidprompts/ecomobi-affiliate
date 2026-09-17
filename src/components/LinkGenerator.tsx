/******************************************************************************
 * INSTANT LINK GENERATOR — CLIENT COMPONENT
 * File: src/components/LinkGenerator.tsx
 *
 * The real core feature of the dashboard, built on the verified Ecomobi
 * "Dynamic Link" API (goeco.mobi): paste ANY product URL from an approved
 * store (shopee.ph, lazada.com.ph, …), optionally tag it with a Sub-ID
 * channel label, and get back a ready-to-share tracked affiliate link —
 * the exact link format documented at affiliate.passio.eco/pub-api-document.
 *
 * Also loads the publisher's LIVE campaign list from /api/advertisers so the
 * supported stores (with real commission rates) are always current.
 ******************************************************************************/

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUB_ID_PARAM_NOTE, validateSubId } from "@/lib/format";
import { AlertIcon, BoltIcon, CopyIcon, ExternalIcon, LinkIcon, Spinner, TagIcon } from "./ui";

interface LinkSuccess {
  ok: true;
  link: string;
  resolved: string | null;
  channel: string | null;
}

interface Campaign {
  id: string;
  name: string;
  country: string | null;
  commission: string | null;
}

const SUB_ID_STORAGE_KEY = "ecomobi-dashboard:sub-id";

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
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
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}

function resolvedDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export default function LinkGenerator() {
  const [productUrl, setProductUrl] = useState("");
  const [subId, setSubId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkSuccess | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const subIdError = validateSubId(subId);
  const canGenerate = productUrl.trim() !== "" && subIdError === null && !loading;

  /* Restore the last Sub-ID + load the live campaign list on mount. */
  useEffect(() => {
    try {
      setSubId(window.localStorage.getItem(SUB_ID_STORAGE_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
    let cancelled = false;
    fetch("/api/advertisers")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled || typeof data !== "object" || data === null) return;
        const record = data as Record<string, unknown>;
        if (record.ok !== true || !Array.isArray(record.advertisers)) return;
        const list: Campaign[] = [];
        for (const entry of record.advertisers) {
          if (typeof entry !== "object" || entry === null) continue;
          const item = entry as Record<string, unknown>;
          if (typeof item.id !== "string" || typeof item.name !== "string") continue;
          list.push({
            id: item.id,
            name: item.name,
            country: typeof item.country === "string" ? item.country : null,
            commission: typeof item.commission === "string" ? item.commission : null,
          });
        }
        // PH campaigns first, then the rest — most relevant for this audience.
        setCampaigns(
          [...list].sort((a, b) => {
            const aPH = a.country === "PH" ? 0 : 1;
            const bPH = b.country === "PH" ? 0 : 1;
            return aPH - bPH || a.name.localeCompare(b.name);
          }),
        );
      })
      .catch(() => {
        /* campaign list is a bonus — ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const url = productUrl.trim();
      const channel = subId.trim();
      if (url === "") return;

      setLoading(true);
      setError(null);
      setResult(null);
      setCopied(false);
      setCopyFailed(false);

      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 30_000);
        let response: Response;
        try {
          response = await fetch("/api/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, subId: channel || undefined }),
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeout);
        }

        const data: unknown = await response.json().catch(() => null);
        if (
          response.ok &&
          typeof data === "object" &&
          data !== null &&
          (data as Record<string, unknown>).ok === true
        ) {
          const record = data as Record<string, unknown>;
          setResult({
            ok: true,
            link: typeof record.link === "string" ? record.link : "",
            resolved: typeof record.resolved === "string" ? record.resolved : null,
            channel: typeof record.channel === "string" ? record.channel : null,
          });
          return;
        }
        if (
          typeof data === "object" &&
          data !== null &&
          typeof (data as Record<string, unknown>).error === "object" &&
          (data as Record<string, unknown>).error !== null
        ) {
          const err = (data as Record<string, unknown>).error as Record<string, unknown>;
          setError({
            code: typeof err.code === "string" ? err.code : "ERROR",
            message: typeof err.message === "string" ? err.message : "Link generation failed.",
          });
          return;
        }
        setError({
          code: "BAD_RESPONSE",
          message: `The server returned an unreadable response (HTTP ${response.status}).`,
        });
      } catch (caught) {
        const timedOut = caught instanceof Error && caught.name === "AbortError";
        setError({
          code: timedOut ? "TIMEOUT" : "NETWORK",
          message: timedOut
            ? "The request took too long and was cancelled. Try again."
            : "Could not reach the link service. Check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [productUrl, subId],
  );

  const handleCopy = useCallback(async () => {
    if (!result?.link) return;
    const succeeded = await copyToClipboard(result.link);
    setCopyFailed(!succeeded);
    if (succeeded) {
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const domain = resolvedDomain(result?.resolved ?? null);

  return (
    <div className="rounded-2xl bg-slate-900/70 p-4 shadow-card ring-1 ring-white/10 backdrop-blur sm:p-6">
      <form onSubmit={handleGenerate} className="space-y-4">
        <div>
          <label htmlFor="generator-url" className="field-label">
            Product URL from any approved store
          </label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="generator-url"
              type="url"
              inputMode="url"
              value={productUrl}
              onChange={(event) => setProductUrl(event.target.value)}
              maxLength={2048}
              placeholder="https://shopee.ph/product/… or https://www.lazada.com.ph/products/…"
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-xl bg-slate-800/80 pl-10 pr-4 text-sm text-slate-100 outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Copy any product link from the Shopee or Lazada app/site, paste it here, and get a
            tracked Ecomobi affiliate link back. {SUB_ID_PARAM_NOTE}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="generator-subid" className="field-label flex items-center justify-between">
              Sub-ID / channel tracking
              <span className="font-medium normal-case tracking-normal text-slate-600">optional</span>
            </label>
            <div className="relative">
              <TagIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="generator-subid"
                value={subId}
                onChange={(event) => setSubId(event.target.value)}
                maxLength={64}
                placeholder="e.g. fb-reels, tiktok-bio, youtube-07"
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
            disabled={!canGenerate}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <BoltIcon className="h-4 w-4" />
                Generate Link
              </>
            )}
          </button>
        </div>
      </form>

      {/* Result */}
      {result && result.link && (
        <div className="mt-5 animate-rise-in rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4" role="status">
          <p className="field-label mb-2">Your tracked affiliate link — ready to share</p>
          <div className="break-all rounded-lg bg-slate-950/70 p-3 font-mono text-xs leading-5 text-slate-300 ring-1 ring-white/10 select-all">
            {result.link}
          </div>
          {domain && (
            <p className="mt-2 text-xs text-slate-500">
              Resolves through Ecomobi to <span className="font-semibold text-slate-300">{domain}</span>
              {result.channel ? (
                <>
                  {" "}· channel <span className="font-mono text-violet-300">{result.channel}</span>
                </>
              ) : null}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                copied
                  ? "bg-emerald-500 text-white hover:bg-emerald-400"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-400"
              }`}
            >
              {copied ? "Copied! ✅" : (<><CopyIcon className="h-4 w-4" /> Copy Link</>)}
            </button>
            <a
              href={result.link}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/5 px-5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 transition hover:bg-white/10"
            >
              <ExternalIcon className="h-4 w-4" />
              Test Open
            </a>
          </div>
          {copyFailed && (
            <p className="mt-2 text-xs text-amber-400">
              Automatic copy was blocked — click the link text and press Ctrl/Cmd+C.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-5 animate-rise-in rounded-xl border border-rose-500/25 bg-rose-500/10 p-4" role="alert">
          <div className="flex items-start gap-2.5">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-white">Link generation failed</p>
              <p className="mt-1 text-sm leading-6 text-rose-200/90">{error.message}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-rose-300/60">
                error: {error.code}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live campaigns */}
      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {campaigns === null ? "Loading your Ecomobi campaigns…" : `Your live Ecomobi campaigns (${campaigns.length})`}
        </p>
        {campaigns !== null && campaigns.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Approved Ecomobi campaigns">
            {campaigns.slice(0, 12).map((campaign) => (
              <li
                key={campaign.id}
                title={campaign.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                  campaign.country === "PH"
                    ? "bg-indigo-500/10 text-indigo-200 ring-indigo-400/30"
                    : "bg-slate-800/60 text-slate-400 ring-white/10"
                }`}
              >
                {campaign.name}
                {campaign.commission && (
                  <span className="font-mono text-[10px] text-emerald-300">{campaign.commission}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {campaigns !== null && campaigns.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            No campaigns found — check that your ECOMOBI_API_TOKEN is set correctly.
          </p>
        )}
      </div>
    </div>
  );
}

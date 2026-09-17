/******************************************************************************
 * LIVE CAMPAIGNS — ECOMOBI ADVERTISERS
 * File: src/app/api/advertisers/route.ts
 *
 * GET /api/advertisers
 *
 * Proxies the verified Ecomobi publisher endpoint
 *   GET https://api.ecotrackings.com/api/v3/advertisers?token=<TOKEN>&limit=100
 * and returns a normalized campaign list for the UI:
 *
 *   { ok: true, count, advertisers: [{ id, name, country, currency,
 *     category, commission, homepage, cookie_rule }] }
 *
 * HTML fragments in the upstream text fields are stripped, and the response
 * is cached in-memory for one hour to stay far below any upstream rate limit.
 ******************************************************************************/

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_TOKEN = (process.env.ECOMOBI_API_TOKEN ?? "").trim();
const API_BASE_URL = (
  process.env.ECOMOBI_API_BASE_URL ?? "https://api.ecotrackings.com"
)
  .trim()
  .replace(/\/+$/, "");

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 12_000;

interface CachedAdvertisers {
  fetchedAt: number;
  advertisers: NormalizedAdvertiser[];
}

export interface NormalizedAdvertiser {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  category: string | null;
  commission: string | null;
  homepage: string | null;
  cookie_rule: string | null;
}

let cache: CachedAdvertisers | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strip HTML tags/entities from upstream rich-text fields. */
function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const decoded = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  if (collapsed === "") return null;
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength).trimEnd()}…` : collapsed;
}

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeAdvertisers(payload: unknown): NormalizedAdvertiser[] | null {
  if (!isRecord(payload)) return null;
  const data = payload.data;
  if (!Array.isArray(data)) return null;

  const advertisers: NormalizedAdvertiser[] = [];
  for (const entry of data) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (id === "" && name === "") continue;
    advertisers.push({
      id: id !== "" ? id : name,
      name: name !== "" ? name : id,
      country: cleanText(entry.country, 8),
      currency: cleanText(entry.currency, 8),
      category: cleanText(entry.category, 40),
      commission: cleanText(entry.commission, 24),
      homepage: cleanText(entry.homepage, 200),
      cookie_rule: cleanText(entry.cookie_rule, 220),
    });
  }
  return advertisers;
}

export async function GET(): Promise<NextResponse> {
  try {
    if (API_TOKEN === "") {
      return json(
        {
          ok: false,
          error: {
            code: "CONFIG_ERROR",
            message:
              "ECOMOBI_API_TOKEN is not configured. Add it to .env.local / Vercel and redeploy.",
          },
        },
        503,
      );
    }

    if (cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return json({ ok: true, count: cache.advertisers.length, advertisers: cache.advertisers });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v3/advertisers?token=${encodeURIComponent(API_TOKEN)}&limit=100`,
        { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" },
      );

      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        return json(
          {
            ok: false,
            error: {
              code: "ECOMOBI_INVALID_RESPONSE",
              message: "Ecomobi returned a non-JSON response for the advertisers endpoint.",
            },
          },
          502,
        );
      }

      // Their API reports some failures as HTTP 200 + error body.
      if (isRecord(payload) && isRecord(payload.error)) {
        const message =
          typeof payload.error.message === "string"
            ? payload.error.message
            : typeof payload.error.messsage === "string"
              ? payload.error.messsage
              : "";
        return json(
          {
            ok: false,
            error: {
              code: "ECOMOBI_AUTH_FAILED",
              message:
                message.toLowerCase().includes("token")
                  ? "Ecomobi rejected the API token for the advertisers endpoint. Re-copy the Token value from your Passio dashboard → API Settings."
                  : `Ecomobi advertisers endpoint error: ${message || "unknown"}`,
            },
          },
          502,
        );
      }

      const advertisers = normalizeAdvertisers(payload);
      if (advertisers === null) {
        return json(
          {
            ok: false,
            error: {
              code: "ECOMOBI_INVALID_RESPONSE",
              message: "Ecomobi's advertisers response had an unexpected shape.",
            },
          },
          502,
        );
      }

      cache = { fetchedAt: Date.now(), advertisers };
      return json({ ok: true, count: advertisers.length, advertisers });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json(
        {
          ok: false,
          error: { code: "ECOMOBI_TIMEOUT", message: "Ecomobi did not respond within 12s." },
        },
        504,
      );
    }
    console.error("[/api/advertisers] Unexpected error:", error);
    return json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
      },
      500,
    );
  }
}

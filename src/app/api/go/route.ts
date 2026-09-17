/******************************************************************************
 * TRACKED OUTBOUND REDIRECT — SERVER-SIDE TOKEN INJECTION
 * File: src/app/api/go/route.ts
 *
 * GET /api/go?url=<encoded product URL>&sub1=<channel>
 *
 * Used by the pre-rendered trending grid (and any outbound deal link) so the
 * Ecomobi token never appears in the public HTML: this route validates the
 * target URL, injects the server-side token into the goeco.mobi Dynamic Link
 * pipeline, and 302-redirects the shopper. Clicks and orders are attributed
 * to the publisher account with the requested channel Sub-ID (sub1).
 *
 *   /api/go?url=https%3A%2F%2Fshopee.ph%2F…&sub1=web-trending
 *     → 302 https://goeco.mobi/?token=<server-secret>&url=…&sub1=web-trending
 *     → 302 https://s.shopee.ph/an_redir?…affiliate_id=…
 ******************************************************************************/

import { NextRequest, NextResponse } from "next/server";
import { buildTrackedUrl, isValidProductUrl } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUB_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  if (RATE_LIMIT_MAX <= 0) return true;
  const now = Date.now();
  if (rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (bucket === undefined || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count < RATE_LIMIT_MAX) {
    bucket.count += 1;
    return true;
  }
  return false;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!checkRateLimit(clientIp(request))) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many redirects. Slow down." } },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rawUrl = (request.nextUrl.searchParams.get("url") ?? "").trim();
    const sub1 = (request.nextUrl.searchParams.get("sub1") ?? "").trim();

    if (rawUrl === "" || !isValidProductUrl(rawUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "A valid product URL is required." },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (sub1 !== "" && !SUB_ID_PATTERN.test(sub1)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid channel Sub-ID." },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if ((process.env.ECOMOBI_API_TOKEN ?? "").trim() === "") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONFIG_ERROR",
            message: "ECOMOBI_API_TOKEN is not configured on the server.",
          },
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const tracked = buildTrackedUrl(rawUrl, sub1 !== "" ? sub1 : null);
    return NextResponse.redirect(tracked, 302);
  } catch (error) {
    console.error("[/api/go] Unexpected error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Unexpected redirect error." },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

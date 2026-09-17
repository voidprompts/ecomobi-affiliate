/******************************************************************************
 * AFFILIATE LINK GENERATOR — ECOMOBI DYNAMIC LINK (goeco.mobi)
 * File: src/app/api/link/route.ts
 *
 * POST /api/link  { url: "https://shopee.ph/product/…", subId?: "fb-reels" }
 *
 * Validates the product URL, calls the Ecomobi Dynamic Link service with the
 * server-side token, and returns the ready-to-share tracked affiliate link
 * plus a preview of the final merchant URL it resolves to:
 *
 *   { ok: true, link, resolved, channel }
 *
 * Errors use the standard envelope: { ok: false, error: { code, message } }
 * with LINK_* codes mapped from goeco.mobi's err_code responses.
 ******************************************************************************/

import { NextRequest, NextResponse } from "next/server";
import { isValidProductUrl, resolveTrackedLink } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUB_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  if (RATE_LIMIT_MAX <= 0) return true;
  const now = Date.now();
  if (rateBuckets.size > 5_000) {
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

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!checkRateLimit(clientIp(request))) {
      return json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many link generations from this client. Try again in a minute.",
          },
        },
        429,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: 'Request body must be valid JSON, e.g. { "url": "https://shopee.ph/…" }.',
          },
        },
        400,
      );
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: 'Request body must be a JSON object, e.g. { "url": "https://shopee.ph/…" }.',
          },
        },
        400,
      );
    }

    const record = body as Record<string, unknown>;
    const rawUrl = typeof record.url === "string" ? record.url.trim() : "";
    const rawSubId =
      typeof record.subId === "string"
        ? record.subId.trim()
        : typeof record.sub_id === "string"
          ? record.sub_id.trim()
          : "";

    if (rawUrl === "") {
      return json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "A product URL is required. Paste the full product link from the store.",
          },
        },
        400,
      );
    }
    if (!isValidProductUrl(rawUrl)) {
      return json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "That URL is not valid. It must start with http:// or https:// and point to a real store domain.",
          },
        },
        400,
      );
    }
    if (rawSubId !== "" && !SUB_ID_PATTERN.test(rawSubId)) {
      return json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Sub-ID may only contain letters, numbers, dots, dashes and underscores (max 64 characters).",
          },
        },
        400,
      );
    }

    const result = await resolveTrackedLink(rawUrl, rawSubId !== "" ? rawSubId : null);
    if (!result.ok) {
      const status =
        result.code === "CONFIG_ERROR" ? 503 : result.code.startsWith("LINK_AUTH") ? 502 : 502;
      return json({ ok: false, error: { code: result.code, message: result.message } }, status);
    }

    return json({
      ok: true,
      link: result.link,
      resolved: result.resolved,
      channel: rawSubId !== "" ? rawSubId : null,
    });
  } catch (error) {
    console.error("[/api/link] Unexpected error:", error);
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

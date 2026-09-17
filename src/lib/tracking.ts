/******************************************************************************
 * ECOMOBI DYNAMIC LINK — SERVER-ONLY HELPERS
 * File: src/lib/tracking.ts
 *
 * Implements the verified "Dynamic Link" contract from the Ecomobi publisher
 * API documentation (affiliate.passio.eco/pub-api-document):
 *
 *   GET https://goeco.mobi/?token={token}&url={url}&sub1={sub1}&sub2=…
 *
 *   • The constructed goeco.mobi URL IS the shareable tracking link — it
 *     302-redirects shoppers to the merchant with the publisher's affiliate
 *     id and channel Sub-IDs recorded in Ecomobi's click pipeline.
 *   • Errors are ALSO 302 redirects, to /error?err_code=<code> — the known
 *     codes are mapped to friendly messages below.
 *
 * SECURITY: this module reads ECOMOBI_API_TOKEN from the server environment
 * and must only be imported by API routes — never from client components.
 ******************************************************************************/

const GOECO_BASE = (
  process.env.ECOMOBI_LINK_BASE ?? "https://goeco.mobi"
)
  .trim()
  .replace(/\/+$/, "");

const API_TOKEN = (process.env.ECOMOBI_API_TOKEN ?? "").trim();

/** Upstream call budget. */
const RESOLVE_TIMEOUT_MS = 12_000;

export interface TrackedLinkSuccess {
  ok: true;
  /** Shareable tracked link (the goeco.mobi URL, token included by design). */
  link: string;
  /** Final merchant affiliate URL captured from the 302 (when available). */
  resolved: string | null;
}

export interface TrackedLinkFailure {
  ok: false;
  code: string;
  message: string;
}

export type TrackedLinkResult = TrackedLinkSuccess | TrackedLinkFailure;

/** Friendly mappings for goeco.mobi's /error?err_code=… responses. */
const ERROR_CODES: Record<string, { code: string; message: string }> = {
  empty_url: {
    code: "LINK_INVALID_URL",
    message: "A product URL is required. Paste the full product link from the store's app or website.",
  },
  invalid_url: {
    code: "LINK_INVALID_URL",
    message: "That URL doesn't look valid. Paste the full product link (starting with https://).",
  },
  empty_advertiser: {
    code: "LINK_STORE_NOT_SUPPORTED",
    message:
      "That store is not in your Ecomobi campaign list. Dynamic links work with your approved stores (e.g. shopee.ph, lazada.com.ph).",
  },
  campaign_not_running: {
    code: "LINK_CAMPAIGN_NOT_RUNNING",
    message:
      "That store's Ecomobi campaign is not currently active for dynamic links. Try another store or check the campaign in your Passio dashboard.",
  },
  publisher_not_found: {
    code: "LINK_AUTH_FAILED",
    message:
      "Ecomobi rejected the API token. Re-copy the exact Token value (not Token Private) from your Passio dashboard → API Settings into ECOMOBI_API_TOKEN.",
  },
  forbidden: {
    code: "LINK_FORBIDDEN",
    message: "Your publisher account does not have permission to use the Dynamic Link feature.",
  },
};

function mapErrCode(rawCode: string): TrackedLinkFailure {
  const normalized = rawCode.trim().replace(/\.$/, "");
  const known = ERROR_CODES[normalized];
  if (known) return { ok: false, code: known.code, message: known.message };
  return {
    ok: false,
    code: "LINK_UPSTREAM_ERROR",
    message: `Ecomobi's link service returned an error (code: ${normalized || "unknown"}). Try again shortly.`,
  };
}

/** Build the shareable goeco.mobi tracking URL (token injected server-side). */
export function buildTrackedUrl(
  productUrl: string,
  subId: string | null,
): string {
  const params = new URLSearchParams({
    token: API_TOKEN,
    url: productUrl,
  });
  const channel = (subId ?? "").trim();
  if (channel) params.set("sub1", channel);
  return `${GOECO_BASE}/?${params.toString()}`;
}

/**
 * Validate a product URL and resolve it through the Ecomobi Dynamic Link
 * service: returns the shareable tracked link plus the final merchant
 * affiliate URL it redirects to (when the upstream provides one).
 */
export async function resolveTrackedLink(
  productUrl: string,
  subId: string | null,
): Promise<TrackedLinkResult> {
  if (API_TOKEN === "") {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      message:
        "ECOMOBI_API_TOKEN is not configured. Add it to .env.local / Vercel and redeploy.",
    };
  }

  const trackedUrl = buildTrackedUrl(productUrl, subId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

  try {
    const res = await fetch(trackedUrl, {
      method: "GET",
      redirect: "manual", // capture the 302 instead of following it
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    const location = res.headers.get("location");

    // Errors are 302s to /error?err_code=…
    if (location && location.startsWith("/error")) {
      const query = location.split("?", 2)[1] ?? "";
      const errCode = new URLSearchParams(query).get("err_code") ?? "";
      return mapErrCode(errCode);
    }

    // Success: the 302 target is the final merchant affiliate URL.
    if (location && /^https?:\/\//i.test(location)) {
      return { ok: true, link: trackedUrl, resolved: location };
    }

    // 200 responses (unexpected shape) — the constructed URL still works
    // as a tracked link when opened, so return it with no preview.
    if (res.ok) return { ok: true, link: trackedUrl, resolved: null };

    return mapErrCode(`http_${res.status}`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        code: "LINK_TIMEOUT",
        message: "Ecomobi's link service did not respond within 12s. Try again.",
      };
    }
    const detail = error instanceof Error ? error.message : "unknown error";
    return {
      ok: false,
      code: "LINK_UPSTREAM_ERROR",
      message: `Could not reach Ecomobi's link service (${detail}). Try again shortly.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** True when a value is a plausibly valid public product URL. */
export function isValidProductUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

# Ecomobi Affiliate Dashboard — Live API Edition

Production-ready **E-Commerce Search & Affiliate Dashboard** built with
**Next.js 14 (App Router)** and **Tailwind CSS**, integrated with the **real
Ecomobi publisher API** (verified against the official documentation at
`affiliate.passio.eco/pub-api-document`). Deploys to **Vercel with zero
configuration**.

## What actually works — live-verified

| Feature | Status | How |
|---|---|---|
| **Instant Link Generator** | ✅ LIVE | Paste any product URL from an approved store → real `goeco.mobi` tracked affiliate link with your Sub-ID channel (`sub1`), validated through the Ecomobi Dynamic Link service |
| **Campaign list** | ✅ LIVE | All **78 approved advertisers** from your account (Lazada PH 9.6%, Shopee PH 3.2%, Adidas PH, Shein 12%, …) with commission rates |
| **Tracked trending grid** | ✅ LIVE | Every "View Deal" click routes through `/api/go` → `goeco.mobi` with server-side token injection and the `web-trending` channel Sub-ID |
| **Product search** | ✅ with Apify | Set `APIFY_TOKEN` and search returns **real Shopee/Lazada products rendered inside the site** (grids, prices, images, "Generate Link" on every card). Actors come from the [ecommerce-intelligence-apis](https://github.com/cporter202/ecommerce-intelligence-apis) catalog. Without a token, a labeled sample catalog + tracked deep-search buttons are served |
| **Conversions reporting** | 🔜 Roadmap | The documented `/api/v3/conversions` endpoint (token_private, ≤90-day ranges) is available but intentionally not exposed in the UI |

**Verified live behavior:** `shopee.ph/product/…` → `s.shopee.ph/an_redir?…affiliate_id=13248560000…`,
`lazada.com.ph/…` → `c.lazada.com.ph/t/…`, unsupported stores and inactive
campaigns return friendly, actionable errors.

---

## Architecture

```
src/app/page.tsx                    ○ SSG server shell — metadata, JSON-LD, hero,
│                                     generator section, trending grid, how-it-works
├── src/components/
│   ├── SearchDashboard.tsx         CLIENT island — search form, results grid,
│   │                                 modal (real link generation via /api/link)
│   ├── LinkGenerator.tsx           CLIENT — the real core: paste URL → tracked link
│   │                                 + live campaign chips from /api/advertisers
│   ├── TrendingSection.tsx         SERVER — pre-rendered grid, links via /api/go
│   └── ui.tsx                      Shared icons + platform badges
├── src/app/api/
│   ├── link/route.ts               POST → real goeco.mobi Dynamic Link generation
│   ├── go/route.ts                 GET → 302 tracked redirect (token server-side)
│   ├── advertisers/route.ts        GET → live campaign list (1h cache)
│   └── search/route.ts             POST/GET → product search (live or demo)
└── src/lib/
    ├── tracking.ts                 SERVER-ONLY goeco.mobi helpers + error mapping
    ├── types.ts / format.ts / site.ts / trending-products.ts
```

**Security model:** the public `Token` lives only in server environment
variables. It is injected into `goeco.mobi` URLs by `/api/link` and `/api/go`
server-side and never appears in the page HTML. The **Token Private** is not
used by the app at all — it is for the conversions reporting endpoint only and
must never be exposed to any browser-facing code.

**SEO:** statically pre-rendered shell (single h1, h2→h3 cascade, 13 `<article>`
elements, descriptive alt text on every image, ItemList + WebSite +
SearchAction JSON-LD, canonical/OpenGraph/Twitter metadata, `robots.txt`,
`sitemap.xml`, 1200×630 OG image) — all crawler-visible with zero JavaScript.

---

## Quick start

```bash
npm install
npm run dev        # → http://localhost:3000 (demo mode, no token needed)
```

For live data, set your token (Passio dashboard → API Settings → copy the
public **Token**, not the Token Private):

```bash
# .env.local (local)  — or Vercel → Settings → Environment Variables (production)
ECOMOBI_API_TOKEN=your_public_token_here
```

```bash
npm run build && npm start
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ECOMOBI_API_TOKEN` | ✅ | — | Public publisher Token (Passio → API Settings). NOT the Token Private |
| `ECOMOBI_API_BASE_URL` | — | `https://api.ecotrackings.com` | Ecomobi/Passio API host (verified) |
| `ECOMOBI_SEARCH_ENDPOINT` | — | `/api/v3/products` | Product endpoint (verified; empty until feeds are enabled) |
| `ECOMOBI_LINK_BASE` | — | `https://goeco.mobi` | Ecomobi Dynamic Link service (verified) |
| `ECOMOBI_AUTH_SCHEME` | — | `query` | Token transport for the product endpoint: `query` / `bearer` / `apikey` |
| `ECOMOBI_TOKEN_PARAM` | — | `token` | Query-param name when auth scheme is `query` |
| `DEMO_MODE` | — | `auto` | `auto` (demo only without token) / `true` / `false` |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | — | `₱` | Price symbol in the UI |
| `NEXT_PUBLIC_SITE_URL` | — | auto | Canonical/sitemap/OG base URL — auto-detected on Vercel |
| `RATE_LIMIT_MAX` | — | `30` | Requests per window per IP (search + link routes) |

---

## API reference

### `POST /api/link` — generate a tracked affiliate link

```bash
curl -X POST https://your-app.vercel.app/api/link \
  -H "Content-Type: application/json" \
  -d '{"url":"https://shopee.ph/product/123/456","subId":"fb-reels"}'
```

```json
{
  "ok": true,
  "link": "https://goeco.mobi/?token=…&url=https%3A%2F%2Fshopee.ph%2F…&sub1=fb-reels",
  "resolved": "https://s.shopee.ph/an_redir?origin_link=…&affiliate_id=…",
  "channel": "fb-reels"
}
```

`link` is the ready-to-share tracked URL; `resolved` is the final merchant
affiliate URL it 302-redirects to (useful as a sanity preview). Error codes:
`LINK_INVALID_URL`, `LINK_STORE_NOT_SUPPORTED` (store not in your campaigns),
`LINK_CAMPAIGN_NOT_RUNNING`, `LINK_AUTH_FAILED`, `LINK_FORBIDDEN`,
`LINK_TIMEOUT`, `LINK_UPSTREAM_ERROR`, `RATE_LIMITED`.

### `GET /api/go?url=…&sub1=…` — tracked outbound redirect

Used by the pre-rendered trending grid. Validates the URL, injects the
server-side token, and 302-redirects the shopper through `goeco.mobi`. The
token never appears in the public HTML.

### `GET /api/advertisers` — live campaign list

Proxies `GET https://api.ecotrackings.com/api/v3/advertisers?token=…&limit=100`,
strips HTML from rich-text fields, caches for one hour, and returns
`{ ok, count, advertisers: [{ id, name, country, currency, category, commission, homepage, cookie_rule }] }`.

### `POST|GET /api/search` — product search

```bash
curl -X POST https://your-app.vercel.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"wireless earbuds","subId":"fb-reels","limit":24}'
```

Success: `{ ok: true, source, keyword, sub_id, count, products: [...] }` with
the uniform product schema (`title`, `price`, `store_name`, `image_url`,
`product_url`, `platform`, `commission_rate`, `rating`, `sold`). Errors use
`{ ok: false, error: { code, message } }` with codes `VALIDATION_ERROR`,
`RATE_LIMITED`, `CONFIG_ERROR`, `ECOMOBI_AUTH_FAILED`,
`ECOMOBI_ENDPOINT_NOT_FOUND`, `ECOMOBI_TIMEOUT`, `ECOMOBI_NETWORK_ERROR`,
`INTERNAL_ERROR`.

> **Note:** with a valid token the search hits the real
> `api.ecotrackings.com/api/v3/products` endpoint, which currently returns an
> empty catalog for accounts without product feeds — the UI shows a helpful
> notice pointing to the Instant Link Generator in that case. Without a token
> (`DEMO_MODE=auto`), a clearly-labeled sample catalog is served so the UI
> stays fully explorable.

### The upstream contract (from the official docs)

| Endpoint | Auth | Notes |
|---|---|---|
| `GET api.ecotrackings.com/api/v3/conversions` | `token_private` | Earnings report; date range ≤ 90 days; fields include `sub1`–`sub4`, payouts, `item_list` |
| `GET api.ecotrackings.com/api/v3/advertisers` | `token` | Campaign list with commission, cookie rules |
| `GET goeco.mobi/?token=…&url=…&sub1=…` | `token` | Dynamic Link — the constructed URL is the shareable tracked link; errors return as `302 → /error?err_code=…` (`empty_url`, `empty_advertiser`, `campaign_not_running`, `publisher_not_found`, …) |

---

## Live product search inside the site (Apify)

Ecomobi's API doesn't expose a product catalog, and the marketplaces block
product-listing requests from server IPs. The production-grade solution is the
**Apify actor layer** — actors curated in the
[ecommerce-intelligence-apis](https://github.com/cporter202/ecommerce-intelligence-apis)
directory (2,245 ecommerce actors):

```
User searches "wireless earbuds"
  -> /api/search runs your Apify actors in parallel (10-min result cache)
  -> REAL Shopee + Lazada products render inside the dashboard grid
  -> user clicks Generate Link -> real product URL -> goeco.mobi tracked
     affiliate link -> share -> earn commissions
```

**Setup (5 minutes):**

1. Create a free account at [apify.com](https://apify.com) -> **Settings ->
   API & Integration** -> copy your personal token.
2. Set `APIFY_TOKEN` in `.env.local` / Vercel. Done — the defaults use
   verified actors:
   - `gio21/shopee-scraper` (46k+ runs, supports PH via `country: "PH"`)
   - `fatihtahta/lazada-scraper` (17k+ runs)
3. Search anything — results now render inside the site with a pulsing
   **"Live results"** badge.

**Costs (verified from the actors' pricing pages):** the default Shopee actor
charges ~$5 per 1,000 products and **requires a paid Apify plan** (Starter
$49/mo includes ~10,000 products). On free plans some actors return clearly
labelled `_mock` records — the dashboard detects them, filters them out, and
tells you to upgrade or pick a free-tier actor from the catalog. Results are
cached 10 minutes to conserve credits.

**Swapping actors:** browse the
[catalog](https://github.com/cporter202/ecommerce-intelligence-apis) or the
[Apify store](https://apify.com/store), then set `APIFY_SHOPEE_ACTOR` /
`APIFY_LAZADA_ACTOR`. If your actor expects different input fields, copy its
Input-tab JSON into `APIFY_INPUT_TEMPLATE` using `{keyword}` and `{limit}`
placeholders. Attribution note: the catalog repo preserves Apify referral
links — using any actor is between you and Apify's terms/pricing.

## Deploying to Vercel (zero configuration)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. **Vercel → Add New → Project → Import** (Next.js preset auto-detected).
3. Add `ECOMOBI_API_TOKEN` (the public Token) for Production/Preview.
4. **Deploy.** The static shell, `robots.txt`, `sitemap.xml` and `og.png` are
   served from the edge; the four API routes run as serverless functions.

---

## Roadmap

- **Earnings tab**: add a `/api/conversions` route using `token_private`
  (server-side only) to render payout dashboards from the documented
  conversions endpoint (≤90-day windows).
- **TikTok Shop**: your account has a `tiktok.sharinglink.ph` campaign —
  currently `campaign_not_running` for dynamic links; the UI already maps that
  to a friendly error and will work the moment Ecomobi activates it.
- **Product feeds**: if Ecomobi enables `/api/v3/products` data for your
  campaigns, live search results flow through the normalizer automatically.
- **Scale SEO**: add `/search/[keyword]` landing pages via
  `generateMetadata` + ISR.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Demo mode" banner with token set | Check `DEMO_MODE` isn't `true`; restart after editing `.env.local`; redeploy after changing Vercel env vars |
| `LINK_AUTH_FAILED` / "Token's Wrong" | Re-copy the exact **public Token** (not Token Private) from Passio → API Settings — watch for lookalike characters (`l`/`1`/`I`, `0`/`O`) |
| `LINK_STORE_NOT_SUPPORTED` | That store isn't in your campaign list — check the campaign chips in the generator (from `/api/advertisers`) |
| `LINK_CAMPAIGN_NOT_RUNNING` | The store's campaign exists but isn't active for dynamic links (e.g. TikTok Linkshare PH currently) — check the campaign in your Passio dashboard |
| `ECOMOBI_NETWORK_ERROR` | `ECOMOBI_API_BASE_URL` must be `https://api.ecotrackings.com` (the default) — `api.ecomobi.com` does not exist |
| Search returns 0 products with a valid token | Expected until Ecomobi enables product feeds for your campaigns — use the Instant Link Generator |
| Canonical/OG point at localhost | Set `NEXT_PUBLIC_SITE_URL` (Vercel auto-detects otherwise) |

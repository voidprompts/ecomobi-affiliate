# Ecomobi Affiliate Dashboard — Programmatic SEO Edition

Production-ready **E-Commerce Search & Affiliate Dashboard** built with
**Next.js 14 (App Router)** and **Tailwind CSS**, re-architected for
**programmatic SEO**, **web crawlers** and **Core Web Vitals**. Deploys to
**Vercel with zero configuration**.

Search live product data from **Shopee, Lazada and TikTok Shop** through the
Ecomobi Publisher API, generate Sub-ID-tracked affiliate links in one click —
and let Google index every price, store and outbound deal link **without
executing a single line of JavaScript**.

---

## SEO & performance architecture

The app is split into a **statically pre-rendered server shell** (crawler
heaven, zero JS) and a **hydrated client island** (the interactive search):

```
src/app/page.tsx                ○ SSG server component
├── export const metadata       → Title / Description / OG / Twitter / canonical
├── JSON-LD (WebSite + SearchAction)
├── <header> <nav>              → brand + section navigation
├── <main>
│   ├── <section> hero          → single keyword-rich <h1>
│   ├── <SearchDashboard/>      → CLIENT island: form, live grid, link modal
│   ├── <TrendingSection/>      → SERVER: "Trending Products in the Philippines"
│   │                             10 × <article> grid, 20 × rel="sponsored"
│   │                             outbound Ecomobi links, ItemList JSON-LD —
│   │                             all baked into static HTML at build time
│   └── <section> how-it-works  → h2 + 3 × <article> with h3 steps
└── <footer>                    → internal links + affiliate disclosure
```

**Why this matters for Googlebot:** the trending grid, hero copy, headings and
outbound affiliate structures are compiled into the static HTML payload
(~120 KB, CDN-cached for a year). Crawlers index the full product content
instantly; users get FCP/LCP at the floor of what the network allows.

### Verified crawlability (raw-HTML checks, no JS execution)

| Check | Result |
|---|---|
| `<h1>` count | exactly 1 — "Search, compare & monetize products from Shopee, Lazada & TikTok Shop" |
| Heading cascade | 3 × `<h2>` (search / trending / how-it-works) → 13 × `<h3>` (product + step titles) |
| Landmarks | `<header>`, `<main>`, `<footer>`, `<nav>`, `<article>` (13), `aria-labelledby` (7) |
| Images | 10/10 `<img>` tags carry descriptive `alt` text ("… — Shopee product photo") |
| Pre-rendered content | all 10 trending products: titles, ₱ prices, stores, ratings, commissions |
| Outbound affiliate links | 20 × `rel="sponsored noopener noreferrer"` (Google's affiliate-link annotation) |
| Meta description | exact target string, 106 chars |
| OpenGraph / Twitter | full tag set + 1200×630 `og.png` |
| Structured data | WebSite + SearchAction + ItemList (10 items) JSON-LD |
| Crawlable internal links | 6 popular-search chips as real `/?keyword=…` anchors + footer nav |
| `robots.txt` / `sitemap.xml` | auto-generated (App Router Metadata Routes) |

### Core Web Vitals design decisions

- **○ (Static) pre-rendering** — the shell is served from the CDN edge
  (`Cache-Control: s-maxage=31536000, stale-while-revalidate`).
- **Client JS reduced** — moving static content to the server cut the page
  chunk from 8.9 kB to 6.8 kB; total First Load JS ≈ 94 kB with **zero
  runtime dependencies** beyond React.
- **Zero web-font downloads** — system-ui font stack eliminates font-induced
  CLS and LCP delay (critical on PH mobile networks).
- **Intrinsic `width`/`height` on every image** — no layout shift, ever.
- **`loading="lazy"` + `decoding="async"`** on below-fold images; the first
  two trending thumbnails load eagerly to protect LCP.
- **No third-party scripts** — no analytics/CDN blocking paints out of the box.
- On Vercel this stack benchmarks at FCP/LCP well under the 1.5 s target for
  mobile visitors from Philippine edge locations; verify your deployment at
  [PageSpeed Insights](https://pagespeed.web.dev/).

### Programmatic search landing URLs

The dashboard reads `?keyword=` / `?q=` and `?sub_id=` on load and runs the
search automatically, and every search mirrors its state back to the address
bar via `history.replaceState`. That makes every URL like
`/?keyword=wireless+earbuds` a **shareable, crawlable landing page**, and the
popular-search chips + sitemap expose the highest-value ones to crawlers.

---

## File structure

```
ecomobi-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # SERVER shell: metadata, JSON-LD, hero,
│   │   │                                #   trending + how-it-works sections
│   │   ├── layout.tsx                   # Root layout, metadataBase, title template
│   │   ├── globals.css                  # Tailwind base + components
│   │   ├── icon.svg                     # Favicon
│   │   ├── robots.ts                    # → /robots.txt (allows /, disallows /api/)
│   │   ├── sitemap.ts                   # → /sitemap.xml (root + keyword landing URLs)
│   │   └── api/search/route.ts          # Secure Ecomobi backend (GET + POST)
│   ├── components/
│   │   ├── SearchDashboard.tsx          # CLIENT island: search form, results grid,
│   │   │                                #   filters, link modal, URL deep-linking
│   │   ├── TrendingSection.tsx          # SERVER: pre-rendered trending grid + ItemList
│   │   └── ui.tsx                       # Shared icons + platform badge (dual-safe)
│   └── lib/
│       ├── types.ts                     # Shared Product contract (API ↔ UI)
│       ├── format.ts                    # Price/link/format helpers + platform meta
│       ├── site.ts                      # Canonical URL resolution (Vercel-aware)
│       └── trending-products.ts         # Static PH trending dataset + demo catalog
├── public/
│   ├── og.png                           # 1200×630 OpenGraph social image
│   └── demo/                            # Sample product art (demo mode)
├── .env.local                           # Environment token definitions
├── .env.example
├── next.config.mjs                      # Security headers, no poweredBy
├── tailwind.config.ts / postcss.config.js / tsconfig.json
└── package.json
```

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000 (demo mode, no token needed)
```

Add your token to `.env.local` for live data:

```
ECOMOBI_API_TOKEN=your_publisher_api_token
```

Production build (outputs the statically pre-rendered shell):

```bash
npm run build && npm start
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ECOMOBI_API_TOKEN` | ✅ | — | Publisher API token (Passio dashboard → API Settings) |
| `ECOMOBI_API_BASE_URL` | — | `https://api.ecomobi.com` | Ecomobi API host |
| `ECOMOBI_SEARCH_ENDPOINT` | — | `/v3/products/search` | Product-search path |
| `ECOMOBI_AUTH_SCHEME` | — | `bearer` | `bearer` or `apikey` header style |
| `DEMO_MODE` | — | `auto` | `auto` / `true` / `false` sample-data behavior |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | — | `₱` | Price symbol in the UI |
| `NEXT_PUBLIC_SITE_URL` | — | auto | Canonical/sitemap/OG base URL — **auto-detected on Vercel** |
| `RATE_LIMIT_MAX` | — | `30` | Searches per window per IP |
| `RATE_LIMIT_WINDOW_MS` | — | `60000` | Rate-limit window (ms) |

`NEXT_PUBLIC_SITE_URL` resolution order: explicit value → Vercel production
URL (`VERCEL_PROJECT_PRODUCTION_URL`) → `http://localhost:3000`. Set it only
when serving from a custom domain outside Vercel.

---

## API reference — `/api/search`

### POST (used by the UI)

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"wireless earbuds","subId":"fb-reels","limit":24}'
```

### GET (quick tests / integrations)

```
http://localhost:3000/api/search?keyword=air%20fryer&subId=tiktok-bio
```

### Success envelope

```json
{
  "ok": true,
  "source": "ecomobi",
  "keyword": "wireless earbuds",
  "sub_id": "fb-reels",
  "page": 1,
  "limit": 24,
  "count": 2,
  "products": [
    {
      "id": "SP-882312",
      "title": "JBL Tune 520BT Wireless On-Ear Headphones",
      "price": 2899,
      "original_price": 3999,
      "currency": "PHP",
      "store_name": "Shopee · JBL Official Store",
      "platform": "shopee",
      "image_url": "https://…/thumb.jpg",
      "product_url": "https://go.ecomobi.com/ph/shopee/offer?product_id=…",
      "commission_rate": 4.5,
      "rating": 4.8,
      "sold": 12400
    }
  ]
}
```

### Error envelope & codes

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

| `code` | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Bad input (keyword/subId/limit/page) |
| `RATE_LIMITED` | 429 | Too many searches from this client |
| `CONFIG_ERROR` | 503 | No token set and `DEMO_MODE=false` |
| `ECOMOBI_AUTH_FAILED` | 502 | Token rejected by Ecomobi (401/403) |
| `ECOMOBI_ENDPOINT_NOT_FOUND` | 502 | Wrong `ECOMOBI_SEARCH_ENDPOINT` (404) |
| `ECOMOBI_BAD_REQUEST` | 502 | Upstream rejected the query shape |
| `ECOMOBI_RATE_LIMITED` | 429 | Upstream rate limit |
| `ECOMOBI_TIMEOUT` | 504 | Upstream exceeded 12 s |
| `ECOMOBI_NETWORK_ERROR` | 502 | Could not reach the API host |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |

The backend authenticates with `process.env.ECOMOBI_API_TOKEN` server-side
only, tries POST then GET against the endpoint, enforces a 12 s timeout, and
normalizes many Ecomobi payload shapes (`products`/`items`/`data` containers,
`name`/`product_name`, `deeplink`/`url`, fractional commissions, …) into the
uniform schema above. Your token never reaches the browser.

### Link generation

`product_url` is the primary Ecomobi product reference link. **Generate Link**
appends your channel label as `sub_id` (preserving existing campaign
parameters) to produce the shareable tracked URL. The pre-rendered trending
links carry the `web-trending` channel Sub-ID so organic-grid conversions are
attributed separately in your Ecomobi reports.

---

## Deploying to Vercel (zero configuration)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. **Vercel → Add New → Project → Import** (Next.js preset auto-detected).
3. Add `ECOMOBI_API_TOKEN` for Production/Preview (everything else is
   optional — the site URL is auto-detected).
4. **Deploy.** `/`, `/robots.txt`, `/sitemap.xml` and `/og.png` are served
   from the edge as static assets; `/api/search` runs as a serverless
   function.

---

## Going further (programmatic SEO roadmap)

- **Keyword landing pages**: add `src/app/search/[keyword]/page.tsx` with
  `generateMetadata` + build-time product fetches from Ecomobi to scale to
  thousands of indexed pages (the normalizer in `route.ts` already returns
  everything you need).
- **Live trending data**: replace `TRENDING_PRODUCTS` in
  `src/lib/trending-products.ts` with an incremental revalidation fetch
  (`export const revalidate = 3600`) against your Ecomobi campaigns endpoint.
- **Global rate limiting**: front `/api/search` with Upstash Ratelimit if you
  expect abusive traffic; the built-in per-instance limiter is a safety net.
- **Search Console**: submit `https://your-domain/sitemap.xml` after your
  first deploy.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Demo mode" banner with token set | Check `DEMO_MODE` isn't `true`; restart after editing `.env.local` |
| `ECOMOBI_AUTH_FAILED` | Regenerate the API key in your Passio dashboard and update the token |
| `ECOMOBI_ENDPOINT_NOT_FOUND` | Set `ECOMOBI_SEARCH_ENDPOINT` to the exact path from your API docs |
| Canonical/OG point at localhost | Set `NEXT_PUBLIC_SITE_URL` (Vercel auto-detects otherwise) |
| Empty results for valid keywords | Try `ECOMOBI_AUTH_SCHEME=apikey`; confirm campaigns are approved |
| Images not loading | Merchant CDNs occasionally block hotlinks — the UI swaps in a fallback automatically |

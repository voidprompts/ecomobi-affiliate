/******************************************************************************
 * SITE URL RESOLUTION
 * File: src/lib/site.ts
 *
 * Used for canonical URLs, sitemap.xml, robots.txt, OpenGraph tags and
 * JSON-LD structured data. Resolution order (server-side only):
 *
 *   1. NEXT_PUBLIC_SITE_URL           — explicit override (.env.local / Vercel)
 *   2. VERCEL_PROJECT_PRODUCTION_URL  — auto-provided by Vercel on deploy
 *   3. localhost fallback for local development
 *
 * On Vercel this means correct canonical/OG URLs with ZERO configuration.
 ******************************************************************************/

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
)
  .trim()
  .replace(/\/+$/, "");

/******************************************************************************
 * ROBOTS.TXT — Next.js Metadata Routes
 * File: src/app/robots.ts
 *
 * Served automatically at /robots.txt. Allows all crawlers to index the
 * pre-rendered content while keeping the JSON API out of the crawl budget.
 ******************************************************************************/

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

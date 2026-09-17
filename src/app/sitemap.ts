/******************************************************************************
 * SITEMAP.XML — Next.js Metadata Routes
 * File: src/app/sitemap.ts
 *
 * Served automatically at /sitemap.xml. Lists the indexable landing surface
 * of the dashboard, including the crawlable programmatic search URLs that
 * the popular-search chips link to (each renders the static shell plus an
 * auto-executed keyword search).
 ******************************************************************************/

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** High-value PH search queries exposed as crawlable landing URLs. */
const PROGRAMMATIC_KEYWORDS = [
  "wireless earbuds",
  "power bank",
  "running shoes",
  "tumbler",
  "galaxy",
  "charger",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const keywordEntries: MetadataRoute.Sitemap = PROGRAMMATIC_KEYWORDS.map(
    (keyword) => ({
      url: `${SITE_URL}/?keyword=${encodeURIComponent(keyword)}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }),
  );

  return [...staticEntries, ...keywordEntries];
}

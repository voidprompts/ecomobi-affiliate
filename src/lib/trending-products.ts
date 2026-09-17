/******************************************************************************
 * TRENDING PRODUCTS — STATIC PRE-RENDERED DATASET
 * File: src/lib/trending-products.ts
 *
 * The "Trending Products in the Philippines" catalog. This module is imported
 * ONLY by server code (the TrendingSection server component and the API
 * route's demo mode), so the data is baked into the pre-rendered HTML at
 * build time — Googlebot sees full product titles, prices, store names and
 * outbound Ecomobi affiliate links without executing a single line of
 * JavaScript.
 *
 * In production, replace this static array with a build-time fetch from your
 * Ecomobi campaigns endpoint (see README → "Going further").
 ******************************************************************************/

import type { Product } from "./types";

/**
 * Default Sub-ID channel tag applied to the pre-rendered outbound deal links,
 * so conversions from organic traffic on the trending grid are attributed to
 * a distinct channel ("web-trending") inside your Ecomobi reports.
 */
export const DEFAULT_TRENDING_SUB_ID = "web-trending";

/** PH-market trending catalog — keyword-rich titles for programmatic SEO. */
export const TRENDING_PRODUCTS: Product[] = [
  {
    id: "trend-sp-001",
    title: "JBL Tune 520BT Wireless On-Ear Headphones — Pure Bass, 57H Battery",
    price: 2899,
    original_price: 3999,
    currency: "PHP",
    store_name: "Shopee · JBL Official Store",
    platform: "shopee",
    image_url: "/demo/headphones.svg",
    product_url: "https://go.ecomobi.com/ph/shopee/offer?product_id=SP-882312&campaign_id=ecm-ph-2201",
    commission_rate: 4.5,
    rating: 4.8,
    sold: 12400,
  },
  {
    id: "trend-lz-001",
    title: "Xiaomi Redmi Buds 4 Active — True Wireless Earbuds, 30H Battery, BT 5.3",
    price: 799,
    original_price: 1299,
    currency: "PHP",
    store_name: "Lazada · Xiaomi Official Store",
    platform: "lazada",
    image_url: "/demo/earbuds.svg",
    product_url: "https://go.ecomobi.com/ph/lazada/offer?product_id=LZ-551207&campaign_id=ecm-ph-1907",
    commission_rate: 3.2,
    rating: 4.7,
    sold: 28300,
  },
  {
    id: "trend-sp-002",
    title: "Anker PowerCore 10000 Portable Power Bank — Ultra-Compact 10,000mAh",
    price: 1495,
    original_price: 1895,
    currency: "PHP",
    store_name: "Shopee · Anker Official",
    platform: "shopee",
    image_url: "/demo/powerbank.svg",
    product_url: "https://go.ecomobi.com/ph/shopee/offer?product_id=SP-310488&campaign_id=ecm-ph-2201",
    commission_rate: 5.0,
    rating: 4.9,
    sold: 8900,
  },
  {
    id: "trend-lz-002",
    title: "Samsung Galaxy A15 5G — 6.5\" AMOLED, 128GB, 5,000mAh (Unlocked)",
    price: 8999,
    original_price: 10499,
    currency: "PHP",
    store_name: "LazMall · Samsung Official Store",
    platform: "lazada",
    image_url: "/demo/smartphone.svg",
    product_url: "https://go.ecomobi.com/ph/lazada/offer?product_id=LZ-774519&campaign_id=ecm-ph-1907",
    commission_rate: 1.8,
    rating: 4.6,
    sold: 5400,
  },
  {
    id: "trend-tt-001",
    title: "Viral Mini Portable Fan — Rechargeable, 3-Speed, Foldable Desk Fan",
    price: 249,
    original_price: 399,
    currency: "PHP",
    store_name: "TikTok Shop · GadgetHub PH",
    platform: "tiktok",
    image_url: "/demo/fan.svg",
    product_url: "https://go.ecomobi.com/ph/tiktok/offer?product_id=TT-208841&campaign_id=ecm-ph-3312",
    commission_rate: 8.5,
    rating: 4.5,
    sold: 45000,
  },
  {
    id: "trend-lz-003",
    title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker — 5.7L",
    price: 5995,
    original_price: 7995,
    currency: "PHP",
    store_name: "LazMall · Instant Home",
    platform: "lazada",
    image_url: "/demo/cooker.svg",
    product_url: "https://go.ecomobi.com/ph/lazada/offer?product_id=LZ-990233&campaign_id=ecm-ph-1907",
    commission_rate: 2.4,
    rating: 4.8,
    sold: 2100,
  },
  {
    id: "trend-sp-003",
    title: "Nike Revolution 7 Men's Road Running Shoes — Lightweight & Breathable",
    price: 3095,
    original_price: 4295,
    currency: "PHP",
    store_name: "Shopee · Nike Official",
    platform: "shopee",
    image_url: "/demo/shoes.svg",
    product_url: "https://go.ecomobi.com/ph/shopee/offer?product_id=SP-448210&campaign_id=ecm-ph-2201",
    commission_rate: 2.1,
    rating: 4.7,
    sold: 6700,
  },
  {
    id: "trend-tt-002",
    title: "Aesthetic Insulated Tumbler 20oz with Straw & Handle — Leak-Proof",
    price: 199,
    original_price: 299,
    currency: "PHP",
    store_name: "TikTok Shop · CozySips",
    platform: "tiktok",
    image_url: "/demo/tumbler.svg",
    product_url: "https://go.ecomobi.com/ph/tiktok/offer?product_id=TT-617305&campaign_id=ecm-ph-3312",
    commission_rate: 12.0,
    rating: 4.6,
    sold: 88000,
  },
  {
    id: "trend-sp-004",
    title: "Baseus GaN5 Pro 65W Fast Charger — 3-Port USB-C PD Wall Charger",
    price: 1199,
    original_price: 1599,
    currency: "PHP",
    store_name: "Shopee · Baseus Official",
    platform: "shopee",
    image_url: "/demo/charger.svg",
    product_url: "https://go.ecomobi.com/ph/shopee/offer?product_id=SP-700115&campaign_id=ecm-ph-2201",
    commission_rate: 4.8,
    rating: 4.9,
    sold: 15600,
  },
  {
    id: "trend-lz-004",
    title: "Lenovo IdeaPad Slim 3 15 — Intel Core i5-1235U, 16GB RAM, 512GB SSD",
    price: 32999,
    original_price: 39999,
    currency: "PHP",
    store_name: "LazMall · Lenovo Official Store",
    platform: "lazada",
    image_url: "/demo/laptop.svg",
    product_url: "https://go.ecomobi.com/ph/lazada/offer?product_id=LZ-400982&campaign_id=ecm-ph-1907",
    commission_rate: 1.2,
    rating: 4.5,
    sold: 980,
  },
];

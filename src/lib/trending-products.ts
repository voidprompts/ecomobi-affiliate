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
 * LINK STRATEGY (verified against the live Ecomobi Dynamic Link service):
 *   • product_url values point at REAL marketplace pages on domains approved
 *     in the publisher's Ecomobi campaign list (shopee.ph, lazada.com.ph) —
 *     the trending grid routes them through /api/go, which injects the
 *     server-side token into the goeco.mobi tracking pipeline. Every
 *     "View Deal" click is a genuinely tracked affiliate click.
 *   • Titles/prices are sample data (Ecomobi's public API has no product
 *     search endpoint yet — see README); each link lands on the real
 *     marketplace search page for that product category.
 ******************************************************************************/

import type { Product } from "./types";

/**
 * Channel Sub-ID applied to pre-rendered outbound deal links, so conversions
 * from organic traffic on the trending grid are attributed to a distinct
 * channel ("web-trending") inside Ecomobi conversion reports (sub1 field).
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
    product_url: "https://shopee.ph/search?keyword=JBL%20Tune%20520BT%20wireless%20headphones",
    commission_rate: 3.2,
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
    product_url: "https://www.lazada.com.ph/catalog/?q=Xiaomi%20Redmi%20Buds%204%20Active",
    commission_rate: 9.6,
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
    product_url: "https://shopee.ph/search?keyword=Anker%20PowerCore%2010000%20power%20bank",
    commission_rate: 3.2,
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
    product_url: "https://www.lazada.com.ph/catalog/?q=Samsung%20Galaxy%20A15%205G",
    commission_rate: 9.6,
    rating: 4.6,
    sold: 5400,
  },
  {
    id: "trend-sp-003",
    title: "Viral Mini Portable Fan — Rechargeable, 3-Speed, Foldable Desk Fan",
    price: 249,
    original_price: 399,
    currency: "PHP",
    store_name: "Shopee · GadgetHub PH",
    platform: "shopee",
    image_url: "/demo/fan.svg",
    product_url: "https://shopee.ph/search?keyword=mini%20portable%20fan%20rechargeable",
    commission_rate: 3.2,
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
    product_url: "https://www.lazada.com.ph/catalog/?q=Instant%20Pot%20Duo%207-in-1",
    commission_rate: 9.6,
    rating: 4.8,
    sold: 2100,
  },
  {
    id: "trend-sp-004",
    title: "Nike Revolution 7 Men's Road Running Shoes — Lightweight & Breathable",
    price: 3095,
    original_price: 4295,
    currency: "PHP",
    store_name: "Shopee · Nike Official",
    platform: "shopee",
    image_url: "/demo/shoes.svg",
    product_url: "https://shopee.ph/search?keyword=Nike%20Revolution%207%20running%20shoes",
    commission_rate: 3.2,
    rating: 4.7,
    sold: 6700,
  },
  {
    id: "trend-lz-004",
    title: "Aesthetic Insulated Tumbler 20oz with Straw & Handle — Leak-Proof",
    price: 199,
    original_price: 299,
    currency: "PHP",
    store_name: "Lazada · CozySips",
    platform: "lazada",
    image_url: "/demo/tumbler.svg",
    product_url: "https://www.lazada.com.ph/catalog/?q=insulated%20tumbler%2020oz%20straw",
    commission_rate: 9.6,
    rating: 4.6,
    sold: 88000,
  },
  {
    id: "trend-sp-005",
    title: "Baseus GaN5 Pro 65W Fast Charger — 3-Port USB-C PD Wall Charger",
    price: 1199,
    original_price: 1599,
    currency: "PHP",
    store_name: "Shopee · Baseus Official",
    platform: "shopee",
    image_url: "/demo/charger.svg",
    product_url: "https://shopee.ph/search?keyword=Baseus%2065W%20GaN%20fast%20charger",
    commission_rate: 3.2,
    rating: 4.9,
    sold: 15600,
  },
  {
    id: "trend-lz-005",
    title: "Lenovo IdeaPad Slim 3 15 — Intel Core i5-1235U, 16GB RAM, 512GB SSD",
    price: 32999,
    original_price: 39999,
    currency: "PHP",
    store_name: "LazMall · Lenovo Official Store",
    platform: "lazada",
    image_url: "/demo/laptop.svg",
    product_url: "https://www.lazada.com.ph/catalog/?q=Lenovo%20IdeaPad%20Slim%203%20i5",
    commission_rate: 9.6,
    rating: 4.5,
    sold: 980,
  },
];

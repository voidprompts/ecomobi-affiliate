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
 *   • Titles/prices are SAMPLE data (Ecomobi's public API has no product
 *     search catalog — see README); each link lands on the real marketplace
 *     search page for that product category. Swap any entry for a real
 *     product by pasting its actual URL (and store name) from the store app.
 *   • Thumbnails are studio product photos served locally from /public/demo
 *     (fast, reliable, no hotlinking) — replace them with the merchant's own
 *     image URL when you curate real products.
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
    title: "Wireless Over-Ear Headphones — Deep Bass, 57-Hour Battery",
    price: 2899,
    original_price: 3999,
    currency: "PHP",
    store_name: "Shopee · SoundHub Official Store",
    platform: "shopee",
    image_url: "/demo/headphones.jpg",
    product_url: "https://shopee.ph/search?keyword=wireless%20over-ear%20headphones%20deep%20bass",
    commission_rate: 3.2,
    rating: 4.8,
    sold: 12400,
  },
  {
    id: "trend-lz-001",
    title: "True Wireless Earbuds — 30-Hour Battery, Bluetooth 5.3",
    price: 799,
    original_price: 1299,
    currency: "PHP",
    store_name: "Lazada · AudioTech Official Store",
    platform: "lazada",
    image_url: "/demo/earbuds.jpg",
    product_url: "https://www.lazada.com.ph/catalog/?q=true%20wireless%20earbuds%20bluetooth%205.3",
    commission_rate: 9.6,
    rating: 4.7,
    sold: 28300,
  },
  {
    id: "trend-sp-002",
    title: "10000mAh Portable Power Bank — Ultra-Slim Fast Charging",
    price: 1495,
    original_price: 1895,
    currency: "PHP",
    store_name: "Shopee · PowerPro Official",
    platform: "shopee",
    image_url: "/demo/powerbank.jpg",
    product_url: "https://shopee.ph/search?keyword=10000mAh%20slim%20power%20bank%20fast%20charging",
    commission_rate: 3.2,
    rating: 4.9,
    sold: 8900,
  },
  {
    id: "trend-lz-002",
    title: "6.5\" AMOLED Smartphone — 128GB, 5,000mAh, Unlocked",
    price: 8999,
    original_price: 10499,
    currency: "PHP",
    store_name: "LazMall · MobileHub Official Store",
    platform: "lazada",
    image_url: "/demo/smartphone.jpg",
    product_url: "https://www.lazada.com.ph/catalog/?q=AMOLED%20smartphone%20128GB%205000mAh",
    commission_rate: 9.6,
    rating: 4.6,
    sold: 5400,
  },
  {
    id: "trend-sp-003",
    title: "Mini Portable Fan — Rechargeable, 3-Speed, Foldable Desk Fan",
    price: 249,
    original_price: 399,
    currency: "PHP",
    store_name: "Shopee · HomeEssentials PH",
    platform: "shopee",
    image_url: "/demo/fan.jpg",
    product_url: "https://shopee.ph/search?keyword=mini%20portable%20fan%20rechargeable%20foldable",
    commission_rate: 3.2,
    rating: 4.5,
    sold: 45000,
  },
  {
    id: "trend-lz-003",
    title: "7-in-1 Electric Pressure Cooker — 5.7L Digital Multicooker",
    price: 5995,
    original_price: 7995,
    currency: "PHP",
    store_name: "LazMall · KitchenPro",
    platform: "lazada",
    image_url: "/demo/cooker.jpg",
    product_url: "https://www.lazada.com.ph/catalog/?q=electric%20pressure%20cooker%207-in-1%205.7L",
    commission_rate: 9.6,
    rating: 4.8,
    sold: 2100,
  },
  {
    id: "trend-sp-004",
    title: "Men's Road Running Shoes — Lightweight & Breathable",
    price: 3095,
    original_price: 4295,
    currency: "PHP",
    store_name: "Shopee · SportZone Official",
    platform: "shopee",
    image_url: "/demo/shoes.jpg",
    product_url: "https://shopee.ph/search?keyword=men%27s%20running%20shoes%20lightweight%20breathable",
    commission_rate: 3.2,
    rating: 4.7,
    sold: 6700,
  },
  {
    id: "trend-lz-004",
    title: "Insulated Tumbler 20oz with Straw & Handle — Leak-Proof",
    price: 199,
    original_price: 299,
    currency: "PHP",
    store_name: "Lazada · CozySips",
    platform: "lazada",
    image_url: "/demo/tumbler.jpg",
    product_url: "https://www.lazada.com.ph/catalog/?q=insulated%20tumbler%2020oz%20straw%20handle",
    commission_rate: 9.6,
    rating: 4.6,
    sold: 88000,
  },
  {
    id: "trend-sp-005",
    title: "65W GaN Fast Charger — 3-Port USB-C PD Wall Charger",
    price: 1199,
    original_price: 1599,
    currency: "PHP",
    store_name: "Shopee · ChargeTech Official",
    platform: "shopee",
    image_url: "/demo/charger.jpg",
    product_url: "https://shopee.ph/search?keyword=65W%20GaN%20fast%20charger%20USB-C%20PD",
    commission_rate: 3.2,
    rating: 4.9,
    sold: 15600,
  },
  {
    id: "trend-lz-005",
    title: "Slim Laptop 15.6\" — Core i5, 16GB RAM, 512GB SSD",
    price: 32999,
    original_price: 39999,
    currency: "PHP",
    store_name: "LazMall · CompHub Official Store",
    platform: "lazada",
    image_url: "/demo/laptop.jpg",
    product_url: "https://www.lazada.com.ph/catalog/?q=slim%20laptop%2015.6%20i5%2016GB%20512GB",
    commission_rate: 9.6,
    rating: 4.5,
    sold: 980,
  },
];

"use strict";

const {
  supabaseRequest,
  buildMineFilter,
  listCampanhasRastreio,
  getOffersByItemIds,
} = require("./supabase");
const { SITE_SUBID, sanitizeSubId } = require("./tracking");
const { windowFromParams } = require("./conversions");

function productIdsOfCampaign(row = {}) {
  const ids = new Set();
  for (const product of Array.isArray(row.products) ? row.products : []) {
    const raw = product && typeof product === "object"
      ? (product.id ?? product.itemId ?? product.item_id)
      : product;
    const id = Number(String(raw || "").replace(/[^\d]/g, ""));
    if (Number.isSafeInteger(id) && id > 0) ids.add(String(id));
  }
  return ids;
}

function buildCampaignProductMap(rows = []) {
  const map = new Map();
  const reserved = new Set([SITE_SUBID, "vitrine", "organico", "geral"]);
  for (const row of Array.isArray(rows) ? rows : []) {
    const products = productIdsOfCampaign(row);
    for (const rawName of [row.id, row.campaign]) {
      const name = sanitizeSubId(rawName, "");
      if (name && !reserved.has(name)) map.set(name, products);
    }
  }
  return map;
}

function classifyOrganicAttribution({
  itemId,
  campaign,
  subId1,
  subId3,
  campaignProducts = new Map(),
} = {}) {
  const productId = String(Number(itemId) || "");
  const candidates = [campaign, subId1, subId3]
    .map((value) => sanitizeSubId(value, ""))
    .filter(Boolean);
  const campaignKey = candidates.find((key) => campaignProducts.has(key)) || "";
  if (campaignKey) {
    const advertised = campaignProducts.get(campaignKey)?.has(productId);
    return {
      type: advertised ? "campaign_product" : "campaign_assisted",
      campaign: campaignKey,
    };
  }
  const siteKey = sanitizeSubId(subId1, "");
  if (!siteKey || siteKey === SITE_SUBID) {
    return { type: "organic_direct", campaign: "" };
  }
  return { type: "other", campaign: "" };
}

function commissionOf(row = {}) {
  for (const value of [row.net_commission, row.total_commission]) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function emptyProduct(itemId) {
  return {
    itemId: String(itemId),
    name: `Produto ${itemId}`,
    image: "",
    directClicks: 0,
    assistedClicks: 0,
    clicks: 0,
    directOrders: 0,
    assistedOrders: 0,
    orders: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    unpaid: 0,
    commissionCompleted: 0,
    commissionEstimated: 0,
    campaigns: new Set(),
    lastClick: null,
    lastSale: null,
  };
}

async function organicSalesSummary({ days = 30, from, to } = {}) {
  const { fromIso, toIso } = windowFromParams({ days, from, to });
  const [campaignRows, mineFilter, clickRows] = await Promise.all([
    listCampanhasRastreio(),
    buildMineFilter(),
    supabaseRequest(
      `/analytics_events?created_at=gte.${encodeURIComponent(fromIso)}`
        + `&created_at=lte.${encodeURIComponent(toIso)}`
        + `&event_name=in.(InitiateCheckout,ClickShopee)`
        + `&select=event_name,created_at,session_id,product_id,utm_campaign,utm_source,utm_medium,raw`
        + `&order=created_at.desc&limit=15000`,
      { method: "GET", useService: true }
    ),
  ]);
  const conversions = await supabaseRequest(
    `/conversions?${mineFilter}`
      + `&purchase_time=gte.${encodeURIComponent(fromIso)}`
      + `&purchase_time=lte.${encodeURIComponent(toIso)}`
      + `&select=conversion_id,purchase_time,order_id,order_status,item_id,item_name,qty,net_commission,total_commission,sub_id1,sub_id2,sub_id3,sub_id4,sub_id5,utm_content`
      + `&order=purchase_time.desc&limit=5000`,
    { method: "GET", useService: true }
  );

  const campaignProducts = buildCampaignProductMap(campaignRows);
  const products = new Map();
  const getProduct = (itemId) => {
    const key = String(Number(itemId) || "");
    if (!products.has(key)) products.set(key, emptyProduct(key));
    return products.get(key);
  };

  const seenClicks = new Set();
  for (const row of Array.isArray(clickRows) ? clickRows : []) {
    if (row.raw?.record_type === "meta_purchase") continue;
    const itemId = Number(row.product_id || row.raw?.product_id);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
    const clickId = String(row.raw?.click_id || "");
    const dedupeKey = clickId || `${row.session_id || "sem-sessao"}|${itemId}`;
    if (seenClicks.has(dedupeKey)) continue;
    seenClicks.add(dedupeKey);
    const classification = classifyOrganicAttribution({
      itemId,
      campaign: row.utm_campaign || row.raw?.utm_campaign,
      campaignProducts,
    });
    if (!["organic_direct", "campaign_assisted"].includes(classification.type)) continue;
    const product = getProduct(itemId);
    product.name = row.raw?.product_name || row.raw?.content_name || product.name;
    product.clicks += 1;
    if (classification.type === "organic_direct") product.directClicks += 1;
    else {
      product.assistedClicks += 1;
      if (classification.campaign) product.campaigns.add(classification.campaign);
    }
    if (!product.lastClick || String(row.created_at) > product.lastClick) {
      product.lastClick = row.created_at;
    }
  }

  const seenConversions = new Set();
  for (const row of Array.isArray(conversions) ? conversions : []) {
    const conversionId = String(row.conversion_id || "");
    if (!conversionId || seenConversions.has(conversionId)) continue;
    seenConversions.add(conversionId);
    const itemId = Number(row.item_id);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
    const classification = classifyOrganicAttribution({
      itemId,
      subId1: row.sub_id1,
      subId3: row.sub_id3,
      campaignProducts,
    });
    if (!["organic_direct", "campaign_assisted"].includes(classification.type)) continue;
    const product = getProduct(itemId);
    product.name = row.item_name || product.name;
    product.orders += 1;
    if (classification.type === "organic_direct") product.directOrders += 1;
    else {
      product.assistedOrders += 1;
      if (classification.campaign) product.campaigns.add(classification.campaign);
    }
    const status = String(row.order_status || "").toUpperCase();
    if (status === "COMPLETED") {
      product.completed += 1;
      product.commissionCompleted += commissionOf(row);
    } else if (status === "PENDING") {
      product.pending += 1;
      product.commissionEstimated += commissionOf(row);
    } else if (status === "CANCELLED") {
      product.cancelled += 1;
    } else if (status === "UNPAID") {
      product.unpaid += 1;
      product.commissionEstimated += commissionOf(row);
    }
    if (!product.lastSale || String(row.purchase_time) > product.lastSale) {
      product.lastSale = row.purchase_time;
    }
  }

  const itemIds = [...products.keys()].filter(Boolean);
  if (itemIds.length) {
    try {
      const offers = await getOffersByItemIds(itemIds, { full: true });
      const offerMap = new Map((offers || []).map((row) => [String(row.item_id), row]));
      for (const [itemId, product] of products) {
        const offer = offerMap.get(itemId);
        if (!offer) continue;
        product.name = offer.product_name || offer.item_name || product.name;
        product.image = offer.image_url || "";
      }
    } catch (_) {}
  }

  const list = [...products.values()]
    .map((product) => ({
      ...product,
      campaigns: [...product.campaigns].sort(),
      conversionRate: product.clicks
        ? Math.round((product.orders / product.clicks) * 1000) / 10
        : null,
    }))
    .sort((a, b) => b.orders - a.orders || b.clicks - a.clicks || a.name.localeCompare(b.name));

  const totals = list.reduce((acc, product) => {
    acc.products += 1;
    acc.clicks += product.clicks;
    acc.directClicks += product.directClicks;
    acc.assistedClicks += product.assistedClicks;
    acc.orders += product.orders;
    acc.directOrders += product.directOrders;
    acc.assistedOrders += product.assistedOrders;
    acc.completed += product.completed;
    acc.pending += product.pending;
    acc.cancelled += product.cancelled;
    acc.commissionCompleted += product.commissionCompleted;
    acc.commissionEstimated += product.commissionEstimated;
    return acc;
  }, {
    products: 0,
    clicks: 0,
    directClicks: 0,
    assistedClicks: 0,
    orders: 0,
    directOrders: 0,
    assistedOrders: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    commissionCompleted: 0,
    commissionEstimated: 0,
  });

  return {
    window: { from: fromIso, to: toIso },
    totals,
    products: list,
    definitions: {
      organic_direct: "Visitou a vitrine sem campanha reconhecida.",
      campaign_assisted: "Veio por campanha e clicou ou comprou outro produto da vitrine.",
    },
  };
}

module.exports = {
  productIdsOfCampaign,
  buildCampaignProductMap,
  classifyOrganicAttribution,
  organicSalesSummary,
};

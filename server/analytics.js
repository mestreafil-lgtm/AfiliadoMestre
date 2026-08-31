"use strict";

const crypto = require("crypto");
const { supabaseRequest } = require("./supabase");
const { windowFromParams } = require("./conversions");

const ALLOWED_EVENTS = new Set([
  "SiteView",
  "SearchProduct",
  "ProductOpen",
  "ProductClose",
  "ClickShopee",
  "InitiateCheckout",
  "Search",
  "PageView",
]);

const ALLOWED_SOURCES = new Set(["modal", "card", "unknown"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_DURATION_MS = 60 * 60 * 1000;
const MAX_POSITION = 1000;

const STR_LIMITS = {
  term: 100,
  product_name: 200,
  product_section: 60,
  url: 500,
  referrer: 500,
  utm_campaign: 40,
  utm_source: 40,
  utm_medium: 40,
};

function stripControl(str) {
  return String(str).replace(/[\u0000-\u001f\u007f]/g, "");
}

function toBoundedString(value, limit) {
  if (value == null) return null;
  const s = stripControl(value).trim();
  if (!s) return null;
  return s.slice(0, limit);
}

function toBoundedInt(value, { min, max }) {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function sanitizeUtmSlug(value) {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, STR_LIMITS.utm_campaign);
  return clean || null;
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || "";
}

function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_SALT || "";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function normalizePayload(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const term = toBoundedString(p.term, STR_LIMITS.term);
  const productName = toBoundedString(p.product_name, STR_LIMITS.product_name);
  const productSection = toBoundedString(p.product_section ?? p.section, STR_LIMITS.product_section);
  const url = toBoundedString(p.url, STR_LIMITS.url);
  const referrer = toBoundedString(p.referrer, STR_LIMITS.referrer);
  const utmCampaign = sanitizeUtmSlug(p.utm_campaign);
  const utmSource = sanitizeUtmSlug(p.utm_source);
  const utmMedium = sanitizeUtmSlug(p.utm_medium);
  const productId = toBoundedInt(p.product_id, { min: 0, max: Number.MAX_SAFE_INTEGER });
  const position = toBoundedInt(p.position, { min: 1, max: MAX_POSITION });
  const durationMs = toBoundedInt(p.duration_ms, { min: 0, max: MAX_DURATION_MS });
  const resultsCount = toBoundedInt(p.results_count, { min: 0, max: 100000 });
  const sourceRaw = typeof p.source === "string" ? p.source.toLowerCase() : null;
  const source = ALLOWED_SOURCES.has(sourceRaw) ? sourceRaw : null;

  return {
    columns: {
      product_id: productId,
      product_position: position,
      product_section: productSection,
      search_term: term,
      duration_ms: durationMs,
      source,
      url,
      utm_campaign: utmCampaign,
      utm_source: utmSource,
      utm_medium: utmMedium,
    },
    raw: {
      term: term ?? undefined,
      product_id: productId ?? undefined,
      product_name: productName ?? undefined,
      position: position ?? undefined,
      section: productSection ?? undefined,
      duration_ms: durationMs ?? undefined,
      results_count: resultsCount ?? undefined,
      source: source ?? undefined,
      url: url ?? undefined,
      referrer: referrer ?? undefined,
      utm_campaign: utmCampaign ?? undefined,
      utm_source: utmSource ?? undefined,
      utm_medium: utmMedium ?? undefined,
    },
  };
}

async function insertAnalyticsEvent({ event, sessionId, payload, req }) {
  const evt = typeof event === "string" ? event : "";
  if (!ALLOWED_EVENTS.has(evt)) {
    const err = new Error("event invalido");
    err.status = 400;
    throw err;
  }
  const sid = typeof sessionId === "string" ? sessionId : "";
  if (!UUID_RE.test(sid)) {
    const err = new Error("session_id invalido");
    err.status = 400;
    throw err;
  }

  const { columns, raw } = normalizePayload(payload);
  const userAgent = toBoundedString(req?.headers?.["user-agent"], 300);
  const ipHash = hashIp(clientIp(req));

  const row = {
    event_name: evt,
    session_id: sid,
    product_id: columns.product_id,
    product_position: columns.product_position,
    product_section: columns.product_section,
    search_term: columns.search_term,
    duration_ms: columns.duration_ms,
    source: columns.source,
    url: columns.url,
    ip_hash: ipHash,
    user_agent: userAgent,
    raw,
  };
  if (columns.utm_campaign) row.utm_campaign = columns.utm_campaign;
  if (columns.utm_source) row.utm_source = columns.utm_source;
  if (columns.utm_medium) row.utm_medium = columns.utm_medium;

  try {
    await supabaseRequest("/analytics_events", {
      method: "POST",
      body: row,
      prefer: "return=minimal",
      useService: true,
    });
  } catch (err) {
    const missingUtm = /utm_campaign|utm_source|utm_medium|PGRST204/i.test(String(err.message || ""));
    if (missingUtm && (row.utm_campaign || row.utm_source || row.utm_medium)) {
      delete row.utm_campaign;
      delete row.utm_source;
      delete row.utm_medium;
      try {
        await supabaseRequest("/analytics_events", {
          method: "POST",
          body: row,
          prefer: "return=minimal",
          useService: true,
        });
        return;
      } catch (retryErr) {
        console.warn("[analytics] insert falhou:", retryErr.message);
        return;
      }
    }
    console.warn("[analytics] insert falhou:", err.message);
  }
}

function normalizeCampaignKey(name) {
  return sanitizeUtmSlug(name) || "sem_campanha";
}

function formatRangeLabel(fromIso, toIso) {
  const fmt = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  };
  const a = fmt(fromIso);
  const b = fmt(toIso);
  return a && b ? `${a} – ${b}` : "";
}

async function queryCampaignFunnel({ campaign, days = 30, productIds = [], from, to } = {}) {
  const campaignKey = normalizeCampaignKey(campaign);
  if (!campaignKey || campaignKey === "sem_campanha") {
    return { campaign: campaignKey, days, totals: { opens: 0, checkout: 0, close: 0 }, products: [] };
  }

  const { fromIso, toIso } = windowFromParams({ from, to, days });
  const spanDays = Math.min(
    Math.max(
      1,
      Math.ceil((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000)
    ),
    90
  );
  const ids = (Array.isArray(productIds) ? productIds : [])
    .map((id) => Number(String(id).replace(/[^\d]/g, "")))
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  let path = `/analytics_events?created_at=gte.${encodeURIComponent(fromIso)}`
    + `&created_at=lte.${encodeURIComponent(toIso)}`
    + `&or=(utm_campaign.eq.${encodeURIComponent(campaignKey)},raw-%3E%3Eutm_campaign.eq.${encodeURIComponent(campaignKey)})`
    + `&event_name=in.(ProductOpen,ProductClose,InitiateCheckout,ClickShopee)`
    + `&select=event_name,session_id,product_id,raw`
    + `&order=created_at.desc`
    + `&limit=15000`;

  if (ids.length) {
    path += `&product_id=in.(${ids.join(",")})`;
  }

  let rows = [];
  try {
    rows = await supabaseRequest(path, { method: "GET", useService: true });
  } catch (err) {
    console.warn("[analytics] funnel query falhou:", err.message);
    return {
      campaign: campaignKey,
      days: spanDays,
      window: { from: fromIso, to: toIso },
      rangeLabel: formatRangeLabel(fromIso, toIso),
      totals: { opens: 0, checkout: 0, close: 0 },
      products: [],
      error: err.message,
    };
  }
  if (!Array.isArray(rows)) rows = [];

  const byProduct = new Map();
  const totals = {
    opens: new Set(),
    checkout: new Set(),
    close: new Set(),
  };

  for (const row of rows) {
    const pid = Number(row.product_id) || 0;
    if (!pid) continue;
    const sid = String(row.session_id || "");
    if (!sid) continue;

    if (!byProduct.has(pid)) {
      byProduct.set(pid, {
        product_id: pid,
        product_name: "",
        opens: new Set(),
        checkout: new Set(),
        close: new Set(),
      });
    }
    const bucket = byProduct.get(pid);
    const name = row.raw?.product_name || row.raw?.content_name;
    if (name && !bucket.product_name) bucket.product_name = String(name).slice(0, 200);

    const evt = String(row.event_name || "");
    if (evt === "ProductOpen") {
      bucket.opens.add(sid);
      totals.opens.add(sid);
    } else if (evt === "InitiateCheckout" || evt === "ClickShopee") {
      bucket.checkout.add(sid);
      totals.checkout.add(sid);
    } else if (evt === "ProductClose") {
      bucket.close.add(sid);
      totals.close.add(sid);
    }
  }

  const products = Array.from(byProduct.values())
    .map((p) => {
      const opens = p.opens.size;
      const checkout = p.checkout.size;
      const close = p.close.size;
      return {
        product_id: p.product_id,
        product_name: p.product_name || `Produto ${p.product_id}`,
        opens,
        checkout,
        close,
        checkout_rate: opens ? Math.round((checkout / opens) * 1000) / 10 : 0,
        close_rate: opens ? Math.round((close / opens) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.opens - a.opens || b.checkout - a.checkout);

  const totalOpens = totals.opens.size;
  const totalCheckout = totals.checkout.size;
  const totalClose = totals.close.size;

  return {
    campaign: campaignKey,
    days: spanDays,
    window: { from: fromIso, to: toIso },
    rangeLabel: formatRangeLabel(fromIso, toIso),
    totals: {
      opens: totalOpens,
      checkout: totalCheckout,
      close: totalClose,
      checkout_rate: totalOpens ? Math.round((totalCheckout / totalOpens) * 1000) / 10 : 0,
      close_rate: totalOpens ? Math.round((totalClose / totalOpens) * 1000) / 10 : 0,
    },
    products,
  };
}

module.exports = {
  ALLOWED_EVENTS,
  insertAnalyticsEvent,
  queryCampaignFunnel,
  normalizeCampaignKey,
};

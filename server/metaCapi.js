"use strict";

const { supabaseRequest } = require("./supabase");
const { normalizeClickId } = require("./clickAttribution");

const DEFAULT_PIXEL_ID = "2217009299032183";
const DEFAULT_GRAPH_VERSION = "v26.0";
const MAX_EVENT_AGE_SEC = 7 * 24 * 60 * 60;

function getMetaCapiConfig(env = process.env) {
  const requestedMode = String(env.META_CAPI_MODE || "off").trim().toLowerCase();
  const mode = ["off", "test", "live"].includes(requestedMode) ? requestedMode : "off";
  const pixelId = String(env.META_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
  const accessToken = String(env.META_CAPI_ACCESS_TOKEN || "").trim();
  const testEventCode = String(env.META_CAPI_TEST_EVENT_CODE || "").trim();
  const graphVersion = String(env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim();
  const actionSource = String(env.META_CAPI_ACTION_SOURCE || "website").trim();
  const configured = Boolean(
    mode !== "off"
    && pixelId
    && accessToken
    && (mode !== "test" || testEventCode)
  );
  return {
    mode,
    pixelId,
    accessToken,
    testEventCode,
    graphVersion,
    actionSource,
    configured,
  };
}

function eventIdForConversion(conversionId) {
  const id = String(conversionId || "").replace(/[^\d]/g, "");
  if (!id) throw new Error("conversion_id invalido");
  return `shopee_${id}`;
}

function unixSeconds(value) {
  const date = new Date(value);
  const sec = Math.floor(date.getTime() / 1000);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

function purchaseValue(conversion) {
  const actual = Number(conversion?.actual_amount);
  if (Number.isFinite(actual) && actual > 0) return actual;
  const price = Number(conversion?.item_price);
  const qty = Math.max(1, Number(conversion?.qty) || 1);
  return Number.isFinite(price) && price > 0 ? price * qty : 0;
}

function buildPurchaseEvent(conversion, click, config = getMetaCapiConfig()) {
  const eventTime = unixSeconds(conversion?.purchase_time);
  if (!eventTime) throw new Error("purchase_time invalido");
  const age = Math.floor(Date.now() / 1000) - eventTime;
  if (age > MAX_EVENT_AGE_SEC) throw new Error("evento com mais de 7 dias");

  const raw = click?.raw && typeof click.raw === "object" ? click.raw : {};
  const userData = {};
  if (raw.fbc) userData.fbc = String(raw.fbc);
  if (raw.fbp) userData.fbp = String(raw.fbp);
  if (click?.user_agent) userData.client_user_agent = String(click.user_agent);
  if (!userData.fbc && !userData.fbp) {
    throw new Error("clique sem fbc/fbp para match");
  }

  const value = purchaseValue(conversion);
  const customData = {
    currency: "BRL",
    content_type: "product",
    content_ids: [String(conversion.item_id || "")].filter(Boolean),
    num_items: Math.max(1, Number(conversion.qty) || 1),
    order_id: String(conversion.order_id || conversion.conversion_id),
  };
  if (value > 0) customData.value = Math.round(value * 100) / 100;

  return {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: eventIdForConversion(conversion.conversion_id),
    event_source_url: String(raw.url || "https://www.afiliadamestre.com/"),
    action_source: config.actionSource,
    user_data: userData,
    custom_data: customData,
  };
}

async function findClickAttribution(clickId) {
  const id = normalizeClickId(clickId);
  if (!id) return null;
  const rows = await supabaseRequest(
    `/analytics_events?event_name=eq.ClickShopee`
      + `&raw-%3E%3Eclick_id=eq.${encodeURIComponent(id)}`
      + `&select=session_id,created_at,ip_hash,user_agent,url,utm_campaign,utm_source,utm_medium,raw`
      + `&order=created_at.desc&limit=1`,
    { method: "GET", useService: true }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function purchaseAlreadySent(conversionId) {
  const id = String(conversionId || "").replace(/[^\d]/g, "");
  if (!id) return false;
  const rows = await supabaseRequest(
    `/analytics_events?event_name=eq.ClickShopee`
      + `&raw-%3E%3Erecord_type=eq.meta_purchase`
      + `&raw-%3E%3Econversion_id=eq.${encodeURIComponent(id)}`
      + `&select=id&limit=1`,
    { method: "GET", useService: true }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function sendMetaPurchase(event, config, fetchImpl = fetch) {
  if (!config?.configured) throw new Error("Meta CAPI nao configurada");
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`;
  const body = { data: [event] };
  if (config.mode === "test") body.test_event_code = config.testEventCode;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data?.error) {
    const err = new Error(data?.error?.message || `Meta HTTP ${response.status}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function recordPurchaseSent(conversion, click, event, response, config) {
  const row = {
    // Usa um tipo já aceito pelo schema atual; record_type diferencia este
    // ledger dos cliques reais sem exigir migração destrutiva em produção.
    event_name: "ClickShopee",
    session_id: click.session_id,
    product_id: Number(conversion.item_id) || null,
    product_section: "campaign",
    source: "unknown",
    url: event.event_source_url,
    ip_hash: click.ip_hash || null,
    user_agent: click.user_agent || null,
    utm_campaign: click.utm_campaign || null,
    utm_source: click.utm_source || null,
    utm_medium: click.utm_medium || null,
    raw: {
      record_type: "meta_purchase",
      conversion_id: String(conversion.conversion_id),
      order_id: String(conversion.order_id || ""),
      source_click_id: String(conversion.sub_id2 || ""),
      event_id: event.event_id,
      capi_mode: config.mode,
      events_received: Number(response?.events_received) || 0,
      fbtrace_id: response?.fbtrace_id || null,
    },
  };
  await supabaseRequest("/analytics_events", {
    method: "POST",
    body: row,
    prefer: "return=minimal",
    useService: true,
  });
}

async function listEligibleConversions(limit = 200) {
  const from = new Date(Date.now() - (MAX_EVENT_AGE_SEC - 3600) * 1000).toISOString();
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await supabaseRequest(
    `/conversions?purchase_time=gte.${encodeURIComponent(from)}`
      + `&order_status=in.(PENDING,COMPLETED)`
      + `&sub_id2=not.is.null`
      + `&select=conversion_id,purchase_time,order_id,order_status,item_id,item_name,item_price,actual_amount,qty,sub_id1,sub_id2,utm_content`
      + `&order=purchase_time.asc&limit=${safeLimit}`,
    { method: "GET", useService: true }
  );
  return Array.isArray(rows) ? rows : [];
}

async function processMetaPurchases({ dryRun = false, limit = 200, fetchImpl = fetch } = {}) {
  const config = getMetaCapiConfig();
  if (!dryRun && !config.configured) {
    return {
      ok: true,
      skipped: true,
      reason: config.mode === "off" ? "disabled" : "missing_config",
      mode: config.mode,
    };
  }

  const conversions = await listEligibleConversions(limit);
  const result = {
    ok: true,
    dryRun: Boolean(dryRun),
    mode: config.mode,
    scanned: conversions.length,
    matched: 0,
    ready: 0,
    sent: 0,
    duplicate: 0,
    unmatched: 0,
    invalid: 0,
    failed: 0,
    samples: [],
  };

  for (const conversion of conversions) {
    const clickId = normalizeClickId(conversion.sub_id2);
    if (!clickId) {
      result.invalid += 1;
      continue;
    }
    if (await purchaseAlreadySent(conversion.conversion_id)) {
      result.duplicate += 1;
      continue;
    }
    const click = await findClickAttribution(clickId);
    if (!click) {
      result.unmatched += 1;
      continue;
    }
    result.matched += 1;
    try {
      const event = buildPurchaseEvent(conversion, click, config);
      result.ready += 1;
      if (result.samples.length < 5) {
        result.samples.push({
          conversionId: String(conversion.conversion_id),
          clickId,
          eventId: event.event_id,
          status: conversion.order_status,
          value: event.custom_data.value || 0,
          hasFbc: Boolean(event.user_data.fbc),
          hasFbp: Boolean(event.user_data.fbp),
        });
      }
      if (dryRun) continue;
      const response = await sendMetaPurchase(event, config, fetchImpl);
      await recordPurchaseSent(conversion, click, event, response, config);
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      if (result.errors == null) result.errors = [];
      if (result.errors.length < 5) {
        result.errors.push({
          conversionId: String(conversion.conversion_id),
          error: err.message,
        });
      }
    }
  }

  return result;
}

function clampNum(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

let lastSilenceAlertAt = 0;

async function getLastPurchaseSentAt() {
  const rows = await supabaseRequest(
    `/analytics_events?event_name=eq.ClickShopee`
      + `&raw-%3E%3Erecord_type=eq.meta_purchase`
      + `&select=created_at,raw`
      + `&order=created_at.desc&limit=1`,
    { method: "GET", useService: true }
  );
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0].created_at || null;
}

function silenceConfig(env = process.env) {
  return {
    silenceHours: clampNum(env.META_CAPI_SILENCE_HOURS, 6, 1, 168),
    alertCooldownHours: clampNum(env.META_CAPI_ALERT_COOLDOWN_HOURS, 6, 1, 168),
    webhook: String(env.META_CAPI_ALERT_WEBHOOK || "").trim(),
  };
}

/**
 * Se passar X horas sem nenhum Purchase enviado, avisa (webhook Discord/Slack).
 * Não mexe em Pixel/Shopee — só lê o ledger local de meta_purchase.
 */
async function checkPurchaseSilence({ fetchImpl = fetch, now = Date.now(), alert = true } = {}) {
  const config = getMetaCapiConfig();
  const silence = silenceConfig();
  const lastSentAt = await getLastPurchaseSentAt().catch(() => null);
  const lastMs = lastSentAt ? new Date(lastSentAt).getTime() : null;
  const hoursSilent = lastMs && Number.isFinite(lastMs)
    ? Math.max(0, (now - lastMs) / 3600000)
    : null;
  const isSilent = config.configured && (
    hoursSilent == null || hoursSilent >= silence.silenceHours
  );
  const result = {
    ok: true,
    mode: config.mode,
    configured: config.configured,
    lastSentAt,
    silenceHours: silence.silenceHours,
    hoursSilent: hoursSilent == null ? null : Math.round(hoursSilent * 10) / 10,
    isSilent,
    webhookConfigured: Boolean(silence.webhook),
    alerted: false,
  };
  if (!alert || !isSilent || !silence.webhook) return result;

  const cooldownMs = silence.alertCooldownHours * 3600000;
  if (now - lastSilenceAlertAt < cooldownMs) {
    result.skipped = "cooldown";
    return result;
  }

  const text = hoursSilent == null
    ? `[Afiliada Mestre] Meta CAPI em modo ${config.mode}: nenhum Purchase enviado ainda (limite ${silence.silenceHours}h).`
    : `[Afiliada Mestre] Meta CAPI em modo ${config.mode}: ${result.hoursSilent}h sem Purchase (limite ${silence.silenceHours}h). Último: ${lastSentAt}`;

  try {
    const response = await fetchImpl(silence.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        content: text,
        username: "Afiliada Mestre CAPI",
      }),
    });
    if (!response.ok) {
      result.alertError = `webhook HTTP ${response.status}`;
      return result;
    }
    lastSilenceAlertAt = now;
    result.alerted = true;
  } catch (err) {
    result.alertError = err.message;
  }
  return result;
}

module.exports = {
  DEFAULT_PIXEL_ID,
  MAX_EVENT_AGE_SEC,
  getMetaCapiConfig,
  eventIdForConversion,
  purchaseValue,
  buildPurchaseEvent,
  sendMetaPurchase,
  processMetaPurchases,
  getLastPurchaseSentAt,
  checkPurchaseSilence,
  silenceConfig,
};

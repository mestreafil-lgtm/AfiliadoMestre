"use strict";

/**
 * Persistência e sumário de conversões — fonte do "Painel do Meu Site".
 *
 * Toda venda é rotulada por utmContent (sub_id1..5). Vendas com sub_id1='afiliadamestre'
 * são consideradas "do meu site" (coluna gerada is_meu_site).
 */

const {
  fetchConversionReport,
  fetchValidatedReport,
} = require("./shopee");
const {
  supabaseRequest,
  buildMineFilter,
  isKnownCampaign,
} = require("./supabase");
const { SITE_SUBID, sanitizeSubId } = require("./tracking");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * utmContent do Shopee: os 5 slots unidos por "-" ("sub1-sub2-sub3-sub4-sub5").
 * Slots vazios aparecem como separadores seguidos ("STORY----"), então a divisão
 * é posicional — colapsar separadores deslocaria canal/campanha de lugar.
 * "_" e "|" ficam aceitos por causa de links antigos.
 */
const UTM_SUBID_SEPARATOR = /[-_|,;/]/;

function parseUtmSubIds(utmContent) {
  const raw = String(utmContent || "").trim();
  if (!raw) return { sub_id1: null, sub_id2: null, sub_id3: null, sub_id4: null, sub_id5: null };
  const parts = raw.split(UTM_SUBID_SEPARATOR).map((s) => s.trim()).slice(0, 5);
  return {
    sub_id1: parts[0] || null,
    sub_id2: parts[1] || null,
    sub_id3: parts[2] || null,
    sub_id4: parts[3] || null,
    sub_id5: parts[4] || null,
  };
}

function unixToIso(ts) {
  if (ts == null || ts === "") return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aplaina 1 nó conversionReport/validatedReport em 1..N rows conversions.
 * Um conversion pode ter N orders com N items — vira 1 row por item
 * (agrupamento fino que preserva sub_ids e habilita "top item").
 * Se todos os items compartilharem os mesmos sub_ids, é apenas uma questão de granularidade;
 * conversion_id continua único por linha usando composição (conversionId << 16 | itemId % 65535).
 * Para simplicidade e evitar colisão, usamos apenas conversion_id do primeiro item e ignoramos
 * outros items do mesmo conversion — Shopee normalmente devolve 1 item por conversion.
 */
function flattenConversionNode(node, { validated = false } = {}) {
  const subs = parseUtmSubIds(node.utmContent);
  const base = {
    conversion_id: Number(node.conversionId),
    purchase_time: unixToIso(node.purchaseTime),
    click_time: unixToIso(node.clickTime),
    order_id: null,
    order_status: null,
    fraud_status: null,
    shop_id: null,
    shop_name: null,
    shop_type: null,
    item_id: null,
    item_name: null,
    item_price: null,
    actual_amount: null,
    refund_amount: null,
    qty: null,
    complete_time: null,
    total_commission: toNumOrNull(node.totalCommission),
    net_commission: toNumOrNull(node.netCommission),
    seller_commission: toNumOrNull(node.sellerCommission),
    shopee_commission_capped: toNumOrNull(node.shopeeCommissionCapped),
    mcn_management_fee: toNumOrNull(node.mcnManagementFee),
    utm_content: node.utmContent || null,
    ...subs,
    validated: !!validated,
    updated_at: new Date().toISOString(),
  };

  const orders = Array.isArray(node.orders) ? node.orders : [];
  if (!orders.length || !orders[0].items?.length) {
    if (!Number.isSafeInteger(base.conversion_id)) return null;
    return base;
  }

  // Pega o 1º item do 1º order — 99% dos conversions são 1 item.
  const order = orders[0];
  const item = order.items[0];
  base.order_id = order.orderId || null;
  base.order_status = String(order.orderStatus || "").trim().toUpperCase() || null;
  base.shop_type = toNumOrNull(order.shopType);
  base.shop_id = toNumOrNull(item.shopId);
  base.shop_name = item.shopName || null;
  base.item_id = toNumOrNull(item.itemId);
  base.item_name = item.itemName || null;
  base.item_price = toNumOrNull(item.itemPrice);
  base.actual_amount = toNumOrNull(item.actualAmount);
  base.refund_amount = toNumOrNull(item.refundAmount);
  base.qty = toNumOrNull(item.qty);
  base.complete_time = unixToIso(item.completeTime);
  base.fraud_status = item.fraudStatus || null;

  if (!Number.isSafeInteger(base.conversion_id)) return null;
  return base;
}

async function upsertConversions(rows = []) {
  if (!rows?.length) return 0;
  const clean = rows.filter((r) => r && Number.isSafeInteger(r.conversion_id));
  if (!clean.length) return 0;
  // O relatório repete o mesmo conversion_id dentro da página (uma linha por
  // item do pedido). Mandar as duas no mesmo POST faz o Postgres recusar o
  // lote inteiro com 21000 ("cannot affect row a second time") e nada é salvo.
  // Fica a última ocorrência, que é a leitura mais recente daquele id.
  const byId = new Map();
  for (const row of clean) byId.set(row.conversion_id, row);
  const unique = [...byId.values()];
  // Chunks pra não estourar payload
  const CHUNK = 200;
  let saved = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    try {
      const out = await supabaseRequest("/conversions?on_conflict=conversion_id", {
        method: "POST",
        body: slice,
        prefer: "resolution=merge-duplicates,return=minimal",
        useService: true,
      });
      saved += Array.isArray(out) ? out.length : slice.length;
    } catch (err) {
      console.warn("[upsertConversions] chunk falhou:", err.message);
    }
  }
  return saved;
}

async function pullConversionReportOnce({
  purchaseTimeStart,
  purchaseTimeEnd,
  orderStatus = "",
  maxPages = 20,
  limit = 50,
} = {}) {
  let scrollId = "";
  let pages = 0;
  let totalNodes = 0;
  let saved = 0;
  const started = Date.now();

  while (pages < Number(maxPages)) {
    let page;
    try {
      page = await fetchConversionReport({
        purchaseTimeStart,
        purchaseTimeEnd,
        orderStatus,
        limit,
        scrollId,
      });
    } catch (err) {
      if (err && err.rateLimited) {
        return { ok: true, pages, totalNodes, saved, ms: Date.now() - started, rateLimited: true };
      }
      throw err;
    }
    const nodes = Array.isArray(page.nodes) ? page.nodes : [];
    totalNodes += nodes.length;

    const rows = nodes
      .map((n) => flattenConversionNode(n, { validated: false }))
      .filter(Boolean);
    saved += await upsertConversions(rows);

    pages += 1;
    const nextScroll = page.pageInfo?.scrollId || "";
    const hasNext = !!page.pageInfo?.hasNextPage && nextScroll && nextScroll !== scrollId;
    if (!hasNext) break;
    scrollId = nextScroll;
    await sleep(200);
  }

  return {
    ok: true,
    pages,
    totalNodes,
    saved,
    ms: Date.now() - started,
  };
}

/**
 * Puxa conversionReport da Shopee e grava/atualiza no Supabase.
 * Percorre cada status (PENDING/COMPLETED/CANCELLED/UNPAID) para o merge
 * atualizar Pedido pendente → concluído/cancelado, não só inserir novos.
 */
async function pullConversionReport({
  sinceMin = 60 * 48,
  purchaseTimeStart,
  purchaseTimeEnd,
  orderStatus = "",
  maxPages = 40,
  limit = 50,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const start = purchaseTimeStart != null
    ? Number(purchaseTimeStart)
    : now - Math.max(60, Number(sinceMin) * 60);
  const end = purchaseTimeEnd != null ? Number(purchaseTimeEnd) : now;
  const started = Date.now();
  const requested = String(orderStatus || "").trim().toUpperCase();
  const statuses = ["UNPAID", "PENDING", "COMPLETED", "CANCELLED"].includes(requested)
    ? [requested]
    : ["PENDING", "UNPAID", "COMPLETED", "CANCELLED"];
  const pagesPerStatus = Math.max(6, Math.ceil(Number(maxPages) / statuses.length));

  let pages = 0;
  let totalNodes = 0;
  let saved = 0;
  const byStatus = {};
  let rateLimited = false;

  for (const st of statuses) {
    const part = await pullConversionReportOnce({
      purchaseTimeStart: start,
      purchaseTimeEnd: end,
      orderStatus: st,
      maxPages: pagesPerStatus,
      limit,
    });
    pages += part.pages || 0;
    totalNodes += part.totalNodes || 0;
    saved += part.saved || 0;
    byStatus[st] = {
      pages: part.pages || 0,
      nodes: part.totalNodes || 0,
      saved: part.saved || 0,
    };
    if (part.rateLimited) {
      rateLimited = true;
      break;
    }
  }

  return {
    ok: true,
    pages,
    totalNodes,
    saved,
    byStatus,
    windowStart: unixToIso(start),
    windowEnd: unixToIso(end),
    ms: Date.now() - started,
    rateLimited,
  };
}

/**
 * Puxa validatedReport (validação de comissão). Marca validated=true nos rows correspondentes.
 */
async function pullValidatedReport({
  validationId,
  maxPages = 40,
  limit = 50,
} = {}) {
  const vid = Number(validationId);
  if (!Number.isSafeInteger(vid) || vid <= 0) {
    const err = new Error("validationId obrigatório");
    err.status = 400;
    throw err;
  }
  let scrollId = "";
  let pages = 0;
  let totalNodes = 0;
  let saved = 0;
  const started = Date.now();

  while (pages < Number(maxPages)) {
    let page;
    try {
      page = await fetchValidatedReport({ validationId: vid, limit, scrollId });
    } catch (err) {
      if (err && err.rateLimited) {
        return { ok: true, pages, totalNodes, saved, ms: Date.now() - started, rateLimited: true };
      }
      throw err;
    }
    const nodes = Array.isArray(page.nodes) ? page.nodes : [];
    totalNodes += nodes.length;

    const rows = nodes
      .map((n) => flattenConversionNode(n, { validated: true }))
      .filter(Boolean);
    saved += await upsertConversions(rows);

    pages += 1;
    const nextScroll = page.pageInfo?.scrollId || "";
    const hasNext = !!page.pageInfo?.hasNextPage && nextScroll && nextScroll !== scrollId;
    if (!hasNext) break;
    scrollId = nextScroll;
    await sleep(500);
  }

  return { ok: true, pages, totalNodes, saved, ms: Date.now() - started };
}

function windowFromParams({ from, to, days } = {}) {
  const now = new Date();
  let end = to ? new Date(to) : now;
  if (isNaN(end.getTime())) end = now;
  let start;
  if (from) {
    start = new Date(from);
    if (isNaN(start.getTime())) start = null;
  }
  if (!start) {
    const d = Math.max(1, Number(days) || 30);
    start = new Date(end.getTime() - d * 24 * 3600 * 1000);
  }
  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
  };
}

/**
 * summary({from, to, onlyMeuSite}) — cards + top listas.
 * Retorna null-friendly (nunca lança).
 */
async function summary({ from, to, days = 30, onlyMeuSite = true } = {}) {
  const { fromIso, toIso } = windowFromParams({ from, to, days });
  const baseFilter = `purchase_time=gte.${encodeURIComponent(fromIso)}&purchase_time=lte.${encodeURIComponent(toIso)}`;
  // "Meu site" agora inclui campanhas standalone (sub_id1 = nome-de-campanha).
  const mineFilter = onlyMeuSite ? await buildMineFilter() : "";
  const scopeFilter = onlyMeuSite ? `${baseFilter}&${mineFilter}` : baseFilter;

  async function safeGet(path) {
    try {
      return await supabaseRequest(path, { method: "GET", useService: true });
    } catch (err) {
      return null;
    }
  }

  // Puxa todas as conversions da janela (limita a 5000 pra não estourar payload)
  const rows = await safeGet(
    `/conversions?select=conversion_id,purchase_time,order_status,fraud_status,shop_id,shop_name,item_id,item_name,item_price,actual_amount,net_commission,total_commission,sub_id3,validated&${scopeFilter}&order=purchase_time.desc&limit=5000`
  ) || [];

  const list = Array.isArray(rows) ? rows : [];
  let gross = 0;
  let net = 0;
  let pendingGross = 0;
  let pendingNet = 0;
  let orders = 0;
  let completed = 0;
  let pending = 0;
  let unpaid = 0;
  let cancelled = 0;
  let fraud = 0;
  let validatedCount = 0;
  let sumTicket = 0;
  let ticketOrders = 0;
  const byItem = new Map();
  const byShop = new Map();
  const byCampaign = new Map();

  for (const r of list) {
    const status = String(r.order_status || "").toUpperCase();
    const g = Number(r.total_commission) || 0;
    const n = Number(r.net_commission) || 0;
    orders += 1;
    if (r.validated) validatedCount += 1;
    if (status === "CANCELLED") cancelled += 1;
    else if (status === "COMPLETED") completed += 1;
    else if (status === "UNPAID") unpaid += 1;
    else if (status === "PENDING") pending += 1;
    if (String(r.fraud_status).toUpperCase() === "FRAUD") fraud += 1;

    // Comissão "real" do card = só Concluído. Pendente/Não pago = estimativa à parte.
    // Cancelado não entra em nenhum dos dois.
    if (status === "COMPLETED") {
      gross += g;
      net += n;
      const ticket = Number(r.actual_amount) || Number(r.item_price) || 0;
      sumTicket += ticket;
      ticketOrders += 1;
    } else if (status === "PENDING" || status === "UNPAID") {
      pendingGross += g;
      pendingNet += n;
    }

    // Tops: ignora cancelados (não poluem ranking com R$ 0 / lixo).
    if (status === "CANCELLED") continue;
    const moneyG = g;
    const moneyN = n;
    if (r.item_id) {
      const key = String(r.item_id);
      const prev = byItem.get(key) || { itemId: r.item_id, itemName: r.item_name, gross: 0, net: 0, orders: 0 };
      prev.gross += moneyG;
      prev.net += moneyN;
      prev.orders += 1;
      if (r.item_name && !prev.itemName) prev.itemName = r.item_name;
      byItem.set(key, prev);
    }
    if (r.shop_id) {
      const key = String(r.shop_id);
      const prev = byShop.get(key) || { shopId: r.shop_id, shopName: r.shop_name, gross: 0, net: 0, orders: 0 };
      prev.gross += moneyG;
      prev.net += moneyN;
      prev.orders += 1;
      if (r.shop_name && !prev.shopName) prev.shopName = r.shop_name;
      byShop.set(key, prev);
    }
    if (r.sub_id3) {
      const key = String(r.sub_id3);
      const prev = byCampaign.get(key) || { campaign: r.sub_id3, gross: 0, net: 0, orders: 0 };
      prev.gross += moneyG;
      prev.net += moneyN;
      prev.orders += 1;
      byCampaign.set(key, prev);
    }
  }

  const topItems = [...byItem.values()].sort((a, b) => b.net - a.net).slice(0, 10);
  const topShops = [...byShop.values()].sort((a, b) => b.net - a.net).slice(0, 10);
  const topCampaigns = [...byCampaign.values()].sort((a, b) => b.net - a.net).slice(0, 10);

  return {
    ok: true,
    window: { from: fromIso, to: toIso },
    onlyMeuSite: !!onlyMeuSite,
    siteSubId: SITE_SUBID,
    totals: {
      orders,
      completed,
      pending,
      unpaid,
      cancelled,
      fraud,
      validated: validatedCount,
      // Confirmada (COMPLETED)
      gross: Math.round(gross * 100) / 100,
      net: Math.round(net * 100) / 100,
      // Estimada (PENDING + UNPAID)
      pendingGross: Math.round(pendingGross * 100) / 100,
      pendingNet: Math.round(pendingNet * 100) / 100,
      avgTicket: ticketOrders ? Math.round((sumTicket / ticketOrders) * 100) / 100 : 0,
      cancelledPct: orders ? Math.round((cancelled / orders) * 1000) / 10 : 0,
      fraudPct: orders ? Math.round((fraud / orders) * 1000) / 10 : 0,
      completedPct: orders ? Math.round((completed / orders) * 1000) / 10 : 0,
    },
    topItems,
    topShops,
    topCampaigns,
    sampleSize: list.length,
  };
}

/**
 * topSignalsFromMySite — Sinais pra o autosync priorizar keywords/lojas/itens
 * que JÁ VENDERAM pro meu site. Retorna listas ordenadas por net_commission.
 */
async function topSignalsFromMySite({ days = 30, limit = 20 } = {}) {
  const { fromIso, toIso } = windowFromParams({ days });
  try {
    const mineFilter = await buildMineFilter();
    const rows = await supabaseRequest(
      `/conversions?select=item_id,shop_id,sub_id3,net_commission,total_commission&${mineFilter}&purchase_time=gte.${encodeURIComponent(fromIso)}&purchase_time=lte.${encodeURIComponent(toIso)}&order=purchase_time.desc&limit=5000`,
      { method: "GET", useService: true }
    );
    const list = Array.isArray(rows) ? rows : [];
    const byItem = new Map();
    const byShop = new Map();
    const byCampaign = new Map();
    for (const r of list) {
      const money = Number(r.net_commission) || Number(r.total_commission) || 0;
      if (r.item_id) {
        const k = String(r.item_id);
        byItem.set(k, (byItem.get(k) || 0) + money);
      }
      if (r.shop_id) {
        const k = String(r.shop_id);
        byShop.set(k, (byShop.get(k) || 0) + money);
      }
      if (r.sub_id3) {
        const k = String(r.sub_id3);
        byCampaign.set(k, (byCampaign.get(k) || 0) + money);
      }
    }
    const sortDesc = (m) => [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, v]) => ({ key: k, money: Math.round(v * 100) / 100 }));
    return {
      topItemIds: sortDesc(byItem).map((x) => Number(x.key)).filter((n) => Number.isSafeInteger(n) && n > 0),
      topShopIds: sortDesc(byShop).map((x) => Number(x.key)).filter((n) => Number.isSafeInteger(n) && n > 0),
      topCampaigns: sortDesc(byCampaign).map((x) => x.key),
    };
  } catch (_) {
    // Tabela ainda não existe — retorna vazio, autosync segue com a fila normal.
    return { topItemIds: [], topShopIds: [], topCampaigns: [] };
  }
}

/**
 * Backfill de sub_ids em ofertas antigas que não têm SITE_SUBID no slot 1.
 * Reprocessa os sub_ids da vitrine (fluxo orgânico) e força regenerate do
 * short_link. Ofertas com sub_ids de campanha standalone (1 slot só) ficam
 * de fora — quem regera essas é o endpoint /api/admin/campanha/regenerar.
 */
async function reprocessSubIds({ limit = 100, dryRun = false } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  // PostgREST: sub_ids sem SITE_SUBID no slot 1 OU sub_ids nulo
  const path = `/ofertas?select=item_id,category,subcategory,offer_link,product_link,shop_id,sub_ids,short_link&or=(sub_ids.is.null,not.sub_ids.cs.{${SITE_SUBID}})&limit=${safeLimit}`;
  let rows = [];
  try {
    rows = await supabaseRequest(path, { method: "GET", useService: true });
  } catch (err) {
    console.warn("[reprocessSubIds] busca falhou:", err.message);
    return { ok: false, error: err.message };
  }
  const list = Array.isArray(rows) ? rows : [];
  if (dryRun) return { ok: true, dryRun: true, candidates: list.length, sample: list.slice(0, 10) };

  if (!list.length) return { ok: true, updated: 0, regenerated: 0, note: "Nada pra reprocessar" };

  const { ensureLinkedRows } = require("./linking");
  const { upsertOfertas } = require("./supabase");

  // ensureLinkedRows já normaliza sub_ids e gera short_link novo se preciso
  const result = await ensureLinkedRows(list, { regenerate: true });
  const saved = await upsertOfertas(result.rows);
  return {
    ok: true,
    scanned: list.length,
    saved: Array.isArray(saved) ? saved.length : list.length,
    shortlinks: {
      generated: result.generated,
      pending: result.pending,
      skipped: result.skipped,
    },
  };
}

/**
 * Decodifica um shortlink/URL — retorna os 5 sub_ids embutidos.
 * Aceita:
 *   - shortlink s.shopee.com.br/... (segue o redirect não é preciso: sub_ids são metadata do link)
 *   - URL tracking já expandida (contém sub_id / utm_content)
 * NOTA: shortlinks só podem ser decodificados chamando a API — o Shopee retorna
 * originUrl+longLink no generateShortLink. Aqui só validamos URLs que já contenham utm_content.
 */
/** shopee.com.br/<nome>/<shopId>/<itemId> ou /product/<shopId>/<itemId>. */
function itemIdFromShopeeUrl(u) {
  const segs = String(u.pathname || "").split("/").filter(Boolean);
  const last = segs[segs.length - 1];
  const n = Number(last);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function decodeSubIdsFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return { ok: false, error: "url vazia" };
  try {
    const u = new URL(raw);
    const utmContent = u.searchParams.get("utm_content") || u.searchParams.get("sub_id") || "";
    const parts = parseUtmSubIds(utmContent);
    const slot1 = sanitizeSubId(parts.sub_id1, "");
    const isSiteMarker = slot1 === SITE_SUBID;
    const isCampaignLink = !isSiteMarker && slot1 && await isKnownCampaign(slot1);
    const isMeuSite = isSiteMarker || isCampaignLink;
    const subIds = [parts.sub_id1, parts.sub_id2, parts.sub_id3, parts.sub_id4, parts.sub_id5].filter(Boolean);
    // Slot 5 guarda p<itemId>; se a URL já traz o id no caminho, ele vale mais.
    const fromSlot = /^p(\d+)$/.exec(String(parts.sub_id5 || ""));
    const itemId = itemIdFromShopeeUrl(u) || (fromSlot ? Number(fromSlot[1]) : null);
    // Encurtador não carrega os Sub IDs na URL: eles só existem no destino.
    const isShortener = /^(s\.shopee\.|shope\.ee)/i.test(u.hostname);
    if (!utmContent && isShortener) {
      return {
        ok: true,
        url: raw,
        shortener: true,
        subIds: [],
        isMeuSite: false,
        isMySite: false,
        siteSubId: SITE_SUBID,
        note: "Este é um link encurtado: os Sub IDs ficam no destino, não na URL. Abra o link e cole aqui o endereço final (o que tem utm_content).",
      };
    }
    // Link de campanha standalone: nome da campanha vira Sub_id1, os demais
    // slots ficam vazios. Nesse formato o "campaign" real é o slot 1 mesmo.
    const campaignName = isCampaignLink ? slot1 : (parts.sub_id3 || null);
    const note = isSiteMarker
      ? "✅ Este link é do seu site (sub_id1 = " + SITE_SUBID + ")."
      : isCampaignLink
        ? `✅ Este link é da sua campanha "${slot1}" (formato standalone).`
        : "⚠️ Este link NÃO tem SITE_SUBID no slot 1 nem campanha conhecida — venda não será rastreada como sua.";
    return {
      ok: true,
      url: raw,
      utmContent,
      subIds,
      itemId,
      channel: parts.sub_id2 || null,
      campaign: campaignName,
      category: parts.sub_id4 || null,
      destination: u.origin + u.pathname,
      isMeuSite,
      // O painel lê isMySite; mantemos os dois nomes pra não quebrar chamador antigo.
      isMySite: isMeuSite,
      isCampaignLink,
      siteSubId: SITE_SUBID,
      note,
    };
  } catch (err) {
    return { ok: false, error: "URL inválida: " + err.message };
  }
}

/**
 * Desempenho de campanhas a partir do banco (mesma fonte do Meu Site).
 * Devolve nós no formato que o painel já espera (utmContent + orders/items),
 * pra não divergir do summary que lê sub_id3 direto da tabela.
 */
async function campaignPerformanceFromDb({ days = 30, status = "" } = {}) {
  const { fromIso, toIso } = windowFromParams({ days });
  const statusFilter = String(status || "").trim().toUpperCase();
  const mineFilter = await buildMineFilter();
  let path =
    `/conversions?select=conversion_id,purchase_time,order_id,order_status,fraud_status,shop_id,shop_name,item_id,item_name,item_price,actual_amount,qty,total_commission,net_commission,seller_commission,shopee_commission_capped,utm_content,sub_id1,sub_id2,sub_id3,sub_id4,sub_id5,updated_at` +
    `&${mineFilter}` +
    `&purchase_time=gte.${encodeURIComponent(fromIso)}` +
    `&purchase_time=lte.${encodeURIComponent(toIso)}` +
    `&order=purchase_time.desc&limit=5000`;
  if (statusFilter) {
    path += `&order_status=eq.${encodeURIComponent(statusFilter)}`;
  }

  let rows = [];
  try {
    const out = await supabaseRequest(path, { method: "GET", useService: true });
    rows = Array.isArray(out) ? out : [];
  } catch (err) {
    const e = new Error(err.message || "Falha ao ler conversions");
    e.status = err.status || 500;
    throw e;
  }

  const conversions = rows.map((r) => {
    const purchaseUnix = r.purchase_time
      ? Math.floor(new Date(r.purchase_time).getTime() / 1000)
      : 0;
    const utm =
      r.utm_content ||
      [r.sub_id1, r.sub_id2, r.sub_id3, r.sub_id4, r.sub_id5]
        .map((s) => (s == null ? "" : String(s)))
        .join("-");
    return {
      conversionId: r.conversion_id,
      purchaseTime: purchaseUnix,
      utmContent: utm,
      totalCommission: Number(r.total_commission) || 0,
      netCommission: Number(r.net_commission) || 0,
      sellerCommission: Number(r.seller_commission) || 0,
      shopeeCommissionCapped: Number(r.shopee_commission_capped) || 0,
      source: "db",
      updatedAt: r.updated_at || null,
      orders: [
        {
          orderId: r.order_id,
          orderStatus: r.order_status || "UNKNOWN",
          items: [
            {
              itemId: r.item_id,
              itemName: r.item_name || (r.item_id ? `Item ${r.item_id}` : "Item"),
              shopId: r.shop_id,
              shopName: r.shop_name || "",
              itemPrice: Number(r.item_price) || 0,
              actualAmount: Number(r.actual_amount) || 0,
              qty: Number(r.qty) || 1,
              itemTotalCommission: Number(r.net_commission) || Number(r.total_commission) || 0,
              fraudStatus: r.fraud_status || null,
              imageUrl: "",
            },
          ],
        },
      ],
    };
  });

  // Enriquecer fotos a partir do catálogo (ofertas), sem chamar a Shopee.
  try {
    const { getOffersByItemIds } = require("./supabase");
    const ids = [...new Set(conversions.map((c) => c.orders?.[0]?.items?.[0]?.itemId).filter(Boolean))];
    if (ids.length) {
      const offers = await getOffersByItemIds(ids);
      const byId = new Map((offers || []).map((o) => [String(o.item_id), o]));
      for (const c of conversions) {
        const item = c.orders?.[0]?.items?.[0];
        if (!item?.itemId) continue;
        const offer = byId.get(String(item.itemId));
        if (offer?.image_url) item.imageUrl = offer.image_url;
        if (offer?.category) item.category = offer.category;
      }
    }
  } catch (_) {}

  return {
    ok: true,
    source: "db",
    days: Number(days) || 30,
    window: { from: fromIso, to: toIso },
    count: conversions.length,
    conversions,
    pageInfo: { hasNextPage: false, scrollId: "" },
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  parseUtmSubIds,
  flattenConversionNode,
  pullConversionReport,
  pullValidatedReport,
  summary,
  campaignPerformanceFromDb,
  topSignalsFromMySite,
  reprocessSubIds,
  decodeSubIdsFromUrl,
  upsertConversions,
};

"use strict";

/**
 * Marcador fixo deste site nas conversões Shopee (utmContent).
 * Precisa ser alfanumérico puro — Shopee rejeita "_" e "-" como sub id.
 */
const SITE_SUBID = "afiliadamestre";

/** Códigos curtos de seção da vitrine → slot 3 (campanha) no painel Shopee. */
const SECTION_CODES = {
  home: "vitrine",
  home_hero: "hh",
  flash_deals: "fl",
  top_sellers: "ts",
  big_discounts: "bd",
  top_rated: "tr",
  official_shops: "of",
  category_page: "ct",
  search_result: "sr",
  modal_direct: "md",
  destaque: "vd",
  oficial: "oficial",
  premium_picks: "prem",
  moda_picks: "moda",
  beleza_picks: "beleza",
  for_her: "praela",
};

/**
 * Sub IDs Shopee: SÓ ALFANUMÉRICO. A API rejeita `_` e `-` como "invalid sub id".
 * Convertemos separadores (espaço/underscore/hífen) removendo-os e mantendo case-insensitive.
 */
function sanitizeSubId(value, fallback = "geral") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40);
  return clean || fallback;
}

/**
 * SubID de 1 slot só com o nome da campanha — espelha as campanhas manuais
 * que o Diego cria direto no painel da Shopee (`TESTE211----`).
 * A venda cai no relatório com `Sub_id1 = <nome>`, `Sub_id2..5` vazios,
 * então o filtro "Sub_id" da Shopee bate exatamente na campanha.
 *
 * ATENÇÃO: quebra a invariante do SITE_SUBID no slot 1. A detecção de "meu site"
 * precisa consultar a tabela `campanhas_rastreio` como fallback (ver conversions.js).
 */
function buildCampaignSubIds(campaignName) {
  const clean = sanitizeSubId(campaignName, "");
  if (!clean) return [SITE_SUBID];
  return [clean];
}

/** True se subIds parece slug de campanha standalone (1 slot preenchido). */
function looksLikeCampaignSubIds(subIds) {
  if (!Array.isArray(subIds) || !subIds.length) return false;
  const filled = subIds.filter((s) => s != null && String(s).length);
  return filled.length === 1 && filled[0] !== SITE_SUBID;
}

/**
 * Sub IDs padrão de cada produto — gravados no sync (sem chamada extra à Shopee).
 * 1 site | 2 canal base | 3 campanha base | 4 categoria[+sub] | 5 produto
 */
function buildProductSubIds(category, itemId, subcategory = null, campaign = "vitrine") {
  const catBase = sanitizeSubId(category, "geral");
  const catSlot = subcategory
    ? sanitizeSubId(`${catBase}_${subcategory}`, catBase)
    : catBase;
  return [
    SITE_SUBID,
    "organico",
    sanitizeSubId(campaign, "vitrine"),
    catSlot,
    sanitizeSubId(itemId ? `p${itemId}` : "produto", "produto"),
  ].slice(0, 5);
}

/**
 * Sub IDs a partir de atribuição de tráfego (utm_source, utm_campaign, utm_medium).
 * Espelha o comportamento do cliente em `getTrackingSubIds`:
 *   1 site | 2 canal[_medium] | 3 campanha | 4 categoria[_sub] | 5 produto
 */
function buildTrackedSubIds(category, itemId, subcategory = null, attribution = {}) {
  const catBase = sanitizeSubId(category, "geral");
  const catSlot = subcategory
    ? sanitizeSubId(`${catBase}_${subcategory}`, catBase)
    : catBase;
  const channel = sanitizeSubId(attribution.channel || "organico", "organico");
  const medium = sanitizeSubId(attribution.medium || "", "");
  const channelSlot = medium && medium !== channel
    ? sanitizeSubId(`${channel}_${medium}`, channel)
    : channel;
  const campaignSlot = sanitizeSubId(attribution.campaign || "vitrine", "vitrine");
  return [
    SITE_SUBID,
    channelSlot,
    campaignSlot,
    catSlot,
    sanitizeSubId(itemId ? `p${itemId}` : "produto", "produto"),
  ].slice(0, 5);
}

function sectionToCampaign(section) {
  if (!section) return null;
  const key = String(section).trim();
  if (SECTION_CODES[key]) return SECTION_CODES[key];
  return sanitizeSubId(key, null);
}

function subIdsToText(subIds) {
  return (Array.isArray(subIds) ? subIds : []).filter(Boolean).join(" | ");
}

module.exports = {
  SITE_SUBID,
  SECTION_CODES,
  sanitizeSubId,
  buildProductSubIds,
  buildTrackedSubIds,
  buildCampaignSubIds,
  looksLikeCampaignSubIds,
  sectionToCampaign,
  subIdsToText,
};

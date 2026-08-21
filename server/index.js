"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  fetchProductOffers,
  fetchProductOffersBatch,
  fetchProductDetailsByIds,
  fetchShopeeOffers,
  generateShortLink,
  generateBatchShortLink,
  resolveProductOriginUrl,
  mapOfferToProduct,
  mapOfferToRow,
  mapCampaignNode,
  fetchConversionReport,
  listTypeLabel,
  sortTypeLabel,
  LIST_TYPE_LABELS,
  SORT_TYPE_LABELS,
  MIN_RATING,
  MIN_SALES,
  DEFAULT_BATCH_GAP_MS,
  sanitizeSubIdsForShopee,
} = require("./shopee");
const {
  upsertOfertas,
  updateShortLink,
  listOfertas,
  getOffersByItemIds,
  countByCategory,
  countBySubcategory,
  rowToProduct,
  getConfig,
  listCampanhasRastreio,
  upsertCampanhaRastreio,
  deleteCampanhaRastreio,
  patchOferta,
  deleteOfertasByIds,
  listOffersMissingShortlink,
  countShortlinkStatus,
} = require("./supabase");
const { CATEGORIAS, categoryForKeyword, weightedKeywords, allKeywords, metaOnly, sortCategoriesForHome, DEFAULT_FEMALE_PERCENT, normalizeKeywordEntry, isFemaleAudience } = require("./categorias");
const { buildCoverageReport, buildCoverageQueue } = require("./coverage");
const { refillVitrine } = require("./refillVitrine");
const { scanDuplicates, removeDuplicates } = require("./duplicates");
const {
  scanWeakOffers,
  purgeWeakOffers,
  refreshTopOffers,
  DEFAULT_MIN_COMMISSION_PCT,
} = require("./quality");
const { productMatchesSubcategory } = require("./productMeta");
const {
  SITE_SUBID,
  buildProductSubIds,
  buildTrackedSubIds,
  buildCampaignSubIds,
  sanitizeSubId,
} = require("./tracking");
const {
  generateShortlinksForRows,
  saveOffersWithShortlinks,
} = require("./shortlinks");
const autosync = require("./autosync");

const app = express();
const PORT = Number(process.env.PORT) || 3789;
const ROOT = path.join(__dirname, "..");
const VITRINE_HTML = path.join(ROOT, "uploads", "painel_e_vitrine_afiliado_mestre.html");
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function extractAdminToken(req) {
  const header = String(req.headers["x-admin-token"] || "").trim();
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return header || bearer || String(req.query.adminToken || "").trim();
}

function adminEmailAllowed(email) {
  return ADMIN_EMAILS.size > 0 && ADMIN_EMAILS.has(String(email || "").toLowerCase());
}

async function supabaseAuth(pathname, { method = "POST", body, accessToken } = {}) {
  const { url, anonKey } = getConfig();
  if (!anonKey) {
    const err = new Error("Configure SUPABASE_ANON_KEY para usar o login.");
    err.status = 503;
    throw err;
  }
  const response = await fetch(`${url}/auth/v1${pathname}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.msg || data?.message || data?.error_description || "Falha na autenticação.");
    err.status = response.status;
    throw err;
  }
  return data;
}

const adminAuthCache = new Map();
async function getAdminUser(accessToken) {
  if (!accessToken) return null;
  const cached = adminAuthCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  const user = await supabaseAuth("/user", { method: "GET", accessToken });
  if (!adminEmailAllowed(user?.email)) return null;
  adminAuthCache.set(accessToken, { user, expiresAt: Date.now() + 2 * 60 * 1000 });
  if (adminAuthCache.size > 100) adminAuthCache.clear();
  return user;
}

/** Protege as rotas do painel com uma sessão emitida pelo Supabase Auth. */
async function requireAdmin(req, res, next) {
  if (!ADMIN_EMAILS.size) {
    return res.status(503).json({
      error: "Configure ADMIN_EMAIL no servidor.",
      code: "ADMIN_AUTH_CONFIG",
    });
  }
  try {
    const user = await getAdminUser(extractAdminToken(req));
    if (user) {
      req.adminUser = user;
      return next();
    }
  } catch (_) {}
  return res.status(401).json({ error: "Sessão inválida ou expirada.", code: "ADMIN_AUTH" });
}

let warnedCronSecret = false;

/**
 * Protege os endpoints /api/cron/*, que costumavam ser públicos e drenavam
 * quota Shopee. Aceita:
 *   - header x-cron-secret, query cronSecret, ou Authorization: Bearer
 *     (a Vercel Cron manda o segredo nesse último formato);
 *   - OU sessão admin válida (dispara manual pelo painel).
 * Enquanto CRON_SECRET não estiver configurado a proteção fica desligada: o
 * agendador vive fora deste repositório e travar antes dele saber o segredo
 * pararia a sincronização em silêncio. Definir CRON_SECRET liga a trava.
 */
async function requireCronOrAdmin(req, res, next) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    if (!warnedCronSecret) {
      warnedCronSecret = true;
      console.warn("[cron] CRON_SECRET não configurado — endpoints /api/cron/* seguem abertos.");
    }
    return next();
  }
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const provided = String(
    req.headers["x-cron-secret"] || req.query.cronSecret || bearer || ""
  ).trim();
  if (secret && provided && provided === secret) {
    req.cronAuth = "secret";
    return next();
  }
  if (ADMIN_EMAILS.size) {
    try {
      const user = await getAdminUser(extractAdminToken(req));
      if (user) {
        req.adminUser = user;
        req.cronAuth = "admin";
        return next();
      }
    } catch (_) {}
  }
  return res.status(401).json({
    error: "Cron protegido. Envie x-cron-secret ou faça login como admin.",
    code: "CRON_AUTH",
  });
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || "desconhecido";
}

/**
 * Rate limit por IP, em memória. Endpoints como /api/shortlink precisam ficar
 * abertos (a vitrine chama sem sessão, no clique de compra), mas gastam quota
 * Shopee. Em serverless o contador vive por instância quente, então isso corta
 * abuso — não é uma cota global exata.
 */
function rateLimitByIp({ max = 30, windowMs = 60000 } = {}) {
  const hits = new Map();
  let lastPrune = Date.now();
  return function (req, res, next) {
    const now = Date.now();
    if (now - lastPrune > windowMs) {
      for (const [key, val] of hits) if (val.resetAt <= now) hits.delete(key);
      lastPrune = now;
    }
    const ip = clientIp(req);
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Muitas requisições. Tente de novo em instantes.",
        code: "RATE_LIMITED",
        retryAfter,
      });
    }
    return next();
  };
}

const shortlinkRateLimit = rateLimitByIp({
  max: Math.min(Math.max(Number(process.env.SHORTLINK_RATE_MAX) || 30, 1), 600),
  windowMs: 60000,
});

app.post("/api/admin/login", async (req, res) => {
  const email = String(req.body?.email || req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  if (!email || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha.", code: "ADMIN_AUTH" });
  }
  if (!adminEmailAllowed(email)) {
    return res.status(401).json({ error: "E-mail sem acesso ao painel.", code: "ADMIN_AUTH" });
  }
  try {
    const session = await supabaseAuth("/token?grant_type=password", {
      body: { email, password },
    });
    if (!adminEmailAllowed(session?.user?.email)) {
      return res.status(401).json({ error: "E-mail sem acesso ao painel.", code: "ADMIN_AUTH" });
    }
    return res.json({
      ok: true,
      token: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: session.user?.email,
    });
  } catch (err) {
    return res.status(err.status === 400 ? 401 : (err.status || 500)).json({
      error: err.status === 400 ? "E-mail ou senha incorretos." : err.message,
      code: "ADMIN_AUTH",
    });
  }
});

app.post("/api/admin/refresh", async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "").trim();
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token ausente.", code: "ADMIN_AUTH" });
  }
  try {
    const session = await supabaseAuth("/token?grant_type=refresh_token", {
      body: { refresh_token: refreshToken },
    });
    if (!adminEmailAllowed(session?.user?.email)) {
      return res.status(401).json({ error: "E-mail sem acesso ao painel.", code: "ADMIN_AUTH" });
    }
    return res.json({
      ok: true,
      token: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: session.user?.email,
    });
  } catch (err) {
    return res.status(401).json({ error: "Sessão expirada. Entre novamente.", code: "ADMIN_AUTH" });
  }
});

app.get("/api/admin/me", async (req, res) => {
  try {
    const user = await getAdminUser(extractAdminToken(req));
    if (user) return res.json({ ok: true, user: user.email, authRequired: true });
  } catch (_) {
    // A resposta abaixo mantém os detalhes da autenticação fora do cliente.
  }
  return res.status(401).json({ ok: false, authRequired: true, code: "ADMIN_AUTH" });
});

app.post("/api/admin/logout", async (req, res) => {
  const token = extractAdminToken(req);
  adminAuthCache.delete(token);
  if (token) {
    await supabaseAuth("/logout", { accessToken: token }).catch(() => {});
  }
  res.json({ ok: true });
});

// Cache do HTML transformado em memória. O HTML é carregado uma vez, e as
// referências a JS/CSS versionadas ganham ?v=<mtime> — assim podemos servir
// esses assets como public,max-age=1y,immutable sem quebrar deploys (uma nova
// versão gera uma URL nova). Se o HTML muda no disco (dev), recarregamos.
const VITRINE_ASSET_FILES = [
  { rel: "/uploads/tailwind.css", abs: path.join(ROOT, "uploads", "tailwind.css") },
  { rel: "/uploads/fa-solid.min.css", abs: path.join(ROOT, "uploads", "fa-solid.min.css") },
  { rel: "/uploads/storefront.min.js", abs: path.join(ROOT, "uploads", "storefront.min.js") },
];
const ADMIN_JS_ABS = path.join(ROOT, "uploads", "admin.min.js");
let vitrineHtmlCache = null;
let vitrineHtmlCacheKey = "";

function assetVersion(absPath) {
  try {
    return Math.floor(fs.statSync(absPath).mtimeMs).toString(36);
  } catch (_) {
    return "0";
  }
}

function buildVitrineHtml() {
  const htmlStat = fs.statSync(VITRINE_HTML);
  const adminV = assetVersion(ADMIN_JS_ABS);
  const assetKey = VITRINE_ASSET_FILES.map(({ abs }) => assetVersion(abs)).join("|") + "|" + adminV;
  const cacheKey = `${htmlStat.mtimeMs}|${assetKey}`;
  if (vitrineHtmlCache && vitrineHtmlCacheKey === cacheKey) return vitrineHtmlCache;
  let html = fs.readFileSync(VITRINE_HTML, "utf8");
  for (const { rel, abs } of VITRINE_ASSET_FILES) {
    const v = assetVersion(abs);
    // Anexa ?v= a qualquer referência sem query-string (não toca as que já tenham).
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(["'])(${escaped})(?!\\?)([\\s"'#])`, "g");
    html = html.replace(re, `$1$2?v=${v}$3`);
  }
  // admin.min.js é carregado dinamicamente — injeta URL versionada pra furar cache immutable.
  html = html.replace(
    /<\/head>/i,
    `<script>window.__AM_ADMIN_JS="/uploads/admin.min.js?v=${adminV}";</script>\n</head>`
  );
  vitrineHtmlCache = html;
  vitrineHtmlCacheKey = cacheKey;
  return html;
}

function sendVitrine(_req, res) {
  // HTML muda com deploys: cache curto no browser, um pouco maior na CDN/edge.
  res.set(
    "Cache-Control",
    "public, max-age=30, s-maxage=120, stale-while-revalidate=600"
  );
  try {
    res.type("html").send(buildVitrineHtml());
  } catch (err) {
    // Fallback ao envio direto do arquivo se algo der errado (nunca deve acontecer).
    res.sendFile(VITRINE_HTML);
  }
}

// Cache leve em memória para campanhas (reduz hits Shopee/Vercel)
let campaignsCache = { at: 0, data: null };
const CAMPAIGNS_TTL_MS = 30 * 60 * 1000;

// Cache em memória para categorias (contagens Supabase) — reduz drasticamente
// o tempo de resposta ao abrir o app e ao trocar categoria no mobile.
let categoriasCache = { at: 0, data: null };
const CATEGORIAS_TTL_MS = 5 * 60 * 1000;

// Cache pequeno para /api/ofertas/db, indexado pela query string.
// Alivia Supabase quando o usuário toca a mesma categoria repetidas vezes.
const ofertasCache = new Map();
const OFERTAS_TTL_MS = 150 * 1000;
const OFERTAS_CACHE_MAX = 40;

function isTrackedAffiliateUrl(url) {
  const u = String(url || "").trim();
  if (!u || u === "#") return false;
  if (/shope\.ee\//i.test(u) || /\bs\.shopee\./i.test(u)) return true;
  if (/universal-link|an_redir|uls_trackid|affiliate/i.test(u)) return true;
  return false;
}

/**
 * Garante offer_link de afiliado no banco. Sem isso o /p/:id e a campanha
 * mandam o visitante pra Shopee sem comissão.
 */
async function ensureAffiliateOffer(itemId) {
  const id = Number(itemId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const existing = await getOffersByItemIds([id], { full: true });
  let row = Array.isArray(existing) && existing.length ? existing[0] : null;
  if (row && isTrackedAffiliateUrl(row.offer_link)) return row;

  const nodes = await fetchProductDetailsByIds([id]);
  const node = Array.isArray(nodes) && nodes.length ? nodes[0] : null;
  if (!node || !node.offerLink) return row;

  const keyword = String(node.productName || "").trim().toLowerCase().slice(0, 80);
  const fresh = mapOfferToRow(node, keyword, null);
  if (!fresh.item_id || !fresh.offer_link) return row;
  if (row) {
    fresh.category = row.category || fresh.category;
    fresh.subcategory = row.subcategory || fresh.subcategory;
    if (row.short_link) fresh.short_link = row.short_link;
  }
  await saveOffersWithShortlinks([fresh], { withShortlinks: true, skipExisting: false, gapMs: 100 });
  categoriasCache = { at: 0, data: null };
  ofertasCache.clear();
  const saved = await getOffersByItemIds([id], { full: true });
  return Array.isArray(saved) && saved.length ? saved[0] : fresh;
}

function setCacheHeaders(res, { maxAge = 60, sMaxAge = 300, swr = 600 } = {}) {
  res.set(
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
  );
}

app.get("/api/health", (_req, res) => {
  const hasShopee = !!(process.env.SHOPEE_APP_ID && process.env.SHOPEE_SECRET);
  let supabaseOk = false;
  try {
    getConfig();
    supabaseOk = !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
  } catch {
    supabaseOk = false;
  }
  res.json({
    ok: true,
    shopeeConfigured: hasShopee,
    supabaseConfigured: supabaseOk,
    time: new Date().toISOString(),
  });
});

/**
 * Busca ao vivo na Shopee (productOfferV2).
 * Query: keyword, limit, page, listType, sortType, sync=1,
 *        minRating, minSales, requireCommission
 */
app.get("/api/ofertas", async (req, res) => {
  try {
    const keyword = String(req.query.keyword || "oferta").trim();
    const limit = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;
    const listType = req.query.listType != null ? Number(req.query.listType) : 0;
    const sortType = req.query.sortType != null ? Number(req.query.sortType) : 2;
    const sync = req.query.sync === "1" || req.query.sync === "true";
    const minRating = req.query.minRating != null ? Number(req.query.minRating) : MIN_RATING;
    const minSales = req.query.minSales != null ? Number(req.query.minSales) : 0;
    const requireCommission = req.query.requireCommission === "1" || req.query.requireCommission === "true";
    const minCommissionPct = req.query.minCommissionPct != null ? Number(req.query.minCommissionPct) : 0;
    const matchId = req.query.matchId != null ? Number(req.query.matchId) : null;
    const shopId = req.query.shopId != null ? Number(req.query.shopId) : null;

    const offer = await fetchProductOffers({
      keyword,
      limit,
      page,
      listType,
      sortType,
      matchId,
      shopId,
      minRating,
      minSales,
      requireCommission,
      minCommissionPct,
    });
    const nodes = offer.nodes || [];
    const products = nodes.map((n) => mapOfferToProduct(n, keyword, offer.listType));

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (sync && nodes.length) {
      const rows = nodes.map((n) => mapOfferToRow(n, keyword, offer.listType)).filter((r) => r.item_id && r.offer_link);
      const out = await saveOffersWithShortlinks(rows);
      saved = out.saved;
      skippedExisting = out.skippedExisting || 0;
      shortlinks = out.shortlinks;
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }

    res.json({
      source: "shopee",
      keyword,
      listType: offer.listType,
      sortType: offer.sortType,
      listTypeLabel: offer.listTypeLabel || listTypeLabel(offer.listType),
      sortTypeLabel: offer.sortTypeLabel || sortTypeLabel(offer.sortType),
      count: products.length,
      rawCount: offer.rawCount ?? products.length,
      filteredOut: offer.filteredOut || 0,
      saved,
      skippedExisting,
      shortlinks,
      hasNextPage: !!offer.hasNextPage,
      pageInfo: offer.pageInfo || {},
      filters: offer.filters || { minRating, minSales, requireCommission },
      products,
    });
  } catch (err) {
    console.error("[/api/ofertas]", err.message);
    const status = err.status || 500;
    const rateLimited = status === 429 || /rate|limit|too many/i.test(err.message || "");
    res.status(status).json({
      error: err.message,
      code: err.code || (rateLimited ? "RATE_LIMITED" : null),
      rateLimited,
      details: err.payload || null,
    });
  }
});

/**
 * Busca em lote: várias keywords × várias páginas.
 * Body: { keywords: string[]|string, pages?, pageStart?, limit?, listType?, sortType?,
 *         minRating?, minSales?, requireCommission?, sync?, gapMs? }
 */
app.post("/api/ofertas/batch", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const keywordsRaw = body.keywords ?? body.keyword ?? "";
    const keywords = Array.isArray(keywordsRaw)
      ? keywordsRaw
      : String(keywordsRaw).split(/[\n,;]+/);
    const pages = Math.min(Math.max(Number(body.pages) || 3, 1), 20);
    const pageStart = Math.max(Number(body.pageStart) || 1, 1);
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 50);
    const listType = body.listType != null ? Number(body.listType) : 0;
    const sortType = body.sortType != null ? Number(body.sortType) : 2;
    const minRating = body.minRating != null ? Number(body.minRating) : MIN_RATING;
    const minSales = body.minSales != null ? Number(body.minSales) : 0;
    const requireCommission = !!body.requireCommission;
    const minCommissionPct = body.minCommissionPct != null ? Number(body.minCommissionPct) : 0;
    const matchId = body.matchId != null ? Number(body.matchId) : null;
    const shopId = body.shopId != null ? Number(body.shopId) : null;
    const productCatId = body.productCatId != null ? Number(body.productCatId) : null;
    const isAMSOffer = body.isAMSOffer === true || body.isAMSOffer === "1" || body.isAMSOffer === 1;
    const isKeySeller = body.isKeySeller === true || body.isKeySeller === "1" || body.isKeySeller === 1;
    const sync = body.sync === true || body.sync === 1 || body.sync === "1";
    const gapMs = body.gapMs != null ? Number(body.gapMs) : DEFAULT_BATCH_GAP_MS;
    const concurrency = body.concurrency != null ? Number(body.concurrency) : undefined;

    const cleaned = keywords.map((k) => String(k || "").trim()).filter(Boolean);
    const hasMatch = Number.isFinite(matchId) && matchId > 0;
    const hasShop = Number.isFinite(shopId) && shopId > 0;
    const hasCat = Number.isFinite(productCatId) && productCatId > 0;
    if (!cleaned.length && !hasMatch && !hasShop && !hasCat) {
      return res.status(400).json({
        error: "Informe palavras-chave, categoria Shopee, coleção ou loja",
        code: "NO_KEYWORDS",
      });
    }

    const batch = await fetchProductOffersBatch({
      keywords: cleaned,
      pages,
      pageStart,
      limit,
      listType,
      sortType,
      matchId: hasMatch ? matchId : null,
      shopId: hasShop ? shopId : null,
      productCatId: Number.isFinite(productCatId) && productCatId > 0 ? productCatId : null,
      isAMSOffer: isAMSOffer ? true : null,
      isKeySeller: isKeySeller ? true : null,
      minRating,
      minSales,
      requireCommission,
      minCommissionPct,
      gapMs,
      concurrency,
    });

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (sync && batch.nodes?.length) {
      const kwById = new Map(batch.products.map((p) => [String(p.itemId || p.id), p.keyword || ""]));
      const rows = batch.nodes
        .map((n) => mapOfferToRow(n, kwById.get(String(n.itemId)) || cleaned[0], batch.listType))
        .filter((r) => r.item_id && r.offer_link);
      const out = await saveOffersWithShortlinks(rows);
      saved = out.saved;
      skippedExisting = out.skippedExisting || 0;
      shortlinks = out.shortlinks;
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }

    let products = Array.isArray(batch.products) ? batch.products : [];
    const previewIds = products
      .map((p) => Number(p.itemId ?? p.id))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    if (previewIds.length) {
      const existingRows = await getOffersByItemIds(previewIds, { full: false });
      const existing = new Set((existingRows || []).map((r) => String(r.item_id)));
      const fresh = [];
      let hidden = 0;
      for (const p of products) {
        const id = String(p.itemId ?? p.id ?? "");
        if (id && existing.has(id)) hidden += 1;
        else fresh.push(p);
      }
      products = fresh;
      if (!sync) skippedExisting = hidden;
      else if (!skippedExisting) skippedExisting = hidden;
    }

    const failures = (batch.report || []).filter((r) => !r.ok);
    const rateLimited = failures.some((r) => r.status === 429 || /rate|limit|too many/i.test(r.error || ""));

    res.json({
      ok: true,
      source: "shopee",
      keywords: batch.keywords,
      pages: batch.pages,
      listType: batch.listType,
      sortType: batch.sortType,
      listTypeLabel: batch.listTypeLabel,
      sortTypeLabel: batch.sortTypeLabel,
      count: products.length,
      found: batch.count,
      filteredOut: batch.filteredOut,
      hasNextPage: batch.hasNextPage,
      nextPageStart: batch.nextPageStart,
      saved,
      skippedExisting,
      shortlinks,
      rateLimited,
      empty: products.length === 0,
      report: batch.report,
      products,
    });
  } catch (err) {
    console.error("[/api/ofertas/batch]", err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || null,
      rateLimited: status === 429,
      details: err.payload || null,
    });
  }
});

/**
 * Salva produtos já pré-visualizados (Explorador) ou nodes crus da Shopee.
 * Body: { products: [...] } e/ou { nodes: [...], keyword?, listType? }
 * Classifica category/subcategory via resolveTaxonomy (mapa da vitrine).
 */
app.post("/api/ofertas/save-bulk", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const products = Array.isArray(body.products) ? body.products : [];
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const defaultKeyword = String(body.keyword || "").trim();
    const defaultListType = body.listType != null ? Number(body.listType) : null;

    if (!products.length && !nodes.length) {
      return res.status(400).json({ error: "Nenhum produto para salvar", code: "NO_PRODUCTS" });
    }

    const byId = new Map();

    for (const n of nodes) {
      const itemId = Number(n.itemId ?? n.item_id);
      if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
      if (byId.has(String(itemId))) continue;
      const kw = n.keyword || defaultKeyword || "oferta";
      const lt = n.listType != null ? Number(n.listType) : defaultListType;
      const row = mapOfferToRow(n, kw, lt);
      if (row.item_id && row.offer_link) byId.set(String(itemId), row);
    }

    for (const p of products) {
      const itemId = Number(p.itemId ?? p.item_id ?? p.id);
      if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
      const offerLink = p.affiliateLink || p.offer_link || p.offerLink || p.productLink || "";
      if (!offerLink) continue;
      if (byId.has(String(itemId))) continue;

      const node = {
        itemId,
        productName: p.title || p.productName || p.product_name || "",
        imageUrl: p.image || p.imageUrl || p.image_url || "",
        priceMin: p.newPrice ?? p.price_min ?? p.priceMin,
        priceMax: p.oldPrice ?? p.price_max ?? p.priceMax,
        priceDiscountRate: p.discountPct ?? p.price_discount_rate,
        sales: p.salesRaw || p.sales || null,
        ratingStar: p.stars ?? p.rating_star ?? p.ratingStar,
        commissionRate: p.commissionRate || p.commission_rate,
        sellerCommissionRate: p.sellerCommission || p.seller_commission_rate,
        shopeeCommissionRate: p.shopeeCommission || p.shopee_commission_rate,
        commission: p.totalCommission || p.commission,
        offerLink,
        productLink: p.productLink || p.product_link || "",
        shopId: p.shopId || p.shop_id,
        shopName: p.shopName || p.shop_name || "",
        shopType: p.shopType || p.shop_type,
        periodStartTime: p.periodStart || p.period_start,
        periodEndTime: p.periodEnd || p.period_end,
      };
      const keyword = p.keyword || defaultKeyword || "";
      const listType = p.listType != null ? Number(p.listType) : defaultListType;
      // Se já veio classificado pelo explorador/batch, respeita; senão resolve pelo título+keyword
      const forceCategory = p.category && p.category !== "todos" ? p.category : null;
      const forceSubcategory = p.subcategory || null;
      byId.set(String(itemId), mapOfferToRow(node, keyword, listType, {
        forceCategory,
        forceSubcategory: forceCategory ? forceSubcategory : null,
      }));
    }

    const rows = [...byId.values()].filter((r) => r.item_id && r.offer_link);
    if (!rows.length) {
      return res.status(400).json({ error: "Nenhum produto válido (itemId + offerLink)", code: "INVALID_PRODUCTS" });
    }

    const withShortlinks = body.withShortlinks !== false;
    const out = await saveOffersWithShortlinks(rows, { withShortlinks });
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();

    res.json({
      ok: true,
      requested: products.length + nodes.length,
      unique: rows.length,
      saved: out.saved,
      skippedExisting: out.skippedExisting || 0,
      count: out.saved,
      shortlinks: out.shortlinks,
    });
  } catch (err) {
    console.error("[/api/ofertas/save-bulk]", err.message);
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code || null,
      details: err.payload || null,
    });
  }
});

/** Metadados de listType/sortType para o painel. */
app.get("/api/ofertas/meta", (_req, res) => {
  res.json({
    listTypes: Object.entries(LIST_TYPE_LABELS).map(([value, label]) => ({
      value: Number(value),
      label,
    })),
    sortTypes: Object.entries(SORT_TYPE_LABELS).map(([value, label]) => ({
      value: Number(value),
      label,
    })),
    defaults: {
      listType: 0,
      sortType: 2,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
      gapMs: DEFAULT_BATCH_GAP_MS,
    },
  });
});

/**
 * Lê ofertas do Supabase.
 * Query: keyword, category, limit, offset, sort=money|recent|sales|discount|rating|ending
 */
app.get("/api/ofertas/db", async (req, res) => {
  try {
    const keyword = String(req.query.keyword || "").trim();
    const category = String(req.query.category || "").trim();
    const subcategory = String(req.query.subcategory || "").trim();
    const itemId = String(req.query.itemId || req.query.produto || "").trim();
    const itemIdsRaw = String(req.query.itemIds || req.query.produtos || "").trim();
    const limit = Number(req.query.limit) || 60;
    const offset = Number(req.query.offset) || 0;
    // Home / catálogo geral: moneyScore. Categorias específicas mantêm recent se não pedirem sort.
    const sortRaw = String(req.query.sort || "").trim();
    const sort = sortRaw || (!category || category === "todos" ? "money" : "recent");

    const multiIds = itemIdsRaw
      ? itemIdsRaw.split(/[,|]+/).map((s) => s.trim()).filter(Boolean)
      : (itemId ? [itemId] : []);

    if (multiIds.length) {
      const rows = await getOffersByItemIds(multiIds, { full: true });
      const list = Array.isArray(rows) ? rows : [];
      setCacheHeaders(res, { maxAge: 30, sMaxAge: 60, swr: 300 });
      return res.json({
        source: "supabase",
        count: list.length,
        offset: 0,
        limit: list.length,
        sort,
        products: list.map(rowToProduct),
      });
    }

    const cacheKey = `${keyword}|${category}|${subcategory}|${limit}|${offset}|${sort}`;
    const cached = ofertasCache.get(cacheKey);
    if (cached && Date.now() - cached.at < OFERTAS_TTL_MS) {
      setCacheHeaders(res, { maxAge: 45, sMaxAge: 120, swr: 600 });
      return res.json({ ...cached.data, cached: true });
    }

    const rows = await listOfertas({ keyword, category, subcategory, limit, offset, sort });
    const list = Array.isArray(rows) ? rows : [];
    const payload = {
      source: "supabase",
      count: list.length,
      offset,
      limit,
      sort,
      products: list.map(rowToProduct),
    };

    ofertasCache.set(cacheKey, { at: Date.now(), data: payload });
    if (ofertasCache.size > OFERTAS_CACHE_MAX) {
      const oldestKey = ofertasCache.keys().next().value;
      ofertasCache.delete(oldestKey);
    }

    setCacheHeaders(res, { maxAge: 45, sMaxAge: 120, swr: 600 });
    res.json(payload);
  } catch (err) {
    console.error("[/api/ofertas/db]", err.message);
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code || null,
      details: err.payload || null,
    });
  }
});

/**
 * Campanhas oficiais Shopee (shopeeOfferV2) com cache em memória.
 */
app.get("/api/campanhas", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    if (!force && campaignsCache.data && Date.now() - campaignsCache.at < CAMPAIGNS_TTL_MS) {
      setCacheHeaders(res, { maxAge: 300, sMaxAge: 900, swr: 1800 });
      return res.json({ ...campaignsCache.data, cached: true });
    }
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const offer = await fetchShopeeOffers({ sortType: 1, page: 1, limit: Math.max(limit, 20) });
    const FEMALE_OFFER_RE = /women|woman|fashion|beauty|moda|beleza|feminin|accessories|saúde|saude|health|vestuario|roupa/i;
    let campaigns = (offer.nodes || [])
      .map(mapCampaignNode)
      .filter((c) => c.affiliateLink && c.affiliateLink !== "#" && c.isActive);
    campaigns.sort((a, b) => {
      const af = FEMALE_OFFER_RE.test(a.title || "") ? 1 : 0;
      const bf = FEMALE_OFFER_RE.test(b.title || "") ? 1 : 0;
      return bf - af;
    });
    // Prioriza moda/beleza no topo; mantém as demais depois
    const femaleFirst = campaigns.filter((c) => FEMALE_OFFER_RE.test(c.title || ""));
    const rest = campaigns.filter((c) => !FEMALE_OFFER_RE.test(c.title || ""));
    campaigns = [...femaleFirst, ...rest].slice(0, limit);
    const payload = {
      source: "shopee",
      count: campaigns.length,
      femaleFocused: femaleFirst.length,
      updatedAt: new Date().toISOString(),
      campaigns,
    };
    campaignsCache = { at: Date.now(), data: payload };
    setCacheHeaders(res, { maxAge: 300, sMaxAge: 900, swr: 1800 });
    res.json({ ...payload, cached: false });
  } catch (err) {
    console.error("[/api/campanhas]", err.message);
    // fallback cache antigo se existir
    if (campaignsCache.data) {
      return res.json({ ...campaignsCache.data, cached: true, stale: true, error: err.message });
    }
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

/** Importa itens de coleção/categoria oficial (listType 6 ou 4 + matchId). */
app.post("/api/campanhas/import-products", requireAdmin, async (req, res) => {
  try {
    const collectionId = req.body?.collectionId != null ? Number(req.body.collectionId) : null;
    const categoryId = req.body?.categoryId != null ? Number(req.body.categoryId) : null;
    const limit = Math.min(Math.max(Number(req.body?.limit) || 30, 5), 50);
    const keyword = String(req.body?.keyword || "oficial").trim();
    const forceCategory = String(req.body?.forceCategory || "").trim() || null;

    let listType = 0;
    let matchId = null;
    if (collectionId && Number.isFinite(collectionId) && collectionId > 0) {
      listType = 6;
      matchId = collectionId;
    } else if (categoryId && Number.isFinite(categoryId) && categoryId > 0) {
      listType = 4;
      matchId = categoryId;
    } else {
      return res.status(400).json({ error: "Informe collectionId ou categoryId" });
    }

    const offer = await fetchProductOffers({
      listType,
      matchId,
      limit,
      page: 1,
      sortType: 5,
      requireCommission: true,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
    });

    const rows = (offer.nodes || [])
      .map((n) =>
        mapOfferToRow(n, keyword, listType, {
          forceCategory: forceCategory || undefined,
        })
      )
      .filter((r) => r.item_id && r.offer_link);

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (rows.length) {
      const out = await saveOffersWithShortlinks(rows);
      saved = out.saved;
      skippedExisting = out.skippedExisting || 0;
      shortlinks = out.shortlinks;
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }

    res.json({
      ok: true,
      listType,
      matchId,
      raw: offer.rawCount,
      saved,
      skippedExisting,
      shortlinks,
    });
  } catch (err) {
    console.error("[/api/campanhas/import-products]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

app.get("/api/categorias", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    if (!force && categoriasCache.data && Date.now() - categoriasCache.at < CATEGORIAS_TTL_MS) {
      setCacheHeaders(res, { maxAge: 120, sMaxAge: 300, swr: 900 });
      return res.json({ ...categoriasCache.data, cached: true });
    }

    let counts = {};
    try {
      counts = await countByCategory();
    } catch (e) {
      console.warn("[/api/categorias] Supabase indisponível:", e.message);
    }

    // Contagem por subcategoria usa só HEAD queries (leves) em paralelo.
    // Evita baixar 200 rows por categoria só para contar — economiza ~90% do tempo.
    const metas = metaOnly();
    const subCountsList = await Promise.all(
      metas.map((c) => countBySubcategory(c.id).catch(() => ({})))
    );

    const categories = sortCategoriesForHome(
      metas.map((c, idx) => ({
        ...c,
        count: counts[c.id] || 0,
        subcategories: (c.subcategories || []).map((sub) => ({
          ...sub,
          count: subCountsList[idx][sub.id] || 0,
        })),
      }))
    );

    categories.unshift({
      id: "todos",
      label: "Tudo",
      icon: "fa-border-all",
      color: "orange",
      count: counts.total || 0,
      subcategories: [],
    });

    const payload = { categories, updatedAt: new Date().toISOString() };
    categoriasCache = { at: Date.now(), data: payload };
    setCacheHeaders(res, { maxAge: 120, sMaxAge: 300, swr: 900 });
    res.json({ ...payload, cached: false });
  } catch (err) {
    if (categoriasCache.data) {
      return res.json({ ...categoriasCache.data, cached: true, stale: true, error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sync", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 5), 50);
    const listType = req.body?.listType != null ? Number(req.body.listType) : 1;
    const sortType = req.body?.sortType != null ? Number(req.body.sortType) : 5;
    const minRating = req.body?.minRating != null ? Number(req.body.minRating) : MIN_RATING;
    const minSales = req.body?.minSales != null ? Number(req.body.minSales) : MIN_SALES;
    const requireCommission = req.body?.requireCommission !== false;
    const pages = Math.min(Math.max(Number(req.body?.pages) || 1, 1), 5);
    let plano;

    if (Array.isArray(req.body?.keywords) && req.body.keywords.length) {
      plano = req.body.keywords.map((k) => ({ keyword: String(k), category: null }));
    } else if (req.body?.category) {
      const target = String(req.body.category).trim();
      const cat = CATEGORIAS.find((c) => c.id === target);
      plano = (cat?.subcategories || []).flatMap((sub) =>
        (sub.keywords || []).map((raw) => {
          const { keyword } = normalizeKeywordEntry(raw);
          return { keyword, category: cat.id, subcategory: sub.id };
        })
      );
    } else {
      // Lote ~95% feminino / 5% geral (até 40 buscas).
      plano = weightedKeywords({ femalePercent: DEFAULT_FEMALE_PERCENT }).slice(0, 40);
    }

    if (!plano.length) {
      return res.status(400).json({ error: "Nenhuma keyword para sincronizar" });
    }

    const keywords = plano.map((p) => p.keyword);
    const batch = await fetchProductOffersBatch({
      keywords,
      pages,
      pageStart: 1,
      limit,
      listType,
      sortType,
      minRating,
      minSales,
      requireCommission,
      gapMs: DEFAULT_BATCH_GAP_MS,
    });

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (batch.nodes?.length) {
      const planoByKw = new Map(
        plano.map((p) => [String(p.keyword).toLowerCase().trim(), p])
      );
      const kwById = new Map(batch.products.map((p) => [String(p.itemId || p.id), p.keyword || ""]));
      const rows = batch.nodes
        .map((n) => {
          const kw = kwById.get(String(n.itemId)) || keywords[0];
          const plan = planoByKw.get(String(kw).toLowerCase().trim());
          return mapOfferToRow(n, kw, batch.listType, {
            forceCategory: plan?.category || null,
            forceSubcategory: plan?.subcategory || null,
          });
        })
        .filter((r) => r.item_id && r.offer_link);
      if (rows.length) {
        const out = await saveOffersWithShortlinks(rows);
        saved = out.saved;
        skippedExisting = out.skippedExisting || 0;
        shortlinks = out.shortlinks;
      }
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }

    res.json({
      ok: true,
      femalePercentTarget: DEFAULT_FEMALE_PERCENT,
      keywordsRun: keywords.length,
      pages,
      listType: batch.listType,
      sortType: batch.sortType,
      listTypeLabel: batch.listTypeLabel,
      sortTypeLabel: batch.sortTypeLabel,
      filteredOut: batch.filteredOut,
      hasNextPage: batch.hasNextPage,
      saved,
      skippedExisting,
      shortlinks,
      report: batch.report,
      count: batch.count,
      products: batch.products,
    });
  } catch (err) {
    console.error("[/api/sync]", err.message);
    res.status(500).json({ error: err.message, details: err.payload || null });
  }
});

app.get("/api/sync/categoria/:id", requireAdmin, async (req, res) => {
  try {
    const catId = String(req.params.id || "").trim();
    const cat = CATEGORIAS.find((c) => c.id === catId);
    if (!cat) return res.status(404).json({ error: `Categoria desconhecida: ${catId}` });
    const keywords = [];
    const subByKeyword = new Map();
    for (const sub of cat.subcategories || []) {
      for (const raw of sub.keywords || []) {
        const { keyword } = normalizeKeywordEntry(raw);
        if (!keyword) continue;
        keywords.push(keyword);
        subByKeyword.set(keyword.toLowerCase().trim(), sub.id);
      }
    }
    const listType = req.query.listType != null ? Number(req.query.listType) : 1;
    const sortType = req.query.sortType != null ? Number(req.query.sortType) : 5;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 5), 50);
    const pages = Math.min(Math.max(Number(req.query.pages) || 1, 1), 5);
    const minRating = req.query.minRating != null ? Number(req.query.minRating) : MIN_RATING;
    const minSales = req.query.minSales != null ? Number(req.query.minSales) : MIN_SALES;
    const requireCommission =
      req.query.requireCommission == null
        ? true
        : req.query.requireCommission === "1" || req.query.requireCommission === "true";

    if (!keywords.length) {
      return res.status(400).json({ error: "Categoria sem keywords" });
    }

    const batch = await fetchProductOffersBatch({
      keywords,
      pages,
      pageStart: 1,
      limit,
      listType,
      sortType,
      minRating,
      minSales,
      requireCommission,
      gapMs: DEFAULT_BATCH_GAP_MS,
    });

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (batch.nodes?.length) {
      const kwById = new Map(batch.products.map((p) => [String(p.itemId || p.id), p.keyword || ""]));
      const rows = batch.nodes
        .map((n) => {
          const kw = kwById.get(String(n.itemId)) || keywords[0];
          const forceSub = subByKeyword.get(String(kw).toLowerCase().trim()) || null;
          return mapOfferToRow(n, kw, batch.listType, {
            forceCategory: cat.id,
            forceSubcategory: forceSub,
          });
        })
        .filter((r) => r.item_id && r.offer_link);
      if (rows.length) {
        const out = await saveOffersWithShortlinks(rows);
        saved = out.saved;
        skippedExisting = out.skippedExisting || 0;
        shortlinks = out.shortlinks;
      }
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }

    res.json({
      ok: true,
      category: cat.id,
      keywordsRun: keywords.length,
      pages,
      listType: batch.listType,
      sortType: batch.sortType,
      listTypeLabel: batch.listTypeLabel,
      sortTypeLabel: batch.sortTypeLabel,
      filteredOut: batch.filteredOut,
      hasNextPage: batch.hasNextPage,
      saved,
      skippedExisting,
      shortlinks,
      count: batch.count,
      report: batch.report,
      products: batch.products,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let coverageCache = { at: 0, data: null };
const COVERAGE_TTL_MS = 60 * 1000;

/** Snapshot de cobertura (leitura) — sem token, como /api/status/shortlinks. */
app.get("/api/coverage", async (_req, res) => {
  try {
    if (coverageCache.data && Date.now() - coverageCache.at < COVERAGE_TTL_MS) {
      return res.json({ ...coverageCache.data, cached: true });
    }
    const report = await buildCoverageReport();
    coverageCache = { at: Date.now(), data: report };
    res.json({ ...report, cached: false });
  } catch (err) {
    console.error("[/api/coverage]", err.message);
    if (coverageCache.data) {
      return res.json({ ...coverageCache.data, cached: true, stale: true, error: err.message });
    }
    res.status(err.status || 500).json({ error: err.message || "Falha ao calcular cobertura" });
  }
});

app.post("/api/sync/coverage", requireAdmin, async (req, res) => {
  try {
    const batchSize = Math.min(Math.max(Number(req.body?.batch) || 12, 1), 40);
    const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 5), 50);
    const pages = Math.min(Math.max(Number(req.body?.pages) || 1, 1), 3);
    const onlyCategory = req.body?.category ? String(req.body.category).trim() : "";
    const rotation = [
      { listType: 1, sortType: 5 },
      { listType: 2, sortType: 2 },
    ];
    const modeIdx = Number(req.body?.mode) || 0;
    const mode = rotation[modeIdx % rotation.length];
    const listType = req.body?.listType != null ? Number(req.body.listType) : mode.listType;
    const sortType = req.body?.sortType != null ? Number(req.body.sortType) : mode.sortType;

    const { queue, report } = await buildCoverageQueue({ femalePercent: DEFAULT_FEMALE_PERCENT });
    let jobs = onlyCategory ? queue.filter((j) => j.category === onlyCategory) : queue;
    jobs = jobs.slice(0, batchSize);

    if (!jobs.length) {
      return res.json({
        ok: true,
        saved: 0,
        processed: [],
        shortlinks: { generated: 0 },
        message: "Nenhum buraco na cobertura — fila vazia.",
        coverage: report,
      });
    }

    const keywords = jobs.map((j) => j.keyword);
    const batch = await fetchProductOffersBatch({
      keywords,
      pages,
      pageStart: 1,
      limit,
      listType,
      sortType,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
      requireCommission: true,
      minCommissionPct: DEFAULT_MIN_COMMISSION_PCT,
      gapMs: DEFAULT_BATCH_GAP_MS,
    });

    const planByKw = new Map(jobs.map((j) => [String(j.keyword).toLowerCase().trim(), j]));
    const kwById = new Map(
      (batch.products || []).map((p) => [String(p.itemId || p.id), p.keyword || ""])
    );

    let saved = 0;
    let skippedExisting = 0;
    let shortlinks = { generated: 0, failed: 0, skipped: 0 };
    if (batch.nodes?.length) {
      const rows = batch.nodes
        .map((n) => {
          const kw = kwById.get(String(n.itemId)) || keywords[0];
          const plan = planByKw.get(String(kw).toLowerCase().trim());
          return mapOfferToRow(n, kw, batch.listType, {
            forceCategory: plan?.category || null,
            forceSubcategory: plan?.subcategory || null,
          });
        })
        .filter((r) => r.item_id && r.offer_link);
      if (rows.length) {
        const out = await saveOffersWithShortlinks(rows);
        saved = out.saved;
        skippedExisting = out.skippedExisting || 0;
        shortlinks = out.shortlinks;
      }
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
      coverageCache = { at: 0, data: null };
    }

    const coverageAfter = await buildCoverageReport().catch(() => report);
    coverageCache = { at: Date.now(), data: coverageAfter };
    res.json({
      ok: true,
      femalePercentTarget: DEFAULT_FEMALE_PERCENT,
      listType,
      sortType,
      jobsRun: jobs.length,
      saved,
      skippedExisting,
      shortlinks,
      filteredOut: batch.filteredOut,
      processed: jobs.map((j) => ({
        keyword: j.keyword,
        category: j.category,
        subcategory: j.subcategory,
        audience: j.audience,
      })),
      coverage: coverageAfter,
    });
  } catch (err) {
    console.error("[/api/sync/coverage]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

app.get("/api/auto/status", (_req, res) => {
  res.json(autosync.getStatus());
});

app.post("/api/auto/run", requireAdmin, async (_req, res) => {
  try {
    const result = await autosync.runOnce({ manual: true });
    res.json({ ok: true, result, status: autosync.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Popular destaques (Top Performance). */
app.post("/api/auto/top-performance", requireAdmin, async (_req, res) => {
  try {
    const result = await autosync.runTopPerformance();
    res.json({ ok: true, result, status: autosync.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cron/sync", async (_req, res) => {
  try {
    if (!autosync.config.enabled) {
      return res.json({ ok: true, skipped: "auto-sync-paused" });
    }
    const result = await autosync.runOnce({ manual: true });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Força refresh dos top moneyScore (cron/manual). */
app.get("/api/cron/refresh-top", requireCronOrAdmin, async (_req, res) => {
  try {
    const result = await autosync.runOnce({ manual: true, forcePhase: "refresh-top" });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Invariante B — reverifica sales/rating/comissão dos produtos com metricas antigas. */
app.get("/api/cron/refresh-metrics", requireCronOrAdmin, async (req, res) => {
  try {
    const { refreshStaleMetrics } = require("./metricsRefresh");
    const { retryPendingShortlinks } = require("./linking");
    const batch = Math.min(Math.max(Number(req.query.batch) || 60, 5), 200);
    const staleHours = Math.min(Math.max(Number(req.query.staleHours) || 12, 1), 168);
    const metrics = await refreshStaleMetrics({ batch, staleHours });
    // Aproveita a janela pra retry dos shortlinks pending
    const links = await retryPendingShortlinks({ limit: 50 }).catch(() => null);
    res.json({ ok: true, metrics, links });
  } catch (err) {
    console.error("[/api/cron/refresh-metrics]", err.message);
    res.status(500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/**
 * Admin — adiciona 1 produto manual à vitrine.
 * Recebe URL Shopee (obrigatória) OU { shopId, itemId }.
 * Puxa dados reais da API (comissão/sales/rating/preço), depois passa por
 * saveOffersWithShortlinks (Invariante A → SITE_SUBID no slot 1 + short_link real).
 * Overrides opcionais: category, subcategory (senão usa taxonomia automática).
 */
app.post("/api/admin/produto-manual", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    let itemId = Number(body.itemId);
    let shopId = Number(body.shopId);

    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      const raw = String(body.sourceUrl || body.url || "").trim();
      if (!raw) {
        return res.status(400).json({ error: "URL Shopee do produto é obrigatória (ex: shopee.com.br/product/SHOPID/ITEMID)" });
      }
      // shopee.com.br/product/{shop}/{item} ou shopee.com.br/{slug}-i.{shop}.{item}
      const m1 = raw.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/i);
      const m2 = raw.match(/-i\.(\d+)\.(\d+)/i);
      if (m1) { shopId = Number(m1[1]); itemId = Number(m1[2]); }
      else if (m2) { shopId = Number(m2[1]); itemId = Number(m2[2]); }
      else {
        return res.status(400).json({
          error: "URL não reconhecida. Use o formato: https://shopee.com.br/product/SHOPID/ITEMID ou https://shopee.com.br/produto-i.SHOPID.ITEMID",
        });
      }
    }
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "item_id inválido" });
    }

    // Puxa dados reais da Shopee — comissão, sales, rating, preço, imagem
    const nodes = await fetchProductDetailsByIds([itemId]);
    const node = Array.isArray(nodes) && nodes.length ? nodes[0] : null;
    if (!node || !node.offerLink) {
      return res.status(404).json({
        error: "Shopee não retornou este produto — verifique se o link é público, se o produto ainda está ativo e se sua conta de afiliada tem acesso.",
      });
    }

    const keyword = String(body.keyword || node.productName || "").trim().toLowerCase().slice(0, 80);
    const forceCategory = body.category && String(body.category) !== "todos" ? String(body.category) : null;
    const forceSubcategory = body.subcategory ? String(body.subcategory) : null;
    const row = mapOfferToRow(node, keyword, body.listType != null ? Number(body.listType) : null, {
      forceCategory,
      forceSubcategory: forceCategory ? forceSubcategory : null,
    });
    // Overrides opcionais do admin (imagem custom / preço promocional que o admin quer destacar)
    if (body.imageUrl && /^https?:/i.test(String(body.imageUrl))) {
      row.image_url = String(body.imageUrl).trim();
    }

    if (!row.item_id || !row.offer_link) {
      return res.status(500).json({ error: "Dados incompletos da Shopee — não foi possível criar a oferta" });
    }

    // Passa por saveOffersWithShortlinks → ensureLinkedRows → SITE_SUBID + shortlink garantidos
    const out = await saveOffersWithShortlinks([row], { withShortlinks: true, skipExisting: false, gapMs: 100 });
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();

    res.json({
      ok: true,
      itemId: row.item_id,
      shopId: row.shop_id,
      saved: out.saved,
      alreadyExisted: out.skippedExisting > 0,
      shortLink: out.rows?.[0]?.short_link || null,
      subIds: out.rows?.[0]?.sub_ids || null,
      product: {
        title: row.product_name,
        image: row.image_url,
        priceMin: row.price_min,
        priceMax: row.price_max,
        commissionRate: row.commission_rate,
        sales: row.sales,
        ratingStar: row.rating_star,
        shopName: row.shop_name,
        category: row.category,
        subcategory: row.subcategory,
      },
    });
  } catch (err) {
    console.error("[/api/admin/produto-manual]", err.message);
    res.status(err.status || 500).json({
      error: err.message,
      rateLimited: !!err.rateLimited,
      details: err.payload || null,
    });
  }
});

/** Admin — reverifica UM item específico (venda/nota errada). */
app.post("/api/admin/reverify", requireAdmin, async (req, res) => {
  try {
    const { reverifyItem } = require("./metricsRefresh");
    const itemId = Number(req.body?.itemId || req.query?.itemId);
    const result = await reverifyItem(itemId);
    ofertasCache.clear();
    res.json(result);
  } catch (err) {
    console.error("[/api/admin/reverify]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Cron — puxa conversionReport das últimas 48h. */
app.get("/api/cron/conversions", requireCronOrAdmin, async (req, res) => {
  try {
    const { pullConversionReport } = require("./conversions");
    const sinceMin = Math.min(Math.max(Number(req.query.sinceMin) || 60 * 48, 15), 60 * 24 * 30);
    const result = await pullConversionReport({ sinceMin });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/cron/conversions]", err.message);
    res.status(500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Cron — puxa validatedReport (precisa validationId). */
app.post("/api/cron/validated", requireAdmin, async (req, res) => {
  try {
    const { pullValidatedReport } = require("./conversions");
    const validationId = Number(req.body?.validationId || req.query?.validationId);
    const result = await pullValidatedReport({ validationId });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/cron/validated]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Admin — Painel do Meu Site. onlyMeuSite=true por padrão (filtro SITE_SUBID). */
app.get("/api/admin/meu-site/summary", requireAdmin, async (req, res) => {
  try {
    const { summary } = require("./conversions");
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const onlyMeuSite = String(req.query.onlyMeuSite ?? "true") !== "false";
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const result = await summary({ from, to, days, onlyMeuSite });
    res.json(result);
  } catch (err) {
    console.error("[/api/admin/meu-site/summary]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Admin — desempenho por campanha a partir do banco (mesma fonte do Meu Site).
 * Evita o /api/conversions ao vivo, que pagina misturado e perde vendas do site.
 */
app.get("/api/admin/campanhas/performance", requireAdmin, async (req, res) => {
  try {
    const { campaignPerformanceFromDb } = require("./conversions");
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const status = String(req.query.status || "").trim();
    const result = await campaignPerformanceFromDb({ days, status });
    res.json(result);
  } catch (err) {
    console.error("[/api/admin/campanhas/performance]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Admin — reprocessa sub_ids de ofertas antigas sem SITE_SUBID no slot 1. */
app.post("/api/admin/meu-site/reprocess-subids", requireAdmin, async (req, res) => {
  try {
    const { reprocessSubIds } = require("./conversions");
    const limit = Math.min(Math.max(Number(req.body?.limit) || 100, 1), 500);
    const dryRun = !!req.body?.dryRun;
    const result = await reprocessSubIds({ limit, dryRun });
    ofertasCache.clear();
    res.json(result);
  } catch (err) {
    console.error("[/api/admin/meu-site/reprocess-subids]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Cron — feed FULL (1x/dia). Varre catálogo aprovado em páginas de 500. */
app.get("/api/cron/feed-full", requireCronOrAdmin, async (req, res) => {
  try {
    const { runFullFeedSync } = require("./feedSync");
    const force = String(req.query.force || "").trim() === "1";
    const result = await runFullFeedSync({ forceReprocess: force });
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/cron/feed-full]", err.message);
    res.status(500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Cron — feed DELTA (1x/h). NEW/UPDATE upsert; DELETE marca hidden. */
app.get("/api/cron/feed-delta", requireCronOrAdmin, async (req, res) => {
  try {
    const { runDeltaFeedSync } = require("./feedSync");
    const force = String(req.query.force || "").trim() === "1";
    const result = await runDeltaFeedSync({ forceReprocess: force });
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/cron/feed-delta]", err.message);
    res.status(500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — decodifica um shortlink/URL Shopee e diz se é do meu site. */
app.get("/api/admin/link/decode", requireAdmin, async (req, res) => {
  try {
    const { decodeSubIdsFromUrl } = require("./conversions");
    const url = String(req.query?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url obrigatório" });
    if (url.length > 4096) return res.status(400).json({ error: "URL muito longa (>4096)" });
    res.json(decodeSubIdsFromUrl(url));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Admin — Ferramentas: inventário dos feeds disponíveis (listItemFeeds). */
app.get("/api/admin/feeds/list", requireAdmin, async (req, res) => {
  try {
    const { listItemFeeds } = require("./feed");
    const mode = String(req.query?.feedMode || "").toUpperCase();
    const feeds = await listItemFeeds(mode === "FULL" || mode === "DELTA" ? mode : null);
    res.json({ ok: true, feeds, count: feeds.length });
  } catch (err) {
    console.error("[/api/admin/feeds/list]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — inspeciona uma página do feed (até 80 linhas) sem importar. */
app.get("/api/admin/feeds/preview", requireAdmin, async (req, res) => {
  try {
    const { getItemFeedData, columnsJsonToRow } = require("./feed");
    const datafeedId = String(req.query?.datafeedId || "").trim();
    if (!datafeedId) return res.status(400).json({ error: "datafeedId obrigatório" });
    const offset = Math.max(Number(req.query?.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 80);
    const page = await getItemFeedData({ datafeedId, offset, limit });
    const rows = (page.rows || []).map((r) => {
      const mapped = columnsJsonToRow(r.columns, r.updateType);
      return {
        updateType: r.updateType || mapped?._feedUpdateType || "",
        itemId: mapped?.item_id || null,
        name: mapped?.product_name || "",
        price: mapped?.price_min || mapped?.price || "",
        commission: mapped?.commission_rate || "",
        shop: mapped?.shop_name || "",
        image: mapped?.image_url || "",
      };
    });
    res.json({ ok: true, rows, pageInfo: page.pageInfo || {}, datafeedId });
  } catch (err) {
    console.error("[/api/admin/feeds/preview]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — Ferramentas: batch shortlink ad-hoc (até 50 URLs, com subIds opcionais). */
app.post("/api/admin/shortlink/batch", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const rawUrls = Array.isArray(body.urls)
      ? body.urls
      : String(body.urls || "").split(/[\r\n]+/);
    const subIds = Array.isArray(body.subIds) ? body.subIds.map(String) : null;
    const urls = rawUrls
      .map((u) => String(u || "").trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 50);
    if (!urls.length) return res.status(400).json({ error: "Envie até 50 URLs válidas." });
    const payload = urls.map((originUrl) => ({ originUrl, subIds }));
    const result = await generateBatchShortLink(payload);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[/api/admin/shortlink/batch]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — Ferramentas: reverificar em lote (até 30 IDs). */
app.post("/api/admin/reverify/batch", requireAdmin, async (req, res) => {
  try {
    const { reverifyItem } = require("./metricsRefresh");
    const body = req.body || {};
    const raw = Array.isArray(body.itemIds)
      ? body.itemIds
      : String(body.itemIds || "").split(/[\s,;]+/);
    const ids = [...new Set(
      raw.map((v) => Number(v)).filter((n) => Number.isSafeInteger(n) && n > 0)
    )].slice(0, 30);
    if (!ids.length) return res.status(400).json({ error: "Nenhum item_id válido." });
    const gapMs = Math.min(Math.max(Number(body.gapMs) || 250, 100), 2000);
    const results = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await reverifyItem(id);
        results.push({ itemId: id, ok: true, ...r });
      } catch (e) {
        results.push({ itemId: id, ok: false, error: e.message });
      }
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, gapMs));
    }
    ofertasCache.clear();
    res.json({ ok: true, total: ids.length, results });
  } catch (err) {
    console.error("[/api/admin/reverify/batch]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Admin — Ferramentas: explorador de lojas (shopOfferV2). */
app.get("/api/admin/shopee/shops", requireAdmin, async (req, res) => {
  try {
    const { fetchShopOffers } = require("./shopee");
    const shopTypeRaw = String(req.query?.shopType || "").trim();
    const shopType = shopTypeRaw
      ? shopTypeRaw.split(",").map((s) => Number(s)).filter((n) => [0, 1, 2, 3].includes(n))
      : null;
    const result = await fetchShopOffers({
      keyword: String(req.query?.keyword || "").trim(),
      shopType: shopType && shopType.length ? shopType : null,
      sortType: Number(req.query?.sortType) || 1,
      page: Number(req.query?.page) || 1,
      limit: Number(req.query?.limit) || 20,
      shopId: req.query?.shopId ? Number(req.query.shopId) : null,
      sellerCommCoveRatio: req.query?.sellerCommCoveRatio ? String(req.query.sellerCommCoveRatio) : null,
      isKeySeller: req.query?.isKeySeller === "1" || req.query?.isKeySeller === "true" ? true : null,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[/api/admin/shopee/shops]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — Ferramentas: campanhas oficiais Shopee (shopeeOfferV2). */
app.get("/api/admin/shopee/campaigns", requireAdmin, async (req, res) => {
  try {
    const result = await fetchShopeeOffers({
      keyword: String(req.query?.keyword || "").trim(),
      sortType: Number(req.query?.sortType) || 1,
      page: Number(req.query?.page) || 1,
      limit: Number(req.query?.limit) || 20,
    });
    res.json({ ok: true, nodes: result.nodes || [], pageInfo: result.pageInfo || {} });
  } catch (err) {
    console.error("[/api/admin/shopee/campaigns]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Admin — Ferramentas: últimas N chamadas GraphQL Shopee (diagnóstico). */
app.get("/api/admin/shopee/health", requireAdmin, async (_req, res) => {
  try {
    const { getHealth } = require("./shopee");
    const entries = getHealth();
    const now = Date.now();
    const last5min = entries.filter((e) => now - e.at < 5 * 60 * 1000);
    const summary = {
      ok: last5min.filter((e) => e.ok).length,
      err: last5min.filter((e) => !e.ok && !e.rateLimited).length,
      rateLimited: last5min.filter((e) => e.rateLimited).length,
      avgMs: last5min.length
        ? Math.round(last5min.reduce((s, e) => s + (e.ms || 0), 0) / last5min.length)
        : 0,
    };
    res.json({ ok: true, entries, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Admin — Ferramentas: validatedReport (comissão validada). */
app.get("/api/admin/validated", requireAdmin, async (req, res) => {
  try {
    const { fetchValidatedReport } = require("./shopee");
    const validationId = Number(req.query?.validationId);
    if (!Number.isSafeInteger(validationId) || validationId <= 0) {
      return res.status(400).json({ error: "validationId obrigatório (inteiro > 0)" });
    }
    const result = await fetchValidatedReport({
      validationId,
      limit: Math.min(Math.max(Number(req.query?.limit) || 50, 1), 100),
      scrollId: String(req.query?.scrollId || "").trim(),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[/api/admin/validated]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/** Campanhas de rastreio salvas no Supabase */
app.get("/api/campanhas-rastreio", async (_req, res) => {
  try {
    const rows = await listCampanhasRastreio();
    const campaigns = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      title: r.title || "",
      channel: r.channel,
      campaign: r.campaign,
      products: r.products || [],
      links: r.links || [],
      exampleSubIds: r.example_sub_ids || [],
      createdAt: r.created_at,
    }));
    res.json({ campaigns, count: campaigns.length });
  } catch (err) {
    console.error("[/api/campanhas-rastreio]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

app.post("/api/campanhas-rastreio", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.id || !body.campaign) {
      return res.status(400).json({ error: "id e campaign obrigatórios" });
    }
    const saved = await upsertCampanhaRastreio(body);
    res.json({ ok: true, campaign: Array.isArray(saved) ? saved[0] : saved });
  } catch (err) {
    console.error("[/api/campanhas-rastreio POST]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

app.delete("/api/campanhas-rastreio/:id", requireAdmin, async (req, res) => {
  try {
    await deleteCampanhaRastreio(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[/api/campanhas-rastreio DELETE]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const token = process.env.CF_API_TOKEN;
    const zone  = process.env.CF_ZONE_ID;
    if (!token || !zone) return res.status(500).json({ error: "Cloudflare não configurado" });

    const cfHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    async function cfQuery(query) {
      const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST", headers: cfHeaders, body: JSON.stringify({ query }),
      });
      return r.json();
    }

    const minutesMap = { "-1440": 1, "-10080": 7, "-43200": 30 };
    const sinceParam = req.query.since || "-10080";
    const days = minutesMap[sinceParam] || 7;
    const isHourly = sinceParam === "-1440";
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - days);
    const dateSince = start.toISOString().slice(0, 10);
    const dateUntil = now.toISOString().slice(0, 10);
    const dtSince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const dayList = [];
    for (let d = new Date(dateSince + "T12:00:00Z"); d <= new Date(dateUntil + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
      dayList.push(d.toISOString().slice(0, 10));
    }

    const dailyQuery = `query {
      viewer {
        zones(filter: { zoneTag: "${zone}" }) {
          httpRequests1dGroups(limit: 60, filter: { date_geq: "${dateSince}", date_leq: "${dateUntil}" }) {
            dimensions { date }
            sum {
              requests pageViews bytes cachedRequests
              countryMap { clientCountryName requests }
              browserMap { uaBrowserFamily pageViews }
              responseStatusMap { edgeResponseStatus requests }
            }
            uniq { uniques }
          }
          ${isHourly ? `httpRequests1hGroups(limit: 48, filter: { date_geq: "${dateUntil}", date_leq: "${dateUntil}" }) {
            dimensions { datetimeHour }
            sum { requests pageViews }
            uniq { uniques }
          }` : ""}
        }
      }
    }`;

    const perDayQuery = (day) => `query {
      viewer {
        zones(filter: { zoneTag: "${zone}" }) {
          devices: httpRequestsAdaptiveGroups(limit: 10, filter: { date_geq: "${day}", date_leq: "${day}" }) {
            dimensions { clientDeviceType }
            count
          }
          paths: httpRequestsAdaptiveGroups(limit: 30, filter: { date_geq: "${day}", date_leq: "${day}" }, orderBy: [count_DESC]) {
            dimensions { clientRequestPath }
            count
          }
          cache: httpRequestsAdaptiveGroups(limit: 10, filter: { date_geq: "${day}", date_leq: "${day}" }) {
            dimensions { cacheStatus }
            count
          }
          visits: httpRequestsAdaptiveGroups(limit: 1, filter: { date_geq: "${day}", date_leq: "${day}", requestSource: "eyeball" }) {
            sum { visits }
          }
          campaign: httpRequestsAdaptiveGroups(limit: 1, filter: { date_geq: "${day}", date_leq: "${day}", clientRequestPath_like: "/p/%" }) {
            count
          }
        }
      }
    }`;

    const refererQuery = `query {
      viewer {
        zones(filter: { zoneTag: "${zone}" }) {
          referrers: httpRequestsAdaptiveGroups(limit: 15, filter: { date_geq: "${dateUntil}", date_leq: "${dateUntil}", requestSource: "eyeball" }, orderBy: [count_DESC]) {
            dimensions { clientRefererHost }
            count
          }
        }
      }
    }`;

    const dailyData = await cfQuery(dailyQuery);
    const groups = dailyData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
    if (!groups) {
      return res.status(502).json({ error: "Cloudflare error", details: dailyData.errors || dailyData });
    }

    const dayResults = await Promise.all(dayList.map(day => cfQuery(perDayQuery(day))));
    let referrers = [];
    let referrersUnavailable = false;
    const refererData = await cfQuery(refererQuery);
    if (refererData?.errors?.length) {
      referrersUnavailable = true;
    } else {
      referrers = (refererData?.data?.viewer?.zones?.[0]?.referrers || []).map(r => ({
        host: r.dimensions?.clientRefererHost || "",
        requests: r.count || 0,
      }));
    }

    let totalRequests = 0, totalPageviews = 0, totalUniques = 0, totalBytes = 0, totalCached = 0;
    let totalVisits = 0, campaignRequests = 0;
    const countries = {}, browsers = {}, statusCodes = {};
    const devicesMap = {}, pathsMap = {}, cacheMap = {};
    let series = [];
    let seriesGranularity = "day";

    for (const g of groups) {
      const reqs = g.sum?.requests || 0;
      const pvs  = g.sum?.pageViews || 0;
      const uniqs = g.uniq?.uniques || 0;
      const bytes = g.sum?.bytes || 0;
      const cached = g.sum?.cachedRequests || 0;
      totalRequests  += reqs;
      totalPageviews += pvs;
      totalUniques   += uniqs;
      totalBytes     += bytes;
      totalCached    += cached;
      for (const c of g.sum?.countryMap || []) {
        countries[c.clientCountryName] = (countries[c.clientCountryName] || 0) + c.requests;
      }
      for (const b of g.sum?.browserMap || []) {
        const name = b.uaBrowserFamily || "Outros";
        browsers[name] = (browsers[name] || 0) + (b.pageViews || 0);
      }
      for (const s of g.sum?.responseStatusMap || []) {
        const code = String(s.edgeResponseStatus);
        statusCodes[code] = (statusCodes[code] || 0) + (s.requests || 0);
      }
      series.push({ since: g.dimensions.date, requests: reqs, pageviews: pvs, uniques: uniqs });
    }
    series.sort((a, b) => a.since.localeCompare(b.since));

    const hourlyGroups = dailyData?.data?.viewer?.zones?.[0]?.httpRequests1hGroups;
    if (isHourly && Array.isArray(hourlyGroups) && hourlyGroups.length) {
      const cutoff = new Date(dtSince).getTime();
      series = hourlyGroups
        .filter(h => new Date(h.dimensions?.datetimeHour || 0).getTime() >= cutoff)
        .sort((a, b) => (a.dimensions?.datetimeHour || "").localeCompare(b.dimensions?.datetimeHour || ""))
        .map(h => ({
          since: h.dimensions?.datetimeHour,
          requests: h.sum?.requests || 0,
          pageviews: h.sum?.pageViews || 0,
          uniques: h.uniq?.uniques || 0,
        }));
      seriesGranularity = "hour";
    }

    for (const dr of dayResults) {
      const z = dr?.data?.viewer?.zones?.[0];
      if (!z) continue;
      totalVisits += z.visits?.[0]?.sum?.visits || 0;
      campaignRequests += z.campaign?.[0]?.count || 0;
      for (const d of z.devices || []) {
        const k = d.dimensions?.clientDeviceType || "unknown";
        devicesMap[k] = (devicesMap[k] || 0) + (d.count || 0);
      }
      for (const p of z.paths || []) {
        const k = p.dimensions?.clientRequestPath || "/";
        pathsMap[k] = (pathsMap[k] || 0) + (p.count || 0);
      }
      for (const c of z.cache || []) {
        const k = c.dimensions?.cacheStatus || "unknown";
        cacheMap[k] = (cacheMap[k] || 0) + (c.count || 0);
      }
    }

    if (!referrersUnavailable) {
      const refMap = {};
      for (const r of referrers) refMap[r.host || ""] = (refMap[r.host || ""] || 0) + r.requests;
      referrers = Object.entries(refMap).map(([host, requests]) => ({ host, requests }))
        .sort((a, b) => b.requests - a.requests);
    }

    const devices = Object.entries(devicesMap).map(([device, requests]) => ({ device, requests }))
      .sort((a, b) => b.requests - a.requests);
    const topPaths = Object.entries(pathsMap).map(([path, requests]) => ({ path, requests }))
      .sort((a, b) => b.requests - a.requests).slice(0, 30);
    const cache = Object.entries(cacheMap).map(([status, requests]) => ({ status, requests }))
      .sort((a, b) => b.requests - a.requests);

    let otherRequests = 0;
    for (const [path, requests] of Object.entries(pathsMap)) {
      if (path.startsWith("/p/")) continue;
      if (path.startsWith("/api/") || path.startsWith("/uploads/") || path.startsWith("/cdn-cgi/") || /\.[a-z0-9]{2,5}$/i.test(path)) {
        otherRequests += requests;
      }
    }
    const vitrineRequests = Math.max(0, totalRequests - campaignRequests - otherRequests);

    const cacheTotal = cache.reduce((s, c) => s + c.requests, 0) || totalRequests || 1;
    const cacheHitRate = cache.length
      ? ((cache.filter(c => ["hit", "stale", "revalidated"].includes(c.status)).reduce((s, c) => s + c.requests, 0) / cacheTotal) * 100)
      : (totalCached > 0 && totalRequests > 0 ? (totalCached / totalRequests) * 100 : 0);

    res.json({
      ok: true,
      summary: {
        requests:  totalRequests,
        pageviews: totalPageviews,
        uniques:   totalUniques,
        visits:    totalVisits,
        bandwidth: totalBytes,
        cachedRequests: totalCached,
        cacheHitRate: Math.round(cacheHitRate * 10) / 10,
        countries,
        browsers,
        statusCodes,
      },
      series,
      seriesGranularity,
      devices,
      topPaths,
      referrers,
      referrersUnavailable,
      cache,
      trafficSplit: {
        campaign: campaignRequests,
        vitrine: vitrineRequests,
        other: Math.max(0, totalRequests - campaignRequests - vitrineRequests),
      },
    });
  } catch (err) {
    console.error("[/api/admin/analytics]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Regenera os shortlinks de UMA (ou TODAS) as campanhas no formato standalone
 * (sub_id de 1 slot só com o nome). Pra migrar rastreamento antigo (5 slots
 * com afiliadamestre no slot 1) pro novo formato — que bate 1:1 com o filtro
 * `Sub_id` do relatório da Shopee.
 *
 * Body: { campaign?: string }  — se ausente, regenera todas.
 * Não muda o `short_link` cacheado da oferta na vitrine (esse continua sendo
 * o link orgânico). Os novos links voltam no response pra o Diego colar nas
 * campanhas dele.
 */
app.post("/api/admin/campanhas/regenerar-standalone", requireAdmin, async (req, res) => {
  try {
    const targetSlug = req.body?.campaign
      ? sanitizeSubId(req.body.campaign, "")
      : "";

    const all = await listCampanhasRastreio();
    const list = Array.isArray(all) ? all : [];
    const chosen = targetSlug
      ? list.filter((c) => sanitizeSubId(c.id, "") === targetSlug || sanitizeSubId(c.campaign, "") === targetSlug)
      : list;

    if (!chosen.length) {
      return res.json({
        ok: true,
        regenerated: 0,
        campaigns: [],
        note: targetSlug
          ? `Nenhuma campanha "${targetSlug}" encontrada em campanhas_rastreio.`
          : "Nenhuma campanha cadastrada.",
      });
    }

    const perCampaign = [];
    let totalLinks = 0;
    let totalFailed = 0;
    let rateLimited = false;

    for (const camp of chosen) {
      const campaignSlug = sanitizeSubId(camp.campaign || camp.id, "vitrine");
      const productIds = [...new Set(
        (Array.isArray(camp.products) ? camp.products : [])
          .map((p) => Number(p?.itemId ?? p?.id ?? p))
          .filter((n) => Number.isSafeInteger(n) && n > 0)
      )].slice(0, 50);

      if (!productIds.length) {
        perCampaign.push({
          id: camp.id,
          campaign: campaignSlug,
          links: [],
          note: "Campanha sem produtos.",
        });
        continue;
      }

      const rows = await getOffersByItemIds(productIds, { full: true });
      const byId = new Map(
        (Array.isArray(rows) ? rows : []).map((r) => [String(r.item_id), r])
      );

      const payload = [];
      const missing = [];
      for (const id of productIds) {
        const row = byId.get(String(id));
        if (!row || !row.offer_link) {
          missing.push(id);
          continue;
        }
        const originUrl = resolveProductOriginUrl(row);
        if (!originUrl) {
          missing.push(id);
          continue;
        }
        payload.push({
          originUrl,
          subIds: buildCampaignSubIds(campaignSlug),
          itemId: row.item_id,
          preserveExact: true,
        });
      }

      let links = [];
      if (payload.length) {
        const batch = await generateBatchShortLink(payload);
        if (batch.rateLimited) rateLimited = true;
        const bySent = new Map(payload.map((p) => [String(p.itemId), p]));
        links = (batch.links || []).map((l) => {
          const ok = l.success && !!l.shortLink;
          if (ok) totalLinks += 1; else totalFailed += 1;
          return {
            productId: l.itemId,
            shopeeUrl: ok ? l.shortLink : null,
            subIds: bySent.get(String(l.itemId))?.subIds || [],
            error: ok ? null : (l.errorMessage || "falhou"),
          };
        });
      }

      perCampaign.push({
        id: camp.id,
        campaign: campaignSlug,
        subIdFormat: `${campaignSlug}----`,
        products: productIds.length,
        links,
        missing,
      });

      if (rateLimited) break;
    }

    res.json({
      ok: true,
      regenerated: totalLinks,
      failed: totalFailed,
      rateLimited,
      campaigns: perCampaign,
    });
  } catch (err) {
    console.error("[/api/admin/campanhas/regenerar-standalone]", err.message);
    res.status(err.status || 500).json({
      error: err.message,
      rateLimited: !!err.rateLimited,
      details: err.payload || null,
    });
  }
});

/**
 * Resolve um produto para o gerador de campanha a partir do ID (ou link Shopee).
 * Item já publicado volta direto do banco; o que faltar é buscado na Shopee e
 * publicado na vitrine com Sub IDs/shortlink antes de responder.
 */
app.post("/api/admin/campanha/produto", requireAdmin, async (req, res) => {
  try {
    const raw = String(req.body?.id ?? req.body?.itemId ?? req.body?.url ?? "").trim();
    if (!raw) {
      return res.status(400).json({ error: "Informe o ID do produto ou o link da Shopee" });
    }

    const byProductPath = raw.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/i);
    const bySlug = raw.match(/-i\.(\d+)\.(\d+)/i);
    let itemId = null;
    if (byProductPath) itemId = Number(byProductPath[2]);
    else if (bySlug) itemId = Number(bySlug[2]);
    else if (/^\d+$/.test(raw)) itemId = Number(raw);

    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        error: "ID inválido. Use o número do item ou o link do produto na Shopee.",
      });
    }

    const existing = await getOffersByItemIds([itemId], { full: true });
    const hadRow = Array.isArray(existing) && existing.length;
    const hadOffer = hadRow && isTrackedAffiliateUrl(existing[0].offer_link);
    let row = await ensureAffiliateOffer(itemId);
    let added = !hadRow && !!row;
    let repaired = hadRow && !hadOffer && !!row;

    if (!row || !isTrackedAffiliateUrl(row.offer_link)) {
      return res.status(404).json({
        error: "A Shopee não devolveu link de afiliado para este item — confira se ele continua ativo e dentro do seu programa.",
      });
    }

    if (!row.short_link) {
      // Tem o link de afiliado, só falta o shope.ee com os Sub IDs.
      const { ensureLinkedRows } = require("./linking");
      const linked = await ensureLinkedRows([{ ...row }], { regenerate: false, gapMs: 100 });
      const updated = linked.rows?.[0];
      if (updated?.short_link) {
        await updateShortLink(itemId, updated.short_link).catch(() => {});
        row = { ...row, short_link: updated.short_link, sub_ids: updated.sub_ids };
        ofertasCache.clear();
        repaired = true;
      }
    }

    if (!row.offer_link) {
      return res.status(502).json({ error: "Não foi possível obter o link de afiliado deste item na Shopee." });
    }

    const product = rowToProduct(row);
    res.json({
      ok: true,
      added,
      repaired,
      tracking: {
        affiliateLink: row.offer_link,
        shortLink: row.short_link || null,
        subIds: product.subIds,
        shortLinkPending: !row.short_link,
      },
      product,
    });
  } catch (err) {
    console.error("[/api/admin/campanha/produto]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/**
 * Links de afiliado da Shopee para uma campanha: um shortlink por produto,
 * com os Sub IDs do canal/campanha (slot 2 e 3) em vez dos orgânicos.
 * Não grava em `ofertas` — o short_link do produto continua sendo o orgânico.
 * Body: { channel, campaign, productIds: [] }
 */
app.post("/api/admin/campanha/links", requireAdmin, async (req, res) => {
  try {
    const channel = sanitizeSubId(req.body?.channel, "organico");
    const campaign = sanitizeSubId(req.body?.campaign, "vitrine");
    // standalone=true (default): shortlink sai com sub_id de 1 slot só (nome da
    // campanha), pra bater 1:1 com o filtro `Sub_id` do relatório da Shopee —
    // mesmo formato das campanhas manuais que o Diego cria direto no painel deles.
    // standalone=false: formato antigo (5 slots com SITE_SUBID no slot 1).
    const standalone = req.body?.standalone !== false && req.body?.legacy !== true;
    const ids = [...new Set(
      (Array.isArray(req.body?.productIds) ? req.body.productIds : [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )].slice(0, 50);

    if (!ids.length) return res.json({ ok: true, links: [], channel, campaign, standalone });

    const rows = await getOffersByItemIds(ids, { full: true });
    const byId = new Map(
      (Array.isArray(rows) ? rows : []).map((r) => [String(r.item_id), r])
    );

    const payload = [];
    const missing = [];
    for (const id of ids) {
      let row = byId.get(String(id));
      if (!row || !isTrackedAffiliateUrl(row.offer_link)) {
        row = await ensureAffiliateOffer(id);
      }
      if (!row || !isTrackedAffiliateUrl(row.offer_link)) {
        missing.push(id);
        continue;
      }
      const originUrl = resolveProductOriginUrl(row);
      if (!originUrl) {
        missing.push(id);
        continue;
      }
      const subIds = standalone
        ? buildCampaignSubIds(campaign)
        : buildTrackedSubIds(row.category, row.item_id, row.subcategory, {
            channel,
            campaign,
            medium: "social",
          });
      payload.push({
        originUrl,
        subIds,
        itemId: row.item_id,
        preserveExact: standalone,
      });
    }

    let generated = [];
    let rateLimited = false;
    if (payload.length) {
      const batch = await generateBatchShortLink(payload);
      rateLimited = !!batch.rateLimited;
      const bySent = new Map(payload.map((p) => [String(p.itemId), p]));
      generated = (batch.links || []).map((l) => ({
        productId: l.itemId,
        shopeeUrl: l.success ? l.shortLink : null,
        subIds: bySent.get(String(l.itemId))?.subIds || [],
        error: l.success ? null : (l.errorMessage || "falhou"),
      }));
    }

    res.json({
      ok: true,
      channel,
      campaign,
      standalone,
      links: generated,
      missing,
      rateLimited,
    });
  } catch (err) {
    console.error("[/api/admin/campanha/links]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/**
 * Gera short link (com subIds) e opcionalmente cacheia no Supabase.
 * Body: { originUrl, subIds?, itemId? }
 * Público de propósito: a vitrine chama isto no clique de compra pra resolver
 * os Sub IDs da campanha do visitante. Exigir sessão aqui faria todo tráfego
 * de anúncio sair pelo link orgânico e perder a atribuição. Contra abuso de
 * quota, vale rate limit por IP.
 */
app.post("/api/shortlink", shortlinkRateLimit, async (req, res) => {
  try {
    const originUrl = String(req.body?.originUrl || "").trim();
    if (!originUrl) return res.status(400).json({ error: "originUrl obrigatório" });
    const { SITE_SUBID, looksLikeCampaignSubIds } = require("./tracking");
    let subIds = Array.isArray(req.body?.subIds) && req.body.subIds.length
      ? req.body.subIds.map(String)
      : buildProductSubIds("geral", req.body?.itemId);

    // Detecta 3 formatos aceitos:
    //   - standalone flag explícita ({ standalone: true } no body)
    //   - subIds vem com 1 slot só que não é SITE_SUBID (campanha standalone)
    //   - default: vitrine/orgânico (5 slots com SITE_SUBID no slot 1)
    const explicitStandalone = req.body?.standalone === true;
    const inferredStandalone = looksLikeCampaignSubIds(subIds);
    const standalone = explicitStandalone || inferredStandalone;

    if (!standalone) {
      // Invariante A pra fluxo vitrine: slot 1 sempre SITE_SUBID.
      if (subIds[0] !== SITE_SUBID) {
        subIds = [SITE_SUBID, ...subIds].slice(0, 5);
      }
    }
    // Sanitiza pra responder (e decidir o cache) com o que a Shopee de fato
    // registrou — o painel mostra esses Sub IDs pra casar com o relatório.
    subIds = sanitizeSubIdsForShopee(subIds, { preserveExact: standalone });
    const itemId = req.body?.itemId != null ? Number(req.body.itemId) : null;
    const shortLink = await generateShortLink(originUrl, subIds, { preserveExact: standalone });
    // Só o link orgânico da vitrine vira cache do produto. Guardar um link de
    // campanha aqui faria o próximo visitante orgânico sair com o Sub ID da
    // campanha alheia.
    const isOrganic = !standalone && subIds[1] === "organico" && subIds[2] === "vitrine";
    if (shortLink && itemId && isOrganic) {
      try {
        await updateShortLink(itemId, shortLink);
      } catch (e) {
        console.warn("[/api/shortlink] cache falhou:", e.message);
      }
    }
    res.json({
      shortLink,
      originUrl,
      subIds,
      standalone,
      cached: Boolean(shortLink && itemId && isOrganic),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

/**
 * Backfill de shortlinks: gera shope.ee para ofertas sem short_link cacheado.
 * all=true → continua até zerar a fila, rate-limit, ou teto de tempo (~45s, seguro no Vercel).
 */
async function backfillShortlinks({ limit = 50, gapMs = 400, all = false } = {}) {
  const batchSize = Math.min(Math.max(Number(limit) || 50, 1), 50);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  let rounds = 0;
  const maxRounds = all ? 400 : 1;
  const started = Date.now();
  const timeBudgetMs = all ? 45000 : 55000;

  while (rounds < maxRounds) {
    if (Date.now() - started > timeBudgetMs) {
      return {
        ok: true,
        generated,
        failed,
        skipped,
        rounds,
        all,
        timedOut: true,
        message: "Parou no limite de tempo — clique de novo para continuar o restante.",
      };
    }
    rounds += 1;
    const rows = await listOffersMissingShortlink({ limit: batchSize });
    if (!Array.isArray(rows) || !rows.length) break;

    const result = await generateShortlinksForRows(rows, { gapMs: 0 });
    generated += result.generated;
    failed += result.failed;
    skipped += result.skipped;

    if (result.rateLimited) {
      return {
        ok: true,
        generated,
        failed,
        skipped,
        rounds,
        all,
        rateLimited: true,
        message: "Rate-limit da Shopee — rode de novo em alguns segundos para continuar.",
      };
    }
    if (!all) break;
    if (rounds < maxRounds) await sleep(gapMs);
  }

  return { ok: true, generated, failed, skipped, rounds, all, done: true };
}

app.get("/api/status/shortlinks", async (_req, res) => {
  try {
    const status = await countShortlinkStatus();
    res.json({ ...status, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/status/shortlinks]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/shortlinks/backfill", requireAdmin, async (req, res) => {
  try {
    const all = req.body?.all !== false; // padrão: gera tudo que falta
    const limit = Number(req.body?.limit) || 50;
    const result = await backfillShortlinks({ limit, all });
    const status = await countShortlinkStatus().catch(() => null);
    res.json({ ...result, status });
  } catch (err) {
    console.error("[/api/shortlinks/backfill]", err.message);
    res.status(err.status || 500).json({ error: err.message, details: err.payload || null });
  }
});

/**
 * Relatório real de conversões da Shopee para o painel admin.
 * Por padrão (siteOnly=1) só retorna vendas rastreadas por este site.
 */
app.get("/api/conversions", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const now = Math.floor(Date.now() / 1000);
    const orderStatus = String(req.query.status || "").toUpperCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const scrollId = String(req.query.scrollId || "").trim();
    const siteOnly = String(req.query.siteOnly ?? "1") !== "0";
    const marker = String(req.query.marker || SITE_SUBID).toLowerCase();
    const report = await fetchConversionReport({
      purchaseTimeStart: now - days * 24 * 3600,
      purchaseTimeEnd: now,
      orderStatus,
      limit,
      scrollId,
    });
    let nodes = Array.isArray(report.nodes) ? report.nodes : [];
    const totalFromShopee = nodes.length;
    if (siteOnly) {
      // 3 formatos aceitos como "meu site":
      //   1. utm contém SITE_SUBID (vitrine/orgânico, 5 slots)
      //   2. utm contém "afiliada_mestre" (legado, histórico com underscore)
      //   3. sub_id1 === nome de campanha conhecida (standalone, 1 slot)
      const markerCompact = marker.replace(/[^a-z0-9]/g, "");
      const markerLegacy = "afiliada_mestre";
      const { listKnownCampaignNames } = require("./supabase");
      const knownCampaigns = await listKnownCampaignNames();
      nodes = nodes.filter((conversion) => {
        const utm = String(conversion.utmContent || "").toLowerCase();
        if (utm.includes(markerCompact) || utm.includes(markerLegacy)) return true;
        // campanha standalone: primeiro token (split por - _ | , ; /) é o nome.
        const slot1 = utm.split(/[-_|,;/]/)[0]?.replace(/[^a-z0-9]/g, "");
        return slot1 ? knownCampaigns.has(slot1) : false;
      });
    }
    const itemIds = nodes.flatMap((conversion) =>
      (conversion.orders || []).flatMap((order) =>
        (order.items || []).map((item) => item.itemId)
      )
    );
    let offersById = new Map();
    try {
      const offers = await getOffersByItemIds(itemIds);
      offersById = new Map((offers || []).map((offer) => [String(offer.item_id), offer]));
    } catch (enrichError) {
      console.warn("[/api/conversions] detalhes Supabase indisponíveis:", enrichError.message);
    }
    const missingIds = [...new Set(itemIds.map(String))]
      .filter((itemId) => !offersById.has(itemId))
      .slice(0, 20);
    if (missingIds.length) {
      try {
        const liveProducts = await fetchProductDetailsByIds(missingIds);
        for (const product of liveProducts || []) {
          const id = String(product.itemId || "");
          if (!id) continue;
          offersById.set(id, {
            item_id: product.itemId,
            image_url: product.imageUrl || "",
            product_name: product.productName || "",
            category: categoryForKeyword(product.productName),
          });
        }
      } catch (imageError) {
        console.warn("[/api/conversions] fotos Shopee indisponíveis:", imageError.message);
      }
    }
    const conversions = nodes.map((conversion) => ({
      ...conversion,
      orders: (conversion.orders || []).map((order) => ({
        ...order,
        items: (order.items || []).map((item) => {
          const offer = offersById.get(String(item.itemId));
          return {
            ...item,
            imageUrl: offer?.image_url || "",
            category: offer?.category || categoryForKeyword(item.itemName) || "todos",
            itemName: item.itemName || offer?.product_name || `Item ${item.itemId || ""}`,
          };
        }),
      })),
    }));
    res.json({
      source: "shopee",
      days,
      siteOnly,
      siteMarker: SITE_SUBID,
      count: conversions.length,
      ignoredFromOtherChannels: siteOnly ? Math.max(0, totalFromShopee - conversions.length) : 0,
      conversions,
      pageInfo: report.pageInfo || {},
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/conversions]", err.message);
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code || null,
      details: err.payload || null,
    });
  }
});

/**
 * Agrupa conversões por canal (utmContent Sub ID slot 2) e por item.
 * Útil para decidir onde investir tráfego.
 */
app.get("/api/conversions/summary", requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const now = Math.floor(Date.now() / 1000);
    const report = await fetchConversionReport({
      purchaseTimeStart: now - days * 24 * 3600,
      purchaseTimeEnd: now,
      limit: 50,
    });
    let nodes = Array.isArray(report.nodes) ? report.nodes : [];
    const marker = SITE_SUBID.toLowerCase();
    const { listKnownCampaignNames } = require("./supabase");
    const knownCampaigns = await listKnownCampaignNames();
    nodes = nodes.filter((c) => {
      const utm = String(c.utmContent || "").toLowerCase();
      if (utm.includes(marker)) return true;
      const slot1 = utm.split(/[-_|,;/]/)[0]?.replace(/[^a-z0-9]/g, "");
      return slot1 ? knownCampaigns.has(slot1) : false;
    });

    const byChannel = new Map();
    const byItem = new Map();
    for (const c of nodes) {
      const parts = String(c.utmContent || "").split(/[-_|,;/]/).map((s) => s.trim());
      const channel = (parts[1] || "organico").toLowerCase();
      const commission = Number(String(c.totalCommission || "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      const ch = byChannel.get(channel) || { channel, conversions: 0, commission: 0 };
      ch.conversions += 1;
      ch.commission += commission;
      byChannel.set(channel, ch);

      for (const order of c.orders || []) {
        for (const item of order.items || []) {
          const id = String(item.itemId || "");
          if (!id) continue;
          const prev = byItem.get(id) || {
            itemId: id,
            itemName: item.itemName || "",
            qty: 0,
            commission: 0,
          };
          prev.qty += Number(item.qty) || 1;
          prev.commission += Number(item.itemTotalCommission) || 0;
          if (!prev.itemName && item.itemName) prev.itemName = item.itemName;
          byItem.set(id, prev);
        }
      }
    }

    const channels = [...byChannel.values()].sort((a, b) => b.commission - a.commission);
    const topItems = [...byItem.values()].sort((a, b) => b.commission - a.commission).slice(0, 30);
    res.json({
      ok: true,
      days,
      channels,
      topItems,
      conversions: nodes.length,
    });
  } catch (err) {
    console.error("[/api/conversions/summary]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Admin — localiza pedido / SKU / loja no conversionReport. */
app.get("/api/admin/conversions/lookup", requireAdmin, async (req, res) => {
  try {
    const orderId = String(req.query?.orderId || "").trim();
    const conversionId = String(req.query?.conversionId || "").trim();
    const productId = req.query?.productId ? Number(req.query.productId) : null;
    const shopId = req.query?.shopId ? Number(req.query.shopId) : null;
    const productName = String(req.query?.productName || "").trim();
    if (!orderId && !conversionId && !(Number.isFinite(productId) && productId > 0) && !(Number.isFinite(shopId) && shopId > 0) && !productName) {
      return res.status(400).json({ error: "Informe pedido, conversão, produto ou loja" });
    }
    const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 90);
    const now = Math.floor(Date.now() / 1000);
    const report = await fetchConversionReport({
      purchaseTimeStart: now - days * 24 * 3600,
      purchaseTimeEnd: now,
      limit: 50,
      orderId,
      conversionId,
      productId: Number.isFinite(productId) && productId > 0 ? productId : null,
      shopId: Number.isFinite(shopId) && shopId > 0 ? shopId : null,
      productName,
    });
    res.json({
      ok: true,
      days,
      count: (report.nodes || []).length,
      nodes: report.nodes || [],
      pageInfo: report.pageInfo || {},
    });
  } catch (err) {
    console.error("[/api/admin/conversions/lookup]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/**
 * Lê winners do conversionReport e empurra keywords para a fila prioritária do autosync.
 */
app.post("/api/conversions/prioritize", requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.body?.days) || 30, 1), 90);
    const now = Math.floor(Date.now() / 1000);
    const report = await fetchConversionReport({
      purchaseTimeStart: now - days * 24 * 3600,
      purchaseTimeEnd: now,
      orderStatus: "COMPLETED",
      limit: 50,
    });
    let nodes = Array.isArray(report.nodes) ? report.nodes : [];
    const marker = SITE_SUBID.toLowerCase();
    const { listKnownCampaignNames } = require("./supabase");
    const knownCampaigns = await listKnownCampaignNames();
    nodes = nodes.filter((c) => {
      const utm = String(c.utmContent || "").toLowerCase();
      if (utm.includes(marker)) return true;
      const slot1 = utm.split(/[-_|,;/]/)[0]?.replace(/[^a-z0-9]/g, "");
      return slot1 ? knownCampaigns.has(slot1) : false;
    });

    const jobs = [];
    const seen = new Set();
    for (const c of nodes) {
      for (const order of c.orders || []) {
        for (const item of order.items || []) {
          const name = String(item.itemName || "").trim();
          if (!name) continue;
          const cat = categoryForKeyword(name) || "todos";
          // Usa as 4 primeiras palavras do nome como keyword de reforço
          const keyword = name.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
          const key = `${cat}::${keyword}`;
          if (seen.has(key) || keyword.length < 8) continue;
          seen.add(key);
          jobs.push({
            keyword,
            category: cat !== "todos" ? cat : null,
            subcategory: null,
            audience: "feminino",
            source: "conversion",
            gap: 25,
          });
        }
      }
    }

    const result = autosync.prioritizeJobs(jobs.slice(0, 25));
    res.json({
      ok: true,
      days,
      fromConversions: nodes.length,
      jobsQueued: result.added,
      priorityQueueSize: result.queueSize,
      samples: jobs.slice(0, 10),
    });
  } catch (err) {
    console.error("[/api/conversions/prioritize]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Limpa o cache da vitrine e realimenta categorias.
 * Body: { limit?, pages?, clear?, maxItems? }
 * maxItems: para ao atingir N itens únicos (ex.: 2000 para demo).
 */
app.post("/api/reset-vitrine", requireAdmin, async (req, res) => {
  try {
    const result = await refillVitrine({
      clear: req.body?.clear !== false,
      limit: req.body?.limit,
      pages: req.body?.pages,
      maxItems: req.body?.maxItems,
      gapMs: req.body?.gapMs,
    });
    res.json(result);
  } catch (err) {
    console.error("[/api/reset-vitrine]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Atualiza preços/comissão de produtos selecionados preservando category/subcategory/sub_ids. */
app.post("/api/ofertas/refresh", requireAdmin, async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
    const ids = [...new Set(itemIds.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 40);
    if (!ids.length) return res.status(400).json({ error: "itemIds obrigatório" });

    const existing = await getOffersByItemIds(ids, { full: true });
    const byId = new Map((existing || []).map((r) => [Number(r.item_id), r]));

    const details = await fetchProductDetailsByIds(ids);
    const nodes = Array.isArray(details) ? details : [];
    const rows = [];
    for (const n of nodes) {
      const itemId = Number(n.itemId);
      const prev = byId.get(itemId);
      const row = mapOfferToRow(n, prev?.keyword || "", prev?.list_type ?? null, {
        forceCategory: prev?.category && prev.category !== "todos" ? prev.category : null,
        forceSubcategory: prev?.subcategory || null,
      });
      if (prev?.sub_ids?.length) row.sub_ids = prev.sub_ids;
      if (prev?.short_link) row.short_link = prev.short_link;
      if (row.item_id && row.offer_link) rows.push(row);
    }
    if (!rows.length) return res.status(404).json({ error: "Nenhum produto atualizado pela Shopee" });
    // Invariante A: garante sub_ids[0] = SITE_SUBID e short_link antes do upsert.
    const { ensureLinkedRows } = require("./linking");
    const linkResult = await ensureLinkedRows(rows, { regenerate: false });
    const saved = await upsertOfertas(linkResult.rows);
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    res.json({
      ok: true,
      requested: ids.length,
      saved: Array.isArray(saved) ? saved.length : rows.length,
      shortlinks: {
        generated: linkResult.generated,
        pending: linkResult.pending,
        skipped: linkResult.skipped,
      },
    });
  } catch (err) {
    console.error("[/api/ofertas/refresh]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

app.patch("/api/ofertas/:itemId", requireAdmin, async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const body = req.body || {};
    const patch = {};
    if (body.category != null) patch.category = String(body.category);
    if (body.subcategory !== undefined) patch.subcategory = body.subcategory ? String(body.subcategory) : null;
    if (body.hidden != null) patch.hidden = !!body.hidden;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nada para atualizar" });
    const updated = await patchOferta(itemId, patch);
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    res.json({ ok: true, product: Array.isArray(updated) ? updated[0] : updated });
  } catch (err) {
    console.error("[/api/ofertas PATCH]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete("/api/ofertas", requireAdmin, async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
    const removed = await deleteOfertasByIds(itemIds);
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    res.json({ ok: true, removed });
  } catch (err) {
    console.error("[/api/ofertas DELETE]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Preview de duplicados (loja+nome idêntico / mesmo item ou link Shopee). */
app.get("/api/ofertas/duplicates", requireAdmin, async (req, res) => {
  try {
    const max = Math.min(Math.max(Number(req.query.max) || 5000, 100), 10000);
    const report = await scanDuplicates({ max });
    res.json({ ok: true, ...report });
  } catch (err) {
    console.error("[/api/ofertas/duplicates]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Remove duplicados — mantém o melhor de cada grupo (shortlink + score). */
app.post("/api/ofertas/duplicates/remove", requireAdmin, async (req, res) => {
  try {
    const max = Math.min(Math.max(Number(req.body?.max) || 5000, 100), 10000);
    const dryRun = req.body?.dryRun === true;
    const result = await removeDuplicates({ max, dryRun });
    if (!dryRun && result.removed) {
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
    }
    res.json(result);
  } catch (err) {
    console.error("[/api/ofertas/duplicates/remove]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Preview de ofertas fracas (nota/vendas/comissão abaixo do filtro). */
app.get("/api/ofertas/weak", requireAdmin, async (req, res) => {
  try {
    const max = Math.min(Math.max(Number(req.query.max) || 5000, 100), 10000);
    const report = await scanWeakOffers({
      max,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
    });
    res.json({ ok: true, ...report });
  } catch (err) {
    console.error("[/api/ofertas/weak]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Remove ofertas fracas do catálogo legado. */
app.post("/api/ofertas/purge-weak", requireAdmin, async (req, res) => {
  try {
    const max = Math.min(Math.max(Number(req.body?.max) || 5000, 100), 10000);
    const dryRun = !!req.body?.dryRun;
    const result = await purgeWeakOffers({
      max,
      dryRun,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
    });
    if (!dryRun && result.removed) {
      categoriasCache = { at: 0, data: null };
      ofertasCache.clear();
      coverageCache = { at: 0, data: null };
    }
    res.json(result);
  } catch (err) {
    console.error("[/api/ofertas/purge-weak]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Reconsulta top moneyScore na Shopee e atualiza (bypass skipExisting). */
app.post("/api/ofertas/refresh-top", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit) || 40, 10), 80);
    const result = await refreshTopOffers({
      limit,
      minRating: MIN_RATING,
      minSales: MIN_SALES,
      minCommissionPct: req.body?.minCommissionPct != null
        ? Number(req.body.minCommissionPct)
        : DEFAULT_MIN_COMMISSION_PCT,
    });
    categoriasCache = { at: 0, data: null };
    ofertasCache.clear();
    coverageCache = { at: 0, data: null };
    res.json(result);
  } catch (err) {
    console.error("[/api/ofertas/refresh-top]", err.message);
    res.status(err.status || 500).json({ error: err.message, rateLimited: !!err.rateLimited });
  }
});

/**
 * Landing page ultra-leve do produto — abre o "popup" ANTES da vitrine carregar.
 * Usada em links de campanha compartilhados no Facebook/Instagram/WhatsApp.
 *   /p/:itemId?utm_campaign=...&utm_source=...&utm_medium=...
 *
 * Fluxo: HTML < 8KB → imagem+preço+CTA imediato → click sai para shope.ee com Sub IDs.
 * Vitrine completa carrega em segundo plano (defer) para quem fechar o popup.
 */
app.get("/p/:itemId", async (req, res) => {
  const itemId = Number(String(req.params.itemId).replace(/[^\d]/g, ""));
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return res.redirect(302, "/");
  }
  const q = req.query || {};
  const attribution = {
    channel: String(q.utm_source || q.canal || q.source || q.ref || "organico"),
    campaign: String(q.utm_campaign || q.campanha || q.campaign || "vitrine"),
    medium: String(q.utm_medium || q.medium || "social"),
  };

  try {
    let row = await ensureAffiliateOffer(itemId);
    if (!row) {
      const back = new URLSearchParams({
        produto: String(itemId),
        utm_campaign: attribution.campaign,
        utm_source: attribution.channel,
        utm_medium: attribution.medium,
      }).toString();
      return res.redirect(302, `/?${back}`);
    }
    const product = rowToProduct(row);
    const rawOrigin = resolveProductOriginUrl(row);
    const buyFallback = isTrackedAffiliateUrl(row.offer_link)
      ? row.offer_link
      : (isTrackedAffiliateUrl(product.shortLink) ? product.shortLink : "");

    let shortLink = isTrackedAffiliateUrl(product.shortLink) ? product.shortLink : null;
    const channelSlug = sanitizeSubId(attribution.channel, "organico");
    const campaignSlug = sanitizeSubId(attribution.campaign, "vitrine");
    const isDefaultAttribution = channelSlug === "organico" && campaignSlug === "vitrine";
    const useStandalone = !isDefaultAttribution && campaignSlug && campaignSlug !== "vitrine";
    // Gera shortlink com Sub IDs da campanha (ou usa o cacheado quando é orgânico)
    if (rawOrigin && (!shortLink || !isDefaultAttribution)) {
      try {
        const subIds = useStandalone
          ? buildCampaignSubIds(campaignSlug)
          : buildTrackedSubIds(
            product.category,
            itemId,
            product.subcategory,
            attribution
          );
        const generated = await generateShortLink(
          rawOrigin,
          subIds,
          useStandalone ? { preserveExact: true } : {}
        );
        if (generated) {
          shortLink = generated;
          if (isDefaultAttribution) {
            // Só cacheia o link "orgânico" — links de campanha são efêmeros
            updateShortLink(itemId, generated).catch(() => {});
          }
        }
      } catch (linkErr) {
        console.warn("[/p/:itemId] shortlink falhou:", linkErr.message);
      }
    }

    const buyHref = isTrackedAffiliateUrl(shortLink)
      ? shortLink
      : (isTrackedAffiliateUrl(buyFallback) ? buyFallback : (isTrackedAffiliateUrl(row.offer_link) ? row.offer_link : "#"));
    const priceNew = Number(product.newPrice) || 0;
    const priceOld = Number(product.oldPrice) || 0;
    const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");
    const oldPriceHtml = priceOld > priceNew
      ? `<div class="old-price">De: ${brl(priceOld)}</div>` : "";
    const discountHtml = product.discountPct
      ? `<span class="discount-badge">-${product.discountPct}%</span>` : "";
    const shopName = product.shopName ? String(product.shopName).trim() : "";
    const backHref = "/?" + new URLSearchParams({
      utm_campaign: attribution.campaign,
      utm_source: attribution.channel,
      utm_medium: attribution.medium,
    }).toString();

    res.set("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=1800");
    res.send(renderFastPopup({
      product,
      buyHref,
      backHref,
      oldPriceHtml,
      discountHtml,
      shopName,
      priceNewFmt: brl(priceNew),
      attribution,
    }));
  } catch (err) {
    console.error("[/p/:itemId]", err.message);
    return res.redirect(302, "/");
  }
});

function escapeHtmlSSR(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORY_LABELS_SSR = {
  moda: "Moda Feminina",
  beleza: "Beleza",
  acessorios: "Acessórios",
  fitness: "Fitness",
  maternidade: "Mãe & Bebê",
  saude: "Saúde & Bem-estar",
  casa: "Casa",
  celular: "Celular",
  eletronicos: "Eletrônicos",
  pet: "Pet Shop",
  infantil: "Infantil",
  presentes: "Presentes & Papelaria",
  utilidades: "Utilidades",
  automotivo: "Automotivo",
  todos: "Oferta",
};

function categoryLabelSSR(raw) {
  const id = String(raw || "").trim().toLowerCase();
  if (!id || id === "todos") return "Oferta";
  if (CATEGORY_LABELS_SSR[id]) return CATEGORY_LABELS_SSR[id];
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildBenefitItemsSSR(product, shopName) {
  const items = [];
  const disc = Number(product.discountPct) || 0;
  if (disc > 0) items.push(`Oferta com <strong>${disc}% de desconto</strong>`);
  const sales = String(product.sales || "").trim();
  if (sales && sales !== "—") items.push(`Já foram <strong>${escapeHtmlSSR(sales)}</strong>`);
  const opts = product.options;
  if (opts && (opts.hasVariants || (Array.isArray(opts.labels) && opts.labels.length))) {
    items.push("Cores e tamanhos disponíveis na Shopee");
  } else if (product.oldPrice && product.newPrice && product.oldPrice > product.newPrice * 1.02) {
    items.push("Variações disponíveis na página do produto");
  }
  if (shopName) items.push(`Vendido por <strong>${escapeHtmlSSR(shopName)}</strong>`);
  items.push("Frete e prazo confirmados na Shopee");
  return items;
}

function pixelProductJsonSSR(product) {
  const value = Number(product.newPrice);
  const payload = {
    content_ids: [String(product.id || "")],
    content_name: String(product.title || "").slice(0, 150),
    content_type: "product",
    content_category: String(product.category || ""),
    currency: "BRL",
  };
  if (Number.isFinite(value) && value > 0) payload.value = value;
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

function renderFastPopup({ product, buyHref, backHref, oldPriceHtml, discountHtml, shopName, priceNewFmt }) {
  const title = escapeHtmlSSR(product.title || "Oferta Shopee");
  const image = escapeHtmlSSR(product.image || "");
  const category = escapeHtmlSSR(categoryLabelSSR(product.category));
  const rating = Number(product.stars);
  const ratingTxt = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "";
  const salesTxt = escapeHtmlSSR(product.sales || "");
  const benefits = buildBenefitItemsSSR(product, shopName);
  const benefitsHtml = benefits.map((t) =>
    `<li><span class="check" aria-hidden="true">✓</span><span>${t}</span></li>`
  ).join("");
  const pixelPayload = pixelProductJsonSSR(product);
  const backHrefSafe = escapeHtmlSSR(backHref);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ee4d2d">
<meta name="robots" content="noindex,follow">
<title>${title} — Afiliada Mestre</title>
<meta property="og:title" content="${title}">
<meta property="og:image" content="${image}">
<meta property="og:type" content="product">
<link rel="preconnect" href="https://connect.facebook.net">
<link rel="preconnect" href="https://www.facebook.com">
<link rel="preconnect" href="https://shope.ee">
<link rel="preconnect" href="https://s.shopee.com.br">
<link rel="preconnect" href="https://cf.shopee.com.br">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://shopee.com.br">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
${image ? `<link rel="preload" as="image" href="${image}">` : ""}
<script>
(function(){
  var PIXEL_ID = '2217009299032183';
  try {
    if (window.self !== window.top && window.top.location.hostname === location.hostname) return;
  } catch (e) {}
  var payload = ${pixelPayload};
  var checkoutPayload = Object.assign({ num_items: 1 }, payload);
  var sentIC = false;
  function eid(prefix){
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);
  fbq('set', 'autoConfig', false, PIXEL_ID);
  fbq('track', 'PageView', {}, { eventID: eid('pv') });

  function trackCheckout(){
    if (sentIC || typeof fbq !== 'function') return;
    sentIC = true;
    fbq('track', 'InitiateCheckout', checkoutPayload, { eventID: eid('ic') });
  }
  window.__amPixelCheckout = trackCheckout;
})();
</script>
<noscript>
<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=2217009299032183&ev=PageView&noscript=1" alt="" />
</noscript>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--orange:#ee4d2d;--orange-hover:#d33b1c;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f1f5f9;--safe-b:env(safe-area-inset-bottom,0px);--safe-t:env(safe-area-inset-top,0px)}
html,body{min-height:100%;min-height:100dvh;font-family:Nunito,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{background:var(--bg);overflow:hidden}
.store-bg{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:0;background:var(--bg)}
.overlay{position:fixed;inset:0;z-index:10;display:flex;align-items:stretch;justify-content:center;padding:0;background:rgba(15,23,42,.5);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);overflow:hidden}
.card{position:relative;display:flex;flex-direction:column;width:100%;height:100%;height:100dvh;max-height:100dvh;background:#fff;overflow:hidden;z-index:11;animation:rise .22s ease-out}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.head{flex-shrink:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;padding-top:max(10px,var(--safe-t));border-bottom:1px solid var(--line);background:#fff}
.brand{display:flex;align-items:center;gap:8px;min-width:0}
.brand img{height:28px;width:auto;display:block}
.brand span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.close{flex-shrink:0;background:#f1f5f9;border:0;color:#475569;width:36px;height:36px;border-radius:999px;cursor:pointer;font-size:22px;line-height:1;text-decoration:none;display:flex;align-items:center;justify-content:center}
.close:active{background:#e2e8f0}
.scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.img-wrap{position:relative;width:100%;aspect-ratio:1;max-height:min(42dvh,340px);background:linear-gradient(135deg,#fff7f5,#f8fafc);overflow:hidden}
.img-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.discount-badge{position:absolute;top:12px;right:12px;background:var(--orange);color:#fff;padding:6px 10px;border-radius:8px;font-weight:800;font-size:12px;letter-spacing:.02em;box-shadow:0 4px 14px rgba(238,77,45,.35)}
.body{padding:16px 16px 8px}
.cat{display:inline-block;background:#fff4ec;color:var(--orange);font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 9px;border-radius:6px;margin-bottom:10px;letter-spacing:.05em}
h1{font-size:clamp(15px,4.2vw,17px);line-height:1.35;margin-bottom:8px;font-weight:800;color:var(--ink);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;word-break:break-word}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:12px;font-size:12px;color:var(--muted)}
.meta .rating{color:#b45309;font-weight:800}
.meta .dot{color:#cbd5e1}
.price-box{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;background:#fff7f5;border:1px solid #ffe0d2;border-radius:12px;padding:12px 14px;margin-bottom:14px}
.price-box .labels{min-width:0}
.old-price{font-size:12px;color:#94a3b8;text-decoration:line-through;margin-bottom:2px}
.new-price{font-size:clamp(26px,7vw,32px);font-weight:800;color:var(--orange);line-height:1;letter-spacing:-.02em}
.benefits{list-style:none;display:grid;gap:8px;margin-bottom:4px}
.benefits li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.45;color:#475569}
.benefits .check{flex-shrink:0;width:18px;height:18px;border-radius:999px;background:#ecfdf5;color:#059669;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;margin-top:1px}
.cta-bar{flex-shrink:0;padding:10px 14px;padding-bottom:max(10px,calc(var(--safe-b) + 8px));background:#fff;border-top:1px solid var(--line);box-shadow:0 -8px 24px rgba(15,23,42,.06)}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;background:var(--orange);color:#fff;text-align:center;padding:12px 16px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:.02em;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cta:hover{background:var(--orange-hover)}
.cta:active{transform:translateY(1px)}
.more{display:block;width:100%;margin-top:8px;padding:8px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none}
.more:hover{color:var(--orange)}
.foot{padding:4px 16px 12px;font-size:10px;color:#94a3b8;text-align:center;line-height:1.45}
@media (min-width:560px){
  .overlay{align-items:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .card{height:auto;max-height:min(92dvh,780px);max-width:440px;border-radius:18px;border:1px solid var(--line);box-shadow:0 24px 64px rgba(15,23,42,.35);animation-name:pop}
  @keyframes pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
  .head{padding-top:12px;border-radius:18px 18px 0 0}
  .img-wrap{max-height:360px}
}
@media (max-height:640px){
  .img-wrap{max-height:34dvh}
  .body{padding:12px 14px 6px}
  .price-box{padding:10px 12px;margin-bottom:10px}
  .new-price{font-size:24px}
}
@media (prefers-reduced-motion:reduce){
  .card{animation:none}
}
</style>
</head>
<body>
<iframe class="store-bg" src="${backHrefSafe}" title="Vitrine Afiliada Mestre" loading="eager" referrerpolicy="no-referrer"></iframe>
<div class="overlay" id="overlay" role="dialog" aria-modal="true" aria-labelledby="p-title">
  <main class="card" role="main">
    <header class="head">
      <div class="brand">
        <img src="/uploads/logo.png" alt="Afiliada Mestre" width="112" height="28">
        <span>Oferta selecionada</span>
      </div>
      <a class="close" href="${backHrefSafe}" id="btn-close" aria-label="Fechar">&times;</a>
    </header>
    <div class="scroll">
      <div class="img-wrap">
        ${image ? `<img src="${image}" alt="${title}" fetchpriority="high" decoding="async">` : ""}
        ${discountHtml}
      </div>
      <div class="body">
        ${category ? `<div class="cat">${category}</div>` : ""}
        <h1 id="p-title">${title}</h1>
        <div class="meta">
          ${ratingTxt ? `<span class="rating">★ ${ratingTxt}</span>` : ""}
          ${ratingTxt && salesTxt ? `<span class="dot">·</span>` : ""}
          ${salesTxt ? `<span>${salesTxt}</span>` : ""}
        </div>
        <div class="price-box">
          <div class="labels">
            ${oldPriceHtml}
            <div class="new-price">${priceNewFmt}</div>
          </div>
        </div>
        <ul class="benefits">${benefitsHtml}</ul>
      </div>
      <p class="foot">Nenhum pagamento neste site. A compra é finalizada com segurança na Shopee.</p>
    </div>
    <div class="cta-bar">
      <a class="cta" id="btn-buy" href="${escapeHtmlSSR(buyHref)}" target="_blank" rel="nofollow sponsored noopener">Ver na Shopee</a>
      <a class="more" id="btn-more" href="${backHrefSafe}">Ver mais ofertas</a>
    </div>
  </main>
</div>
<script>
(function(){
  var backHref = ${JSON.stringify(backHref)};
  var buyHref = ${JSON.stringify(buyHref)};
  function goVitrine(){
    if (backHref) location.href = backHref;
  }
  function inAppBrowser(){
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|Bytedance|Twitter/i.test(navigator.userAgent || '');
  }
  var btnBuy = document.getElementById('btn-buy');
  var btnClose = document.getElementById('btn-close');
  var btnMore  = document.getElementById('btn-more');
  var overlay  = document.getElementById('overlay');
  if (btnBuy) btnBuy.addEventListener('click', function(e){
    var href = btnBuy.getAttribute('href') || buyHref;
    if (!href || href === '#') {
      e.preventDefault();
      return;
    }
    try { if (typeof window.__amPixelCheckout === 'function') window.__amPixelCheckout(); } catch (_) {}
    if (inAppBrowser()) {
      e.preventDefault();
      setTimeout(function(){ location.href = href; }, 180);
    }
  }, true);
  if (btnClose) btnClose.addEventListener('click', function(e){
    e.preventDefault();
    goVitrine();
  });
  if (btnMore) btnMore.addEventListener('click', function(e){
    e.preventDefault();
    goVitrine();
  });
  if (overlay) overlay.addEventListener('click', function(e){
    if (e.target === overlay) goVitrine();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') goVitrine();
  });
})();
</script>
<!-- Cloudflare Web Analytics: depois do Pixel; só conta visita -->
<script>
(function(){
  function loadCf(){
    if (document.querySelector('script[data-cf-beacon]')) return;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "6006928dd14c407285f05f287c812513"}');
    document.body.appendChild(s);
  }
  if (document.readyState === 'complete') loadCf();
  else window.addEventListener('load', loadCf, { once: true });
})();
</script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

// Canonical: path antigo do HTML → URL limpa (antes do static)
app.get("/uploads/painel_e_vitrine_afiliado_mestre.html", (req, res) => {
  const qs = new URLSearchParams(req.query);
  if (qs.has("admin") || qs.get("mode") === "admin") {
    qs.delete("admin");
    qs.delete("mode");
    const rest = qs.toString();
    return res.redirect(301, `/admin${rest ? `?${rest}` : ""}`);
  }
  const rest = qs.toString();
  return res.redirect(301, `/${rest ? `?${rest}` : ""}`);
});

app.use("/uploads", express.static(path.join(ROOT, "uploads"), {
  maxAge: "7d",
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=120, stale-while-revalidate=600");
    } else if (/\.(js|css)$/i.test(filePath)) {
      // Referências no HTML têm ?v=<mtime>, então uma nova versão do arquivo
      // gera uma URL diferente — podemos marcar immutable com segurança.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i.test(filePath)) {
      // Bytes com baixa taxa de mudança (logos, fonte de ícones). 30 dias com
      // stale-while-revalidate deixa revisitas praticamente instantâneas.
      res.setHeader("Cache-Control", "public, max-age=2592000, stale-while-revalidate=2592000");
    }
  },
}));
app.use(express.static(ROOT, { index: false, maxAge: "1d" }));

const APP_PAGE_RE = /^\/(categoria(\/[^/]+){0,2}|relampago|mais-vendidos|maiores-descontos|melhor-avaliados|lojas-oficiais|admin(\/[\w-]+)?)\/?$/;

app.get(["/", "/admin", "/admin/:view", "/categoria", "/categoria/:cat", "/categoria/:cat/:sub",
  "/relampago", "/mais-vendidos", "/maiores-descontos", "/melhor-avaliados", "/lojas-oficiais"], sendVitrine);

// SPA fallback: paths de app conhecidos (sem /api)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (APP_PAGE_RE.test(req.path)) return sendVitrine(req, res);
  if (req.accepts("html") && !path.extname(req.path)) return sendVitrine(req, res);
  return res.status(404).json({ error: "Não encontrado" });
});

if (require.main === module) {
  // 0.0.0.0 é obrigatório no Railway/Docker — sem isso o healthcheck não alcança o app.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Afiliado Mestre rodando em http://0.0.0.0:${PORT}`);
    console.log(`Vitrine: http://localhost:${PORT}/`);
    console.log(`Admin:   http://localhost:${PORT}/admin`);
    console.log(`Health:  http://localhost:${PORT}/api/health`);
    autosync.start();
  });
}

module.exports = app;

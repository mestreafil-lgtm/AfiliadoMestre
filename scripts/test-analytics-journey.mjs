/**
 * E2E V1: jornada vitrine → busca confirmada → abrir → 5s → fechar → abrir → Ver na Shopee.
 * No Supabase (amEventTrack) esperamos só ProductOpen / ProductClose.
 * PageView, Search e InitiateCheckout vão só ao Meta (amPixelTrack / snippet).
 *
 * Uso: node scripts/test-analytics-journey.mjs
 * Requer: servidor em localhost:3789, .env com Supabase, playwright (npx instala sob demanda).
 */
import crypto from "crypto";
import { config } from "dotenv";
import { createRequire } from "module";

config();
const require = createRequire(import.meta.url);
const { supabaseRequest } = require("../server/supabase.js");

const BASE = process.env.ANALYTICS_TEST_BASE || "http://localhost:3789";
const SESSION_ID = crypto.randomUUID();
const SEARCH_TERM = "calça";
// V1: só custom events no Supabase (ProductOpen / ProductClose).
const EXPECTED = [
  "ProductOpen",
  "ProductClose",
  "ProductOpen",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchEvents(sessionId) {
  const rows = await supabaseRequest(
    `/analytics_events?session_id=eq.${sessionId}&select=event_name,created_at,duration_ms,search_term,product_id,source&order=created_at.asc`,
    { method: "GET", useService: true }
  );
  return Array.isArray(rows) ? rows : [];
}

async function runBrowserJourney() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    const { execSync } = await import("child_process");
    console.log("[e2e] Instalando playwright…");
    execSync("npm install --no-save playwright@1.49.1", { stdio: "inherit" });
    ({ chromium } = await import("playwright"));
    execSync("npx playwright install chromium", { stdio: "inherit" });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((sid) => {
    sessionStorage.setItem(
      "am_session_v1",
      JSON.stringify({ id: sid, last: Date.now() })
    );
  }, SESSION_ID);

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));

  console.log(`[e2e] session_id=${SESSION_ID}`);
  console.log(`[e2e] Abrindo ${BASE}/`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });

  const search = page.locator("#store-search-input");
  await search.waitFor({ state: "visible", timeout: 15000 });
  await search.fill(SEARCH_TERM);
  // V1: Search só na confirmação (Enter / Buscar).
  await search.press("Enter");
  console.log(`[e2e] Busca confirmada "${SEARCH_TERM}"…`);
  await sleep(900);

  const card = page.locator("#store-grid-section [onclick*='openProductModal']").first();
  await card.waitFor({ state: "visible", timeout: 20000 });
  await card.click();
  console.log("[e2e] Produto aberto (1ª vez)");
  await page.locator("#product-modal.flex").waitFor({ state: "visible", timeout: 10000 });

  console.log("[e2e] Aguardando 5 segundos…");
  await sleep(5000);

  await page.locator("#product-modal button[aria-label='Fechar']").click();
  await page.locator("#product-modal.hidden").waitFor({ state: "attached", timeout: 5000 });
  console.log("[e2e] Modal fechado");

  await card.click();
  console.log("[e2e] Produto aberto (2ª vez)");
  await page.locator("#product-modal.flex").waitFor({ state: "visible", timeout: 10000 });

  await page.evaluate(() => {
    window.open = () => ({ location: { href: "" }, closed: false, close() {} });
  });
  await page.locator("#modal-buy-btn").click();
  console.log("[e2e] Clique em Ver na Shopee (InitiateCheckout só no Meta)");

  await sleep(1500);
  await browser.close();

  if (errors.length) {
    console.warn("[e2e] Erros JS na página:", errors.slice(0, 3).join(" | "));
  }
}

function validateRows(rows) {
  const names = rows.map((r) => r.event_name);
  const issues = [];

  const forbidden = ["SiteView", "SearchProduct", "ClickShopee"];
  for (const f of forbidden) {
    if (names.includes(f)) issues.push(`evento paralelo indesejado na V1: ${f}`);
  }

  if (names.length !== EXPECTED.length) {
    issues.push(`quantidade: esperado ${EXPECTED.length}, recebido ${names.length} (${names.join(" → ")})`);
  }
  for (let i = 0; i < EXPECTED.length; i++) {
    if (names[i] !== EXPECTED[i]) {
      issues.push(`posição ${i + 1}: esperado ${EXPECTED[i]}, recebido ${names[i] ?? "(ausente)"}`);
    }
  }

  const counts = {};
  for (const n of names) counts[n] = (counts[n] || 0) + 1;
  const expectedCounts = {
    ProductOpen: 2,
    ProductClose: 1,
  };
  for (const [evt, max] of Object.entries(expectedCounts)) {
    if ((counts[evt] || 0) > max) {
      issues.push(`duplicidade: ${evt} disparou ${counts[evt]}x (máx ${max})`);
    }
  }

  const closeRow = rows.find((r) => r.event_name === "ProductClose");
  if (closeRow && Number(closeRow.duration_ms) < 4000) {
    issues.push(`ProductClose duration_ms=${closeRow.duration_ms} (esperado ≥ 4000 após espera de 5s)`);
  }

  return { ok: issues.length === 0, issues, names, rows };
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.supabaseConfigured) {
    console.error("[e2e] Servidor ou Supabase indisponível em", BASE);
    process.exit(1);
  }

  await runBrowserJourney();
  await sleep(800);

  const rows = await fetchEvents(SESSION_ID);
  const result = validateRows(rows);

  console.log("\n[e2e] Eventos no Supabase (V1 custom):");
  for (const r of rows) {
    const extra = [
      r.search_term ? `term=${r.search_term}` : "",
      r.product_id ? `product=${r.product_id}` : "",
      r.duration_ms != null ? `duration=${r.duration_ms}ms` : "",
      r.source ? `source=${r.source}` : "",
    ].filter(Boolean).join(" ");
    console.log(`  - ${r.event_name}${extra ? ` (${extra})` : ""}`);
  }

  if (!result.ok) {
    console.error("\n[e2e] FALHOU:");
    for (const i of result.issues) console.error("  •", i);
    process.exit(1);
  }

  console.log("\n[e2e] OK — ProductOpen/ProductClose e session_id validados (V1).");
  console.log(`[e2e] session_id=${SESSION_ID}`);
}

main().catch((err) => {
  console.error("[e2e] Erro:", err.message);
  process.exit(1);
});

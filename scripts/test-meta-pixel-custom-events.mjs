/**
 * Valida que fbq('trackCustom', ...) dispara os 5 eventos na jornada real.
 * Intercepta chamadas fbq + requests para facebook.com/tr.
 *
 * Uso: node scripts/test-meta-pixel-custom-events.mjs
 */
import { config } from "dotenv";
import { createRequire } from "module";

config();
const require = createRequire(import.meta.url);

const BASE = process.env.ANALYTICS_TEST_BASE || "http://localhost:3789";
const SEARCH_TERM = "calça";
const CUSTOM = ["SiteView", "SearchProduct", "ProductOpen", "ProductClose", "ClickShopee"];
const STANDARD = ["PageView", "Search", "ViewContent", "InitiateCheckout"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const { execSync } = await import("child_process");
    execSync("npm install --no-save playwright@1.49.1", { stdio: "inherit" });
    execSync("npx playwright install chromium", { stdio: "inherit" });
    return import("playwright");
  }
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health) {
    console.error("[meta] Servidor offline em", BASE);
    process.exit(1);
  }

  const { chromium } = await getPlaywright();
  const fbqCalls = [];
  const metaRequests = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addInitScript(() => {
    window.__fbqLog = [];
    const wait = setInterval(() => {
      if (typeof window.fbq !== "function") return;
      clearInterval(wait);
      const orig = window.fbq;
      function wrapped() {
        const args = Array.from(arguments);
        window.__fbqLog.push(args.map(String));
        return orig.apply(this, arguments);
      }
      Object.assign(wrapped, orig);
      wrapped.queue = orig.queue;
      wrapped.loaded = orig.loaded;
      window.fbq = wrapped;
    }, 10);
  });

  const page = await context.newPage();
  page.on("request", (req) => {
    const u = req.url();
    if (/facebook\.com\/tr\?|connect\.facebook\.net/i.test(u)) {
      metaRequests.push(u);
    }
  });

  console.log(`[meta] Jornada em ${BASE}/`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });

  await page.locator("#store-search-input").fill(SEARCH_TERM);
  await sleep(700);

  const card = page.locator("#store-grid-section [onclick*='openProductModal']").first();
  await card.click();
  await page.locator("#product-modal.flex").waitFor({ state: "visible", timeout: 15000 });
  await sleep(5000);
  await page.locator("#product-modal button[aria-label='Fechar']").click();
  await sleep(400);
  await card.click();
  await page.locator("#product-modal.flex").waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => { window.open = () => ({ closed: false, close() {} }); });
  await page.locator("#modal-buy-btn").click();
  await sleep(2000);

  const logged = await page.evaluate(() => window.__fbqLog || []);
  await browser.close();

  for (const row of logged) {
    const method = row[0];
    if (method === "trackCustom") {
      fbqCalls.push({ type: "custom", event: row[1], raw: row.join(" | ") });
    } else if (method === "track") {
      fbqCalls.push({ type: "standard", event: row[1], raw: row.join(" | ") });
    }
  }

  const customSeen = [
    { name: "SiteView", count: fbqCalls.filter((c) => c.type === "custom" && c.event === "SiteView").length, expected: 1 },
    { name: "SearchProduct", count: fbqCalls.filter((c) => c.type === "custom" && c.event === "SearchProduct").length, expected: 1 },
    { name: "ProductOpen", count: fbqCalls.filter((c) => c.type === "custom" && c.event === "ProductOpen").length, expected: 2 },
    { name: "ProductClose", count: fbqCalls.filter((c) => c.type === "custom" && c.event === "ProductClose").length, expected: 1 },
    { name: "ClickShopee", count: fbqCalls.filter((c) => c.type === "custom" && c.event === "ClickShopee").length, expected: 1 },
  ];

  const standardSeen = STANDARD.map((name) => ({
    name,
    count: fbqCalls.filter((c) => c.type === "standard" && c.event === name).length,
  }));

  console.log("\n[meta] fbq('trackCustom') capturados:");
  for (const { name, count, expected } of customSeen) {
    const ok = count === expected;
    console.log(`  ${ok ? "✓" : "✗"} ${name}: ${count}x (esperado ${expected}x)`);
  }

  console.log("\n[meta] fbq('track') padrão (referência):");
  for (const { name, count } of standardSeen) {
    console.log(`  · ${name}: ${count}x`);
  }

  console.log(`\n[meta] Requests para Meta: ${metaRequests.length}`);
  if (metaRequests.length > 0) {
    console.log("  (pixel enviou tráfego para facebook.com/connect.facebook.net)");
  }

  const bad = customSeen.filter((x) => x.count !== x.expected);

  if (bad.length || metaRequests.length === 0) {
    console.error("\n[meta] FALHOU — revise antes do Test Events manual.");
    if (bad.length) console.error("  Fora do esperado:", bad.map((m) => `${m.name}(${m.count}x≠${m.expected}x)`).join(", "));
    if (metaRequests.length === 0) console.error("  Nenhum request chegou ao Meta.");
    process.exit(1);
  }

  console.log("\n[meta] OK — 5 custom events via fbq, requests Meta confirmados.");
  console.log("\nPróximo passo manual:");
  console.log("  1. Meta Events Manager → Pixel 2217009299032183 → Test Events");
  console.log("  2. Abra https://www.afiliadamestre.com/ (ou localhost:3789) no MESMO navegador logado no Meta");
  console.log("  3. Repita: entrar → buscar → abrir → 5s → fechar → abrir → Ver na Shopee");
  console.log("  4. Confirme os 5 custom events + PageView/Search/ViewContent/InitiateCheckout em tempo real");
}

main().catch((e) => {
  console.error("[meta] Erro:", e.message);
  process.exit(1);
});

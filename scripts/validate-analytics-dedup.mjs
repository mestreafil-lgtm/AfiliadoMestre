/**
 * Validação estática V1: PageView · ProductOpen · ProductClose · Search · InitiateCheckout
 * Uma ação lógica = um evento. Sem paralelos SiteView/ViewContent/ClickShopee/SearchProduct.
 * Uso: node scripts/validate-analytics-dedup.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "../uploads/storefront.js"), "utf8");

const checks = [
  {
    name: "SiteView removido",
    pass: !src.includes('amEventTrack("SiteView"') && !src.includes("SiteView"),
    detail: "nenhum SiteView no storefront",
  },
  {
    name: "ViewContent removido",
    pass: !src.includes('amPixelTrack("ViewContent"') && !src.includes('"ViewContent"'),
    detail: "nenhum ViewContent",
  },
  {
    name: "ClickShopee removido",
    pass: !src.includes("ClickShopee") && !src.includes("trackClickShopee"),
    detail: "nenhum ClickShopee",
  },
  {
    name: "SearchProduct removido",
    pass: !src.includes('amEventTrack("SearchProduct"') && !src.includes("SearchProduct"),
    detail: "nenhum SearchProduct",
  },
  {
    name: "PageView: 1ª carga só memoriza path",
    pass: src.includes("if (lastPixelPagePath === null)")
      && src.includes("lastPixelPagePath = path")
      && src.includes('amPixelTrack("PageView")'),
    detail: "snippet HTML = 1ª PageView; SPA = amPixelPageView",
  },
  {
    name: "Search só em busca confirmada (immediate)",
    pass: src.includes("immediate && term !== lastPixelSearch")
      && (src.match(/amPixelTrack\("Search"/g) || []).length === 1,
    detail: "Search 1x; lastPixelSearch; não no debounce de digitação",
  },
  {
    name: "ProductOpen só via openProductModal (1 call + dedupe)",
    pass: (src.match(/amEventTrack\("ProductOpen"/g) || []).length === 1
      && src.includes("sameOpen"),
    detail: "dedupe se mesmo produto já aberto",
  },
  {
    name: "ProductClose só via closeProductModal",
    pass: (src.match(/amEventTrack\("ProductClose"/g) || []).length === 1
      && src.includes("productModalOpenedFor = null"),
    detail: "1 call; limpa estado após close",
  },
  {
    name: "InitiateCheckout único ponto por fluxo",
    pass: src.includes("amPixelCheckout")
      && src.includes("trackCheckout: false")
      && !src.includes("ClickShopee"),
    detail: "handleBuyClick dispara 1x; openAffiliateInNewTab com trackCheckout false no modal",
  },
  {
    name: "Meta trackCustom preservado para ProductOpen/Close",
    pass: src.includes('fbq("trackCustom", eventName, payload)'),
    detail: "amEventTrack ainda envia custom + Supabase",
  },
];

let failed = 0;
console.log("Validação V1 tracking:\n");
for (const c of checks) {
  const mark = c.pass ? "✓" : "✗";
  console.log(`  ${mark} ${c.name} — ${c.detail}`);
  if (!c.pass) failed++;
}

if (failed) {
  console.error(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTodas as verificações V1 passaram.");

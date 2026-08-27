/**
 * Validação estática: cada ação gera no máximo 1 evento customizado.
 * Uso: node scripts/validate-analytics-dedup.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "../uploads/storefront.js"), "utf8");

const checks = [
  {
    name: "SiteView só via amPixelPageView",
    pass: (src.match(/amEventTrack\("SiteView"/g) || []).length === 1,
    detail: "1 chamada amEventTrack('SiteView')",
  },
  {
    name: "SiteView dedupe por path (early return)",
    pass: src.includes("if (path === lastPixelPagePath) return") && src.includes("const isFirst = lastPixelPagePath === null"),
    detail: "lastPixelPagePath impede PageView/SiteView repetido no mesmo path",
  },
  {
    name: "SearchProduct dedupe por termo",
    pass: src.includes("lastPixelSearch") && src.includes('term !== lastPixelSearch'),
    detail: "lastPixelSearch + debounce 400ms",
  },
  {
    name: "SearchProduct só via searchStoreProducts debounce",
    pass: (src.match(/amEventTrack\("SearchProduct"/g) || []).length === 1,
    detail: "1 chamada amEventTrack('SearchProduct')",
  },
  {
    name: "ProductOpen só via openProductModal",
    pass: (src.match(/amEventTrack\("ProductOpen"/g) || []).length === 1,
    detail: "1 chamada amEventTrack('ProductOpen')",
  },
  {
    name: "ProductClose só via closeProductModal",
    pass: (src.match(/amEventTrack\("ProductClose"/g) || []).length === 1,
    detail: "1 chamada amEventTrack('ProductClose')",
  },
  {
    name: "ClickShopee só via trackClickShopee",
    pass: (src.match(/amEventTrack\("ClickShopee"/g) || []).length === 1
      && (src.match(/trackClickShopee\(/g) || []).length === 3,
    detail: "helper único; chamado em handleBuyClick e buyFromCard",
  },
  {
    name: "Meta trackCustom preservado em amEventTrack",
    pass: src.includes('fbq("trackCustom", eventName, payload)'),
    detail: "dispatcher duplo Meta + Supabase",
  },
  {
    name: "Eventos padrão Meta separados (amPixelTrack)",
    pass: src.includes('amPixelTrack("PageView")')
      && src.includes('amPixelTrack("Search"')
      && src.includes('amPixelTrack("ViewContent"')
      && src.includes('amPixelTrack("InitiateCheckout"'),
    detail: "PageView, Search, ViewContent, InitiateCheckout intactos",
  },
  {
    name: "ClickShopee não dispara InitiateCheckout (camadas distintas)",
    pass: src.includes("trackClickShopee") && src.includes("amPixelCheckout")
      && !src.includes('amEventTrack("InitiateCheckout"'),
    detail: "ClickShopee = custom; InitiateCheckout = amPixelTrack separado",
  },
];

let failed = 0;
console.log("Validação dedupe analytics:\n");
for (const c of checks) {
  const mark = c.pass ? "✓" : "✗";
  console.log(`  ${mark} ${c.name} — ${c.detail}`);
  if (!c.pass) failed++;
}

if (failed) {
  console.error(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTodas as verificações passaram.");

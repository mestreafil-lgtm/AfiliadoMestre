import fs from "fs";
const h = fs.readFileSync("uploads/painel_e_vitrine_afiliado_mestre.html", "utf8");
const ids = [
  "admin-panel-root", "admin-login-screen", "nav-dashboard",
  "admin-view-dashboard", "admin-view-vitrine-preview", "admin-view-catalogo",
  "admin-view-produtos", "admin-view-duplicados", "admin-view-campanhas",
  "admin-view-campanha-desempenho", "admin-view-desempenho", "admin-view-meu-site",
  "admin-view-ferramentas", "admin-keyword", "admin-list-type", "conversion-confirmed",
  "conversion-prev", "ms-net", "console-products-list", "vitrine-preview-iframe",
  "catalog-tabs", "product-modal", "store-products-grid", "btn-load-full-catalog",
  "official-offers-box", "feed-result", "dash-conversion-total", "shortlink-status-bar",
];
const missing = ids.filter((id) => !h.includes(`id="${id}"`));
const grid = h.indexOf('id="store-products-grid"');
const admin = h.indexOf("<!-- ADMIN PANEL");
const login = h.indexOf('id="admin-login-screen"');
const panel = h.indexOf('id="admin-panel-root"');
const popup = h.indexOf("<!-- POPUP DE DETALHES");
console.log({
  missing,
  scFor: /sc-for|sc-if/.test(h),
  mustache: /\{\{/.test(h),
  supportJs: h.includes("support.js"),
  loginBeforePanel: login > 0 && login < panel,
  storefrontBeforeAdmin: grid > 0 && grid < admin,
  popupAfterAdmin: popup > panel,
  scripts: h.includes("storefront.min.js"),
  logoCount: (h.match(/\/uploads\/logo\.webp/g) || []).length,
  adminMinExists: fs.existsSync("uploads/admin.min.js"),
});
if (missing.length || /sc-for|sc-if/.test(h) || login > panel) process.exit(1);

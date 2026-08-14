/**
 * Injeta o visual de Novapaginaadmin no HTML real, sem o runtime dc/mock.
 * Preserva a vitrine: só substitui o bloco entre os comentários ADMIN PANEL e POPUP.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dcPath = path.join(root, "Novapaginaadmin", "Admin Afiliada Mestre.dc.html");
const htmlPath = path.join(root, "uploads", "painel_e_vitrine_afiliado_mestre.html");

const LOGO = `<picture>
        <source srcset="/uploads/logo.webp" type="image/webp">
        <img src="/uploads/logo.png" alt="Afiliada Mestre" width="160" height="76" style="height:40px;width:auto;max-width:140px;object-fit:contain" decoding="async">
      </picture>`;

const LOGO_LOGIN = `<picture>
          <source srcset="/uploads/logo.webp" type="image/webp">
          <img src="/uploads/logo.png" alt="Afiliada Mestre" width="220" height="104" style="height:52px;width:auto;margin:0 auto 10px;object-fit:contain" decoding="async">
        </picture>`;

function stripDcTags(html) {
  const re = (tag) => new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  for (const tag of ["sc-for", "sc-if"]) {
    let prev;
    do {
      prev = html;
      html = html.replace(re(tag), "");
    } while (html !== prev);
  }
  html = html.replace(/<\/?sc-for\b[^>]*>/gi, "");
  html = html.replace(/<\/?sc-if\b[^>]*>/gi, "");
  html = html.replace(/\s*onClick="\{\{[^}]+\}\}"/gi, "");
  html = html.replace(/\{\{[^}]*\}\}/g, "");
  html = html.replace(/class="(tab|chip)\s+"/g, 'class="$1"');
  return html;
}

function setIdText(html, id, text) {
  const re = new RegExp(`(id="${id}"[^>]*>)[\\s\\S]*?<`);
  return html.replace(re, `$1${text}<`);
}

let dc = fs.readFileSync(dcPath, "utf8");
const styleMatch = dc.match(/<style>([\s\S]*?)<\/style>/);
let adminCss = styleMatch ? styleMatch[1] : "";
adminCss = adminCss
  .replace(/\*\{box-sizing:border-box\}/, "#admin-panel-root *,#admin-login-screen *{box-sizing:border-box}")
  .replace(/html,body\{[^}]+\}/, "#admin-panel-root,#admin-login-screen{color:#0f172a;-webkit-font-smoothing:antialiased}")
  .replace(/a\{color:#ea580c;text-decoration:none\}/, "#admin-panel-root a,#admin-login-screen a{color:#ea580c;text-decoration:none}")
  .replace(/a:hover\{color:#c2410c\}/, "#admin-panel-root a:hover,#admin-login-screen a:hover{color:#c2410c}")
  .replace(/input,select,textarea\{font-family:inherit\}/, "#admin-panel-root input,#admin-panel-root select,#admin-panel-root textarea,#admin-login-screen input{font-family:inherit}")
  .replace(
    /input:focus,select:focus,textarea:focus\{[^}]+\}/,
    "#admin-panel-root input:focus,#admin-panel-root select:focus,#admin-panel-root textarea:focus,#admin-login-screen input:focus{outline:2px solid #ee4d2d;outline-offset:0;border-color:#ee4d2d !important}"
  )
  .replace(/::-webkit-scrollbar\{[^}]+\}/g, "")
  .replace(/::-webkit-scrollbar-thumb\{[^}]+\}/g, "")
  .replace(/::-webkit-scrollbar-thumb:hover\{[^}]+\}/g, "")
  .replace(/::-webkit-scrollbar-track\{[^}]+\}/g, "");

const start = dc.indexOf('<div style="display:flex;min-height:100vh');
const end = dc.indexOf("</x-dc>");
if (start < 0 || end < 0) throw new Error("Não achei o bloco admin no dc.html");
let body = stripDcTags(dc.slice(start, end));

const navHtml = `
    <nav style="flex:1;padding:14px 10px;overflow-y:auto">
      ${[
        ["Visão geral", [
          ["dashboard", "Dashboard", false],
          ["vitrine-preview", "Preview Index", true],
        ]],
        ["Gestão de catálogo", [
          ["catalogo", "Catálogo & Sync", false],
          ["produtos", "Produtos", false],
          ["duplicados", "Remover duplicados", false],
        ]],
        ["Campanhas & links", [
          ["campanhas", "Criar campanha", false],
          ["campanha-desempenho", "Desempenho campanhas", false],
        ]],
        ["Financeiro & vendas", [
          ["desempenho", "Desempenho geral", false],
          ["meu-site", "Meu Site (vendas)", false],
        ]],
        ["Sistema", [
          ["ferramentas", "Ferramentas & feeds", false],
        ]],
      ].map(([title, items]) => `
        <div style="padding:14px 12px 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#475569">${title}</div>
        ${items.map(([key, label, live]) => `
          <button type="button" id="nav-${key}" data-admin-view="${key}" onclick="switchAdminView('${key}')" class="nav-item admin-nav-item${key === "dashboard" ? " active" : ""}" style="width:100%;display:flex;align-items:center;gap:11px;padding:9px 12px;background:transparent;border:0;border-left:3px solid transparent;color:#94a3b8;font-size:13px;font-weight:500;cursor:pointer;text-align:left;border-radius:0 8px 8px 0;margin-bottom:2px">
            <span class="nav-dot" style="width:6px;height:6px;border-radius:50%;background:#334155;flex-shrink:0"></span>
            <span style="flex:1">${label}</span>
            ${live ? `<span class="badge-live" style="font-size:9px;padding:2px 7px 2px 10px;background:rgba(16,185,129,.15);color:#34d399;border-radius:999px;font-weight:600;letter-spacing:.05em">AO VIVO</span>` : ""}
          </button>`).join("")}
      `).join("")}
    </nav>`;

body = body.replace(/<!-- Nav -->[\s\S]*?<!-- Footer -->/, `<!-- Nav -->${navHtml}\n    <!-- Footer -->`);

const brand = `
    <div style="padding:18px 16px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:12px">
      ${LOGO}
      <div style="flex:1;min-width:0">
        <div style="color:#fff;font-weight:700;font-size:14px;letter-spacing:-.01em">Afiliada Mestre</div>
        <div style="font-size:11px;color:#f97316;font-weight:500">Painel Shopee</div>
      </div>
      <button type="button" onclick="toggleAdminSidebar(false)" class="hamburger" style="background:transparent;border:0;color:#64748b;cursor:pointer;padding:4px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M6 18L18 6"/></svg>
      </button>
    </div>`;
body = body.replace(/<!-- Brand header -->[\s\S]*?<!-- Nav -->/, `<!-- Brand header -->${brand}\n    <!-- Nav -->`);

const catTabs = `
        <div id="catalog-tabs" style="display:flex;gap:4px;background:#e2e8f0;padding:4px;border-radius:12px;margin-bottom:20px;overflow-x:auto">
          <button type="button" data-tab="explorer" onclick="switchCatalogTab('explorer')" class="tab cat-tab active" style="border:0;padding:9px 16px;border-radius:9px;font-size:12.5px;cursor:pointer;white-space:nowrap">Explorador</button>
          <button type="button" data-tab="coverage" onclick="switchCatalogTab('coverage')" class="tab cat-tab" style="border:0;padding:9px 16px;border-radius:9px;font-size:12.5px;cursor:pointer;background:transparent;color:#475569;white-space:nowrap">Cobertura &amp; Shortlinks</button>
          <button type="button" data-tab="money" onclick="switchCatalogTab('money')" class="tab cat-tab" style="border:0;padding:9px 16px;border-radius:9px;font-size:12.5px;cursor:pointer;background:transparent;color:#475569;white-space:nowrap">Mais dinheiro agora</button>
          <button type="button" data-tab="system" onclick="switchCatalogTab('system')" class="tab cat-tab" style="border:0;padding:9px 16px;border-radius:9px;font-size:12.5px;cursor:pointer;background:transparent;color:#475569;white-space:nowrap">Categorias · Ofertas · Sync</button>
        </div>`;
body = body.replace(/<!-- Tab strip -->[\s\S]*?<!-- F\.6 Explorador/, `<!-- Tab strip -->${catTabs}\n        <!-- F.6 Explorador`);

body = body.replace(/id="cat-panel-explorer"[^>]*/, 'id="cat-panel-explorer" style="display:block"');
body = body.replace(/id="cat-panel-coverage"[^>]*/, 'id="cat-panel-coverage" style="display:none"');
body = body.replace(/id="cat-panel-money"[^>]*/, 'id="cat-panel-money" style="display:none"');
body = body.replace(/id="cat-panel-system"[^>]*/, 'id="cat-panel-system" style="display:none"');

const presets = [
  ["female_money", "Feminino + comissão"],
  ["bestsellers", "Mais vendidos"],
  ["topperf", "Top performance"],
  ["commission", "Maior comissão"],
  ["collection", "Coleção (matchId)"],
  ["shop", "Loja (shopId)"],
  ["rated", "Bem avaliados"],
  ["budget", "Custo-benefício"],
];
const presetsHtml = presets.map(([k, l], i) =>
  `<button type="button" data-preset="${k}" onclick="applyExplorerPreset('${k}')" class="chip explorer-preset${i === 1 ? " active" : ""}" style="padding:6px 12px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font-size:11.5px;cursor:pointer;font-weight:500">${l}</button>`
).join("\n              ");
body = body.replace(
  /<div id="explorer-presets"[\s\S]*?<\/div>/,
  `<div id="explorer-presets" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:16px;border-bottom:1px dashed #e2e8f0">\n              ${presetsHtml}\n            </div>`
);

const explorerFields = `
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Tipo de lista</label>
                <select id="admin-list-type" onchange="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                  <option value="0">0 — Recomendados</option>
                  <option value="1" selected>1 — Maior comissão</option>
                  <option value="2">2 — Top performance</option>
                  <option value="3">3 — Landing categoria</option>
                  <option value="4">4 — Detalhe categoria</option>
                  <option value="5">5 — Detalhe loja</option>
                  <option value="6">6 — Detalhe coleção</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Ordenação</label>
                <select id="admin-sort-type" onchange="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                  <option value="1">1 — Relevância</option>
                  <option value="2">2 — Mais vendidos</option>
                  <option value="3">3 — Maior preço</option>
                  <option value="4">4 — Menor preço</option>
                  <option value="5" selected>5 — Maior comissão</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Itens / página</label>
                <select id="admin-limit" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                  <option value="10">10</option>
                  <option value="20" selected>20</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Páginas</label>
                <select id="admin-pages" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                  <option value="1" selected>1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                </select>
              </div>`;
if (!body.includes('id="admin-list-type"')) {
  body = body.replace(
    /<div id="explorer-kw-count"[\s\S]*?<\/div>/,
    (m) => `${m}\n${explorerFields}`
  );
}

body = body.replace(
  /<textarea id="admin-keyword"[^>]*>[\s\S]*?<\/textarea>/,
  '<textarea id="admin-keyword" oninput="updateExplorerKwCount()" placeholder="ex: vestido longo feminino, kit skincare, perfume feminino" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;min-height:60px;resize:vertical;background:#f8fafc">vestido longo feminino, kit skincare, bolsa transversal feminina, perfume feminino</textarea>'
);
body = body.replace(
  /<input id="admin-match-id"[^/]*\/>/,
  '<input id="admin-match-id" type="number" min="1" placeholder="collection/cat" oninput="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<input id="admin-shop-id"[^/]*\/>/,
  '<input id="admin-shop-id" type="number" min="1" placeholder="ID da loja" oninput="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<input id="admin-min-commission"[^/]*\/>/,
  '<input id="admin-min-commission" type="number" min="0" max="100" step="0.5" value="0" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<input id="admin-min-rating"[^/]*\/>/,
  '<input id="admin-min-rating" type="number" step="0.1" min="0" max="5" value="4.0" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<input id="admin-min-sales"[^/]*\/>/,
  '<input id="admin-min-sales" type="number" value="20" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<input id="admin-require-commission" type="checkbox"[^>]*>/,
  '<input id="admin-require-commission" type="checkbox" checked style="width:15px;height:15px;accent-color:#ee4d2d"/>'
);
body = body.replace(
  /<button id="btn-explorer-cancel"[^>]*>[\s\S]*?<\/button>/,
  '<button type="button" id="btn-explorer-cancel" onclick="cancelExplorerSearch()" class="btn-ghost hidden" style="padding:10px 18px;border-radius:9px;cursor:pointer;font-size:13px;margin-left:auto;display:none">Cancelar</button>'
);
body = body.replace(
  /<input id="explorer-select-all"[^/]*\/>/,
  '<input id="explorer-select-all" type="checkbox" onchange="toggleExplorerSelectAll(this.checked)" style="width:15px;height:15px;accent-color:#ee4d2d"/>'
);
body = body.replace(
  /<div id="explorer-progress"[^>]*>/,
  '<div id="explorer-progress" class="hidden" style="display:none;margin-top:14px;padding:12px;background:#f8fafc;border-radius:9px;align-items:center;gap:12px">'
);
if (!body.includes("explorer-progress-label")) {
  body = body.replace(/<span>Aguardando<\/span>/, '<span id="explorer-progress-label">Aguardando</span>');
}
body = body.replace(
  /<div id="explorer-preview"[^>]*>[\s\S]*?<\/div>/,
  `<div id="explorer-preview" style="max-height:520px;overflow-y:auto">
              <div style="text-align:center;padding:40px 16px;color:#94a3b8;font-size:12px">Escolha um preset ou digite keywords e clique em <strong>Pré-visualizar</strong>.</div>
            </div>`
);

body = body.replace(
  /<div id="coverage-table"[\s\S]*?<\/div>/,
  '<div id="coverage-table" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-size:12px;color:#64748b;padding:16px">—</div>'
);
body = body.replace(
  /<div id="shortlink-status-bar"[^>]*>[\s\S]*?<\/div>/,
  '<div style="height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden"><div id="shortlink-status-bar" style="width:0%;height:100%;background:#94a3b8;border-radius:999px"></div></div>'
);
body = body.replace(
  /<p id="coverage-status-line"[^>]*>[\s\S]*?<\/p>/,
  '<p id="coverage-status-line" style="margin:2px 0 0;font-size:12px;color:#64748b">Carregando cobertura…</p>'
);
body = body.replace(
  /<p id="shortlink-status-line"[^>]*>[\s\S]*?<\/p>/,
  '<p id="shortlink-status-line" style="margin:2px 0 0;font-size:12px;color:#64748b">Verificando…</p>'
);
body = body.replace(
  /<div id="money-queue-box">[\s\S]*?<\/div>/,
  '<div id="money-queue-box" style="padding:18px;font-size:12px;color:#64748b">Clique em Recalcular para listar os produtos com maior potencial de comissão.</div>'
);

body = body.replace(
  /<select id="admin-cat-pages"[^>]*>[\s\S]*?<\/select>/,
  `<select id="admin-cat-pages" style="padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                <option value="1" selected>1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>`
);
body = body.replace(
  /<select id="admin-cat-sync"[^>]*>[\s\S]*?<\/select>/,
  '<select id="admin-cat-sync" style="padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"></select>'
);
body = body.replace(
  /<button class="btn-ghost" style="padding:9px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Usar no Explorador<\/button>/,
  `<button type="button" onclick="applyExplorerPreset('bestsellers'); const sel=document.getElementById('admin-cat-sync'); if(sel?.value){ const opt=sel.options[sel.selectedIndex]; document.getElementById('admin-keyword').value = (opt?.text||'').replace(/\\s*\\(\\d+\\)\\s*$/,'').trim(); }" class="btn-ghost" style="padding:9px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Usar no Explorador</button>`
);
body = body.replace(
  /<div id="auto-status-box"[^>]*>[\s\S]*?<\/div>/,
  `<div id="auto-status-box" style="background:#0b1220;color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:11px;padding:12px;border-radius:8px;min-height:80px;line-height:1.6">Carregando status…</div>`
);
body = body.replace(
  /<button onclick="loadAdminCatalogFull\(\{force:true\}\)([^>]*)>Carregar catálogo completo<\/button>/,
  '<button type="button" id="btn-load-full-catalog" onclick="loadAdminCatalogFull({force:true})"$1>Carregar catálogo completo</button>'
);

body = setIdText(body, "stat-db-products", "—");
body = setIdText(body, "stat-db-categories", "—");
body = setIdText(body, "stat-auto-state", "—");
body = setIdText(body, "stat-auto-next", "próxima: —");
body = setIdText(body, "stat-auto-last", "—");
body = setIdText(body, "stat-auto-upserts", "itens salvos: —");
body = setIdText(body, "dash-conversion-total", "—");
body = setIdText(body, "dash-conversion-commission", "R$ 0,00");
body = setIdText(body, "count-db-items", "0");
body = setIdText(body, "count-db-loaded", "");
body = setIdText(body, "admin-filter-summary", "");
body = setIdText(body, "admin-page-title", "Dashboard");
body = setIdText(body, "admin-page-subtitle", "Visão geral da operação de afiliados");
body = body.replace(
  /<span id="admin-api-badge"([^>]*)>/,
  '<span id="admin-api-badge" class="hidden"$1>'
);
body = body.replace(/>API OK</, ">API…<");

body = body.replace(
  /<select id="campaign-link-channel"[^>]*>[\s\S]*?<\/select>/,
  `<select id="campaign-link-channel" onchange="updateCampaignLinkPreview()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="tiktok">TikTok</option>
                  <option value="stories">Stories</option>
                  <option value="google">Google</option>
                  <option value="email">E-mail</option>
                  <option value="organico">Orgânico / direto</option>
                </select>`
);
body = body.replace(
  /<input id="campaign-link-name"[^/]*\/>/,
  '<input id="campaign-link-name" type="text" value="promo_vitrine" oninput="updateCampaignLinkPreview()" placeholder="ex: ads_vestidos" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc;font-family:inherit"/>'
);
body = body.replace(
  /<input id="campaign-product-search"[^/]*\/>/,
  '<input id="campaign-product-search" type="search" oninput="renderCampaignProductPicker()" onkeydown="onCampaignProductSearchKey(event)" placeholder="Cole o ID, o link da Shopee ou busque pelo nome…" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<div id="campaign-selected-products"[^>]*>[\s\S]*?<\/div>/,
  '<div id="campaign-selected-products" style="display:flex;flex-direction:column;gap:6px;min-height:60px"></div>'
);
body = body.replace(
  /<div id="subid-preview"[^>]*>[\s\S]*?<\/div>/,
  '<div id="subid-preview" style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;color:#f97316;word-break:break-all"></div>'
);

body = body.replace(
  /<select id="camp-perf-days"[^>]*>[\s\S]*?<\/select>/,
  `<select id="camp-perf-days" onchange="loadCampaignPerformance({reset:true,pull:false})" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;background:#f8fafc">
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>`
);
body = body.replace(
  /<select id="camp-perf-status"[^>]*>[\s\S]*?<\/select>/,
  `<select id="camp-perf-status" onchange="loadCampaignPerformance({reset:true,pull:false})" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;background:#f8fafc">
            <option value="">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="UNPAID">Não pago</option>
          </select>`
);
for (const id of ["camp-perf-count", "camp-perf-conversions", "camp-perf-orders", "camp-perf-items"]) {
  body = setIdText(body, id, "0");
}
body = setIdText(body, "camp-perf-commission", "R$ 0,00");
body = body.replace(
  /<div id="camp-perf-list"[^>]*>[\s\S]*?<\/div>/,
  '<div id="camp-perf-list" style="display:flex;flex-direction:column;gap:12px"><div style="padding:32px;text-align:center;color:#94a3b8;font-size:12px">Carregando campanhas…</div></div>'
);
body = body.replace(
  /<div id="camp-perf-detail"[^>]*>/,
  '<div id="camp-perf-detail" class="hidden" style="display:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-top:16px">'
);

body = body.replace(
  /<select id="conversion-days"[^>]*>[\s\S]*?<\/select>/,
  `<select id="conversion-days" onchange="loadConversions({reset:true,pull:false})" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;background:#f8fafc">
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>`
);
body = body.replace(
  /<select id="conversion-status"[^>]*>[\s\S]*?<\/select>/,
  '<input type="hidden" id="conversion-status" value="">'
);
body = setIdText(body, "conversion-confirmed", "R$ 0,00");
body = setIdText(body, "conversion-estimated", "R$ 0,00");
body = setIdText(body, "conversion-orders", "0");
body = setIdText(body, "conversion-cancelled", "0");
body = setIdText(body, "conversion-total", "0");
body = setIdText(body, "conversion-subids", "0");
body = body.replace(
  /<div id="conversion-funnel"[^>]*>[\s\S]*?<\/div>/,
  '<div id="conversion-funnel" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div>'
);
body = body.replace(
  /<div id="conversion-status-tabs"[^>]*>[\s\S]*?<\/div>/,
  '<div id="conversion-status-tabs" style="display:flex;gap:4px;flex-wrap:wrap"></div>'
);
body = body.replace(
  /<input id="conversion-search"[^/]*\/>/,
  '<input id="conversion-search" oninput="onConversionSearch()" type="search" placeholder="Buscar pedido, produto ou Sub ID" style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;background:#f8fafc"/>'
);
body = body.replace(
  /<div id="conversion-list">[\s\S]*?<\/div>/,
  '<div id="conversion-list"><div style="padding:32px;text-align:center;color:#94a3b8;font-size:12px">Clique em Atualizar Shopee para carregar.</div></div>'
);
body = body.replace(
  /<div id="conversion-pagination"[^>]*>[\s\S]*?<\/div>/,
  `<div id="conversion-pagination" class="hidden" style="display:none;justify-content:space-between;align-items:center;padding:12px 18px;border-top:1px solid #e2e8f0;flex-wrap:wrap;gap:8px">
            <select id="conversion-page-size" onchange="onConversionPageSizeChange()" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:11.5px;background:#f8fafc">
              <option value="10">10</option>
              <option value="20" selected>20</option>
              <option value="50">50</option>
            </select>
            <div style="display:flex;gap:4px;align-items:center">
              <button type="button" id="conversion-prev" onclick="previousConversionPage()" class="btn-ghost" style="padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">Anterior</button>
              <div id="conversion-page-buttons"></div>
              <button type="button" id="conversion-next" onclick="nextConversionPage()" class="btn-dark" style="padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">Próxima</button>
            </div>
            <span id="conversion-page-info" style="font-size:11px;color:#64748b">Página 1</span>
          </div>`
);

body = body.replace(
  /<select id="ms-days"[^>]*>[\s\S]*?<\/select>/,
  `<select id="ms-days" onchange="loadMeuSiteSummary({pull:false})" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;background:#f8fafc">
            <option value="1">Hoje</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>`
);
body = body.replace(
  /<input id="ms-only-me" type="checkbox"[^>]*>/,
  '<input id="ms-only-me" type="checkbox" checked onchange="loadMeuSiteSummary({pull:false})" style="accent-color:#ee4d2d"/>'
);
body = setIdText(body, "ms-net", "R$ 0,00");
body = setIdText(body, "ms-pending-net", "R$ 0,00");
body = setIdText(body, "ms-orders", "0");
body = setIdText(body, "ms-orders-break", "—");
body = setIdText(body, "ms-cancel-count", "0");
body = setIdText(body, "ms-cancel-pct", "0%");
body = setIdText(body, "ms-fraud-pct", "0%");
body = setIdText(body, "ms-gross", "R$ 0,00");
body = setIdText(body, "ms-ticket", "R$ 0,00");
body = setIdText(body, "ms-window", "—");
body = setIdText(body, "ms-sample", "0");
body = body.replace(/<div id="ms-top-items"[^>]*>[\s\S]*?<\/div>/, '<div id="ms-top-items" style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:#94a3b8">—</div>');
body = body.replace(/<div id="ms-top-shops"[^>]*>[\s\S]*?<\/div>/, '<div id="ms-top-shops" style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:#94a3b8">—</div>');
body = body.replace(/<div id="ms-top-campaigns"[^>]*>[\s\S]*?<\/div>/, '<div id="ms-top-campaigns" style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:#94a3b8">—</div>');
body = body.replace(/<div id="feed-inventory-result"[^>]*>[\s\S]*?<\/div>/, '<div id="feed-inventory-result"></div>');
body = body.replace(/<div id="shopee-health-result"[^>]*>[\s\S]*?<\/div>/, '<div id="shopee-health-result"></div>');
body = body.replace(/Aguardando execução\.\.\.</, "Aguardando execução…<");

body = body.replace(
  /<div id="new-product-form-card"[^>]*>/,
  '<div id="new-product-form-card" class="hidden" style="display:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px">'
);
body = body.replace(
  /<select id="add-category"[^>]*>[\s\S]*?<\/select>/,
  `<select id="add-category" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px">
              <option value="">Automática (pelo título)</option>
              <option value="moda">Moda Feminina</option>
              <option value="beleza">Beleza</option>
              <option value="acessorios">Acessórios</option>
              <option value="maternidade">Mãe &amp; Bebê</option>
              <option value="fitness">Fitness</option>
              <option value="casa">Casa</option>
              <option value="pet">Pet Shop</option>
              <option value="eletronicos">Eletrônicos</option>
              <option value="celular">Celular</option>
              <option value="infantil">Infantil</option>
              <option value="utilidades">Utilidades</option>
              <option value="automotivo">Automotivo</option>
            </select>`
);
body = body.replace(
  /<input id="admin-search"[^/]*\/>/,
  '<input id="admin-search" type="search" oninput="onAdminSearch()" placeholder="Buscar nome, ID, categoria, loja…" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>'
);
body = body.replace(
  /<select id="admin-filter-category"[^>]*>[\s\S]*?<\/select>/,
  '<select id="admin-filter-category" onchange="onAdminFiltersChange()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"><option value="">Todas as categorias</option></select>'
);
body = body.replace(
  /<select id="admin-filter-type"[^>]*>[\s\S]*?<\/select>/,
  `<select id="admin-filter-type" onchange="onAdminFiltersChange()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
              <option value="">Todos os tipos</option>
              <option value="flash">Só relâmpago</option>
              <option value="normal">Só normal</option>
            </select>`
);
body = body.replace(
  /<select id="admin-filter-sort"[^>]*>[\s\S]*?<\/select>/,
  `<select id="admin-filter-sort" onchange="onAdminFiltersChange()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
              <option value="recent">Mais recentes</option>
              <option value="name">Nome A–Z</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="discount">Maior desconto</option>
              <option value="commission">Maior comissão</option>
            </select>`
);
body = body.replace(
  /<select id="admin-page-size"[^>]*>[\s\S]*?<\/select>/,
  `<select id="admin-page-size" onchange="onAdminPageSizeChange()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc">
              <option value="12">12</option>
              <option value="24" selected>24</option>
              <option value="48">48</option>
              <option value="100">100</option>
            </select>`
);
body = body.replace(
  /<input id="admin-select-page" type="checkbox"[^>]*>/,
  '<input id="admin-select-page" type="checkbox" onchange="toggleSelectAdminPage(this.checked)" style="accent-color:#ee4d2d"/>'
);
body = body.replace(
  />Selecionar filtrados<\/button>/,
  ' onclick="selectAllFilteredProducts()">Selecionar filtrados</button>'
);
body = body.replace(
  />Limpar seleção<\/button>/,
  ' onclick="clearAdminProductSelection()">Limpar seleção</button>'
);
body = body.replace(
  />Limpar filtros<\/button>/,
  ' onclick="clearAdminFilters()">Limpar filtros</button>'
);
body = body.replace(
  /<div id="admin-bulk-bar"[^>]*>/,
  '<div id="admin-bulk-bar" class="hidden" style="display:none;background:#0b1220;color:#fff;border-radius:12px;padding:12px 20px;margin-bottom:16px;justify-content:space-between;align-items:center">'
);
body = body.replace(
  /<div id="console-products-list"[^>]*>[\s\S]*?<\/div>/,
  '<div id="console-products-list" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"></div>'
);
body = body.replace(/<button id="admin-prev"/, '<button type="button" id="admin-prev" onclick="adminPrevPage()"');
body = body.replace(/<button id="admin-next"/, '<button type="button" id="admin-next" onclick="adminNextPage()"');
body = body.replace(
  /<div id="duplicates-table"[^>]*>[\s\S]*?<\/div>/,
  '<div id="duplicates-table" style="display:flex;flex-direction:column;gap:10px;font-size:12px;color:#94a3b8">Nenhuma análise ainda.</div>'
);
body = body.replace(
  /<div id="weak-offers-table"[^>]*>/,
  '<div id="weak-offers-table" class="hidden" style="display:none;margin-top:14px">'
);
body = body.replace(
  /<iframe id="vitrine-preview-iframe"[^>]*>/,
  '<iframe id="vitrine-preview-iframe" src="/" title="Vitrine" style="width:100%;height:100%;border:0;border-radius:10px">'
);

body = body.replace(
  /<form id="admin-login-form"[^>]*>/,
  '<form id="admin-login-form" onsubmit="return submitAdminLogin(event)">'
);
const loginLogo = `
      <div style="background:linear-gradient(135deg,#f97316,#ee4d2d);margin:-32px -32px 24px;padding:26px;border-radius:16px 16px 0 0;color:#fff;text-align:center">
        ${LOGO_LOGIN}
        <div style="font-size:17px;font-weight:700">Afiliada Mestre</div>
        <div style="font-size:11px;opacity:.9">Painel Administrativo &amp; Gestão Shopee</div>
      </div>`;
body = body.replace(
  /<div class="shopee-gradient"[\s\S]*?<\/div>\s*<form id="admin-login-form"/,
  `${loginLogo}\n      <form id="admin-login-form"`
);

const loginRe = /<!-- Login overlay[\s\S]*?<div id="admin-login-screen"[\s\S]*?<\/form>\s*<\/div>\s*<\/div>/;
const loginMatch = body.match(loginRe);
if (!loginMatch) throw new Error("Login overlay não encontrado no dc processado");
let loginHtml = loginMatch[0]
  .replace(
    /<div id="admin-login-screen"[^>]*>/,
    '<div id="admin-login-screen" class="hidden" style="display:none;position:fixed;inset:0;background:linear-gradient(135deg,#0b1220,#1e293b);z-index:100;align-items:center;justify-content:center;padding:20px">'
  )
  .replace(
    /<div id="admin-login-error"[^>]*>/,
    '<div id="admin-login-error" class="hidden" style="font-size:11.5px;color:#dc2626;margin-bottom:10px;min-height:14px">'
  );
body = body.replace(loginRe, "");
body = body.replace(/<!-- Toast -->[\s\S]*?<div id="toast-container"[\s\S]*?<\/div>/, "");
body = body.trim();

const fragment = `    <!-- ADMIN PANEL — página dedicada (?admin=1) -->
${loginHtml}
    <div id="admin-sidebar-backdrop" onclick="toggleAdminSidebar(false)" class="hidden" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:50"></div>
    <div id="admin-panel-root" class="hidden" style="display:none;min-height:100vh;background:#f1f5f9;font-family:Inter,Nunito,system-ui,sans-serif">
${body}
    </div>

`;

if (fragment.includes("sc-for") || fragment.includes("sc-if") || fragment.includes("{{")) {
  throw new Error("Fragmento ainda contém tags dc (sc-for/sc-if/{{ }})");
}

const extraCss = `
        #admin-panel-root, #admin-login-screen { font-family: Inter, Nunito, system-ui, sans-serif; }
        #admin-panel-root.hidden, #admin-login-screen.hidden,
        #admin-sidebar-backdrop.hidden, #new-product-form-card.hidden,
        #admin-bulk-bar.hidden, #explorer-progress.hidden, #camp-perf-detail.hidden,
        #weak-offers-table.hidden, #conversion-pagination.hidden, #btn-explorer-cancel.hidden,
        #admin-api-badge.hidden, #admin-login-error.hidden { display: none !important; }
        #admin-login-screen.flex { display: flex !important; }
        #admin-panel-root.flex, #admin-panel-root.is-open { display: block !important; }
        #admin-sidebar-backdrop:not(.hidden) { display: block !important; }
        #admin-bulk-bar:not(.hidden) { display: flex !important; }
        #new-product-form-card:not(.hidden) { display: block !important; }
        #explorer-progress:not(.hidden) { display: flex !important; }
        #camp-perf-detail:not(.hidden) { display: block !important; }
        #conversion-pagination:not(.hidden) { display: flex !important; }
        #admin-api-badge:not(.hidden) { display: inline-flex !important; }
        ${adminCss.split("\n").map((l) => "        " + l).join("\n")}
`;

let html = fs.readFileSync(htmlPath, "utf8");
const startRe = /\r?\n[ \t]*<!-- ADMIN PANEL — página dedicada \(\?admin=1\) -->/;
const endRe = /\r?\n[ \t]*<!-- POPUP DE DETALHES DO PRODUTO/;
const m0 = html.match(startRe);
const m1 = html.match(endRe);
if (!m0 || !m1) throw new Error("Marcadores do admin não encontrados no HTML real");
const i0 = m0.index + (m0[0].startsWith("\r") || m0[0].startsWith("\n") ? 1 : 0);
const i1 = html.search(endRe);
if (i1 <= i0) throw new Error("Marcador POPUP está antes do ADMIN PANEL");

const before = html.slice(0, i0);
if (!before.includes('id="store-products-grid"') || !before.includes('id="category-page-panel"')) {
  throw new Error("A vitrine foi cortada: store-products-grid/category-page-panel não estão antes do admin");
}
if (!before.includes("</div>") || before.trimEnd().endsWith("<div class=")) {
  throw new Error("HTML da vitrine termina truncado antes do admin");
}

if (html.includes("/* NEW ADMIN SHELL */")) {
  html = html.replace(/\/\* NEW ADMIN SHELL \*\/[\s\S]*?\/\* END NEW ADMIN SHELL \*\//, "");
}
html = html.replace(
  "        .admin-view { display: none; }",
  `        /* NEW ADMIN SHELL */
${extraCss}
        /* END NEW ADMIN SHELL */
        .admin-view { display: none; }`
);
if (!html.includes("fonts.googleapis.com/css2?family=Inter")) {
  html = html.replace(
    "</head>",
    `    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">\n</head>`
  );
}

const i0b = html.search(startRe);
const i1b = html.search(endRe);
const out = html.slice(0, i0b) + "\n" + fragment + html.slice(i1b);
fs.writeFileSync(htmlPath, out);

const required = [
  "admin-panel-root", "admin-login-screen", "admin-login-form", "nav-dashboard",
  "nav-vitrine-preview", "admin-view-dashboard", "admin-view-vitrine-preview",
  "admin-view-catalogo", "admin-view-produtos", "admin-view-duplicados",
  "admin-view-campanhas", "admin-view-campanha-desempenho", "admin-view-desempenho",
  "admin-view-meu-site", "admin-view-ferramentas", "admin-keyword", "admin-list-type",
  "conversion-confirmed", "conversion-prev", "conversion-next", "ms-net",
  "console-products-list", "vitrine-preview-iframe", "catalog-tabs", "cat-panel-explorer",
  "product-modal", "store-products-grid", "btn-load-full-catalog", "official-offers-box",
  "feed-result", "refresh-metrics-batch", "dash-conversion-total", "shortlink-status-bar",
];
const missing = required.filter((id) => !out.includes(`id="${id}"`));
if (missing.length) throw new Error("IDs faltando: " + missing.join(", "));
if (out.includes("<sc-for") || out.includes("</sc-for>") || out.includes("<sc-if")) {
  throw new Error("Ainda há tags sc-for/sc-if no HTML");
}
const loginAt = out.indexOf('id="admin-login-screen"');
const panelAt = out.indexOf('id="admin-panel-root"');
if (loginAt < 0 || panelAt < 0 || loginAt > panelAt) {
  throw new Error("Login precisa ficar fora/antes de #admin-panel-root");
}
console.log("Admin visual injetado. html bytes=", out.length, "fragment=", fragment.length);

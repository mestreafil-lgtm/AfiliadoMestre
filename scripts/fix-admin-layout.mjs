import fs from "fs";

const path = "uploads/painel_e_vitrine_afiliado_mestre.html";
let html = fs.readFileSync(path, "utf8");

// 1) Fix broken Duplicados section (extra </div> was closing <main> early)
const dupBroken = /<section id="admin-view-duplicados" class="admin-view">[\s\S]*?<\/section>\s*\n\s*<!-- ============ VIEW: CAMPANHAS/;
const dupFixed = `<section id="admin-view-duplicados" class="admin-view">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:16px">
            <div>
              <h2 style="margin:0;font-size:15px;font-weight:700">Higiene do catálogo</h2>
              <p id="duplicates-status-line" style="margin:2px 0 0;font-size:12px;color:#64748b">Nenhuma análise recente</p>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" onclick="scanCatalogDuplicates()" class="btn-primary" style="padding:8px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Analisar duplicados</button>
              <button type="button" id="btn-remove-duplicates" onclick="removeCatalogDuplicates()" class="btn-dark" style="padding:8px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Remover duplicados</button>
              <button type="button" onclick="scanWeakOffers()" class="btn-ghost" style="padding:8px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Analisar fracos</button>
              <button type="button" id="btn-purge-weak" onclick="purgeWeakOffers()" class="btn-ghost" style="padding:8px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Limpar fracos</button>
              <button type="button" onclick="refreshTopOffers()" class="btn-ghost" style="padding:8px 14px;border-radius:8px;font-size:12.5px;cursor:pointer">Atualizar top</button>
            </div>
          </div>
          <div id="duplicates-table" style="display:flex;flex-direction:column;gap:10px;font-size:12px;color:#94a3b8">Nenhuma análise ainda.</div>
          <div id="weak-offers-table" class="hidden" style="display:none;margin-top:14px"></div>
        </div>
      </section>

      <!-- ============ VIEW: CAMPANHAS`;

if (!dupBroken.test(html)) throw new Error("Seção duplicados não encontrada para corrigir");
html = html.replace(dupBroken, dupFixed);

// 2) Fix explorer filter nesting (keywords column closed too early / fields nested wrong)
const explorerBroken = /<!-- Filter grid -->[\s\S]*?<!-- Action row -->/;
const explorerFixed = `<!-- Filter grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px">
              <div style="grid-column:1 / -1">
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Keywords</label>
                <textarea id="admin-keyword" oninput="updateExplorerKwCount()" placeholder="ex: vestido longo feminino, kit skincare, perfume feminino" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;min-height:60px;resize:vertical;background:#f8fafc">vestido longo feminino, kit skincare, bolsa transversal feminina, perfume feminino</textarea>
                <div id="explorer-kw-count" style="font-size:10.5px;color:#94a3b8;margin-top:4px">0 palavras-chave</div>
              </div>
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
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Match ID</label>
                <input id="admin-match-id" type="number" min="1" placeholder="collection/cat" oninput="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Shop ID</label>
                <input id="admin-shop-id" type="number" min="1" placeholder="ID da loja" oninput="updateExplorerModeHint()" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Comissão mín. %</label>
                <input id="admin-min-commission" type="number" min="0" max="100" step="0.5" value="0" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Nota mín.</label>
                <input id="admin-min-rating" type="number" step="0.1" min="0" max="5" value="4.0" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Vendas mín.</label>
                <input id="admin-min-sales" type="number" value="20" style="width:100%;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;background:#f8fafc"/>
              </div>
              <label style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;font-size:12.5px;cursor:pointer;margin-top:22px">
                <input id="admin-require-commission" type="checkbox" checked style="width:15px;height:15px;accent-color:#ee4d2d"/>
                Exigir comissão
              </label>
            </div>

            <!-- Action row -->`;

if (!explorerBroken.test(html)) throw new Error("Filter grid do explorador não encontrado");
html = html.replace(explorerBroken, explorerFixed);

// 3) Soften campanhas 2-col grid on small screens via inline media isn't possible; add CSS below.
html = html.replace(
  '<div style="display:grid;grid-template-columns:1fr 340px;gap:16px">\n          <div>\n            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px">\n              <h2 style="margin:0 0 4px;font-size:15px;font-weight:700">Nova campanha</h2>',
  '<div class="admin-campanhas-grid" style="display:grid;grid-template-columns:1fr 340px;gap:16px">\n          <div>\n            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px">\n              <h2 style="margin:0 0 4px;font-size:15px;font-weight:700">Nova campanha</h2>'
);

// 4) Replace conflicting old admin CSS + shell rules with a clean layout block
const oldAdminCss = /\/\* Admin panel \*\/[\s\S]*?\.admin-stat-card:hover \{[\s\S]*?\}\s*\/\* NEW ADMIN SHELL \*\//;
const newAdminCss = `/* Admin panel */
        body.admin-mode { background: #f1f5f9; overflow: hidden; }
        body.admin-mode #main-storefront-section,
        body.admin-mode #mobile-category-sheet,
        body.admin-mode #back-to-top-btn,
        body.admin-mode > footer { display: none !important; }
        body.admin-mode #product-modal { display: none !important; }

        /* NEW ADMIN SHELL */`;

if (!oldAdminCss.test(html)) throw new Error("Bloco CSS Admin panel não encontrado");
html = html.replace(oldAdminCss, newAdminCss);

const shellStart = "        /* NEW ADMIN SHELL */";
const shellEnd = "        /* END NEW ADMIN SHELL */";
const i0 = html.indexOf(shellStart);
const i1 = html.indexOf(shellEnd);
if (i0 < 0 || i1 < 0) throw new Error("Marcadores NEW ADMIN SHELL ausentes");

const shellCss = `        /* NEW ADMIN SHELL */
        #admin-panel-root,
        #admin-login-screen {
          font-family: Inter, Nunito, system-ui, sans-serif;
          color: #0f172a;
          -webkit-font-smoothing: antialiased;
        }
        #admin-panel-root *,
        #admin-login-screen * { box-sizing: border-box; }
        #admin-panel-root a,
        #admin-login-screen a { color: #ea580c; text-decoration: none; }
        #admin-panel-root a:hover,
        #admin-login-screen a:hover { color: #c2410c; }

        #admin-panel-root.hidden,
        #admin-login-screen.hidden,
        #admin-sidebar-backdrop.hidden,
        #new-product-form-card.hidden,
        #admin-bulk-bar.hidden,
        #explorer-progress.hidden,
        #camp-perf-detail.hidden,
        #weak-offers-table.hidden,
        #conversion-pagination.hidden,
        #btn-explorer-cancel.hidden,
        #admin-api-badge.hidden,
        #admin-login-error.hidden { display: none !important; }

        #admin-login-screen.flex { display: flex !important; }
        #admin-panel-root.flex,
        #admin-panel-root.is-open {
          display: flex !important;
          flex-direction: column;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          background: #f1f5f9;
        }
        #admin-panel-root > .admin-shell {
          display: flex;
          flex: 1;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          background: #f1f5f9;
        }
        #admin-sidebar-backdrop:not(.hidden) { display: block !important; }
        #admin-bulk-bar:not(.hidden) { display: flex !important; }
        #new-product-form-card:not(.hidden) { display: block !important; }
        #explorer-progress:not(.hidden) { display: flex !important; }
        #camp-perf-detail:not(.hidden) { display: block !important; }
        #conversion-pagination:not(.hidden) { display: flex !important; }
        #weak-offers-table:not(.hidden) { display: block !important; }
        #admin-api-badge:not(.hidden) { display: inline-flex !important; }

        #admin-sidebar {
          width: 260px;
          flex-shrink: 0;
          height: 100vh;
          height: 100dvh;
          position: sticky;
          top: 0;
          align-self: flex-start;
          z-index: 60;
          transition: transform .25s ease;
        }
        #admin-panel-root .main-wrap {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          max-height: 100vh;
          max-height: 100dvh;
          overflow: hidden;
        }
        #admin-panel-root #main-console-section {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .admin-view { display: none; }
        .admin-view.active { display: block; }
        #admin-panel-root .nav-item.active,
        #admin-panel-root .admin-nav-item.active {
          background: linear-gradient(90deg, rgba(238,77,45,.18), rgba(238,77,45,.04));
          color: #fff !important;
          border-left: 3px solid #ee4d2d !important;
        }
        #admin-panel-root .nav-item.active .nav-dot {
          background: #ee4d2d;
          box-shadow: 0 0 0 4px rgba(238,77,45,.2);
        }
        #admin-panel-root .conv-row:hover { background: #fff7ed; }
        #admin-panel-root .kpi-card { transition: transform .15s ease, box-shadow .15s ease; }
        #admin-panel-root .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -12px rgba(15,23,42,.18); }
        #admin-panel-root .chip:hover { background: #f1f5f9; }
        #admin-panel-root .chip.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        #admin-panel-root .btn-primary,
        #admin-login-screen .btn-primary {
          background: linear-gradient(135deg,#f97316,#ee4d2d);
          color: #fff;
          border: 0;
          font-weight: 600;
          box-shadow: 0 6px 14px -6px rgba(238,77,45,.6);
        }
        #admin-panel-root .btn-primary:hover,
        #admin-login-screen .btn-primary:hover { filter: brightness(1.05); }
        #admin-panel-root .btn-ghost {
          background: #fff;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-weight: 500;
        }
        #admin-panel-root .btn-ghost:hover { border-color: #cbd5e1; background: #f8fafc; }
        #admin-panel-root .btn-dark {
          background: #0f172a;
          color: #fff;
          border: 0;
          font-weight: 600;
        }
        #admin-panel-root .btn-dark:hover { background: #1e293b; }
        #admin-panel-root .tab.active {
          background: #fff;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0,0,0,.06);
          font-weight: 600;
        }
        #admin-panel-root .hamburger { display: none; }
        #admin-panel-root .table-row:hover { background: #f8fafc; }
        #admin-panel-root input,
        #admin-panel-root select,
        #admin-panel-root textarea,
        #admin-login-screen input { font-family: inherit; }
        #admin-panel-root input:focus,
        #admin-panel-root select:focus,
        #admin-panel-root textarea:focus,
        #admin-login-screen input:focus {
          outline: 2px solid #ee4d2d;
          outline-offset: 0;
          border-color: #ee4d2d !important;
        }
        #admin-panel-root .badge-live { position: relative; }
        #admin-panel-root .badge-live::before {
          content: '';
          position: absolute;
          left: -2px;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(16,185,129,.25);
          animation: admin-pulse 1.6s ease-in-out infinite;
        }
        @keyframes admin-pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
        #admin-panel-root .placeholder-img {
          background: repeating-linear-gradient(45deg,#f1f5f9 0 6px,#e2e8f0 6px 12px);
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          text-transform: uppercase;
        }
        #admin-panel-root .admin-campanhas-grid {
          grid-template-columns: 1fr 340px;
        }
        @media (max-width: 1100px) {
          #admin-panel-root .admin-campanhas-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 900px) {
          #admin-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            transform: translateX(-100%);
            z-index: 70;
            height: 100vh;
            height: 100dvh;
          }
          #admin-sidebar.open { transform: translateX(0); }
          #admin-panel-root .hamburger { display: flex !important; align-items: center; justify-content: center; }
          #admin-panel-root .main-wrap { max-height: none; overflow: visible; }
          #admin-panel-root #main-console-section { overflow: visible; }
          body.admin-mode { overflow: auto; }
        }
`;

html = html.slice(0, i0) + shellCss + html.slice(i1);

// 5) Mark inner flex shell for reliable CSS targeting
html = html.replace(
  '<div id="admin-panel-root" class="hidden" style="display:none;min-height:100vh;background:#f1f5f9;font-family:Inter,Nunito,system-ui,sans-serif">\n<div style="display:flex;min-height:100vh;background:#f1f5f9">',
  '<div id="admin-panel-root" class="hidden" style="display:none;min-height:100vh;background:#f1f5f9;font-family:Inter,Nunito,system-ui,sans-serif">\n<div class="admin-shell" style="display:flex;min-height:100vh;width:100%;background:#f1f5f9">'
);

fs.writeFileSync(path, html);

// Validate div balance in admin block
const start = html.indexOf("<!-- ADMIN PANEL");
const end = html.indexOf("<!-- POPUP DE DETALHES");
const chunk = html.slice(start, end);
const opens = (chunk.match(/<div\b/gi) || []).length;
const closes = (chunk.match(/<\/div>/gi) || []).length;
console.log({ opens, closes, balanced: opens === closes });
if (opens !== closes) process.exit(1);
console.log("Layout HTML/CSS corrigido.");

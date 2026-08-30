/**
 * Navegação do preview admin — espelha switchAdminView sem API/login.
 */
(function () {
  const ADMIN_VIEWS = {
    dashboard: { title: "Início", subtitle: "Visão geral da operação de afiliados" },
    "vitrine-preview": { title: "Ver vitrine", subtitle: "Loja pública ao vivo — celular, tablet e computador" },
    "catalogo-buscar": { title: "Buscar produtos", subtitle: "Busca na Shopee por palavra, loja ou coleção" },
    "catalogo-atualizar": { title: "Atualizar catálogo", subtitle: "Categorias, alimentação automática e lotes do feed" },
    "catalogo-links": { title: "Links curtos", subtitle: "Gera o link curto que falta nos produtos da vitrine" },
    "catalogo-saude": { title: "Saúde da Shopee", subtitle: "Preços, comissão e conexão com a Shopee" },
    produtos: { title: "Produtos na vitrine", subtitle: "Gerencie o catálogo da vitrine" },
    duplicados: { title: "Limpar catálogo", subtitle: "Tire itens repetidos e ofertas fracas" },
    campanhas: { title: "Campanhas", subtitle: "Converta o produto e obtenha o link do anúncio com Pixel" },
    "campanha-desempenho": { title: "Resultado das campanhas", subtitle: "Resultados por Sub ID" },
    desempenho: { title: "Todas as conversões", subtitle: "Conversões e comissões da Shopee" },
    "meu-site": { title: "Vendas do site", subtitle: "Vendas atribuídas à vitrine pública" },
    financeiro: { title: "Financeiro", subtitle: "Resumo financeiro das conversões no período selecionado" },
    visualizacoes: { title: "Visualizações", subtitle: "Visitas e tráfego via Cloudflare" },
  };

  const CATALOGO_VIEWS = new Set([
    "catalogo-buscar",
    "catalogo-atualizar",
    "catalogo-links",
    "catalogo-saude",
  ]);

  function toggleAdminSidebar(forceOpen) {
    const sidebar = document.getElementById("admin-sidebar");
    const backdrop = document.getElementById("admin-sidebar-backdrop");
    if (!sidebar) return;
    const open = forceOpen === undefined ? !sidebar.classList.contains("open") : !!forceOpen;
    sidebar.classList.toggle("open", open);
    if (backdrop) {
      backdrop.classList.toggle("hidden", !open);
      backdrop.style.display = open ? "block" : "none";
    }
    try {
      document.body.style.overflow =
        open && window.matchMedia("(max-width: 900px)").matches ? "hidden" : "";
    } catch (_) {}
  }

  function toggleCatalogoSubmenu(forceOpen) {
    const submenu = document.getElementById("nav-catalogo-submenu");
    const toggle = document.getElementById("nav-catalogo-toggle");
    if (!submenu || !toggle) return;
    const open = forceOpen === undefined ? !submenu.classList.contains("open") : !!forceOpen;
    submenu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setPreviewDevice(device) {
    const wrap = document.getElementById("vitrine-preview-frame-wrap");
    if (!wrap) return;
    const mode = ["desktop", "tablet", "mobile"].includes(device) ? device : "desktop";
    wrap.classList.remove("preview-device-desktop", "preview-device-tablet", "preview-device-mobile");
    wrap.classList.add("preview-device-" + mode);
    ["desktop", "tablet", "mobile"].forEach((d) => {
      const btn = document.getElementById("btn-device-" + d);
      if (!btn) return;
      const on = d === mode;
      btn.classList.toggle("active", on);
      btn.style.background = on ? "#fff" : "transparent";
      btn.style.color = on ? "#0f172a" : "#64748b";
      btn.style.fontWeight = on ? "600" : "500";
    });
  }

  function switchAdminView(view, opts) {
    opts = opts || {};
    if (view === "catalogo") view = "catalogo-buscar";
    if (view === "catalogo-sync" || view === "catalogo-feeds" || view === "ferramentas") view = "catalogo-atualizar";
    if (view === "catalogo-shortlinks") view = "catalogo-links";
    if (!ADMIN_VIEWS[view]) view = "dashboard";

    document.querySelectorAll(".admin-view").forEach((el) => el.classList.remove("active"));
    const target = document.getElementById("admin-view-" + view);
    if (target) target.classList.add("active");

    document.querySelectorAll(".admin-nav-item[data-admin-view], .nav-item[data-admin-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.adminView === view);
    });
    toggleCatalogoSubmenu(CATALOGO_VIEWS.has(view));

    const meta = ADMIN_VIEWS[view];
    const titleEl = document.getElementById("admin-page-title");
    const subEl = document.getElementById("admin-page-subtitle");
    if (titleEl && meta) titleEl.textContent = meta.title;
    if (subEl && meta) subEl.textContent = meta.subtitle + " · preview";

    if (view === "vitrine-preview") {
      const iframe = document.getElementById("vitrine-preview-iframe");
      if (iframe && !iframe.dataset.loaded) {
        iframe.dataset.loaded = "1";
        iframe.src = "/";
      }
      setPreviewDevice("desktop");
    }

    toggleAdminSidebar(false);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {}
  }

  window.switchAdminView = switchAdminView;
  window.toggleAdminSidebar = toggleAdminSidebar;
  window.toggleMobileSidebar = toggleAdminSidebar;
  window.toggleCatalogoSubmenu = toggleCatalogoSubmenu;
  window.setPreviewDevice = setPreviewDevice;
  window.closeCampaignPerfDetail = function () {
    const el = document.getElementById("camp-perf-detail");
    if (el) {
      el.classList.add("hidden");
      el.style.display = "none";
    }
  };

  const noop = function () {};
  [
    "loadAdminStats",
    "loadAutoStatus",
    "loadDashboardSales",
    "loadCampaignPerformance",
    "loadConversions",
    "loadAnalytics",
    "loadShopeeHealth",
    "loadShortlinkStatus",
    "populateAdminCategorySelect",
    "renderAdminCategoriesPanel",
    "loadFeedInventory",
    "resetCampaignForm",
    "obterCampaignLink",
    "convertCampaignProduct",
    "scanCatalogDuplicates",
    "lookupConversion",
  ].forEach((name) => {
    if (typeof window[name] !== "function") window[name] = noop;
  });

  document.addEventListener("DOMContentLoaded", function () {
    switchAdminView("campanha-desempenho", { skipUrl: true });
  });
})();

/* Painel admin — carregado só em /admin */
(function () {
    const AM = window.__AM || {};
    const API_BASE = AM.API_BASE;
    const PAGE_SIZE = AM.PAGE_SIZE || 24;
    const showToast = AM.showToast;
    const escapeHtml = AM.escapeHtml;
    const escapeAttr = AM.escapeAttr;
    const formatSold = AM.formatSold;
    const isOfficialShop = AM.isOfficialShop;
    const isAdminMode = AM.isAdminMode;
    const navigateTo = AM.navigateTo;
    const applyProducts = AM.applyProducts;
    const loadOffersFromSupabase = AM.loadOffersFromSupabase;
    const loadCategoriesFromApi = AM.loadCategoriesFromApi;
    const sanitizeSubId = AM.sanitizeSubId;
    const SITE_SUBID = AM.SITE_SUBID || "afiliadamestre";
    const getTrackingSubIds = AM.getTrackingSubIds;
    const getSubIdSettings = AM.getSubIdSettings;
    const moneyScoreOf = (...a) => AM.moneyScoreOf(...a);
    const femaleOnly = (...a) => AM.femaleOnly(...a);
    const sortByMoney = (...a) => AM.sortByMoney(...a);

    const EXPLORER_PRESETS = {
        female_money: {
            listType: 1, sortType: 5, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 5,
            keywords: "vestido longo feminino, kit skincare, bolsa transversal feminina, conjunto fitness feminino, perfume feminino, sandalia feminina, lingerie feminina, colageno hidrolisado",
        },
        bestsellers: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 50, requireCommission: true, minCommissionPct: 0,
            keywords: "vestido longo feminino, blusa feminina, tênis feminino, kit skincare, maquiagem",
        },
        topperf: {
            listType: 2, sortType: 2, minRating: 4.2, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: "vestido midi feminino, skincare coreano, bolsa feminina, conjunto fitness, perfume feminino",
        },
        commission: {
            listType: 1, sortType: 5, minRating: 4.0, minSales: 10, requireCommission: true, minCommissionPct: 8,
            keywords: "perfume feminino, smartwatch feminino, maquiagem, colageno hidrolisado, serum vitamina c",
        },
        collection: {
            listType: 6, sortType: 5, minRating: 4.0, minSales: 0, requireCommission: true, minCommissionPct: 0,
            keywords: "", matchIdHint: true,
        },
        shop: {
            listType: 5, sortType: 5, minRating: 4.0, minSales: 0, requireCommission: true, minCommissionPct: 0,
            keywords: "", shopIdHint: true,
        },
        rated: {
            listType: 0, sortType: 1, minRating: 4.7, minSales: 30, requireCommission: true, minCommissionPct: 0,
            keywords: "creme facial, escova secadora, serum vitamina c, batom liquido matte",
        },
        budget: {
            listType: 0, sortType: 4, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 0,
            keywords: "organizador maquiagem, kit maquiagem, scrunchie, necessaire feminina, caderno aesthetic",
        },
    };
    const LIST_TYPE_LABELS_UI = {
        0: "Recomendados", 1: "Maior comissão", 2: "Top performance",
        3: "Landing categoria", 4: "Detalhe categoria", 5: "Detalhe loja", 6: "Detalhe coleção",
    };
    const SORT_TYPE_LABELS_UI = {
        1: "Relevância", 2: "Mais vendidos", 3: "Maior preço", 4: "Menor preço", 5: "Maior comissão",
    };

    const ADMIN_TOKEN_KEY = "afiliada_mestre_admin_token";
    const ADMIN_REFRESH_KEY = "afiliada_mestre_admin_refresh";
    const ADMIN_USER_KEY = "afiliada_mestre_admin_user";
    let adminAuthReady = false;
    let adminLoggedIn = false;
    const CONVERSION_PAGE_SIZE = 20;
    let conversionScrollId = "";
    let conversionRows = [];
    let conversionPage = 1;
    let conversionHasNextRemote = false;
    let campaignSelectedProducts = [];
    let adminPage = 0;
    let adminPageSize = 24;
    let adminSelectedIds = new Set();
    let adminCatalogLoading = false;
    let adminCatalogLoaded = false;
    let explorerAbort = null;
    let explorerProducts = [];
    let explorerSelected = new Set();
    let explorerBusy = false;
    let adminSearchTerm = "";
    let adminFilterCategory = "";
    let adminFilterType = "";
    let adminFilterSort = "recent";
    let adminSearchTimer = null;
    let campaignPerfRows = [];
    let campaignPerfSelected = "";
    let campaignPerfLoading = false;
    let campaignSavedList = [];
    let campaignProductResolving = false;
    let campaignShopeeLinks = {};
    let campaignShopeeKey = "";
    let campaignShopeeLoading = false;

    const ADMIN_VIEWS = {
        dashboard: { title: "Dashboard", subtitle: "Visão geral da operação" },
        catalogo: { title: "Catálogo & Sync", subtitle: "Sincronize ofertas da Shopee" },
        produtos: { title: "Produtos", subtitle: "Gerencie o catálogo da vitrine" },
        duplicados: { title: "Remover duplicados", subtitle: "Limpe itens repetidos" },
        campanhas: { title: "Campanhas", subtitle: "Links rastreáveis para Facebook, Instagram e outros canais" },
        "campanha-desempenho": { title: "Desempenho de campanhas", subtitle: "Resultados por Sub ID" },
        desempenho: { title: "Desempenho geral", subtitle: "Conversões e métricas" },
        "meu-site": { title: "Meu Site", subtitle: "Vendas atribuídas ao site" },
        ferramentas: { title: "Ferramentas", subtitle: "Feed, reverify e utilitários" },
    };

        function getAdminToken() {
            try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ""; } catch (_) { return ""; }
        }

        function getAdminRefreshToken() {
            try { return sessionStorage.getItem(ADMIN_REFRESH_KEY) || ""; } catch (_) { return ""; }
        }

        function setAdminSession(token, refreshToken, user) {
            try {
                if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
                else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
                if (refreshToken) sessionStorage.setItem(ADMIN_REFRESH_KEY, refreshToken);
                else if (!token) sessionStorage.removeItem(ADMIN_REFRESH_KEY);
                if (user) sessionStorage.setItem(ADMIN_USER_KEY, user);
                else if (!token) sessionStorage.removeItem(ADMIN_USER_KEY);
            } catch (_) {}
        }

        function getAdminUser() {
            try { return sessionStorage.getItem(ADMIN_USER_KEY) || ""; } catch (_) { return ""; }
        }

        function showAdminLogin(message) {
            const screen = document.getElementById("admin-login-screen");
            const panel = document.getElementById("admin-panel-root");
            if (screen) {
                screen.classList.remove("hidden");
                screen.classList.add("flex");
            }
            if (panel) {
                panel.classList.add("hidden");
                panel.classList.remove("flex");
            }
            const err = document.getElementById("admin-login-error");
            if (err) {
                if (message) {
                    err.textContent = message;
                    err.classList.remove("hidden");
                } else {
                    err.textContent = "";
                    err.classList.add("hidden");
                }
            }
            document.getElementById("admin-login-pass")?.focus();
        }

        function hideAdminLogin() {
            const screen = document.getElementById("admin-login-screen");
            if (screen) {
                screen.classList.add("hidden");
                screen.classList.remove("flex");
            }
        }

        async function refreshAdminSession() {
            const refreshToken = getAdminRefreshToken();
            if (!refreshToken) return false;
            try {
                const res = await fetch(`${API_BASE}/api/admin/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.token) return false;
                setAdminSession(data.token, data.refreshToken, data.user);
                adminLoggedIn = true;
                return true;
            } catch (_) {
                return false;
            }
        }

        async function checkAdminSession() {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const token = getAdminToken();
                try {
                    const headers = {};
                    if (token) headers["X-Admin-Token"] = token;
                    const res = await fetch(`${API_BASE}/api/admin/me`, { headers });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.ok) {
                        adminLoggedIn = true;
                        if (data.user) {
                            try { sessionStorage.setItem(ADMIN_USER_KEY, data.user); } catch (_) {}
                        }
                        return true;
                    }
                } catch (_) {}
                if (attempt === 0 && await refreshAdminSession()) continue;
                break;
            }
            adminLoggedIn = false;
            return false;
        }

        async function submitAdminLogin(event) {
            if (event) event.preventDefault();
            const userEl = document.getElementById("admin-login-user");
            const passEl = document.getElementById("admin-login-pass");
            const btn = document.getElementById("admin-login-submit");
            const err = document.getElementById("admin-login-error");
            const email = (userEl?.value || "").trim().toLowerCase();
            const password = passEl?.value || "";
            if (!email || !password) {
                if (err) { err.textContent = "Informe e-mail e senha."; err.classList.remove("hidden"); }
                return false;
            }
            if (btn) { btn.disabled = true; btn.textContent = "Entrando…"; }
            if (err) err.classList.add("hidden");
            try {
                const res = await fetch(`${API_BASE}/api/admin/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.token) {
                    throw new Error(data.error || "E-mail ou senha incorretos.");
                }
                setAdminSession(data.token, data.refreshToken, data.user || email);
                adminLoggedIn = true;
                if (passEl) passEl.value = "";
                hideAdminLogin();
                initAdminUi({ force: true });
                showToast("Login ok", "success");
            } catch (e) {
                adminLoggedIn = false;
                if (err) {
                    err.textContent = e.message || "Falha no login";
                    err.classList.remove("hidden");
                }
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = "Entrar"; }
            }
            return false;
        }

        function logoutAdmin() {
            const token = getAdminToken();
            const headers = token ? { "X-Admin-Token": token } : {};
            fetch(`${API_BASE}/api/admin/logout`, { method: "POST", headers }).catch(() => {});
            setAdminSession("", "", "");
            adminLoggedIn = false;
            showAdminLogin();
            showToast("Você saiu do painel", "success");
        }

        async function adminFetch(url, opts = {}) {
            const request = async () => {
                const headers = Object.assign({}, opts.headers || {});
                const token = getAdminToken();
                if (token) headers["X-Admin-Token"] = token;
                return fetch(url, { ...opts, headers });
            };
            let res = await request();
            if (res.status === 401 && await refreshAdminSession()) {
                res = await request();
            }
            if (res.status === 401 && isAdminMode()) {
                setAdminSession("", "", "");
                adminLoggedIn = false;
                showAdminLogin("Sessão expirada. Entre novamente.");
            }
            return res;
        }

        function ensureAdminToken() {
            return getAdminToken();
        }

        async function initAdminUi(opts = {}) {
            const panel = document.getElementById("admin-panel-root");
            const login = document.getElementById("admin-login-screen");
            if (!isAdminMode()) {
                if (panel) {
                    panel.classList.add("hidden");
                    panel.classList.remove("flex");
                }
                if (login) {
                    login.classList.add("hidden");
                    login.classList.remove("flex");
                }
                document.body.classList.remove("admin-mode");
                return;
            }

            document.body.classList.add("admin-mode");
            document.title = "Admin — Afiliada Mestre";

            if (!opts.force) {
                const ok = await checkAdminSession();
                adminAuthReady = true;
                if (!ok) {
                    showAdminLogin();
                    return;
                }
            } else {
                adminAuthReady = true;
                adminLoggedIn = true;
            }

            hideAdminLogin();
            if (panel) {
                panel.classList.remove("hidden");
                panel.classList.add("flex");
            }

            const badge = document.getElementById("admin-api-badge");
            if (badge) badge.classList.remove("hidden");

            loadSubIdSettings();
            loadShortlinkStatus();
            loadCoverageReport();
            loadAutoStatus();
            renderAdminCategoriesPanel();
            setTimeout(() => renderMoneyQueue(), 800);

            const parts = pathClean().split("/").filter(Boolean);
            let view = parts[1] || "dashboard";
            const legacyMap = {
                console: "produtos",
                performance: "desempenho",
                campaigns: "campanhas",
                "campaign-perf": "campanha-desempenho",
                "campanhas-desempenho": "campanha-desempenho",
            };
            if (legacyMap[view]) view = legacyMap[view];
            if (!ADMIN_VIEWS[view]) view = "dashboard";
            setTimeout(() => switchAdminView(view, { skipUrl: true }), 0);
        }

        function toggleAdminSidebar(forceOpen) {
            const sidebar = document.getElementById("admin-sidebar");
            const backdrop = document.getElementById("admin-sidebar-backdrop");
            if (!sidebar) return;
            const open = forceOpen === undefined ? !sidebar.classList.contains("open") : !!forceOpen;
            sidebar.classList.toggle("open", open);
            if (backdrop) backdrop.classList.toggle("hidden", !open);
        }

        function switchAdminView(view, opts = {}) {
            if (!isAdminMode()) {
                navigateTo(`/admin/${view || "dashboard"}`);
                return;
            }
            if (!ADMIN_VIEWS[view]) view = "dashboard";

            document.querySelectorAll(".admin-view").forEach(el => el.classList.remove("active"));
            const target = document.getElementById("admin-view-" + view);
            if (target) target.classList.add("active");

            document.querySelectorAll(".admin-nav-item[data-admin-view]").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.adminView === view);
            });

            const meta = ADMIN_VIEWS[view];
            const titleEl = document.getElementById("admin-page-title");
            const subEl = document.getElementById("admin-page-subtitle");
            if (titleEl && meta) titleEl.textContent = meta.title;
            if (subEl && meta) subEl.textContent = meta.subtitle;

            if (!opts.skipUrl) {
                try {
                    const next = view === "dashboard" ? "/admin" : `/admin/${view}`;
                    history.replaceState({ path: next }, "", next);
                } catch (_) {}
            }

            toggleAdminSidebar(false);
            if (view === "dashboard") {
                loadAdminStats();
                loadAutoStatus();
            } else if (view === "catalogo") {
                populateAdminCategorySelect();
                loadAutoStatus();
                loadShortlinkStatus();
                applyExplorerPreset('bestsellers');
            } else if (view === "produtos") {
                adminPage = 1;
                populateAdminProductCategoryFilter();
                renderConsoleProducts();
                populateAdminCategorySelect();
                loadAdminStats();
                if (!adminCatalogLoaded || AM.productsDatabase.length <= PAGE_SIZE) {
                    loadAdminCatalogFull({ silent: true });
                }
            } else if (view === "duplicados") {
                scanCatalogDuplicates();
            } else if (view === "campanhas") {
                renderCampaignSelectedProducts();
                updateCampaignLinkPreview();
                syncSavedCampaigns();
            } else if (view === "campanha-desempenho") {
                loadCampaignPerformance({ reset: true });
            } else if (view === "desempenho") {
                loadConversions({ reset: true });
            } else if (view === "meu-site") {
                loadMeuSiteSummary();
            } else if (view === "ferramentas") {
                // Inventário de feeds é barato (1 request), útil na abertura.
                loadFeedInventory();
                loadShopeeHealth();
            }
        }

        async function syncAllCategories({ silent = false } = {}) {
            try {
                const res = await adminFetch(`${API_BASE}/api/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ limit: 20, listType: 0, sortType: 2 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                if (!silent) showToast(`Sync: ${data.count} produtos únicos (${data.keywordsRun} keywords)`, "success");
                return data;
            } catch (err) {
                if (!silent) showToast(`Sync falhou: ${err.message}`, "error");
                return null;
            }
        }

        async function syncCategory(catId, { silent = false, pages } = {}) {
            if (!catId || catId === "todos") return syncAllCategories({ silent });
            try {
                showToast(`Buscando ofertas de "${catId}" na Shopee…`, "success");
                const pageCount = pages || Number(document.getElementById("admin-cat-pages")?.value) || 1;
                const listType = Number(document.getElementById("admin-list-type")?.value) || 0;
                const sortType = Number(document.getElementById("admin-sort-type")?.value) || 2;
                const minRating = document.getElementById("admin-min-rating")?.value;
                const res = await adminFetch(
                    `${API_BASE}/api/sync/categoria/${encodeURIComponent(catId)}?limit=25&listType=${listType}&sortType=${sortType}&pages=${pageCount}`
                    + (minRating != null && minRating !== "" ? `&minRating=${encodeURIComponent(minRating)}` : "")
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                if (!silent) {
                    const filtered = data.filteredOut ? ` · ${data.filteredOut} filtrados` : "";
                    const sl = data.shortlinks?.generated ? ` · ${data.shortlinks.generated} shortlinks` : "";
                    const skip = data.skippedExisting ? ` · ${data.skippedExisting} já existiam` : "";
                    showToast(`✓ ${data.saved || data.count} novos em "${catId}"${skip}${sl}${filtered}`, "success");
                }
                return data;
            } catch (err) {
                if (!silent) showToast(`Sync ${catId} falhou: ${err.message}`, "error");
                return null;
            }
        }

        function parseExplorerKeywords(raw) {
            return [...new Set(String(raw || "")
                .split(/[\n,;]+/)
                .map((s) => s.trim())
                .filter(Boolean))];
        }

        function updateExplorerKwCount() {
            const el = document.getElementById("explorer-kw-count");
            const n = parseExplorerKeywords(document.getElementById("admin-keyword")?.value).length;
            if (el) el.textContent = n === 1 ? "1 keyword" : `${n} keywords`;
        }

        function updateExplorerModeHint() {
            const lt = Number(document.getElementById("admin-list-type")?.value) || 0;
            const st = Number(document.getElementById("admin-sort-type")?.value) || 2;
            const matchId = document.getElementById("admin-match-id")?.value;
            const shopId = document.getElementById("admin-shop-id")?.value;
            const hint = document.getElementById("explorer-mode-hint");
            if (!hint) return;
            let extra = "";
            if ([3, 4, 6].includes(lt)) {
                extra = matchId
                    ? ` · matchId <strong class="text-slate-700">${escapeHtml(matchId)}</strong>`
                    : ` · <span class="text-amber-700 font-bold">informe matchId</span> (coleção/categoria oficial)`;
            }
            if (lt === 5) {
                extra = shopId
                    ? ` · shopId <strong class="text-slate-700">${escapeHtml(shopId)}</strong>`
                    : ` · <span class="text-amber-700 font-bold">informe shopId</span>`;
            }
            hint.innerHTML = `Modo: <strong class="text-slate-700">${LIST_TYPE_LABELS_UI[lt] || lt}</strong> · ordenado por <strong class="text-slate-700">${SORT_TYPE_LABELS_UI[st] || st}</strong>${extra}`;
        }

        function applyExplorerPreset(name) {
            const p = EXPLORER_PRESETS[name];
            if (!p) return;
            const kw = document.getElementById("admin-keyword");
            const lt = document.getElementById("admin-list-type");
            const st = document.getElementById("admin-sort-type");
            const mr = document.getElementById("admin-min-rating");
            const ms = document.getElementById("admin-min-sales");
            const rc = document.getElementById("admin-require-commission");
            const mc = document.getElementById("admin-min-commission");
            if (kw && p.keywords != null) kw.value = p.keywords;
            if (lt) lt.value = String(p.listType);
            if (st) st.value = String(p.sortType);
            if (mr) mr.value = String(p.minRating);
            if (ms) ms.value = String(p.minSales);
            if (rc) rc.checked = !!p.requireCommission;
            if (mc) mc.value = String(p.minCommissionPct != null ? p.minCommissionPct : 0);
            document.querySelectorAll(".explorer-preset").forEach((btn) => {
                const on = btn.dataset.preset === name;
                btn.classList.toggle("bg-shopee-orange", on);
                btn.classList.toggle("border-shopee-orange", on);
                btn.classList.toggle("bg-white/10", !on);
                btn.classList.toggle("border-white/10", !on);
            });
            updateExplorerKwCount();
            updateExplorerModeHint();
            if (p.matchIdHint) showToast("Cole o collectionId/categoryId no campo matchId (Ofertas oficiais)", "info");
            else if (p.shopIdHint) showToast("Cole o shopId da loja no campo shopId", "info");
            else showToast(`Preset: ${name}`, "success");
        }

        function getExplorerFormParams() {
            const matchRaw = document.getElementById("admin-match-id")?.value;
            const shopRaw = document.getElementById("admin-shop-id")?.value;
            const matchId = matchRaw ? Number(matchRaw) : null;
            const shopId = shopRaw ? Number(shopRaw) : null;
            return {
                keywords: parseExplorerKeywords(document.getElementById("admin-keyword")?.value),
                limit: Number(document.getElementById("admin-limit")?.value) || 20,
                pages: Number(document.getElementById("admin-pages")?.value) || 1,
                listType: Number(document.getElementById("admin-list-type")?.value) || 0,
                sortType: Number(document.getElementById("admin-sort-type")?.value) || 2,
                minRating: Number(document.getElementById("admin-min-rating")?.value) || 4,
                minSales: Number(document.getElementById("admin-min-sales")?.value) || 0,
                requireCommission: !!document.getElementById("admin-require-commission")?.checked,
                minCommissionPct: Number(document.getElementById("admin-min-commission")?.value) || 0,
                matchId: Number.isFinite(matchId) && matchId > 0 ? matchId : null,
                shopId: Number.isFinite(shopId) && shopId > 0 ? shopId : null,
            };
        }

        function setExplorerProgress(show, pct = 0, label = "") {
            const wrap = document.getElementById("explorer-progress");
            const bar = document.getElementById("explorer-progress-bar");
            const pctEl = document.getElementById("explorer-progress-pct");
            const lab = document.getElementById("explorer-progress-label");
            if (!wrap) return;
            wrap.classList.toggle("hidden", !show);
            if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
            if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
            if (lab && label) lab.textContent = label;
        }

        function setExplorerStatus(type, html) {
            const el = document.getElementById("explorer-status");
            if (!el) return;
            if (!html) {
                el.classList.add("hidden");
                el.innerHTML = "";
                return;
            }
            const styles = {
                info: "bg-slate-50 border-slate-200 text-slate-600",
                success: "bg-emerald-50 border-emerald-200 text-emerald-800",
                empty: "bg-amber-50 border-amber-200 text-amber-900",
                error: "bg-red-50 border-red-200 text-red-700",
                rate: "bg-orange-50 border-orange-200 text-orange-900",
            };
            el.className = `text-[11px] rounded-lg px-3 py-2 border ${styles[type] || styles.info}`;
            el.innerHTML = html;
            el.classList.remove("hidden");
        }

        function setExplorerBusy(busy) {
            explorerBusy = busy;
            const btn = document.getElementById("btn-explorer-search");
            const cancel = document.getElementById("btn-explorer-cancel");
            if (btn) {
                btn.disabled = busy;
                btn.innerHTML = busy
                    ? `<i class="fas fa-spinner fa-spin"></i> Buscando…`
                    : `<i class="fas fa-magnifying-glass"></i> Pré-visualizar`;
            }
            if (cancel) cancel.classList.toggle("hidden", !busy);
        }

        function cancelExplorerSearch() {
            if (explorerAbort) {
                explorerAbort.abort();
                explorerAbort = null;
            }
            setExplorerBusy(false);
            setExplorerProgress(false);
            setExplorerStatus("info", "Busca cancelada. Os resultados já obtidos foram mantidos.");
        }

        function renderExplorerPreview(products, meta = {}) {
            const box = document.getElementById("explorer-preview");
            if (!box) return;
            const sorted = sortByMoney(Array.isArray(products) ? products : []);
            explorerProducts = sorted;
            explorerSelected = new Set(explorerProducts.map((p) => String(p.itemId || p.id)));
            const selAll = document.getElementById("explorer-select-all");
            if (selAll) selAll.checked = explorerProducts.length > 0;

            if (!explorerProducts.length) {
                box.innerHTML = `
                    <div class="text-center py-8 text-slate-400 text-[11px]">
                        <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                        Nenhum produto na prévia.
                        ${meta.rateLimited ? "<br><strong class='text-orange-700'>Possível rate-limit da Shopee — aguarde e tente de novo.</strong>" : ""}
                        ${meta.filteredOut ? `<br>${meta.filteredOut} itens filtrados pelos critérios de qualidade.` : ""}
                    </div>`;
                updateExplorerSelectionMeta();
                return;
            }

            box.innerHTML = explorerProducts.map((p) => {
                const id = String(p.itemId || p.id);
                const img = p.image || "";
                const price = Number(p.newPrice || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const stars = Number(p.stars || 0).toFixed(1);
                const commission = p.commissionRate || "—";
                const score = moneyScoreOf(p).toFixed(1);
                const mall = isOfficialShop(p.shopType) ? '<span class="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded">Mall</span>' : '';
                const catLabel = (AM.categories.find(c => c.id === p.category) || {}).label || p.category || "—";
                const subLabel = ((AM.categories.find(c => c.id === p.category) || {}).subcategories || [])
                    .find(s => s.id === p.subcategory)?.label || p.subcategory || "";
                const taxBadge = p.category && p.category !== "todos"
                    ? `<span class="bg-orange-50 text-shopee-orange font-bold px-1.5 py-0.5 rounded">${escapeHtml(catLabel)}${subLabel ? " · " + escapeHtml(subLabel) : ""}</span>`
                    : `<span class="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">Sem categoria</span>`;
                return `
                <label class="flex gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-shopee-orange/40 hover:bg-orange-50/30 cursor-pointer transition">
                    <input type="checkbox" class="explorer-item-cb mt-1 rounded border-slate-300 text-shopee-orange focus:ring-shopee-orange"
                        data-id="${escapeHtml(id)}" checked onchange="onExplorerItemToggle('${escapeHtml(id)}', this.checked)">
                    <img src="${escapeHtml(img)}" alt="" class="w-12 h-12 rounded-md object-cover bg-slate-100 shrink-0" loading="lazy"
                        onerror="this.src='https://via.placeholder.com/48?text=…'">
                    <div class="min-w-0 flex-1">
                        <p class="font-bold text-slate-800 text-[11px] leading-snug line-clamp-2">${escapeHtml(p.title || "")}</p>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500">
                            <span class="font-black text-shopee-orange">${price}</span>
                            <span><i class="fas fa-star text-amber-400"></i> ${stars}</span>
                            <span>${escapeHtml(String(p.sales || "—"))}</span>
                            <span class="text-emerald-700 font-bold">${escapeHtml(String(commission))}</span>
                            <span class="text-amber-700 font-bold">score ${score}</span>
                            ${mall}
                            ${taxBadge}
                            ${p.keyword ? `<span class="text-slate-400">· ${escapeHtml(p.keyword)}</span>` : ""}
                        </div>
                    </div>
                </label>`;
            }).join("");
            updateExplorerSelectionMeta();
        }

        function onExplorerItemToggle(id, checked) {
            if (checked) explorerSelected.add(String(id));
            else explorerSelected.delete(String(id));
            const selAll = document.getElementById("explorer-select-all");
            if (selAll) selAll.checked = explorerProducts.length > 0 && explorerSelected.size === explorerProducts.length;
            updateExplorerSelectionMeta();
        }

        function toggleExplorerSelectAll(checked) {
            explorerSelected = checked
                ? new Set(explorerProducts.map((p) => String(p.itemId || p.id)))
                : new Set();
            document.querySelectorAll(".explorer-item-cb").forEach((cb) => { cb.checked = checked; });
            updateExplorerSelectionMeta();
        }

        function updateExplorerSelectionMeta() {
            const meta = document.getElementById("explorer-selection-meta");
            const btn = document.getElementById("btn-explorer-save");
            if (meta) meta.textContent = `${explorerSelected.size} selecionados · ${explorerProducts.length} na prévia`;
            if (btn) btn.disabled = explorerSelected.size === 0;
        }

        async function runExplorerSearch({ sync = false } = {}) {
            if (explorerBusy) return;
            const params = getExplorerFormParams();
            const needsMatch = [3, 4, 6].includes(params.listType);
            const needsShop = params.listType === 5;
            if (needsMatch && !params.matchId) {
                setExplorerStatus("error", "listType 3/4/6 exige <strong>matchId</strong> (collectionId ou categoryId das Ofertas oficiais).");
                showToast("Informe o matchId", "error");
                return;
            }
            if (needsShop && !params.shopId) {
                setExplorerStatus("error", "listType 5 exige <strong>shopId</strong> da loja Shopee.");
                showToast("Informe o shopId", "error");
                return;
            }
            if (!params.keywords.length && !params.matchId && !params.shopId) {
                setExplorerStatus("error", "Informe keyword(s), matchId ou shopId.");
                showToast("Digite uma keyword ou ID", "error");
                return;
            }

            explorerAbort = new AbortController();
            setExplorerBusy(true);
            setExplorerProgress(true, 8, sync ? "Buscando e salvando…" : "Pré-visualizando na Shopee…");
            const modeLabel = LIST_TYPE_LABELS_UI[params.listType] || "lista";
            setExplorerStatus("info", `Consultando ${params.keywords.length || 1} origem(ns) × ${params.pages} página(s) · ${modeLabel}…`);

            let fakePct = 8;
            const tick = setInterval(() => {
                fakePct = Math.min(90, fakePct + (90 - fakePct) * 0.08);
                setExplorerProgress(true, fakePct, `Shopee · ${modeLabel}…`);
            }, 400);

            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/batch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: explorerAbort.signal,
                    body: JSON.stringify({
                        keywords: params.keywords,
                        pages: params.pages,
                        pageStart: 1,
                        limit: params.limit,
                        listType: params.listType,
                        sortType: params.sortType,
                        minRating: params.minRating,
                        minSales: params.minSales,
                        requireCommission: params.requireCommission,
                        minCommissionPct: params.minCommissionPct,
                        matchId: params.matchId,
                        shopId: params.shopId,
                        sync,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                clearInterval(tick);
                if (!res.ok) {
                    const rate = data.rateLimited || res.status === 429;
                    setExplorerStatus(rate ? "rate" : "error", escapeHtml(data.error || `HTTP ${res.status}`));
                    showToast(data.error || "Falha na busca", "error");
                    return;
                }
                setExplorerProgress(true, 100, "Pronto");
                renderExplorerPreview(data.products || [], data);
                const savedBit = sync && data.saved ? ` · <strong>${data.saved} salvos</strong>` : "";
                setExplorerStatus(
                    data.count ? "success" : "empty",
                    `${data.count || 0} produtos · ${modeLabel}${data.filteredOut ? ` · ${data.filteredOut} filtrados` : ""}${savedBit}${data.rateLimited ? " · rate-limit" : ""}`
                );
                if (sync && data.saved) {
                    showToast(`Salvos ${data.saved} com shortlink`, "success");
                    await loadOffersFromSupabase({ silent: true, reset: true });
                    loadShortlinkStatus();
                    renderMoneyQueue();
                }
            } catch (err) {
                clearInterval(tick);
                if (err.name === "AbortError") return;
                setExplorerStatus("error", escapeHtml(err.message || "Erro na busca"));
                showToast(err.message || "Erro", "error");
            } finally {
                setExplorerBusy(false);
                setTimeout(() => setExplorerProgress(false), 600);
                explorerAbort = null;
            }
        }

        async function saveExplorerSelection() {
            const selected = explorerProducts.filter((p) => explorerSelected.has(String(p.itemId || p.id)));
            if (!selected.length) {
                showToast("Selecione ao menos um produto", "error");
                return;
            }
            // Deduplicar por itemId (já único na prévia, reforço)
            const byId = new Map();
            for (const p of selected) byId.set(String(p.itemId || p.id), p);
            const products = [...byId.values()];
            const btn = document.getElementById("btn-explorer-save");
            const original = btn ? btn.innerHTML : "";
            if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Salvando…`; }
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/save-bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        products,
                        listType: Number(document.getElementById("admin-list-type")?.value) || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const sl = data.shortlinks || {};
                const skip = data.skippedExisting ? ` · ${data.skippedExisting} já existiam` : "";
                const slMsg = sl.generated
                    ? ` · ${sl.generated} shortlinks prontos`
                    : (sl.failed ? ` · ${sl.failed} shortlinks falharam` : "");
                showToast(`Salvos: ${data.saved} novos${skip}${slMsg}`, "success");
                setExplorerStatus("success", `<strong>${data.saved}</strong> novos gravados${data.skippedExisting ? ` · <strong>${data.skippedExisting}</strong> ignorados (já postados)` : ""}${sl.generated ? ` · <strong>${sl.generated}</strong> shope.ee` : ""}.`);
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                populateAdminCategorySelect();
                loadAdminStats();
                loadShortlinkStatus();
            } catch (err) {
                showToast(`Falha ao salvar: ${err.message}`, "error");
                setExplorerStatus("error", escapeHtml(err.message));
            } finally {
                if (btn) { btn.disabled = explorerSelected.size === 0; btn.innerHTML = original; }
            }
        }

        async function fetchLiveOffers(syncToSupabase = false, opts = {}) {
            // Compat: busca simples ainda funciona; multi-keyword usa o Explorador
            const raw = opts.keyword
                || document.getElementById("admin-keyword")?.value
                || document.getElementById("store-search-input")?.value
                || "oferta";
            const keywords = parseExplorerKeywords(raw);
            if (keywords.length > 1 || Number(document.getElementById("admin-pages")?.value) > 1) {
                if (document.getElementById("admin-keyword") && opts.keyword) {
                    document.getElementById("admin-keyword").value = keywords.join(", ");
                }
                return runExplorerSearch({ sync: syncToSupabase });
            }
            const keyword = keywords[0] || "oferta";
            const limit = document.getElementById("admin-limit")?.value || 20;
            const listType = Number(document.getElementById("admin-list-type")?.value) || 0;
            const sortType = Number(document.getElementById("admin-sort-type")?.value) || 2;
            const minRating = document.getElementById("admin-min-rating")?.value ?? 4;
            const minSales = document.getElementById("admin-min-sales")?.value ?? 0;
            const requireCommission = document.getElementById("admin-require-commission")?.checked ? "1" : "0";
            const sync = syncToSupabase ? "&sync=1" : "";
            try {
                const res = await fetch(
                    `${API_BASE}/api/ofertas?keyword=${encodeURIComponent(keyword)}&limit=${limit}&listType=${listType}&sortType=${sortType}`
                    + `&minRating=${encodeURIComponent(minRating)}&minSales=${encodeURIComponent(minSales)}&requireCommission=${requireCommission}${sync}`
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const ok = applyProducts(data.products, "shopee");
                renderExplorerPreview(data.products || [], { filteredOut: data.filteredOut, rateLimited: data.rateLimited });
                if (data.count === 0) {
                    setExplorerStatus(data.rateLimited ? "rate" : "empty",
                        data.rateLimited
                            ? "Rate-limit da Shopee."
                            : `Nenhum produto. Filtrados: ${data.filteredOut || 0}.`);
                } else {
                    setExplorerStatus("success",
                        `<strong>${data.count}</strong> · ${data.listTypeLabel || ""} · ${data.sortTypeLabel || ""} · filtrados ${data.filteredOut || 0}${data.saved ? ` · ${data.saved} salvos` : ""}`);
                }
                if (isAdminMode()) loadAdminStats();
                if (!opts.silent) {
                    showToast(ok
                        ? `Shopee: ${data.count} ofertas${data.saved ? ` · ${data.saved} no Supabase` : ""}`
                        : "Shopee respondeu sem produtos",
                        ok ? "success" : "error");
                }
                setApiStatus("API Status: Shopee ao vivo", true);
                return ok;
            } catch (err) {
                if (!opts.silent) showToast(`Erro Shopee: ${err.message}`, "error");
                setExplorerStatus("error", escapeHtml(err.message));
                return false;
            }
        }

        function updateAdminCatalogProgress(loaded, total) {
            const loadedEl = document.getElementById('count-db-loaded');
            if (!loadedEl) return;
            if (adminCatalogLoading) {
                loadedEl.textContent = total
                    ? `· carregando ${loaded}/${total}…`
                    : `· carregando ${loaded}…`;
                return;
            }
            if (total > loaded) {
                loadedEl.textContent = `· ${loaded} na memória (faltam ${total - loaded})`;
            } else if (loaded > 0) {
                loadedEl.textContent = `· ${loaded} carregados`;
            } else {
                loadedEl.textContent = '';
            }
        }

        async function loadAdminCatalogFull({ silent = false, force = false } = {}) {
            if (!isAdminMode()) return false;
            if (adminCatalogLoading) return false;
            if (adminCatalogLoaded && !force && AM.productsDatabase.length > PAGE_SIZE) {
                renderConsoleProducts();
                return true;
            }
            adminCatalogLoading = true;
            const BATCH = 200;
            let offset = 0;
            let all = [];
            let knownTotal = Number((AM.categories.find(c => c.id === 'todos') || {}).count) || 0;
            const btn = document.getElementById('btn-load-full-catalog');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Carregando…';
            }
            updateAdminCatalogProgress(0, knownTotal);
            try {
                while (offset < 10000) {
                    const url = `${API_BASE}/api/ofertas/db?limit=${BATCH}&offset=${offset}&sort=recent`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                    const batch = Array.isArray(data.products) ? data.products : [];
                    all = all.concat(batch);
                    updateAdminCatalogProgress(all.length, knownTotal || all.length);
                    if (batch.length < BATCH) break;
                    offset += BATCH;
                }
                const map = new Map(all.map(p => [String(p.id), p]));
                AM.productsDatabase = [...map.values()];
                adminCatalogLoaded = true;
                lastApiSource = 'supabase-full';
                renderConsoleProducts();
                populateAdminProductCategoryFilter();
                loadAdminStats();
                updateAdminCatalogProgress(AM.productsDatabase.length, knownTotal || AM.productsDatabase.length);
                if (!silent) {
                    showToast(`Catálogo completo: ${AM.productsDatabase.length} produtos`, 'success');
                }
                return true;
            } catch (err) {
                if (!silent) showToast(`Erro ao carregar catálogo: ${err.message}`, 'error');
                updateAdminCatalogProgress(AM.productsDatabase.length, knownTotal);
                return false;
            } finally {
                adminCatalogLoading = false;
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-cloud-arrow-down mr-1"></i> Carregar catálogo completo';
                }
                updateAdminCatalogProgress(
                    AM.productsDatabase.length,
                    Number((AM.categories.find(c => c.id === 'todos') || {}).count) || AM.productsDatabase.length
                );
            }
        }

        async function syncDefaultKeywords() {
            showToast("Sincronizando keywords na Shopee…", "success");
            try {
                const res = await adminFetch(`${API_BASE}/api/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ limit: 12, listType: 0, sortType: 2 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                applyProducts(data.products, "sync");
                showToast(`Sync OK: ${data.count} produtos únicos no Supabase`, "success");
            } catch (err) {
                showToast(`Sync falhou: ${err.message}`, "error");
            }
        }

        function productSubIdsLabel(p) {
            if (Array.isArray(p?.subIds) && p.subIds.length) return p.subIds.join(' | ');
            return [
                SITE_SUBID,
                'organico',
                'vitrine',
                sanitizeSubId(p?.category, 'geral'),
                sanitizeSubId(p?.id ? `p${p.id}` : 'produto', 'produto'),
            ].join(' | ');
        }

        function buildCampaignShareUrl(channel, campaign, productId = '') {
            // Links com produto vão para /p/:id (SSR popup rápido).
            // Links sem produto continuam na home com UTMs preservados.
            const basePath = productId ? `/p/${encodeURIComponent(String(productId))}` : '/';
            const url = new URL(location.origin + basePath);
            url.searchParams.set('utm_source', sanitizeSubId(channel, 'organico'));
            url.searchParams.set('utm_campaign', sanitizeSubId(campaign, 'vitrine'));
            url.searchParams.set('utm_medium', 'social');
            return url.toString();
        }

        function getCampaignSelectedProducts() {
            return campaignSelectedProducts;
        }

        function addProductToCampaign(productOrId, { silent = false } = {}) {
            const p = typeof productOrId === 'object'
                ? productOrId
                : AM.productsDatabase.find(x => String(x.id) === String(productOrId));
            const id = p ? p.id : Number(productOrId);
            if (!id) {
                if (!silent) showToast('Informe um ID de produto válido', 'error');
                return false;
            }
            if (campaignSelectedProducts.some(x => String(x.id) === String(id))) {
                if (!silent) showToast('Produto já está na campanha', 'error');
                return false;
            }
            campaignSelectedProducts.push({
                id,
                title: p?.title || `Produto ${id}`,
                category: p?.category || 'geral',
                image: p?.image || '',
                price: Number(p?.newPrice) || 0,
                shortLink: p?.shortLink || '',
                affiliateLink: p?.affiliateLink && p.affiliateLink !== '#' ? p.affiliateLink : '',
            });
            if (!silent) {
                renderCampaignSelectedProducts();
                updateCampaignLinkPreview();
            }
            return true;
        }

        function removeProductFromCampaign(id) {
            campaignSelectedProducts = campaignSelectedProducts.filter(x => String(x.id) !== String(id));
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
        }

        function setCampaignProductStatus(html) {
            const el = document.getElementById('campaign-product-status');
            if (el) el.innerHTML = html || '';
        }

        /** Extrai o item_id de um ID puro ou de qualquer formato de link da Shopee. */
        function parseShopeeItemId(raw) {
            const value = String(raw || '').trim();
            const bySlug = value.match(/-i\.\d+\.(\d+)/i);
            if (bySlug) return bySlug[1];
            const byPath = value.match(/\/product\/\d+\/(\d+)/i);
            if (byPath) return byPath[1];
            return /^\d+$/.test(value) ? value : '';
        }

        /**
         * Busca o produto pelo ID/link e já o adiciona à campanha com nome e foto.
         * Item que ainda não está na vitrine é publicado pelo servidor antes de voltar.
         */
        async function resolveCampaignProductById(rawInput) {
            const raw = String(rawInput || '').trim();
            if (!raw) {
                showToast('Informe o ID do produto ou o link da Shopee', 'error');
                return false;
            }
            const itemId = parseShopeeItemId(raw);
            const known = itemId && AM.productsDatabase.find(p => String(p.id) === String(itemId));
            if (known) {
                const added = addProductToCampaign(known);
                if (added) {
                    setCampaignProductStatus('');
                    clearCampaignProductSearch();
                    showToast(`"${known.title}" adicionado — já estava na vitrine`, 'success');
                }
                return added;
            }
            if (campaignProductResolving) return false;
            campaignProductResolving = true;
            setCampaignProductStatus('<i class="fas fa-spinner fa-spin mr-1"></i> Buscando o produto na Shopee…');
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/campanha/produto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: raw }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.product) throw new Error(data?.error || `HTTP ${res.status}`);
                const product = data.product;
                if (!AM.productsDatabase.some(p => String(p.id) === String(product.id))) {
                    AM.productsDatabase.push(product);
                }
                const added = addProductToCampaign(product);
                const tracking = data.tracking || {};
                setCampaignProductStatus(
                    tracking.shortLink
                        ? `<span class="text-emerald-600"><i class="fas fa-check mr-1"></i>Link de afiliado gerado pela API: <span class="font-mono">${escapeHtml(tracking.shortLink)}</span></span>`
                        : `<span class="text-amber-600"><i class="fas fa-triangle-exclamation mr-1"></i>Link de afiliado da API salvo, mas o shope.ee com Sub IDs ficou pendente (a Shopee limitou a chamada). Ele é gerado no próximo ciclo ou no primeiro clique.</span>`
                );
                clearCampaignProductSearch();
                if (added) {
                    const where = data.added
                        ? 'publicado na vitrine'
                        : data.repaired
                            ? 'já estava na vitrine, link de afiliado atualizado'
                            : 'já estava na vitrine';
                    showToast(`"${product.title}" — ${where}`, 'success');
                }
                return added;
            } catch (err) {
                setCampaignProductStatus(`<span class="text-red-500">${escapeHtml(err.message)}</span>`);
                showToast(`Não foi possível buscar o produto: ${err.message}`, 'error');
                return false;
            } finally {
                campaignProductResolving = false;
            }
        }

        function clearCampaignProductSearch() {
            const input = document.getElementById('campaign-product-search');
            if (input) input.value = '';
            renderCampaignProductPicker();
        }

        function onCampaignProductSearchKey(event) {
            if (event?.key !== 'Enter') return;
            event.preventDefault();
            addCampaignProductById();
        }

        function addCampaignProductById() {
            const typed = (document.getElementById('campaign-product-search')?.value || '').trim();
            const raw = typed || prompt('Cole o ID do produto Shopee (ou o link do item):') || '';
            return resolveCampaignProductById(raw);
        }

        function renderCampaignProductPicker() {
            const box = document.getElementById('campaign-product-picker');
            const raw = (document.getElementById('campaign-product-search')?.value || '').trim();
            if (!box) return;
            if (!raw || raw.length < 2) {
                box.innerHTML = '';
                setCampaignProductStatus('');
                return;
            }
            const q = raw.toLowerCase();
            const hits = AM.productsDatabase
                .filter(p =>
                    String(p.id).includes(q)
                    || String(p.title || '').toLowerCase().includes(q)
                )
                .slice(0, 8);
            const looksLikeId = Boolean(parseShopeeItemId(raw));
            const lookupRow = looksLikeId
                ? `<button type="button" onclick="resolveCampaignProductById('${escapeAttr(raw)}')"
                        class="w-full flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100 text-left hover:bg-orange-100">
                        <i class="fas fa-cloud-arrow-down text-shopee-orange"></i>
                        <span class="min-w-0 flex-1">
                            <span class="block text-[11px] font-bold text-slate-700">Buscar na Shopee e usar este item</span>
                            <span class="block text-[9px] text-slate-500">Publica na vitrine se ainda não estiver lá</span>
                        </span>
                    </button>`
                : '';
            if (!hits.length) {
                box.innerHTML = lookupRow
                    || `<p class="text-[10px] text-slate-400 px-1">Nenhum produto do catálogo com esse termo. Cole o ID ou o link da Shopee.</p>`;
                return;
            }
            box.innerHTML = lookupRow + hits.map(p => `
                <button type="button" onclick="addProductToCampaign('${String(p.id).replace(/'/g, '')}'); clearCampaignProductSearch();"
                    class="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-orange-50 text-left border border-transparent hover:border-orange-100">
                    <img src="${escapeAttr(thumbUrl(p.image) || p.image || '')}" class="w-8 h-8 rounded object-cover bg-slate-100 shrink-0" alt=""
                        onerror="this.style.display='none'">
                    <span class="min-w-0 flex-1">
                        <span class="block text-[11px] font-semibold text-slate-700 truncate">${escapeHtml(p.title)}</span>
                        <span class="block text-[9px] text-slate-400 font-mono">ID ${escapeHtml(String(p.id))}</span>
                    </span>
                    <i class="fas fa-plus text-shopee-orange text-[10px]"></i>
                </button>
            `).join('');
        }

        function renderCampaignSelectedProducts() {
            const box = document.getElementById('campaign-selected-products');
            if (!box) return;
            if (!campaignSelectedProducts.length) {
                box.innerHTML = `<p class="text-[10px] text-slate-400">Nenhum produto selecionado (campanha geral).</p>`;
                return;
            }
            box.innerHTML = campaignSelectedProducts.map(p => {
                const price = Number(p.price) > 0 ? formatMoneyBRL(p.price) : '';
                const affiliate = p.shortLink
                    ? `<span class="text-emerald-600 font-bold"><i class="fas fa-link mr-0.5"></i>${escapeHtml(p.shortLink)}</span>`
                    : p.affiliateLink
                        ? '<span class="text-emerald-600 font-bold"><i class="fas fa-check mr-0.5"></i>link de afiliado da API</span>'
                        : '<span class="text-amber-600 font-bold"><i class="fas fa-triangle-exclamation mr-0.5"></i>sem link de afiliado</span>';
                return `
                <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                    <img src="${escapeAttr(thumbUrl(p.image) || p.image || '')}" class="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0" alt=""
                        onerror="this.style.display='none'">
                    <div class="min-w-0 flex-1">
                        <p class="text-[11px] font-semibold text-slate-700 truncate">${escapeHtml(p.title)}</p>
                        <p class="text-[9px] text-slate-400">
                            <span class="font-mono">p${escapeHtml(String(p.id))}</span>
                            ${p.category ? ` · ${escapeHtml(p.category)}` : ''}
                            ${price ? ` · <span class="text-emerald-600 font-bold">${price}</span>` : ''}
                        </p>
                        <p class="text-[9px] truncate">${affiliate}</p>
                    </div>
                    <button type="button" onclick="removeProductFromCampaign('${String(p.id).replace(/'/g, '')}')"
                        class="text-red-400 hover:text-red-600 px-2" title="Remover"><i class="fas fa-times"></i></button>
                </div>`;
            }).join('');
        }

        /**
         * A Shopee só aceita letras e números nos Sub IDs. Mostra o nome final
         * para o admin não achar que "ads_vestidos" chega assim no relatório.
         */
        function renderCampaignNameHint(rawName) {
            const el = document.getElementById('campaign-name-normalized');
            if (!el) return;
            const typed = String(rawName || '').trim();
            const normalized = sanitizeSubId(typed, 'vitrine');
            const changed = typed && normalized !== typed.toLowerCase();
            el.innerHTML = `No relatório da Shopee aparece como <span class="font-mono font-bold text-slate-700">${escapeHtml(normalized)}</span>`
                + (changed ? ` <span class="text-amber-600">— espaços, acentos e símbolos são removidos</span>` : '');
        }

        function currentCampaignSignature() {
            const channel = sanitizeSubId(document.getElementById('campaign-link-channel')?.value || 'facebook', 'facebook');
            const campaign = sanitizeSubId(document.getElementById('campaign-link-name')?.value || 'promo_vitrine', 'vitrine');
            return `${channel}|${campaign}`;
        }

        /**
         * Pede à Shopee um shortlink por produto com os Sub IDs desta campanha
         * (canal no slot 2, campanha no slot 3). O link orgânico do produto na
         * vitrine continua intocado.
         */
        async function generateCampaignShopeeLinks({ silent = false } = {}) {
            const selected = getCampaignSelectedProducts();
            if (!selected.length) {
                if (!silent) showToast('Adicione ao menos um produto para gerar o link da Shopee', 'error');
                return {};
            }
            if (campaignShopeeLoading) return campaignShopeeLinks;
            const signature = currentCampaignSignature();
            const [channel, campaign] = signature.split('|');
            campaignShopeeLoading = true;
            updateCampaignLinkPreview();
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/campanha/links`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel, campaign, productIds: selected.map(p => p.id) }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                // Se o admin trocou canal/campanha durante a request, o response é
                // pra combinação antiga — descarta em vez de sobrescrever o estado.
                if (signature !== currentCampaignSignature()) {
                    if (!silent) showToast('Canal/campanha mudou — gere novamente', 'warning');
                    return campaignShopeeLinks;
                }
                const map = {};
                for (const link of data.links || []) {
                    if (link.shopeeUrl) map[String(link.productId)] = { url: link.shopeeUrl, subIds: link.subIds || [] };
                }
                campaignShopeeLinks = map;
                campaignShopeeKey = signature;
                const ok = Object.keys(map).length;
                const failed = selected.length - ok;
                if (!silent) {
                    showToast(
                        failed
                            ? `${ok} link(s) de afiliado gerado(s), ${failed} falhou(aram) na Shopee`
                            : `${ok} link(s) de afiliado gerado(s) na Shopee`,
                        failed ? 'error' : 'success'
                    );
                }
                return map;
            } catch (err) {
                if (!silent) showToast(`Não foi possível gerar na Shopee: ${err.message}`, 'error');
                return campaignShopeeLinks;
            } finally {
                campaignShopeeLoading = false;
                updateCampaignLinkPreview();
            }
        }

        function copyCampaignShopeeLinks() {
            const urls = Object.values(campaignShopeeLinks).map(v => v.url).filter(Boolean);
            if (!urls.length) {
                showToast('Gere os links da Shopee primeiro', 'error');
                return;
            }
            navigator.clipboard?.writeText(urls.join('\n')).then(() => {
                showToast(urls.length > 1 ? `${urls.length} links da Shopee copiados!` : 'Link da Shopee copiado!', 'success');
            }).catch(() => showToast('Copie manualmente', 'error'));
        }

        function updateCampaignLinkPreview() {
            const channel = document.getElementById('campaign-link-channel')?.value || 'facebook';
            const campaign = document.getElementById('campaign-link-name')?.value || 'promo_vitrine';
            const el = document.getElementById('campaign-link-preview');
            const selected = getCampaignSelectedProducts();
            if (!el) return;

            // Trocar canal/campanha muda os Sub IDs: o link Shopee antigo não vale mais.
            if (campaignShopeeKey && campaignShopeeKey !== currentCampaignSignature()) {
                campaignShopeeLinks = {};
                campaignShopeeKey = '';
            }
            renderCampaignNameHint(campaign);

            if (!selected.length) {
                const url = buildCampaignShareUrl(channel, campaign);
                el.innerHTML = `
                    <div class="space-y-1">
                        <p class="text-[9px] font-bold text-slate-500">Vitrine geral</p>
                        <p class="font-mono text-[10px] text-slate-700 break-all select-all" data-campaign-url="${escapeAttr(url)}">${escapeHtml(url)}</p>
                        <p class="text-[9px] text-slate-400">Link de afiliado da Shopee só existe com produto selecionado.</p>
                    </div>`;
                updateSubIdPreview(channel, campaign, null);
                return;
            }

            el.innerHTML = selected.map(p => {
                const url = buildCampaignShareUrl(channel, campaign, p.id);
                const shopee = campaignShopeeLinks[String(p.id)];
                const shopeeRow = shopee
                    ? `<p class="font-mono text-[9px] text-emerald-700 break-all select-all" data-shopee-url="${escapeAttr(shopee.url)}">${escapeHtml(shopee.url)}</p>`
                    : campaignShopeeLoading
                        ? `<p class="text-[9px] text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i>gerando na Shopee…</p>`
                        : `<p class="text-[9px] text-slate-400">Clique em “Gerar links da Shopee”.</p>`;
                return `
                <div class="border border-slate-200 rounded-lg p-2 bg-white space-y-1.5">
                    <div class="flex items-center gap-2">
                        <img src="${escapeAttr(thumbUrl(p.image) || p.image || '')}" class="w-9 h-9 rounded object-cover bg-slate-100 shrink-0" alt=""
                            onerror="this.style.display='none'">
                        <p class="text-[10px] font-bold text-slate-700 truncate min-w-0 flex-1">${escapeHtml(p.title)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] uppercase font-black text-slate-400">Link do anúncio (site + Pixel)</p>
                        <p class="font-mono text-[9px] text-slate-600 break-all select-all" data-campaign-url="${escapeAttr(url)}">${escapeHtml(url)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] uppercase font-black text-slate-400">Link de afiliado Shopee (post direto)</p>
                        ${shopeeRow}
                    </div>
                </div>`;
            }).join('');
            updateSubIdPreview(channel, campaign, selected[0]);
        }

        function copyCampaignLink() {
            const nodes = document.querySelectorAll('#campaign-link-preview [data-campaign-url]');
            const urls = [...nodes].map(n => n.getAttribute('data-campaign-url') || n.textContent.trim()).filter(Boolean);
            if (!urls.length) return;
            navigator.clipboard?.writeText(urls.join('\n')).then(() => {
                showToast(urls.length > 1 ? `${urls.length} links copiados!` : 'Link de campanha copiado!', 'success');
            }).catch(() => {
                showToast('Copie o link manualmente', 'error');
            });
        }

        function updateSubIdPreview(channel, campaign, product) {
            const preview = document.getElementById('subid-preview');
            if (!preview) return;
            const ch = sanitizeSubId(channel || document.getElementById('campaign-link-channel')?.value || 'facebook', 'facebook');
            const camp = sanitizeSubId(campaign || document.getElementById('campaign-link-name')?.value || 'promo_vitrine', 'vitrine');
            const cat = product?.category || 'moda';
            const pid = product?.id ? `p${product.id}` : 'p123456';
            const ids = [SITE_SUBID, `${ch}_social`, camp, sanitizeSubId(cat, 'geral'), sanitizeSubId(pid, 'produto')];
            preview.textContent = `No clique Comprar (exemplo): ${ids.join(' | ')}`;
        }

        function loadSubIdSettings() {
            localStorage.removeItem('afiliada_mestre_subids');
            captureTrafficAttribution();
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
        }

        function readSavedCampaigns() {
            try {
                const list = JSON.parse(localStorage.getItem(SAVED_CAMPAIGNS_KEY) || '[]');
                return Array.isArray(list) ? list : [];
            } catch (_) {
                return [];
            }
        }

        function writeSavedCampaigns(list) {
            try {
                localStorage.setItem(SAVED_CAMPAIGNS_KEY, JSON.stringify(list.slice(0, 50)));
            } catch (_) {
                showToast('Não foi possível salvar (armazenamento cheio)', 'error');
            }
        }

        async function saveCurrentCampaign() {
            const channel = document.getElementById('campaign-link-channel')?.value || 'facebook';
            const campaign = sanitizeSubId(
                document.getElementById('campaign-link-name')?.value || 'promo_vitrine',
                'vitrine'
            );
            const products = getCampaignSelectedProducts().map(p => ({
                id: p.id,
                title: p.title,
                category: p.category,
                image: p.image,
                price: Number(p.price) || 0,
            }));
            // Toda campanha com produto sai daqui com o link de afiliado da Shopee
            // gerado pela API, com os Sub IDs deste canal/campanha.
            if (products.length && campaignShopeeKey !== currentCampaignSignature()) {
                showToast('Gerando links de afiliado na Shopee…', 'success');
                await generateCampaignShopeeLinks({ silent: true });
            }

            const links = products.length
                ? products.map(p => ({
                    productId: p.id,
                    title: p.title,
                    image: p.image,
                    url: buildCampaignShareUrl(channel, campaign, p.id),
                    shopeeUrl: campaignShopeeLinks[String(p.id)]?.url || null,
                    subIds: campaignShopeeLinks[String(p.id)]?.subIds || [],
                }))
                : [{ productId: null, title: 'Vitrine geral', url: buildCampaignShareUrl(channel, campaign), shopeeUrl: null }];

            const semAfiliado = links.filter(l => l.productId && !l.shopeeUrl).length;
            if (semAfiliado) {
                showToast(`${semAfiliado} produto(s) sem link de afiliado da Shopee — tente gerar de novo`, 'error');
            }

            const entry = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                channel,
                campaign,
                products,
                links,
                createdAt: new Date().toISOString(),
                exampleSubIds: [
                    SITE_SUBID,
                    `${sanitizeSubId(channel, 'facebook')}_social`,
                    campaign,
                    sanitizeSubId(products[0]?.category || 'geral', 'geral'),
                    products[0]?.id ? `p${products[0].id}` : 'pID',
                ],
            };

            const list = readSavedCampaigns().filter(c => c.id !== entry.id);
            list.unshift(entry);
            writeSavedCampaigns(list);
            campaignSavedList = list;
            renderCampaignPerformance();

            try {
                const res = await adminFetch(`${API_BASE}/api/campanhas-rastreio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entry),
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 401 || res.status === 403) {
                    throw new Error('Faça login no painel para salvar no banco');
                }
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast('Campanha salva no banco (Supabase)!', 'success');
            } catch (err) {
                showToast(`Salva só neste navegador — faça login no painel`, 'error');
            }
            switchAdminView('campanha-desempenho');
        }

        async function deleteSavedCampaign(id) {
            if (!confirm('Apagar esta campanha salva?')) return;
            const kept = readSavedCampaigns().filter(c => c.id !== id);
            writeSavedCampaigns(kept);
            deletedCampaignIds.add(String(id));
            campaignSavedList = kept;
            renderCampaignPerformance();
            try {
                const res = await adminFetch(`${API_BASE}/api/campanhas-rastreio/${encodeURIComponent(id)}`, { method: 'DELETE' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast('Campanha removida do banco', 'success');
            } catch (err) {
                showToast(`Removida só localmente — ${err.message}`, 'error');
            }
        }

        function loadSavedCampaignIntoEditor(id) {
            const entry = readSavedCampaigns().find(c => c.id === id);
            if (!entry) return;
            const ch = document.getElementById('campaign-link-channel');
            const name = document.getElementById('campaign-link-name');
            if (ch) ch.value = entry.channel || 'facebook';
            if (name) name.value = entry.campaign || 'promo_vitrine';
            campaignSelectedProducts = Array.isArray(entry.products) ? [...entry.products] : [];
            switchAdminView('campanhas');
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
            document.getElementById('campaign-link-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('Campanha carregada no editor', 'success');
        }

        function copySavedCampaignLinks(id, kind = 'site') {
            const entry = campaignSavedList.find(c => String(c.id) === String(id))
                || readSavedCampaigns().find(c => String(c.id) === String(id));
            if (!entry?.links?.length) return;
            const urls = entry.links
                .map(l => (kind === 'shopee' ? l.shopeeUrl : l.url))
                .filter(Boolean);
            if (!urls.length) {
                showToast(
                    kind === 'shopee'
                        ? 'Esta campanha não tem link de afiliado salvo — abra em Editar e salve de novo'
                        : 'Campanha sem links',
                    'error'
                );
                return;
            }
            const label = kind === 'shopee' ? 'da Shopee ' : '';
            navigator.clipboard?.writeText(urls.join('\n')).then(() => {
                showToast(urls.length > 1 ? `${urls.length} links ${label}copiados!` : `Link ${label}copiado!`, 'success');
            }).catch(() => showToast('Copie manualmente', 'error'));
        }

        /** Junta as campanhas do banco com as locais e devolve a lista final. */
        async function syncSavedCampaigns() {
            const local = readSavedCampaigns();
            campaignSavedList = local;

            let remote = null;
            try {
                const res = await fetch(`${API_BASE}/api/campanhas-rastreio`);
                const data = await res.json();
                if (res.ok && Array.isArray(data.campaigns)) remote = data.campaigns;
            } catch (_) {}
            if (!remote) return local;

            // O banco é a fonte preferida, mas nunca apaga o que só existe local:
            // sem isso uma campanha recém-criada some assim que o POST falha.
            const byId = new Map();
            for (const c of local) {
                if (c?.id && !deletedCampaignIds.has(String(c.id))) byId.set(String(c.id), c);
            }
            for (const c of remote) {
                if (c?.id && !deletedCampaignIds.has(String(c.id))) byId.set(String(c.id), c);
            }
            const merged = [...byId.values()].sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
            writeSavedCampaigns(merged);
            campaignSavedList = merged;
            return merged;
        }

        async function resetVitrineAndRefill() {
            if (!confirm('Isso apaga todos os produtos do Supabase e busca de novo (foco feminino). Continuar?')) return;
            showToast('Limpando e realimentando a vitrine…', 'success');
            try {
                const res = await adminFetch(`${API_BASE}/api/reset-vitrine`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ limit: 50, pages: 2, maxItems: 2000 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                sessionStorage.removeItem(TRACKED_LINKS_KEY);
                sessionStorage.removeItem(TRACKING_STORAGE_KEY);
                localStorage.removeItem(TRACKING_STORAGE_KEY);
                localStorage.removeItem('afiliado_mestre_db_v1');
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                loadAdminStats();
                loadAutoStatus();
                showToast(`Vitrine resetada: ${data.removed} removidos · ${data.refilled} novos itens`, 'success');
            } catch (err) {
                showToast(`Falha no reset: ${err.message}`, 'error');
            }
        }

        function commissionNumber(value) {
            if (typeof value === 'number') return value;
            const clean = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
            return Number(clean) || 0;
        }

        function conversionDate(unix) {
            const n = Number(unix);
            if (!n) return 'Data não informada';
            return new Date(n * 1000).toLocaleString('pt-BR');
        }

        function conversionStatusLabel(status) {
            const labels = {
                COMPLETED: 'Concluído',
                PENDING: 'Pendente',
                CANCELLED: 'Cancelado',
                UNPAID: 'Não pago',
            };
            return labels[String(status || '').toUpperCase()] || status || '—';
        }

        function renderConversions() {
            const list = document.getElementById('conversion-list');
            if (!list) return;

            const orders = conversionRows.flatMap(c =>
                (Array.isArray(c.orders) ? c.orders : []).map(order => ({ conversion: c, order }))
            );
            const totalLoadedPages = Math.max(1, Math.ceil(orders.length / CONVERSION_PAGE_SIZE));
            conversionPage = Math.min(Math.max(conversionPage, 1), totalLoadedPages);
            const pageStart = (conversionPage - 1) * CONVERSION_PAGE_SIZE;
            const visibleOrders = orders.slice(pageStart, pageStart + CONVERSION_PAGE_SIZE);
            const subIds = new Set(
                conversionRows.map(c => String(c.utmContent || '').trim()).filter(Boolean)
            );
            const commission = conversionRows.reduce((sum, c) => sum + commissionNumber(c.totalCommission), 0);

            document.getElementById('conversion-total').textContent = String(conversionRows.length);
            document.getElementById('conversion-orders').textContent = String(orders.length);
            const commissionText = commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('conversion-commission').textContent = commissionText;
            document.getElementById('conversion-subids').textContent = String(subIds.size);
            const dashTotal = document.getElementById('dash-conversion-total');
            const dashComm = document.getElementById('dash-conversion-commission');
            if (dashTotal) dashTotal.textContent = String(conversionRows.length);
            if (dashComm) dashComm.textContent = commissionText;

            if (!orders.length) {
                document.getElementById('conversion-pagination')?.classList.add('hidden');
                list.innerHTML = `
                    <div class="py-8 text-center text-slate-400 text-xs space-y-2">
                        <i class="fas fa-chart-line text-2xl mb-2 block"></i>
                        <p class="font-bold text-slate-600">Nenhuma venda deste site ainda</p>
                        <p>O painel só mostra pedidos com Sub ID <strong>afiliada_mestre</strong>.</p>
                        <p>Vendas de Stories, Pin e outras campanhas da Shopee ficam de fora — isso é esperado.</p>
                        <p class="text-slate-500">Assim que alguém comprar pela vitrine, a conversão aparece aqui.</p>
                    </div>`;
                return;
            }

            list.innerHTML = visibleOrders.map(({ conversion, order }) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const status = conversionStatusLabel(order.orderStatus);
                const statusClass = order.orderStatus === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : order.orderStatus === 'CANCELLED'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-700';
                return `
                    <article class="border border-slate-200 rounded-xl p-3 text-xs">
                        <div class="flex flex-wrap justify-between gap-2 mb-3">
                            <div>
                                <p class="font-bold text-slate-800">Pedido ${escapeHtml(String(order.orderId || '—'))}</p>
                                <p class="text-[10px] text-slate-400">${escapeHtml(conversionDate(conversion.purchaseTime))}</p>
                            </div>
                            <span class="self-start px-2 py-1 rounded-md text-[9px] font-bold ${statusClass}">${escapeHtml(status)}</span>
                        </div>
                        <div class="bg-orange-50 border border-orange-100 rounded-lg p-2 mb-3">
                            <p class="text-[9px] uppercase font-black text-shopee-orange mb-1">Rastreio da venda</p>
                            ${(() => {
                                const parsed = parseUtmContent(conversion.utmContent);
                                if (!parsed.raw.length) {
                                    return `<p class="font-mono text-[10px] text-slate-500">Sem Sub ID informado</p>`;
                                }
                                return `
                                <div class="grid grid-cols-2 gap-1.5 text-[10px]">
                                    <div><span class="text-slate-400">Site</span><br><span class="font-bold text-slate-800">${escapeHtml(parsed.site || '—')}</span></div>
                                    <div><span class="text-slate-400">Canal</span><br><span class="font-bold text-slate-800">${escapeHtml(parsed.channel || '—')}</span></div>
                                    <div><span class="text-slate-400">Campanha</span><br><span class="font-bold text-slate-800">${escapeHtml(parsed.campaign || '—')}</span></div>
                                    <div><span class="text-slate-400">Categoria</span><br><span class="font-bold text-slate-800">${escapeHtml(parsed.category || '—')}</span></div>
                                    <div class="col-span-2"><span class="text-slate-400">Produto</span><br><span class="font-bold text-slate-800">${escapeHtml(parsed.product || '—')}</span></div>
                                </div>
                                <p class="font-mono text-[9px] text-slate-400 mt-2 break-all">${escapeHtml(String(conversion.utmContent))}</p>`;
                            })()}
                        </div>
                        <div class="space-y-2">
                            ${items.map(item => {
                                const category = AM.categories.find(c => c.id === item.category);
                                const categoryLabel = category?.label || (item.category === 'todos' ? 'Categoria não identificada' : item.category);
                                const image = item.imageUrl
                                    ? escapeAttr(item.imageUrl)
                                    : 'https://placehold.co/96x96/ffebd7/ee4d2d?text=Shopee';
                                return `
                                <div class="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                    <img src="${image}" alt="" class="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100 shrink-0"
                                        onerror="this.onerror=null;this.src='https://placehold.co/96x96/ffebd7/ee4d2d?text=Shopee'">
                                    <div class="min-w-0 flex-1">
                                        <p class="font-semibold text-slate-700 line-clamp-2">${escapeHtml(String(item.itemName || `Item ${item.itemId || ''}`))}</p>
                                        <div class="flex flex-wrap items-center gap-1 mt-1">
                                            <span class="bg-orange-50 text-shopee-orange rounded px-1.5 py-0.5 text-[8px] font-bold uppercase">${escapeHtml(String(categoryLabel))}</span>
                                            <span class="text-[9px] text-slate-400">${escapeHtml(String(item.shopName || 'Loja Shopee'))} · Qtd. ${Number(item.qty) || 1}</span>
                                        </div>
                                    </div>
                                    <span class="font-bold text-emerald-600 whitespace-nowrap">
                                        ${commissionNumber(item.itemTotalCommission).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>`;
                            }).join('') || '<p class="text-slate-400 text-[10px]">Itens não detalhados pela Shopee.</p>'}
                        </div>
                    </article>`;
            }).join('');

            const pagination = document.getElementById('conversion-pagination');
            const prev = document.getElementById('conversion-prev');
            const next = document.getElementById('conversion-next');
            pagination?.classList.toggle('hidden', orders.length <= CONVERSION_PAGE_SIZE && !conversionHasNextRemote);
            if (prev) prev.disabled = conversionPage <= 1;
            if (next) next.disabled = conversionPage >= totalLoadedPages && !conversionHasNextRemote;
            const pageInfo = document.getElementById('conversion-page-info');
            if (pageInfo) {
                pageInfo.textContent = `Página ${conversionPage} de ${totalLoadedPages}${conversionHasNextRemote ? '+' : ''}`;
            }
        }

        function formatMoneyBRL(value) {
            return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        const BRL = formatMoneyBRL;
        const PCT = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(1) + "%" : "0%");

        function normalizeCampaignKey(name) {
            const raw = String(name || '').trim().toLowerCase();
            return raw || 'sem_campanha';
        }

        function campaignDisplayName(key) {
            if (!key || key === 'sem_campanha') return 'Sem campanha / orgânico';
            return key;
        }

        function emptyCampaignBucket(key) {
            return {
                key,
                name: campaignDisplayName(key),
                conversions: 0,
                orders: 0,
                itemsQty: 0,
                commission: 0,
                sellerCommission: 0,
                shopeeCommission: 0,
                channels: {},
                statuses: {},
                products: {},
                devices: {},
                buyerTypes: {},
                conversionsList: [],
                lastPurchase: 0,
                saved: null,
            };
        }

        /**
         * Cruza as vendas da Shopee com as campanhas salvas. Campanha sem venda
         * continua na lista (zerada) para dar pra acompanhar desde o primeiro dia.
         */
        function buildCampaignPerformanceMap(rows, savedList = campaignSavedList) {
            const map = new Map();
            for (const conversion of rows || []) {
                const parsed = parseUtmContent(conversion.utmContent);
                const key = normalizeCampaignKey(parsed.campaign);
                if (!map.has(key)) map.set(key, emptyCampaignBucket(key));
                const bucket = map.get(key);
                bucket.conversions += 1;
                bucket.commission += commissionNumber(conversion.totalCommission);
                bucket.sellerCommission += commissionNumber(conversion.sellerCommission);
                bucket.shopeeCommission += commissionNumber(conversion.shopeeCommissionCapped);
                bucket.conversionsList.push(conversion);
                const purchase = Number(conversion.purchaseTime) || 0;
                if (purchase > bucket.lastPurchase) bucket.lastPurchase = purchase;

                const channel = sanitizeSubId(parsed.channel, 'desconhecido');
                bucket.channels[channel] = (bucket.channels[channel] || 0) + 1;

                if (conversion.device) {
                    const d = String(conversion.device);
                    bucket.devices[d] = (bucket.devices[d] || 0) + 1;
                }
                if (conversion.buyerType) {
                    const b = String(conversion.buyerType);
                    bucket.buyerTypes[b] = (bucket.buyerTypes[b] || 0) + 1;
                }

                for (const order of (conversion.orders || [])) {
                    bucket.orders += 1;
                    const st = String(order.orderStatus || 'UNKNOWN');
                    bucket.statuses[st] = (bucket.statuses[st] || 0) + 1;
                    for (const item of (order.items || [])) {
                        const qty = Number(item.qty) || 1;
                        bucket.itemsQty += qty;
                        const pid = String(item.itemId || item.itemName || 'item');
                        if (!bucket.products[pid]) {
                            bucket.products[pid] = {
                                id: item.itemId,
                                name: item.itemName || `Item ${item.itemId || ''}`,
                                image: item.imageUrl || '',
                                shop: item.shopName || '',
                                qty: 0,
                                commission: 0,
                                price: Number(item.itemPrice) || 0,
                            };
                        }
                        bucket.products[pid].qty += qty;
                        bucket.products[pid].commission += commissionNumber(item.itemTotalCommission);
                    }
                }
            }

            for (const saved of savedList || []) {
                const key = normalizeCampaignKey(saved.campaign);
                if (!map.has(key)) map.set(key, emptyCampaignBucket(key));
                map.get(key).saved = saved;
            }

            return [...map.values()].sort((a, b) =>
                b.commission - a.commission
                || b.orders - a.orders
                || new Date(b.saved?.createdAt || 0) - new Date(a.saved?.createdAt || 0)
                || a.name.localeCompare(b.name)
            );
        }

        async function fetchConversionBatch({ days, status, scrollId = '' }) {
            const params = new URLSearchParams({ days: String(days), limit: '50', siteOnly: '1' });
            if (status) params.set('status', status);
            if (scrollId) params.set('scrollId', scrollId);
            const res = await fetch(`${API_BASE}/api/conversions?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível consultar as conversões');
            return data;
        }

        async function loadCampaignPerformance({ reset = false } = {}) {
            const list = document.getElementById('camp-perf-list');
            if (!list || !isAdminMode() || campaignPerfLoading) return;
            campaignPerfLoading = true;
            if (reset) {
                campaignPerfRows = [];
                campaignPerfSelected = '';
                closeCampaignPerfDetail();
            }
            list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Consultando vendas na Shopee…</div>';
            try {
                await syncSavedCampaigns();
                const days = document.getElementById('camp-perf-days')?.value || '30';
                const status = document.getElementById('camp-perf-status')?.value || '';
                let scrollId = '';
                let hasNext = true;
                let pages = 0;
                const maxPages = 6; // até ~300 conversões do site
                const all = [];
                while (hasNext && pages < maxPages) {
                    const data = await fetchConversionBatch({ days, status, scrollId });
                    const received = Array.isArray(data.conversions) ? data.conversions : [];
                    all.push(...received);
                    scrollId = data.pageInfo?.scrollId || '';
                    hasNext = Boolean(data.pageInfo?.hasNextPage && scrollId && received.length);
                    pages += 1;
                    if (!received.length) break;
                }
                campaignPerfRows = all;
                renderCampaignPerformance();
                if (!all.length && !campaignSavedList.length) {
                    showToast('Nenhuma venda deste site no período', 'success');
                } else if (hasNext) {
                    showToast(`Carregadas ${all.length} conversões (há mais na Shopee — refine o período)`, 'success');
                }
            } catch (err) {
                // A lista de campanhas não depende da Shopee: mostra o que já foi salvo
                // e avisa que só os números de venda ficaram de fora.
                campaignPerfRows = [];
                renderCampaignPerformance();
                list.insertAdjacentHTML('afterbegin', `
                    <div class="mb-2 rounded-lg bg-red-50 border border-red-100 p-3 text-red-600 text-xs">
                        <i class="fas fa-circle-exclamation mr-1"></i>Não foi possível carregar as vendas: ${escapeHtml(err.message)}
                    </div>`);
            } finally {
                campaignPerfLoading = false;
            }
        }

        /** Produtos da campanha: os salvos no painel ou, na falta, os que venderam. */
        function campaignProductsForCard(c) {
            const saved = (c.saved?.products || []).map(p => ({
                id: p.id,
                title: p.title || `Produto ${p.id}`,
                image: p.image || '',
            }));
            if (saved.length) return saved;
            return Object.values(c.products || {}).map(p => ({
                id: p.id,
                title: p.name || `Item ${p.id || ''}`,
                image: p.image || '',
            }));
        }

        function campaignThumbsHtml(c) {
            const all = campaignProductsForCard(c);
            if (!all.length) {
                return `<div class="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <i class="fas fa-store text-slate-300"></i>
                </div>`;
            }
            const shown = all.slice(0, 3);
            const extra = all.length - shown.length;
            return `<div class="flex -space-x-2 shrink-0">
                ${shown.map(p => `
                    <img src="${escapeAttr(thumbUrl(p.image) || p.image || '')}" alt="" title="${escapeAttr(p.title)}"
                        class="w-12 h-12 rounded-lg object-cover bg-slate-100 border-2 border-white shadow-sm"
                        onerror="this.onerror=null;this.src='https://placehold.co/96x96/ffebd7/ee4d2d?text=S'">
                `).join('')}
                ${extra > 0
                    ? `<span class="w-12 h-12 rounded-lg bg-slate-100 border-2 border-white text-[10px] font-bold text-slate-500 flex items-center justify-center">+${extra}</span>`
                    : ''}
            </div>`;
        }

        function campaignProductNamesHtml(c) {
            const all = campaignProductsForCard(c);
            if (!all.length) return '';
            const rest = all.length - 1;
            return `<p class="text-[10px] text-slate-500 mt-1 truncate">${escapeHtml(all[0].title)}${rest > 0 ? ` <span class="text-slate-400">+${rest} item(ns)</span>` : ''}</p>`;
        }

        function renderCampaignPerformance() {
            const list = document.getElementById('camp-perf-list');
            if (!list) return;
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const totalOrders = campaigns.reduce((s, c) => s + c.orders, 0);
            const totalItems = campaigns.reduce((s, c) => s + c.itemsQty, 0);
            const totalCommission = campaigns.reduce((s, c) => s + c.commission, 0);

            document.getElementById('camp-perf-count').textContent = String(campaigns.length);
            document.getElementById('camp-perf-conversions').textContent = String(campaignPerfRows.length);
            document.getElementById('camp-perf-orders').textContent = String(totalOrders);
            document.getElementById('camp-perf-items').textContent = String(totalItems);
            document.getElementById('camp-perf-commission').textContent = formatMoneyBRL(totalCommission);

            if (!campaigns.length) {
                list.innerHTML = `
                    <div class="py-10 text-center text-slate-400 text-xs space-y-2">
                        <i class="fas fa-chart-pie text-2xl block mb-2"></i>
                        <p class="font-bold text-slate-600">Nenhuma campanha ainda</p>
                        <p>Crie uma campanha e ela já aparece aqui, mesmo antes da primeira venda.</p>
                        <button onclick="switchAdminView('campanhas')" class="mt-2 text-shopee-orange font-bold">Criar campanha</button>
                    </div>`;
                return;
            }

            list.innerHTML = campaigns.map(c => {
                const saved = c.saved;
                const topChannels = Object.entries(c.channels)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([ch, n]) => `${escapeHtml(ch)} (${n})`)
                    .join(' · ') || (saved ? escapeHtml(saved.channel || '—') : '—');
                const statusBits = Object.entries(c.statuses)
                    .map(([st, n]) => `${escapeHtml(conversionStatusLabel(st))}: ${n}`)
                    .join(' · ');
                const selected = campaignPerfSelected === c.key ? 'ring-2 ring-shopee-orange border-shopee-orange' : 'border-slate-200';
                const nProd = (saved?.products || []).length;
                const when = saved?.createdAt ? new Date(saved.createdAt).toLocaleDateString('pt-BR') : '';
                const badge = saved
                    ? (c.orders
                        ? '<span class="text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Ativa</span>'
                        : '<span class="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Sem vendas ainda</span>')
                    : '<span class="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Fora do painel</span>';
                const savedMeta = saved
                    ? `<p class="text-[10px] text-slate-400">${escapeHtml(saved.channel || '—')} · ${nProd ? nProd + ' produto(s)' : 'vitrine geral'}${when ? ' · criada em ' + escapeHtml(when) : ''}</p>`
                    : '';
                const actions = saved
                    ? `<div class="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-100" onclick="event.stopPropagation()">
                            <button type="button" onclick="copySavedCampaignLinks('${escapeAttr(String(saved.id))}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold">Copiar link do anúncio</button>
                            <button type="button" onclick="copySavedCampaignLinks('${escapeAttr(String(saved.id))}','shopee')" class="px-2.5 py-1.5 rounded-lg bg-shopee-orange text-white text-[10px] font-bold">Copiar link Shopee</button>
                            <button type="button" onclick="loadSavedCampaignIntoEditor('${escapeAttr(String(saved.id))}')" class="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600">Editar</button>
                            <button type="button" onclick="deleteSavedCampaign('${escapeAttr(String(saved.id))}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-500">Apagar</button>
                        </div>`
                    : '';
                return `
                <article onclick="openCampaignPerfDetail('${escapeAttr(c.key)}')"
                    class="admin-stat-card border ${selected} rounded-xl p-4 text-xs bg-white hover:bg-orange-50/40">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="flex gap-3 min-w-0 flex-1">
                            ${campaignThumbsHtml(c)}
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <p class="font-black text-slate-800 text-sm truncate">${escapeHtml(c.name)}</p>
                                    ${badge}
                                </div>
                                ${savedMeta}
                                ${campaignProductNamesHtml(c)}
                                <p class="text-[10px] text-slate-400 mt-1">Canais: ${topChannels}</p>
                                <p class="text-[10px] text-slate-400">${escapeHtml(statusBits || 'Sem pedidos no período')}</p>
                                ${c.lastPurchase ? `<p class="text-[10px] text-slate-400 mt-1">Última venda: ${escapeHtml(conversionDate(c.lastPurchase))}</p>` : ''}
                            </div>
                        </div>
                        <div class="text-right shrink-0 space-y-1">
                            <p class="text-lg font-black ${c.commission ? 'text-emerald-600' : 'text-slate-300'}">${formatMoneyBRL(c.commission)}</p>
                            <p class="text-[10px] text-slate-500">${c.orders} pedido(s) · ${c.conversions} conv. · ${c.itemsQty} item(ns)</p>
                            <span class="inline-block text-[9px] font-bold uppercase text-shopee-orange">Ver detalhes →</span>
                        </div>
                    </div>
                    ${actions}
                </article>`;
            }).join('');
        }

        function openCampaignPerfByName(campaignName) {
            switchAdminView('campanha-desempenho');
            const key = normalizeCampaignKey(campaignName);
            // Aguarda o load e abre o detalhe
            const tryOpen = () => {
                if (campaignPerfLoading) {
                    setTimeout(tryOpen, 200);
                    return;
                }
                openCampaignPerfDetail(key);
            };
            setTimeout(tryOpen, 100);
        }

        function openCampaignPerfDetail(key) {
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const c = campaigns.find(x => x.key === key);
            const detail = document.getElementById('camp-perf-detail');
            if (!c || !detail) {
                showToast('Campanha não encontrada — atualize o período', 'error');
                return;
            }
            campaignPerfSelected = key;
            renderCampaignPerformance();

            document.getElementById('camp-perf-detail-title').textContent = c.name;
            const savedMeta = c.saved
                ? ` · canal ${c.saved.channel || '—'} · ${(c.saved.products || []).length || 'sem'} produto(s) no link`
                : '';
            document.getElementById('camp-perf-detail-meta').textContent =
                `${c.conversions} conversões · ${c.orders} pedidos · ${Object.keys(c.channels).length} canal(is)${savedMeta}`;

            document.getElementById('camp-perf-detail-stats').innerHTML = `
                <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-[9px] uppercase font-bold text-slate-400">Comissão total</p>
                    <p class="text-lg font-black text-emerald-600">${formatMoneyBRL(c.commission)}</p>
                </div>
                <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-[9px] uppercase font-bold text-slate-400">Comissão loja</p>
                    <p class="text-sm font-black text-slate-800">${formatMoneyBRL(c.sellerCommission)}</p>
                </div>
                <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-[9px] uppercase font-bold text-slate-400">Comissão Shopee</p>
                    <p class="text-sm font-black text-slate-800">${formatMoneyBRL(c.shopeeCommission)}</p>
                </div>
                <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-[9px] uppercase font-bold text-slate-400">Itens / pedidos</p>
                    <p class="text-lg font-black text-shopee-orange">${c.itemsQty} / ${c.orders}</p>
                </div>`;

            const channelsEl = document.getElementById('camp-perf-detail-channels');
            const channelEntries = Object.entries(c.channels).sort((a, b) => b[1] - a[1]);
            channelsEl.innerHTML = channelEntries.length
                ? channelEntries.map(([ch, n]) => `
                    <div class="flex justify-between items-center border border-slate-100 rounded-lg px-3 py-2">
                        <span class="font-bold text-slate-700">${escapeHtml(ch)}</span>
                        <span class="text-slate-500">${n} venda(s)</span>
                    </div>`).join('')
                : '<p class="text-slate-400">Sem canais</p>';

            const productsEl = document.getElementById('camp-perf-detail-products');
            const products = Object.values(c.products).sort((a, b) => b.qty - a.qty || b.commission - a.commission).slice(0, 12);
            const productCard = (image, name, meta) => `
                    <div class="flex items-center gap-2 border border-slate-100 rounded-lg p-2">
                        <img src="${escapeAttr(image || 'https://placehold.co/64x64/ffebd7/ee4d2d?text=S')}" alt=""
                            class="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0"
                            onerror="this.onerror=null;this.src='https://placehold.co/64x64/ffebd7/ee4d2d?text=S'">
                        <div class="min-w-0 flex-1">
                            <p class="font-semibold text-slate-700 line-clamp-1">${escapeHtml(name)}</p>
                            <p class="text-[10px] text-slate-400">${meta}</p>
                        </div>
                    </div>`;
            if (products.length) {
                productsEl.innerHTML = products.map(p =>
                    productCard(p.image, p.name, `${p.qty} un. · ${formatMoneyBRL(p.commission)}${p.shop ? ' · ' + escapeHtml(p.shop) : ''}`)
                ).join('');
            } else if ((c.saved?.products || []).length) {
                productsEl.innerHTML = `<p class="text-[10px] text-slate-400 mb-1">Produtos divulgados (ainda sem venda):</p>`
                    + c.saved.products.map(p =>
                        productCard(p.image, p.title || `Produto ${p.id}`, `ID ${escapeHtml(String(p.id))}${p.category ? ' · ' + escapeHtml(p.category) : ''}`)
                    ).join('');
            } else {
                productsEl.innerHTML = '<p class="text-slate-400">Sem produtos</p>';
            }

            const ordersEl = document.getElementById('camp-perf-detail-orders');
            const orderRows = c.conversionsList.flatMap(conv =>
                (conv.orders || []).map(order => ({ conv, order }))
            );
            ordersEl.innerHTML = orderRows.length
                ? orderRows.map(({ conv, order }) => {
                    const parsed = parseUtmContent(conv.utmContent);
                    const status = conversionStatusLabel(order.orderStatus);
                    const statusClass = order.orderStatus === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : order.orderStatus === 'CANCELLED'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-700';
                    const items = (order.items || []).map(item =>
                        `<p class="text-[10px] text-slate-600">${escapeHtml(String(item.itemName || item.itemId))} · qtd ${item.qty || 1} · ${formatMoneyBRL(item.itemTotalCommission)}</p>`
                    ).join('');
                    return `
                    <article class="border border-slate-200 rounded-xl p-3 text-xs">
                        <div class="flex flex-wrap justify-between gap-2 mb-2">
                            <div>
                                <p class="font-bold text-slate-800">Pedido ${escapeHtml(String(order.orderId || '—'))}</p>
                                <p class="text-[10px] text-slate-400">${escapeHtml(conversionDate(conv.purchaseTime))} · canal ${escapeHtml(parsed.channel || '—')}</p>
                            </div>
                            <span class="self-start px-2 py-1 rounded-md text-[9px] font-bold ${statusClass}">${escapeHtml(status)}</span>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] mb-2 bg-slate-50 rounded-lg p-2">
                            <div><span class="text-slate-400">Device</span><br><strong>${escapeHtml(String(conv.device || '—'))}</strong></div>
                            <div><span class="text-slate-400">Buyer</span><br><strong>${escapeHtml(String(conv.buyerType || '—'))}</strong></div>
                            <div><span class="text-slate-400">Clique</span><br><strong>${escapeHtml(conversionDate(conv.clickTime))}</strong></div>
                            <div><span class="text-slate-400">Comissão</span><br><strong class="text-emerald-600">${formatMoneyBRL(conv.totalCommission)}</strong></div>
                        </div>
                        ${items}
                        <p class="font-mono text-[9px] text-slate-400 mt-2 break-all">${escapeHtml(String(conv.utmContent || ''))}</p>
                    </article>`;
                }).join('')
                : (c.saved?.links || []).length
                    ? `<div class="space-y-2">
                            <p class="text-slate-400 text-xs">Nenhum pedido ainda. Links desta campanha:</p>
                            ${c.saved.links.map(l => `
                                <p class="font-mono text-[9px] text-slate-600 break-all bg-slate-50 rounded px-2 py-1">${escapeHtml(l.url)}</p>
                            `).join('')}
                            <button type="button" onclick="copySavedCampaignLinks('${escapeAttr(String(c.saved.id))}')"
                                class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold">Copiar links</button>
                        </div>`
                    : '<p class="text-slate-400 text-xs text-center py-4">Nenhum pedido</p>';

            detail.classList.remove('hidden');
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function closeCampaignPerfDetail() {
            campaignPerfSelected = '';
            document.getElementById('camp-perf-detail')?.classList.add('hidden');
            renderCampaignPerformance();
        }

        async function loadMeuSiteSummary() {
            if (!isAdminMode()) return;
            const daysSel = document.getElementById("ms-days");
            const onlyMe = document.getElementById("ms-only-me");
            const days = Number(daysSel?.value || 30);
            const onlyMeuSite = !!(onlyMe?.checked ?? true);
            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setText("ms-net", "Carregando…");
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/meu-site/summary?days=${days}&onlyMeuSite=${onlyMeuSite}`);
                const data = await res.json();
                if (!res.ok || !data?.ok) throw new Error(data?.error || "falhou");
                const t = data.totals || {};
                setText("ms-net", BRL(t.net));
                setText("ms-gross", BRL(t.gross));
                setText("ms-orders", String(t.orders || 0));
                setText("ms-ticket", BRL(t.avgTicket));
                setText("ms-cancel-pct", PCT(t.cancelledPct));
                setText("ms-fraud-pct", PCT(t.fraudPct));
                setText("ms-sample", String(data.sampleSize || 0));
                const win = data.window || {};
                const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
                setText("ms-window", `${fmt(win.from)} → ${fmt(win.to)}`);
                const health = (t.cancelledPct || 0) + (t.fraudPct || 0);
                setText("ms-health", health < 5 ? "✅ Saudável" : health < 15 ? "⚠️ Atenção" : "🚨 Crítico");

                const renderTop = (id, rows, fmtRow) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (!rows?.length) { el.innerHTML = '<p class="p-3 text-slate-400 text-center">Sem dados</p>'; return; }
                    el.innerHTML = rows.map(fmtRow).join("");
                };
                renderTop("ms-top-items", data.topItems, (r) => `
                    <div class="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-slate-50 last:border-0">
                        <div class="min-w-0 flex-1">
                            <p class="text-slate-700 truncate text-[11px]">${(r.itemName || "sem nome").replace(/</g, "&lt;")}</p>
                            <p class="text-slate-400 text-[10px]">${r.orders} vendas · id ${r.itemId}</p>
                        </div>
                        <p class="text-emerald-600 font-bold whitespace-nowrap">${BRL(r.net)}</p>
                    </div>
                `);
                renderTop("ms-top-shops", data.topShops, (r) => `
                    <div class="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-slate-50 last:border-0">
                        <div class="min-w-0 flex-1">
                            <p class="text-slate-700 truncate text-[11px]">${(r.shopName || "loja").replace(/</g, "&lt;")}</p>
                            <p class="text-slate-400 text-[10px]">${r.orders} vendas</p>
                        </div>
                        <p class="text-emerald-600 font-bold whitespace-nowrap">${BRL(r.net)}</p>
                    </div>
                `);
                renderTop("ms-top-campaigns", data.topCampaigns, (r) => `
                    <div class="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-slate-50 last:border-0">
                        <p class="text-slate-700 truncate text-[11px]">${(r.campaign || "—").replace(/</g, "&lt;")}</p>
                        <p class="text-emerald-600 font-bold whitespace-nowrap">${BRL(r.net)}</p>
                    </div>
                `);
            } catch (err) {
                setText("ms-net", "Erro");
                showToast("Falha ao carregar: " + err.message, "error");
            }
        }

        async function pullConversionsNow() {
            if (!isAdminMode()) return;
            showToast("Puxando conversões da Shopee…", "info");
            try {
                const res = await adminFetch(`${API_BASE}/api/cron/conversions?sinceMin=2880`);
                const data = await res.json();
                if (!data?.ok) throw new Error(data?.error || "falhou");
                const r = data.result || {};
                showToast(`Salvo ${r.saved || 0} conversão(ões) (${r.pages || 0} páginas)`, "success");
                loadMeuSiteSummary();
            } catch (err) { showToast("Erro: " + err.message, "error"); }
        }

        async function reprocessSubIdsDry() {
            if (!isAdminMode()) return;
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/meu-site/reprocess-subids`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ limit: 500, dryRun: true }),
                });
                const data = await res.json();
                if (!data?.ok) throw new Error(data?.error || "falhou");
                showToast(`${data.candidates || 0} produtos precisam reprocessar sub_ids`, "info");
            } catch (err) { showToast("Erro: " + err.message, "error"); }
        }

        async function reprocessSubIdsRun() {
            if (!isAdminMode()) return;
            if (!confirm("Reprocessa até 500 produtos: regera sub_ids e short_link. Continuar?")) return;
            showToast("Reprocessando… pode levar 1-2 min", "info");
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/meu-site/reprocess-subids`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ limit: 500, dryRun: false }),
                });
                const data = await res.json();
                if (!data?.ok) throw new Error(data?.error || "falhou");
                const s = data.shortlinks || {};
                showToast(`Reprocessado: ${data.saved || 0} salvos, ${s.generated || 0} shortlinks gerados`, "success");
            } catch (err) { showToast("Erro: " + err.message, "error"); }
        }

        // Anti-reentrada — um clique em cima do outro dispararia dois cron
        // simultâneos (feed-full duplo estoura quota e budget da Vercel).
        const toolBusy = { reverify: false, feed: false, metrics: false, backfill: false, prioritize: false,
            batchShortlink: false, reverifyBatch: false, decode: false, shopExplorer: false,
            campaignsExplorer: false, health: false, validated: false, feedInventory: false };

        function withBusy(key, fn) {
            return async function (...args) {
                if (toolBusy[key]) { showToast("Já rodando, aguarde…", "warning"); return; }
                toolBusy[key] = true;
                try { return await fn.apply(this, args); }
                finally { toolBusy[key] = false; }
            };
        }

        const runReverify = withBusy("reverify", async function () {
            if (!isAdminMode()) return;
            const itemId = Number(document.getElementById("reverify-item-id")?.value);
            const out = document.getElementById("reverify-result");
            if (!Number.isSafeInteger(itemId) || itemId <= 0) { showToast("item_id inválido", "warning"); return; }
            out.innerHTML = '<p class="text-slate-400">Puxando da Shopee…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/reverify`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemId }),
                });
                const d = await res.json();
                if (!d?.ok) throw new Error(d?.error || "falhou");
                if (d.hidden) {
                    out.innerHTML = `<p class="text-amber-600">Shopee não devolveu detalhe — item ocultado da vitrine.</p>`;
                } else {
                    const p = d.patch || {};
                    out.innerHTML = `
                        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded">
                            <p class="font-bold text-emerald-700 mb-2">✅ Atualizado</p>
                            <ul class="text-[11px] space-y-1">
                                ${p.sales != null ? `<li>Vendas: <b>${escapeHtml(String(p.sales))}</b></li>` : ""}
                                ${p.rating_star != null ? `<li>Avaliação: <b>${escapeHtml(String(p.rating_star))}</b></li>` : ""}
                                ${p.commission_rate != null ? `<li>Comissão: <b>${escapeHtml(String(p.commission_rate))}</b></li>` : ""}
                                ${p.price_min != null ? `<li>Preço mín: <b>R$ ${escapeHtml(String(p.price_min))}</b></li>` : ""}
                                ${p.price_max != null ? `<li>Preço máx: <b>R$ ${escapeHtml(String(p.price_max))}</b></li>` : ""}
                            </ul>
                        </div>`;
                }
                showToast("Item reverificado", "success");
            } catch (err) {
                out.innerHTML = `<p class="text-red-600">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const runFeed = withBusy("feed", async function (kind) {
            if (!isAdminMode()) return;
            const out = document.getElementById("feed-result");
            out.innerHTML = `<p class="text-slate-400">Rodando ${escapeHtml(String(kind))}… (pode levar 30-55s)</p>`;
            try {
                const res = await adminFetch(`${API_BASE}/api/cron/${encodeURIComponent(kind)}?force=1`);
                const d = await res.json();
                if (!d?.ok) throw new Error(d?.error || "falhou");
                const r = d.result || {};
                out.innerHTML = `
                    <div class="p-3 bg-slate-50 rounded">
                        <p class="font-bold mb-1">${escapeHtml(String(r.feedMode || kind))} · ${escapeHtml(String(r.feed?.date || "—"))}</p>
                        <ul class="text-[11px] space-y-1">
                            <li>Páginas: <b>${Number(r.pages) || 0}</b></li>
                            <li>Vistos: <b>${Number(r.seen) || 0}</b> · Qualidade OK: <b>${Number(r.quality) || 0}</b></li>
                            <li>Salvos: <b>${Number(r.saved) || 0}</b> · Ocultados (DELETE): <b>${Number(r.deleted) || 0}</b></li>
                            <li>Shortlinks gerados: <b>${Number(r.linked) || 0}</b> · Pendentes: <b>${Number(r.pending) || 0}</b></li>
                            <li>Duração: <b>${((Number(r.ms) || 0) / 1000).toFixed(1)}s</b> ${r.rateLimited ? '· <span class="text-red-500">rate-limited</span>' : ""} ${r.timedOut ? '· <span class="text-amber-500">time-out</span>' : ""}</li>
                        </ul>
                        ${r.skipped ? `<p class="text-amber-600 mt-2">${escapeHtml(String(r.note || ""))}</p>` : ""}
                    </div>`;
                showToast(`Feed ${kind}: ${r.saved || 0} salvos`, "success");
            } catch (err) {
                out.innerHTML = `<p class="text-red-600">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        function formatFerramentasTime(ms) {
            if (!ms) return "—";
            try { return new Date(Number(ms)).toLocaleTimeString('pt-BR'); }
            catch (_) { return "—"; }
        }

        const loadFeedInventory = withBusy("feedInventory", async function () {
            const out = document.getElementById("feed-inventory-result");
            if (!out) return;
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Consultando listItemFeeds…</p>';
            try {
                const modeSel = document.getElementById("feed-inventory-mode")?.value || "";
                const q = modeSel ? `?feedMode=${encodeURIComponent(modeSel)}` : "";
                const res = await adminFetch(`${API_BASE}/api/admin/feeds/list${q}`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const feeds = (d.feeds || []).slice(0, 40);
                if (!feeds.length) {
                    out.innerHTML = '<p class="text-slate-400 text-xs">Nenhum feed disponível agora.</p>';
                    return;
                }
                out.innerHTML = `
                    <div class="overflow-x-auto"><table class="w-full text-[11px] border-collapse">
                        <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                            <th class="p-1">Data</th><th class="p-1">Modo</th><th class="p-1">Ref</th>
                            <th class="p-1 text-right">Registros</th><th class="p-1">Nome</th>
                        </tr></thead>
                        <tbody>${feeds.map(f => `
                            <tr class="border-b border-slate-100">
                                <td class="p-1 font-mono">${escapeHtml(String(f.date || "—"))}</td>
                                <td class="p-1"><span class="px-1.5 py-0.5 rounded ${String(f.feedMode).toUpperCase() === 'FULL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} text-[10px] font-bold">${escapeHtml(String(f.feedMode || ""))}</span></td>
                                <td class="p-1 font-mono text-slate-500">${escapeHtml(String(f.referenceId || "—"))}</td>
                                <td class="p-1 text-right font-mono">${Number(f.totalCount || 0).toLocaleString('pt-BR')}</td>
                                <td class="p-1 text-slate-600 truncate max-w-[220px]">${escapeHtml(String(f.datafeedName || f.description || ""))}</td>
                            </tr>`).join("")}</tbody>
                    </table></div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const decodeLink = withBusy("decode", async function () {
            const inp = document.getElementById("decode-link-input");
            const out = document.getElementById("decode-link-result");
            if (!inp || !out) return;
            const url = String(inp.value || "").trim();
            if (!url) { showToast("Cole um shortlink/URL Shopee", "warning"); return; }
            if (url.length > 4096) { showToast("URL muito longa", "error"); return; }
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Decodificando…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/link/decode?url=${encodeURIComponent(url)}`);
                const d = await res.json();
                if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                if (d.shortener) {
                    out.innerHTML = `<div class="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">${escapeHtml(d.note || "")}</div>`;
                    return;
                }
                // Slot 3 é campanha no tráfego pago e código da seção da vitrine no orgânico.
                const subLabels = ["site (slot 1)", "canal (slot 2)", "campanha / seção (slot 3)", "categoria (slot 4)", "pid (slot 5)"];
                const subIds = Array.isArray(d.subIds) ? d.subIds : [];
                out.innerHTML = `
                    <div class="p-3 bg-slate-50 rounded space-y-1 text-[11px]">
                        <p><b>itemId:</b> <span class="font-mono">${escapeHtml(String(d.itemId || "—"))}</span></p>
                        <p><b>Meu site?</b> ${d.isMySite ? '<span class="text-emerald-600 font-bold">SIM</span>' : '<span class="text-red-500 font-bold">NÃO</span>'}</p>
                        <p><b>Canal:</b> ${escapeHtml(String(d.channel || "—"))} · <b>Campanha:</b> ${escapeHtml(String(d.campaign || "—"))}</p>
                        <div><b>Sub IDs:</b><ul class="ml-3 mt-1 space-y-0.5">${subLabels.map((lbl, i) => `<li><span class="text-slate-500">${lbl}:</span> <span class="font-mono">${escapeHtml(String(subIds[i] || "—"))}</span></li>`).join("")}</ul></div>
                        ${d.destination ? `<p class="break-all"><b>Destino:</b> <span class="font-mono text-[10px] text-slate-600">${escapeHtml(d.destination)}</span></p>` : ""}
                        ${d.note ? `<p class="text-slate-600 pt-1 border-t border-slate-200">${escapeHtml(d.note)}</p>` : ""}
                    </div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const runBatchShortlink = withBusy("batchShortlink", async function () {
            const inp = document.getElementById("batch-shortlink-urls");
            const out = document.getElementById("batch-shortlink-result");
            if (!inp || !out) return;
            const raw = String(inp.value || "").split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
            if (!raw.length) { showToast("Cole ao menos 1 URL", "warning"); return; }
            if (raw.length > 50) { showToast(`Máximo 50 por chamada (você colou ${raw.length})`, "warning"); return; }
            const subs = [1, 2, 3, 4, 5].map(n => String(document.getElementById(`batch-shortlink-sub${n}`)?.value || "").trim()).filter(Boolean);
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Gerando via generateBatchShortLink…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/shortlink/batch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls: raw, subIds: subs.length ? subs : undefined }),
                });
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const links = Array.isArray(d.links) ? d.links : [];
                out.innerHTML = `
                    <div class="text-[11px] space-y-2">
                        <p><b>${Number(d.successCount) || 0}</b> / ${Number(d.total) || links.length} gerados.</p>
                        <div class="overflow-x-auto"><table class="w-full border-collapse">
                            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                                <th class="p-1">Origem</th><th class="p-1">Shortlink</th><th class="p-1">Erro</th>
                            </tr></thead>
                            <tbody>${links.map(l => `
                                <tr class="border-b border-slate-100">
                                    <td class="p-1 font-mono text-[10px] break-all max-w-[240px]">${escapeHtml(String(l.originUrl || ""))}</td>
                                    <td class="p-1 font-mono text-[10px] break-all">${l.success && l.shortLink ? `<span class="text-emerald-600">${escapeHtml(l.shortLink)}</span>` : "—"}</td>
                                    <td class="p-1 text-red-500 text-[10px]">${escapeHtml(String(l.errorMessage || ""))}</td>
                                </tr>`).join("")}</tbody>
                        </table></div>
                    </div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const runReverifyBatch = withBusy("reverifyBatch", async function () {
            const inp = document.getElementById("reverify-batch-ids");
            const out = document.getElementById("reverify-batch-result");
            if (!inp || !out) return;
            const ids = String(inp.value || "").split(/[\s,;]+/).map(s => Number(s)).filter(n => Number.isSafeInteger(n) && n > 0);
            if (!ids.length) { showToast("Cole ao menos 1 item_id", "warning"); return; }
            const uniq = [...new Set(ids)].slice(0, 30);
            out.innerHTML = `<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Reverificando ${uniq.length} item(s)…</p>`;
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/reverify/batch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemIds: uniq }),
                });
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const results = Array.isArray(d.results) ? d.results : [];
                const okN = results.filter(r => r.ok && !r.hidden).length;
                const hidden = results.filter(r => r.hidden).length;
                const fail = results.filter(r => !r.ok).length;
                out.innerHTML = `
                    <div class="text-[11px] space-y-2">
                        <p><b>${okN}</b> atualizados · <b>${hidden}</b> ocultados · <b>${fail}</b> falharam</p>
                        <div class="overflow-x-auto"><table class="w-full border-collapse">
                            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                                <th class="p-1">itemId</th><th class="p-1">Status</th><th class="p-1">Detalhe</th>
                            </tr></thead>
                            <tbody>${results.map(r => `
                                <tr class="border-b border-slate-100">
                                    <td class="p-1 font-mono">${Number(r.itemId) || "—"}</td>
                                    <td class="p-1">${r.hidden ? '<span class="text-amber-600 font-bold">HIDDEN</span>' : (r.ok ? '<span class="text-emerald-600 font-bold">OK</span>' : '<span class="text-red-500 font-bold">ERR</span>')}</td>
                                    <td class="p-1 text-slate-600 text-[10px]">${escapeHtml(String(r.error || (r.patch ? Object.keys(r.patch).join(", ") : "")))}</td>
                                </tr>`).join("")}</tbody>
                        </table></div>
                    </div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const loadShopExplorer = withBusy("shopExplorer", async function () {
            const out = document.getElementById("shop-explorer-result");
            if (!out) return;
            const keyword = String(document.getElementById("shop-explorer-keyword")?.value || "").trim();
            const shopType = String(document.getElementById("shop-explorer-shoptype")?.value || "").trim();
            const sortType = Number(document.getElementById("shop-explorer-sort")?.value) || 1;
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Consultando shopOfferV2…</p>';
            try {
                const params = new URLSearchParams({ sortType: String(sortType), limit: "20" });
                if (keyword) params.set("keyword", keyword);
                if (shopType) params.set("shopType", shopType);
                const res = await adminFetch(`${API_BASE}/api/admin/shopee/shops?${params}`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const nodes = Array.isArray(d.nodes) ? d.nodes : [];
                if (!nodes.length) { out.innerHTML = '<p class="text-slate-400 text-xs">Nenhuma loja retornada.</p>'; return; }
                out.innerHTML = `
                    <div class="overflow-x-auto"><table class="w-full text-[11px] border-collapse">
                        <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                            <th class="p-1">Loja</th><th class="p-1">Tipo</th><th class="p-1 text-right">Comissão</th>
                            <th class="p-1 text-right">Rating</th><th class="p-1 text-right">Cobertura</th>
                            <th class="p-1">Budget</th><th class="p-1">Link</th>
                        </tr></thead>
                        <tbody>${nodes.map(n => {
                            const budgetLbl = { 0: "unlimited", 1: "very low", 2: "low", 3: "normal" }[Number(n.remainingBudget)] || "—";
                            const typeTxt = Array.isArray(n.shopType) ? n.shopType.join(",") : String(n.shopType || "—");
                            return `<tr class="border-b border-slate-100">
                                <td class="p-1 font-semibold text-slate-700 truncate max-w-[180px]">${escapeHtml(String(n.shopName || ""))} <span class="text-slate-400 font-mono">#${Number(n.shopId) || "—"}</span></td>
                                <td class="p-1"><span class="px-1 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px]">${escapeHtml(typeTxt)}</span></td>
                                <td class="p-1 text-right font-mono text-emerald-700">${escapeHtml(String(n.commissionRate || "—"))}</td>
                                <td class="p-1 text-right font-mono">${escapeHtml(String(n.ratingStar || "—"))}</td>
                                <td class="p-1 text-right font-mono">${escapeHtml(String(n.sellerCommCoveRatio || "—"))}</td>
                                <td class="p-1 text-[10px] text-slate-500">${escapeHtml(budgetLbl)}</td>
                                <td class="p-1"><a href="${escapeAttr(String(n.offerLink || "#"))}" target="_blank" rel="nofollow sponsored noopener" class="text-shopee-orange hover:underline text-[10px]">abrir</a></td>
                            </tr>`;
                        }).join("")}</tbody>
                    </table></div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const loadShopeeCampaignsExplorer = withBusy("campaignsExplorer", async function () {
            const out = document.getElementById("shopee-campaigns-result");
            if (!out) return;
            const keyword = String(document.getElementById("shopee-campaigns-keyword")?.value || "").trim();
            const sortType = Number(document.getElementById("shopee-campaigns-sort")?.value) || 1;
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Consultando shopeeOfferV2…</p>';
            try {
                const params = new URLSearchParams({ sortType: String(sortType), limit: "20" });
                if (keyword) params.set("keyword", keyword);
                const res = await adminFetch(`${API_BASE}/api/admin/shopee/campaigns?${params}`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const nodes = Array.isArray(d.nodes) ? d.nodes : [];
                if (!nodes.length) { out.innerHTML = '<p class="text-slate-400 text-xs">Nenhuma campanha retornada.</p>'; return; }
                out.innerHTML = `
                    <div class="overflow-x-auto"><table class="w-full text-[11px] border-collapse">
                        <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                            <th class="p-1">Nome</th><th class="p-1">Tipo</th><th class="p-1 text-right">Comissão</th>
                            <th class="p-1">Fim</th><th class="p-1">Link</th>
                        </tr></thead>
                        <tbody>${nodes.map(n => {
                            const typeLabel = Number(n.offerType) === 1 ? "Coleção" : Number(n.offerType) === 2 ? "Categoria" : "—";
                            const endTs = Number(n.periodEndTime) || 0;
                            const endLabel = endTs ? new Date((endTs > 1e12 ? endTs : endTs * 1000)).toLocaleDateString('pt-BR') : "—";
                            return `<tr class="border-b border-slate-100">
                                <td class="p-1 font-semibold text-slate-700 truncate max-w-[220px]">${escapeHtml(String(n.offerName || ""))}</td>
                                <td class="p-1 text-[10px] text-slate-500">${escapeHtml(typeLabel)}</td>
                                <td class="p-1 text-right font-mono text-emerald-700">${escapeHtml(String(n.commissionRate || "—"))}</td>
                                <td class="p-1 text-[10px] text-slate-500">${escapeHtml(endLabel)}</td>
                                <td class="p-1"><a href="${escapeAttr(String(n.offerLink || "#"))}" target="_blank" rel="nofollow sponsored noopener" class="text-shopee-orange hover:underline text-[10px]">abrir</a></td>
                            </tr>`;
                        }).join("")}</tbody>
                    </table></div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const loadShopeeHealth = withBusy("health", async function () {
            const out = document.getElementById("shopee-health-result");
            if (!out) return;
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/shopee/health`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const entries = (d.entries || []).slice(0, 30);
                const s = d.summary || {};
                out.innerHTML = `
                    <div class="text-[11px] space-y-2">
                        <div class="flex flex-wrap gap-3">
                            <span class="text-emerald-700 font-bold">OK: ${Number(s.ok) || 0}</span>
                            <span class="text-red-500 font-bold">ERR: ${Number(s.err) || 0}</span>
                            <span class="text-amber-500 font-bold">429: ${Number(s.rateLimited) || 0}</span>
                            <span class="text-slate-500">Média: ${Number(s.avgMs) || 0}ms (últimos 5 min)</span>
                        </div>
                        <div class="overflow-x-auto"><table class="w-full border-collapse">
                            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                                <th class="p-1">Hora</th><th class="p-1">Op</th><th class="p-1 text-right">Status</th>
                                <th class="p-1 text-right">ms</th><th class="p-1">Erro</th>
                            </tr></thead>
                            <tbody>${entries.map(e => `
                                <tr class="border-b border-slate-100">
                                    <td class="p-1 font-mono text-[10px]">${escapeHtml(formatFerramentasTime(e.at))}</td>
                                    <td class="p-1 font-mono text-[10px]">${escapeHtml(String(e.op || "—"))}</td>
                                    <td class="p-1 text-right"><span class="font-mono ${e.ok ? 'text-emerald-600' : e.rateLimited ? 'text-amber-500' : 'text-red-500'}">${Number(e.status) || 0}</span></td>
                                    <td class="p-1 text-right font-mono">${Number(e.ms) || 0}</td>
                                    <td class="p-1 text-red-500 text-[10px] truncate max-w-[220px]">${escapeHtml(String(e.error || ""))}</td>
                                </tr>`).join("")}</tbody>
                        </table></div>
                    </div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const loadValidatedReport = withBusy("validated", async function () {
            const out = document.getElementById("validated-result");
            if (!out) return;
            const validationId = Number(document.getElementById("validated-id")?.value);
            if (!Number.isSafeInteger(validationId) || validationId <= 0) { showToast("validationId inválido", "warning"); return; }
            out.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Consultando validatedReport…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/validated?validationId=${validationId}&limit=50`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const nodes = Array.isArray(d.nodes) ? d.nodes : [];
                if (!nodes.length) { out.innerHTML = '<p class="text-slate-400 text-xs">Sem dados nesta validação.</p>'; return; }
                let totalNet = 0, totalGross = 0, totalMcn = 0;
                for (const n of nodes) {
                    totalNet += Number(n.netCommission) || 0;
                    totalGross += Number(n.totalCommission) || 0;
                    totalMcn += Number(n.mcnManagementFee) || 0;
                }
                out.innerHTML = `
                    <div class="text-[11px] space-y-2">
                        <p><b>${nodes.length}</b> conversões · Bruto <b class="text-emerald-700">R$ ${totalGross.toFixed(2).replace('.', ',')}</b> · Líquido <b class="text-emerald-700">R$ ${totalNet.toFixed(2).replace('.', ',')}</b> · MCN <b class="text-slate-500">R$ ${totalMcn.toFixed(2).replace('.', ',')}</b></p>
                        <div class="overflow-x-auto"><table class="w-full border-collapse">
                            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                                <th class="p-1">Conv</th><th class="p-1">Compra</th><th class="p-1 text-right">Bruto</th>
                                <th class="p-1 text-right">Líquido</th><th class="p-1">Sub IDs (utmContent)</th>
                            </tr></thead>
                            <tbody>${nodes.slice(0, 40).map(n => {
                                const ts = Number(n.purchaseTime) || 0;
                                const dt = ts ? new Date((ts > 1e12 ? ts : ts * 1000)).toLocaleDateString('pt-BR') : "—";
                                return `<tr class="border-b border-slate-100">
                                    <td class="p-1 font-mono text-[10px]">${Number(n.conversionId) || "—"}</td>
                                    <td class="p-1 text-[10px]">${escapeHtml(dt)}</td>
                                    <td class="p-1 text-right font-mono">${(Number(n.totalCommission) || 0).toFixed(2)}</td>
                                    <td class="p-1 text-right font-mono text-emerald-700">${(Number(n.netCommission) || 0).toFixed(2)}</td>
                                    <td class="p-1 font-mono text-[10px] text-slate-500 truncate max-w-[220px]">${escapeHtml(String(n.utmContent || ""))}</td>
                                </tr>`;
                            }).join("")}</tbody>
                        </table></div>
                    </div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        const runRefreshMetrics = withBusy("metrics", async function () {
            if (!isAdminMode()) return;
            const out = document.getElementById("feed-result");
            const batch = Math.min(Math.max(Number(document.getElementById("refresh-metrics-batch")?.value) || 60, 5), 200);
            const staleHours = Math.min(Math.max(Number(document.getElementById("refresh-metrics-stale")?.value) || 12, 1), 168);
            out.innerHTML = '<p class="text-slate-400">Reverificando métricas…</p>';
            try {
                const res = await adminFetch(`${API_BASE}/api/cron/refresh-metrics?batch=${batch}&staleHours=${staleHours}`);
                const d = await res.json();
                if (!d?.ok) throw new Error(d?.error || "falhou");
                const m = d.metrics || {};
                out.innerHTML = `
                    <div class="p-3 bg-emerald-50 border border-emerald-200 rounded">
                        <p class="font-bold text-emerald-700 mb-1">Reverificação de métricas</p>
                        <ul class="text-[11px] space-y-1">
                            <li>Pedidos: <b>${Number(m.requested) || 0}</b> · Atualizados: <b>${Number(m.refreshed) || 0}</b> · Ocultados: <b>${Number(m.hidden) || 0}</b></li>
                            <li>Duração: <b>${((Number(m.ms) || 0) / 1000).toFixed(1)}s</b></li>
                            ${d.links ? `<li>Shortlinks pendentes retry: <b>${Number(d.links.generated) || 0}</b></li>` : ""}
                        </ul>
                    </div>`;
                showToast(`Reverificados: ${m.refreshed || 0}`, "success");
            } catch (err) {
                out.innerHTML = `<p class="text-red-600">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        async function loadConversions({ reset = false, advance = false } = {}) {
            const list = document.getElementById('conversion-list');
            if (!list || !isAdminMode()) return;
            if (reset) {
                conversionScrollId = '';
                conversionRows = [];
                conversionPage = 1;
                conversionHasNextRemote = false;
            }
            list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Consultando a Shopee…</div>';
            try {
                const days = document.getElementById('conversion-days')?.value || '30';
                const status = document.getElementById('conversion-status')?.value || '';
                const params = new URLSearchParams({ days, limit: '20', siteOnly: '1' });
                if (status) params.set('status', status);
                if (conversionScrollId) params.set('scrollId', conversionScrollId);
                const res = await fetch(`${API_BASE}/api/conversions?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Não foi possível consultar as conversões');
                const received = Array.isArray(data.conversions) ? data.conversions : [];
                conversionRows = reset ? received : conversionRows.concat(received);
                conversionScrollId = data.pageInfo?.scrollId || '';
                conversionHasNextRemote = Boolean(data.pageInfo?.hasNextPage && conversionScrollId);
                if (advance && received.length) conversionPage += 1;
                renderConversions();
                if (reset && data.ignoredFromOtherChannels > 0 && !received.length) {
                    showToast(`${data.ignoredFromOtherChannels} vendas de outras campanhas foram ocultadas (não são deste site)`, 'success');
                }
            } catch (err) {
                list.innerHTML = `
                    <div class="py-8 text-center text-red-500 text-xs">
                        <i class="fas fa-circle-exclamation mr-1"></i>${escapeHtml(err.message)}
                    </div>`;
            }
        }

        function previousConversionPage() {
            if (conversionPage <= 1) return;
            conversionPage -= 1;
            renderConversions();
            document.getElementById('conversion-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function nextConversionPage() {
            const orderCount = conversionRows.reduce(
                (total, conversion) => total + (Array.isArray(conversion.orders) ? conversion.orders.length : 0),
                0
            );
            const totalLoadedPages = Math.max(1, Math.ceil(orderCount / CONVERSION_PAGE_SIZE));
            if (conversionPage < totalLoadedPages) {
                conversionPage += 1;
                renderConversions();
                document.getElementById('conversion-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            if (conversionHasNextRemote && conversionScrollId) {
                loadConversions({ reset: false, advance: true });
            }
        }

        function parseCommissionPct(value) {
            const n = parseFloat(String(value || '').replace('%', '').replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
        }

        function getAdminFiltered() {
            const term = adminSearchTerm.toLowerCase().trim();
            let list = AM.productsDatabase.slice();

            if (adminFilterCategory) {
                list = list.filter(p => String(p.category || '') === adminFilterCategory);
            }
            if (adminFilterType === 'flash') {
                list = list.filter(p => !!p.isFlashSale);
            } else if (adminFilterType === 'normal') {
                list = list.filter(p => !p.isFlashSale);
            }
            if (term) {
                list = list.filter(p => {
                    const hay = [
                        p.title,
                        p.category,
                        p.subcategory,
                        p.shopName,
                        p.id,
                        p.itemId,
                        p.keyword,
                    ].map(v => String(v || '').toLowerCase()).join(' ');
                    return hay.includes(term);
                });
            }

            switch (adminFilterSort) {
                case 'name':
                    list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));
                    break;
                case 'price_asc':
                    list.sort((a, b) => Number(a.newPrice || 0) - Number(b.newPrice || 0));
                    break;
                case 'price_desc':
                    list.sort((a, b) => Number(b.newPrice || 0) - Number(a.newPrice || 0));
                    break;
                case 'discount':
                    list.sort((a, b) => Number(b.discountPct || 0) - Number(a.discountPct || 0));
                    break;
                case 'commission':
                    list.sort((a, b) => parseCommissionPct(b.commissionRate) - parseCommissionPct(a.commissionRate));
                    break;
                default:
                    list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            }
            return list;
        }

        function syncAdminFilterControls() {
            const search = document.getElementById('admin-search');
            const cat = document.getElementById('admin-filter-category');
            const type = document.getElementById('admin-filter-type');
            const sort = document.getElementById('admin-filter-sort');
            const size = document.getElementById('admin-page-size');
            if (search && search.value !== adminSearchTerm) search.value = adminSearchTerm;
            if (cat) cat.value = adminFilterCategory;
            if (type) type.value = adminFilterType;
            if (sort) sort.value = adminFilterSort;
            if (size) size.value = String(adminPageSize);
        }

        function populateAdminProductCategoryFilter() {
            const sel = document.getElementById('admin-filter-category');
            if (!sel) return;
            const current = adminFilterCategory || sel.value;
            const opts = AM.categories
                .filter(c => c.id !== 'todos')
                .map(c => {
                    const count = AM.productsDatabase.filter(p => p.category === c.id).length;
                    return `<option value="${escapeAttr(c.id)}">${escapeHtml(c.label)}${count ? ` (${count})` : ''}</option>`;
                })
                .join('');
            sel.innerHTML = `<option value="">Todas as categorias</option>${opts}`;
            if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
        }

        function onAdminSearch() {
            clearTimeout(adminSearchTimer);
            adminSearchTimer = setTimeout(() => {
                adminSearchTerm = document.getElementById('admin-search')?.value || '';
                adminPage = 1;
                renderConsoleProducts();
            }, 180);
        }

        function onAdminFiltersChange() {
            adminFilterCategory = document.getElementById('admin-filter-category')?.value || '';
            adminFilterType = document.getElementById('admin-filter-type')?.value || '';
            adminFilterSort = document.getElementById('admin-filter-sort')?.value || 'recent';
            adminPage = 1;
            renderConsoleProducts();
        }

        function onAdminPageSizeChange() {
            adminPageSize = Math.min(100, Math.max(8, Number(document.getElementById('admin-page-size')?.value) || 24));
            adminPage = 1;
            renderConsoleProducts();
        }

        function clearAdminFilters() {
            adminSearchTerm = '';
            adminFilterCategory = '';
            adminFilterType = '';
            adminFilterSort = 'recent';
            adminPage = 1;
            syncAdminFilterControls();
            renderConsoleProducts();
        }

        function updateAdminBulkBar() {
            const bar = document.getElementById('admin-bulk-bar');
            const countEl = document.getElementById('admin-selected-count');
            const n = adminSelectedIds.size;
            if (countEl) countEl.textContent = String(n);
            if (bar) bar.classList.toggle('hidden', n === 0);
        }

        function toggleAdminProductSelect(id, checked) {
            const key = String(id);
            if (checked) adminSelectedIds.add(key);
            else adminSelectedIds.delete(key);
            updateAdminBulkBar();
            const pageCb = document.getElementById('admin-select-page');
            if (pageCb) {
                const filtered = getAdminFiltered();
                const start = (adminPage - 1) * adminPageSize;
                const pageItems = filtered.slice(start, start + adminPageSize);
                const allOnPage = pageItems.length > 0 && pageItems.every(p => adminSelectedIds.has(String(p.id)));
                pageCb.checked = allOnPage;
                pageCb.indeterminate = !allOnPage && pageItems.some(p => adminSelectedIds.has(String(p.id)));
            }
        }

        function toggleSelectAdminPage(checked) {
            const filtered = getAdminFiltered();
            const start = (adminPage - 1) * adminPageSize;
            const pageItems = filtered.slice(start, start + adminPageSize);
            pageItems.forEach(p => {
                if (checked) adminSelectedIds.add(String(p.id));
                else adminSelectedIds.delete(String(p.id));
            });
            renderConsoleProducts();
        }

        function selectAllFilteredProducts() {
            const filtered = getAdminFiltered();
            if (!filtered.length) {
                showToast('Nenhum produto no filtro atual', 'error');
                return;
            }
            filtered.forEach(p => adminSelectedIds.add(String(p.id)));
            renderConsoleProducts();
            showToast(`${filtered.length} produto(s) selecionado(s)`, 'success');
        }

        function clearAdminProductSelection() {
            adminSelectedIds.clear();
            renderConsoleProducts();
        }

        function addSelectedProductsToCampaign() {
            if (!adminSelectedIds.size) {
                showToast('Selecione ao menos um produto', 'error');
                return;
            }
            let added = 0;
            let skipped = 0;
            for (const id of adminSelectedIds) {
                const ok = addProductToCampaign(id, { silent: true });
                if (ok) added += 1;
                else skipped += 1;
            }
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
            adminSelectedIds.clear();
            renderConsoleProducts();
            showToast(
                added
                    ? `${added} produto(s) adicionados à campanha${skipped ? ` (${skipped} já estavam)` : ''}`
                    : 'Nenhum produto novo para adicionar',
                added ? 'success' : 'error'
            );
            if (added) switchAdminView('campanhas');
        }

        function adminPrevPage() {
            if (adminPage > 1) { adminPage--; renderConsoleProducts(); }
        }

        function adminNextPage() {
            const total = getAdminFiltered().length;
            const maxPage = Math.max(1, Math.ceil(total / adminPageSize));
            if (adminPage < maxPage) { adminPage++; renderConsoleProducts(); }
        }

        function renderConsoleProducts() {
            const container = document.getElementById('console-products-list');
            if (!container) return;

            populateAdminProductCategoryFilter();
            syncAdminFilterControls();

            const countEl = document.getElementById('count-db-items');
            const loadedEl = document.getElementById('count-db-loaded');
            const summaryEl = document.getElementById('admin-filter-summary');
            const dbTotal = Number((AM.categories.find(c => c.id === 'todos') || {}).count) || 0;
            if (countEl) countEl.innerText = dbTotal > 0 ? dbTotal : AM.productsDatabase.length;
            if (loadedEl && !adminCatalogLoading) {
                if (dbTotal > AM.productsDatabase.length) {
                    loadedEl.textContent = `· ${AM.productsDatabase.length} na memória (faltam ${dbTotal - AM.productsDatabase.length})`;
                } else if (AM.productsDatabase.length) {
                    loadedEl.textContent = `· ${AM.productsDatabase.length} carregados`;
                } else {
                    loadedEl.textContent = '';
                }
            }

            const filtered = getAdminFiltered();
            const total = filtered.length;
            const maxPage = Math.max(1, Math.ceil(total / adminPageSize));
            if (adminPage > maxPage) adminPage = maxPage;
            const start = (adminPage - 1) * adminPageSize;
            const pageItems = filtered.slice(start, start + adminPageSize);

            if (summaryEl) {
                const bits = [];
                if (adminSearchTerm) bits.push(`busca “${adminSearchTerm}”`);
                if (adminFilterCategory) {
                    const lab = (AM.categories.find(c => c.id === adminFilterCategory) || {}).label || adminFilterCategory;
                    bits.push(lab);
                }
                if (adminFilterType === 'flash') bits.push('relâmpago');
                if (adminFilterType === 'normal') bits.push('normal');
                summaryEl.textContent = bits.length
                    ? `${total} resultado(s) · ${bits.join(' · ')}`
                    : `${total} produto(s) listados`;
            }

            const pageCb = document.getElementById('admin-select-page');
            if (pageCb) {
                const allOnPage = pageItems.length > 0 && pageItems.every(p => adminSelectedIds.has(String(p.id)));
                pageCb.checked = allOnPage;
                pageCb.indeterminate = !allOnPage && pageItems.some(p => adminSelectedIds.has(String(p.id)));
            }

            if (!pageItems.length) {
                container.innerHTML = `
                    <div class="py-12 text-center text-slate-400 text-xs space-y-2">
                        <i class="fas fa-box-open text-2xl block"></i>
                        <p class="font-bold text-slate-600">Nenhum produto encontrado</p>
                        <p>Ajuste os filtros ou limpe a busca.</p>
                        <button type="button" onclick="clearAdminFilters()" class="text-shopee-orange font-bold">Limpar filtros</button>
                    </div>`;
            } else {
                container.innerHTML = pageItems.map(p => {
                    const selected = adminSelectedIds.has(String(p.id));
                    const labelFlash = p.isFlashSale
                        ? `<span class="bg-red-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded">RELÂMPAGO</span>`
                        : '';
                    const rate = p.commissionRate && p.commissionRate !== '0.0%' ? p.commissionRate : '—';
                    const catLabel = (AM.categories.find(c => c.id === p.category) || {}).label || p.category || '';
                    const border = selected ? 'border-shopee-orange bg-orange-50/60 ring-1 ring-orange-200' : 'border-slate-200 bg-slate-50';
                    return `
                        <div class="p-3 rounded-xl border ${border} text-xs flex items-start gap-3 transition">
                            <label class="pt-3 shrink-0 cursor-pointer">
                                <input type="checkbox" class="rounded border-slate-300 text-shopee-orange focus:ring-shopee-orange"
                                    ${selected ? 'checked' : ''}
                                    onchange="toggleAdminProductSelect('${String(p.id).replace(/'/g, '')}', this.checked)">
                            </label>
                            <img src="${escapeAttr(p.image || '')}" alt="" class="w-12 h-12 object-cover rounded-lg border bg-white shrink-0"
                                onerror="this.onerror=null; this.src='https://placehold.co/100x100/ffebd7/ee4d2d?text=Icon'">
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 line-clamp-2 leading-snug">${escapeHtml(p.title)}</h5>
                                <div class="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span class="bg-slate-200 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-slate-600">${escapeHtml(String(catLabel))}</span>
                                    ${labelFlash}
                                    <span class="text-shopee-orange font-bold text-[10px]">R$ ${Number(p.newPrice || 0).toFixed(2)}</span>
                                    ${p.discountPct ? `<span class="text-emerald-600 text-[9px] font-bold">-${p.discountPct}%</span>` : ''}
                                    <span class="text-slate-400 text-[9px]">comissão ${escapeHtml(String(rate))}</span>
                                    <span class="text-slate-300 text-[9px] font-mono">#${escapeHtml(String(p.id))}</span>
                                </div>
                                ${p.shopName ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate">${escapeHtml(p.shopName)}</p>` : ''}
                            </div>
                            <div class="flex items-center gap-2 shrink-0 pt-1">
                                <button type="button" onclick="addProductToCampaign('${String(p.id).replace(/'/g, '')}'); showToast('Produto adicionado à campanha','success'); switchAdminView('campanhas');"
                                    class="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-shopee-orange hover:border-shopee-orange flex items-center justify-center" title="Adicionar à campanha">
                                    <i class="fas fa-bullhorn"></i>
                                </button>
                                <a href="${escapeAttr(p.affiliateLink || '#')}" target="_blank" rel="noopener"
                                    class="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-shopee-orange hover:border-shopee-orange flex items-center justify-center" title="Abrir link">
                                    <i class="fas fa-arrow-up-right-from-square"></i>
                                </a>
                                <button type="button" onclick="removeProductFromDatabase(${JSON.stringify(String(p.id))})"
                                    class="h-8 w-8 rounded-lg bg-white border border-slate-200 text-red-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center" title="Excluir">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </div>
                        </div>`;
                }).join('');
            }

            const info = document.getElementById('admin-page-info');
            if (info) {
                const from = total ? start + 1 : 0;
                const to = Math.min(start + adminPageSize, total);
                info.textContent = total
                    ? `Página ${adminPage} de ${maxPage} · ${from}–${to} de ${total}`
                    : 'Sem resultados';
            }
            const prev = document.getElementById('admin-prev');
            const next = document.getElementById('admin-next');
            if (prev) prev.disabled = adminPage <= 1;
            if (next) next.disabled = adminPage >= maxPage;
            updateAdminBulkBar();
        }

        function removeProductFromDatabase(id) {
            AM.productsDatabase = AM.productsDatabase.filter(p => String(p.id) !== String(id));
            adminSelectedIds.delete(String(id));
            localStorage.setItem('afiliado_mestre_db_v1', JSON.stringify(AM.productsDatabase));
            renderConsoleProducts();
            renderStoreProducts();
            if (isAdminMode()) loadAdminStats();
            showToast("Produto removido do banco!", "success");
        }

        function updateSingleAffiliateLink(id, newLink) {
            const idx = AM.productsDatabase.findIndex(p => p.id === id);
            if (idx !== -1) {
                AM.productsDatabase[idx].affiliateLink = newLink;
                localStorage.setItem('afiliado_mestre_db_v1', JSON.stringify(AM.productsDatabase));
                showToast("Link de redirecionamento atualizado com sucesso!", "success");
            }
        }

        function openNewProductForm() {
            document.getElementById('new-product-form-card').classList.remove('hidden');
        }

        function closeNewProductForm() {
            document.getElementById('new-product-form-card').classList.add('hidden');
        }

        async function saveNewProduct() {
            const sourceUrl = document.getElementById('add-source-url')?.value.trim() || '';
            const category = document.getElementById('add-category')?.value || '';
            const subcategory = document.getElementById('add-subcategory')?.value.trim() || '';
            const imgUrl = document.getElementById('add-img-url')?.value.trim() || '';
            const btn = document.getElementById('btn-save-product');
            const out = document.getElementById('add-product-result');

            if (!sourceUrl) {
                showToast('Cola a URL do produto na Shopee.', 'error');
                return;
            }

            if (btn) { btn.disabled = true; btn.textContent = 'Buscando na Shopee…'; }
            if (out) out.innerHTML = '<p class="text-slate-500">Puxando dados oficiais…</p>';

            try {
                const res = await adminFetch(`${API_BASE}/api/admin/produto-manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceUrl,
                        category: category || undefined,
                        subcategory: subcategory || undefined,
                        imageUrl: imgUrl || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data?.ok) {
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }

                const p = data.product || {};
                const priceMinBRL = BRL(p.priceMin);
                const priceMaxBRL = p.priceMax && p.priceMax > p.priceMin ? ` — ${BRL(p.priceMax)}` : '';
                if (out) {
                    out.innerHTML = `
                        <div class="mt-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                            <p class="font-bold mb-1">Publicado com sucesso na vitrine.</p>
                            <ul class="space-y-1">
                                <li><strong>Produto:</strong> ${(p.title || '—').replace(/</g, '&lt;')}</li>
                                <li><strong>Loja:</strong> ${(p.shopName || '—').replace(/</g, '&lt;')}</li>
                                <li><strong>Preço:</strong> ${priceMinBRL}${priceMaxBRL}</li>
                                <li><strong>Comissão:</strong> ${p.commissionRate || '—'}</li>
                                <li><strong>Categoria:</strong> ${p.category || 'todos'}${p.subcategory ? ' / ' + p.subcategory : ''}</li>
                                <li><strong>Link de afiliada (SITE_SUBID incluído):</strong>
                                    <a href="${data.shortLink || '#'}" target="_blank" class="text-shopee-orange font-mono break-all">${data.shortLink || 'gerando…'}</a>
                                </li>
                            </ul>
                            ${data.alreadyExisted ? '<p class="mt-2 text-amber-700">Este produto já existia na vitrine — dados foram atualizados.</p>' : ''}
                        </div>`;
                }

                // Limpa formulário
                document.getElementById('add-source-url').value = '';
                document.getElementById('add-subcategory').value = '';
                document.getElementById('add-img-url').value = '';

                // Recarrega vitrine (produto já está persistido no Supabase)
                await loadOffersFromSupabase({ silent: true, reset: true });
                if (isAdminMode()) {
                    loadAdminStats();
                    if (typeof loadAdminCatalogFull === 'function') {
                        loadAdminCatalogFull({ silent: true, force: true }).catch(() => {});
                    }
                }

                showToast('Produto publicado na vitrine com link de afiliada.', 'success');
            } catch (err) {
                if (out) out.innerHTML = `<p class="mt-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">${(err.message || 'erro').replace(/</g, '&lt;')}</p>`;
                showToast(err.message || 'Falha ao publicar', 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Publicar na vitrine'; }
            }
        }

        function fmtDateTime(iso) {
            if (!iso) return '—';
            try {
                return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch { return iso; }
        }

        function populateAdminCategorySelect() {
            const sel = document.getElementById('admin-cat-sync');
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = AM.categories
                .filter(c => c.id !== 'todos')
                .map(c => `<option value="${c.id}">${escapeHtml(c.label)}${c.count ? ` (${c.count})` : ''}</option>`)
                .join('');
            if (current) sel.value = current;
        }

        async function loadAdminStats() {
            const prodEl = document.getElementById('stat-db-products');
            const catEl = document.getElementById('stat-db-categories');
            try {
                const res = await fetch(`${API_BASE}/api/categorias`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const cats = data.categories || [];
                const total = (cats.find(c => c.id === 'todos') || {}).count || 0;
                const active = cats.filter(c => c.id !== 'todos' && Number(c.count) > 0).length;
                if (prodEl) prodEl.innerText = total.toLocaleString('pt-BR');
                if (catEl) catEl.innerText = active;
                const countEl = document.getElementById('count-db-items');
                const loadedEl = document.getElementById('count-db-loaded');
                if (countEl) countEl.innerText = total.toLocaleString('pt-BR');
                if (loadedEl && !adminCatalogLoading) {
                    if (total > AM.productsDatabase.length) {
                        loadedEl.textContent = `· ${AM.productsDatabase.length} na memória (faltam ${total - AM.productsDatabase.length})`;
                    } else if (AM.productsDatabase.length) {
                        loadedEl.textContent = `· ${AM.productsDatabase.length} carregados`;
                    } else {
                        loadedEl.textContent = '';
                    }
                }
            } catch (err) {
                if (prodEl) prodEl.innerText = AM.productsDatabase.length;
                if (catEl) catEl.innerText = new Set(AM.productsDatabase.map(p => p.category)).size;
            }
        }

        async function loadShortlinkStatus() {
            const line = document.getElementById('shortlink-status-line');
            const bar = document.getElementById('shortlink-status-bar');
            if (!line || !bar) return;
            try {
                const res = await fetch(`${API_BASE}/api/status/shortlinks`);
                const s = await res.json();
                if (!res.ok) throw new Error(s.error || `HTTP ${res.status}`);
                const total = Number(s.total) || 0;
                const ready = Number(s.ready) || 0;
                const missing = Number(s.missing) || 0;
                const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
                bar.style.width = `${pct}%`;
                bar.className = `h-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`;
                line.innerHTML = total
                    ? `<strong>${ready.toLocaleString('pt-BR')}</strong> / ${total.toLocaleString('pt-BR')} produtos com shortlink pronto (${pct}%). Faltam <strong>${missing.toLocaleString('pt-BR')}</strong>.`
                    : 'Nenhum produto no banco ainda. Rode um sync primeiro.';
            } catch (err) {
                line.innerHTML = `<span class="text-rose-500"><i class="fas fa-circle-exclamation mr-1"></i>${escapeHtml(err.message || 'Erro ao consultar status')}</span>`;
            }
        }

        async function runShortlinkBackfill() {
            if (toolBusy.backfill) { showToast("Backfill já em execução", "warning"); return; }
            toolBusy.backfill = true;
            const btn = document.getElementById('btn-shortlink-backfill');
            const line = document.getElementById('shortlink-status-line');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Gerando tudo…'; }
            if (line) line.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Gerando <strong>todos</strong> os shortlinks faltantes (lotes de 50). Pode levar alguns minutos…';
            try {
                const res = await adminFetch(`${API_BASE}/api/shortlinks/backfill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ all: true, limit: 50 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const missing = data.status?.missing;
                let msg = `Shortlinks: ${data.generated} gerados, ${data.failed || 0} falhas`;
                if (data.rateLimited) {
                    msg += ' — rate-limit. Clique de novo em alguns segundos para continuar.';
                } else if (data.timedOut || (typeof missing === 'number' && missing > 0)) {
                    msg += ` — ainda faltam ${missing != null ? missing : 'alguns'}. Clique de novo para continuar.`;
                } else {
                    msg += ' — fila zerada.';
                }
                showToast(msg, data.generated || data.done ? 'success' : 'error');
            } catch (err) {
                showToast(err.message || 'Erro no backfill', 'error');
            } finally {
                toolBusy.backfill = false;
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles mr-1"></i> Gerar tudo que falta'; }
                loadShortlinkStatus();
            }
        }

        async function loadAutoStatus() {
            const box = document.getElementById('auto-status-box');
            const badge = document.getElementById('auto-enabled-badge');
            try {
                const res = await fetch(`${API_BASE}/api/auto/status`);
                const s = await res.json();
                if (!res.ok) throw new Error(s.error || `HTTP ${res.status}`);

                const stateEl = document.getElementById('stat-auto-state');
                const nextEl = document.getElementById('stat-auto-next');
                const lastEl = document.getElementById('stat-auto-last');
                const upsEl = document.getElementById('stat-auto-upserts');
                if (stateEl) stateEl.innerText = s.enabled ? (s.running ? 'Rodando…' : 'Ativo') : 'Desligado';
                if (nextEl) nextEl.innerText = `próxima: ${fmtDateTime(s.nextRunAt)}`;
                if (lastEl) lastEl.innerText = fmtDateTime(s.lastRunAt);
                if (upsEl) upsEl.innerText = `itens salvos: ${s.totalUpserts ?? 0}`;

                if (badge) {
                    if (s.enabled) {
                        badge.textContent = s.running ? 'Rodando' : 'Ativo';
                        badge.className = 'text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200';
                    } else {
                        badge.textContent = 'Pausado (AUTO_SYNC=0)';
                        badge.className = 'text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border bg-slate-100 text-slate-500 border-slate-200';
                    }
                }

                const modes = (s.modes || []).map(m => m.label || `${m.listType}/${m.sortType}`).join(' → ');
                if (box) {
                    box.innerHTML = [
                        `estado........: ${s.enabled ? (s.running ? 'rodando' : 'ativo') : 'desligado'}`,
                        `feed..........: ${s.feedMode || 'coverage-95-5'}`,
                        `home..........: ${s.homePolicy || '100% feminino'}`,
                        `lote..........: ${s.batch} keyword(s) / execução`,
                        `foco feminino.: ${s.femalePercentTarget || 95}% das buscas (5% geral)`,
                        `fila coverage.: ${s.queueSize ?? '—'} (cursor ${s.cursor ?? 0})`,
                        `intervalo.....: ${s.intervalMin} min`,
                        `itens/keyword.: ${s.limit}`,
                        `modos.........: ${modes || 'comissão → top → recomendados'}`,
                        `shortlinks....: on-save + residual ${s.shortlinkBackfillPerRun ?? 50}/run`,
                        `última rodada.: ${(s.lastResult && s.lastResult.shortlinksGenerated != null) ? (s.lastResult.shortlinksGenerated + ' shortlinks') : '—'}`,
                        `execuções.....: ${s.runs}`,
                        `última........: ${fmtDateTime(s.lastRunAt)}`,
                        `próxima.......: ${fmtDateTime(s.nextRunAt)}`,
                        `limpeza.......: ${s.pruneDays ? s.pruneDays + ' dias' : 'desligada'}`,
                        s.lastError ? `último erro...: ${escapeHtml(s.lastError)}` : ``,
                    ].filter(Boolean).map(l => `<div>${l}</div>`).join('');
                }
            } catch (err) {
                if (box) box.innerHTML = `<div class="text-red-500">Não foi possível ler o status (${escapeHtml(err.message)}).</div>`;
                if (badge) {
                    badge.textContent = 'Erro';
                    badge.className = 'text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border bg-red-50 text-red-600 border-red-200';
                }
            }
        }

        async function runAutoSyncNow() {
            const btn = document.getElementById('btn-run-auto');
            const original = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Sincronizando…`; }
            showToast('Rodando um lote de sincronização…', 'success');
            try {
                const res = await adminFetch(`${API_BASE}/api/auto/run`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const ups = data.result?.upserts ?? 0;
                const sl = data.result?.shortlinksGenerated ?? 0;
                const skip = data.result?.skippedExisting ?? 0;
                showToast(`Lote: ${ups} novos · ${skip} já existiam · ${sl} shortlinks`, 'success');
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                populateAdminCategorySelect();
                loadAdminStats();
                loadAutoStatus();
                loadShortlinkStatus();
            } catch (err) {
                showToast(`Falha ao sincronizar: ${err.message}`, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = original; }
            }
        }

        async function runTopPerformanceNow() {
            const btn = document.getElementById('btn-top-perf');
            const original = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Buscando…`; }
            showToast('Populando destaques (Top Performance)…', 'success');
            try {
                const res = await adminFetch(`${API_BASE}/api/auto/top-performance`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const ups = data.result?.upserts ?? 0;
                const sl = data.result?.shortlinksGenerated ?? 0;
                const skip = data.result?.skippedExisting ?? 0;
                showToast(`Destaques: ${ups} novos · ${skip} já existiam · ${sl} shortlinks`, 'success');
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                populateAdminCategorySelect();
                loadAdminStats();
                loadAutoStatus();
                loadShortlinkStatus();
                loadHeroProducts();
            } catch (err) {
                showToast(`Falha nos destaques: ${err.message}`, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = original; }
            }
        }

        async function adminSyncCategory() {
            const sel = document.getElementById('admin-cat-sync');
            const catId = sel?.value;
            if (!catId) return;
            const btn = document.getElementById('btn-sync-cat');
            const status = document.getElementById('cat-sync-status');
            const original = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sincronizando…`; }
            if (status) {
                status.className = 'text-[11px] rounded-lg px-3 py-2 border bg-slate-50 border-slate-200 text-slate-600';
                status.textContent = `Sincronizando categoria "${catId}"…`;
                status.classList.remove('hidden');
            }
            const data = await syncCategory(catId, { silent: false });
            if (data) {
                if (status) {
                    status.className = 'text-[11px] rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200 text-emerald-800';
                    status.innerHTML = `<strong>${data.saved || data.count || 0}</strong> novos · <strong>${data.skippedExisting || 0}</strong> já existiam · <strong>${data.shortlinks?.generated || 0}</strong> shortlinks · ${data.keywordsRun || 0} keywords`;
                }
                await loadOffersFromSupabase({ silent: true, reset: true, category: catId });
                await loadCategoriesFromApi({ silent: true });
                populateAdminCategorySelect();
                loadAdminStats();
                loadShortlinkStatus();
                if (isAdminMode()) loadAdminCatalogFull({ silent: true, force: true });
            } else if (status) {
                status.className = 'text-[11px] rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700';
                status.textContent = 'Falha ao sincronizar a categoria.';
            }
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }

        async function loadOfficialShopeeOffers() {
            const box = document.getElementById('official-offers-box');
            if (!box) return;
            box.innerHTML = '<p class="text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando oficiais…</p>';
            try {
                const res = await fetch(`${API_BASE}/api/campanhas?limit=20`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const items = data.campaigns || data.offers || data.nodes || [];
                if (!items.length) {
                    box.innerHTML = '<p class="text-slate-400">Nenhuma oferta oficial retornada agora.</p>';
                    return;
                }
                window.__officialOffers = items;
                box.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-slate-700">${items.length} ofertas</span>
                        <button type="button" onclick="importOfficialShopeeOffers()" class="px-3 py-1.5 rounded-lg bg-shopee-orange text-white text-[10px] font-bold">Importar todas</button>
                    </div>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        ${items.slice(0, 20).map((c, i) => {
                            const collectionId = c.collectionId || c.collection_id || '';
                            const categoryId = c.categoryId || c.category_id || '';
                            const match = collectionId || categoryId;
                            const lt = collectionId ? 6 : 4;
                            return `
                            <div class="border border-slate-100 rounded-lg p-2 flex gap-2">
                                <img src="${escapeHtml(c.imageUrl || c.image || '')}" class="w-10 h-10 rounded object-cover bg-slate-100" onerror="this.style.display='none'">
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-slate-800 text-[11px] line-clamp-2">${escapeHtml(c.title || c.productName || c.name || 'Oferta')}</p>
                                    <p class="text-[10px] text-slate-400">${match ? `ID ${escapeHtml(String(match))} · listType ${lt}` : 'sem matchId'}</p>
                                </div>
                                ${match ? `<button type="button" onclick="useOfficialInExplorer(${i})" class="shrink-0 px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold">Explorador</button>` : ''}
                            </div>`;
                        }).join('')}
                    </div>`;
            } catch (err) {
                box.innerHTML = `<p class="text-red-600">Falha: ${escapeHtml(err.message)}</p>`;
            }
        }

        function useOfficialInExplorer(index) {
            const c = (window.__officialOffers || [])[index];
            if (!c) return;
            const collectionId = c.collectionId || c.collection_id;
            const categoryId = c.categoryId || c.category_id;
            const match = collectionId || categoryId;
            if (!match) return showToast('Oferta sem collectionId/categoryId', 'error');
            const matchEl = document.getElementById('admin-match-id');
            const lt = document.getElementById('admin-list-type');
            const st = document.getElementById('admin-sort-type');
            const kw = document.getElementById('admin-keyword');
            const rc = document.getElementById('admin-require-commission');
            if (matchEl) matchEl.value = String(match);
            if (lt) lt.value = collectionId ? '6' : '4';
            if (st) st.value = '5';
            if (kw) kw.value = '';
            if (rc) rc.checked = true;
            updateExplorerKwCount();
            updateExplorerModeHint();
            document.getElementById('admin-match-id')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('matchId no Explorador — clique Pré-visualizar', 'success');
        }

        async function importOfficialShopeeOffers() {
            const items = window.__officialOffers || [];
            if (!items.length) return showToast('Nada para importar', 'error');
            let savedTotal = 0;
            let shortTotal = 0;
            let usedCollection = 0;
            try {
                for (const c of items.slice(0, 8)) {
                    const collectionId = c.collectionId || c.collection_id;
                    const categoryId = c.categoryId || c.category_id;
                    if (collectionId || categoryId) {
                        const res = await adminFetch(`${API_BASE}/api/campanhas/import-products`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                collectionId: collectionId || undefined,
                                categoryId: categoryId || undefined,
                                limit: 25,
                                keyword: 'oficial',
                                forceCategory: /beauty|beleza|skincare/i.test(c.title || '') ? 'beleza'
                                    : /fashion|moda|women|roupa/i.test(c.title || '') ? 'moda' : null,
                            }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                            savedTotal += data.saved || 0;
                            shortTotal += data.shortlinks?.generated || 0;
                            usedCollection += 1;
                        }
                    }
                }
                if (!usedCollection) {
                    showToast('Oficiais sem collectionId — use o Explorador "Feminino + comissão"', 'error');
                    return;
                }
                showToast(`Campanhas: ${savedTotal} produtos · ${shortTotal} shortlinks`, 'success');
                loadShortlinkStatus();
                loadCoverageReport();
                await loadOffersFromSupabase({ silent: true, reset: true });
            } catch (err) {
                showToast(`Import falhou: ${err.message}`, 'error');
            }
        }

        async function loadCoverageReport() {
            const line = document.getElementById('coverage-status-line');
            const table = document.getElementById('coverage-table');
            if (!line || !table) return;
            try {
                // Leitura pública — não precisa de token (evita prompt bloqueando)
                const res = await fetch(`${API_BASE}/api/coverage`);
                const text = await res.text();
                let data = null;
                try {
                    data = text ? JSON.parse(text) : null;
                } catch (_) {
                    throw new Error(
                        res.ok
                            ? "Resposta inválida do servidor (não é JSON). Faça deploy da versão nova ou reinicie o servidor local."
                            : `HTTP ${res.status}: rota /api/coverage indisponível — suba o código pro GitHub/Vercel.`
                    );
                }
                if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
                window.__coverageReport = data;
                line.innerHTML = `Alvo feed <strong>${data.femalePercentTarget || 95}%</strong> feminino · <strong>${data.femaleGaps || 0}</strong> buracos femininos · <strong>${data.generalGaps || 0}</strong> gerais · ${data.totalProducts || 0} produtos`;
                const cats = data.categories || [];
                table.innerHTML = cats.map((c) => {
                    const pct = c.target ? Math.min(100, Math.round((c.count / c.target) * 100)) : 100;
                    const subs = (c.subcategories || [])
                        .filter((s) => s.gap > 0)
                        .slice(0, 6)
                        .map((s) => `<span class="inline-block mr-2 text-rose-600">${escapeHtml(s.label)} ${s.count}/${s.target}</span>`)
                        .join('');
                    return `<div class="mb-2 border-b border-slate-50 pb-2">
                        <div class="flex justify-between gap-2 font-bold text-slate-700">
                            <span>${c.feminine ? '♀' : '·'} ${escapeHtml(c.label)} <span class="text-slate-400 font-normal">${c.count}/${c.target}</span></span>
                            <button type="button" onclick="runCoverageFill('${c.id}')" class="text-[10px] text-pink-600 font-bold hover:underline">Preencher</button>
                        </div>
                        <div class="h-1 bg-slate-100 rounded mt-1"><div class="h-full ${pct >= 80 ? 'bg-emerald-500' : 'bg-pink-500'} rounded" style="width:${pct}%"></div></div>
                        <div class="mt-1 text-[10px] text-slate-500">${subs || 'Subs ok'}</div>
                    </div>`;
                }).join('') || '<p>Sem dados de cobertura.</p>';
            } catch (err) {
                line.innerHTML = `<span class="text-rose-500">${escapeHtml(err.message)}</span>`;
                if (table) table.innerHTML = '<p class="text-slate-400">Não foi possível carregar a cobertura.</p>';
            }
        }

        async function runCoverageFill(category) {
            const btn = document.getElementById('btn-coverage-fill');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Preenchendo…'; }
            try {
                const res = await adminFetch(`${API_BASE}/api/sync/coverage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batch: 12, limit: 20, category: category || undefined }),
                });
                const text = await res.text();
                let data = null;
                try {
                    data = text ? JSON.parse(text) : null;
                } catch (_) {
                    throw new Error(
                        res.ok
                            ? 'Resposta inválida do sync/coverage (não é JSON). Deploy da versão nova necessário.'
                            : `HTTP ${res.status}: sync/coverage indisponível — faça deploy.`
                    );
                }
                if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
                showToast(`Cobertura: ${data.saved} novos · ${data.skippedExisting || 0} já existiam · ${data.shortlinks?.generated || 0} shortlinks`, 'success');
                await loadCoverageReport();
                loadShortlinkStatus();
                await loadOffersFromSupabase({ silent: true, reset: true });
            } catch (err) {
                showToast(err.message || 'Falha na cobertura', 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-fill-drip mr-1"></i> Preencher buracos'; }
            }
        }

        async function scanCatalogDuplicates() {
            const line = document.getElementById('duplicates-status-line');
            const table = document.getElementById('duplicates-table');
            const btn = document.getElementById('btn-remove-duplicates');
            if (line) line.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Analisando catálogo…';
            if (btn) btn.disabled = true;
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/duplicates?max=5000`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                window.__duplicatesReport = data;
                const groups = data.duplicates || [];
                if (line) {
                    line.innerHTML = groups.length
                        ? `Escaneados <strong>${data.scanned}</strong> · <strong class="text-rose-600">${data.toRemove}</strong> para remover em <strong>${data.groups}</strong> grupos`
                        : `Escaneados <strong>${data.scanned}</strong> · <span class="text-emerald-600">nenhum duplicado encontrado</span>`;
                }
                if (btn) btn.disabled = !(data.toRemove > 0);
                if (!table) return;
                if (!groups.length) {
                    table.innerHTML = '<p class="text-emerald-600 font-semibold">Catálogo limpo — sem duplicados detectados.</p>';
                    return;
                }
                table.innerHTML = groups.map((g) => `
                    <div class="mb-3 border border-slate-100 rounded-lg p-3">
                        <p class="font-bold text-slate-800 text-[11px] mb-1">Manter · ${escapeHtml(g.keep.title || '')}</p>
                        <p class="text-[10px] text-emerald-700 mb-2">#${g.keep.itemId} · ${escapeHtml(g.keep.shopName || 'loja')} · ${g.keep.shortLink ? 'shope.ee' : 'sem shortlink'} · score ${g.keep.score}</p>
                        <p class="text-[10px] text-rose-600 font-bold mb-1">Remover (${g.remove.length}):</p>
                        <ul class="space-y-1 text-slate-600">${g.remove.map((r) =>
                            `<li class="truncate">#${r.itemId} · ${escapeHtml(r.title || '')}</li>`
                        ).join('')}</ul>
                    </div>`).join('');
            } catch (err) {
                if (line) line.innerHTML = `<span class="text-rose-500">${escapeHtml(err.message)}</span>`;
                if (table) table.innerHTML = '<p class="text-rose-500">Falha ao analisar.</p>';
            }
        }

        async function removeCatalogDuplicates() {
            const report = window.__duplicatesReport;
            if (!report?.toRemove) return showToast('Analise primeiro', 'error');
            if (!confirm(`Remover ${report.toRemove} produto(s) duplicado(s)? O melhor de cada grupo será mantido.`)) return;
            const btn = document.getElementById('btn-remove-duplicates');
            const line = document.getElementById('duplicates-status-line');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Removendo…'; }
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/duplicates/remove`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ max: 5000 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast(`Removidos ${data.removed} duplicados · ${data.kept} mantidos`, 'success');
                if (line) line.innerHTML = `Removidos <strong>${data.removed}</strong> · restam ~<strong>${data.kept}</strong> no catálogo`;
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                loadAdminStats();
                loadShortlinkStatus();
                await scanCatalogDuplicates();
            } catch (err) {
                showToast(err.message || 'Falha ao remover', 'error');
            } finally {
                if (btn) btn.innerHTML = '<i class="fas fa-trash mr-1"></i> Remover duplicados';
            }
        }

        async function scanWeakOffers() {
            const line = document.getElementById('duplicates-status-line');
            const table = document.getElementById('weak-offers-table');
            const btn = document.getElementById('btn-purge-weak');
            if (line) line.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Analisando ofertas fracas…';
            if (btn) btn.disabled = true;
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/weak?max=5000`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                window.__weakReport = data;
                if (line) {
                    line.innerHTML = `Escaneados <strong>${data.scanned}</strong> · <strong class="text-amber-700">${data.weakCount}</strong> fracos (nota &lt; ${data.minRating} ou vendas &lt; ${data.minSales} ou sem comissão)`;
                }
                if (btn) btn.disabled = !(data.weakCount > 0);
                if (table) {
                    table.classList.remove('hidden');
                    if (!data.samples?.length) {
                        table.innerHTML = '<p class="text-emerald-600 font-semibold">Nenhuma oferta fraca no filtro atual.</p>';
                    } else {
                        table.innerHTML = `<p class="font-bold text-amber-800 mb-2">Amostra de fracos:</p><ul class="space-y-1">${
                            data.samples.map((s) =>
                                `<li class="truncate">#${s.itemId} · ★${s.rating ?? '—'} · ${escapeHtml(String(s.sales || '0'))} · ${escapeHtml(s.title || '')}</li>`
                            ).join('')
                        }</ul>`;
                    }
                }
            } catch (err) {
                if (line) line.innerHTML = `<span class="text-rose-500">${escapeHtml(err.message)}</span>`;
                showToast(err.message || 'Falha ao analisar fracos', 'error');
            }
        }

        async function purgeWeakOffers() {
            const report = window.__weakReport;
            if (!report?.weakCount) return showToast('Analise os fracos primeiro', 'error');
            if (!confirm(`Remover ${report.weakCount} oferta(s) fraca(s)? (nota/vendas/comissão abaixo do filtro)`)) return;
            const btn = document.getElementById('btn-purge-weak');
            const line = document.getElementById('duplicates-status-line');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Limpando…'; }
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/purge-weak`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ max: 5000 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast(`Removidos ${data.removed} fracos · ~${data.kept} mantidos`, 'success');
                if (line) line.innerHTML = `Fracos removidos: <strong>${data.removed}</strong>`;
                await loadOffersFromSupabase({ silent: true, reset: true });
                await loadCategoriesFromApi({ silent: true });
                loadAdminStats();
                await scanWeakOffers();
            } catch (err) {
                showToast(err.message || 'Falha ao limpar fracos', 'error');
            } finally {
                if (btn) btn.innerHTML = '<i class="fas fa-broom mr-1"></i> Limpar fracos';
            }
        }

        async function refreshTopOffers() {
            showToast('Atualizando top ofertas na Shopee…', 'success');
            try {
                const res = await adminFetch(`${API_BASE}/api/ofertas/refresh-top`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ limit: 40 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast(`Top: ${data.updated} atualizados · ${data.purged || 0} removidos`, 'success');
                await loadOffersFromSupabase({ silent: true, reset: true });
            } catch (err) {
                showToast(err.message || 'Falha no refresh-top', 'error');
            }
        }

        async function prioritizeConversionWinners() {
            if (toolBusy.prioritize) { showToast('Já rodando', 'warning'); return; }
            toolBusy.prioritize = true;
            showToast('Priorizando winners no sync…', 'success');
            try {
                const days = Number(document.getElementById('conversion-days')?.value) || 30;
                const res = await adminFetch(`${API_BASE}/api/conversions/prioritize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ days }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                showToast(`${data.jobsQueued} keywords na fila prioritária`, 'success');
            } catch (err) {
                showToast(err.message || 'Falha ao priorizar', 'error');
            } finally {
                toolBusy.prioritize = false;
            }
        }

        async function loadConversionSummary() {
            const list = document.getElementById('conversion-list');
            if (list) list.innerHTML = '<p class="text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando canais…</p>';
            try {
                const days = Number(document.getElementById('conversion-days')?.value) || 30;
                const res = await adminFetch(`${API_BASE}/api/conversions/summary?days=${days}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const channels = data.channels || [];
                const tops = data.topItems || [];
                if (list) {
                    list.innerHTML = `
                        <div class="space-y-3">
                            <div>
                                <p class="text-[10px] font-bold uppercase text-slate-500 mb-2">Por canal (Sub ID)</p>
                                ${channels.length ? channels.map((c) => `
                                    <div class="flex justify-between text-xs border-b border-slate-50 py-1.5">
                                        <span class="font-semibold text-slate-700">${escapeHtml(c.channel)}</span>
                                        <span>${c.conversions} conv · <strong class="text-emerald-600">R$ ${(Number(c.commission)||0).toFixed(2).replace('.',',')}</strong></span>
                                    </div>`).join('') : '<p class="text-slate-400 text-xs">Sem dados de canal ainda.</p>'}
                            </div>
                            <div>
                                <p class="text-[10px] font-bold uppercase text-slate-500 mb-2">Top itens</p>
                                ${tops.slice(0, 10).map((t) => `
                                    <div class="text-xs truncate py-1">#${t.itemId} · ${escapeHtml(t.itemName || '')} · qty ${t.qty}</div>
                                `).join('') || '<p class="text-slate-400 text-xs">Sem itens.</p>'}
                            </div>
                        </div>`;
                }
            } catch (err) {
                if (list) list.innerHTML = `<p class="text-rose-500 text-xs">${escapeHtml(err.message)}</p>`;
            }
        }

        async function renderMoneyQueue() {
            const box = document.getElementById('money-queue-box');
            if (!box) return;
            box.innerHTML = '<p class="text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando top comissão…</p>';
            try {
                // Garante catálogo admin carregado
                if (!AM.productsDatabase.length) {
                    await loadOffersFromSupabase({ silent: true, reset: true }).catch(() => {});
                }
                const list = sortByMoney(femaleOnly(AM.productsDatabase)).slice(0, 20);
                window.__moneyQueue = list;
                if (!list.length) {
                    box.innerHTML = '<p class="text-slate-500">Nenhum produto feminino no banco. Rode o Explorador (preset Feminino + comissão) ou Preencher buracos.</p>';
                    return;
                }
                const missing = list.filter((p) => !p.shortLink).length;
                box.innerHTML = `
                    <p class="mb-3 text-slate-600">${list.length} top · <strong class="text-amber-700">${missing} sem shortlink</strong> · score = comissão × vendas × nota</p>
                    <div class="space-y-2">${list.map((p) => {
                        const id = p.itemId || p.id;
                        const price = Number(p.newPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const score = moneyScoreOf(p).toFixed(1);
                        const hasSl = !!p.shortLink;
                        const link = p.shortLink || p.affiliateLink || p.productLink || '';
                        return `<div class="flex flex-wrap items-center gap-2 border border-slate-100 rounded-lg p-2 hover:border-amber-200">
                            <img src="${escapeHtml(p.image || '')}" class="w-10 h-10 rounded object-cover bg-slate-100 shrink-0" alt="" onerror="this.style.display='none'">
                            <div class="min-w-0 flex-1">
                                <p class="font-semibold text-slate-800 text-[11px] line-clamp-1">${escapeHtml(p.title || '')}</p>
                                <p class="text-[10px] text-slate-500">${price} · <span class="text-emerald-700 font-bold">${escapeHtml(p.commissionRate || '—')}</span> · score <span class="text-amber-700 font-bold">${score}</span>${hasSl ? ' · <span class="text-emerald-600">shope.ee</span>' : ' · <span class="text-rose-500">sem shortlink</span>'}</p>
                            </div>
                            <div class="flex flex-wrap gap-1 shrink-0">
                                ${!hasSl ? `<button type="button" onclick="moneyQueueMakeShortlink('${id}')" class="px-2 py-1 rounded bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600">Shortlink</button>` : ''}
                                <button type="button" onclick="moneyQueueCopyLink('${id}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold hover:bg-slate-200">Copiar</button>
                                <a href="${escapeHtml(link || '#')}" target="_blank" rel="nofollow sponsored noopener" class="px-2 py-1 rounded bg-shopee-orange text-white text-[10px] font-bold hover:bg-orange-600 ${link ? '' : 'pointer-events-none opacity-40'}">Abrir</a>
                                <button type="button" onclick="moneyQueueToExplorer('${id}')" class="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold hover:bg-slate-700">Explorar</button>
                            </div>
                        </div>`;
                    }).join('')}</div>`;
            } catch (err) {
                box.innerHTML = `<p class="text-rose-500">${escapeHtml(err.message)}</p>`;
            }
        }

        function moneyQueueFind(id) {
            const sid = String(id);
            return (window.__moneyQueue || []).find((p) => String(p.itemId || p.id) === sid)
                || AM.productsDatabase.find((p) => String(p.itemId || p.id) === sid);
        }

        async function moneyQueueMakeShortlink(id) {
            const p = moneyQueueFind(id);
            if (!p) return showToast('Produto não encontrado', 'error');
            const origin = p.affiliateLink || p.productLink || p.offerLink || '';
            if (!origin) return showToast('Sem link de afiliado', 'error');
            try {
                const res = await adminFetch(`${API_BASE}/api/shortlink`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originUrl: origin,
                        itemId: Number(p.itemId || p.id),
                        subIds: p.subIds || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                p.shortLink = data.shortLink;
                showToast('Shortlink gerado', 'success');
                renderMoneyQueue();
                loadShortlinkStatus();
            } catch (err) {
                showToast(err.message || 'Falha no shortlink', 'error');
            }
        }

        function moneyQueueCopyLink(id) {
            const p = moneyQueueFind(id);
            if (!p) return;
            const link = p.shortLink || p.affiliateLink || p.productLink || '';
            if (!link) return showToast('Sem link', 'error');
            copyTextToClipboard(link, 'Link copiado');
        }

        function moneyQueueToExplorer(id) {
            const p = moneyQueueFind(id);
            if (!p) return;
            const words = String(p.title || '')
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .split(/[^a-z0-9]+/)
                .filter((t) => t.length > 3)
                .slice(0, 4)
                .join(' ');
            const kwEl = document.getElementById('admin-keyword');
            const lt = document.getElementById('admin-list-type');
            const st = document.getElementById('admin-sort-type');
            const rc = document.getElementById('admin-require-commission');
            if (kwEl) kwEl.value = words || p.keyword || 'vestido feminino';
            if (lt) lt.value = '1';
            if (st) st.value = '5';
            if (rc) rc.checked = true;
            if (p.shopId) {
                const shopEl = document.getElementById('admin-shop-id');
                if (shopEl) shopEl.value = String(p.shopId);
            }
            updateExplorerKwCount();
            updateExplorerModeHint();
            document.getElementById('admin-keyword')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('Keywords no Explorador — clique Pré-visualizar', 'success');
        }

        async function moneyQueueShortlinkTop() {
            const list = (window.__moneyQueue || sortByMoney(femaleOnly(AM.productsDatabase)).slice(0, 20))
                .filter((p) => !p.shortLink);
            if (!list.length) {
                showToast('Top já tem shortlink', 'success');
                return renderMoneyQueue();
            }
            showToast(`Gerando shortlink em ${Math.min(list.length, 10)} produtos…`, 'info');
            for (const p of list.slice(0, 10)) {
                await moneyQueueMakeShortlink(p.itemId || p.id);
            }
        }

        function loadCategoryKeywordsToExplorer(catId, subId) {
            const cat = AM.categories.find((c) => c.id === catId);
            if (!cat) return showToast('Categoria não encontrada', 'error');
            let kws = [];
            const subs = subId
                ? (cat.subcategories || []).filter((s) => s.id === subId)
                : (cat.subcategories || []);
            for (const s of subs) {
                if (Array.isArray(s.keywords) && s.keywords.length) {
                    kws.push(...s.keywords.slice(0, 5));
                } else {
                    kws.push(`${s.label} feminino`.toLowerCase());
                }
            }
            // Cobertura (se já carregou) complementa com keywords femininas
            const cov = (window.__coverageReport?.categories || []).find((c) => c.id === catId);
            if (cov) {
                const covSubs = subId
                    ? (cov.subcategories || []).filter((s) => s.id === subId)
                    : (cov.subcategories || []);
                for (const s of covSubs) {
                    kws.push(...(s.femaleKeywords || s.keywords || []).slice(0, 3));
                }
            }
            kws = [...new Set(kws.map((k) => String(k).trim()).filter(Boolean))].slice(0, 15);
            const kwEl = document.getElementById('admin-keyword');
            const lt = document.getElementById('admin-list-type');
            const st = document.getElementById('admin-sort-type');
            const rc = document.getElementById('admin-require-commission');
            if (kwEl) kwEl.value = kws.join(', ');
            if (lt) lt.value = '1';
            if (st) st.value = '5';
            if (rc) rc.checked = true;
            updateExplorerKwCount();
            updateExplorerModeHint();
            document.getElementById('admin-keyword')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast(`${kws.length} keywords de ${cat.label} no Explorador`, 'success');
        }

        function copyTextToClipboard(text, successMsg) {
            const temp = document.createElement('textarea');
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast(successMsg, "success");
        }


        async function renderAdminCategoriesPanel() {
            const box = document.getElementById('admin-categories-panel');
            if (!box) return;
            try {
                await loadCategoriesFromApi({ silent: true });
                const cats = (AM.categories || []).filter((c) => c.id !== 'todos');
                if (!cats.length) {
                    box.innerHTML = '<p>Sem categorias da API.</p>';
                    return;
                }
                box.innerHTML = cats.map((c) => {
                    const fem = ['moda','beleza','acessorios','fitness','maternidade','saude','casa','presentes','pet','infantil'].includes(c.id);
                    const subs = (c.subcategories || []).map((s) =>
                        `<button type="button" onclick="loadCategoryKeywordsToExplorer('${c.id}','${s.id}')" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 hover:border-pink-300 text-slate-600">${escapeHtml(s.label)} <span class="text-slate-400">${s.count || 0}</span></button>`
                    ).join(' ');
                    return `<div class="mb-3 border-b border-slate-50 pb-3">
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span class="font-bold text-slate-700">${fem ? '♀' : '·'} ${escapeHtml(c.label)} <span class="text-slate-400 font-normal">${c.count || 0}</span></span>
                            <div class="flex gap-1">
                                <button type="button" onclick="loadCategoryKeywordsToExplorer('${c.id}')" class="px-2 py-1 rounded bg-pink-50 text-pink-700 text-[10px] font-bold hover:bg-pink-100">Keywords → Explorador</button>
                                <button type="button" onclick="document.getElementById('admin-cat-sync').value='${c.id}'; adminSyncCategory()" class="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold hover:bg-slate-700">Sync</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1">${subs || '<span class="text-slate-400">Sem subs</span>'}</div>
                    </div>`;
                }).join('');
            } catch (err) {
                box.innerHTML = `<p class="text-rose-500">${escapeHtml(err.message)}</p>`;
            }
        }

    window.__AM_ADMIN = {
        initAdminUi, switchAdminView, toggleAdminSidebar,
        submitAdminLogin, logoutAdmin, checkAdminSession,
        adminFetch, renderConsoleProducts, loadAdminStats,
        loadAutoStatus, loadShortlinkStatus, loadConversions,
        populateAdminCategorySelect, loadAdminCatalogFull,
    };
    // Expõe handlers usados por onclick no HTML do painel
    const exposeMap = {
        syncAllCategories, syncCategory, applyExplorerPreset, runExplorerSearch,
        saveExplorerSelection, cancelExplorerSearch, toggleExplorerSelectAll, onExplorerItemToggle,
        saveCurrentCampaign, deleteSavedCampaign, loadSavedCampaignIntoEditor, copyCampaignLink,
        copySavedCampaignLinks, addProductToCampaign, removeProductFromCampaign, addCampaignProductById,
        renderCampaignProductPicker, resolveCampaignProductById, clearCampaignProductSearch,
        onCampaignProductSearchKey, syncSavedCampaigns,
        generateCampaignShopeeLinks, copyCampaignShopeeLinks,
        updateCampaignLinkPreview, updateSubIdPreview, loadCampaignPerformance, openCampaignPerfDetail,
        closeCampaignPerfDetail, openCampaignPerfByName, loadMeuSiteSummary, pullConversionsNow,
        reprocessSubIdsDry, reprocessSubIdsRun, runReverify, runFeed, runRefreshMetrics,
        loadFeedInventory, decodeLink, runBatchShortlink, runReverifyBatch,
        loadShopExplorer, loadShopeeCampaignsExplorer, loadShopeeHealth, loadValidatedReport,
        loadConversions, previousConversionPage, nextConversionPage,
        onAdminSearch, onAdminFiltersChange, onAdminPageSizeChange, clearAdminFilters,
        toggleAdminProductSelect, toggleSelectAdminPage, selectAllFilteredProducts, clearAdminProductSelection,
        addSelectedProductsToCampaign, adminPrevPage, adminNextPage, removeProductFromDatabase,
        updateSingleAffiliateLink, openNewProductForm, closeNewProductForm, saveNewProduct,
        runShortlinkBackfill, runAutoSyncNow, runTopPerformanceNow, adminSyncCategory,
        loadOfficialShopeeOffers, useOfficialInExplorer, importOfficialShopeeOffers,
        loadCoverageReport, runCoverageFill, scanCatalogDuplicates, removeCatalogDuplicates,
        scanWeakOffers, purgeWeakOffers, refreshTopOffers, prioritizeConversionWinners,
        loadConversionSummary, moneyQueueFind, moneyQueueMakeShortlink, moneyQueueCopyLink,
        moneyQueueToExplorer, moneyQueueShortlinkTop, loadCategoryKeywordsToExplorer,
        resetVitrineAndRefill, loadAdminCatalogFull, syncDefaultKeywords, fetchLiveOffers,
        populateAdminCategorySelect, renderAdminCategoriesPanel, renderConsoleProducts,
        loadAdminStats, loadAutoStatus, loadShortlinkStatus,
    };
    for (const [k, v] of Object.entries(exposeMap)) {
        if (typeof v === "function") window[k] = v;
    }
    // Espelha no __AM_ADMIN tudo que o boot da vitrine chama via window.*
    Object.assign(window.__AM_ADMIN, Object.fromEntries(
        Object.entries(exposeMap).filter(([, v]) => typeof v === "function")
    ));
})();

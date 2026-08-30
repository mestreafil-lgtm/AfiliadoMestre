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
    const parseUtmContent = AM.parseUtmContent || function (utm) {
        const parts = String(utm || "").split(/[-_|,;/]/).map((s) => s.trim());
        return {
            site: parts[0] || "",
            channel: parts[1] || "",
            campaign: parts[2] || "",
            category: parts[3] || "",
            product: parts[4] || "",
            raw: parts,
        };
    };
    const SITE_SUBID = AM.SITE_SUBID || "afiliadamestre";
    const getTrackingSubIds = AM.getTrackingSubIds;
    const getSubIdSettings = AM.getSubIdSettings;
    const moneyScoreOf = (...a) => AM.moneyScoreOf(...a);
    const femaleOnly = (...a) => AM.femaleOnly(...a);
    const sortByMoney = (...a) => AM.sortByMoney(...a);

    // Bancos de palavras-chave femininas (nichos que convertem para público 95% feminino).
    // Cada preset usa até ~25 palavras — assim o admin pode combinar 2 presets sem estourar o cap.
    const KW_BELEZA = "kit skincare, protetor solar facial, sérum vitamina c, ácido hialurônico, retinol facial, creme antissinais, hidratante facial, água micelar, esfoliante facial, máscara facial, colágeno hidrolisado, colágeno verisol, óleo capilar, ampola capilar, shampoo antiqueda, máscara reconstrução, escova secadora, chapinha profissional, kit maquiagem, base líquida hd, batom líquido matte, blush em creme, iluminador facial, perfume feminino importado, body splash";
    const KW_MODA = "vestido longo feminino, vestido midi feminino, vestido festa feminino, vestido plus size, vestido tubinho, saia longa feminina, saia jeans, blusa feminina, cropped feminino, camisa social feminina, blazer feminino, casaco feminino, jaqueta jeans feminina, calça pantalona, calça wide leg, short jeans feminino, short cintura alta, macacão feminino longo, conjunto feminino, kimono feminino, moletom feminino oversized, pijama feminino, biquíni feminino, maiô feminino";
    const KW_FITNESS = "conjunto fitness feminino, legging cintura alta, top fitness feminino, short fitness feminino, macaquinho fitness, cropped fitness, tênis feminino fitness, tênis feminino casual, garrafa térmica água, coqueteleira academia, whey protein, colágeno hidrolisado, cinta modeladora, waist trainer, canga feminina, biquíni sunquíni";
    const KW_ACESSORIOS = "bolsa feminina, bolsa transversal feminina, bolsa tote feminina, mochila feminina, carteira feminina, sandália feminina, rasteirinha feminina, chinelo slide feminino, óculos de sol feminino, relógio feminino, kit joias, colar feminino, brinco feminino, anel feminino, pulseira feminina, correntinha ouro, piercing fake, presilha cabelo, tiara feminina";
    const KW_CASA = "organizador cozinha, organizador armário, organizador maquiagem, caixa organizadora, cesto organizador, kit banheiro rose gold, tapete sala, jogo de cama casal, jogo de toalha, cortina sala, almofada decorativa, luminária decorativa, quadro decorativo, espelho decorativo, difusor aromas, vela aromatizada, panela antiaderente, air fryer, sanduicheira";
    const KW_MAE_BEBE = "roupa bebê menina, kit maternidade, mochila maternidade, saída maternidade, body bebê, macacão bebê, sapatinho bebê, roupinha recém nascido, brinquedo educativo bebê, chocalho bebê, mordedor bebê, mamadeira anticólica, chupeta ortodôntica, fralda descartável";
    const KW_FEMALE_ELITE = KW_BELEZA + ", " + KW_MODA + ", " + KW_ACESSORIOS;

    const EXPLORER_PRESETS = {
        // "Elite" = volume máximo: Recomendados + Vendidos traz até 20/keyword aprovados (testado ~468 únicos com 25 keywords).
        // listType=1 (comissão) fica reservado ao preset "female_9" para cherry-picking de comissão alta.
        female_money: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 5,
            keywords: KW_FEMALE_ELITE, limit: 50, pages: 3,
        },
        female_9: {
            listType: 1, sortType: 5, minRating: 4.0, minSales: 10, requireCommission: true, minCommissionPct: 9,
            keywords: KW_FEMALE_ELITE, limit: 50, pages: 3,
        },
        beleza: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: KW_BELEZA, limit: 50, pages: 3,
        },
        moda: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 30, requireCommission: true, minCommissionPct: 3,
            keywords: KW_MODA, limit: 50, pages: 3,
        },
        fitness: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: KW_FITNESS, limit: 50, pages: 3,
        },
        acessorios: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: KW_ACESSORIOS, limit: 50, pages: 3,
        },
        casa: {
            listType: 0, sortType: 2, minRating: 4.2, minSales: 30, requireCommission: true, minCommissionPct: 3,
            keywords: KW_CASA, limit: 50, pages: 3,
        },
        mae_bebe: {
            listType: 0, sortType: 2, minRating: 4.3, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: KW_MAE_BEBE, limit: 50, pages: 3,
        },
        ams: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: KW_FEMALE_ELITE, limit: 50, pages: 3, isAMSOffer: true,
        },
        diverse_5: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 30, requireCommission: true, minCommissionPct: 5,
            keywords: "organizador cozinha, tapete pet, lampada led, cabo usb, suporte celular, caixa organizadora",
            limit: 50, pages: 3,
        },
        bestsellers: {
            listType: 0, sortType: 2, minRating: 4.0, minSales: 50, requireCommission: true, minCommissionPct: 0,
            keywords: "vestido longo feminino, blusa feminina, tênis feminino, kit skincare, maquiagem, perfume feminino, bolsa feminina",
        },
        topperf: {
            listType: 2, sortType: 2, minRating: 4.2, minSales: 20, requireCommission: true, minCommissionPct: 3,
            keywords: "vestido midi feminino, skincare coreano, bolsa feminina, conjunto fitness, perfume feminino, batom matte",
        },
        commission: {
            listType: 1, sortType: 5, minRating: 4.0, minSales: 10, requireCommission: true, minCommissionPct: 8,
            keywords: "perfume feminino, smartwatch feminino, maquiagem, colageno hidrolisado, serum vitamina c, kit skincare",
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
            keywords: "creme facial, escova secadora, serum vitamina c, batom liquido matte, hidratante facial, protetor solar",
        },
        budget: {
            listType: 0, sortType: 4, minRating: 4.0, minSales: 20, requireCommission: true, minCommissionPct: 0,
            keywords: "organizador maquiagem, kit maquiagem, scrunchie, necessaire feminina, caderno aesthetic, presilha cabelo",
        },
    };
    const LIST_TYPE_LABELS_UI = {
        0: "Recomendados", 1: "Maior comissão", 2: "Mais vendidos na Shopee",
        3: "Categoria", 4: "Categoria detalhe", 5: "Loja", 6: "Coleção",
    };
    const EXPLORER_PRESET_LABELS = {
        female_9: "Feminino 9%",
        female_money: "Feminino + comissão",
        beleza: "Beleza & Skincare",
        moda: "Moda feminina",
        fitness: "Fitness feminino",
        acessorios: "Acessórios femininos",
        casa: "Casa & Decoração",
        mae_bebe: "Mãe & Bebê",
        ams: "Ofertas AMS",
        diverse_5: "Diverso 5%",
        bestsellers: "Mais vendidos",
        topperf: "Mais vendidos na Shopee",
        commission: "Maior comissão",
        collection: "Coleção",
        shop: "Loja",
        rated: "Bem avaliados",
        budget: "Custo-benefício",
    };
    const CATALOGO_VIEWS = new Set([
        "catalogo-buscar", "catalogo-atualizar", "catalogo-links",
    ]);
    const CATALOGO_BUSCAR_TABS = new Set(["palavras", "lojas", "ofertas"]);
    let currentCatalogoBuscarTab = "palavras";
    const SORT_TYPE_LABELS_UI = {
        1: "Relevância", 2: "Mais vendidos", 3: "Maior preço", 4: "Menor preço", 5: "Maior comissão",
    };

    const ADMIN_TOKEN_KEY = "afiliada_mestre_admin_token";
    const ADMIN_REFRESH_KEY = "afiliada_mestre_admin_refresh";
    const ADMIN_USER_KEY = "afiliada_mestre_admin_user";
    let adminAuthReady = false;
    let adminLoggedIn = false;
    let CONVERSION_PAGE_SIZE = 20;
    const CONVERSIONS_PULL_THROTTLE_MS = 5 * 60 * 1000;
    const CONVERSIONS_PULL_KEY = "am_last_conv_pull_ms";
    const CONVERSION_STATUS_ORDER = ["PENDING", "UNPAID", "COMPLETED", "CANCELLED"];
    const CONVERSION_STATUS_META = {
        PENDING: { label: "Pendente", icon: "fa-clock", chip: "bg-amber-50 text-amber-700 border-amber-200", tab: "border-amber-300 bg-amber-50 text-amber-800", bar: "bg-amber-400" },
        UNPAID: { label: "Não pago", icon: "fa-ban", chip: "bg-slate-100 text-slate-600 border-slate-200", tab: "border-slate-300 bg-slate-50 text-slate-700", bar: "bg-slate-400" },
        COMPLETED: { label: "Concluído", icon: "fa-circle-check", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", tab: "border-emerald-300 bg-emerald-50 text-emerald-800", bar: "bg-emerald-500" },
        CANCELLED: { label: "Cancelado", icon: "fa-circle-xmark", chip: "bg-red-50 text-red-600 border-red-200", tab: "border-red-300 bg-red-50 text-red-700", bar: "bg-red-500" },
    };
    let conversionScrollId = "";
    let conversionRows = [];
    let conversionPage = 1;
    let conversionHasNextRemote = false;
    let conversionPullBusy = false;
    let conversionStatusFilter = "";
    let conversionSearchTerm = "";
    let conversionSearchTimer = null;
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
    let explorerSkippedExisting = 0;
    let explorerHasNext = false;
    let explorerNextPage = 1;
    let explorerScanMode = "broad";
    let adminSearchTerm = "";
    let adminFilterCategory = "";
    let adminFilterType = "";
    let adminFilterSort = "recent";
    let adminSearchTimer = null;
    let campaignPerfRows = [];
    let campaignPerfSelected = "";
    let campaignPerfLoading = false;
    let campaignPerfSearch = "";
    let campaignPerfListPage = 0;
    let campaignPerfDetailTab = "resumo";
    let campaignPerfFunnelCache = null;
    let campaignPerfSalesFilter = "";
    let campaignPerfProdQ = "";
    let campaignPerfProdPage = 0;
    const CAMP_PERF_LIST_PAGE_SIZE = 12;
    const CAMP_PERF_PROD_PAGE_SIZE = 10;
    const CAMP_PERF_SALES_PAGE_SIZE = 15;
    let campaignSavedList = [];
    let campaignProductResolving = false;
    let campaignShopeeLinks = {};
    let campaignShopeeKey = "";
    let campaignShopeeLoading = false;
    let campaignEditingId = "";
    let campaignSavedSearch = "";
    let campaignSavedPage = 0;
    const CAMP_SAVED_PAGE_SIZE = 10;
    const CAMPAIGN_CHANNEL = "ads";

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
                panel.classList.remove("flex", "is-open");
                panel.style.display = "none";
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
                    panel.classList.remove("flex", "is-open");
                    panel.style.display = "none";
                }
                if (login) {
                    login.classList.add("hidden");
                    login.classList.remove("flex");
                }
                document.documentElement.classList.remove("admin-mode");
                document.body.classList.remove("admin-mode");
                try { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; } catch (_) {}
                return;
            }

            document.documentElement.classList.add("admin-mode");
            document.body.classList.add("admin-mode");
            try { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; } catch (_) {}
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
                panel.classList.add("flex", "is-open");
                panel.style.display = "flex";
            }

            const badge = document.getElementById("admin-api-badge");
            if (badge) badge.classList.remove("hidden");

            loadSubIdSettings();
            loadAutoStatus();

            const parts = pathClean().split("/").filter(Boolean);
            let view = parts[1] || "dashboard";
            const legacyMap = {
                console: "produtos",
                performance: "desempenho",
                campaigns: "campanhas",
                "campaign-perf": "campanha-desempenho",
                "campanhas-desempenho": "campanha-desempenho",
                preview: "vitrine-preview",
                "preview-index": "vitrine-preview",
                catalogo: "catalogo-buscar",
                ferramentas: "catalogo-atualizar",
                "catalogo-explorador": "catalogo-buscar",
                "catalogo-lojas": "catalogo-buscar",
                "catalogo-ofertas": "catalogo-buscar",
                "catalogo-cobertura": "catalogo-buscar",
                "catalogo-money": "catalogo-buscar",
                "catalogo-sync": "catalogo-atualizar",
                "catalogo-feeds": "catalogo-atualizar",
                "catalogo-shortlinks": "catalogo-links",
            };
            // Guarda a rota legada para restaurar a aba/atalho depois
            const legacyTabMap = {
                "catalogo-lojas": { tab: "lojas" },
                "catalogo-ofertas": { tab: "ofertas" },
                "catalogo-cobertura": { shortcut: "coverage" },
                "catalogo-money": { shortcut: "money" },
            };
            const legacyIntent = legacyTabMap[view] || null;
            if (legacyMap[view]) view = legacyMap[view];
            if (!ADMIN_VIEWS[view]) view = "dashboard";
            setTimeout(() => switchAdminView(view, { skipUrl: true, ...(legacyIntent || {}) }), 0);
        }

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
                document.body.style.overflow = open && window.matchMedia("(max-width: 900px)").matches
                    ? "hidden"
                    : "";
            } catch (_) {}
        }
        /** Alias do mock / HTML alternativo */
        function toggleMobileSidebar(forceOpen) {
            return toggleAdminSidebar(forceOpen);
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
                btn.classList.toggle("tab", true);
                btn.style.background = on ? "#fff" : "transparent";
                btn.style.color = on ? "#0f172a" : "#64748b";
                btn.style.fontWeight = on ? "600" : "500";
                btn.classList.toggle("bg-white", on);
                btn.classList.toggle("text-slate-800", on);
                btn.classList.toggle("shadow-sm", on);
                btn.classList.toggle("text-slate-600", !on);
            });
        }

        function toggleCatalogoSubmenu(forceOpen) {
            const sub = document.getElementById("nav-catalogo-submenu");
            const toggle = document.getElementById("nav-catalogo-toggle");
            if (!sub) return;
            const open = forceOpen === undefined ? !sub.classList.contains("open") : !!forceOpen;
            sub.classList.toggle("open", open);
            if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }

        function switchCatalogTab(tab) {
            // Compat com chamadas antigas — mapeia para (view + tab/shortcut) do novo catálogo
            const map = {
                explorer: { view: "catalogo-buscar", tab: "palavras" },
                coverage: { view: "catalogo-buscar", shortcut: "coverage" },
                money: { view: "catalogo-buscar", shortcut: "money" },
                system: { view: "catalogo-atualizar" },
                lojas: { view: "catalogo-buscar", tab: "lojas" },
                ofertas: { view: "catalogo-buscar", tab: "ofertas" },
            };
            const target = map[tab] || map.explorer;
            switchAdminView(target.view, { tab: target.tab, shortcut: target.shortcut });
        }

        function switchCatalogoBuscarTab(tab) {
            if (!CATALOGO_BUSCAR_TABS.has(tab)) tab = "palavras";
            currentCatalogoBuscarTab = tab;
            for (const t of CATALOGO_BUSCAR_TABS) {
                const btn = document.getElementById(`cat-buscar-tab-${t}`);
                const pane = document.getElementById(`cat-buscar-pane-${t}`);
                const active = t === tab;
                if (btn) btn.classList.toggle("active", active);
                if (pane) {
                    pane.classList.toggle("hidden", !active);
                    pane.style.display = active ? "" : "none";
                }
            }
            if (tab === "lojas" && !document.getElementById("shops-preview")?.dataset.loaded) {
                // Não carrega automaticamente — usuário decide (evita gastar quota da Shopee).
            }
            if (tab === "ofertas" && !document.getElementById("official-offers-box")?.dataset.loaded) {
                // Idem.
            }
        }

        function switchAdminView(view, opts = {}) {
            if (!isAdminMode()) {
                navigateTo(`/admin/${view || "dashboard"}`);
                return;
            }
            // Aliases de rotas antigas
            if (view === "catalogo") view = "catalogo-buscar";
            if (view === "catalogo-explorador") view = "catalogo-buscar";
            if (view === "catalogo-lojas") { opts = { ...opts, tab: "lojas" }; view = "catalogo-buscar"; }
            if (view === "catalogo-ofertas") { opts = { ...opts, tab: "ofertas" }; view = "catalogo-buscar"; }
            if (view === "catalogo-cobertura") { opts = { ...opts, shortcut: "coverage" }; view = "catalogo-buscar"; }
            if (view === "catalogo-money") { opts = { ...opts, shortcut: "money" }; view = "catalogo-buscar"; }
            if (view === "catalogo-sync") view = "catalogo-atualizar";
            if (view === "catalogo-feeds") view = "catalogo-atualizar";
            if (view === "catalogo-shortlinks") view = "catalogo-links";
            if (view === "ferramentas") view = "catalogo-atualizar";
            if (!ADMIN_VIEWS[view]) view = "dashboard";

            document.querySelectorAll(".admin-view").forEach(el => el.classList.remove("active"));
            const target = document.getElementById("admin-view-" + view);
            if (target) target.classList.add("active");

            document.querySelectorAll(".admin-nav-item[data-admin-view], .nav-item[data-admin-view]").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.adminView === view);
            });
            toggleCatalogoSubmenu(CATALOGO_VIEWS.has(view));

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
            try { document.body.style.overflow = ""; } catch (_) {}
            if (view === "dashboard") {
                loadAdminStats();
                loadAutoStatus();
                loadDashboardSales();
            } else if (view === "vitrine-preview") {
                const iframe = document.getElementById("vitrine-preview-iframe");
                if (iframe && !iframe.dataset.loaded) {
                    iframe.dataset.loaded = "1";
                    iframe.src = "/";
                }
                setPreviewDevice("desktop");
            } else if (view === "catalogo-buscar") {
                populateAdminCategorySelect();
                updateExplorerKwCount();
                updateExplorerModeHint();
                renderExplorerKeywordChips();
                switchCatalogoBuscarTab(opts.tab || currentCatalogoBuscarTab || "palavras");
                if (opts.shortcut === "coverage") {
                    runCoverageShortcut();
                } else if (opts.shortcut === "money") {
                    showMoneyQueueShortcut();
                }
            } else if (view === "catalogo-atualizar") {
                populateAdminCategorySelect();
                renderAdminCategoriesPanel();
                loadAutoStatus();
                loadFeedInventory();
            } else if (view === "catalogo-links") {
                loadShortlinkStatus();
            } else if (view === "catalogo-saude") {
                loadShopeeHealth();
            } else if (view === "visualizacoes") {
                loadAnalytics();
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
                syncSavedCampaigns().then(() => renderSavedCampaignsList());
            } else if (view === "campanha-desempenho") {
                loadCampaignPerformance({ reset: true, pull: true });
            } else if (view === "desempenho") {
                loadConversions({ reset: true, pull: true });
            } else if (view === "meu-site") {
                loadMeuSiteSummary({ pull: true });
            } else if (view === "financeiro") {
                loadFinanceiro({ pull: true });
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

        const EXPLORER_KW_MAX = 80;

        function addExplorerKeyword(kw) {
            const ta = document.getElementById("admin-keyword");
            if (!ta) return;
            const next = String(kw || "").trim();
            if (!next) return;
            const kws = parseExplorerKeywords(ta.value);
            if (!kws.includes(next)) kws.push(next);
            ta.value = kws.join(", ");
            updateExplorerKwCount();
            renderExplorerKeywordChips();
            setExplorerScanMode("keyword");
        }

        function updateExplorerMassHint() {
            const slider = document.getElementById("admin-pages-mass");
            const hint = document.getElementById("explorer-mass-hint");
            const pages = Math.min(20, Math.max(1, Number(slider?.value) || 5));
            const limit = Number(document.getElementById("admin-limit")?.value) || 50;
            if (hint) hint.textContent = `${pages} página${pages === 1 ? "" : "s"} × ${limit} = até ${pages * limit} produtos`;
            const pg = document.getElementById("admin-pages");
            if (pg) {
                const opt = [...pg.options].some((o) => o.value === String(pages));
                if (opt) pg.value = String(pages);
            }
        }

        function setExplorerScanMode(mode) {
            explorerScanMode = mode === "keyword" ? "keyword" : "broad";
            const broadBtn = document.getElementById("explorer-mode-broad");
            const kwBtn = document.getElementById("explorer-mode-keyword");
            const broadPanel = document.getElementById("explorer-broad-panel");
            const kwPanel = document.getElementById("explorer-keyword-panel");
            const presets = document.getElementById("explorer-presets");
            const pagesWrap = document.getElementById("explorer-pages-select-wrap");
            const searchBtn = document.getElementById("btn-explorer-search");
            if (broadBtn) broadBtn.classList.toggle("active", explorerScanMode === "broad");
            if (kwBtn) kwBtn.classList.toggle("active", explorerScanMode === "keyword");
            if (broadPanel) broadPanel.style.display = explorerScanMode === "broad" ? "block" : "none";
            if (kwPanel) kwPanel.style.display = explorerScanMode === "keyword" ? "block" : "none";
            if (presets) {
                presets.style.display = explorerScanMode === "keyword" ? "flex" : "none";
            }
            if (pagesWrap) pagesWrap.style.display = explorerScanMode === "keyword" ? "" : "none";
            if (searchBtn && !explorerBusy) {
                searchBtn.textContent = explorerScanMode === "broad" ? "Iniciar varredura" : "Mostrar produtos";
            }
            updateExplorerMassHint();
        }

        function updateExplorerKwCount() {
            const el = document.getElementById("explorer-kw-count");
            const n = parseExplorerKeywords(document.getElementById("admin-keyword")?.value).length;
            if (el) {
                const over = n > EXPLORER_KW_MAX;
                el.textContent = `${n}/${EXPLORER_KW_MAX} palavras-chave${over ? ` — só as ${EXPLORER_KW_MAX} primeiras serão usadas` : ""}`;
                el.style.color = over ? "#dc2626" : "#94a3b8";
            }
            renderExplorerKeywordChips();
        }

        function renderExplorerKeywordChips() {
            const wrap = document.getElementById("admin-keyword-chips");
            if (!wrap) return;
            const kws = parseExplorerKeywords(document.getElementById("admin-keyword")?.value);
            if (!kws.length) {
                wrap.innerHTML = '<span style="font-size:11px;color:#cbd5e1;padding:4px 6px">nenhuma palavra ainda</span>';
                return;
            }
            wrap.innerHTML = kws.map((kw) => `
                <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#fef3c7;color:#78350f;border-radius:999px;font-size:11px;font-weight:600">
                    ${escapeHtml(kw)}
                    <button type="button" onclick="removeExplorerKeyword('${escapeHtml(kw).replace(/'/g, "&#39;")}')" style="background:transparent;border:0;color:#78350f;cursor:pointer;font-size:14px;line-height:1;padding:0 2px" title="Remover">×</button>
                </span>`).join("");
        }

        function removeExplorerKeyword(kw) {
            const ta = document.getElementById("admin-keyword");
            if (!ta) return;
            const kws = parseExplorerKeywords(ta.value).filter((k) => k !== kw);
            ta.value = kws.join(", ");
            updateExplorerKwCount();
            renderExplorerKeywordChips();
        }

        function onExplorerKeywordKey(event) {
            if (event.key !== "Enter" && event.key !== ",") return;
            const ta = event.target;
            const raw = ta.value;
            // Só materializa em chip se o cursor está no fim (fluxo natural digitar-Enter)
            if (event.key === "Enter" && event.shiftKey) return; // Shift+Enter = quebra de linha real
            event.preventDefault();
            const kws = parseExplorerKeywords(raw);
            ta.value = kws.join(", ") + (kws.length ? ", " : "");
            updateExplorerKwCount();
            renderExplorerKeywordChips();
        }

        function updateExplorerModeHint() {
            const lt = Number(document.getElementById("admin-list-type")?.value) || 0;
            const st = Number(document.getElementById("admin-sort-type")?.value) || 2;
            const matchId = document.getElementById("admin-match-id")?.value;
            const shopId = document.getElementById("admin-shop-id")?.value;
            const hint = document.getElementById("explorer-mode-hint");
            // Mostra/esconde bloco de IDs conforme o listType
            const idsWrap = document.getElementById("explorer-ids-wrap");
            if (idsWrap) {
                const needsMatchOrShop = [3, 4, 5, 6].includes(lt);
                idsWrap.classList.toggle("hidden", !needsMatchOrShop);
                idsWrap.style.display = needsMatchOrShop ? "grid" : "none";
            }
            if (!hint) return;
            let extra = "";
            if ([3, 4, 6].includes(lt)) {
                extra = matchId
                    ? ` · coleção/categoria <strong class="text-slate-700">${escapeHtml(matchId)}</strong>`
                    : ` · <span class="text-amber-700 font-bold">informe o ID da coleção ou categoria</span>`;
            }
            if (lt === 5) {
                extra = shopId
                    ? ` · loja <strong class="text-slate-700">${escapeHtml(shopId)}</strong>`
                    : ` · <span class="text-amber-700 font-bold">informe o ID da loja</span>`;
            }
            hint.innerHTML = `Modo: <strong class="text-slate-700">${LIST_TYPE_LABELS_UI[lt] || lt}</strong> · ordenado por <strong class="text-slate-700">${SORT_TYPE_LABELS_UI[st] || st}</strong>${extra}`;
        }

        function applyExplorerPreset(name) {
            const p = EXPLORER_PRESETS[name];
            if (!p) return;
            const kw = document.getElementById("admin-keyword");
            const lt = document.getElementById("admin-list-type");
            const st = document.getElementById("admin-sort-type");
            const lim = document.getElementById("admin-limit");
            const pg = document.getElementById("admin-pages");
            const mr = document.getElementById("admin-min-rating");
            const ms = document.getElementById("admin-min-sales");
            const rc = document.getElementById("admin-require-commission");
            const mc = document.getElementById("admin-min-commission");
            const ams = document.getElementById("admin-ams-offer");
            const ks = document.getElementById("admin-key-seller");
            // Preset acumula com o que o admin já digitou:
            // - keywords: dedup entre atuais e do preset
            // - dropdowns/inputs numéricos: só substitui quando o campo está vazio ou = 0
            if (kw && p.keywords != null) {
                const current = parseExplorerKeywords(kw.value);
                const incoming = parseExplorerKeywords(p.keywords);
                const merged = [...new Set([...current, ...incoming])];
                kw.value = merged.join(", ");
            }
            if (lt) lt.value = String(p.listType);
            if (st) st.value = String(p.sortType);
            if (lim) lim.value = String(p.limit != null ? p.limit : 50);
            if (pg) pg.value = String(p.pages != null ? p.pages : 3);
            if (mr && (!mr.value || Number(mr.value) === 0)) mr.value = String(p.minRating);
            if (ms && (!ms.value || Number(ms.value) === 0)) ms.value = String(p.minSales);
            if (rc) rc.checked = !!p.requireCommission || rc.checked;
            if (mc && (!mc.value || Number(mc.value) === 0)) mc.value = String(p.minCommissionPct != null ? p.minCommissionPct : 0);
            if (ams) ams.checked = !!p.isAMSOffer;
            if (ks) ks.checked = !!p.isKeySeller;
            document.querySelectorAll(".explorer-preset").forEach((btn) => {
                btn.classList.toggle("active", btn.dataset.preset === name);
            });
            updateExplorerKwCount();
            renderExplorerKeywordChips();
            updateExplorerModeHint();
            if (p.matchIdHint) showToast("Cole o ID da coleção ou categoria (aba Ofertas oficiais)", "info");
            else if (p.shopIdHint) showToast("Cole o ID da loja Shopee (aba Lojas)", "info");
            else showToast(`Atalho: ${EXPLORER_PRESET_LABELS[name] || name}`, "success");
            setExplorerScanMode("keyword");
        }

        function resetExplorerForm() {
            const kw = document.getElementById("admin-keyword");
            const lt = document.getElementById("admin-list-type");
            const st = document.getElementById("admin-sort-type");
            const lim = document.getElementById("admin-limit");
            const pg = document.getElementById("admin-pages");
            const mr = document.getElementById("admin-min-rating");
            const ms = document.getElementById("admin-min-sales");
            const rc = document.getElementById("admin-require-commission");
            const mc = document.getElementById("admin-min-commission");
            const mi = document.getElementById("admin-match-id");
            const si = document.getElementById("admin-shop-id");
            if (kw) kw.value = "";
            if (lt) lt.value = "0";
            if (st) st.value = "2";
            if (lim) lim.value = "50";
            if (pg) pg.value = "3";
            if (mr) mr.value = "4.0";
            if (ms) ms.value = "20";
            if (rc) rc.checked = true;
            if (mc) mc.value = "0";
            if (mi) mi.value = "";
            if (si) si.value = "";
            const ams = document.getElementById("admin-ams-offer");
            const ks = document.getElementById("admin-key-seller");
            if (ams) ams.checked = false;
            if (ks) ks.checked = false;
            const cat = document.getElementById("admin-product-cat");
            const mass = document.getElementById("admin-pages-mass");
            if (cat) cat.value = "100017";
            if (mass) mass.value = "5";
            document.querySelectorAll(".explorer-preset").forEach((btn) => btn.classList.remove("active"));
            updateExplorerKwCount();
            renderExplorerKeywordChips();
            updateExplorerModeHint();
            setExplorerScanMode(explorerScanMode);
            showToast("Filtros redefinidos", "info");
        }

        function runCoverageShortcut() {
            const box = document.getElementById("coverage-summary");
            if (box) { box.classList.remove("hidden"); box.style.display = "block"; }
            loadCoverageReport();
        }

        function showMoneyQueueShortcut() {
            const box = document.getElementById("money-queue-card");
            if (box) { box.classList.remove("hidden"); box.style.display = "block"; }
            renderMoneyQueue();
        }

        function getExplorerFormParams() {
            const matchRaw = document.getElementById("admin-match-id")?.value;
            const shopRaw = document.getElementById("admin-shop-id")?.value;
            const matchId = matchRaw ? Number(matchRaw) : null;
            const shopId = shopRaw ? Number(shopRaw) : null;
            const catRaw = document.getElementById("admin-product-cat")?.value;
            const productCatId = catRaw ? Number(catRaw) : null;
            const massPages = Number(document.getElementById("admin-pages-mass")?.value) || 5;
            const selectPages = Number(document.getElementById("admin-pages")?.value) || 3;
            const scanMode = explorerScanMode === "keyword" ? "keyword" : "broad";
            return {
                scanMode,
                keywords: scanMode === "broad" ? [] : parseExplorerKeywords(document.getElementById("admin-keyword")?.value),
                limit: Number(document.getElementById("admin-limit")?.value) || 50,
                pages: scanMode === "broad" ? Math.min(20, Math.max(1, massPages)) : Math.min(20, Math.max(1, selectPages)),
                listType: Number(document.getElementById("admin-list-type")?.value) || 0,
                sortType: Number(document.getElementById("admin-sort-type")?.value) || 2,
                minRating: Number(document.getElementById("admin-min-rating")?.value) || 4,
                minSales: Number(document.getElementById("admin-min-sales")?.value) || 0,
                requireCommission: !!document.getElementById("admin-require-commission")?.checked,
                minCommissionPct: Number(document.getElementById("admin-min-commission")?.value) || 0,
                isAMSOffer: !!document.getElementById("admin-ams-offer")?.checked,
                isKeySeller: !!document.getElementById("admin-key-seller")?.checked,
                matchId: Number.isFinite(matchId) && matchId > 0 ? matchId : null,
                shopId: Number.isFinite(shopId) && shopId > 0 ? shopId : null,
                productCatId: scanMode === "broad" && Number.isFinite(productCatId) && productCatId > 0 ? productCatId : null,
            };
        }

        function setExplorerProgress(show, pct = 0, label = "") {
            const wrap = document.getElementById("explorer-progress");
            const bar = document.getElementById("explorer-progress-bar");
            const pctEl = document.getElementById("explorer-progress-pct");
            const lab = document.getElementById("explorer-progress-label");
            if (!wrap) return;
            wrap.classList.toggle("hidden", !show);
            wrap.style.display = show ? "flex" : "none";
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
            const syncBtn = document.getElementById("btn-explorer-sync");
            const cancel = document.getElementById("btn-explorer-cancel");
            const idleSearch = explorerScanMode === "broad" ? "Iniciar varredura" : "Mostrar produtos";
            if (btn) {
                btn.disabled = busy;
                btn.innerHTML = busy
                    ? `<i class="fas fa-spinner fa-spin"></i> ${explorerScanMode === "broad" ? "Varrendo…" : "Buscando…"}`
                    : idleSearch;
            }
            if (syncBtn) {
                syncBtn.disabled = busy;
                syncBtn.innerHTML = busy
                    ? `<i class="fas fa-spinner fa-spin"></i> Alimentando…`
                    : "Alimentar vitrine";
            }
            if (cancel) {
                cancel.classList.toggle("hidden", !busy);
                cancel.style.display = busy ? "" : "none";
            }
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

        function productItemId(p) {
            return String(p?.itemId || p?.item_id || p?.id || "");
        }

        function filterProductsNotInVitrine(products) {
            const existing = new Set();
            for (const p of AM.productsDatabase || []) {
                const id = productItemId(p);
                if (id) existing.add(id);
            }
            const fresh = [];
            let skippedExisting = 0;
            for (const p of products || []) {
                const id = productItemId(p);
                if (id && existing.has(id)) skippedExisting += 1;
                else fresh.push(p);
            }
            return { products: fresh, skippedExisting };
        }

        function renderExplorerPreview(products, meta = {}) {
            const box = document.getElementById("explorer-preview");
            if (!box) return;
            const sorted = sortByMoney(Array.isArray(products) ? products : []);
            explorerProducts = sorted;
            explorerSkippedExisting = Number(meta.skippedExisting) || 0;
            explorerSelected = new Set(explorerProducts.map((p) => productItemId(p)));
            const selAll = document.getElementById("explorer-select-all");
            if (selAll) selAll.checked = explorerProducts.length > 0;

            if (!explorerProducts.length) {
                box.innerHTML = `
                    <div class="text-center py-8 text-slate-400 text-[11px]">
                        <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                        Nenhum produto novo na lista.
                        ${explorerSkippedExisting ? `<br><strong class="text-slate-600">${explorerSkippedExisting} já estavam na vitrine</strong> e foram ocultos.` : ""}
                        ${meta.rateLimited ? "<br><strong class='text-orange-700'>Possível limite da Shopee — aguarde e tente de novo.</strong>" : ""}
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
                            ${p.appNewRate || p.webNewRate ? `<span class="text-sky-700">app ${escapeHtml(String(p.appNewRate || "—"))} · site ${escapeHtml(String(p.webNewRate || "—"))}</span>` : ""}
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
            if (meta) {
                const skip = explorerSkippedExisting ? ` · ${explorerSkippedExisting} já na vitrine` : "";
                meta.textContent = `${explorerSelected.size} selecionados · ${explorerProducts.length} novos${skip}`;
            }
            if (btn) btn.disabled = explorerSelected.size === 0;
        }

        function setExplorerLoadMore(show) {
            const wrap = document.getElementById("explorer-pagination");
            if (wrap) wrap.style.display = show ? "block" : "none";
        }

        async function runExplorerSearch({ sync = false, append = false } = {}) {
            if (explorerBusy) return;
            const params = getExplorerFormParams();
            const needsMatch = [3, 4, 6].includes(params.listType);
            const needsShop = params.listType === 5;
            if (needsMatch && !params.matchId) {
                setExplorerStatus("error", "Este tipo de busca exige o <strong>ID da coleção ou categoria</strong> (em Ofertas oficiais).");
                showToast("Informe o ID da coleção ou categoria", "error");
                return;
            }
            if (needsShop && !params.shopId) {
                setExplorerStatus("error", "Este tipo de busca exige o <strong>ID da loja</strong>.");
                showToast("Informe o ID da loja", "error");
                return;
            }
            if (!params.keywords.length && !params.matchId && !params.shopId && !params.productCatId) {
                setExplorerStatus("error", params.scanMode === "broad"
                    ? "Escolha uma <strong>categoria Shopee</strong> para a varredura em massa."
                    : "Informe palavras-chave, ID da coleção/categoria ou ID da loja.");
                showToast(params.scanMode === "broad" ? "Escolha uma categoria" : "Digite uma palavra-chave ou ID", "error");
                return;
            }

            explorerAbort = new AbortController();
            setExplorerBusy(true);
            const modeLabel = params.scanMode === "broad"
                ? `varredura · cat ${params.productCatId}`
                : (LIST_TYPE_LABELS_UI[params.listType] || "lista");
            setExplorerProgress(true, 8, sync ? "Buscando e gravando na vitrine…" : (params.scanMode === "broad" ? "Varrendo a Shopee…" : "Buscando na Shopee…"));
            setExplorerStatus("info", params.scanMode === "broad"
                ? `Varredura em massa · categoria ${params.productCatId} · ${params.pages} página(s) × ${params.limit}…`
                : `Consultando ${params.keywords.length || 1} origem(ns) × ${params.pages} página(s) · ${modeLabel}…`);

            let fakePct = 8;
            const tick = setInterval(() => {
                fakePct = Math.min(90, fakePct + (90 - fakePct) * 0.08);
                setExplorerProgress(true, fakePct, `Shopee · ${modeLabel}…`);
            }, 400);

            const byId = new Map();
            if (append) {
                for (const p of explorerProducts) {
                    const id = productItemId(p);
                    if (id) byId.set(id, p);
                }
            }
            let skipped = append ? explorerSkippedExisting : 0;
            let filteredOut = 0;
            let rateLimited = false;
            let saved = 0;
            let pageStart = append ? explorerNextPage : 1;
            const target = sync || params.scanMode === "broad" ? Infinity : 80;
            const maxRounds = append ? 1 : (params.scanMode === "broad" ? 1 : 4);

            try {
                for (let round = 0; round < maxRounds; round++) {
                    const res = await adminFetch(`${API_BASE}/api/ofertas/batch`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: explorerAbort.signal,
                        body: JSON.stringify({
                            keywords: params.keywords,
                            pages: params.pages,
                            pageStart,
                            limit: params.limit,
                            listType: params.listType,
                            sortType: params.sortType,
                            minRating: params.minRating,
                            minSales: params.minSales,
                            requireCommission: params.requireCommission,
                            minCommissionPct: params.minCommissionPct,
                            matchId: params.matchId,
                            shopId: params.shopId,
                            productCatId: params.productCatId,
                            isAMSOffer: params.isAMSOffer,
                            isKeySeller: params.isKeySeller,
                            sync: sync && round === 0,
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        rateLimited = data.rateLimited || res.status === 429;
                        if (round === 0) {
                            clearInterval(tick);
                            setExplorerStatus(rateLimited ? "rate" : "error", escapeHtml(data.error || `HTTP ${res.status}`));
                            showToast(data.error || "Falha na busca", "error");
                            return;
                        }
                        break;
                    }
                    rateLimited = rateLimited || !!data.rateLimited;
                    filteredOut += Number(data.filteredOut) || 0;
                    skipped += Number(data.skippedExisting) || 0;
                    if (sync && data.saved) saved += Number(data.saved) || 0;
                    const extra = filterProductsNotInVitrine(data.products || []);
                    skipped += extra.skippedExisting || 0;
                    for (const p of extra.products) {
                        const id = productItemId(p);
                        if (id && !byId.has(id)) byId.set(id, p);
                    }
                    explorerHasNext = !!data.hasNextPage;
                    explorerNextPage = Number(data.nextPageStart) || (pageStart + params.pages);
                    pageStart = explorerNextPage;
                    if (sync || !explorerHasNext || rateLimited || byId.size >= target) break;
                }
                clearInterval(tick);
                setExplorerProgress(true, 100, "Pronto");
                const products = [...byId.values()];
                renderExplorerPreview(products, { skippedExisting: skipped, rateLimited, filteredOut });
                setExplorerLoadMore(!sync && explorerHasNext && !rateLimited);
                const savedBit = sync && saved ? ` · <strong>${saved} salvos</strong>` : "";
                const skipBit = skipped ? ` · <strong>${skipped} já estavam na vitrine</strong>` : "";
                setExplorerStatus(
                    products.length ? "success" : "empty",
                    `${products.length} novos · ${modeLabel}${skipBit}${filteredOut ? ` · ${filteredOut} filtrados` : ""}${savedBit}${rateLimited ? " · limite da Shopee" : ""}`
                );
                if (skipped && !sync) showToast(`${products.length} novos · ${skipped} já estavam na vitrine`, products.length ? "success" : "info");
                if (sync && saved) {
                    showToast(`${saved} novos na vitrine · ${skipped} já estavam`, "success");
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
            const basePath = productId ? `/p/${encodeURIComponent(String(productId))}` : '/';
            const url = new URL(location.origin + basePath);
            url.searchParams.set('utm_source', sanitizeSubId(channel || CAMPAIGN_CHANNEL, CAMPAIGN_CHANNEL));
            url.searchParams.set('utm_campaign', sanitizeSubId(campaign, ''));
            url.searchParams.set('utm_medium', 'social');
            return url.toString();
        }

        function getCampaignChannel() {
            return CAMPAIGN_CHANNEL;
        }

        function getCampaignTitle() {
            return String(document.getElementById('campaign-link-title')?.value || '').trim();
        }

        function getCampaignSlug() {
            return sanitizeSubId(document.getElementById('campaign-link-name')?.value || '', '');
        }

        function getCampaignSelectedProducts() {
            return campaignSelectedProducts;
        }

        function isTrackedAffiliateUrl(url) {
            const u = String(url || '').trim();
            if (!u || u === '#') return false;
            if (/shope\.ee\//i.test(u) || /\bs\.shopee\./i.test(u)) return true;
            if (/universal-link|an_redir|uls_trackid|affiliate/i.test(u)) return true;
            return false;
        }

        function productHasAffiliate(p) {
            if (!p) return false;
            return isTrackedAffiliateUrl(p.shortLink)
                || isTrackedAffiliateUrl(p.affiliateLink)
                || isTrackedAffiliateUrl(p.offerLink)
                || isTrackedAffiliateUrl(p.offer_link);
        }

        function campaignProductPatchFrom(p, tracking = {}) {
            const affiliate = tracking.affiliateLink
                || p?.affiliateLink
                || p?.offerLink
                || p?.offer_link
                || '';
            const shortLink = tracking.shortLink || p?.shortLink || '';
            return {
                id: p.id,
                title: p?.title || `Produto ${p.id}`,
                category: p?.category || 'geral',
                image: p?.image || '',
                price: Number(p?.newPrice ?? p?.price) || 0,
                shortLink: isTrackedAffiliateUrl(shortLink) ? shortLink : '',
                affiliateLink: isTrackedAffiliateUrl(affiliate) ? affiliate : '',
            };
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
            if (!productHasAffiliate(p)) {
                if (!silent) showToast('Esse produto ainda não tem link de afiliado — buscando na Shopee…', 'error');
                return false;
            }
            campaignSelectedProducts.push(campaignProductPatchFrom(p));
            if (!silent) {
                renderCampaignSelectedProducts();
                updateCampaignLinkPreview();
            }
            return true;
        }

        async function repairCampaignProduct(id, { silent = false } = {}) {
            const itemId = String(id || '').trim();
            if (!itemId) return false;
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/campanha/produto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: itemId }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.product) throw new Error(data?.error || `HTTP ${res.status}`);
                const product = data.product;
                const tracking = data.tracking || {};
                if (!AM.productsDatabase.some(p => String(p.id) === String(product.id))) {
                    AM.productsDatabase.push(product);
                } else {
                    const idxDb = AM.productsDatabase.findIndex(p => String(p.id) === String(product.id));
                    if (idxDb >= 0) {
                        AM.productsDatabase[idxDb] = {
                            ...AM.productsDatabase[idxDb],
                            ...product,
                            shortLink: tracking.shortLink || product.shortLink,
                            affiliateLink: tracking.affiliateLink || product.affiliateLink,
                        };
                    }
                }
                const patched = campaignProductPatchFrom({ ...product, ...tracking }, tracking);
                if (!productHasAffiliate(patched)) {
                    throw new Error('A Shopee não devolveu link de afiliado para este item');
                }
                const idx = campaignSelectedProducts.findIndex(x => String(x.id) === String(patched.id));
                if (idx >= 0) campaignSelectedProducts[idx] = { ...campaignSelectedProducts[idx], ...patched };
                else campaignSelectedProducts.push(patched);
                renderCampaignSelectedProducts();
                updateCampaignLinkPreview();
                if (!silent) showToast('Link de afiliado corrigido', 'success');
                return true;
            } catch (err) {
                if (!silent) showToast(`Não foi possível gerar o link de afiliado: ${err.message}`, 'error');
                return false;
            }
        }

        async function ensureCampaignProduct(productOrId, { silent = false } = {}) {
            const p = typeof productOrId === 'object'
                ? productOrId
                : AM.productsDatabase.find(x => String(x.id) === String(productOrId));
            const id = p ? p.id : Number(productOrId);
            if (!id) {
                if (!silent) showToast('Informe um ID de produto válido', 'error');
                return false;
            }
            const existing = campaignSelectedProducts.find(x => String(x.id) === String(id));
            if (existing && productHasAffiliate(existing)) return true;
            if (existing && !productHasAffiliate(existing)) {
                return repairCampaignProduct(id, { silent });
            }
            if (productHasAffiliate(p)) {
                return addProductToCampaign(p, { silent });
            }
            return resolveCampaignProductById(String(id));
        }

        async function repairMissingCampaignAffiliates({ silent = false } = {}) {
            const missing = campaignSelectedProducts.filter((p) => !productHasAffiliate(p));
            if (!missing.length) return true;
            if (!silent) {
                setCampaignProductStatus(`<i class="fas fa-spinner fa-spin mr-1"></i> Corrigindo ${missing.length} link(s) de afiliado…`);
            }
            let ok = 0;
            for (const p of missing) {
                if (await repairCampaignProduct(p.id, { silent: true })) ok += 1;
            }
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
            const still = campaignSelectedProducts.filter((p) => !productHasAffiliate(p));
            if (still.length) {
                if (!silent) {
                    setCampaignProductStatus(`<span class="text-red-600 font-bold">Ainda falta link de afiliado em ${still.length} produto(s). Sem isso não há comissão.</span>`);
                    showToast(`${ok} corrigido(s) · ${still.length} ainda sem link de afiliado`, 'error');
                }
                return false;
            }
            if (!silent) {
                setCampaignProductStatus('<span class="text-emerald-600"><i class="fas fa-check mr-1"></i>Todos os produtos têm link de afiliado</span>');
                showToast(`${ok} link(s) de afiliado corrigidos`, 'success');
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

        /** Extrai o item_id de um ID puro ou de qualquer formato de link da Shopee (desktop/mobile). */
        function parseShopeeItemId(raw) {
            const value = String(raw || "").trim();
            if (!value) return "";
            try {
                const u = new URL(value.includes("://") ? value : `https://${value}`);
                for (const key of ["deeplink_url", "url", "smtt_url", "redirect"]) {
                    const nested = u.searchParams.get(key);
                    if (nested) {
                        const nestedId = parseShopeeItemId(nested);
                        if (nestedId) return nestedId;
                    }
                }
            } catch (_) { /* segue com regex */ }
            const bySlug = value.match(/-i\.\d+\.(\d+)/i);
            if (bySlug) return bySlug[1];
            const byPath = value.match(/\/product\/\d+\/(\d+)/i);
            if (byPath) return byPath[1];
            const byOpa = value.match(/\/(?:opaanlp|product-i|p)\/\d+\/(\d+)/i);
            if (byOpa) return byOpa[1];
            const byGeneric = value.match(/shopee\.com\.br\/[^?\s#]*?\/\d{5,}\/(\d{6,})(?:[/?#]|$)/i);
            if (byGeneric) return byGeneric[1];
            const byQuery = value.match(/[?&#](?:item[_-]?id|itemid)=(\d{6,})/i);
            if (byQuery) return byQuery[1];
            return /^\d+$/.test(value) ? value : "";
        }

        function looksLikeShopeeProductInput(raw) {
            const value = String(raw || "").trim();
            if (!value) return false;
            if (parseShopeeItemId(value)) return true;
            return /(?:^https?:\/\/)?(?:[\w.-]*shopee\.|shope\.ee\/|shp\.ee\/|s\.shopee\.)/i.test(value);
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
            const knownHasAffiliate = productHasAffiliate(known);
            if (known && knownHasAffiliate) {
                const added = addProductToCampaign(known);
                if (added) {
                    setCampaignProductStatus('<span class="text-emerald-600"><i class="fas fa-check mr-1"></i>Produto na vitrine com link de afiliado</span>');
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
                const tracking = data.tracking || {};
                if (!AM.productsDatabase.some(p => String(p.id) === String(product.id))) {
                    AM.productsDatabase.push(product);
                }
                const added = addProductToCampaign({
                    ...product,
                    shortLink: tracking.shortLink || product.shortLink,
                    affiliateLink: tracking.affiliateLink || product.affiliateLink,
                });
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
            convertCampaignProduct();
        }

        function convertCampaignProduct() {
            const typed = (document.getElementById('campaign-product-search')?.value || '').trim();
            if (!typed) {
                showToast('Busque pelo nome ou cole o link da Shopee', 'error');
                return false;
            }
            if (!looksLikeShopeeProductInput(typed)) {
                showToast('Escolha o produto na lista ou cole o link / ID da Shopee', 'error');
                renderCampaignProductPicker();
                return false;
            }
            return resolveCampaignProductById(typed);
        }

        function addCampaignProductById() {
            return convertCampaignProduct();
        }

        function pickCampaignCatalogProduct(id) {
            const p = AM.productsDatabase.find(x => String(x.id) === String(id));
            if (p && productHasAffiliate(p)) {
                const added = addProductToCampaign(p);
                if (added) clearCampaignProductSearch();
                return added;
            }
            return resolveCampaignProductById(String(id || ''));
        }

        function renderCampaignProductPicker() {
            const box = document.getElementById('campaign-product-picker');
            const raw = (document.getElementById('campaign-product-search')?.value || '').trim();
            if (!box) return;
            if (!raw || raw.length < 2) {
                box.innerHTML = '';
                box.style.display = 'none';
                setCampaignProductStatus('');
                return;
            }
            box.style.display = 'block';
            const q = raw.toLowerCase();
            const hits = AM.productsDatabase
                .filter(p =>
                    String(p.id).includes(q)
                    || String(p.title || '').toLowerCase().includes(q)
                )
                .slice(0, 8);
            const looksLikeId = looksLikeShopeeProductInput(raw);
            const lookupRow = looksLikeId
                ? `<button type="button" onclick="resolveCampaignProductById('${escapeAttr(raw)}')"
                        class="w-full flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100 text-left hover:bg-orange-100">
                        <i class="fas fa-cloud-arrow-down text-shopee-orange"></i>
                        <span class="min-w-0 flex-1">
                            <span class="block text-[11px] font-bold text-slate-700">Buscar este link/ID na Shopee</span>
                        </span>
                    </button>`
                : '';
            if (!hits.length) {
                box.innerHTML = lookupRow
                    || `<p class="text-[10px] text-slate-400 px-1">Nada no catálogo. Cole o ID ou o link.</p>`;
                return;
            }
            box.innerHTML = lookupRow + hits.map(p => `
                <button type="button" onclick="pickCampaignCatalogProduct('${String(p.id).replace(/'/g, '')}')"
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
                box.innerHTML = '';
                return;
            }
            box.innerHTML = campaignSelectedProducts.map((p) => {
                const hasAff = productHasAffiliate(p);
                const warn = hasAff ? '' : ' camp-prod-pill--warn';
                const warnBtn = hasAff
                    ? ''
                    : `<button type="button" class="camp-prod-pill-remove" title="Corrigir link de afiliado" onclick="repairCampaignProduct('${String(p.id).replace(/'/g, '')}')">!</button>`;
                return `
                <span class="camp-prod-pill${warn}" title="${escapeAttr(p.title)}">
                    <span class="camp-prod-pill-name">${escapeHtml(p.title)}</span>
                    ${warnBtn}
                    <button type="button" class="camp-prod-pill-remove" title="Remover" onclick="removeProductFromCampaign('${String(p.id).replace(/'/g, '')}')">×</button>
                </span>`;
            }).join('');
        }

        /**
         * A Shopee só aceita letras e números nos Sub IDs. Mostra o nome final
         * para o admin não achar que "ads_vestidos" chega assim no relatório.
         */
        function isCampaignSlugLocked() {
            const el = document.getElementById('campaign-link-name');
            return Boolean(el?.readOnly || el?.disabled);
        }

        function lockCampaignSlug(slug, { freeze = false } = {}) {
            const el = document.getElementById('campaign-link-name');
            if (!el) return;
            el.value = slug;
            if (freeze || campaignEditingId) {
                el.readOnly = true;
                el.style.background = '#e2e8f0';
                el.title = 'O nome da Sub ID não muda depois de Obter Link';
            }
        }

        function unlockCampaignSlugField() {
            const el = document.getElementById('campaign-link-name');
            if (!el) return;
            el.readOnly = false;
            el.style.background = '#f8fafc';
            el.title = '';
        }

        function resetCampaignForm() {
            campaignEditingId = '';
            campaignSelectedProducts = [];
            campaignShopeeLinks = {};
            campaignShopeeKey = '';
            const titleEl = document.getElementById('campaign-link-title');
            const nameEl = document.getElementById('campaign-link-name');
            if (titleEl) titleEl.value = '';
            if (nameEl) nameEl.value = '';
            unlockCampaignSlugField();
            setCampaignProductStatus('');
            clearCampaignProductSearch();
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
        }

        function renderCampaignNameHint(rawName) {
            const el = document.getElementById('campaign-name-normalized');
            if (!el) return;
            const typed = String(document.getElementById('campaign-link-name')?.value || '').trim();
            const slug = getCampaignSlug();
            if (!typed) {
                el.textContent = '';
                return;
            }
            if (!slug) {
                el.textContent = typed ? 'Use pelo menos uma letra ou número.' : '';
                return;
            }
            const typedClean = typed.toLowerCase().replace(/[^a-z0-9]/g, '');
            el.textContent = typedClean !== slug
                ? `sub_id: ${slug}`
                : (isCampaignSlugLocked()
                    ? `sub_id: ${slug}`
                    : `sub_id: ${slug}`);
        }

        function currentCampaignSignature() {
            return `${getCampaignChannel()}|${getCampaignSlug()}`;
        }

        async function generateCampaignShopeeLinks({ silent = false } = {}) {
            if (!silent) showToast('O link da campanha é o do site (Pixel). A comissão vem da conversão do produto.', 'success');
            return campaignShopeeLinks;
        }

        function copyCampaignShopeeLinks() {
            copyCampaignLink();
        }

        function updateCampaignLinkPreview() {
            const channel = getCampaignChannel();
            const campaign = getCampaignSlug();
            const el = document.getElementById('campaign-link-preview');
            const selected = getCampaignSelectedProducts();
            if (!el) return;
            renderCampaignNameHint(getCampaignTitle());

            if (!selected.length) {
                el.textContent = '';
                updateSubIdPreview(channel, campaign, null);
                return;
            }
            if (!campaign) {
                el.textContent = '';
                updateSubIdPreview(channel, '', selected[0]);
                return;
            }

            const urls = selected.map((p) => buildCampaignShareUrl(channel, campaign, p.id));
            el.textContent = urls.join('\n');
            updateSubIdPreview(channel, campaign, selected[0]);
        }

        function copyCampaignLink() {
            const preview = document.getElementById('campaign-link-preview');
            const fromPreview = String(preview?.textContent || '').trim();
            const nodes = document.querySelectorAll('#campaign-link-preview [data-campaign-url]');
            const urls = fromPreview
                ? fromPreview.split('\n').map((s) => s.trim()).filter(Boolean)
                : [...nodes].map(n => n.getAttribute('data-campaign-url') || n.textContent.trim()).filter(Boolean);
            if (!urls.length) {
                showToast('Converta um produto e clique em Obter Link', 'error');
                return;
            }
            navigator.clipboard?.writeText(urls.join('\n')).then(() => {
                showToast(urls.length > 1 ? `${urls.length} links copiados!` : 'Link copiado!', 'success');
            }).catch(() => {
                showToast('Copie o link manualmente', 'error');
            });
        }

        function updateSubIdPreview(channel, campaign, product) {
            const preview = document.getElementById('subid-preview');
            const box = document.getElementById('campaign-subid-box');
            const camp = sanitizeSubId(campaign || getCampaignSlug(), '');
            const ch = sanitizeSubId(channel || getCampaignChannel(), CAMPAIGN_CHANNEL);
            if (preview) {
                preview.textContent = camp
                    ? `utm_source=${ch}&utm_medium=social&utm_campaign=${camp}`
                    : '';
            }
            if (box) box.style.display = camp ? 'block' : 'none';
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
            const products = getCampaignSelectedProducts();
            if (!products.length) {
                showToast('Converta pelo menos um produto', 'error');
                return;
            }
            const repaired = await repairMissingCampaignAffiliates({ silent: true });
            if (!repaired || campaignSelectedProducts.some((p) => !productHasAffiliate(p))) {
                showToast('Não dá para salvar: produto sem link de afiliado da Shopee. Sem isso não há comissão.', 'error');
                renderCampaignSelectedProducts();
                return;
            }
            const title = getCampaignTitle();
            if (!title) {
                showToast('Escreva o título da campanha', 'error');
                document.getElementById('campaign-link-title')?.focus();
                return;
            }
            const typedSlug = String(document.getElementById('campaign-link-name')?.value || '').trim();
            if (!typedSlug) {
                showToast('Escreva a Sub ID da campanha', 'error');
                document.getElementById('campaign-link-name')?.focus();
                return;
            }
            const prev = campaignEditingId
                ? readSavedCampaigns().find(c => String(c.id) === String(campaignEditingId))
                : null;
            const slug = (isCampaignSlugLocked() && prev?.campaign)
                ? sanitizeSubId(prev.campaign, '')
                : sanitizeSubId(typedSlug, '');
            if (!slug) {
                showToast('A Sub ID precisa ter letras ou números', 'error');
                document.getElementById('campaign-link-name')?.focus();
                return;
            }
            if (['vitrine', 'organico', 'afiliadamestre', 'geral'].includes(slug)) {
                showToast('Escolha uma Sub ID própria — "vitrine" é o fluxo orgânico, não uma campanha de anúncio', 'error');
                document.getElementById('campaign-link-name')?.focus();
                return;
            }
            lockCampaignSlug(slug, { freeze: true });
            const channel = getCampaignChannel();
            const mapped = getCampaignSelectedProducts().map(p => ({
                id: p.id,
                title: p.title,
                category: p.category,
                image: p.image,
                price: Number(p.price) || 0,
                shortLink: p.shortLink || '',
                affiliateLink: p.affiliateLink || '',
            }));
            const links = mapped.map(p => ({
                productId: p.id,
                title: p.title,
                image: p.image,
                url: buildCampaignShareUrl(channel, slug, p.id),
                shopeeUrl: p.shortLink || null,
                // Standalone: um slot só, igual ao Sub_id que a Shopee vai gravar
                // na venda. Retrocompat: o array ainda existe com 1 item.
                subIds: [slug],
            }));
            const sameSlug = !prev
                ? readSavedCampaigns().find((c) => sanitizeSubId(c.campaign || '', '') === slug)
                : null;
            const entry = {
                id: prev?.id || sameSlug?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                channel,
                campaign: slug,
                title,
                products: mapped,
                links,
                createdAt: prev?.createdAt || sameSlug?.createdAt || new Date().toISOString(),
                exampleSubIds: links[0]?.subIds || [],
            };
            campaignEditingId = entry.id;
            const list = readSavedCampaigns().filter((c) =>
                String(c.id) !== String(entry.id)
                && sanitizeSubId(c.campaign || '', '') !== slug
            );
            list.unshift(entry);
            writeSavedCampaigns(list);
            campaignSavedList = list;
            renderSavedCampaignsList();
            renderCampaignPerformance();
            updateCampaignLinkPreview();

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
                showToast('Campanha salva', 'success');
            } catch (err) {
                showToast(`Salva neste navegador — ${err.message}`, 'error');
            }
            return entry;
        }

        async function obterCampaignLink() {
            const products = getCampaignSelectedProducts();
            if (!products.length) {
                showToast('Converta um produto antes de obter o link', 'error');
                return;
            }
            const entry = await saveCurrentCampaign();
            if (!entry) return;
            const urls = (entry.links || []).map(l => l.url).filter(Boolean);
            if (!urls.length) return;
            try {
                await navigator.clipboard?.writeText(urls.join('\n'));
                showToast(urls.length > 1 ? `${urls.length} links copiados e campanha salva` : 'Link copiado e campanha salva', 'success');
            } catch (_) {
                showToast('Campanha salva — copie o link abaixo', 'success');
            }
        }

        function renameSavedCampaign(id) {
            const list = readSavedCampaigns();
            const entry = list.find(c => String(c.id) === String(id));
            if (!entry) return;
            const next = String(prompt('Novo título da campanha:', entry.title || entry.campaign || '') || '').trim();
            if (!next) return;
            entry.title = next;
            writeSavedCampaigns(list);
            campaignSavedList = list;
            renderSavedCampaignsList();
            renderCampaignPerformance();
            if (String(campaignEditingId) === String(id)) {
                const titleEl = document.getElementById('campaign-link-title');
                if (titleEl) titleEl.value = next;
                renderCampaignNameHint(next);
            }
            adminFetch(`${API_BASE}/api/campanhas-rastreio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            }).catch(() => {});
            showToast('Título atualizado — Sub ID não mudou', 'success');
        }

        function campaignScore(c) {
            const n = Array.isArray(c?.products) ? c.products.length : 0;
            const t = new Date(c?.createdAt || 0).getTime() || 0;
            return n * 1e13 + t;
        }

        function dedupeCampaignsBySlug(list) {
            const bySlug = new Map();
            for (const c of Array.isArray(list) ? list : []) {
                const slug = sanitizeSubId(c?.campaign || '', '');
                if (!slug) continue;
                const prev = bySlug.get(slug);
                if (!prev || campaignScore(c) >= campaignScore(prev)) {
                    bySlug.set(slug, {
                        ...prev,
                        ...c,
                        title: c.title || prev?.title || '',
                    });
                } else if (prev && !prev.title && c.title) {
                    bySlug.set(slug, { ...prev, title: c.title });
                }
            }
            return [...bySlug.values()].sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
        }

        function onCampaignSavedSearch(value) {
            campaignSavedSearch = String(value || '');
            campaignSavedPage = 0;
            renderSavedCampaignsList();
        }

        function setCampaignSavedPage(page) {
            campaignSavedPage = Math.max(0, Number(page) || 0);
            renderSavedCampaignsList();
        }

        function renderSavedCampaignsList() {
            const box = document.getElementById('campaigns-saved-list');
            const pager = document.getElementById('campaigns-saved-pagination');
            if (!box) return;
            const list = dedupeCampaignsBySlug(
                campaignSavedList.length ? campaignSavedList : readSavedCampaigns()
            );
            const q = String(campaignSavedSearch || '').trim().toLowerCase();
            const filtered = q
                ? list.filter((c) => {
                    const slug = String(c.campaign || '').toLowerCase();
                    const title = String(c.title || '').toLowerCase();
                    return slug.includes(q) || title.includes(q);
                })
                : list;

            if (!list.length) {
                box.innerHTML = `<p style="padding:24px;text-align:center;font-size:12px;color:#94a3b8;margin:0">Nenhuma campanha ainda.</p>`;
                if (pager) pager.innerHTML = '';
                return;
            }

            if (!filtered.length) {
                box.innerHTML = `<p style="padding:24px;text-align:center;font-size:12px;color:#94a3b8;margin:0">Nenhuma campanha corresponde à busca.</p>`;
                if (pager) pager.innerHTML = '';
                return;
            }

            const pages = Math.ceil(filtered.length / CAMP_SAVED_PAGE_SIZE);
            if (campaignSavedPage >= pages) campaignSavedPage = Math.max(0, pages - 1);
            const slice = filtered.slice(
                campaignSavedPage * CAMP_SAVED_PAGE_SIZE,
                (campaignSavedPage + 1) * CAMP_SAVED_PAGE_SIZE
            );

            const rows = slice.map((c) => {
                const slug = c.campaign || '';
                const name = String(c.title || '').trim();
                const showTitle = name && sanitizeSubId(name, '') !== sanitizeSubId(slug, '');
                const n = (c.products || []).length;
                const thumb = c.products?.[0]?.image || c.links?.[0]?.image || '';
                const created = c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString('pt-BR')
                    : '—';
                const prodLabel = `${n} ${n === 1 ? 'produto' : 'produtos'}`;
                return `
                <tr>
                    <td style="padding:9px 20px">
                        <div class="camp-perf-table-prod">
                            ${thumb
                                ? `<img src="${escapeAttr(thumbUrl(thumb) || thumb)}" alt="" onerror="this.style.display='none'">`
                                : `<div style="width:32px;height:32px;border-radius:6px;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 4px,#e9eef4 4px,#e9eef4 8px);border:1px solid #e2e8f0;flex-shrink:0"></div>`}
                            <div style="min-width:0">
                                <div class="camp-perf-table-name" style="font-weight:600">${escapeHtml(showTitle ? name : slug || 'Campanha')}</div>
                                <div class="camp-perf-table-id">utm_campaign=${escapeHtml(slug)}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding:9px 12px;color:#475569;white-space:nowrap">${prodLabel}</td>
                    <td style="padding:9px 12px;color:#64748b;white-space:nowrap">${escapeHtml(created)}</td>
                    <td style="padding:9px 20px">
                        <div class="camp-saved-actions">
                            <button type="button" class="camp-saved-btn camp-saved-btn--dark" onclick="copySavedCampaignLinks('${escapeAttr(String(c.id))}')">Copiar link</button>
                            <button type="button" class="camp-saved-btn camp-saved-btn--ghost" onclick="loadSavedCampaignIntoEditor('${escapeAttr(String(c.id))}')">Editar</button>
                            <button type="button" class="camp-saved-btn camp-saved-btn--ghost" onclick="renameSavedCampaign('${escapeAttr(String(c.id))}')">Renomear</button>
                            <button type="button" class="camp-saved-btn camp-saved-btn--danger" onclick="deleteSavedCampaign('${escapeAttr(String(c.id))}')">Apagar</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            box.innerHTML = `
                <table class="camp-perf-table">
                    <thead>
                        <tr>
                            <th style="padding-left:20px">Campanha</th>
                            <th>Produtos</th>
                            <th>Criada em</th>
                            <th class="num" style="padding-right:20px;text-align:right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            if (pager) {
                if (filtered.length <= CAMP_SAVED_PAGE_SIZE) {
                    pager.innerHTML = '';
                } else {
                    const start = campaignSavedPage * CAMP_SAVED_PAGE_SIZE + 1;
                    const end = Math.min(filtered.length, (campaignSavedPage + 1) * CAMP_SAVED_PAGE_SIZE);
                    pager.innerHTML = `
                        <button type="button" class="camp-perf-pager-btn" ${campaignSavedPage <= 0 ? 'disabled' : ''}
                            onclick="setCampaignSavedPage(${campaignSavedPage - 1})">Anterior</button>
                        <span class="camp-perf-mono" style="font-size:11px;color:#94a3b8">${start}–${end} de ${filtered.length} campanhas</span>
                        <button type="button" class="camp-perf-pager-btn" ${(campaignSavedPage + 1) * CAMP_SAVED_PAGE_SIZE >= filtered.length ? 'disabled' : ''}
                            onclick="setCampaignSavedPage(${campaignSavedPage + 1})">Próxima</button>`;
                }
            }
        }

        function summarizeRegenResponse(data) {
            const camps = Array.isArray(data?.campaigns) ? data.campaigns : [];
            const total = Number(data?.regenerated) || 0;
            const failed = Number(data?.failed) || 0;
            const rateLimited = !!data?.rateLimited;
            const parts = [`${total} link(s) regerados`];
            if (failed) parts.push(`${failed} falharam`);
            if (rateLimited) parts.push('rate-limit atingido — rode de novo em ~1min');
            if (camps.length) {
                const camp = camps.map(c => `${c.campaign} → ${(c.links || []).filter(l => l.shopeeUrl).length}/${c.products || 0}`).join(', ');
                parts.push(camp);
            }
            return parts.join(' · ');
        }

        async function regenerateCampaignShortlinks(id) {
            const entry = campaignSavedList.find(c => String(c.id) === String(id))
                || readSavedCampaigns().find(c => String(c.id) === String(id));
            if (!entry) return showToast('Campanha não encontrada', 'error');
            const slug = entry.campaign || entry.id;
            if (!confirm(`Regerar shortlinks Shopee de "${entry.title || slug}" no formato standalone?\n\nO Sub_id vai virar "${slug}" (1 slot só), igual ao filtro do painel Shopee.`)) return;
            showToast('Regerando shortlinks…', 'success');
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/regenerar-standalone`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign: slug }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                // Atualiza local com os novos shopeeUrl (se veio)
                const camp = (data.campaigns || [])[0];
                if (camp && Array.isArray(camp.links)) {
                    const byId = new Map(camp.links.map(l => [String(l.productId), l]));
                    const updated = readSavedCampaigns().map(c => {
                        if (String(c.id) !== String(id)) return c;
                        const newLinks = (c.links || []).map(l => {
                            const fresh = byId.get(String(l.productId));
                            return fresh?.shopeeUrl ? { ...l, shopeeUrl: fresh.shopeeUrl, subIds: fresh.subIds || l.subIds } : l;
                        });
                        return { ...c, links: newLinks };
                    });
                    writeSavedCampaigns(updated);
                    campaignSavedList = updated;
                    renderSavedCampaignsList();
                }
                showToast(summarizeRegenResponse(data), 'success');
            } catch (err) {
                showToast(`Falha: ${err.message}`, 'error');
            }
        }

        async function regenerateAllCampaignShortlinks() {
            const list = campaignSavedList.length ? campaignSavedList : readSavedCampaigns();
            if (!list.length) return showToast('Nenhuma campanha salva', 'error');
            if (!confirm(`Regerar shortlinks Shopee de TODAS as ${list.length} campanha(s) no formato standalone?\n\nCada uma vai virar Sub_id = <nome>, 1 slot só. Pode consumir várias chamadas da API da Shopee.`)) return;
            const btn = document.getElementById('regen-all-campaigns-btn');
            if (btn) { btn.disabled = true; btn.textContent = 'Regerando…'; }
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/regenerar-standalone`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                // Atualiza local com todos os novos shopeeUrl que voltaram
                const byCampId = new Map((data.campaigns || []).map(c => [String(c.id), c]));
                const updated = readSavedCampaigns().map(c => {
                    const fresh = byCampId.get(String(c.id));
                    if (!fresh || !Array.isArray(fresh.links)) return c;
                    const byPid = new Map(fresh.links.map(l => [String(l.productId), l]));
                    const newLinks = (c.links || []).map(l => {
                        const f = byPid.get(String(l.productId));
                        return f?.shopeeUrl ? { ...l, shopeeUrl: f.shopeeUrl, subIds: f.subIds || l.subIds } : l;
                    });
                    return { ...c, links: newLinks };
                });
                writeSavedCampaigns(updated);
                campaignSavedList = updated;
                renderSavedCampaignsList();
                showToast(summarizeRegenResponse(data), 'success');
            } catch (err) {
                showToast(`Falha: ${err.message}`, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Regerar links Shopee'; }
            }
        }

        async function deleteSavedCampaign(id) {
            if (!confirm('Apagar esta campanha salva?')) return;
            const kept = readSavedCampaigns().filter(c => String(c.id) !== String(id));
            writeSavedCampaigns(kept);
            deletedCampaignIds.add(String(id));
            campaignSavedList = kept;
            renderCampaignPerformance();
            renderSavedCampaignsList();
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
            const entry = readSavedCampaigns().find(c => String(c.id) === String(id));
            if (!entry) return;
            campaignEditingId = String(entry.id);
            const titleEl = document.getElementById('campaign-link-title');
            if (titleEl) titleEl.value = entry.title || entry.campaign || '';
            lockCampaignSlug(entry.campaign || '', { freeze: true });
            campaignSelectedProducts = Array.isArray(entry.products) ? [...entry.products] : [];
            switchAdminView('campanhas');
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
            document.getElementById('campaign-link-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('Campanha carregada — o Sub ID permanece o mesmo', 'success');
            repairMissingCampaignAffiliates({ silent: false });
        }

        function copySavedCampaignLinks(id, kind = 'site') {
            const entry = campaignSavedList.find(c => String(c.id) === String(id))
                || readSavedCampaigns().find(c => String(c.id) === String(id));
            if (!entry?.links?.length) return;
            const urls = entry.links.map(l => l.url).filter(Boolean);
            if (!urls.length) {
                showToast('Campanha sem links', 'error');
                return;
            }
            navigator.clipboard?.writeText(urls.join('\n')).then(() => {
                showToast(urls.length > 1 ? `${urls.length} links copiados!` : 'Link copiado!', 'success');
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
                if (!c?.id || deletedCampaignIds.has(String(c.id))) continue;
                const prev = byId.get(String(c.id));
                byId.set(String(c.id), {
                    ...prev,
                    ...c,
                    title: c.title || prev?.title || '',
                    createdAt: c.createdAt || prev?.createdAt,
                });
            }
            const merged = dedupeCampaignsBySlug([...byId.values()]);
            writeSavedCampaigns(merged);
            campaignSavedList = merged;
            renderSavedCampaignsList();
            return merged;
        }

        async function resetVitrineAndRefill() {
            const typed = window.prompt("Isso apaga todos os produtos da vitrine. Digite RESET para confirmar.");
            if (typed !== "RESET") return;
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
            const key = String(status || "").toUpperCase();
            return CONVERSION_STATUS_META[key]?.label || status || "—";
        }

        function conversionStatusMeta(status) {
            const key = String(status || "").toUpperCase();
            return CONVERSION_STATUS_META[key] || {
                label: conversionStatusLabel(status) || "Outro",
                icon: "fa-circle",
                chip: "bg-slate-100 text-slate-600 border-slate-200",
                tab: "border-slate-300 bg-slate-50 text-slate-700",
                bar: "bg-slate-300",
            };
        }

        function conversionOrderStatus(row) {
            return String(row?.order?.orderStatus || "").toUpperCase() || "UNKNOWN";
        }

        function listConversionOrders(rows = conversionRows) {
            return (rows || []).flatMap((c) =>
                (Array.isArray(c.orders) ? c.orders : []).map((order) => ({ conversion: c, order }))
            );
        }

        function filteredConversionOrders() {
            const status = String(conversionStatusFilter || "").toUpperCase();
            const term = String(conversionSearchTerm || "").trim().toLowerCase();
            let orders = listConversionOrders();
            if (status) {
                orders = orders.filter((row) => conversionOrderStatus(row) === status);
            }
            if (term) {
                orders = orders.filter(({ conversion, order }) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const hay = [
                        order.orderId,
                        conversion.utmContent,
                        conversion.conversionId,
                        ...items.map((i) => i.itemName),
                        ...items.map((i) => i.itemId),
                        ...items.map((i) => i.shopName),
                    ].map((v) => String(v || "").toLowerCase()).join(" ");
                    return hay.includes(term);
                });
            }
            if (!status) {
                const rank = (st) => {
                    const i = CONVERSION_STATUS_ORDER.indexOf(st);
                    return i >= 0 ? i : CONVERSION_STATUS_ORDER.length;
                };
                orders.sort((a, b) => {
                    const d = rank(conversionOrderStatus(a)) - rank(conversionOrderStatus(b));
                    if (d) return d;
                    return (Number(b.conversion.purchaseTime) || 0) - (Number(a.conversion.purchaseTime) || 0);
                });
            }
            return orders;
        }

        function setConversionStatusFilter(status) {
            conversionStatusFilter = String(status || "").toUpperCase();
            conversionPage = 1;
            const hidden = document.getElementById("conversion-status");
            if (hidden) hidden.value = conversionStatusFilter;
            renderConversions();
        }

        function onConversionSearch() {
            clearTimeout(conversionSearchTimer);
            conversionSearchTimer = setTimeout(() => {
                conversionSearchTerm = document.getElementById("conversion-search")?.value || "";
                conversionPage = 1;
                renderConversions();
            }, 180);
        }

        function onConversionPageSizeChange() {
            const n = Number(document.getElementById("conversion-page-size")?.value) || 20;
            CONVERSION_PAGE_SIZE = Math.min(Math.max(n, 5), 100);
            conversionPage = 1;
            renderConversions();
        }

        function goToConversionPage(page) {
            conversionPage = Math.max(1, Number(page) || 1);
            renderConversions();
            document.getElementById("conversion-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        function conversionMoneyKind(status) {
            const st = String(status || "").toUpperCase();
            if (st === "COMPLETED") {
                return { key: "confirmed", label: "confirmado", className: "text-emerald-600" };
            }
            if (st === "CANCELLED") {
                return { key: "zero", label: "sem comissão", className: "text-slate-400" };
            }
            if (st === "PENDING" || st === "UNPAID") {
                return { key: "estimated", label: "estimativa", className: "text-amber-600" };
            }
            return { key: "other", label: "—", className: "text-slate-400" };
        }

        function renderStatusFunnel(elId, counts) {
            const el = document.getElementById(elId);
            if (!el) return;
            const items = [
                { key: "UNPAID", label: "Não pago", count: counts.UNPAID || 0 },
                { key: "PENDING", label: "Pendente", count: counts.PENDING || 0 },
                { key: "COMPLETED", label: "Concluído", count: counts.COMPLETED || 0 },
                { key: "CANCELLED", label: "Cancelado", count: counts.CANCELLED || 0 },
            ];
            el.innerHTML = items.map((item, idx) => {
                const meta = CONVERSION_STATUS_META[item.key];
                const arrow = idx < items.length - 1
                    ? `<span class="text-slate-300 text-[10px] px-0.5 self-center">→</span>`
                    : "";
                return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold ${meta.chip}">
                    <i class="fas ${meta.icon}"></i>${escapeHtml(item.label)}
                    <span class="opacity-80">${item.count}</span>
                </span>${arrow}`;
            }).join("");
        }

        function renderConversionFilterHint() {
            const hint = document.getElementById("conversion-filter-hint");
            if (!hint) return;
            const st = String(conversionStatusFilter || "").toUpperCase();
            if (!st) {
                hint.classList.add("hidden");
                hint.textContent = "";
                return;
            }
            const money = conversionMoneyKind(st);
            const label = conversionStatusLabel(st);
            let msg = `Lista filtrada: ${label}`;
            if (money.key === "estimated") msg += " — valores abaixo são estimativa";
            else if (money.key === "confirmed") msg += " — valores abaixo são confirmados";
            else if (money.key === "zero") msg += " — sem comissão";
            hint.textContent = msg;
            hint.classList.remove("hidden");
        }

        function renderConversionStatusTabs(allOrders, filteredCount) {
            const tabs = document.getElementById("conversion-status-tabs");
            if (!tabs) return;
            const counts = { ALL: allOrders.length };
            for (const key of CONVERSION_STATUS_ORDER) counts[key] = 0;
            for (const row of allOrders) {
                const st = conversionOrderStatus(row);
                counts[st] = (counts[st] || 0) + 1;
            }
            const items = [
                { key: "", label: "Todos", count: counts.ALL, icon: "fa-layer-group" },
                ...CONVERSION_STATUS_ORDER.map((key) => ({
                    key,
                    label: CONVERSION_STATUS_META[key].label,
                    count: counts[key] || 0,
                    icon: CONVERSION_STATUS_META[key].icon,
                })),
            ];
            tabs.innerHTML = items.map((item) => {
                const active = String(conversionStatusFilter || "") === item.key;
                const meta = item.key ? CONVERSION_STATUS_META[item.key] : null;
                const cls = active
                    ? (meta ? meta.tab : "border-slate-800 bg-slate-800 text-white")
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
                return `<button type="button" onclick="setConversionStatusFilter('${item.key}')"
                    class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold ${cls}">
                    <i class="fas ${item.icon} mr-1"></i>${escapeHtml(item.label)}
                    <span class="ml-1 opacity-80">${item.count}</span>
                </button>`;
            }).join("");
            renderStatusFunnel("conversion-funnel", counts);
            renderConversionFilterHint();
        }

        function renderConversionPageButtons(totalPages) {
            const box = document.getElementById("conversion-page-buttons");
            if (!box) return;
            if (totalPages <= 1) {
                box.innerHTML = "";
                return;
            }
            const pages = [];
            const cur = conversionPage;
            const add = (n) => { if (!pages.includes(n) && n >= 1 && n <= totalPages) pages.push(n); };
            add(1);
            add(totalPages);
            for (let i = cur - 2; i <= cur + 2; i++) add(i);
            pages.sort((a, b) => a - b);
            let html = "";
            let prev = 0;
            for (const n of pages) {
                if (prev && n - prev > 1) html += `<span class="px-1 text-slate-400 text-[10px]">…</span>`;
                const active = n === cur;
                html += `<button type="button" onclick="goToConversionPage(${n})"
                    class="min-w-[2rem] px-2 py-1 rounded-md text-[10px] font-bold ${active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}">${n}</button>`;
                prev = n;
            }
            box.innerHTML = html;
        }

        function renderConversions() {
            const list = document.getElementById("conversion-list");
            if (!list) return;

            const allOrders = listConversionOrders();
            const orders = filteredConversionOrders();
            const pageSize = CONVERSION_PAGE_SIZE;
            const totalLoadedPages = Math.max(1, Math.ceil(orders.length / pageSize) || 1);
            conversionPage = Math.min(Math.max(conversionPage, 1), totalLoadedPages);
            const pageStart = (conversionPage - 1) * pageSize;
            const visibleOrders = orders.slice(pageStart, pageStart + pageSize);
            const subIds = new Set(
                conversionRows.map((c) => String(c.utmContent || "").trim()).filter(Boolean)
            );
            let confirmed = 0;
            let estimated = 0;
            let cancelledCount = 0;
            for (const row of allOrders) {
                const st = conversionOrderStatus(row);
                const money = commissionNumber(row.conversion.totalCommission);
                if (st === "COMPLETED") confirmed += money;
                else if (st === "PENDING" || st === "UNPAID") estimated += money;
                else if (st === "CANCELLED") cancelledCount += 1;
            }
            const confirmedText = confirmed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const estimatedText = estimated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setTxt("conversion-total", String(conversionRows.length));
            setTxt("conversion-orders", String(allOrders.length));
            setTxt("conversion-confirmed", confirmedText);
            setTxt("conversion-estimated", estimatedText);
            setTxt("conversion-cancelled", String(cancelledCount));
            setTxt("conversion-subids", String(subIds.size));

            renderConversionStatusTabs(allOrders, orders.length);

            if (!allOrders.length) {
                document.getElementById("conversion-pagination")?.classList.add("hidden");
                list.innerHTML = `
                    <div class="py-8 text-center text-slate-400 text-xs space-y-2">
                        <i class="fas fa-chart-line text-2xl mb-2 block"></i>
                        <p class="font-bold text-slate-600">Nenhuma venda deste site ainda</p>
                        <p>O painel só mostra pedidos com Sub ID <strong>afiliadamestre</strong> (slot 1).</p>
                        <p class="text-slate-500">Clique em Atualizar Shopee para puxar e gravar no banco; o cron também sincroniza sozinho.</p>
                    </div>`;
                return;
            }

            if (!orders.length) {
                document.getElementById("conversion-pagination")?.classList.add("hidden");
                list.innerHTML = `
                    <div class="py-8 text-center text-slate-400 text-xs space-y-2">
                        <i class="fas fa-filter text-2xl mb-2 block"></i>
                        <p class="font-bold text-slate-600">Nenhum pedido neste filtro</p>
                        <p>Troque o status ou limpe a busca.</p>
                    </div>`;
                return;
            }

            const parts = [];
            let lastStatus = null;
            parts.push(`
                <div class="conv-head">
                    <span>Foto</span>
                    <span>Pedido / produto</span>
                    <span>Campanha</span>
                    <span>Status</span>
                    <span class="conv-money">Comissão</span>
                </div>`);
            for (const { conversion, order } of visibleOrders) {
                const st = conversionOrderStatus({ conversion, order });
                if (!conversionStatusFilter && st !== lastStatus) {
                    const meta = conversionStatusMeta(st);
                    const count = orders.filter((row) => conversionOrderStatus(row) === st).length;
                    parts.push(`
                        <div class="conv-group">
                            <span class="w-1.5 h-3 rounded-full ${meta.bar}"></span>
                            <i class="fas ${meta.icon}"></i>
                            <span>${escapeHtml(meta.label)}</span>
                            <span class="text-slate-400 font-bold">${count}</span>
                        </div>`);
                    lastStatus = st;
                }
                const items = Array.isArray(order.items) ? order.items : [];
                const item = items[0] || {};
                const meta = conversionStatusMeta(st);
                const moneyKind = conversionMoneyKind(st);
                const parsed = parseUtmContent(conversion.utmContent);
                const attr = resolveCampaignAttribution(conversion.utmContent);
                const image = item.imageUrl
                    ? escapeAttr(item.imageUrl)
                    : "https://placehold.co/96x96/ffebd7/ee4d2d?text=Shopee";
                const moneyClass = moneyKind.key === "zero"
                    ? "text-slate-400"
                    : moneyKind.key === "estimated"
                        ? "text-amber-600"
                        : "text-emerald-600";
                const moneyVal = commissionNumber(item.itemTotalCommission || conversion.totalCommission)
                    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                parts.push(`
                    <article class="conv-row">
                        <img src="${image}" alt="" class="conv-thumb"
                            onerror="this.onerror=null;this.src='https://placehold.co/96x96/ffebd7/ee4d2d?text=Shopee'">
                        <div class="conv-main min-w-0">
                            <p class="conv-title font-semibold text-slate-800 truncate" title="${escapeAttr(String(item.itemName || `Item ${item.itemId || ""}`))}">${escapeHtml(String(item.itemName || `Item ${item.itemId || ""}`))}</p>
                            <p class="conv-meta-line text-[10px] text-slate-500 truncate" title="${escapeAttr(`${order.orderId || ""} · ${conversionDate(conversion.purchaseTime)} · ${item.shopName || ""}`)}">
                                <span class="conv-order-wrap"><span class="conv-order-prefix">Pedido </span><span class="conv-order-id">${escapeHtml(String(order.orderId || "—"))}</span></span>
                                <span class="conv-meta-sep"> · </span>
                                <span class="conv-date">${escapeHtml(conversionDate(conversion.purchaseTime))}</span>
                                <span class="conv-meta-sep"> · </span>
                                <span class="conv-shop">${escapeHtml(String(item.shopName || "Loja"))}</span>
                            </p>
                        </div>
                        <div class="min-w-0 text-[10px] text-slate-600 conv-campaign">
                            <p class="font-bold text-slate-800 truncate">${escapeHtml(attr.campaignLabel || "—")}</p>
                            <p class="text-slate-400 truncate">${escapeHtml(attr.channel || "—")}</p>
                        </div>
                        <div class="conv-status">
                            <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${meta.chip}">${escapeHtml(meta.label)}</span>
                            <p class="conv-money-kind text-[9px] font-bold mt-0.5 ${moneyKind.className}">${escapeHtml(moneyKind.label)}</p>
                        </div>
                        <div class="conv-money ${moneyClass}">${moneyVal}</div>
                    </article>`);
            }

            list.innerHTML = parts.join("");

            const pagination = document.getElementById("conversion-pagination");
            const prev = document.getElementById("conversion-prev");
            const next = document.getElementById("conversion-next");
            pagination?.classList.toggle("hidden", orders.length <= pageSize);
            if (prev) prev.disabled = conversionPage <= 1;
            if (next) next.disabled = conversionPage >= totalLoadedPages;
            renderConversionPageButtons(totalLoadedPages);
            const pageInfo = document.getElementById("conversion-page-info");
            if (pageInfo) {
                const from = pageStart + 1;
                const to = Math.min(pageStart + pageSize, orders.length);
                pageInfo.textContent = `${from}–${to} de ${orders.length} · pág. ${conversionPage}/${totalLoadedPages}`;
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

        /**
         * Campanhas standalone gravam o nome em sub_id1 (utm "afiliadavenda----").
         * Formato antigo: sub_id1=afiliadamestre, sub_id3=nome-da-campanha.
         */
        function resolveCampaignAttribution(utmContent, savedList = campaignSavedList) {
            const parsed = parseUtmContent(utmContent);
            const slot1 = sanitizeSubId(parsed.site, "");
            const slot2 = sanitizeSubId(parsed.channel, "");
            const slot3 = sanitizeSubId(parsed.campaign, "");
            const known = new Set(
                (savedList || [])
                    .map((c) => normalizeCampaignKey(c.campaign))
                    .filter((k) => k && k !== "sem_campanha")
            );
            const filled = (Array.isArray(parsed.raw) ? parsed.raw : [])
                .map((p) => String(p || "").trim())
                .filter(Boolean);
            const standalone =
                !!slot1 &&
                slot1 !== SITE_SUBID &&
                (known.has(normalizeCampaignKey(slot1)) || filled.length === 1);

            const campaignKey = standalone
                ? normalizeCampaignKey(slot1)
                : (normalizeCampaignKey(slot3) || "sem_campanha");

            let channel = slot2;
            if (!channel && standalone) {
                const saved = (savedList || []).find(
                    (c) => normalizeCampaignKey(c.campaign) === campaignKey
                );
                channel = sanitizeSubId(saved?.channel, "campanha");
            }
            if (!channel) channel = standalone ? "campanha" : "desconhecido";

            return {
                parsed,
                campaignKey,
                campaignLabel: standalone ? slot1 : (slot3 || "—"),
                channel,
                standalone: !!standalone,
            };
        }

        function campaignDisplayName(key) {
            if (!key || key === 'sem_campanha') return 'Sem campanha / orgânico';
            const saved = (campaignSavedList.length ? campaignSavedList : readSavedCampaigns())
                .find(c => normalizeCampaignKey(c.campaign) === normalizeCampaignKey(key));
            return saved?.title || key;
        }

        function emptyCampaignBucket(key) {
            return {
                key,
                name: campaignDisplayName(key),
                conversions: 0,
                orders: 0,
                itemsQty: 0,
                commission: 0,
                commissionCompleted: 0,
                ordersCompleted: 0,
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
                const attr = resolveCampaignAttribution(conversion.utmContent, savedList);
                const key = attr.campaignKey;
                if (!map.has(key)) map.set(key, emptyCampaignBucket(key));
                const bucket = map.get(key);
                bucket.conversions += 1;
                bucket.commission += commissionNumber(conversion.totalCommission);
                bucket.sellerCommission += commissionNumber(conversion.sellerCommission);
                bucket.shopeeCommission += commissionNumber(conversion.shopeeCommissionCapped);
                bucket.conversionsList.push(conversion);
                const purchase = Number(conversion.purchaseTime) || 0;
                if (purchase > bucket.lastPurchase) bucket.lastPurchase = purchase;

                const channel = attr.channel;
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
                    const st = String(order.orderStatus || 'UNKNOWN').toUpperCase();
                    bucket.statuses[st] = (bucket.statuses[st] || 0) + 1;
                    const items = order.items || [];
                    let orderCommission = items.reduce(
                        (sum, item) => sum + commissionNumber(item.itemTotalCommission),
                        0
                    );
                    if (!orderCommission) {
                        const nOrders = (conversion.orders || []).length || 1;
                        orderCommission = commissionNumber(conversion.totalCommission) / nOrders;
                    }
                    if (st === 'COMPLETED') {
                        bucket.ordersCompleted += 1;
                        bucket.commissionCompleted += orderCommission;
                    }
                    for (const item of items) {
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
                const bucket = map.get(key);
                bucket.saved = saved;
                if (saved.title) bucket.name = saved.title;
            }

            return [...map.values()].sort((a, b) =>
                b.commissionCompleted - a.commissionCompleted
                || b.commission - a.commission
                || b.orders - a.orders
                || new Date(b.saved?.createdAt || 0) - new Date(a.saved?.createdAt || 0)
                || a.name.localeCompare(b.name)
            );
        }

        /**
         * Puxa conversionReport da Shopee → Supabase.
         * Throttle de 5 min (sessionStorage) pra não estourar quota ao trocar de aba.
         */
        async function ensureConversionsFresh({ force = false } = {}) {
            if (!isAdminMode()) return { skipped: true };
            const last = Number(sessionStorage.getItem(CONVERSIONS_PULL_KEY) || 0);
            if (!force && Date.now() - last < CONVERSIONS_PULL_THROTTLE_MS) {
                return { skipped: true, ageMs: Date.now() - last };
            }
            if (conversionPullBusy) return { skipped: true, busy: true };
            conversionPullBusy = true;
            try {
                const days = Number(document.getElementById("conversion-days")?.value
                    || document.getElementById("ms-days")?.value
                    || document.getElementById("camp-perf-days")?.value
                    || 30);
                const sinceMin = Math.min(Math.max(days * 24 * 60, 60 * 48), 60 * 24 * 90);
                const res = await adminFetch(`${API_BASE}/api/cron/conversions?sinceMin=${sinceMin}`);
                const data = await res.json();
                if (!res.ok || !data?.ok) {
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                sessionStorage.setItem(CONVERSIONS_PULL_KEY, String(Date.now()));
                return data;
            } catch (err) {
                return { ok: false, error: err.message || String(err) };
            } finally {
                conversionPullBusy = false;
            }
        }

        async function loadCampaignPerformance({ reset = false, pull = false } = {}) {
            const list = document.getElementById('camp-perf-list');
            if (!list || !isAdminMode() || campaignPerfLoading) return;
            campaignPerfLoading = true;
            if (reset) {
                campaignPerfRows = [];
                campaignPerfSelected = '';
                campaignPerfDetailTab = 'resumo';
                closeCampaignPerfDetail();
            }
            list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando vendas do banco…</div>';
            try {
                if (pull) {
                    list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Atualizando conversões da Shopee…</div>';
                    const pulled = await ensureConversionsFresh({ force: false });
                    if (pulled?.ok && pulled.result) {
                        const r = pulled.result;
                        if (Number(r.saved) > 0) {
                            showToast(`Shopee: ${r.saved} conversão(ões) salvas`, 'success');
                        }
                    }
                }
                await syncSavedCampaigns();
                const days = document.getElementById('camp-perf-days')?.value || '30';
                const status = document.getElementById('camp-perf-status')?.value || '';
                // Mesma fonte do "Meu Site": conversions no Supabase
                // (campanha standalone em sub_id1; formato antigo em sub_id3).
                // não o scroll ao vivo da Shopee — aquele mistura tudo e perde vendas.
                const params = new URLSearchParams({ days: String(days) });
                if (status) params.set('status', status);
                list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando vendas do banco…</div>';
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/performance?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                campaignPerfRows = Array.isArray(data.conversions) ? data.conversions : [];
                renderCampaignPerformance();
                if (!campaignPerfRows.length && !campaignSavedList.length) {
                    showToast('Nenhuma venda deste site no período', 'success');
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

        function campPerfPct(part, total) {
            const t = Number(total) || 0;
            if (!t) return "0%";
            return `${Math.round((Number(part) / t) * 1000) / 10}%`.replace(".", ",");
        }

        function campPerfBadgeMeta(c) {
            if (!c.saved) {
                return { label: "Fora do painel", cls: "camp-perf-badge--orphan" };
            }
            if (c.orders > 0) {
                return { label: "Ativa", cls: "camp-perf-badge--active" };
            }
            return { label: "Sem vendas ainda", cls: "camp-perf-badge--pending" };
        }

        function filterCampaignPerfList(campaigns) {
            const q = String(campaignPerfSearch || "").trim().toLowerCase();
            if (!q) return campaigns;
            return campaigns.filter((c) => {
                const utm = String(c.key || "").toLowerCase();
                const name = String(c.name || "").toLowerCase();
                return name.includes(q) || utm.includes(q);
            });
        }

        function onCampPerfSearch(value) {
            campaignPerfSearch = String(value || "");
            campaignPerfListPage = 0;
            renderCampaignPerformance();
        }

        function setCampPerfListPage(page) {
            campaignPerfListPage = Math.max(0, Number(page) || 0);
            renderCampaignPerformance();
        }

        function switchCampPerfTab(tab) {
            campaignPerfDetailTab = tab || "resumo";
            document.querySelectorAll("[data-camp-perf-tab]").forEach((btn) => {
                const on = btn.getAttribute("data-camp-perf-tab") === campaignPerfDetailTab;
                btn.classList.toggle("is-active", on);
                btn.setAttribute("aria-selected", on ? "true" : "false");
            });
            document.querySelectorAll("[data-camp-perf-panel]").forEach((panel) => {
                panel.classList.toggle("is-active", panel.getAttribute("data-camp-perf-panel") === campaignPerfDetailTab);
            });
        }

        function setCampPerfSalesFilter(status) {
            campaignPerfSalesFilter = String(status || "");
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const c = campaigns.find((x) => x.key === campaignPerfSelected);
            if (c) renderCampPerfSalesTable(c);
        }

        function setCampPerfProdSearch(value) {
            campaignPerfProdQ = String(value || "");
            campaignPerfProdPage = 0;
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const c = campaigns.find((x) => x.key === campaignPerfSelected);
            if (c) renderCampPerfProductsTable(c, campaignPerfFunnelCache);
        }

        function setCampPerfProdPage(page) {
            campaignPerfProdPage = Math.max(0, Number(page) || 0);
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const c = campaigns.find((x) => x.key === campaignPerfSelected);
            if (c) renderCampPerfProductsTable(c, campaignPerfFunnelCache);
        }

        function renderCampPerfPagination(total, page, pageSize, onPageFn) {
            const box = document.getElementById("camp-perf-pagination");
            if (!box) return;
            const pages = Math.max(1, Math.ceil(total / pageSize));
            if (total <= pageSize) {
                box.innerHTML = "";
                return;
            }
            const start = page * pageSize + 1;
            const end = Math.min(total, (page + 1) * pageSize);
            box.innerHTML = `
                <button type="button" class="camp-perf-pager-btn" ${page <= 0 ? "disabled" : ""}
                    onclick="${onPageFn}(${page - 1})">Anterior</button>
                <span class="camp-perf-mono" style="font-size:11px;color:#94a3b8">${start}–${end} de ${total}</span>
                <button type="button" class="camp-perf-pager-btn" ${page >= pages - 1 ? "disabled" : ""}
                    onclick="${onPageFn}(${page + 1})">Próxima</button>`;
        }

        function buildCampPerfProductRows(c, funnelData) {
            const funnelMap = new Map(
                (funnelData?.products || []).map((p) => [String(p.product_id), p])
            );
            const soldMap = c.products || {};
            const saved = c.saved?.products || [];
            const orderCountByProduct = new Map();
            for (const conv of c.conversionsList || []) {
                for (const order of conv.orders || []) {
                    const seenInOrder = new Set();
                    for (const item of order.items || []) {
                        const pid = String(item.itemId || "");
                        if (!pid || seenInOrder.has(pid)) continue;
                        seenInOrder.add(pid);
                        orderCountByProduct.set(pid, (orderCountByProduct.get(pid) || 0) + 1);
                    }
                }
            }
            const ids = new Set();
            saved.forEach((p) => ids.add(String(p.id)));
            Object.keys(soldMap).forEach((id) => ids.add(String(id)));
            (funnelData?.products || []).forEach((p) => ids.add(String(p.product_id)));

            return [...ids].map((id) => {
                const savedP = saved.find((p) => String(p.id) === id);
                const sold = Object.values(soldMap).find((p) => String(p.id) === id);
                const funnel = funnelMap.get(id);
                return {
                    id,
                    name: savedP?.title || sold?.name || funnel?.product_name || `Produto ${id}`,
                    image: savedP?.image || sold?.image || "",
                    opens: Number(funnel?.opens) || 0,
                    checkout: Number(funnel?.checkout) || 0,
                    close: Number(funnel?.close) || 0,
                    orders: orderCountByProduct.get(id) || 0,
                    qty: sold?.qty || 0,
                    commission: sold?.commission || 0,
                };
            }).sort((a, b) => b.commission - a.commission || b.qty - a.qty || b.opens - a.opens);
        }

        function renderCampPerfResumo(c, funnelData) {
            const el = document.getElementById("camp-perf-panel-resumo");
            if (!el) return;
            const totals = funnelData?.totals || { opens: 0, checkout: 0, close: 0 };
            const channelEntries = Object.entries(c.channels).sort((a, b) => b[1] - a[1]);
            const channelsText = channelEntries.length
                ? channelEntries.map(([ch, n]) => `${ch} (${n})`).join(" · ")
                : (c.saved?.channel || "—");
            const lastSale = c.lastPurchase
                ? `Última venda: ${conversionDate(c.lastPurchase)}`
                : "Sem vendas no período";
            const statusEntries = Object.entries(c.statuses).sort((a, b) => b[1] - a[1]);
            const statusTotal = statusEntries.reduce((s, [, n]) => s + n, 0) || c.orders;

            el.innerHTML = `
                <div class="camp-perf-channels-bar">
                    <span><span class="muted">Canais:</span> ${escapeHtml(channelsText)}</span>
                    <span class="right">${escapeHtml(lastSale)}</span>
                </div>
                <div class="camp-perf-kpi-grid">
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Líquido (Completed)</div>
                        <div class="camp-perf-kpi-value" style="color:#047857">${formatMoneyBRL(c.commissionCompleted)}</div>
                        <div class="camp-perf-kpi-hint">${c.ordersCompleted} pedido(s) concluído(s) · total ${formatMoneyBRL(c.commission)}</div>
                    </div>
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Pedidos</div>
                        <div class="camp-perf-kpi-value">${c.orders}</div>
                        <div class="camp-perf-kpi-hint">no período filtrado</div>
                    </div>
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Itens vendidos</div>
                        <div class="camp-perf-kpi-value">${c.itemsQty}</div>
                        <div class="camp-perf-kpi-hint">unidades</div>
                    </div>
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Comissão loja</div>
                        <div class="camp-perf-kpi-value">${formatMoneyBRL(c.sellerCommission)}</div>
                    </div>
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Comissão Shopee</div>
                        <div class="camp-perf-kpi-value">${formatMoneyBRL(c.shopeeCommission)}</div>
                    </div>
                    <div class="camp-perf-kpi">
                        <div class="camp-perf-kpi-label">Canais ativos</div>
                        <div class="camp-perf-kpi-value">${Object.keys(c.channels).length || (c.saved?.channel ? 1 : 0)}</div>
                    </div>
                </div>
                <div class="camp-perf-split-grid">
                    <div class="camp-perf-card">
                        <div class="camp-perf-card-title">Funil da campanha</div>
                        ${totals.opens > 0 ? `
                            <div class="camp-perf-mini-row"><span>Abriram o produto</span><strong>${formatFunnelCount(totals.opens)} <span class="pct">100%</span></strong></div>
                            <div class="camp-perf-mini-row"><span>Clicaram Ver na Shopee</span><strong>${formatFunnelCount(totals.checkout)} <span class="pct">${campPerfPct(totals.checkout, totals.opens)}</span></strong></div>
                            <div class="camp-perf-mini-row"><span>Fecharam sem ir à Shopee</span><strong>${formatFunnelCount(totals.close)} <span class="pct">${campPerfPct(totals.close, totals.opens)}</span></strong></div>
                            <button type="button" class="camp-perf-link-btn" onclick="switchCampPerfTab('funil')">Ver funil completo →</button>
                        ` : `<p style="font-size:12px;color:#94a3b8;margin:0">Ainda sem eventos neste período.</p>`}
                    </div>
                    <div class="camp-perf-card">
                        <div class="camp-perf-card-title">Status dos pedidos</div>
                        ${statusEntries.length ? statusEntries.map(([st, n]) => {
                            const meta = conversionStatusMeta(st);
                            const colors = { "bg-emerald-500": "#10b981", "bg-amber-400": "#fbbf24", "bg-red-500": "#ef4444", "bg-slate-400": "#94a3b8" };
                            const dotColor = colors[meta.bar] || "#cbd5e1";
                            return `
                            <div class="camp-perf-status-row">
                                <span class="camp-perf-status-dot" style="background:${dotColor}"></span>
                                <span style="flex:1">${escapeHtml(conversionStatusLabel(st))}</span>
                                <span class="count">${n}</span>
                                <span class="pct">${campPerfPct(n, statusTotal)}</span>
                            </div>`;
                        }).join("") : `<p style="font-size:12px;color:#94a3b8;margin:0">Sem pedidos no período.</p>`}
                    </div>
                </div>`;
        }

        function renderCampPerfProductsTable(c, funnelData) {
            const el = document.getElementById("camp-perf-detail-products");
            if (!el) return;
            const all = buildCampPerfProductRows(c, funnelData);
            const q = String(campaignPerfProdQ || "").trim().toLowerCase();
            const filtered = q
                ? all.filter((p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
                : all;
            const page = campaignPerfProdPage;
            const pageSize = CAMP_PERF_PROD_PAGE_SIZE;
            const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);

            const rows = slice.map((p) => `
                <tr>
                    <td>
                        <div class="camp-perf-table-prod">
                            <img src="${escapeAttr(thumbUrl(p.image) || p.image || "https://placehold.co/68x68/ffebd7/ee4d2d?text=S")}" alt=""
                                onerror="this.onerror=null;this.src='https://placehold.co/68x68/ffebd7/ee4d2d?text=S'">
                            <div style="min-width:0">
                                <div class="camp-perf-table-name">${escapeHtml(p.name)}</div>
                                <div class="camp-perf-table-id">${escapeHtml(String(p.id))}</div>
                            </div>
                        </div>
                    </td>
                    <td class="num">${formatFunnelCount(p.opens)}</td>
                    <td class="num">${formatFunnelCount(p.checkout)}</td>
                    <td class="num" style="font-weight:600">${p.orders}</td>
                    <td class="num" style="color:#64748b">${p.qty}</td>
                    <td class="num" style="font-weight:700;color:#047857">${formatMoneyBRL(p.commission)}</td>
                </tr>`).join("");

            el.innerHTML = `
                <div class="camp-perf-panel-toolbar">
                    <h3>Produtos da campanha <span>(${all.length})</span></h3>
                    <input type="search" class="camp-perf-filter-input" placeholder="Filtrar produto"
                        value="${escapeAttr(campaignPerfProdQ)}" oninput="setCampPerfProdSearch(this.value)">
                </div>
                <div class="camp-perf-table-wrap">
                    <table class="camp-perf-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th class="num">Abriram</th>
                                <th class="num">Shopee</th>
                                <th class="num">Pedidos</th>
                                <th class="num">Itens</th>
                                <th class="num" style="padding-right:16px">Comissão</th>
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8">Nenhum produto</td></tr>`}</tbody>
                    </table>
                    ${filtered.length > pageSize ? `
                    <div class="camp-perf-pager">
                        <span class="camp-perf-mono" style="font-size:11px;color:#94a3b8">${page * pageSize + 1}–${Math.min(filtered.length, (page + 1) * pageSize)} de ${filtered.length}</span>
                        <div style="display:flex;gap:8px">
                            <button type="button" class="camp-perf-pager-btn" ${page <= 0 ? "disabled" : ""} onclick="setCampPerfProdPage(${page - 1})">Anterior</button>
                            <button type="button" class="camp-perf-pager-btn" ${(page + 1) * pageSize >= filtered.length ? "disabled" : ""} onclick="setCampPerfProdPage(${page + 1})">Próxima</button>
                        </div>
                    </div>` : ""}
                </div>`;
        }

        function renderCampPerfSalesTable(c) {
            const el = document.getElementById("camp-perf-detail-orders");
            if (!el) return;
            const allRows = c.conversionsList.flatMap((conv) =>
                (conv.orders || []).map((order) => ({ conv, order }))
            );
            const filter = String(campaignPerfSalesFilter || "").toUpperCase();
            const filtered = filter
                ? allRows.filter(({ order }) => String(order.orderStatus || "").toUpperCase() === filter)
                : allRows;
            const pageSize = CAMP_PERF_SALES_PAGE_SIZE;
            const page = 0;
            const slice = filtered.slice(0, pageSize);

            const filterBtn = (key, label) => {
                const active = campaignPerfSalesFilter === key;
                return `<button type="button" class="camp-perf-sales-filter${active ? " is-active" : ""}"
                    onclick="setCampPerfSalesFilter('${key}')">${label}</button>`;
            };

            if (!allRows.length) {
                el.innerHTML = (c.saved?.links || []).length
                    ? `<div style="font-size:12px;color:#64748b">
                        <p>Nenhum pedido ainda. Links desta campanha:</p>
                        ${c.saved.links.map((l) => `<p class="camp-perf-mono" style="font-size:10px;word-break:break-all;background:#f8fafc;padding:8px;border-radius:8px;margin:8px 0">${escapeHtml(l.url)}</p>`).join("")}
                        <button type="button" class="camp-perf-btn camp-perf-btn--dark" onclick="copySavedCampaignLinks('${escapeAttr(String(c.saved.id))}')">Copiar links</button>
                    </div>`
                    : `<p style="font-size:12px;color:#94a3b8;text-align:center;padding:24px">Nenhuma venda no período.</p>`;
                return;
            }

            const statusPill = (status) => {
                const st = String(status || "").toUpperCase();
                const styles = {
                    COMPLETED: "background:#ecfdf5;color:#047857",
                    CANCELLED: "background:#fef2f2;color:#b91c1c",
                    PENDING: "background:#fffbeb;color:#b45309",
                    UNPAID: "background:#f1f5f9;color:#64748b",
                };
                const style = styles[st] || "background:#f1f5f9;color:#64748b";
                return `<span class="camp-perf-status-pill" style="${style}">${escapeHtml(conversionStatusLabel(status))}</span>`;
            };

            el.innerHTML = `
                <div class="camp-perf-panel-toolbar">
                    <h3>Vendas <span>(${allRows.length})</span></h3>
                    <div class="camp-perf-sales-filters">
                        ${filterBtn("", "Todos")}
                        ${filterBtn("PENDING", "Pendente")}
                        ${filterBtn("COMPLETED", "Concluído")}
                        ${filterBtn("CANCELLED", "Cancelado")}
                        ${filterBtn("UNPAID", "Não pago")}
                    </div>
                </div>
                <div class="camp-perf-table-wrap">
                    <table class="camp-perf-table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Data</th>
                                <th>Produto</th>
                                <th class="num">Itens</th>
                                <th class="num">Comissão</th>
                                <th class="num" style="padding-right:16px">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length ? slice.map(({ conv, order }) => {
                                const items = order.items || [];
                                const itemNames = items.map((i) => i.itemName || i.itemId).filter(Boolean).join(", ") || "—";
                                const qty = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
                                return `<tr>
                                    <td class="camp-perf-mono" style="font-size:11px">${escapeHtml(String(order.orderId || "—"))}</td>
                                    <td style="font-size:11.5px;color:#64748b">${escapeHtml(conversionDate(conv.purchaseTime))}</td>
                                    <td><div class="camp-perf-table-name" style="max-width:220px">${escapeHtml(itemNames)}</div></td>
                                    <td class="num">${qty}</td>
                                    <td class="num" style="font-weight:700;color:#047857">${formatMoneyBRL(conv.totalCommission)}</td>
                                    <td class="num">${statusPill(order.orderStatus)}</td>
                                </tr>`;
                            }).join("") : `<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8">Nenhuma venda com este filtro</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
        }

        function renderCampaignListRow(c) {
            const badge = campPerfBadgeMeta(c);
            const selected = campaignPerfSelected === c.key;
            const when = c.saved?.createdAt
                ? `Criada em ${new Date(c.saved.createdAt).toLocaleDateString("pt-BR")}`
                : "";
            const summary = `${c.orders} ped. · ${c.conversions} conv. · ${c.itemsQty} itens`;
            const comissaoStyle = c.commissionCompleted
                ? "color:#047857;font-weight:800"
                : (c.commission ? "color:#64748b;font-weight:700" : "color:#cbd5e1;font-weight:700");
            const comissaoMain = formatMoneyBRL(c.commissionCompleted || c.commission);
            const comissaoHint = c.commissionCompleted && c.commission > c.commissionCompleted
                ? `<span style="font-size:9px;color:#94a3b8;margin-left:4px">tot. ${formatMoneyBRL(c.commission)}</span>`
                : '';
            return `
                <div class="camp-perf-list-item${selected ? " is-selected" : ""}" role="button" tabindex="0"
                    onclick="openCampaignPerfDetail('${escapeAttr(c.key)}')"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCampaignPerfDetail('${escapeAttr(c.key)}')}">
                    <div style="display:flex;gap:10px;min-width:0">
                        ${campaignThumbsHtml(c)}
                        <div style="flex:1;min-width:0">
                            <div style="display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap">
                                <span style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:140px">${escapeHtml(c.name)}</span>
                                <span class="camp-perf-badge ${badge.cls}" style="font-size:9px;padding:2px 6px">${badge.label}</span>
                                <span style="margin-left:auto;font-size:11px;${comissaoStyle}">${comissaoMain}${comissaoHint}</span>
                            </div>
                            ${when ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:3px">${escapeHtml(when)}</div>` : ""}
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px">
                                <span class="camp-perf-mono" style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.key)}</span>
                                <span style="font-size:10.5px;color:#64748b;white-space:nowrap">${summary}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        function renderCampaignPerformance() {
            const list = document.getElementById('camp-perf-list');
            if (!list) return;
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const filtered = filterCampaignPerfList(campaigns);
            const totalOrders = campaigns.reduce((s, c) => s + c.orders, 0);
            const totalItems = campaigns.reduce((s, c) => s + c.itemsQty, 0);
            const totalCommission = campaigns.reduce((s, c) => s + c.commission, 0);
            const totalCompleted = campaigns.reduce((s, c) => s + (c.commissionCompleted || 0), 0);

            document.getElementById('camp-perf-count').textContent = String(campaigns.length);
            document.getElementById('camp-perf-conversions').textContent = String(campaignPerfRows.length);
            document.getElementById('camp-perf-orders').textContent = String(totalOrders);
            document.getElementById('camp-perf-items').textContent = String(totalItems);
            document.getElementById('camp-perf-commission').textContent = formatMoneyBRL(totalCompleted);
            const totalHint = document.getElementById('camp-perf-commission-total');
            if (totalHint) {
                totalHint.textContent = totalCommission > totalCompleted
                    ? `Total no período: ${formatMoneyBRL(totalCommission)}`
                    : '';
            }

            const rangeEl = document.getElementById('camp-perf-list-range');
            if (rangeEl) {
                const total = filtered.length;
                if (!total) rangeEl.textContent = "0 campanhas";
                else {
                    const start = campaignPerfListPage * CAMP_PERF_LIST_PAGE_SIZE + 1;
                    const end = Math.min(total, (campaignPerfListPage + 1) * CAMP_PERF_LIST_PAGE_SIZE);
                    rangeEl.textContent = `${start}–${end} de ${total}`;
                }
            }

            if (!campaigns.length) {
                list.innerHTML = `
                    <div class="camp-perf-list-empty">
                        <i class="fas fa-chart-pie text-2xl block mb-2"></i>
                        <p class="font-bold text-slate-600">Nenhuma campanha ainda</p>
                        <p>Crie uma campanha e ela já aparece aqui, mesmo antes da primeira venda.</p>
                        <button onclick="switchAdminView('campanhas')" class="mt-2 text-shopee-orange font-bold" style="border:0;background:transparent;cursor:pointer">Criar campanha</button>
                    </div>`;
                renderCampPerfPagination(0, 0, CAMP_PERF_LIST_PAGE_SIZE, 'setCampPerfListPage');
                return;
            }

            if (!filtered.length) {
                list.innerHTML = `<div class="camp-perf-list-empty">Nenhuma campanha corresponde à busca.</div>`;
                renderCampPerfPagination(0, 0, CAMP_PERF_LIST_PAGE_SIZE, 'setCampPerfListPage');
                return;
            }

            const pages = Math.ceil(filtered.length / CAMP_PERF_LIST_PAGE_SIZE);
            if (campaignPerfListPage >= pages) campaignPerfListPage = Math.max(0, pages - 1);
            const slice = filtered.slice(
                campaignPerfListPage * CAMP_PERF_LIST_PAGE_SIZE,
                (campaignPerfListPage + 1) * CAMP_PERF_LIST_PAGE_SIZE
            );

            list.innerHTML = slice.map((c) => renderCampaignListRow(c)).join('');
            renderCampPerfPagination(filtered.length, campaignPerfListPage, CAMP_PERF_LIST_PAGE_SIZE, 'setCampPerfListPage');
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

        function formatFunnelCount(value) {
            return Number(value || 0).toLocaleString('pt-BR');
        }

        function renderFunnelStep(name, count, description, variant) {
            const mod = variant ? ` camp-funnel-step--${variant}` : '';
            return `
                <div class="camp-funnel-step${mod}">
                    <span class="camp-funnel-step-name">${escapeHtml(name)}</span>
                    <span class="camp-funnel-step-value">${formatFunnelCount(count)}</span>
                    <span class="camp-funnel-step-desc">${escapeHtml(description)}</span>
                </div>`;
        }

        function renderFunnelFlow(opens, checkout, close, { compact = false } = {}) {
            const flowClass = compact ? 'camp-funnel-flow camp-funnel-flow--compact' : 'camp-funnel-flow';
            return `
                <div class="${flowClass}">
                    <div class="camp-funnel-main">
                        ${renderFunnelStep('Abriram o produto', opens, 'Pessoas que abriram o popup', 'open')}
                        <div class="camp-funnel-connector" aria-hidden="true"></div>
                        ${renderFunnelStep('Clicaram Ver na Shopee', checkout, 'Pessoas que seguiram para a Shopee', 'checkout')}
                    </div>
                    <div class="camp-funnel-exit">
                        ${renderFunnelStep('Fecharam sem ir à Shopee', close, 'Pessoas que fecharam o popup sem seguir para a Shopee', 'close')}
                    </div>
                </div>`;
        }

        function bindCampaignFunnelTabs(root) {
            if (!root) return;
            const tabs = root.querySelectorAll('[data-camp-funnel-tab]');
            const panels = root.querySelectorAll('[data-camp-funnel-panel]');
            tabs.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const view = btn.getAttribute('data-camp-funnel-tab');
                    tabs.forEach((t) => {
                        const on = t === btn;
                        t.classList.toggle('is-active', on);
                        t.setAttribute('aria-selected', on ? 'true' : 'false');
                    });
                    panels.forEach((p) => {
                        p.classList.toggle('is-active', p.getAttribute('data-camp-funnel-panel') === view);
                    });
                });
            });
        }

        function renderCampaignFunnel(data, savedProducts) {
            const el = document.getElementById('camp-perf-detail-funnel');
            if (!el) return;
            const totals = data?.totals || { opens: 0, checkout: 0, close: 0 };
            const products = Array.isArray(data?.products) ? data.products : [];
            const savedMap = new Map((savedProducts || []).map((p) => [String(p.id), p]));
            const days = Number(data?.days) || 30;
            const hasData = totals.opens > 0 || products.some((p) => p.opens > 0 || p.checkout > 0 || p.close > 0);
            const clickPct = campPerfPct(totals.checkout, totals.opens);
            const closePct = campPerfPct(totals.close, totals.opens);
            const clickWidth = totals.opens ? Math.round((totals.checkout / totals.opens) * 100) : 0;
            const closeWidth = totals.opens ? Math.round((totals.close / totals.opens) * 100) : 0;

            if (!hasData) {
                el.innerHTML = `
                    <div class="camp-perf-panel-toolbar">
                        <div>
                            <div style="font-size:13px;font-weight:700">Funil do anúncio</div>
                            <div style="font-size:11.5px;color:#64748b;margin-top:3px">Visitantes únicos · últimos ${days} dias</div>
                        </div>
                    </div>
                    <p class="camp-funnel-empty-msg" style="font-size:12px;color:#94a3b8">Ainda sem eventos neste período. Use o link da campanha com <code>utm_campaign</code> para registrar aberturas, cliques na Shopee e fechamentos.</p>`;
                return;
            }

            const productRows = products.map((p) => {
                const saved = savedMap.get(String(p.product_id));
                const name = saved?.title || p.product_name || `Produto ${p.product_id}`;
                const pct = campPerfPct(p.checkout, p.opens);
                const barW = p.opens ? Math.round((p.checkout / p.opens) * 100) : 0;
                return `
                    <tr>
                        <td style="padding:9px 16px">
                            <div class="camp-perf-table-name">${escapeHtml(name)}</div>
                            <div class="camp-perf-table-id">ID ${escapeHtml(String(p.product_id))}</div>
                        </td>
                        <td class="num" style="font-weight:600">${formatFunnelCount(p.opens)}</td>
                        <td class="num">${formatFunnelCount(p.checkout)}</td>
                        <td class="num" style="color:#64748b">${formatFunnelCount(p.close)}</td>
                        <td style="padding:9px 16px;width:150px">
                            <div style="display:flex;align-items:center;gap:8px">
                                <div class="camp-perf-mini-bar"><span style="width:${barW}%"></span></div>
                                <span style="font-size:10.5px;color:#64748b;width:34px;text-align:right">${pct}</span>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            el.innerHTML = `
                <div class="camp-perf-panel-toolbar">
                    <div>
                        <div style="font-size:13px;font-weight:700">Funil do anúncio</div>
                        <div style="font-size:11.5px;color:#64748b;margin-top:3px">Visitantes únicos · últimos ${days} dias · utm_campaign=${escapeHtml(String(data?.campaign || campaignPerfSelected || ''))}</div>
                    </div>
                    <div class="camp-perf-mono" style="font-size:11px;color:#94a3b8">Total da campanha</div>
                </div>
                <div class="camp-perf-funil-hero">
                    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
                        <div>
                            <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.06em">Abriram o produto</div>
                            <div style="font-size:34px;font-weight:800;letter-spacing:-.03em;margin-top:2px">${formatFunnelCount(totals.opens)}</div>
                        </div>
                        <div style="font-size:11.5px;color:#94a3b8;max-width:260px">Pessoas que abriram o popup do produto.</div>
                    </div>
                    <div class="camp-perf-funil-bar">
                        <div class="camp-perf-funil-bar-click" style="width:${clickWidth}%"></div>
                        <div class="camp-perf-funil-bar-close" style="width:${closeWidth}%"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#94a3b8">
                        <span>${clickPct} foram à Shopee</span>
                        <span>${closePct} fecharam</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:16px">
                        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;background:#fff">
                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="width:8px;height:8px;border-radius:2px;background:#0f172a"></span>
                                <span style="font-size:11.5px;font-weight:600;color:#334155">Clicaram Ver na Shopee</span>
                            </div>
                            <div style="font-size:26px;font-weight:800;margin-top:6px">${formatFunnelCount(totals.checkout)}</div>
                            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${clickPct} de quem abriu o produto</div>
                        </div>
                        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;background:#f8fafc">
                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="width:8px;height:8px;border-radius:2px;background:#cbd5e1"></span>
                                <span style="font-size:11.5px;font-weight:600;color:#334155">Fecharam sem ir à Shopee</span>
                            </div>
                            <div style="font-size:26px;font-weight:800;margin-top:6px">${formatFunnelCount(totals.close)}</div>
                            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${closePct} de quem abriu o produto</div>
                        </div>
                    </div>
                </div>
                ${products.length > 1 ? `
                <div class="camp-perf-table-wrap" style="margin-top:18px">
                    <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b">Funil por produto</div>
                    <div style="max-height:320px;overflow-y:auto">
                        <table class="camp-perf-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th class="num">Abriram</th>
                                    <th class="num">Shopee</th>
                                    <th class="num">Fecharam</th>
                                    <th>Distribuição</th>
                                </tr>
                            </thead>
                            <tbody>${productRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}`;
        }

        async function loadCampaignFunnel(campaignKey, savedProducts) {
            const el = document.getElementById('camp-perf-detail-funnel');
            if (!el) return;
            el.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando funil…</div>';
            try {
                const days = document.getElementById('camp-perf-days')?.value || '30';
                const params = new URLSearchParams({ campaign: campaignKey, days: String(days) });
                const ids = (savedProducts || []).map((p) => p.id).filter(Boolean);
                if (ids.length) params.set('product_ids', ids.join(','));
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/funnel?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                campaignPerfFunnelCache = data;
                renderCampaignFunnel(data, savedProducts);
                const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
                const c = campaigns.find((x) => x.key === campaignKey);
                if (c) {
                    renderCampPerfResumo(c, data);
                    renderCampPerfProductsTable(c, data);
                }
            } catch (err) {
                campaignPerfFunnelCache = null;
                el.innerHTML = `
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;font-size:12px;color:#b91c1c">
                        Não foi possível carregar o funil: ${escapeHtml(err.message)}
                    </div>`;
            }
        }

        function openCampaignPerfDetail(key) {
            const campaigns = buildCampaignPerformanceMap(campaignPerfRows);
            const c = campaigns.find(x => x.key === key);
            const detail = document.getElementById('camp-perf-detail');
            const empty = document.getElementById('camp-perf-detail-empty');
            if (!c || !detail) {
                showToast('Campanha não encontrada — atualize o período', 'error');
                return;
            }
            campaignPerfSelected = key;
            campaignPerfSalesFilter = '';
            campaignPerfProdQ = '';
            campaignPerfProdPage = 0;
            renderCampaignPerformance();

            const badge = campPerfBadgeMeta(c);
            document.getElementById('camp-perf-detail-title').textContent = c.name;
            const badgeEl = document.getElementById('camp-perf-detail-badge');
            if (badgeEl) {
                badgeEl.textContent = badge.label;
                badgeEl.className = `camp-perf-badge ${badge.cls}`;
            }
            const createdEl = document.getElementById('camp-perf-detail-created');
            if (createdEl) {
                const nProd = (c.saved?.products || []).length;
                const when = c.saved?.createdAt
                    ? `Criada em ${new Date(c.saved.createdAt).toLocaleDateString('pt-BR')}`
                    : '';
                createdEl.textContent = c.saved
                    ? `${nProd ? nProd + ' produto(s)' : 'Vitrine'}${when ? ' · ' + when : ''} · ${c.conversions} conversões · ${c.orders} pedidos`
                    : `${c.conversions} conversões · ${c.orders} pedidos · fora do painel`;
            }
            const utmEl = document.getElementById('camp-perf-detail-utm');
            if (utmEl) utmEl.textContent = `utm_campaign=${c.key}`;

            const actionsEl = document.getElementById('camp-perf-detail-actions');
            if (actionsEl) {
                actionsEl.innerHTML = c.saved ? `
                    <button type="button" class="camp-perf-btn camp-perf-btn--dark" onclick="copySavedCampaignLinks('${escapeAttr(String(c.saved.id))}')">Copiar link</button>
                    <button type="button" class="camp-perf-btn" onclick="renameSavedCampaign('${escapeAttr(String(c.saved.id))}')">Renomear</button>
                    <button type="button" class="camp-perf-btn" onclick="loadSavedCampaignIntoEditor('${escapeAttr(String(c.saved.id))}')">Editar</button>
                    <button type="button" class="camp-perf-btn camp-perf-btn--danger" onclick="deleteSavedCampaign('${escapeAttr(String(c.saved.id))}')">Apagar</button>
                ` : '';
            }

            const prodCount = buildCampPerfProductRows(c, campaignPerfFunnelCache).length;
            const salesCount = c.conversionsList.flatMap((conv) => conv.orders || []).length;
            const prodTab = document.getElementById('camp-perf-tab-prod-count');
            const salesTab = document.getElementById('camp-perf-tab-sales-count');
            if (prodTab) prodTab.textContent = prodCount ? `(${prodCount})` : '';
            if (salesTab) salesTab.textContent = salesCount ? `(${salesCount})` : '';

            empty?.classList.add('hidden');
            detail.classList.remove('hidden');
            switchCampPerfTab(campaignPerfDetailTab || 'resumo');

            renderCampPerfResumo(c, campaignPerfFunnelCache);
            renderCampPerfProductsTable(c, campaignPerfFunnelCache);
            renderCampPerfSalesTable(c);
            loadCampaignFunnel(key, c.saved?.products || []);
        }

        function closeCampaignPerfDetail() {
            campaignPerfSelected = '';
            campaignPerfFunnelCache = null;
            document.getElementById('camp-perf-detail')?.classList.add('hidden');
            document.getElementById('camp-perf-detail-empty')?.classList.remove('hidden');
            renderCampaignPerformance();
        }

        async function loadFinanceiro({ pull = false } = {}) {
            if (!isAdminMode()) return;
            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            const byCampEl = document.getElementById("fin-by-campaign");
            setText("fin-total", "…");
            setText("fin-confirmed", "…");
            setText("fin-estimated", "…");
            setText("fin-cancelled", "…");
            if (byCampEl) byCampEl.textContent = "Carregando…";
            try {
                if (pull) await ensureConversionsFresh({ force: false });
                await syncSavedCampaigns();
                const days = document.getElementById("fin-days")?.value || "30";
                const params = new URLSearchParams({ days: String(days) });
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/performance?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Não foi possível carregar o financeiro");
                const rows = Array.isArray(data.conversions) ? data.conversions : [];

                let confirmed = 0;
                let estimated = 0;
                let completed = 0;
                let pending = 0;
                let unpaid = 0;
                let cancelled = 0;
                let orders = 0;

                for (const conversion of rows) {
                    for (const order of (conversion.orders || [])) {
                        orders += 1;
                        const st = String(order.orderStatus || "").toUpperCase();
                        const money = commissionNumber(conversion.totalCommission);
                        if (st === "COMPLETED") {
                            completed += 1;
                            confirmed += money;
                        } else if (st === "PENDING") {
                            pending += 1;
                            estimated += money;
                        } else if (st === "UNPAID") {
                            unpaid += 1;
                            estimated += money;
                        } else if (st === "CANCELLED") {
                            cancelled += 1;
                        }
                    }
                }

                const total = confirmed + estimated;
                const cancelPct = orders ? Math.round((cancelled / orders) * 1000) / 10 : 0;
                const unpaidLabel = unpaid === 1 ? "1 não pago" : `${unpaid} não pagos`;

                setText("fin-total", formatMoneyBRL(total));
                setText("fin-confirmed", formatMoneyBRL(confirmed));
                setText("fin-confirmed-hint", `${completed} pedido${completed === 1 ? "" : "s"} concluído${completed === 1 ? "" : "s"}`);
                setText("fin-estimated", formatMoneyBRL(estimated));
                setText("fin-estimated-hint", `${pending} pendente${pending === 1 ? "" : "s"} + ${unpaidLabel}`);
                setText("fin-cancelled", String(cancelled));
                setText("fin-cancelled-hint", `${String(cancelPct).replace(".", ",")}% dos pedidos`);
                setText("fin-orders-total", String(orders));
                setText("fin-orders-completed", String(completed));
                setText("fin-orders-pending", String(pending));
                setText("fin-orders-unpaid", String(unpaid));
                setText("fin-orders-cancelled", String(cancelled));

                const campaigns = buildCampaignPerformanceMap(rows)
                    .filter((c) => c.commission > 0 || c.orders > 0)
                    .sort((a, b) => b.commission - a.commission);
                const campTotal = campaigns.reduce((s, c) => s + c.commission, 0);
                setText("fin-by-campaign-total", formatMoneyBRL(campTotal));

                if (!campaigns.length) {
                    if (byCampEl) byCampEl.textContent = "Nenhuma comissão no período.";
                    return;
                }
                if (byCampEl) {
                    byCampEl.innerHTML = campaigns.map((c) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9">
                            <span style="font-weight:600;color:#0f172a">${escapeHtml(c.name)}</span>
                            <span style="font-weight:800;color:#0f172a;white-space:nowrap">${formatMoneyBRL(c.commission)}</span>
                        </div>
                    `).join("");
                }
            } catch (err) {
                setText("fin-total", "—");
                setText("fin-confirmed", "—");
                setText("fin-estimated", "—");
                setText("fin-cancelled", "—");
                if (byCampEl) byCampEl.textContent = err.message || "Erro ao carregar";
            }
        }

        async function loadMeuSiteSummary({ pull = false } = {}) {
            if (!isAdminMode()) return;
            const daysSel = document.getElementById("ms-days");
            const onlyMe = document.getElementById("ms-only-me");
            const days = Number(daysSel?.value || 30);
            const onlyMeuSite = !!(onlyMe?.checked ?? true);
            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setText("ms-net", "Carregando…");
            try {
                if (pull) {
                    await ensureConversionsFresh({ force: false });
                }
                const res = await adminFetch(`${API_BASE}/api/admin/meu-site/summary?days=${days}&onlyMeuSite=${onlyMeuSite}`);
                const data = await res.json();
                if (!res.ok || !data?.ok) throw new Error(data?.error || "falhou");
                const t = data.totals || {};
                setText("ms-net", BRL(t.net));
                setText("ms-gross", BRL(t.gross));
                setText("ms-pending-net", BRL(t.pendingNet));
                setText("ms-orders", String(t.orders || 0));
                setText(
                    "ms-orders-break",
                    `${t.completed || 0} concl. · ${t.pending || 0} pend. · ${t.unpaid || 0} não pagos · ${t.cancelled || 0} cancel.`
                );
                setText("ms-cancel-count", String(t.cancelled || 0));
                setText("ms-ticket", BRL(t.avgTicket));
                setText("ms-cancel-pct", PCT(t.cancelledPct));
                setText("ms-fraud-pct", PCT(t.fraudPct));
                setText("ms-sample", String(data.sampleSize || 0));
                const win = data.window || {};
                const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
                setText("ms-window", `${fmt(win.from)} → ${fmt(win.to)}`);
                const health = (t.cancelledPct || 0) + (t.fraudPct || 0);
                setText("ms-health", health < 5 ? "✅ Saudável" : health < 15 ? "⚠️ Atenção" : "🚨 Crítico");
                renderStatusFunnel("ms-funnel", {
                    UNPAID: t.unpaid || 0,
                    PENDING: t.pending || 0,
                    COMPLETED: t.completed || 0,
                    CANCELLED: t.cancelled || 0,
                });

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
                const data = await ensureConversionsFresh({ force: true });
                if (data?.skipped && data.error) throw new Error(data.error);
                if (!data?.ok && data?.error) throw new Error(data.error);
                const r = data?.result || {};
                showToast(`Salvo ${r.saved || 0} conversão(ões) (${r.pages || 0} páginas)`, "success");
                loadMeuSiteSummary({ pull: false });
                loadCampaignPerformance({ reset: true, pull: false });
                loadConversions({ reset: true, pull: false });
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
        const toolBusy = { feed: false, metrics: false, backfill: false, prioritize: false,
            health: false, validated: false, feedInventory: false };

        function withBusy(key, fn) {
            return async function (...args) {
                if (toolBusy[key]) { showToast("Já rodando, aguarde…", "warning"); return; }
                toolBusy[key] = true;
                try { return await fn.apply(this, args); }
                finally { toolBusy[key] = false; }
            };
        }

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
            out.innerHTML = '<p class="text-slate-400 text-xs">Consultando feeds…</p>';
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
                            <th class="p-1 text-right">Registros</th><th class="p-1">Nome</th><th class="p-1"></th>
                        </tr></thead>
                        <tbody>${feeds.map(f => `
                            <tr class="border-b border-slate-100">
                                <td class="p-1 font-mono">${escapeHtml(String(f.date || "—"))}</td>
                                <td class="p-1"><span class="px-1.5 py-0.5 rounded ${String(f.feedMode).toUpperCase() === 'FULL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} text-[10px] font-bold">${escapeHtml(String(f.feedMode).toUpperCase() === 'FULL' ? 'Completa' : String(f.feedMode).toUpperCase() === 'DELTA' ? 'Só o que mudou' : (f.feedMode || ""))}</span></td>
                                <td class="p-1 font-mono text-slate-500">${escapeHtml(String(f.referenceId || "—"))}</td>
                                <td class="p-1 text-right font-mono">${Number(f.totalCount || 0).toLocaleString('pt-BR')}</td>
                                <td class="p-1 text-slate-600 truncate max-w-[220px]">${escapeHtml(String(f.datafeedName || f.description || ""))}</td>
                                <td class="p-1">${f.datafeedId ? `<button type="button" class="btn-ghost" style="padding:4px 8px;font-size:10px" onclick="previewFeed('${String(f.datafeedId).replace(/'/g, "")}')">Ver lote</button>` : ""}</td>
                            </tr>`).join("")}</tbody>
                    </table></div>`;
            } catch (err) {
                out.innerHTML = `<p class="text-red-600 text-xs">Erro: ${escapeHtml(err.message || String(err))}</p>`;
            }
        });

        async function previewFeed(datafeedId) {
            const out = document.getElementById("feed-preview-result");
            if (!out) return;
            out.innerHTML = "Carregando lote…";
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/feeds/preview?datafeedId=${encodeURIComponent(datafeedId)}&limit=40`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
                const rows = d.rows || [];
                if (!rows.length) {
                    out.innerHTML = "Nenhuma linha neste lote.";
                    return;
                }
                const typeLabel = (t) => t === "DELETE" ? "Remover" : t === "UPDATE" ? "Atualizar" : t === "NEW" ? "Novo" : (t || "—");
                out.innerHTML = `<p style="margin:0 0 8px;font-size:11px;color:#64748b">${rows.length} linhas deste feed</p>` +
                    rows.slice(0, 40).map((r) =>
                        `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
                            <span style="font-size:10px;font-weight:700;color:#64748b;min-width:70px">${escapeHtml(typeLabel(r.updateType))}</span>
                            <span style="flex:1;font-size:11px">${escapeHtml(String(r.name || r.itemId || "—"))}</span>
                            <span style="font-size:11px;color:#059669">${escapeHtml(String(r.commission || ""))}</span>
                        </div>`
                    ).join("");
            } catch (err) {
                out.innerHTML = `<span style="color:#be123c">${escapeHtml(err.message || "Erro")}</span>`;
            }
        }

        async function loadDashboardSales() {
            const dashTotal = document.getElementById("dash-conversion-total");
            const dashComm = document.getElementById("dash-conversion-commission");
            if (!dashTotal && !dashComm) return;
            try {
                // Mesma fonte do Meu Site / Todas as conversões (banco), não o report ao vivo (limit 50).
                const res = await adminFetch(`${API_BASE}/api/admin/meu-site/summary?days=30&onlyMeuSite=true`);
                const d = await res.json();
                if (!res.ok || !d?.ok) throw new Error(d.error || `HTTP ${res.status}`);
                const t = d.totals || {};
                if (dashTotal) dashTotal.textContent = String(t.orders || 0);
                // Confirmado = COMPLETED (bruto/total_commission), alinhado ao card verde de conversões.
                const confirmed = Number(t.gross) || 0;
                if (dashComm) {
                    dashComm.textContent = confirmed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                }
            } catch (_) {
                if (dashTotal && dashTotal.textContent === "—") dashTotal.textContent = "0";
            }
        }

        async function lookupConversion() {
            const box = document.getElementById("conversion-lookup-result");
            const raw = String(document.getElementById("conversion-lookup-q")?.value || "").trim();
            if (!box) return;
            if (!raw) {
                box.textContent = "Cole o ID do pedido, do produto ou da loja.";
                return;
            }
            box.textContent = "Buscando…";
            const qs = new URLSearchParams({ days: "90" });
            if (/^\d{10,}$/.test(raw) && raw.length > 12) qs.set("orderId", raw);
            else if (/^\d+$/.test(raw)) qs.set("productId", raw);
            else qs.set("orderId", raw);
            try {
                const res = await adminFetch(`${API_BASE}/api/admin/conversions/lookup?${qs}`);
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
                const nodes = d.nodes || [];
                if (!nodes.length) {
                    box.textContent = "Nada encontrado nos últimos 90 dias.";
                    return;
                }
                box.innerHTML = nodes.slice(0, 12).map((n) => {
                    const orders = n.orders || [];
                    const first = orders[0] || {};
                    const item = (first.items || [])[0] || {};
                    const status = first.orderStatus || "—";
                    const fraud = item.fraudStatus || "";
                    return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9">
                        <strong>${escapeHtml(String(first.orderId || n.conversionId || "—"))}</strong>
                        · ${escapeHtml(String(status))}
                        ${fraud ? ` · fraude ${escapeHtml(String(fraud))}` : ""}
                        <div style="font-size:11px;color:#64748b">${escapeHtml(String(item.itemName || ""))}</div>
                    </div>`;
                }).join("");
            } catch (err) {
                box.textContent = err.message || "Erro na busca";
            }
        }

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
            // refresh-metrics-result é o box novo (view catalogo-saude). Fallback pro feed-result
            // continua funcionando caso alguém abra por rota antiga.
            const out = document.getElementById("refresh-metrics-result") || document.getElementById("feed-result");
            if (!out) return;
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

        async function loadConversions({ reset = false, advance = false, pull = true, forcePull = false } = {}) {
            const list = document.getElementById('conversion-list');
            if (!list || !isAdminMode()) return;
            if (reset) {
                conversionScrollId = '';
                conversionRows = [];
                conversionPage = 1;
                conversionHasNextRemote = false;
            }
            try {
                if (reset && (pull || forcePull)) {
                    list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Atualizando conversões da Shopee e gravando no banco…</div>';
                    const pulled = await ensureConversionsFresh({ force: !!forcePull });
                    if (pulled?.ok && pulled.result && Number(pulled.result.saved) > 0) {
                        const by = pulled.result.byStatus || {};
                        const bits = Object.entries(by)
                            .filter(([, v]) => Number(v.saved) > 0)
                            .map(([k, v]) => `${conversionStatusLabel(k)} ${v.saved}`);
                        showToast(`Shopee → banco: ${pulled.result.saved} atualizada(s)${bits.length ? ` (${bits.join(', ')})` : ''}`, 'success');
                    } else if (pulled?.error && !pulled.skipped) {
                        showToast(`Pull Shopee: ${pulled.error} — mostrando o que já está no banco`, 'warning');
                    }
                }
                list.innerHTML = '<div class="py-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando do banco…</div>';
                const days = document.getElementById('conversion-days')?.value || '30';
                // Sem filtro de status no servidor: as abas filtram no cliente e mostram os totais.
                const params = new URLSearchParams({ days: String(days) });
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/performance?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Não foi possível consultar as conversões');
                conversionRows = Array.isArray(data.conversions) ? data.conversions : [];
                conversionScrollId = '';
                conversionHasNextRemote = false;
                if (advance) conversionPage += 1;
                renderConversions();
            } catch (err) {
                list.innerHTML = `
                    <div class="py-8 text-center text-red-500 text-xs">
                        <i class="fas fa-circle-exclamation mr-1"></i>${escapeHtml(err.message)}
                    </div>`;
            }
        }

        function previousConversionPage() {
            if (conversionPage <= 1) return;
            goToConversionPage(conversionPage - 1);
        }

        function nextConversionPage() {
            const total = filteredConversionOrders().length;
            const totalLoadedPages = Math.max(1, Math.ceil(total / CONVERSION_PAGE_SIZE));
            if (conversionPage < totalLoadedPages) goToConversionPage(conversionPage + 1);
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
            if (bar) {
                bar.classList.toggle('hidden', n === 0);
                bar.style.display = n === 0 ? 'none' : 'flex';
            }
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

        async function addSelectedProductsToCampaign() {
            if (!adminSelectedIds.size) {
                showToast('Selecione ao menos um produto', 'error');
                return;
            }
            const ids = [...adminSelectedIds];
            let added = 0;
            let skipped = 0;
            let failed = 0;
            showToast(`Preparando ${ids.length} produto(s) com link de afiliado…`, 'info');
            for (const id of ids) {
                const before = campaignSelectedProducts.length;
                const already = campaignSelectedProducts.some(x => String(x.id) === String(id));
                const ok = await ensureCampaignProduct(id, { silent: true });
                if (ok && !already && campaignSelectedProducts.length > before) added += 1;
                else if (already) skipped += 1;
                else failed += 1;
            }
            renderCampaignSelectedProducts();
            updateCampaignLinkPreview();
            adminSelectedIds.clear();
            renderConsoleProducts();
            const missing = campaignSelectedProducts.filter((p) => !productHasAffiliate(p)).length;
            if (failed || missing) {
                showToast(`${added} na campanha · ${failed || missing} sem link de afiliado da Shopee`, 'error');
            } else {
                showToast(
                    added
                        ? `${added} produto(s) adicionados à campanha${skipped ? ` (${skipped} já estavam)` : ''}`
                        : 'Nenhum produto novo para adicionar',
                    added ? 'success' : 'error'
                );
            }
            if (added || campaignSelectedProducts.length) switchAdminView('campanhas');
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
                                <button type="button" onclick="pickCampaignCatalogProduct('${String(p.id).replace(/'/g, '')}'); switchAdminView('campanhas');"
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
            const el = document.getElementById('new-product-form-card');
            if (!el) return;
            el.classList.remove('hidden');
            el.style.display = 'block';
        }

        function closeNewProductForm() {
            const el = document.getElementById('new-product-form-card');
            if (!el) return;
            el.classList.add('hidden');
            el.style.display = 'none';
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
            const keyword = String(document.getElementById('official-keyword')?.value || '').trim();
            const sortType = String(document.getElementById('official-sort')?.value || '1').trim() || '1';
            box.innerHTML = '<p class="text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando ofertas oficiais…</p>';
            try {
                const qs = new URLSearchParams({ limit: '20', sortType });
                if (keyword) qs.set('keyword', keyword);
                const res = await adminFetch(`${API_BASE}/api/admin/shopee/campaigns?${qs}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const items = data.nodes || [];
                box.dataset.loaded = '1';
                if (!items.length) {
                    box.innerHTML = '<p class="text-slate-400">Nenhuma oferta oficial retornada agora.</p>';
                    return;
                }
                window.__officialOffers = items;
                box.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-slate-700">${items.length} ofertas</span>
                    </div>
                    <div class="space-y-2 max-h-[520px] overflow-y-auto">
                        ${items.slice(0, 20).map((c, i) => {
                            const collectionId = c.collectionId || c.collection_id || '';
                            const categoryId = c.categoryId || c.category_id || '';
                            const match = collectionId || categoryId;
                            return `
                            <div class="border border-slate-100 rounded-lg p-2 flex gap-2">
                                <img src="${escapeHtml(c.imageUrl || c.image || '')}" class="w-10 h-10 rounded object-cover bg-slate-100" onerror="this.style.display='none'">
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-slate-800 text-[11px] line-clamp-2">${escapeHtml(c.offerName || c.title || c.productName || c.name || 'Oferta')}</p>
                                    <p class="text-[10px] text-slate-400">${match ? `ID ${escapeHtml(String(match))}` : 'sem ID de coleção'}${c.commissionRate ? ` · ${escapeHtml(String(c.commissionRate))}` : ''}</p>
                                </div>
                                ${match ? `<button type="button" onclick="useOfficialInExplorer(${i})" class="shrink-0 px-2 py-1 rounded bg-shopee-orange text-white text-[10px] font-bold">Mostrar produtos</button>` : ''}
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
            if (!match) return showToast('Oferta sem ID de coleção ou categoria', 'error');
            const matchEl = document.getElementById('admin-match-id');
            const lt = document.getElementById('admin-list-type');
            const st = document.getElementById('admin-sort-type');
            const kw = document.getElementById('admin-keyword');
            const rc = document.getElementById('admin-require-commission');
            const shopEl = document.getElementById('admin-shop-id');
            if (matchEl) matchEl.value = String(match);
            if (lt) lt.value = collectionId ? '6' : '4';
            if (st) st.value = '5';
            if (kw) kw.value = '';
            if (rc) rc.checked = true;
            if (shopEl) shopEl.value = '';
            updateExplorerKwCount();
            renderExplorerKeywordChips();
            updateExplorerModeHint();
            // Só troca a aba interna — a prévia é compartilhada.
            switchCatalogoBuscarTab("palavras");
            document.getElementById("explorer-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
            showToast("Buscando produtos da coleção — só o que ainda não está na vitrine", "info");
            runExplorerSearch({ sync: false });
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
                const status = document.getElementById('conversion-status')?.value || '';
                const params = new URLSearchParams({ days: String(days) });
                if (status) params.set('status', status);
                const res = await adminFetch(`${API_BASE}/api/admin/campanhas/performance?${params}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const rows = Array.isArray(data.conversions) ? data.conversions : [];
                const channelMap = new Map();
                const itemMap = new Map();
                for (const c of rows) {
                    const parsed = parseUtmContent(c.utmContent);
                    const channel = sanitizeSubId(parsed.channel, 'desconhecido') || 'desconhecido';
                    if (!channelMap.has(channel)) channelMap.set(channel, { channel, conversions: 0, commission: 0 });
                    const ch = channelMap.get(channel);
                    ch.conversions += 1;
                    ch.commission += commissionNumber(c.totalCommission);
                    for (const order of (c.orders || [])) {
                        for (const item of (order.items || [])) {
                            const id = String(item.itemId || item.itemName || 'item');
                            if (!itemMap.has(id)) {
                                itemMap.set(id, { itemId: item.itemId, itemName: item.itemName || '', qty: 0 });
                            }
                            itemMap.get(id).qty += Number(item.qty) || 1;
                        }
                    }
                }
                const channels = [...channelMap.values()].sort((a, b) => b.commission - a.commission);
                const tops = [...itemMap.values()].sort((a, b) => b.qty - a.qty);
                if (list) {
                    list.innerHTML = `
                        <div class="space-y-3">
                            <div>
                                <p class="text-[10px] font-bold uppercase text-slate-500 mb-2">Por canal (Sub ID) · banco</p>
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
                            <button type="button" onclick="loadConversions({reset:true,pull:false})" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                                Voltar à lista
                            </button>
                        </div>`;
                }
            } catch (err) {
                if (list) list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
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
                                <button type="button" onclick="moneyQueueCopyAdLink('${id}')" class="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700" title="URL /p/:id — dispara o Pixel completo (Facebook Ads)">Copiar (Ads)</button>
                                <button type="button" onclick="moneyQueueCopyShopeeLink('${id}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold hover:bg-slate-200" title="Link Shopee cru — sem popup nem Pixel">Copiar (Shopee)</button>
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

        function buildProductAdLink(itemId) {
            if (!itemId) return '';
            const origin = (window.location && window.location.origin) || '';
            return `${origin}/p/${encodeURIComponent(String(itemId))}`;
        }

        function moneyQueueCopyAdLink(id) {
            const p = moneyQueueFind(id);
            if (!p) return showToast('Produto não encontrado', 'error');
            const itemId = p.itemId || p.id;
            const link = buildProductAdLink(itemId);
            if (!link) return showToast('Sem itemId', 'error');
            copyTextToClipboard(link, 'Link do anúncio copiado (dispara Pixel)');
        }

        function moneyQueueCopyShopeeLink(id) {
            const p = moneyQueueFind(id);
            if (!p) return;
            const link = p.shortLink || p.affiliateLink || p.productLink || '';
            if (!link) return showToast('Sem link Shopee', 'error');
            copyTextToClipboard(link, 'Link Shopee copiado');
        }

        // Compat: alguns lugares antigos ainda podem chamar moneyQueueCopyLink.
        function moneyQueueCopyLink(id) {
            return moneyQueueCopyShopeeLink(id);
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
            switchAdminView("catalogo-buscar", { tab: "palavras" });
            document.getElementById('explorer-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast('Pré-visualizando — só produtos novos', 'success');
            runExplorerSearch({ sync: false });
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
            switchAdminView("catalogo-buscar", { tab: "palavras" });
            document.getElementById('explorer-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast(`${kws.length} palavras-chave de ${cat.label} — pré-visualizando`, 'success');
            runExplorerSearch({ sync: false });
        }

        function shopTypeLabel(t) {
            const n = Number(t);
            if (n === 1) return "Loja oficial";
            if (n === 2) return "Loja estrela";
            if (n === 3) return "Internacional";
            return "Loja";
        }

        async function loadAffiliateShops(overrides = {}) {
            const box = document.getElementById("shops-preview");
            if (!box) return;
            const keyword = overrides.keyword != null
                ? String(overrides.keyword)
                : String(document.getElementById("shops-keyword")?.value || "").trim();
            const shopType = overrides.shopType != null
                ? String(overrides.shopType)
                : String(document.getElementById("shops-type")?.value || "").trim();
            const sortType = overrides.sortType != null
                ? String(overrides.sortType)
                : (String(document.getElementById("shops-sort")?.value || "").trim() || "2");
            box.innerHTML = '<p class="text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i> Buscando lojas…</p>';
            try {
                const qs = new URLSearchParams({ limit: "20", sortType });
                if (keyword) qs.set("keyword", keyword);
                if (shopType) qs.set("shopType", shopType);
                if (document.getElementById("shops-key-seller")?.checked) qs.set("isKeySeller", "1");
                const res = await adminFetch(`${API_BASE}/api/admin/shopee/shops?${qs}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const items = data.nodes || [];
                box.dataset.loaded = "1";
                if (!items.length) {
                    box.innerHTML = '<p class="text-slate-400">Nenhuma loja encontrada. Tente outro nome.</p>';
                    return;
                }
                window.__affiliateShops = items;
                box.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-slate-700">${items.length} lojas</span>
                    </div>
                    <div class="space-y-2">
                        ${items.map((s, i) => {
                            const id = s.shopId || s.shop_id || "";
                            const comm = s.commissionRate != null ? String(s.commissionRate) : "—";
                            return `
                            <div class="border border-slate-100 rounded-lg p-2 flex gap-2 items-center">
                                <img src="${escapeHtml(s.imageUrl || s.image || "")}" class="w-10 h-10 rounded object-cover bg-slate-100" onerror="this.style.display='none'">
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-slate-800 text-[12px] truncate">${escapeHtml(s.shopName || s.shop_name || "Loja")}</p>
                                    <p class="text-[10px] text-slate-400">${escapeHtml(shopTypeLabel(s.shopType))} · comissão ${escapeHtml(comm)}${s.sellerCommCoveRatio ? ` · cobertura ${escapeHtml(String(s.sellerCommCoveRatio))}` : ""}${id ? ` · ID ${escapeHtml(String(id))}` : ""}</p>
                                </div>
                                ${id ? `<button type="button" onclick="previewShopInExplorer('${String(id).replace(/'/g, "")}')" class="shrink-0 px-2 py-1 rounded bg-shopee-orange text-white text-[10px] font-bold">Mostrar produtos</button>` : ""}
                            </div>`;
                        }).join("")}
                    </div>`;
            } catch (err) {
                box.innerHTML = `<p class="text-red-600">Falha: ${escapeHtml(err.message)}</p>`;
            }
        }

        function loadTopAffiliateShops() {
            return loadAffiliateShops({ keyword: "", shopType: "", sortType: "3" });
        }

        function previewShopInExplorer(shopId) {
            const shopEl = document.getElementById("admin-shop-id");
            const lt = document.getElementById("admin-list-type");
            const st = document.getElementById("admin-sort-type");
            const kw = document.getElementById("admin-keyword");
            const rc = document.getElementById("admin-require-commission");
            const mc = document.getElementById("admin-min-commission");
            if (shopEl) shopEl.value = String(shopId || "");
            if (lt) lt.value = "5";
            if (st) st.value = "5";
            if (kw) kw.value = "";
            const matchEl = document.getElementById("admin-match-id");
            if (matchEl) matchEl.value = "";
            if (rc) rc.checked = true;
            if (mc) mc.value = "9";
            updateExplorerKwCount();
            renderExplorerKeywordChips();
            updateExplorerModeHint();
            // Fica na aba Palavras-chave (que exibe a prévia); mostra o container de IDs.
            switchCatalogoBuscarTab("palavras");
            document.getElementById("explorer-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
            showToast("Buscando produtos da loja — só os novos", "info");
            runExplorerSearch({ sync: false });
        }

        function previewCategoryInExplorer() {
            const sel = document.getElementById("admin-cat-sync");
            const label = sel?.value
                ? String(sel.options[sel.selectedIndex]?.text || "").replace(/\s*\(\d+\)\s*$/, "").trim()
                : "";
            applyExplorerPreset("bestsellers");
            const matchEl = document.getElementById("admin-match-id");
            const shopEl = document.getElementById("admin-shop-id");
            if (matchEl) matchEl.value = "";
            if (shopEl) shopEl.value = "";
            if (label) {
                const kwEl = document.getElementById("admin-keyword");
                if (kwEl) kwEl.value = label;
                updateExplorerKwCount();
            }
            switchAdminView("catalogo-buscar", { tab: "palavras" });
            runExplorerSearch({ sync: false });
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
                                <button type="button" onclick="loadCategoryKeywordsToExplorer('${c.id}')" class="px-2 py-1 rounded bg-pink-50 text-pink-700 text-[10px] font-bold hover:bg-pink-100">Mostrar produtos</button>
                                <button type="button" onclick="document.getElementById('admin-cat-sync').value='${c.id}'; adminSyncCategory()" class="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold hover:bg-slate-700">Atualizar</button>
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
        initAdminUi, switchAdminView, toggleAdminSidebar, toggleMobileSidebar,
        setPreviewDevice, switchCatalogTab,
        submitAdminLogin, logoutAdmin, checkAdminSession,
        adminFetch, renderConsoleProducts, loadAdminStats,
        loadAutoStatus, loadShortlinkStatus, loadConversions,
        populateAdminCategorySelect, loadAdminCatalogFull,
    };
    // Expõe handlers usados por onclick no HTML do painel
    let _analyticsChart = null;
    let _analyticsPeriod = "-10080";
    let _chartJsLoaded = false;
    function ensureChartJs() {
        if (_chartJsLoaded || typeof Chart !== "undefined") { _chartJsLoaded = true; return Promise.resolve(); }
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
            s.onload = () => { _chartJsLoaded = true; resolve(); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    const DEVICE_LABELS = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet", other: "Outros" };
    const DEVICE_COLORS = { desktop: "#3b82f6", mobile: "#ee4d2d", tablet: "#8b5cf6", other: "#94a3b8" };
    const BROWSER_COLORS = ["#ee4d2d","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#6366f1","#94a3b8"];

    function analyticsBar(label, value, max, color, pct) {
        const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="min-width:70px;font-weight:600;font-size:12px;color:#0f172a">${label}</span>
            <div style="flex:1;height:22px;background:#f1f5f9;border-radius:6px;overflow:hidden;position:relative">
                <div style="height:100%;width:${w.toFixed(1)}%;background:${color};border-radius:6px;transition:width .3s"></div>
            </div>
            <span style="min-width:60px;text-align:right;font-size:11px;color:#64748b;font-weight:600">${pct} (${Number(value).toLocaleString("pt-BR")})</span>
        </div>`;
    }

    function statusChip(code, count, fmt) {
        const c = code.startsWith("2") ? "#10b981" : code.startsWith("3") ? "#3b82f6" : code.startsWith("4") ? "#f59e0b" : "#ef4444";
        return `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;background:${c}18;color:${c};border-radius:6px;font-weight:700;font-size:12px">${code} <span style="font-weight:400;opacity:.8">${fmt(count)}</span></span>`;
    }

    function refererLabel(host) {
        if (!host) return "Direto / sem referer";
        const h = host.toLowerCase();
        if (h.includes("facebook") || h.includes("fb.com") || h === "m.facebook.com") return "Facebook";
        if (h.includes("instagram")) return "Instagram";
        if (h.includes("google")) return "Google";
        if (h.includes("tiktok")) return "TikTok";
        if (h.includes("twitter") || h.includes("t.co")) return "Twitter / X";
        if (h.includes("whatsapp")) return "WhatsApp";
        if (h.includes("youtube")) return "YouTube";
        if (h.includes("bing")) return "Bing";
        return host;
    }

    const CACHE_LABELS = { hit: "Cache hit", miss: "Cache miss", dynamic: "Dinâmico", expired: "Expirado", stale: "Stale", bypass: "Bypass", revalidated: "Revalidado", none: "Sem cache", unknown: "Desconhecido" };
    const CACHE_COLORS = { hit: "#10b981", miss: "#ef4444", dynamic: "#3b82f6", expired: "#f59e0b", stale: "#8b5cf6", bypass: "#94a3b8", revalidated: "#06b6d4", none: "#cbd5e1" };

    async function loadAnalytics(since) {
        if (since) _analyticsPeriod = since;
        const s = _analyticsPeriod;
        const labels = { "-1440": "24h", "-10080": "7d", "-43200": "30d" };
        ["24h", "7d", "30d"].forEach(k => {
            const btn = document.getElementById("analytics-btn-" + k);
            if (!btn) return;
            const on = labels[s] === k;
            btn.className = on ? "btn-primary" : "btn-ghost";
        });
        const el = id => document.getElementById(id);
        const loading = "Carregando…";
        el("analytics-uniques").textContent = "…";
        el("analytics-visits").textContent = "…";
        el("analytics-pageviews").textContent = "…";
        el("analytics-requests").textContent = "…";
        el("analytics-bandwidth").textContent = "…";
        el("analytics-cache-rate").textContent = "…";
        el("analytics-countries").textContent = loading;
        el("analytics-devices").textContent = loading;
        el("analytics-browsers").textContent = loading;
        el("analytics-referrers").textContent = loading;
        el("analytics-traffic-split").textContent = loading;
        el("analytics-cache").textContent = loading;
        el("analytics-paths").textContent = loading;
        try {
            const res = await fetch(`/api/admin/analytics?since=${s}`, {
                headers: { Authorization: `Bearer ${getAdminToken()}` }
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Erro");
            const fmt = n => Number(n).toLocaleString("pt-BR");
            el("analytics-uniques").textContent   = fmt(data.summary.uniques);
            el("analytics-visits").textContent    = fmt(data.summary.visits || 0);
            el("analytics-pageviews").textContent  = fmt(data.summary.pageviews);
            el("analytics-requests").textContent   = fmt(data.summary.requests);
            el("analytics-bandwidth").textContent  = (data.summary.bandwidth / 1048576).toFixed(1);
            el("analytics-cache-rate").textContent = (data.summary.cacheHitRate != null ? data.summary.cacheHitRate + "%" : "—");

            const chartTitle = document.getElementById("analytics-chart-title");
            if (chartTitle) chartTitle.textContent = data.seriesGranularity === "hour" ? "Visitas por hora" : "Visitas por dia";

            const countries = Object.entries(data.summary.countries || {})
                .sort((a, b) => b[1] - a[1]).slice(0, 10);
            const cMax = countries.length ? countries[0][1] : 0;
            const cTotal = countries.reduce((s, [, n]) => s + n, 0) || 1;
            el("analytics-countries").innerHTML = countries.length
                ? countries.map(([c, n]) => analyticsBar(c, n, cMax, "#3b82f6", ((n / cTotal) * 100).toFixed(1) + "%")).join("")
                : "Sem dados";

            const devs = data.devices || [];
            const dTotal = devs.reduce((s, d) => s + d.requests, 0) || 1;
            const dMax = devs.length ? devs[0].requests : 0;
            el("analytics-devices").innerHTML = devs.length
                ? devs.map(d => {
                    const label = DEVICE_LABELS[d.device] || d.device;
                    const color = DEVICE_COLORS[d.device] || "#94a3b8";
                    return analyticsBar(label, d.requests, dMax, color, ((d.requests / dTotal) * 100).toFixed(1) + "%");
                }).join("")
                : "Sem dados";

            const bEntries = Object.entries(data.summary.browsers || {})
                .sort((a, b) => b[1] - a[1]).slice(0, 8);
            const bMax = bEntries.length ? bEntries[0][1] : 0;
            const bTotal = bEntries.reduce((s, [, n]) => s + n, 0) || 1;
            el("analytics-browsers").innerHTML = bEntries.length
                ? bEntries.map(([b, n], i) => analyticsBar(b, n, bMax, BROWSER_COLORS[i % BROWSER_COLORS.length], ((n / bTotal) * 100).toFixed(1) + "%")).join("")
                : "Sem dados";

            const refs = data.referrers || [];
            if (data.referrersUnavailable) {
                el("analytics-referrers").innerHTML = '<p style="color:#94a3b8;font-size:12px;line-height:1.5">Origem detalhada (referrer) não disponível no plano Free da Cloudflare. Para saber de qual anúncio veio o tráfego, use o Meta Events Manager.</p>';
            } else {
                const rMax = refs.length ? refs[0].requests : 0;
                const rTotal = refs.reduce((s, r) => s + r.requests, 0) || 1;
                el("analytics-referrers").innerHTML = refs.length
                    ? refs.slice(0, 10).map(r => analyticsBar(refererLabel(r.host), r.requests, rMax, "#6366f1", ((r.requests / rTotal) * 100).toFixed(1) + "%")).join("")
                    : "Sem dados de origem no período";
            }

            const split = data.trafficSplit || {};
            const splitTotal = (split.campaign || 0) + (split.vitrine || 0) + (split.other || 0) || 1;
            const splitMax = Math.max(split.campaign || 0, split.vitrine || 0, split.other || 0);
            el("analytics-traffic-split").innerHTML =
                analyticsBar("Campanhas (/p/*)", split.campaign || 0, splitMax, "#ee4d2d", (((split.campaign || 0) / splitTotal) * 100).toFixed(1) + "%") +
                analyticsBar("Vitrine", split.vitrine || 0, splitMax, "#3b82f6", (((split.vitrine || 0) / splitTotal) * 100).toFixed(1) + "%") +
                analyticsBar("Outros (API, assets)", split.other || 0, splitMax, "#94a3b8", (((split.other || 0) / splitTotal) * 100).toFixed(1) + "%");

            const cacheItems = data.cache || [];
            const cacheMax = cacheItems.length ? cacheItems[0].requests : 0;
            const cacheTotalReq = cacheItems.reduce((s, c) => s + c.requests, 0) || 1;
            el("analytics-cache").innerHTML = cacheItems.length
                ? cacheItems.map(c => {
                    const label = CACHE_LABELS[c.status] || c.status;
                    const color = CACHE_COLORS[c.status] || "#94a3b8";
                    return analyticsBar(label, c.requests, cacheMax, color, ((c.requests / cacheTotalReq) * 100).toFixed(1) + "%");
                }).join("")
                : "Sem dados";

            const paths = data.topPaths || [];
            const pTotal = paths.reduce((s, p) => s + p.requests, 0) || 1;
            if (paths.length) {
                let html = '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid #e2e8f0">';
                html += '<th style="text-align:left;padding:6px 8px;font-size:11px;font-weight:700;color:#475569">Página</th>';
                html += '<th style="text-align:right;padding:6px 8px;font-size:11px;font-weight:700;color:#475569">Acessos</th>';
                html += '<th style="text-align:right;padding:6px 8px;font-size:11px;font-weight:700;color:#475569">%</th>';
                html += '</tr></thead><tbody>';
                for (const p of paths) {
                    html += `<tr style="border-bottom:1px solid #f1f5f9">`;
                    html += `<td style="padding:6px 8px;font-size:12px;font-weight:500;color:#0f172a;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.path}">${p.path}</td>`;
                    html += `<td style="text-align:right;padding:6px 8px;font-size:12px;color:#475569;font-weight:600">${fmt(p.requests)}</td>`;
                    html += `<td style="text-align:right;padding:6px 8px;font-size:12px;color:#94a3b8">${((p.requests / pTotal) * 100).toFixed(1)}%</td>`;
                    html += '</tr>';
                }
                html += '</tbody></table>';
                el("analytics-paths").innerHTML = html;
            } else {
                el("analytics-paths").textContent = "Sem dados";
            }

            renderAnalyticsChart(data.series || [], data.seriesGranularity);
        } catch (err) {
            el("analytics-uniques").textContent = "—";
            el("analytics-visits").textContent = "—";
            el("analytics-pageviews").textContent = "—";
            el("analytics-requests").textContent = "—";
            el("analytics-bandwidth").textContent = "—";
            el("analytics-cache-rate").textContent = "—";
            ["analytics-countries","analytics-devices","analytics-browsers","analytics-referrers","analytics-traffic-split","analytics-cache","analytics-paths"]
                .forEach(id => { const n = el(id); if (n) n.textContent = err.message; });
        }
    }

    async function renderAnalyticsChart(series, granularity) {
        const canvas = document.getElementById("analytics-canvas");
        if (!canvas) return;
        const wrap = canvas.parentElement;
        if (wrap) { wrap.style.height = "140px"; wrap.style.maxHeight = "140px"; }
        canvas.style.height = "140px";
        canvas.style.maxHeight = "140px";
        const ctx = canvas.getContext("2d");
        if (_analyticsChart && typeof _analyticsChart.destroy === "function") _analyticsChart.destroy();

        try { await ensureChartJs(); } catch (_) {}

        if (typeof Chart !== "undefined") {
            const labels = series.map(t => {
                const d = new Date(t.since);
                if (granularity === "hour") {
                    return `${String(d.getHours()).padStart(2,"0")}h`;
                }
                return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
            });
            _analyticsChart = new Chart(ctx, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        { label: "Visitas únicas", data: series.map(t => t.uniques), backgroundColor: "#ee4d2d", borderRadius: 4 },
                        { label: "Pageviews",      data: series.map(t => t.pageviews), backgroundColor: "#fbbf24", borderRadius: 4 },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
                    scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }
                }
            });
            return;
        }

        const maxVal = Math.max(1, ...series.map(t => t.uniques));
        const barW = Math.max(6, Math.floor((canvas.width - 40) / Math.max(series.length, 1)) - 4);
        const h = canvas.height - 30;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        series.forEach((t, i) => {
            const bh = Math.max(1, (t.uniques / maxVal) * h);
            const x = 30 + i * (barW + 4);
            ctx.fillStyle = "#ee4d2d";
            ctx.fillRect(x, h - bh + 10, barW, bh);
            if (series.length <= 31) {
                ctx.fillStyle = "#94a3b8";
                ctx.font = "9px sans-serif";
                ctx.textAlign = "center";
                const d = new Date(t.since);
                ctx.fillText(`${d.getDate()}/${d.getMonth()+1}`, x + barW / 2, h + 24);
            }
        });
    }

    const exposeMap = {
        switchAdminView, toggleAdminSidebar, toggleMobileSidebar, setPreviewDevice,
        switchCatalogTab, switchCatalogoBuscarTab,
        setExplorerScanMode, updateExplorerMassHint, addExplorerKeyword,
        updateExplorerKwCount, updateExplorerModeHint,
        renderExplorerKeywordChips, removeExplorerKeyword, onExplorerKeywordKey,
        resetExplorerForm, runCoverageShortcut, showMoneyQueueShortcut,
        loadTopAffiliateShops, moneyQueueCopyAdLink, moneyQueueCopyShopeeLink,
        submitAdminLogin, logoutAdmin,
        syncAllCategories, syncCategory, applyExplorerPreset, runExplorerSearch,
        saveExplorerSelection, cancelExplorerSearch, toggleExplorerSelectAll, onExplorerItemToggle,
        saveCurrentCampaign, deleteSavedCampaign, loadSavedCampaignIntoEditor, copyCampaignLink,
        copySavedCampaignLinks, regenerateCampaignShortlinks, regenerateAllCampaignShortlinks,
        addProductToCampaign, removeProductFromCampaign, addCampaignProductById,
        convertCampaignProduct, obterCampaignLink, renameSavedCampaign, renderSavedCampaignsList,
        onCampaignSavedSearch, setCampaignSavedPage,
        pickCampaignCatalogProduct, resetCampaignForm,
        renderCampaignProductPicker, resolveCampaignProductById, clearCampaignProductSearch,
        repairCampaignProduct, ensureCampaignProduct, repairMissingCampaignAffiliates,
        onCampaignProductSearchKey, syncSavedCampaigns,
        generateCampaignShopeeLinks, copyCampaignShopeeLinks,
        updateCampaignLinkPreview, updateSubIdPreview, loadCampaignPerformance, openCampaignPerfDetail,
        closeCampaignPerfDetail, openCampaignPerfByName, loadCampaignFunnel, renderCampaignFunnel,
        onCampPerfSearch, setCampPerfListPage, switchCampPerfTab, setCampPerfSalesFilter,
        setCampPerfProdSearch, setCampPerfProdPage, loadMeuSiteSummary, loadFinanceiro, pullConversionsNow,
        reprocessSubIdsDry, reprocessSubIdsRun, runFeed, runRefreshMetrics,
        loadFeedInventory, loadShopeeHealth, loadValidatedReport,
        previewFeed, lookupConversion, loadDashboardSales,
        loadConversions, previousConversionPage, nextConversionPage,
        setConversionStatusFilter, onConversionSearch, onConversionPageSizeChange, goToConversionPage,
        onAdminSearch, onAdminFiltersChange, onAdminPageSizeChange, clearAdminFilters,
        toggleAdminProductSelect, toggleSelectAdminPage, selectAllFilteredProducts, clearAdminProductSelection,
        addSelectedProductsToCampaign, adminPrevPage, adminNextPage, removeProductFromDatabase,
        updateSingleAffiliateLink, openNewProductForm, closeNewProductForm, saveNewProduct,
        runShortlinkBackfill, runAutoSyncNow, runTopPerformanceNow, adminSyncCategory,
        loadOfficialShopeeOffers, useOfficialInExplorer, importOfficialShopeeOffers,
        loadAffiliateShops, previewShopInExplorer, previewCategoryInExplorer,
        toggleCatalogoSubmenu,
        loadCoverageReport, runCoverageFill, scanCatalogDuplicates, removeCatalogDuplicates,
        scanWeakOffers, purgeWeakOffers, refreshTopOffers, prioritizeConversionWinners,
        loadConversionSummary, moneyQueueFind, moneyQueueMakeShortlink, moneyQueueCopyLink,
        moneyQueueToExplorer, moneyQueueShortlinkTop, loadCategoryKeywordsToExplorer,
        resetVitrineAndRefill, loadAdminCatalogFull, syncDefaultKeywords, fetchLiveOffers,
        populateAdminCategorySelect, renderAdminCategoriesPanel, renderConsoleProducts,
        loadAdminStats, loadAutoStatus, loadShortlinkStatus,
        loadAnalytics,
    };
    for (const [k, v] of Object.entries(exposeMap)) {
        if (typeof v === "function") window[k] = v;
    }
    // Espelha no __AM_ADMIN tudo que o boot da vitrine chama via window.*
    Object.assign(window.__AM_ADMIN, Object.fromEntries(
        Object.entries(exposeMap).filter(([, v]) => typeof v === "function")
    ));
})();

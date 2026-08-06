
        // Backend local: npm start → http://localhost:3789
        // Mesma origem quando servido por um servidor (local ou Vercel).
        // Só usa localhost quando o arquivo é aberto direto (file://).
        const API_BASE = (location.protocol === "http:" || location.protocol === "https:")
            ? ""
            : (localStorage.getItem("afiliado_mestre_api_base") || "http://localhost:3789");
        let apiLive = false;
        let lastApiSource = "mock";
        let currentPage = 0;
        // Mobile carrega menos cards na 1ª tela (menos HTML + fotos disputando 4G).
        const PAGE_SIZE = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 640px)").matches)
            ? 24
            : 36;
        let hasMore = false;
        let loadingMore = false;
        let offersAbort = null;
        let storeSortRequestId = 0;
        let infiniteScrollPausedUntil = 0;

        // Core Products Mock database (fallback se o backend/Shopee estiver offline)
        const defaultProducts = [
            {
                id: 1,
                title: "Mini Projetor Portátil Smart HY300 Android 11",
                category: "eletronicos",
                oldPrice: 599.00,
                newPrice: 289.90,
                discount: "51%",
                stars: 4.9,
                reviews: 243,
                sales: "1.4k vendidos",
                image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-hy300",
                isFlashSale: true,
                flashStock: 82,
                commissionRate: "8.5%",
                sellerCommission: "R$ 14,50",
                shopeeCommission: "R$ 10,14",
                totalCommission: "R$ 24,64",
                desc: "Assista a séries e filmes favoritos em qualquer parede de casa! Qualidade nativa 720p, conexão Wi-Fi, Bluetooth e sistema Android integrado para baixar apps de streaming diretamente no projetor."
            },
            {
                id: 2,
                title: "Fone de Ouvido Sem Fio Bluetooth In-Ear 5.3 Premium",
                category: "eletronicos",
                oldPrice: 129.90,
                newPrice: 47.90,
                discount: "63%",
                stars: 4.8,
                reviews: 1420,
                sales: "4.9k vendidos",
                image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-fone-tws",
                isFlashSale: true,
                flashStock: 65,
                commissionRate: "12.0%",
                sellerCommission: "R$ 3,20",
                shopeeCommission: "R$ 2,54",
                totalCommission: "R$ 5,74",
                desc: "Diga adeus aos cabos que embolam. Conexão super estável Bluetooth 5.3, som cristalino estéreo com graves envolventes e bateria que dura até 6 horas de uso contínuo + estojo de carregamento com display LED digital."
            },
            {
                id: 3,
                title: "Umidificador Difusor de Aromas Portátil USB Madeira Nobre",
                category: "casa",
                oldPrice: 89.90,
                newPrice: 29.99,
                discount: "66%",
                stars: 4.7,
                reviews: 875,
                sales: "2.3k vendidos",
                image: "https://images.unsplash.com/photo-1602928321679-560bb453f190?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-difusor",
                isFlashSale: true,
                flashStock: 91,
                commissionRate: "15.0%",
                sellerCommission: "R$ 2,80",
                shopeeCommission: "R$ 1,69",
                totalCommission: "R$ 4,49",
                desc: "Deixe seu quarto com cheirinho de hotel 5 estrelas. Design elegante imitando madeira nobre, possui luzes de LED decorativas de cores suaves que mudam sozinhas e funciona via USB silenciosamente."
            },
            {
                id: 4,
                title: "Mini Processador Picador de Alimentos Recarregável Sem Fio",
                category: "casa",
                oldPrice: 69.90,
                newPrice: 24.50,
                discount: "64%",
                stars: 4.5,
                reviews: 312,
                sales: "1.1k vendidos",
                image: "https://images.unsplash.com/photo-1574269661126-7e45799919b2?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-processador",
                isFlashSale: true,
                flashStock: 35,
                commissionRate: "10.0%",
                sellerCommission: "R$ 1,45",
                shopeeCommission: "R$ 1,00",
                totalCommission: "R$ 2,45",
                desc: "Pique alho, cebola, vegetais e temperos com apenas 1 clique! Três lâminas super afiadas de aço inoxidável e bateria recarregável via USB. Praticidade absoluta no preparo das refeições."
            },
            {
                id: 5,
                title: "Suporte Organizador de Acrílico Giratório 360 Graus para Cosméticos",
                category: "beleza",
                oldPrice: 159.00,
                newPrice: 54.90,
                discount: "65%",
                stars: 4.9,
                reviews: 184,
                sales: "650 vendidos",
                image: "https://images.unsplash.com/photo-1616763355548-1b606f439f86?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-suporte",
                isFlashSale: false,
                commissionRate: "8.0%",
                sellerCommission: "R$ 2,90",
                shopeeCommission: "R$ 1,49",
                totalCommission: "R$ 4,39",
                desc: "A melhor solução para arrumar suas makes e skincare. Gira 360 graus suavemente, permitindo acesso rápido a todos os cosméticos. Alturas ajustáveis para caber frascos de todos os tamanhos."
            },
            {
                id: 6,
                title: "Garrafa Térmica Inteligente Inox com Sensor de Temperatura Digital",
                category: "utilidades",
                oldPrice: 119.00,
                newPrice: 39.90,
                discount: "66%",
                stars: 4.6,
                reviews: 934,
                sales: "2.1k vendidos",
                image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-garrafa-led",
                isFlashSale: false,
                commissionRate: "9.5%",
                sellerCommission: "R$ 2,50",
                shopeeCommission: "R$ 1,29",
                totalCommission: "R$ 3,79",
                desc: "Saiba a temperatura exata do seu café ou água gelada com um leve toque na tampa. Tela touch de LED embutida, isolamento a vácuo duradouro para manter a bebida na temperatura ideal por até 12 horas."
            },
            {
                id: 7,
                title: "Kit 12 Pincéis de Maquiagem Profissional Super Macios + Estojo Luxo",
                category: "beleza",
                oldPrice: 99.00,
                newPrice: 35.90,
                discount: "63%",
                stars: 4.8,
                reviews: 410,
                sales: "950 vendidos",
                image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-pinceis",
                isFlashSale: false,
                commissionRate: "12.0%",
                sellerCommission: "R$ 2,80",
                shopeeCommission: "R$ 1,50",
                totalCommission: "R$ 4,30",
                desc: "Aplicação perfeita e esfumado profissional garantido com cerdas macias sintéticas hipoalergênicas. O conjunto inclui todos os pincéis fundamentais para preparação de pele e maquiagem dos olhos com precisão."
            },
            {
                id: 8,
                title: "Mini Aspirador Portátil Recarregável de Alta Potência 120W",
                category: "automotivo",
                oldPrice: 149.90,
                newPrice: 48.90,
                discount: "67%",
                stars: 4.4,
                reviews: 580,
                sales: "1.2k vendidos",
                image: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=400",
                affiliateLink: "https://shope.ee/mestre-aspirador",
                isFlashSale: false,
                commissionRate: "11.0%",
                sellerCommission: "R$ 3,10",
                shopeeCommission: "R$ 2,27",
                totalCommission: "R$ 5,37",
                desc: "Mantenha o estofado do carro, o teclado do notebook ou os cantos do sofá sempre limpos. Leve, compacto e sem fios. Acompanha bicos adaptadores para alcançar qualquer fresta difícil de limpar."
            }
        ];

        // App Core State
        let productsDatabase = [];
        let currentStoreCategory = 'todos';
        let currentStoreSubcategory = '';
        let currentStoreSort = 'money';
        let activeProductForBuy = null;
        let flashEndsAt = null;
        let categoryProductsCache = [];

        // Categories Map — carregado dinâmicamente de /api/categorias (com fallback)
        // Fallback local com as mesmas subcategorias do server/categorias.js —
        // garante navegação por subcategoria mesmo antes da API responder.
        let categories = [
            { id: 'todos', label: 'Tudo', icon: 'fa-border-all', color: 'orange', count: 0 },
            { id: 'moda', label: 'Moda Feminina', icon: 'fa-tshirt', color: 'pink', count: 0, subcategories: [
                { id: 'vestidos', label: 'Vestidos & Saias', count: 0 },
                { id: 'calcas', label: 'Calças & Leggings', count: 0 },
                { id: 'tops', label: 'Tops & Blusas', count: 0 },
                { id: 'calcados', label: 'Calçados', count: 0 },
                { id: 'bolsas', label: 'Bolsas', count: 0 },
                { id: 'praia', label: 'Moda Praia', count: 0 },
                { id: 'plus_size', label: 'Plus Size', count: 0 },
                { id: 'lingerie', label: 'Lingerie', count: 0 },
                { id: 'moda_fria', label: 'Moda Fria', count: 0 },
                { id: 'casa_moda', label: 'Pijamas & Casa', count: 0 }
            ] },
            { id: 'beleza', label: 'Beleza', icon: 'fa-spa', color: 'purple', count: 0, subcategories: [
                { id: 'pele', label: 'Skincare', count: 0 },
                { id: 'maquiagem', label: 'Maquiagem', count: 0 },
                { id: 'cabelo', label: 'Cabelo', count: 0 },
                { id: 'perfumes', label: 'Perfumes', count: 0 },
                { id: 'unhas', label: 'Unhas', count: 0 },
                { id: 'acessorios_beleza', label: 'Acessórios de Beleza', count: 0 }
            ] },
            { id: 'acessorios', label: 'Acessórios', icon: 'fa-clock', color: 'yellow', count: 0, subcategories: [
                { id: 'joias', label: 'Joias', count: 0 },
                { id: 'relogios', label: 'Relógios', count: 0 },
                { id: 'oculos', label: 'Óculos', count: 0 },
                { id: 'bolsas_acessorios', label: 'Bolsas & Carteiras', count: 0 },
                { id: 'cabelo_acessorios', label: 'Cabelo', count: 0 },
                { id: 'outros', label: 'Outros', count: 0 }
            ] },
            { id: 'fitness', label: 'Fitness', icon: 'fa-dumbbell', color: 'emerald', count: 0, subcategories: [
                { id: 'roupa_fitness', label: 'Roupas', count: 0 },
                { id: 'equipamentos', label: 'Equipamentos', count: 0 },
                { id: 'bem_estar', label: 'Bem-estar', count: 0 }
            ] },
            { id: 'maternidade', label: 'Mãe & Bebê', icon: 'fa-baby', color: 'rose', count: 0, subcategories: [
                { id: 'bebe_menina', label: 'Bebê Menina', count: 0 },
                { id: 'maternidade_roupa', label: 'Gestante', count: 0 },
                { id: 'higiene_bebe', label: 'Higiene Bebê', count: 0 },
                { id: 'enxoval', label: 'Enxoval', count: 0 }
            ] },
            { id: 'saude', label: 'Saúde & Bem-estar', icon: 'fa-heart-pulse', color: 'rose', count: 0, subcategories: [
                { id: 'suplementos', label: 'Suplementos', count: 0 },
                { id: 'cuidado_pessoal', label: 'Cuidado Pessoal', count: 0 },
                { id: 'higiene_intima', label: 'Higiene Íntima', count: 0 }
            ] },
            { id: 'casa', label: 'Casa', icon: 'fa-couch', color: 'amber', count: 0, subcategories: [
                { id: 'cozinha', label: 'Cozinha', count: 0 },
                { id: 'decoracao', label: 'Decoração', count: 0 },
                { id: 'organizacao', label: 'Organização', count: 0 },
                { id: 'limpeza', label: 'Limpeza & Clima', count: 0 }
            ] },
            { id: 'celular', label: 'Celular', icon: 'fa-mobile-alt', color: 'cyan', count: 0, subcategories: [
                { id: 'protecao', label: 'Proteção', count: 0 },
                { id: 'energia', label: 'Energia & Cabos', count: 0 },
                { id: 'acessorios_cel', label: 'Acessórios', count: 0 }
            ] },
            { id: 'eletronicos', label: 'Eletrônicos', icon: 'fa-laptop', color: 'blue', count: 0, subcategories: [
                { id: 'audio', label: 'Áudio', count: 0 },
                { id: 'wearables', label: 'Relógios & Wearables', count: 0 },
                { id: 'informatica', label: 'Informática', count: 0 },
                { id: 'video', label: 'Vídeo & Projeção', count: 0 },
                { id: 'smart_home', label: 'Casa Inteligente', count: 0 }
            ] },
            { id: 'pet', label: 'Pet Shop', icon: 'fa-paw', color: 'orange', count: 0, subcategories: [
                { id: 'gatos', label: 'Gatos', count: 0 },
                { id: 'caes', label: 'Cães', count: 0 },
                { id: 'acessorios_pet', label: 'Acessórios Pet', count: 0 }
            ] },
            { id: 'infantil', label: 'Infantil', icon: 'fa-child', color: 'indigo', count: 0, subcategories: [
                { id: 'brinquedos', label: 'Brinquedos', count: 0 },
                { id: 'roupa_infantil', label: 'Roupas & Calçados', count: 0 },
                { id: 'escola', label: 'Escola', count: 0 }
            ] },
            { id: 'presentes', label: 'Presentes & Papelaria', icon: 'fa-gift', color: 'fuchsia', count: 0, subcategories: [
                { id: 'papelaria', label: 'Papelaria Aesthetic', count: 0 },
                { id: 'presentes_fem', label: 'Presentes', count: 0 },
                { id: 'viagem', label: 'Viagem', count: 0 }
            ] },
            { id: 'utilidades', label: 'Utilidades', icon: 'fa-tools', color: 'teal', count: 0, subcategories: [
                { id: 'ferramentas', label: 'Ferramentas', count: 0 },
                { id: 'dia_a_dia', label: 'Dia a dia', count: 0 },
                { id: 'organizacao_util', label: 'Organização', count: 0 }
            ] },
            { id: 'automotivo', label: 'Automotivo', icon: 'fa-car', color: 'slate', count: 0, subcategories: [
                { id: 'limpeza_auto', label: 'Limpeza', count: 0 },
                { id: 'tecnologia_auto', label: 'Tecnologia', count: 0 },
                { id: 'conforto_auto', label: 'Conforto', count: 0 }
            ] }
        ];

        let currentNavSection = "destaque";


        // Mantido por compatibilidade com código antigo; nunca mais abre prompt.

        function formatSold(n) {
            const raw = n;
            if (typeof n === "string") {
                const cleaned = n.replace(/vendid[oa]s?/gi, "").trim();
                if (/mil/i.test(cleaned) || /k\b/i.test(cleaned)) return cleaned.includes("vendid") ? cleaned : `${cleaned} vendidos`;
                n = Number(cleaned.replace(/[^\d.,]/g, "").replace(",", "."));
            }
            if (n == null || n === "" || (typeof n === "number" && !Number.isFinite(n))) {
                return raw && String(raw).trim() ? String(raw) : null;
            }
            if (n < 1000) return `${Math.round(n)} vendidos`;
            if (n < 10000) return `${(n / 1000).toFixed(1).replace(".", ",")} mil vendidos`;
            if (n < 1000000) return `${Math.floor(n / 1000)}mil+ vendidos`;
            return `${(n / 1000000).toFixed(1).replace(".", ",")}mi+ vendidos`;
        }
        function formatRating(r) {
            const n = Number(r);
            if (!Number.isFinite(n) || n <= 0) return null;
            return n.toFixed(1);
        }
        function displayDiscount(p) {
            let raw = Number(p?.discountPct);
            if (!Number.isFinite(raw) || raw <= 0) {
                raw = parseInt(String(p?.discount || "0").replace("%", ""), 10) || 0;
            }
            if (raw < 5) return 0;
            return Math.min(raw, 85);
        }
        function cleanShopName(name) {
            if (!name || typeof name !== "string") return null;
            const trimmed = name.trim();
            if (trimmed.length < 4) return null;
            if (/^[a-z]{2}\s/i.test(trimmed) && trimmed.length < 20) return null;
            if (/^cc\b/i.test(trimmed)) return null;
            return trimmed;
        }
        function isOfficialShop(shopType) {
            if (shopType == null || shopType === "") return false;
            if (typeof shopType === "string") return /SHOPEE_MALL|MALL|1/i.test(shopType);
            return Number(shopType) === 1;
        }
        function formatCountBadge(count) {
            const n = Number(count) || 0;
            if (n <= 0) return "";
            if (n >= 100) return "99+";
            return String(n);
        }

        function pathClean() {
            return (window.location.pathname.replace(/\/+$/, "") || "/");
        }

        function isAdminMode() {
            const path = pathClean();
            if (path === "/admin" || path.startsWith("/admin/")) return true;
            const params = new URLSearchParams(window.location.search);
            return params.has("admin") || params.get("mode") === "admin";
        }

        function navigateTo(path, { replace = false } = {}) {
            const next = path.startsWith("/") ? path : `/${path}`;
            if (replace) history.replaceState({ path: next }, "", next);
            else history.pushState({ path: next }, "", next);
            applyRoute({ fromNav: true });
        }





        async function applyRoute(opts = {}) {
            const params = new URLSearchParams(window.location.search);
            if ((params.has("admin") || params.get("mode") === "admin") && !pathClean().startsWith("/admin")) {
                const hash = (window.location.hash || "").replace("#", "");
                const view = hash || params.get("view") || "dashboard";
                history.replaceState(null, "", `/admin/${view === "dashboard" ? "" : view}`.replace(/\/$/, "") || "/admin");
            }

            if (isAdminMode()) {
                try { await loadAdminBundle(); } catch (e) { console.error("[admin]", e); }
                if (typeof window.initAdminUi === "function") await window.initAdminUi();
                return;
            }

            document.body.classList.remove("admin-mode");
            const panel = document.getElementById("admin-panel-root");
            if (panel) {
                panel.classList.add("hidden");
                panel.classList.remove("flex");
            }
            document.title = "Afiliada Mestre — Ofertas selecionadas na Shopee";

            const path = pathClean();
            const parts = path.split("/").filter(Boolean);

            if (parts[0] === "categoria") {
                const catId = parts[1] || "todos";
                const subId = parts[2] || "";
                currentNavSection = "category_page";
                if (catId === "todos" || !catId) {
                    await setStoreCategory("todos", { skipUrl: true });
                } else {
                    await setStoreCategory(catId, { skipUrl: true });
                    if (subId) await setStoreSubcategory(subId, { skipUrl: true });
                }
                scrollToStoreGrid();
                return;
            }

            const sectionMap = {
                relampago: { sort: "ending", section: "flash_deals", scroll: "flash" },
                "mais-vendidos": { sort: "sales", section: "top_sellers" },
                "maiores-descontos": { sort: "discount", section: "big_discounts" },
                "melhor-avaliados": { sort: "rating", section: "top_rated" },
                "lojas-oficiais": { sort: "recent", section: "official_shops", filterOfficial: true },
            };
            if (sectionMap[parts[0]]) {
                const cfg = sectionMap[parts[0]];
                currentNavSection = cfg.section;
                currentStoreCategory = "todos";
                currentStoreSubcategory = "";
                if (cfg.sort) setStoreSort(cfg.sort, { skipUrl: true });
                window.__filterOfficialOnly = !!cfg.filterOfficial;
                renderStoreProducts();
                renderHomeSections();
                if (cfg.scroll === "flash") scrollToFlashSale();
                else scrollToStoreGrid();
                return;
            }

            window.__filterOfficialOnly = false;
            currentNavSection = "destaque";
            if (opts.fromNav && path === "/") {
                currentStoreCategory = "todos";
                currentStoreSubcategory = "";
                renderCategories();
                renderSubcategories();
                renderStoreProducts();
                renderHomeSections();
            }
        }

        // Ícones inválidos / Pro-only / nomes antigos → equivalentes Free do FA6
        const ICON_FIXES = {
            "fa-sparkles": "fa-wand-magic-sparkles",
            "fa-check-shield": "fa-shield-halved",
            "fa-chart-line-up": "fa-chart-line",
            "fa-arrow-pointer": "fa-mouse-pointer",
            "fa-external-link": "fa-arrow-up-right-from-square",
            "fa-tshirt": "fa-shirt",
            "fa-mobile-alt": "fa-mobile-screen-button",
            "fa-tools": "fa-toolbox",
            "fa-child": "fa-child-reaching",
            "fa-cut": "fa-scissors",
        };

        // Ícone oficial de cada categoria (sobrepõe o que vier da API/cache antigo).
        const CATEGORY_ICONS = {
            todos: "fa-grip",
            moda: "fa-shirt",
            beleza: "fa-spa",
            acessorios: "fa-gem",
            fitness: "fa-dumbbell",
            maternidade: "fa-baby",
            saude: "fa-heart-pulse",
            casa: "fa-couch",
            celular: "fa-mobile-screen-button",
            eletronicos: "fa-laptop",
            pet: "fa-paw",
            infantil: "fa-child-reaching",
            presentes: "fa-gift",
            utilidades: "fa-toolbox",
            automotivo: "fa-car",
        };

        // Cada subcategoria tem símbolo próprio — evita o placeholder genérico de imagem.
        const SUBCATEGORY_ICONS = {
            moda: {
                vestidos: "fa-person-dress",
                calcas: "fa-person-walking",
                tops: "fa-shirt",
                calcados: "fa-shoe-prints",
                bolsas: "fa-bag-shopping",
                praia: "fa-umbrella-beach",
                plus_size: "fa-user-group",
                lingerie: "fa-heart",
                moda_fria: "fa-snowflake",
                casa_moda: "fa-moon",
            },
            beleza: {
                pele: "fa-droplet",
                maquiagem: "fa-wand-magic-sparkles",
                cabelo: "fa-scissors",
                perfumes: "fa-spray-can-sparkles",
                unhas: "fa-hand-sparkles",
                acessorios_beleza: "fa-brush",
            },
            acessorios: {
                joias: "fa-ring",
                relogios: "fa-clock",
                oculos: "fa-glasses",
                bolsas_acessorios: "fa-wallet",
                cabelo_acessorios: "fa-ribbon",
                outros: "fa-shapes",
            },
            fitness: {
                roupa_fitness: "fa-person-running",
                equipamentos: "fa-dumbbell",
                bem_estar: "fa-leaf",
            },
            maternidade: {
                bebe_menina: "fa-baby",
                maternidade_roupa: "fa-person-pregnant",
                higiene_bebe: "fa-pump-soap",
                enxoval: "fa-baby-carriage",
            },
            saude: {
                suplementos: "fa-pills",
                cuidado_pessoal: "fa-hand-holding-heart",
                higiene_intima: "fa-shield-heart",
            },
            casa: {
                cozinha: "fa-utensils",
                decoracao: "fa-palette",
                organizacao: "fa-boxes-stacked",
                limpeza: "fa-broom",
            },
            celular: {
                protecao: "fa-shield-halved",
                energia: "fa-plug",
                acessorios_cel: "fa-camera",
            },
            eletronicos: {
                audio: "fa-headphones",
                wearables: "fa-stopwatch",
                informatica: "fa-keyboard",
                video: "fa-video",
                smart_home: "fa-house-signal",
            },
            pet: {
                gatos: "fa-cat",
                caes: "fa-dog",
                acessorios_pet: "fa-bone",
            },
            infantil: {
                brinquedos: "fa-puzzle-piece",
                roupa_infantil: "fa-child-dress",
                escola: "fa-school",
            },
            presentes: {
                papelaria: "fa-pen-fancy",
                presentes_fem: "fa-box-open",
                viagem: "fa-suitcase-rolling",
            },
            utilidades: {
                ferramentas: "fa-screwdriver-wrench",
                dia_a_dia: "fa-bottle-water",
                organizacao_util: "fa-box-archive",
            },
            automotivo: {
                limpeza_auto: "fa-spray-can",
                tecnologia_auto: "fa-gauge-high",
                conforto_auto: "fa-car-side",
            },
        };

        function normalizeCategoryIcon(icon) {
            const raw = String(icon || "fa-tag").replace(/^fas\s+/, "");
            return ICON_FIXES[raw] || raw;
        }

        function categoryIconClass(cat) {
            const id = typeof cat === "string" ? cat : cat?.id;
            return CATEGORY_ICONS[id] || normalizeCategoryIcon(cat?.icon);
        }

        // Sem subId (tile "Todas"/"Ver tudo") mostra o ícone da própria categoria.
        function subcategoryIconClass(catId, subId) {
            if (!subId) return categoryIconClass(catId);
            return SUBCATEGORY_ICONS[catId]?.[subId] || categoryIconClass(catId);
        }

        // DOMContentLoaded (não window.onload): não espera fontes/imagens do CDN
        // antes de buscar ofertas — corta ~0,5–2s no mobile.
        async function bootStorefront() {
            captureTrafficAttribution();
            window.addEventListener("popstate", () => applyRoute({ fromNav: true }));
            initDatabase();
            initCountdown();
            renderCategories();
            renderSubcategories();
            renderStoreProducts();
            renderPopularTerms();
            // Hero com o que já está no cache local — sem 2º fetch ainda.
            loadHeroProducts({ fromCacheOnly: true });

            const admin = isAdminMode();
            if (admin) {
                try { await loadAdminBundle(); } catch (e) { console.error("[admin]", e); }
                if (typeof window.initAdminUi === "function") await window.initAdminUi();
                if (typeof window.renderConsoleProducts === "function") window.renderConsoleProducts();
                if (typeof window.populateAdminCategorySelect === "function") window.populateAdminCategorySelect();
                if (typeof window.loadAdminStats === "function") window.loadAdminStats();
                if (typeof window.loadAutoStatus === "function") window.loadAutoStatus();
                if (typeof window.loadShortlinkStatus === "function") window.loadShortlinkStatus();
                if (typeof window.loadConversions === "function") window.loadConversions({ reset: true });
            }

            const health = await checkApiHealth();
            if (health && health.supabaseConfigured) {
                if (admin) {
                    await Promise.all([
                        loadCategoriesFromApi({ silent: true }),
                        typeof window.loadAdminCatalogFull === "function"
                            ? window.loadAdminCatalogFull({ silent: true })
                            : Promise.resolve(),
                    ]);
                } else {
                    // Categorias + ofertas em paralelo (antes era sequencial).
                    await Promise.all([
                        loadCategoriesFromApi({ silent: true }),
                        loadOffersFromSupabase({ silent: true, reset: true }),
                    ]);
                    loadHeroProducts({ fromCacheOnly: true });
                    scheduleHomeSections();
                    preloadCategoryCovers();
                }
            } else if (admin) {
                showToast("Backend offline — rode: npm start", "error");
            }
            await applyRoute({ fromNav: false });
            await applyCampaignLanding();
        }

        function scheduleHomeSections() {
            const run = () => renderHomeSections();
            if (typeof requestIdleCallback === "function") {
                requestIdleCallback(run, { timeout: 1200 });
            } else {
                setTimeout(run, 200);
            }
        }

        function setApiStatus(text, live) {
            apiLive = !!live;
            const short = live ? "API online" : "API offline";
            for (const id of ["api-status-badge", "admin-api-badge"]) {
                const el = document.getElementById(id);
                if (el) el.textContent = id === "admin-api-badge" ? short : text;
            }
        }

        async function checkApiHealth() {
            try {
                const res = await fetch(`${API_BASE}/api/health`);
                const data = await res.json();
                if (!res.ok) throw new Error("health fail");
                const ok = data.shopeeConfigured && data.supabaseConfigured;
                setApiStatus(
                    ok ? "API Status: Shopee + Supabase OK" : "API Status: backend up (verifique .env)",
                    true
                );
                return data;
            } catch (e) {
                setApiStatus("API Status: Simulação / backend offline", false);
                return null;
            }
        }

        // Coalesce re-renders de categorias/subcategorias/termos populares:
        // cargas em lote (append por página) disparavam 3 rebuilds de innerHTML
        // por chamada; agora agrupamos num único render após a rajada.
        let chromeRenderTimer = null;
        function scheduleChromeRender() {
            clearTimeout(chromeRenderTimer);
            chromeRenderTimer = setTimeout(() => {
                renderCategories();
                renderSubcategories();
                renderPopularTerms();
            }, 150);
        }

        function applyProducts(list, source, { append = false, allowEmpty = false, skipRender = false } = {}) {
            if (!Array.isArray(list)) return false;
            if (append) {
                const map = new Map(productsDatabase.map(p => [String(p.id), p]));
                for (const p of list) map.set(String(p.id), p);
                productsDatabase = [...map.values()];
            } else {
                if (!list.length && !allowEmpty) return false;
                productsDatabase = list;
            }
            lastApiSource = source || "api";
            // Limita cache local na vitrine pública (mobile/localStorage).
            // No admin precisamos do catálogo completo para filtrar/selecionar.
            if (!isAdminMode() && productsDatabase.length > 400) {
                productsDatabase = productsDatabase.slice(-400);
            }
            // JSON.stringify de centenas de produtos trava o main thread no 4G —
            // grava em idle para não atrasar o primeiro paint.
            const persist = () => {
                try {
                    if (productsDatabase.length <= 400) {
                        localStorage.setItem("afiliado_mestre_db_v1", JSON.stringify(productsDatabase));
                    }
                } catch (_) {}
            };
            if (typeof requestIdleCallback === "function") requestIdleCallback(persist, { timeout: 2500 });
            else setTimeout(persist, 400);
            if (!skipRender) {
                renderStoreProducts();
                scheduleChromeRender();
                if (isAdminMode()) {
                    if (typeof window.renderConsoleProducts === "function") window.renderConsoleProducts();
                    if (typeof window.loadAdminStats === "function") window.loadAdminStats();
                }
            }
            return allowEmpty || productsDatabase.length > 0;
        }

        async function loadCategoriesFromApi({ silent = true } = {}) {
            try {
                const res = await fetch(`${API_BASE}/api/categorias`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                if (Array.isArray(data.categories) && data.categories.length) {
                    categories = (data.categories || []).map((c) => ({
                        ...c,
                        icon: normalizeCategoryIcon(c.icon),
                    }));
                    renderCategories();
                    renderSubcategories();
                }
                return true;
            } catch (err) {
                if (!silent) showToast(`Categorias falharam: ${err.message}`, "error");
                return false;
            }
        }



        // ---- Explorador Shopee (Catálogo & Sync) ----

        const LIST_TYPE_LABELS_UI = {
            0: "Recomendados", 1: "Maior comissão", 2: "Top performance",
            3: "Landing categoria", 4: "Detalhe categoria", 5: "Detalhe loja", 6: "Detalhe coleção",
        };
        const SORT_TYPE_LABELS_UI = {
            1: "Relevância", 2: "Mais vendidos", 3: "Maior preço", 4: "Menor preço", 5: "Maior comissão",
        };


async function loadOffersFromSupabase(opts = {}) {
            const searchTerm = document.getElementById("store-search-input")?.value || "";
            const keyword = opts.keyword ?? searchTerm;
            const subcategory = opts.subcategory ?? (currentStoreSubcategory || "");
            const category = opts.category ?? (currentStoreCategory !== "todos" ? currentStoreCategory : "");
            const reset = opts.reset !== false;
            if (reset) currentPage = 0;
            const limit = Number(opts.limit) > 0 ? Number(opts.limit) : PAGE_SIZE;
            const offset = reset ? 0 : currentPage * PAGE_SIZE;
            const url = `${API_BASE}/api/ofertas/db?limit=${limit}&offset=${offset}`
                + `&keyword=${encodeURIComponent(keyword)}`
                + `&subcategory=${encodeURIComponent(subcategory)}`
                + `&category=${encodeURIComponent(category)}`
                + `&sort=${encodeURIComponent(opts.sort || currentStoreSort)}`;
            try {
                if (reset && !opts.keepPreviousAbort) {
                    try { offersAbort?.abort(); } catch (_) {}
                    offersAbort = new AbortController();
                }
                const res = await fetch(url, {
                    signal: opts.signal || (reset ? offersAbort?.signal : undefined),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const ok = applyProducts(data.products, "supabase", { append: !reset });
                hasMore = (data.products || []).length >= limit;
                if (reset && ok) {
                    // Alinha a próxima página ao tamanho real do lote (sort usa limit > PAGE_SIZE).
                    const got = (data.products || []).length;
                    currentPage = Math.max(0, Math.ceil(got / PAGE_SIZE) - 1);
                }
                if (!opts.skipInfiniteSetup) {
                    infiniteScrollPausedUntil = Date.now() + 900;
                    renderLoadMoreBtn();
                    // Prefetch da página 2 só depois do usuário rolar — no mobile
                    // competia com as fotos da 1ª tela.
                    if (reset && ok && hasMore && !opts.skipPrefetch) setupPrefetchOnScroll();
                }
                if (!opts.silent) {
                    showToast(ok ? `Supabase: ${data.count} ofertas` : "Banco vazio para esse filtro — rode um Sync", ok ? "success" : "error");
                }
                if (ok) setApiStatus("API Status: cache Supabase", true);
                return ok;
            } catch (err) {
                if (err && err.name === "AbortError") return false;
                if (!opts.silent) showToast(`Erro Supabase: ${err.message}`, "error");
                return false;
            }
        }



        /** Carrega o catálogo inteiro do Supabase em lotes (só no admin). */

        async function loadMoreProducts() {
            if (loadingMore || !hasMore) return;
            if (Date.now() < infiniteScrollPausedUntil) return;
            loadingMore = true;
            infiniteScrollPausedUntil = Date.now() + 600;
            currentPage += 1;
            try {
                await loadOffersFromSupabase({ silent: true, reset: false });
            } finally {
                loadingMore = false;
                // Evita loop: botão continua na viewport e re-disparava na hora.
                infiniteScrollPausedUntil = Date.now() + 1200;
            }
        }

        function renderLoadMoreBtn() {
            const info = document.getElementById('store-results-info');
            if (!info) return;
            const existing = document.getElementById('load-more-btn');
            if (existing) existing.remove();
            if (!hasMore) return;
            const btn = document.createElement('button');
            btn.id = 'load-more-btn';
            btn.className = 'ml-3 px-3 py-1 text-[11px] font-bold rounded-lg bg-shopee-orange text-white hover:bg-shopee-orangeHover';
            btn.textContent = `Carregar mais ${PAGE_SIZE}`;
            btn.onclick = loadMoreProducts;
            info.appendChild(btn);
            setupInfiniteScroll();
        }

        let infiniteScrollObs = null;
        function setupInfiniteScroll() {
            if (infiniteScrollObs) {
                infiniteScrollObs.disconnect();
                infiniteScrollObs = null;
            }
            const btn = document.getElementById('load-more-btn');
            if (!btn || typeof IntersectionObserver === 'undefined') return;
            infiniteScrollObs = new IntersectionObserver((entries) => {
                if (Date.now() < infiniteScrollPausedUntil) return;
                if (loadingMore || !hasMore) return;
                if (entries.some((e) => e.isIntersecting)) loadMoreProducts();
            }, { rootMargin: '240px' });
            // Grace após recriar o botão (sort / re-render) — senão entra em loop.
            infiniteScrollPausedUntil = Math.max(infiniteScrollPausedUntil, Date.now() + 900);
            infiniteScrollObs.observe(btn);
        }

        let prefetchScrollArmed = false;
        function setupPrefetchOnScroll() {
            if (prefetchScrollArmed || !hasMore) return;
            prefetchScrollArmed = true;
            const arm = () => {
                window.removeEventListener("scroll", arm);
                prefetchNextPageIdle();
            };
            window.addEventListener("scroll", arm, { passive: true, once: true });
            // Sem auto-prefetch por timer: competia com troca de filtro e piscava o grid.
        }

        function prefetchNextPageIdle() {
            if (!hasMore || loadingMore || !apiLive) return;
            const run = () => {
                if (!hasMore || loadingMore) return;
                loadMoreProducts().catch(() => {});
            };
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(run, { timeout: 8000 });
            } else {
                setTimeout(run, 4000);
            }
        }


        // Inicializa o estado. Prefere cache local; sem cache fica vazio (esqueleto)
        // até a API responder — evita baixar Unsplash no 1º paint do PageSpeed.
        function initDatabase() {
            try {
                const cache = localStorage.getItem('afiliado_mestre_db_v1');
                if (cache) {
                    const parsed = JSON.parse(cache);
                    if (Array.isArray(parsed) && parsed.length) {
                        productsDatabase = parsed;
                        return;
                    }
                }
            } catch (_) {}
            productsDatabase = [];
        }

        // Restore default mocked data
        function restoreDefaultDatabase() {
            if (confirm("Deseja apagar os produtos adicionados e redefinir o banco de dados padrão?")) {
                localStorage.removeItem('afiliado_mestre_db_v1');
                productsDatabase = [...defaultProducts];
                renderStoreProducts();
                if (isAdminMode() && typeof window.renderConsoleProducts === "function") window.renderConsoleProducts();
                if (isAdminMode() && typeof window.loadAdminStats === "function") window.loadAdminStats();
                showToast("Banco de dados restaurado!", "success");
            }
        }

        // Compatibilidade com links antigos (#console, switchMainMode)
        function switchMainMode(mode) {
            if (mode === "storefront") {
                window.location.href = "/";
                return;
            }
            const map = { console: "produtos", campaigns: "campanhas", performance: "desempenho" };
            if (typeof window.switchAdminView === "function") window.switchAdminView(map[mode] || mode);
        }

        // Countdown baseado no próximo periodEnd real das ofertas relâmpago
        function initCountdown() {
            setInterval(() => {
                const hourEl = document.getElementById('flash-hour');
                if (!hourEl) return;
                if (!flashEndsAt) {
                    hourEl.innerText = '--';
                    document.getElementById('flash-min').innerText = '--';
                    document.getElementById('flash-sec').innerText = '--';
                    return;
                }
                let totalSeconds = Math.max(0, Math.floor(flashEndsAt - Date.now() / 1000));
                const hrs = Math.floor(totalSeconds / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                const secs = totalSeconds % 60;
                hourEl.innerText = String(hrs).padStart(2, '0');
                document.getElementById('flash-min').innerText = String(mins).padStart(2, '0');
                document.getElementById('flash-sec').innerText = String(secs).padStart(2, '0');
            }, 1000);
        }

        function parseSalesNumber(p) {
            const raw = String(p.salesRaw || p.sales || '').replace(/[^\d.,]/g, '').replace(',', '.');
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : 0;
        }

        function sortProductsLocal(list) {
            const arr = [...list];
            const byId = (a, b) => String(a.id).localeCompare(String(b.id), "en");
            const cmp = (diff, a, b) => (diff !== 0 ? diff : byId(a, b));
            if (currentStoreSort === 'money') {
                arr.sort((a, b) => cmp(moneyScoreOf(b) - moneyScoreOf(a), a, b));
            } else if (currentStoreSort === 'sales') {
                arr.sort((a, b) => cmp(parseSalesNumber(b) - parseSalesNumber(a), a, b));
            } else if (currentStoreSort === 'discount') {
                arr.sort((a, b) => cmp(
                    (b.discountPct || parseInt(b.discount, 10) || 0) - (a.discountPct || parseInt(a.discount, 10) || 0),
                    a, b
                ));
            } else if (currentStoreSort === 'rating') {
                arr.sort((a, b) => cmp((b.stars || 0) - (a.stars || 0), a, b));
            } else if (currentStoreSort === 'ending') {
                arr.sort((a, b) => cmp((a.periodEnd || Infinity) - (b.periodEnd || Infinity), a, b));
            } else if (currentStoreSort === 'price-asc') {
                arr.sort((a, b) => cmp((a.newPrice || 0) - (b.newPrice || 0), a, b));
            } else if (currentStoreSort === 'price-desc') {
                arr.sort((a, b) => cmp((b.newPrice || 0) - (a.newPrice || 0), a, b));
            } else if (currentStoreSort === 'recent') {
                arr.sort((a, b) => cmp(
                    (Date.parse(b.updatedAt || b.updated_at || 0) || 0) - (Date.parse(a.updatedAt || a.updated_at || 0) || 0),
                    a, b
                ));
            }
            return arr;
        }

        function scrollToStoreTop() {
            document.getElementById('main-storefront-section')?.scrollIntoView({ behavior: 'smooth' });
        }
        function clearStoreSearch() {
            const input = document.getElementById('store-search-input');
            if (!input) return;
            input.value = '';
            searchStoreProducts();
            input.focus();
        }
        function scrollToStoreCategories() {
            if (window.matchMedia('(max-width: 639px)').matches) {
                openMobileCategorySheet();
                return;
            }
            document.getElementById('store-categories-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        function scrollToFlashSale() {
            const flash = document.getElementById('flash-sale-section');
            if (flash && !flash.classList.contains('hidden')) {
                flash.scrollIntoView({ behavior: 'smooth' });
                return;
            }
            const hero = document.getElementById('hero-products');
            if (hero) {
                hero.scrollIntoView({ behavior: 'smooth' });
                return;
            }
        }
        function focusStoreSearch() {
            const input = document.getElementById('store-search-input');
            if (!input) return;
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => input.focus(), 350);
        }

        async function setStoreSort(sort, opts = {}) {
            currentStoreSort = sort || 'money';
            currentPage = 0;
            document.querySelectorAll('.store-sort-btn').forEach((btn) => {
                const active = btn.getAttribute('data-sort') === currentStoreSort;
                btn.className = active
                    ? 'store-sort-btn px-2.5 py-1.5 rounded-md bg-white text-shopee-orange shadow-sm'
                    : 'store-sort-btn px-2.5 py-1.5 rounded-md text-slate-500';
            });

            // Cancela fetch antigo + trava infinite scroll (era o loop de piscar o grid).
            const seq = ++storeSortRequestId;
            try { offersAbort?.abort(); } catch (_) {}
            offersAbort = new AbortController();
            if (infiniteScrollObs) {
                infiniteScrollObs.disconnect();
                infiniteScrollObs = null;
            }
            prefetchScrollArmed = false;
            loadingMore = false;
            infiniteScrollPausedUntil = Date.now() + 2500;

            // Ordena o que já está em memória na hora — sem esperar a API.
            renderStoreProducts();
            if (!opts.skipScroll) scrollToStoreGrid();

            // Uma recarga ordenada maior (sem paginar em cascata na hora).
            if (apiLive && !opts.localOnly) {
                try {
                    const limit = Math.max(PAGE_SIZE * 3, 72);
                    await loadOffersFromSupabase({
                        silent: true,
                        reset: true,
                        sort: currentStoreSort,
                        limit,
                        signal: offersAbort.signal,
                        keepPreviousAbort: true,
                        skipPrefetch: true,
                    });
                    if (seq !== storeSortRequestId) return;
                    infiniteScrollPausedUntil = Date.now() + 1500;
                } catch (_) {}
            }
        }

        async function setStoreCategory(catId, opts = {}) {
            currentStoreCategory = catId;
            currentStoreSubcategory = '';
            currentPage = 0;
            currentNavSection = catId === 'todos' ? 'destaque' : 'category_page';
            if (!opts.skipUrl) {
                const next = !catId || catId === 'todos' ? '/' : `/categoria/${catId}`;
                history.pushState({ path: next }, '', next);
            }
            renderCategories();
            renderSubcategories();
            renderStoreProducts();
            renderHomeSections();
            preloadSubcategoryCovers(catId);
            if (!apiLive) return;

            const MIN_LOCAL = 12;
            const localCount = catId === 'todos'
                ? productsDatabase.length
                : productsDatabase.filter(p => p.category === catId).length;
            if (localCount >= MIN_LOCAL) {
                if (localCount < 60) {
                    loadCategoryProducts(catId).catch(() => {});
                }
                return;
            }
            await loadCategoryProducts(catId);
        }

        async function setStoreSubcategory(key, opts = {}) {
            currentStoreSubcategory = key || '';
            currentPage = 0;
            if (!opts.skipUrl && currentStoreCategory && currentStoreCategory !== 'todos') {
                const next = key
                    ? `/categoria/${currentStoreCategory}/${key}`
                    : `/categoria/${currentStoreCategory}`;
                history.pushState({ path: next }, '', next);
            }
            renderSubcategories();
            renderStoreProducts();
            scrollToStoreGrid();
        }

        async function loadHeroProducts(opts = {}) {
            const track = document.getElementById('hero-products-track');
            if (!track) return;

            const renderHeroCards = (list) => {
                const now = Math.floor(Date.now() / 1000);
                let picks = femaleOnly(list || [])
                    .filter(p => p && p.image && Number(p.newPrice) > 0)
                    .sort((a, b) => {
                        const flashA = a.isFlashSale && a.periodEnd > now ? 1 : 0;
                        const flashB = b.isFlashSale && b.periodEnd > now ? 1 : 0;
                        if (flashB !== flashA) return flashB - flashA;
                        const money = moneyScoreOf(b) - moneyScoreOf(a);
                        if (money) return money;
                        return (displayDiscount(b) || 0) - (displayDiscount(a) || 0);
                    });
                const flashPicks = picks.filter(p => {
                    if (!(p.isFlashSale && p.periodEnd > now && p.periodEnd - now <= 24 * 3600)) return false;
                    const d = displayDiscount(p);
                    return d >= 20 && d <= 80;
                });
                picks = (flashPicks.length ? flashPicks : picks).slice(0, 12);
                if (!picks.length) {
                    track.innerHTML = `
                        <div class="shrink-0 w-full py-8 text-center text-slate-400 text-xs">
                            Carregando ofertas relâmpago…
                        </div>`;
                    return false;
                }
                track.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5';
                track.innerHTML = picks.map((p, index) => productCardHTML(p, { index, section: 'flash_deals' })).join('');
                return true;
            };

            // Home: usa o que já veio do sort=money — evita um 2º /api/ofertas/db.
            if (opts.fromCacheOnly) {
                renderHeroCards(productsDatabase);
                return;
            }
            if (renderHeroCards(productsDatabase)) return;

            try {
                const res = await fetch(`${API_BASE}/api/ofertas/db?limit=24&sort=discount`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const list = Array.isArray(data.products) ? data.products : [];
                if (list.length) applyProducts(list, 'hero', { append: true, skipRender: true });
                if (!renderHeroCards(list.length ? list : productsDatabase)) {
                    renderHeroCards(productsDatabase);
                }
            } catch (err) {
                if (!renderHeroCards(productsDatabase)) {
                    track.className = 'flex gap-3 overflow-x-auto pb-2 snap-x';
                    track.innerHTML = `
                        <div onclick="scrollToStoreGrid()" class="shrink-0 w-full md:w-[70%] h-44 md:h-56 rounded-2xl bg-shopee-orange text-white p-8 flex flex-col justify-end cursor-pointer">
                            <h3 class="text-2xl font-black">Ofertas Relâmpago</h3>
                            <p class="text-sm text-orange-100 mt-2">Clique para ver os produtos.</p>
                        </div>`;
                }
            }
        }

        function getSubcategoryKeywords(catId, subId) {
            if (!subId) return [];
            const cat = categories.find(c => c.id === catId);
            const sub = (cat?.subcategories || []).find(s => (s.id || s.key) === subId);
            if (!sub) return [];
            if (Array.isArray(sub.keywords) && sub.keywords.length) {
                return sub.keywords.map(k => String(k).toLowerCase().trim());
            }
            return [];
        }

        function productMatchesSubcategory(p, catId, subId) {
            if (!subId) return true;
            if (String(p.subcategory || '') === subId) return true;
            const subKws = getSubcategoryKeywords(catId, subId);
            const kw = String(p.keyword || '').toLowerCase().trim();
            if (subKws.includes(kw)) return true;
            const title = String(p.title || '').toLowerCase();
            const subRules = {
                plus_size: (t) => /\b(plus\s*size|tam(?:anho)?\s*g{2,}|\bxg\b|\bxxg\b|4[6-9]|5[0-4])\b/i.test(t),
                lingerie: (t) => /\b(lingerie|calcinha|sutiã|sutia|cinta\s*modeladora)\b/i.test(t),
                praia: (t) => /\b(biqu[ií]ni|maiô|maio|sa[ií]da\s*de\s*praia|sunga)\b/i.test(t),
                calcas: (t) => /\b(cal[cç]a|jeans|legging|pantalona|alfaiataria|linho)\b/i.test(t),
                calcados: (t) => /\b(sand[aá]lia|t[eê]nis|bota|chinelo|scarpin|salto)\b/i.test(t),
                moda_fria: (t) => /\b(jaquet|casaco|moletom|blusa\s*de\s*frio|oversized)\b/i.test(t),
                casa_moda: (t) => /\b(pijama|robe|camisola|roup[aã]o)\b/i.test(t),
                tops: (t) => /\b(cropped|macac[aã]o|conjunto|blusa|camiseta|regata)\b/i.test(t),
                vestidos: (t) => /\b(vestido|saia)\b/i.test(t),
            };
            const rule = subRules[subId];
            if (rule && rule(title)) return true;
            return subKws.some((k) => keywordTitleScore(k, title) >= 5);
        }

        function keywordTitleScore(keyword, title) {
            const lowerTitle = String(title || '').toLowerCase();
            const stop = new Set(['feminino', 'feminina', 'mulher', 'para', 'com', 'kit', 'tipo', 'modelo', 'novo', 'nova', 'vestido', 'longo', 'midi', 'saia', 'roupa', 'conjunto', 'blusa', 'camiseta', 'moda']);
            const tokens = String(keyword || '').toLowerCase().split(/\s+/)
                .filter((t) => t.length > 3 && !stop.has(t));
            if (!tokens.length) return 0;
            const hits = tokens.filter((tok) => lowerTitle.includes(tok));
            if (!hits.length) return 0;
            const longest = Math.max(...hits.map((h) => h.length));
            return hits.length >= 2 ? longest + hits.length : longest;
        }

        function formatProductOptions(p) {
            const opts = p.options || {};
            const labels = Array.isArray(opts.labels) ? opts.labels : [];
            if (labels.length) return labels;
            return [...(opts.sizes || []), ...(opts.voltages || [])];
        }

        function renderOptionBadges(p, compact = false) {
            const labels = formatProductOptions(p).slice(0, compact ? 3 : 8);
            if (!labels.length && !(p.options && p.options.hasVariants)) return '';
            const sizeClass = compact ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-2 py-1';
            const chips = labels.map((label) =>
                `<span class="bg-slate-100 text-slate-600 font-bold rounded ${sizeClass}">${escapeHtml(label)}</span>`
            ).join('');
            const more = (p.options && p.options.hasVariants && !labels.length)
                ? `<span class="bg-blue-50 text-blue-700 font-bold rounded ${sizeClass}">+ variações</span>`
                : '';
            return `<div class="flex flex-wrap gap-1">${chips}${more}</div>`;
        }

        function subcategoryLabelForProduct(p) {
            const cat = categories.find(c => c.id === p.category);
            if (!cat || !Array.isArray(cat.subcategories)) return '';
            const kw = String(p.keyword || '').toLowerCase();
            const sub = cat.subcategories.find(s => {
                const kws = getSubcategoryKeywords(cat.id, s.id || s.key);
                return kws.includes(kw);
            });
            return sub?.label || '';
        }

        // ===== Fotos de capa de categorias/subcategorias =====
        // Caches preenchidos em background e persistidos para render instantâneo
        // (e zero fetch extra) nas visitas seguintes.
        const categoryCovers = {};
        const subcategoryCovers = {};
        try { Object.assign(categoryCovers, JSON.parse(localStorage.getItem('am_cat_covers_v1') || '{}')); } catch (_) {}
        try { Object.assign(subcategoryCovers, JSON.parse(localStorage.getItem('am_sub_covers_v1') || '{}')); } catch (_) {}
        function persistCovers() {
            try {
                localStorage.setItem('am_cat_covers_v1', JSON.stringify(categoryCovers));
                localStorage.setItem('am_sub_covers_v1', JSON.stringify(subcategoryCovers));
            } catch (_) {}
        }

        // Miniatura da CDN da Shopee (_tn) — bem mais leve para os círculos/tiles.
        // Variantes do CDN da Shopee para o mesmo arquivo, medidas em produção:
        //   _tn.webp → 320px / 23KB   _tn → 320px / 32KB
        //   .webp    → 742px / 102KB  original → 742px / 411KB
        // A grade usa a menor; o modal usa a média. Cada variante tem fallback
        // porque itens antigos do catálogo nem sempre têm webp gerado.
        function shopeeVariant(url, suffix) {
            if (!url) return url || '';
            if (!/(shopee|susercontent)\./i.test(url)) return url;
            const [base, query = ''] = String(url).split('?');
            const clean = base.replace(/(_tn)?(\.webp)?$/i, '');
            return `${clean}${suffix}${query ? `?${query}` : ''}`;
        }

        const thumbUrl = url => shopeeVariant(url, '_tn.webp');
        const displayUrl = url => shopeeVariant(url, '.webp');

        function imgFallbackChain(url) {
            const chain = [
                shopeeVariant(url, '_tn'),
                displayUrl(url),
                url || '',
            ];
            const first = thumbUrl(url);
            return [...new Set(chain)].filter(u => u && u !== first);
        }

        // onerror em cadeia: tenta cada variante mais pesada antes de desistir.
        function tileImgError(img, iconClass) {
            const rest = (img.dataset.fallbacks || '').split('|').filter(Boolean);
            if (rest.length) {
                img.dataset.fallbacks = rest.slice(1).join('|');
                img.src = rest[0];
                return;
            }
            img.replaceWith(Object.assign(document.createElement('i'), { className: iconClass }));
        }

        function tileImgHTML(img, iconClass, eager = false) {
            return `<img src="${escapeAttr(thumbUrl(img))}" data-fallbacks="${escapeAttr(imgFallbackChain(img).join('|'))}" alt="" width="80" height="80" loading="${eager ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${eager ? 'high' : 'low'}" class="w-full h-full object-cover" onerror="tileImgError(this, '${iconClass}')">`;
        }

        function productImgError(img, fallbackSize) {
            const rest = (img.dataset.fallbacks || '').split('|').filter(Boolean);
            if (rest.length) {
                img.dataset.fallbacks = rest.slice(1).join('|');
                img.src = rest[0];
                return;
            }
            img.onerror = null;
            img.src = `https://placehold.co/${fallbackSize}x${fallbackSize}/ffebd7/ee4d2d?text=Shopee`;
        }

        function productImgHTML(url, { eager = false, className = '', fallbackSize = 200 } = {}) {
            const safeThumb = escapeAttr(thumbUrl(url || ''));
            const safeChain = escapeAttr(imgFallbackChain(url || '').join('|'));
            return `<img src="${safeThumb}" data-fallbacks="${safeChain}" alt="" width="${fallbackSize}" height="${fallbackSize}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${eager ? 'high' : 'low'}" class="${className}" onerror="productImgError(this, ${fallbackSize})">`;
        }

        // Imagens candidatas de uma categoria, na ordem do catálogo local.
        function categoryImageCandidates(catId) {
            const out = [];
            if (!catId || catId === 'todos') return out;
            for (const p of productsDatabase) {
                if (p.category === catId && p.image) out.push(p.image);
            }
            if (categoryCovers[catId]) out.push(categoryCovers[catId]);
            return out;
        }

        // Primeira candidata ainda não usada no render atual — evita fotos repetidas.
        function pickUnused(candidates, used) {
            for (const img of candidates) {
                if (img && !used.has(img)) { used.add(img); return img; }
            }
            return null;
        }

        function getCategoryImage(catId) {
            return categoryImageCandidates(catId)[0] || null;
        }

        // Busca 1 produto por categoria em background para garantir uma foto de capa.
        let categoryCoversLoaded = false;
        async function preloadCategoryCovers() {
            if (categoryCoversLoaded || !apiLive) return;
            categoryCoversLoaded = true;
            const missing = categories.filter(c =>
                c.id !== 'todos' && !getCategoryImage(c.id)
            );
            if (!missing.length) return;
            await Promise.all(missing.map(async cat => {
                try {
                    const url = `${API_BASE}/api/ofertas/db?limit=1&offset=0&category=${encodeURIComponent(cat.id)}`;
                    const res = await fetch(url);
                    if (!res.ok) return;
                    const data = await res.json();
                    const first = (data.products || [])[0];
                    if (first && first.image) categoryCovers[cat.id] = first.image;
                } catch (_) {}
            }));
            persistCovers();
            renderCategories();
            renderSubcategories();
            const sheet = document.getElementById('mobile-category-sheet');
            if (sheet && !sheet.classList.contains('hidden')) {
                renderMobileCategoryList();
            }
        }

        // Imagens candidatas de uma subcategoria: produtos que casam com o filtro,
        // depois a capa em cache, depois qualquer produto da categoria (fallback).
        // Só devolve fotos que realmente pertencem à subcategoria — sem capa
        // aleatória da categoria, que dava a impressão de tile trocado.
        // Sem foto compatível, o tile cai no ícone próprio da subcategoria.
        function subcategoryImageCandidates(catId, subId, _catImages, catProducts) {
            const out = [];
            let matched = 0;
            for (const p of catProducts) {
                if (matched >= 4) break;
                if (productMatchesSubcategory(p, catId, subId)) { out.push(p.image); matched++; }
            }
            const cached = subcategoryCovers[`${catId}::${subId}`];
            if (cached) out.push(cached);
            return out;
        }

        const preloadedSubCovers = new Set();
        async function preloadSubcategoryCovers(catId) {
            if (!apiLive || !catId || catId === 'todos') return;
            if (preloadedSubCovers.has(catId)) return;
            preloadedSubCovers.add(catId);
            const cat = categories.find(c => c.id === catId);
            const subs = (cat && Array.isArray(cat.subcategories)) ? cat.subcategories : [];
            if (!subs.length) return;

            // 1 request só: um lote da categoria já rende capas distintas para a
            // maioria das subcategorias via matching local (em vez de 1 fetch por sub).
            if (productsDatabase.filter(p => p.category === catId && p.image).length < 12) {
                try {
                    const res = await fetch(`${API_BASE}/api/ofertas/db?limit=40&offset=0&category=${encodeURIComponent(catId)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data.products) && data.products.length) {
                            applyProducts(data.products, 'supabase', { append: true, allowEmpty: true });
                        }
                    }
                } catch (_) {}
            }

            // Busca dirigida apenas para subcategorias que seguem sem capa própria.
            const catProducts = productsDatabase.filter(p => p.category === catId && p.image);
            const missing = subs.filter(s => {
                const subId = s.id || s.key;
                if (subcategoryCovers[`${catId}::${subId}`]) return false;
                return !catProducts.some(p => productMatchesSubcategory(p, catId, subId));
            });
            await Promise.all(missing.map(async s => {
                const subId = s.id || s.key;
                try {
                    const url = `${API_BASE}/api/ofertas/db?limit=1&offset=0&category=${encodeURIComponent(catId)}&subcategory=${encodeURIComponent(subId)}`;
                    const res = await fetch(url);
                    if (!res.ok) return;
                    const data = await res.json();
                    const first = (data.products || [])[0];
                    if (first && first.image) subcategoryCovers[`${catId}::${subId}`] = first.image;
                } catch (_) {}
            }));
            persistCovers();
            renderSubcategories();
            const sheet = document.getElementById('mobile-category-sheet');
            if (sheet && !sheet.classList.contains('hidden')) {
                renderMobileCategoryList();
            }
        }

        function categoryTileHTML(cat, { size = 'md', used, openSheet = false, eagerImg = false } = {}) {
            const isActive = cat.id === currentStoreCategory;
            const borderClass = isActive ? 'border-shopee-orange shadow-sm bg-orange-50/40' : 'border-transparent';
            const bgIconClass = isActive || cat.id === 'todos' ? 'bg-orange-100 text-shopee-orange' : 'bg-slate-100 text-slate-600';
            const textClass = isActive ? 'text-shopee-orange font-bold' : 'text-slate-600 font-medium';
            const count = Number(cat.count || 0);
            const badgeLabel = formatCountBadge(count);
            const badge = badgeLabel
                ? `<span class="text-[9px] text-slate-400 font-semibold">${badgeLabel}</span>`
                : '';
            const circleSize = size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
            const iconSize = size === 'lg' ? 'text-2xl' : 'text-base';
            const img = used
                ? pickUnused(categoryImageCandidates(cat.id), used)
                : getCategoryImage(cat.id);
            const icon = categoryIconClass(cat);
            const inner = img
                ? tileImgHTML(img, `fas ${icon} ${iconSize} text-shopee-orange`, !!eagerImg)
                : `<i class="fas ${icon} ${iconSize}"></i>`;
            const circleBg = img ? 'bg-slate-100' : bgIconClass;
            const clickAction = openSheet
                ? `openMobileCategorySheet('${cat.id}')`
                : `setStoreCategory('${cat.id}')`;
            return `
                <button
                    onclick="${clickAction}"
                    class="flex flex-col items-center p-2 rounded-xl hover:bg-slate-50 transition border ${borderClass} group w-full snap-start"
                >
                    <div class="${circleSize} rounded-full ${circleBg} overflow-hidden flex items-center justify-center mb-1.5 transition transform group-hover:scale-105 ring-2 ${isActive ? 'ring-shopee-orange' : 'ring-transparent'}">
                        ${inner}
                    </div>
                    <span class="text-[11px] text-center leading-tight ${textClass} line-clamp-2">${escapeHtml(cat.label)}</span>
                    ${badge}
                </button>`;
        }

        function renderCategories() {
            const desktop = document.getElementById('store-categories-container');
            const strip = document.getElementById('mobile-category-strip');
            const visible = categories.filter(cat => cat.id !== 'todos');
            if (desktop) {
                const used = new Set();
                desktop.innerHTML = visible.map((cat, i) => categoryTileHTML(cat, { size: 'md', used, eagerImg: i < 2 })).join('');
            }
            if (strip) {
                const used = new Set();
                const tiles = visible.map((cat, i) => categoryTileHTML(cat, { size: 'lg', used, openSheet: true, eagerImg: i < 2 })).join('');
                const verMais = `
                    <button onclick="openMobileCategorySheet()" class="flex flex-col items-center p-2 rounded-xl hover:bg-slate-50 transition border border-transparent group w-full snap-start">
                        <div class="h-16 w-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-1.5">
                            <i class="fas fa-th-large text-2xl"></i>
                        </div>
                        <span class="text-[11px] text-center leading-tight text-slate-600 font-medium">Ver Mais</span>
                    </button>`;
                strip.innerHTML = tiles + verMais;
            }
        }

        // Filter by category — usa cache local imediatamente; só busca no servidor
        // se a categoria tiver poucos itens no cache atual (evita ida ao Supabase
        // a cada toque, que era o principal gargalo no mobile).

        async function loadCategoryProducts(catId) {
            try {
                const url = `${API_BASE}/api/ofertas/db?limit=${PAGE_SIZE}&offset=0`
                    + (catId === 'todos' ? '' : `&category=${encodeURIComponent(catId)}`)
                    + `&sort=${encodeURIComponent(currentStoreSort)}`;
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                categoryProductsCache = data.products || [];
                // append=true preserva o cache das outras categorias
                applyProducts(categoryProductsCache, 'supabase', { append: true, allowEmpty: true });
                hasMore = categoryProductsCache.length >= PAGE_SIZE;
                renderLoadMoreBtn();
                return categoryProductsCache.length > 0;
            } catch (err) {
                showToast(`Erro ao carregar categoria: ${err.message}`, 'error');
                return false;
            }
        }

        // Renderiza subcategorias agrupadas da categoria ativa (somente desktop).
        function renderSubcategories() {
            const wrapper = document.getElementById('store-subcategories');
            const container = document.getElementById('store-subcategories-container');
            const breadcrumb = document.getElementById('subcat-breadcrumb');
            if (!wrapper || !container) return;

            if (window.matchMedia('(max-width: 639px)').matches) {
                wrapper.classList.add('hidden');
                container.innerHTML = '';
                if (breadcrumb) breadcrumb.textContent = '';
                return;
            }

            const cat = categories.find(c => c.id === currentStoreCategory);
            const subs = (cat && Array.isArray(cat.subcategories)) ? cat.subcategories : [];

            if (currentStoreCategory === 'todos' || !subs.length) {
                wrapper.classList.add('hidden');
                container.innerHTML = '';
                if (breadcrumb) breadcrumb.textContent = '';
                updateMobileCategoryUI();
                return;
            }

            wrapper.classList.remove('hidden');
            const activeSub = subs.find(s => (s.id || s.key) === currentStoreSubcategory);
            if (breadcrumb) {
                breadcrumb.textContent = activeSub
                    ? `${cat.label} › ${activeSub.label}`
                    : cat.label;
            }

            const tile = (id, label, count, active, img) => {
                const iconClass = `fas ${subcategoryIconClass(cat.id, id)} text-xl text-shopee-orange`;
                const inner = img
                    ? tileImgHTML(img, iconClass)
                    : `<i class="${iconClass}"></i>`;
                const tileBg = img
                    ? 'bg-slate-100'
                    : 'bg-gradient-to-br from-orange-50 to-rose-50';
                return `
                <button onclick="setStoreSubcategory('${String(id).replace(/'/g, "\\'")}')"
                    class="flex flex-col items-center p-1.5 rounded-xl transition border ${active
                        ? 'border-shopee-orange bg-orange-50/40 shadow-sm'
                        : 'border-transparent hover:bg-slate-50'}">
                    <div class="aspect-square w-full rounded-lg ${tileBg} overflow-hidden flex items-center justify-center mb-1.5 ring-2 ${active ? 'ring-shopee-orange' : 'ring-transparent'}">
                        ${inner}
                    </div>
                    <span class="text-[11px] leading-tight text-center line-clamp-2 ${active ? 'text-shopee-orange font-bold' : 'text-slate-600 font-medium'}">${escapeHtml(label)}</span>
                    ${count > 0 ? `<span class="text-[9px] text-slate-400 font-semibold">${count}</span>` : ''}
                </button>`;
            };

            // Uma foto por tile, sem repetir dentro do bloco de subcategorias.
            const catProducts = productsDatabase.filter(p => p.category === cat.id && p.image);
            const catImages = catProducts.map(p => p.image);
            if (categoryCovers[cat.id]) catImages.push(categoryCovers[cat.id]);
            const used = new Set();

            const totalInCat = Number(cat.count || 0);
            container.innerHTML =
                tile('', 'Todas', totalInCat, currentStoreSubcategory === '', pickUnused(catImages, used))
                + subs.map(s => {
                    const subId = s.id || s.key;
                    return tile(
                        subId,
                        s.label,
                        Number(s.count || 0),
                        currentStoreSubcategory === subId,
                        pickUnused(subcategoryImageCandidates(cat.id, subId, catImages, catProducts), used)
                    );
                }).join('');
            updateMobileCategoryUI();
        }

        // ===== Página de categorias em tela cheia (estilo Shopee) =====
        // `mobileExpandedCat` guarda a categoria selecionada na sidebar.
        let mobileExpandedCat = null;

        function openMobileCategorySheet(prefilledCatId) {
            document.getElementById('mobile-category-sheet')?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            if (prefilledCatId && prefilledCatId !== 'todos') {
                mobileExpandedCat = prefilledCatId;
            } else if (!mobileExpandedCat || mobileExpandedCat === 'todos') {
                mobileExpandedCat = currentStoreCategory !== 'todos' ? currentStoreCategory : null;
            }
            renderMobileCategoryList();
            if (mobileExpandedCat) preloadSubcategoryCovers(mobileExpandedCat);
        }
        function closeMobileCategorySheet() {
            document.getElementById('mobile-category-sheet')?.classList.add('hidden');
            document.body.style.overflow = '';
        }

        // Seleção na sidebar: categorias sem subcategorias aplicam o filtro direto.
        function selectCategoryPage(catId) {
            const cat = categories.find(c => c.id === catId);
            if (!cat) return;
            const hasSubs = cat.id !== 'todos'
                && Array.isArray(cat.subcategories)
                && cat.subcategories.length > 0;
            if (!hasSubs) {
                setStoreCategory(catId);
                closeMobileCategorySheet();
                return;
            }
            mobileExpandedCat = catId;
            preloadSubcategoryCovers(catId);
            renderMobileCategoryList();
        }

        function selectMobileSubcategory(catId, subId) {
            // Fecha o painel imediatamente para dar sensação de resposta.
            closeMobileCategorySheet();
            // Aplica categoria + subcategoria juntas, sem dois renders sequenciais.
            currentStoreCategory = catId;
            currentStoreSubcategory = subId || '';
            currentPage = 0;
            renderCategories();
            renderSubcategories();
            renderStoreProducts();
            scrollToStoreGrid();
            // Carrega dados frescos em background se o cache estiver curto.
            if (!apiLive) return;
            const localCount = productsDatabase.filter(p => p.category === catId).length;
            if (localCount < 12) loadCategoryProducts(catId).catch(() => {});
        }

        function updateMobileCategoryUI() {
            if (!document.getElementById('mobile-category-sheet')?.classList.contains('hidden')) {
                renderMobileCategoryList();
            }
        }

        function renderMobileCategoryList() {
            const sidebar = document.getElementById('category-page-sidebar');
            const panel = document.getElementById('category-page-panel');
            if (!sidebar || !panel) return;

            // Sem seleção ainda: cai na primeira categoria com subcategorias.
            if (!mobileExpandedCat || !categories.some(c => c.id === mobileExpandedCat)) {
                const firstWithSubs = categories.find(c =>
                    c.id !== 'todos' && Array.isArray(c.subcategories) && c.subcategories.length > 0
                );
                mobileExpandedCat = firstWithSubs ? firstWithSubs.id : null;
            }
            const selected = categories.find(c => c.id === mobileExpandedCat) || null;

            sidebar.innerHTML = categories
                .filter(cat => cat.id !== 'todos')
                .map(cat => {
                const isSel = selected && cat.id === selected.id;
                return `
                <button onclick="selectCategoryPage('${cat.id}')"
                    class="w-full flex flex-col items-center gap-1.5 px-1 py-3.5 text-center border-l-[3px] transition ${isSel
                        ? 'bg-white text-shopee-orange border-shopee-orange'
                        : 'text-slate-500 border-transparent active:bg-slate-200/60'}">
                    <i class="fas ${categoryIconClass(cat)} text-lg"></i>
                    <span class="text-[10px] leading-tight font-semibold">${escapeHtml(cat.label)}</span>
                </button>`;
            }).join('');

            if (!selected) { panel.innerHTML = ''; return; }

            // Fotos sem repetição dentro do painel.
            const used = new Set();
            const catProducts = productsDatabase.filter(p => p.category === selected.id && p.image);
            const catImages = catProducts.map(p => p.image);
            if (categoryCovers[selected.id]) catImages.push(categoryCovers[selected.id]);
            const subs = Array.isArray(selected.subcategories) ? selected.subcategories : [];

            const tile = (id, label, img, active) => {
                const iconClass = `fas ${subcategoryIconClass(selected.id, id)} text-2xl text-shopee-orange`;
                const inner = img
                    ? tileImgHTML(img, iconClass)
                    : `<i class="${iconClass}"></i>`;
                const tileBg = img
                    ? 'bg-slate-100'
                    : 'bg-gradient-to-br from-orange-50 to-rose-50';
                return `
                <button onclick="selectMobileSubcategory('${selected.id}','${String(id).replace(/'/g, "\\'")}')"
                    class="flex flex-col items-center gap-2 py-2">
                    <span class="h-20 w-20 rounded-full ${tileBg} overflow-hidden flex items-center justify-center ring-2 ${active ? 'ring-shopee-orange' : 'ring-transparent'}">
                        ${inner}
                    </span>
                    <span class="text-xs leading-tight text-center line-clamp-2 ${active ? 'text-shopee-orange font-bold' : 'text-slate-700 font-medium'}">${escapeHtml(label)}</span>
                </button>`;
            };

            const isCatActive = currentStoreCategory === selected.id;
            panel.innerHTML = `
                <div class="grid grid-cols-3 gap-x-1 gap-y-3">
                    ${tile('', 'Ver tudo', pickUnused(catImages, used), isCatActive && currentStoreSubcategory === '')}
                    ${subs.map(s => {
                        const subId = s.id || s.key;
                        return tile(
                            subId,
                            s.label,
                            pickUnused(subcategoryImageCandidates(selected.id, subId, catImages, catProducts), used),
                            isCatActive && currentStoreSubcategory === subId
                        );
                    }).join('')}
                </div>`;
        }

        function isFemaleProduct(p) {
            if (!p) return false;
            const cat = String(p.category || '').toLowerCase();
            if (['moda', 'beleza', 'acessorios', 'fitness', 'maternidade', 'saude', 'casa', 'presentes', 'pet', 'infantil'].includes(cat)) return true;
            return /feminin|mulher|menina|gestante|matern|maquiagem|skincare|batom|vestido|saia|biquini|lingerie|suti[aã]|calcinha|bolsa|necessaire|cropped|pantalo|sandalia|rasteir|scrunchie|boob\s*tape|plus\s*size|amamenta|legging|brinco|colar|unha|pijama|tiara/i
                .test(`${p.title || ''} ${p.keyword || ''} ${p.subcategory || ''}`);
        }

        function moneyScoreOf(p) {
            if (p && Number.isFinite(Number(p.moneyScore))) return Number(p.moneyScore);
            const rate = Number(String(p.commissionRate || p.commissionPct || '0').replace('%', '')) || 0;
            const commissionPct = rate <= 1 && rate > 0 ? rate * 100 : rate;
            const sales = parseSalesNumber(p);
            const rating = Number(p.stars) > 0 ? Math.min(5, Number(p.stars)) : 4;
            return Math.round(commissionPct * Math.log10(sales + 1) * rating * 100) / 100;
        }

        function femaleOnly(list) {
            return (Array.isArray(list) ? list : []).filter(isFemaleProduct);
        }

        function sortByMoney(list) {
            return [...(list || [])].sort((a, b) => moneyScoreOf(b) - moneyScoreOf(a));
        }

        function prioritizeFemaleProducts(list) {
            // Home: 100% feminino. Em outras telas, 95/5 via filter duro só na home.
            return femaleOnly(list);
        }

        function productCardHTML(p, { index = 0, section = 'destaque' } = {}) {
            const disc = displayDiscount(p);
            const priceFormatted = Number(p.newPrice).toFixed(2).replace('.', ',');
            const rating = formatRating(p.stars);
            const soldCount = parseSalesNumber(p);
            const sold = formatSold(p.salesRaw != null ? p.salesRaw : p.sales);
            const salesBadge = soldCount >= 1000
                ? `+${soldCount >= 10000 ? `${Math.floor(soldCount / 1000)} mil` : soldCount.toLocaleString('pt-BR')} vendidos`
                : (soldCount >= 100 ? `+${soldCount} vendidos` : '');
            const shop = cleanShopName(p.shopName);
            const official = isOfficialShop(p.shopType);
            const subLabel = subcategoryLabelForProduct(p);
            return `
                <div class="bg-white rounded-xl overflow-hidden border border-slate-100 hover:border-shopee-orange hover:shadow-md transition flex flex-col h-full relative group min-w-0">
                    <div onclick="openProductModal(${p.id}, '${section}')" class="cursor-pointer flex flex-col flex-1 min-w-0">
                    ${disc ? `
                    <div class="absolute top-0 right-0 bg-[#ffe97a] text-shopee-orange text-[9px] font-black px-1.5 py-1 text-center rounded-bl-lg z-10 leading-none">
                        <span class="block">-${disc}%</span>
                        <span class="text-[7px] text-orange-600 font-bold uppercase block mt-0.5">OFF</span>
                    </div>` : ''}
                    ${official ? `<span class="absolute left-2 top-2 z-10 rounded bg-shopee-orange px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Oficial</span>` : ''}
                    ${salesBadge ? `<span class="absolute left-2 ${official ? 'top-8' : 'top-2'} z-10 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">${escapeHtml(salesBadge)}</span>` : ''}
                    <div class="aspect-square img-skeleton relative overflow-hidden">
                        ${productImgHTML(p.image, {
                            eager: index < 4,
                            className: 'w-full h-full object-cover transition duration-300 group-hover:scale-105'
                        })}
                    </div>
                    <div class="p-2 sm:p-2.5 flex flex-col justify-between flex-1 space-y-1 min-w-0">
                        ${subLabel ? `<span class="self-start bg-orange-50 text-shopee-orange text-[8px] font-bold px-1.5 py-0.5 rounded uppercase truncate max-w-full">${escapeHtml(subLabel)}</span>` : ''}
                        <h4 class="text-[12px] sm:text-[13px] text-slate-900 font-semibold line-clamp-2 min-h-[2.4rem] leading-snug group-hover:text-shopee-orange transition break-words">${escapeHtml(p.title)}</h4>
                        ${renderOptionBadges(p, true)}
                        <div class="min-w-0">
                            ${p.oldPrice > p.newPrice ? `<p class="text-[9px] text-slate-400 line-through leading-none">R$ ${Number(p.oldPrice).toFixed(2).replace('.', ',')}</p>` : ''}
                            <p class="text-shopee-orange text-[15px] sm:text-base font-black mt-0.5 truncate">R$ ${priceFormatted}</p>
                        </div>
                        <div class="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-50 min-w-0">
                            ${rating ? `<span class="text-amber-500 shrink-0">★</span><span class="font-semibold text-slate-700 shrink-0">${rating}</span>` : ''}
                            ${rating && sold ? `<span class="text-slate-300 shrink-0">·</span>` : ''}
                            ${sold ? `<span class="truncate">${escapeHtml(sold)}</span>` : ''}
                        </div>
                        ${shop ? `<p class="text-[9px] text-slate-400 truncate">${escapeHtml(shop)}</p>` : ''}
                    </div>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); buyFromCard(${p.id}, '${section}')"
                        class="mx-2 mb-2 sm:mx-2.5 sm:mb-2.5 mt-auto w-[calc(100%-1rem)] sm:w-[calc(100%-1.25rem)] min-h-[40px] bg-shopee-orange hover:bg-shopee-orangeHover text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
                        Comprar <i class="fas fa-arrow-up-right-from-square text-[9px]"></i>
                    </button>
                </div>`;
        }

        function parseSalesNumber(p) {
            if (typeof p.salesRaw === 'number') return p.salesRaw;
            const s = String(p.salesRaw || p.sales || '');
            const mil = s.match(/([\d.,]+)\s*mil/i);
            if (mil) return Number(mil[1].replace(',', '.')) * 1000 || 0;
            const k = s.match(/([\d.,]+)\s*k/i);
            if (k) return Number(k[1].replace(',', '.')) * 1000 || 0;
            const n = Number(String(s).replace(/[^\d]/g, ''));
            return Number.isFinite(n) ? n : 0;
        }

        function deriveHomeSections(list) {
            const items = sortByMoney(femaleOnly(list));
            const topSellers = items
                .filter(p => parseSalesNumber(p) >= 100)
                .sort((a, b) => parseSalesNumber(b) - parseSalesNumber(a))
                .slice(0, 12);
            const bigDiscounts = items
                .map(p => ({ p, d: displayDiscount(p) }))
                .filter(x => x.d >= 30 && x.d <= 85 && parseSalesNumber(x.p) >= 50)
                .sort((a, b) => b.d - a.d)
                .map(x => x.p)
                .slice(0, 12);
            const topRated = items
                .filter(p => Number(p.stars) >= 4.7 && parseSalesNumber(p) >= 200)
                .sort((a, b) => Number(b.stars) - Number(a.stars))
                .slice(0, 12);
            const officialShops = items.filter(p => isOfficialShop(p.shopType)).slice(0, 12);
            const premium = items.filter(p => moneyScoreOf(p) > 0).slice(0, 12);
            const moda = items.filter(p => p.category === 'moda').slice(0, 12);
            const beleza = items.filter(p => p.category === 'beleza').slice(0, 12);
            return { topSellers, bigDiscounts, topRated, officialShops, premium, moda, beleza };
        }

        function renderHomeSections() {
            const box = document.getElementById('home-sections');
            if (!box || isAdminMode()) return;
            if (currentStoreCategory !== 'todos' || currentStoreSubcategory) {
                box.innerHTML = '';
                return;
            }
            const path = pathClean();
            if (path !== '/' && path !== '') {
                box.innerHTML = '';
                return;
            }
            const { topSellers, bigDiscounts, topRated, officialShops, premium, moda, beleza } = deriveHomeSections(productsDatabase);
            const blocks = [
                { title: 'Seleção premium pra ela', href: '/mais-vendidos', items: premium, section: 'premium_picks' },
                { title: 'Achadinhos moda', href: '/categoria/moda', items: moda, section: 'moda_picks' },
                { title: 'Beleza & skincare', href: '/categoria/beleza', items: beleza, section: 'beleza_picks' },
                { title: 'Mais Vendidos', href: '/mais-vendidos', items: topSellers, section: 'top_sellers' },
                { title: 'Maiores Descontos', href: '/maiores-descontos', items: bigDiscounts, section: 'big_discounts' },
                { title: 'Melhor Avaliados', href: '/melhor-avaliados', items: topRated, section: 'top_rated' },
                { title: 'Lojas Oficiais', href: '/lojas-oficiais', items: officialShops, section: 'official_shops' },
            ].filter(b => b.items.length > 0);
            if (!blocks.length) {
                box.innerHTML = '';
                return;
            }
            // Só o primeiro bloco entra como eager: no 4G, dezenas de imagens em
            // fetchpriority=high disputam banda e atrasam justo as que estão na tela.
            const perBlock = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 640px)").matches)
                ? 4
                : 6;
            // Mobile: menos seções na 1ª pintura (o resto sobe no idle).
            const maxBlocks = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 640px)").matches)
                ? 4
                : blocks.length;
            box.innerHTML = blocks.slice(0, maxBlocks).map((b, blockIndex) => `
                <section class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base md:text-lg font-black text-slate-800">${escapeHtml(b.title)}</h3>
                        <a href="${b.href}" class="text-xs font-bold text-shopee-orange hover:underline" onclick="event.preventDefault(); navigateTo('${b.href}')">Ver todos →</a>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                        ${b.items.slice(0, perBlock).map((p, i) => productCardHTML(p, {
                            index: blockIndex === 0 ? i : 99,
                            section: b.section,
                        })).join('')}
                    </div>
                </section>
            `).join('');
            if (maxBlocks < blocks.length) {
                const rest = () => {
                    box.insertAdjacentHTML("beforeend", blocks.slice(maxBlocks).map((b) => `
                        <section class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="text-base md:text-lg font-black text-slate-800">${escapeHtml(b.title)}</h3>
                                <a href="${b.href}" class="text-xs font-bold text-shopee-orange hover:underline" onclick="event.preventDefault(); navigateTo('${b.href}')">Ver todos →</a>
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                                ${b.items.slice(0, perBlock).map((p) => productCardHTML(p, { index: 99, section: b.section })).join('')}
                            </div>
                        </section>
                    `).join(""));
                };
                if (typeof requestIdleCallback === "function") requestIdleCallback(rest, { timeout: 3000 });
                else setTimeout(rest, 800);
            }
        }

        // Render Products in the Public Storefront Grid
        function renderStoreProducts() {
            const grid = document.getElementById('store-products-grid');
            const flashContainer = document.getElementById('flash-products-container');
            const flashSection = document.getElementById('flash-sale-section');
            const searchVal = (document.getElementById('store-search-input')?.value || '').toLowerCase().trim();
            if (!grid || !flashContainer) return;

            const onHome = (pathClean() === '/' || pathClean() === '') && currentStoreCategory === 'todos' && !currentStoreSubcategory && !searchVal;

            let filtered = productsDatabase.filter(p => {
                const matchesCategory = currentStoreCategory === 'todos' || p.category === currentStoreCategory;
                if (!matchesCategory) return false;
                if (searchVal) {
                    const title = (p.title || '').toLowerCase();
                    const desc = (p.desc || '').toLowerCase();
                    if (!title.includes(searchVal) && !desc.includes(searchVal)) return false;
                }
                return productMatchesSubcategory(p, currentStoreCategory, currentStoreSubcategory);
            });
            if (onHome) {
                // Home: respeita o filtro escolhido (Mais vendidos, desconto, etc.)
                filtered = femaleOnly(filtered);
                filtered = sortProductsLocal(filtered);
            } else {
                filtered = sortProductsLocal(filtered);
                if (currentStoreCategory === 'todos' && !searchVal) {
                    filtered = prioritizeFemaleProducts(filtered);
                }
            }
            const totalFiltered = filtered.length;
            filtered = filtered.slice(0, (currentPage + 1) * PAGE_SIZE);

            const now = Math.floor(Date.now() / 1000);
            let flashSales = (onHome ? femaleOnly(productsDatabase) : filtered)
                .filter(p => {
                    if (!p.isFlashSale || !p.periodEnd || p.periodEnd <= now) return false;
                    if (p.periodEnd - now > 24 * 3600) return false;
                    const d = displayDiscount(p);
                    return d >= 20 && d <= 80;
                })
                .sort((a, b) => (a.periodEnd || 0) - (b.periodEnd || 0));

            flashEndsAt = flashSales.length ? flashSales[0].periodEnd : null;
            if (flashSection) flashSection.classList.toggle('hidden', flashSales.length === 0);

            if (flashSales.length === 0) {
                flashContainer.innerHTML = `
                    <div class="py-4 text-center text-slate-400 text-xs w-full">
                        Nenhuma oferta com prazo de término próximo nesta categoria.
                    </div>`;
            } else {
                flashContainer.className = 'p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3';
                flashContainer.innerHTML = flashSales.slice(0, 10).map((p, index) => productCardHTML(p, { index, section: 'flash_deals' })).join('');
            }

            if (window.__filterOfficialOnly) {
                filtered = filtered.filter(p => isOfficialShop(p.shopType));
            }

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                        <i class="fas fa-folder-open text-3xl"></i>
                        <p class="font-bold text-sm">Nenhum produto correspondente encontrado.</p>
                        <p class="text-xs">Tente mudar sua busca ou categoria!</p>
                    </div>`;
            } else {
                grid.innerHTML = filtered.map((p, index) => productCardHTML(p, { index, section: currentNavSection || 'destaque' })).join('');
            }

            const info = document.getElementById('store-results-info');
            const catObj = categories.find(c => c.id === currentStoreCategory) || {};
            const catLabel = catObj.label || 'Tudo';
            const subObj = (catObj.subcategories || []).find(s => (s.id || s.key) === currentStoreSubcategory);
            const scopeLabel = subObj ? `${catLabel} › ${subObj.label}` : catLabel;
            if (info) {
                info.textContent = filtered.length
                    ? `${filtered.length}${totalFiltered > filtered.length ? ` de ${totalFiltered}` : ''} ofertas · ${scopeLabel}`
                    : 'Nenhuma oferta nesta seleção';
            }
            renderLoadMoreBtn();
        }

        function escapeHtml(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function escapeAttr(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;');
        }

        // Quick search set
        function applyStoreSearch(term) {
            document.getElementById('store-search-input').value = term;
            searchStoreProducts();
            scrollToStoreGrid();
        }

        const POPULAR_TERM_CANDIDATES = [
            'Vestido', 'Skincare', 'Bolsa', 'Sandália', 'Conjunto', 'Lingerie',
            'Perfume', 'Maquiagem', 'Legging', 'Cropped', 'Plus size', 'Batom',
            'Scrunchie', 'Pijama', 'Smartwatch'
        ];

        function renderPopularTerms() {
            const container = document.getElementById('popular-terms');
            if (!container) return;
            const scored = POPULAR_TERM_CANDIDATES
                .map(term => {
                    const t = term.toLowerCase();
                    const count = femaleOnly(productsDatabase).filter(p =>
                        (p.title || '').toLowerCase().includes(t)
                    ).length;
                    return { term, count };
                })
                .filter(x => x.count > 0)
                .sort((a, b) => b.count - a.count);

            const items = (scored.length ? scored : [
                { term: 'Vestido' },
                { term: 'Skincare' },
                { term: 'Bolsa' }
            ]).slice(0, 4);

            container.innerHTML = '';
            items.forEach(({ term }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = term;
                btn.className = 'bg-white/15 hover:bg-white hover:text-shopee-orange active:scale-95 text-white rounded-full px-3 py-1 text-[11px] font-semibold transition min-h-[28px] cursor-pointer border border-white/20';
                btn.addEventListener('click', () => applyStoreSearch(term));
                container.appendChild(btn);
            });
        }

        let searchDebounce = null;
        async function searchStoreProducts() {
            const term = (document.getElementById('store-search-input')?.value || "").trim();
            document.getElementById('store-search-clear')?.classList.toggle('hidden', !term);
            // Filtra o que já está carregado imediatamente (sem custo)
            renderStoreProducts();
            if (!apiLive || term.length < 2) return;
            // Busca no cache do Supabase (não grava nada) com debounce
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                loadOffersFromSupabase({ silent: true, reset: true, keyword: term });
            }, 400);
        }

        function scrollToStoreGrid() {
            document.getElementById('store-grid-section').scrollIntoView({ behavior: 'smooth' });
        }

        let modalImageToken = 0;

        // A miniatura já veio no card, então aparece na hora; a versão grande
        // entra por cima só quando termina de baixar, sem tela cinza no meio.
        function setModalImage(url) {
            const el = document.getElementById('modal-img');
            if (!el) return;
            const token = ++modalImageToken;
            el.src = thumbUrl(url);

            const big = new Image();
            big.decoding = 'async';
            big.onload = () => { if (token === modalImageToken) el.src = big.src; };
            big.onerror = () => {
                if (token !== modalImageToken || big.src === url) return;
                big.onerror = null;
                big.src = url;
            };
            big.src = displayUrl(url);
        }

        // Abre o popup com as informações do produto para o cliente
        function openProductModal(id, section = null) {
            const p = productsDatabase.find(prod => String(prod.id) === String(id));
            if (!p) {
                console.warn('[modal] produto não encontrado:', id);
                return;
            }
            activeProductForBuy = p;
            if (section) currentNavSection = section;

            const catLabel = (categories.find(c => c.id === p.category) || {}).label || p.category || 'Oferta';
            const disc = displayDiscount(p);
            const rating = formatRating(p.stars);
            const sold = formatSold(p.salesRaw != null ? p.salesRaw : p.sales);
            const shop = cleanShopName(p.shopName);

            setModalImage(p.image || '');
            document.getElementById('modal-discount').innerText = disc ? `-${disc}% OFF` : 'OFERTA';
            document.getElementById('modal-category').innerText = catLabel;
            document.getElementById('modal-title').innerText = p.title || 'Produto';
            document.getElementById('modal-sales').innerText = [rating ? `★ ${rating}` : '', sold].filter(Boolean).join(' · ');
            document.getElementById('modal-old-price').innerText = (p.oldPrice && p.oldPrice > p.newPrice)
                ? `De: R$ ${Number(p.oldPrice).toFixed(2).replace('.', ',')}` : '';
            document.getElementById('modal-new-price').innerText = `R$ ${Number(p.newPrice).toFixed(2).replace('.', ',')}`;

            const optionsBox = document.getElementById('modal-options');
            const optionsHint = document.getElementById('modal-options-hint');
            const optionLabels = formatProductOptions(p);
            if (optionsBox) {
                if (optionLabels.length || (p.options && p.options.hasVariants)) {
                    optionsBox.innerHTML = renderOptionBadges(p, false);
                    optionsBox.classList.remove('hidden');
                } else {
                    optionsBox.innerHTML = '';
                    optionsBox.classList.add('hidden');
                }
            }
            if (optionsHint) {
                // Dica de variação vai na lista de benefícios — evita texto corrido duplicado
                optionsHint.textContent = '';
                optionsHint.classList.add('hidden');
            }

            const starsBox = document.getElementById('modal-stars');
            starsBox.innerHTML = rating
                ? `<span class="text-amber-500 mr-1">★</span><span class="text-slate-700 font-bold">${rating}</span>`
                : '';

            const shopWrap = document.getElementById('modal-shop');
            if (shop) {
                document.getElementById('modal-shop-name').innerText = shop;
                shopWrap.classList.remove('hidden');
                shopWrap.classList.add('flex');
            } else {
                shopWrap.classList.add('hidden');
                shopWrap.classList.remove('flex');
            }

            const benefitsEl = document.getElementById('modal-benefits');
            if (benefitsEl) {
                const items = [];
                if (disc) {
                    items.push(`Oferta com <strong>${disc}% de desconto</strong> aplicado.`);
                }
                if (sold) {
                    items.push(`Já foram <strong>${escapeHtml(String(sold))}</strong> nesta seleção.`);
                }
                const hasVariants = optionLabels.length || (p.options && p.options.hasVariants)
                    || (p.oldPrice && p.newPrice && p.oldPrice > p.newPrice * 1.02);
                if (hasVariants) {
                    items.push('Variações (cores/tamanhos) disponíveis na página do produto.');
                }
                if (shop) {
                    items.push(`Vendido e entregue por <strong>${escapeHtml(shop)}</strong>.`);
                }
                items.push('Frete e prazo finais são confirmados na Shopee.');
                benefitsEl.innerHTML = items.map((t) => `
                    <li class="flex items-start gap-2">
                        <span class="mt-0.5 shrink-0 h-[18px] w-[18px] rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center justify-center">✓</span>
                        <span>${t}</span>
                    </li>`).join('');
            }

            const deadlineEl = document.getElementById('modal-deadline');
            const now = Math.floor(Date.now() / 1000);
            if (deadlineEl) {
                // periodEnd da Shopee às vezes vem com anos à frente → esconde se > 7 dias
                const MAX_URGENCY_H = 168;
                if (p.periodEnd && p.periodEnd > now) {
                    const left = p.periodEnd - now;
                    const h = Math.floor(left / 3600);
                    const m = Math.floor((left % 3600) / 60);
                    if (h > MAX_URGENCY_H) {
                        deadlineEl.textContent = '';
                        deadlineEl.classList.add('hidden');
                    } else {
                        deadlineEl.innerHTML = `<i class="fas fa-clock animate-pulse"></i> Termina em ${h}h ${m}min — aproveite enquanto a oferta estiver válida.`;
                        deadlineEl.classList.remove('hidden');
                    }
                } else {
                    deadlineEl.textContent = '';
                    deadlineEl.classList.add('hidden');
                }
            }

            const buyBtn = document.getElementById('modal-buy-btn');
            const buyLabel = document.getElementById('modal-buy-label');
            if (buyLabel) buyLabel.textContent = 'Comprar na Shopee';
            buyBtn.href = p.shortLink || p.affiliateLink || '#';
            buyBtn.dataset.itemId = String(p.id);
            buyBtn.dataset.category = String(p.category || 'todos');
            buyBtn.dataset.origin = p.affiliateLink || p.productLink || '';
            buyBtn.dataset.section = section || currentNavSection || 'modal_direct';

            const modal = document.getElementById('product-modal');
            const card = document.getElementById('modal-card');
            if (!modal || !card) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                modal.classList.remove('opacity-0');
                card.classList.remove('scale-95');
            });
            // Prefetch shortlink com Sub IDs do canal — CTA pronto no clique
            if (!hasMatchingTrackedLink(p)) {
                resolveAffiliateUrl(p).then((url) => {
                    if (url && url !== '#' && activeProductForBuy && String(activeProductForBuy.id) === String(p.id)) {
                        buyBtn.href = url;
                    }
                }).catch(() => {});
            }
        }

        // Alfanumérico puro — Shopee rejeita "_" e "-" ao gerar shortlink.
        const SITE_SUBID = 'afiliadamestre';
        const TRACKING_STORAGE_KEY = 'afiliada_mestre_traffic_v1';
        const TRACKED_LINKS_KEY = 'afiliada_mestre_tracked_links';

        // Sub IDs Shopee só aceitam alfanumérico — "_" e "-" quebram como "invalid sub id".
        function sanitizeSubId(value, fallback) {
            const clean = String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .slice(0, 40);
            return clean || fallback;
        }

        function normalizeChannel(raw) {
            const v = sanitizeSubId(raw, 'organico');
            const aliases = {
                fb: 'facebook',
                face: 'facebook',
                ig: 'instagram',
                insta: 'instagram',
                wa: 'whatsapp',
                wpp: 'whatsapp',
                zap: 'whatsapp',
                tt: 'tiktok',
                googleads: 'google',
                ads: 'google',
                direct: 'organico',
                organic: 'organico',
                none: 'organico',
                site: 'organico',
            };
            return aliases[v] || v;
        }

        function readStoredAttribution() {
            try {
                return JSON.parse(sessionStorage.getItem(TRACKING_STORAGE_KEY) || 'null')
                    || JSON.parse(localStorage.getItem(TRACKING_STORAGE_KEY) || 'null')
                    || null;
            } catch (_) {
                return null;
            }
        }

        function persistAttribution(attr) {
            try {
                sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(attr));
                localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(attr));
            } catch (_) {}
        }

        // Captura origem da visita (Facebook Ads, Instagram, WhatsApp, etc.)
        // e guarda até o clique em Comprar — assim o Sub ID identifica a campanha.
        function captureTrafficAttribution() {
            const params = new URLSearchParams(location.search);
            const channelRaw = params.get('utm_source')
                || params.get('src')
                || params.get('canal')
                || params.get('source')
                || params.get('ref')
                || '';
            const campaignRaw = params.get('utm_campaign')
                || params.get('campanha')
                || params.get('campaign')
                || '';
            const mediumRaw = params.get('utm_medium') || params.get('medium') || '';

            if (channelRaw || campaignRaw) {
                const attr = {
                    channel: normalizeChannel(channelRaw || 'organico'),
                    campaign: sanitizeSubId(campaignRaw || 'vitrine', 'vitrine'),
                    medium: sanitizeSubId(mediumRaw, ''),
                    capturedAt: Date.now(),
                };
                persistAttribution(attr);
                return attr;
            }

            const existing = readStoredAttribution();
            if (existing?.channel) return existing;

            const fallback = {
                channel: 'organico',
                campaign: 'vitrine',
                medium: '',
                capturedAt: Date.now(),
            };
            persistAttribution(fallback);
            return fallback;
        }

        function getSubIdSettings() {
            const attr = readStoredAttribution() || captureTrafficAttribution();
            return {
                source: SITE_SUBID,
                channel: normalizeChannel(attr.channel || 'organico'),
                campaign: sanitizeSubId(attr.campaign || 'vitrine', 'vitrine'),
                medium: sanitizeSubId(attr.medium || '', ''),
            };
        }

        function getTrackingSubIds(category, itemId = '', product = null, section = null) {
            const s = getSubIdSettings();
            const catSlot = product?.subcategory
                ? sanitizeSubId(`${category || product.category}_${product.subcategory}`, sanitizeSubId(category || product.category, 'geral'))
                : sanitizeSubId(category || product?.category, 'geral');
            const base = Array.isArray(product?.subIds) && product.subIds.length
                ? product.subIds
                : [
                    SITE_SUBID,
                    'organico',
                    'vitrine',
                    catSlot,
                    sanitizeSubId(itemId ? `p${itemId}` : 'produto', 'produto'),
                ];
            const channelSlot = s.medium && s.medium !== s.channel
                ? sanitizeSubId(`${s.channel}_${s.medium}`, s.channel)
                : s.channel;
            const SECTION_CODES = {
                home: 'vitrine', home_hero: 'hh', flash_deals: 'fl', top_sellers: 'ts',
                big_discounts: 'bd', top_rated: 'tr', official_shops: 'of', category_page: 'ct',
                search_result: 'sr', modal_direct: 'md', destaque: 'vd', oficial: 'oficial',
            };
            const sec = section || currentNavSection || null;
            const sectionCode = sec && SECTION_CODES[sec] ? SECTION_CODES[sec] : (sec ? sanitizeSubId(sec, null) : null);
            const campaignDefault = !s.campaign || s.campaign === 'vitrine';
            const campaignSlot = campaignDefault && sectionCode ? sectionCode : s.campaign;
            return [
                SITE_SUBID,
                channelSlot,
                campaignSlot,
                sanitizeSubId(base[3] || catSlot, 'geral'),
                sanitizeSubId(base[4] || (itemId ? `p${itemId}` : 'produto'), 'produto'),
            ].slice(0, 5);
        }


        function parseUtmContent(utm) {
            const parts = String(utm || '')
                .split(/[|,;/]+/)
                .map(s => s.trim())
                .filter(Boolean);
            return {
                site: parts[0] || '',
                channel: parts[1] || '',
                campaign: parts[2] || '',
                category: parts[3] || '',
                product: parts[4] || '',
                raw: parts,
            };
        }

        function getSubIdSignature(category, itemId, product = null) {
            return getTrackingSubIds(category, itemId, product).join('|');
        }

        function hasMatchingTrackedLink(p) {
            if (!p?.shortLink) return false;
            try {
                const map = JSON.parse(sessionStorage.getItem(TRACKED_LINKS_KEY) || '{}');
                return map[String(p.id)] === getSubIdSignature(p.category, p.id, p);
            } catch (_) {
                return false;
            }
        }

        function rememberTrackedLink(p) {
            try {
                const map = JSON.parse(sessionStorage.getItem(TRACKED_LINKS_KEY) || '{}');
                map[String(p.id)] = getSubIdSignature(p.category, p.id, p);
                sessionStorage.setItem(TRACKED_LINKS_KEY, JSON.stringify(map));
            } catch (_) {}
        }


        const SAVED_CAMPAIGNS_KEY = 'afiliada_mestre_campanhas_v1';
        const deletedCampaignIds = new Set();


        async function ensureProductLoaded(itemId) {
            let p = productsDatabase.find(x => String(x.id) === String(itemId));
            if (p) return p;
            try {
                const res = await fetch(`${API_BASE}/api/ofertas/db?itemId=${encodeURIComponent(String(itemId))}`);
                const data = await res.json();
                if (res.ok && Array.isArray(data.products) && data.products.length) {
                    applyProducts(data.products, 'campaign', { append: true });
                    return productsDatabase.find(x => String(x.id) === String(itemId)) || data.products[0];
                }
            } catch (_) {}
            return null;
        }

        async function applyCampaignLanding() {
            const params = new URLSearchParams(location.search);
            const productId = params.get('produto') || params.get('product') || params.get('item');
            const multi = (params.get('produtos') || '')
                .split(/[,|]+/)
                .map(s => s.trim())
                .filter(Boolean);

            if (multi.length > 1 && !productId) {
                // Destaca só os produtos da campanha na grade
                const loaded = [];
                for (const id of multi.slice(0, 24)) {
                    const p = await ensureProductLoaded(id);
                    if (p) loaded.push(p);
                }
                if (loaded.length) {
                    applyProducts(loaded, 'campaign', { append: false, allowEmpty: false });
                    showToast(`${loaded.length} produtos desta campanha`, 'success');
                    scrollToStoreGrid();
                }
                return;
            }

            if (!productId) return;
            const p = await ensureProductLoaded(productId);
            if (!p) {
                showToast('Produto da campanha não encontrado na vitrine', 'error');
                return;
            }
            scrollToStoreGrid();
            requestAnimationFrame(() => openProductModal(p.id));
        }






        // Listeners do painel "Meu Site" — só disparam se admin.js já carregou
        document.getElementById("ms-days")?.addEventListener("change", () => {
            if (typeof window.loadMeuSiteSummary === "function") window.loadMeuSiteSummary();
        });
        document.getElementById("ms-only-me")?.addEventListener("change", () => {
            if (typeof window.loadMeuSiteSummary === "function") window.loadMeuSiteSummary();
        });




        // ======= FERRAMENTAS =======






        async function resolveAffiliateUrl(p) {
            if (!p) return '#';
            if (hasMatchingTrackedLink(p)) return p.shortLink;
            const origin = p.affiliateLink || p.productLink;
            if (!origin || origin === '#') return p.shortLink || '#';
            // Usa shortlink do DB imediatamente se existir; regenera em paralelo
            const fallback = p.shortLink || origin;
            try {
                const section = document.getElementById('modal-buy-btn')?.dataset?.section || currentNavSection || 'modal_direct';
                const res = await fetch(`${API_BASE}/api/shortlink`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originUrl: origin,
                        itemId: p.id,
                        subIds: getTrackingSubIds(p.category, p.id, p, section),
                    }),
                });
                const data = await res.json();
                if (res.ok && data.shortLink) {
                    p.shortLink = data.shortLink;
                    rememberTrackedLink(p);
                    const idx = productsDatabase.findIndex((x) => String(x.id) === String(p.id));
                    if (idx >= 0) productsDatabase[idx].shortLink = data.shortLink;
                    return data.shortLink;
                }
            } catch (_) {}
            return fallback;
        }

        /** Abre aba em sync (anti popup-blocker) e navega quando o shortlink chegar. */
        async function openAffiliateInNewTab(p, { labelEl = null } = {}) {
            if (!p) return;
            const immediate = (hasMatchingTrackedLink(p) && p.shortLink)
                || p.shortLink
                || p.affiliateLink
                || p.productLink
                || '';
            const tab = window.open(immediate && immediate !== '#' ? immediate : 'about:blank', '_blank');
            if (hasMatchingTrackedLink(p) && p.shortLink) return;
            if (labelEl) labelEl.textContent = 'Abrindo…';
            try {
                const url = await resolveAffiliateUrl(p);
                if (url && url !== '#') {
                    if (tab && !tab.closed) {
                        try { tab.location.href = url; } catch (_) {
                            window.location.href = url;
                        }
                    } else {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                    const btn = document.getElementById('modal-buy-btn');
                    if (btn) btn.href = url;
                }
            } finally {
                if (labelEl) labelEl.textContent = 'Comprar na Shopee';
            }
        }

        async function handleBuyClick(event) {
            const p = activeProductForBuy;
            if (!p) return true;
            const label = document.getElementById('modal-buy-label');
            const btn = document.getElementById('modal-buy-btn');
            if (hasMatchingTrackedLink(p) && p.shortLink) {
                if (btn) btn.href = p.shortLink;
                return true;
            }
            event.preventDefault();
            await openAffiliateInNewTab(p, { labelEl: label });
            return false;
        }

        async function buyFromCard(id, section = 'destaque') {
            const p = productsDatabase.find((prod) => String(prod.id) === String(id));
            if (!p) return;
            activeProductForBuy = p;
            if (section) currentNavSection = section;
            await openAffiliateInNewTab(p);
        }

        function closeProductModal() {
            const modal = document.getElementById('product-modal');
            const card = document.getElementById('modal-card');
            if (!modal || !card) return;
            modal.classList.add('opacity-0');
            card.classList.add('scale-95');
            document.body.style.overflow = '';
            setTimeout(() => {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }, 200);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeProductModal();
        });

        window.addEventListener('scroll', () => {
            const btn = document.getElementById('back-to-top-btn');
            if (!btn) return;
            const show = window.scrollY > 500;
            btn.classList.toggle('hidden', !show);
            btn.classList.toggle('flex', show);
        }, { passive: true });

        // ---- Gerenciador de produtos (filtros + seleção em massa) ----
        let adminSearchTerm = '';
        let adminFilterCategory = '';
        let adminFilterType = '';
        let adminFilterSort = 'recent';
        let adminSearchTimer = null;


        // Remove product

        // Update single inline affiliate links

        // Open Form


        // Salva produto manual — SEMPRE via API oficial da Shopee, com SITE_SUBID + shortlink real.

        // ---- Painel admin: estatísticas reais + auto-sync ----


        // Unified compatibility clipboard copier helper

        // Custom interactive visual toast notification
        function showToast(message, type = "success") {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            
            const isSuccess = type === "success";
            const bgClass = isSuccess ? "bg-slate-900 border-shopee-orange" : "bg-red-600 border-red-500";
            const icon = isSuccess ? '<i class="fas fa-check-circle text-shopee-orange mr-2"></i>' : '<i class="fas fa-exclamation-triangle text-white mr-2"></i>';

            toast.className = `${bgClass} text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between border transition-all duration-300 transform translate-y-3 opacity-0 select-none pointer-events-auto`;
            toast.innerHTML = `
                <div class="flex items-center font-semibold">
                    ${icon}
                    <span>${message}</span>
                </div>
            `;

            container.appendChild(toast);

            // Pop animation trigger
            setTimeout(() => {
                toast.classList.remove('translate-y-3', 'opacity-0');
            }, 10);

            // Close timer
            setTimeout(() => {
                toast.classList.add('translate-y-3', 'opacity-0');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 4000);
        }

        // API compartilhada para uploads/admin.js (só carrega em /admin)
        window.__AM = window.__AM || {};
        Object.assign(window.__AM, {
            get API_BASE() { return API_BASE; },
            get productsDatabase() { return productsDatabase; },
            set productsDatabase(v) { productsDatabase = v; },
            get categories() { return categories; },
            set categories(v) { categories = v; },
            get apiLive() { return apiLive; },
            get PAGE_SIZE() { return PAGE_SIZE; },
            isAdminMode, pathClean, navigateTo, applyRoute,
            applyProducts, loadOffersFromSupabase, loadCategoriesFromApi,
            showToast, escapeHtml, escapeAttr,
            formatSold, formatRating, displayDiscount, cleanShopName, isOfficialShop,
            sanitizeSubId, normalizeChannel, getTrackingSubIds, getSubIdSettings,
            SITE_SUBID,
            renderStoreProducts, renderCategories, renderHomeSections,
            moneyScoreOf, femaleOnly, sortByMoney,
            checkApiHealth, loadHeroProducts,
        });
        window.submitAdminLogin = function (e) {
            if (window.__AM_ADMIN && window.__AM_ADMIN.submitAdminLogin) return window.__AM_ADMIN.submitAdminLogin(e);
            return false;
        };
        window.logoutAdmin = function () {
            if (window.__AM_ADMIN && window.__AM_ADMIN.logoutAdmin) return window.__AM_ADMIN.logoutAdmin();
        };
        window.switchAdminView = function (v, o) {
            if (window.__AM_ADMIN && window.__AM_ADMIN.switchAdminView) return window.__AM_ADMIN.switchAdminView(v, o);
        };
        window.toggleAdminSidebar = function (f) {
            if (window.__AM_ADMIN && window.__AM_ADMIN.toggleAdminSidebar) return window.__AM_ADMIN.toggleAdminSidebar(f);
        };
        window.initAdminUi = async function (opts) {
            if (window.__AM_ADMIN && window.__AM_ADMIN.initAdminUi) return window.__AM_ADMIN.initAdminUi(opts);
        };

        async function loadAdminBundle() {
            if (window.__AM_ADMIN) return window.__AM_ADMIN;
            await new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "/uploads/admin.min.js";
                s.onload = () => resolve();
                s.onerror = () => reject(new Error("Falha ao carregar admin.js"));
                document.head.appendChild(s);
            });
            return window.__AM_ADMIN;
        }

        // setTimeout(0): garante que o arquivo inteiro já avaliou.
        function kickBootStorefront() {
            setTimeout(() => { bootStorefront().catch((e) => console.error("[boot]", e)); }, 0);
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", kickBootStorefront);
        } else {
            kickBootStorefront();
        }

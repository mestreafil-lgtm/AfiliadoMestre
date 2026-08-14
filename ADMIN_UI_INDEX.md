# ÍNDICE COMPLETO — Área Admin (Afiliada Mestre)

Documento-mestre para **outra IA redesenhar estrutura + visual**.  
Leia isto inteiro antes de editar HTML/JS. **Não invente páginas de menu.** Não remova IDs nem `onclick`.

---

## A. Como o admin funciona (arquitetura)

Não existem arquivos HTML separados por página. É **um SPA** no mesmo arquivo da vitrine:

| Peça | Arquivo |
|------|---------|
| Markup de todas as views | `uploads/painel_e_vitrine_afiliado_mestre.html` |
| Lógica | `uploads/admin.js` → build `uploads/admin.min.js` |
| CSS | `uploads/tailwind.css` + `<style>` no HTML (sidebar, `.conv-row`, `.shopee-gradient`) |
| APIs | `server/index.js`, `server/conversions.js`, `server/shopee.js` |

- URL: `/admin` ou `/admin/{view}`
- Troca de tela: `switchAdminView('view-key')` — mostra `#admin-view-{key}`, esconde as outras (classe `.admin-view` / `.active`)
- Login: `#admin-login-screen` (overlay) até `submitAdminLogin` ok; depois `#admin-panel-root`

**Views registradas em `ADMIN_VIEWS` (são exatamente estas 10 + login):**

```
0.  LOGIN                         (overlay, sem item de menu)
1.  dashboard                     Dashboard
2.  vitrine-preview               Preview Index
3.  catalogo                      Catálogo & Sync
4.  produtos                      Produtos
5.  duplicados                    Remover duplicados
6.  campanhas                     Criar campanha
7.  campanha-desempenho           Desempenho campanhas  (+ drawer de detalhe)
8.  desempenho                    Desempenho geral (conversões)
9.  meu-site                      Meu Site (vendas)
10. ferramentas                   Ferramentas & feeds
```

**Não existem no admin real** (não criar, a menos que o dono peça): Configurações, Notificações, Home extra, Minhas Vendas separado, Link Personalizado, Categorias e Botões, perfil do usuário, páginas de Settings. O mock visual tinha menus fake — **ignorar**.

**Sub-telas (não são itens de menu, mas fazem parte da estrutura):**
- Formulário “produto pela URL” dentro de Produtos (`#new-product-form-card`)
- Detalhe da campanha dentro de Desempenho campanhas (`#camp-perf-detail`)
- Relatório “Por canal” injetado em `#conversion-list` (`loadConversionSummary`)

**Overlays globais (mesmo HTML, também usados na vitrine):**
- `#product-modal` — popup do produto (cliente)
- `#toast-container`

---

## B. Menu lateral — árvore EXATA (não omitir nenhum)

```
#admin-sidebar  (260px, slate-900)

  HEADER BRAND
    ícone loja laranja + “Afiliada Mestre” + “Painel Shopee”
    botão fechar (mobile) → toggleAdminSidebar(false)

  NAV  (data-admin-view + switchAdminView + #nav-*)

    Grupo “Visão geral”
      #nav-dashboard           Dashboard              dashboard
      #nav-vitrine-preview     Preview Index [Ao vivo] vitrine-preview

    Grupo “Gestão de catálogo”
      #nav-catalogo            Catálogo & Sync        catalogo
      #nav-produtos            Produtos               produtos
      #nav-duplicados          Remover duplicados     duplicados

    Grupo “Campanhas & links”
      #nav-campanhas           Criar campanha         campanhas
      #nav-campanha-desempenho Desempenho campanhas   campanha-desempenho

    Grupo “Financeiro & vendas”
      #nav-desempenho          Desempenho geral       desempenho
      #nav-meu-site            Meu Site (vendas)      meu-site

    Grupo “Sistema”
      #nav-ferramentas         Ferramentas & feeds    ferramentas

  RODAPÉ
    link “Ver vitrine pública”  href="/"
    avatar “Admin / Sessão ativa”
    botão Sair → logoutAdmin()
    texto: “Clientes não veem este painel”
```

**Header do conteúdo** (sempre visível após login):
- hamburger mobile → `toggleAdminSidebar()`
- `#admin-page-title` / `#admin-page-subtitle` (preenchidos por `ADMIN_VIEWS`)
- botão “Preview Index” → `switchAdminView('vitrine-preview')`
- `#admin-api-badge`
- refresh → `loadAdminStats(); loadAutoStatus();`

**Main:** `#main-console-section` — é aqui que as 10 views entram.

---

## C. Página 0 — LOGIN

**ID:** `#admin-login-screen`  
**Form:** `#admin-login-form` → `submitAdminLogin(event)`

Estrutura:
1. Faixa `.shopee-gradient` — ícone sacola + título “Afiliada Mestre”
2. E-mail `#admin-login-user` (vazio, sem credencial de exemplo)
3. Senha `#admin-login-pass` (vazia)
4. Erro `#admin-login-error`
5. Submit `#admin-login-submit` “Acessar Console”
6. Link “Voltar à vitrine” → `/`

---

## D. Página 1 — DASHBOARD  `/admin`  `#admin-view-dashboard`

**Ao abrir:** `loadAdminStats()` + `loadAutoStatus()`  
**Título:** Dashboard · Visão geral da operação de afiliados

### D.1 Grid 4 KPI cards (clicáveis)
| Card | ID valor | Clique vai para |
|------|----------|-----------------|
| Produtos no banco | `#stat-db-products` | produtos |
| Categorias ativas | `#stat-db-categories` | catalogo |
| Auto-sync | `#stat-auto-state` + `#stat-auto-next` | catalogo |
| Última sincronização | `#stat-auto-last` + `#stat-auto-upserts` | desempenho |

Layout de cada card: label uppercase + número grande + ícone à direita. Classe `.admin-stat-card`.

### D.2 Ações rápidas (6 botões)
| Botão | Handler |
|-------|---------|
| Sync agora `#btn-run-auto` | `runAutoSyncNow()` |
| Destaques `#btn-top-perf` | `runTopPerformanceNow()` |
| Recarregar | `loadOffersFromSupabase({silent:false, reset:true})` |
| Produto manual | `switchAdminView('produtos'); openNewProductForm()` |
| Campanhas | `switchAdminView('campanhas')` |
| Vendas | `switchAdminView('desempenho')` |

### D.3 Faixa “Desempenho Shopee” (dark, clicável → desempenho)
- `#dash-conversion-total` conversões
- `#dash-conversion-commission` confirmado (só COMPLETED)
- CTA “Abrir relatório”

---

## E. Página 2 — PREVIEW INDEX  `/admin/vitrine-preview`  `#admin-view-vitrine-preview`

**Ao abrir:** iframe `src="/"` + `setPreviewDevice('desktop')`

Estrutura:
1. Barra: título “Simulador de vitrine ao vivo”
2. Toggles dispositivo: `#btn-device-desktop` / `#btn-device-tablet` / `#btn-device-mobile` → `setPreviewDevice`
3. Wrapper `#vitrine-preview-frame-wrap` (classes `preview-device-*`)
4. `<iframe id="vitrine-preview-iframe" src="/">` — **vitrine real**, não HTML fake
5. Link nova aba `/`

---

## F. Página 3 — CATÁLOGO & SYNC  `/admin/catalogo`  `#admin-view-catalogo`

**Ao abrir:** `populateAdminCategorySelect()` · `loadAutoStatus()` · `loadShortlinkStatus()` · preset Explorador `bestsellers`  
**Esta é a página mais densa.** 8 blocos empilhados. Redesenhar pode agrupar (tabs/accordion), **não apagar blocos**.

### F.1 Cobertura feminina 95/5
- Status `#coverage-status-line`
- Tabela `#coverage-table` (por categoria/sub: meta vs atual)
- Botões: `loadCoverageReport()` · `runCoverageFill()` `#btn-coverage-fill`

### F.2 Shortlinks pré-gerados
- `#shortlink-status-line` · barra `#shortlink-status-bar`
- `runShortlinkBackfill()` `#btn-shortlink-backfill` “Gerar tudo que falta”

### F.3 Mais dinheiro agora (fila)
- Top 20 femininos por score (comissão × vendas × nota)
- Lista `#money-queue-box`
- **Como o item aparece:**
  ```
  [foto 40×40] título (1 linha)
               preço · comissão% · score · shope.ee ou “sem shortlink”
               [Shortlink] [Copiar] [Abrir] [Explorar]
  ```
- Botões header: `renderMoneyQueue()` · `moneyQueueShortlinkTop()`

### F.4 Categorias da vitrine
- Painel `#admin-categories-panel` (mapa servidor: cat + subs + counts)
- Por linha: Keywords → Explorador · Sync
- `renderAdminCategoriesPanel()`

### F.5 Ofertas oficiais Shopee (`shopeeOfferV2`)
- Distinto das campanhas FB/IG
- Lista `#official-offers-box`
- **Item:** foto 40×40 + título + matchId/listType + botão “Explorador”
- Header: `loadOfficialShopeeOffers()` · na lista “Importar todas” `importOfficialShopeeOffers()`

### F.6 Explorador Shopee (bloco principal)
**Presets** `#explorer-presets`:
`female_money` · `bestsellers` · `topperf` · `commission` · `collection` · `shop` · `rated` · `budget`

**Campos (NÃO remover IDs):**
| ID | O que é |
|----|---------|
| `#admin-keyword` | textarea keywords |
| `#explorer-kw-count` | contador |
| `#admin-list-type` | 0–6 (recomendados … coleção) |
| `#admin-sort-type` | 1–5 |
| `#admin-limit` | 10/20/30/50 |
| `#admin-pages` | 1–5 páginas |
| `#admin-match-id` | collection/cat |
| `#admin-shop-id` | loja |
| `#admin-min-commission` | % |
| `#admin-min-rating` | nota |
| `#admin-min-sales` | vendas |
| `#admin-require-commission` | checkbox |
| `#explorer-mode-hint` | texto do modo |
| `#btn-explorer-search` | Pré-visualizar `runExplorerSearch({sync:false})` |
| `#btn-explorer-cancel` | cancelar |
| `#explorer-progress` + label/pct/bar | progresso |
| `#explorer-select-all` | selecionar todos |
| `#explorer-selection-meta` | “N selecionados” |
| Buscar e salvar tudo | `runExplorerSearch({sync:true})` |
| `#btn-explorer-save` | `saveExplorerSelection()` |
| `#explorer-status` | msgs |
| `#explorer-preview` | lista de resultados |

**Como o item aparece no Explorador:**
```
[☑] [foto 48×48]  título (até 2 linhas)
                  preço laranja · ★ nota · vendas · comissão% · score
                  badge Mall? · categoria/sub · keyword
```
Foto vem da API Shopee ao vivo (`p.image`). Fallback placeholder.

### F.7 Sync por categoria
- `#admin-cat-sync` · `#admin-cat-pages` (1–3)
- `adminSyncCategory()` `#btn-sync-cat`
- “Usar no Explorador”
- Status `#cat-sync-status`

### F.8 Alimentação automática
- Badge `#auto-enabled-badge`
- Log `#auto-status-box`
- `runAutoSyncNow()` · `runTopPerformanceNow()` · `resetVitrineAndRefill()`
- `loadAutoStatus()`

---

## G. Página 4 — PRODUTOS  `/admin/produtos`  `#admin-view-produtos`

**Ao abrir:** `renderConsoleProducts()` · `loadAdminCatalogFull({silent})` se necessário

### G.1 Toolbar
- `loadAdminCatalogFull({force:true})` “Carregar catálogo completo”
- `openNewProductForm()` “Produto manual”
- atalho Campanhas

### G.2 Formulário produto pela URL (hidden até abrir) `#new-product-form-card`
| ID | Campo |
|----|-------|
| `#add-source-url` | URL Shopee (obrigatória) |
| `#add-category` | categoria vitrine |
| `#add-subcategory` | texto livre |
| `#add-img-url` | imagem custom opcional |
| `#btn-save-product` | `saveNewProduct()` |
| `#add-product-result` | feedback |
Fecha: `closeNewProductForm()`

Puxa da API: nome, preço, comissão, avaliação, imagem oficial + gera link com SITE_SUBID.

### G.3 Lista do catálogo
Filtros:
- `#admin-search` · `#admin-filter-category` · `#admin-filter-type` (flash/normal) · `#admin-filter-sort` (recent/name/price/discount/commission) · `#admin-page-size` (12/24/48/100)
- Contadores `#count-db-items` `#count-db-loaded` `#admin-filter-summary`
- Seleção: `#admin-select-page` · selecionar filtrados · limpar seleção · limpar filtros
- Barra massa `#admin-bulk-bar` + `#admin-selected-count` → `addSelectedProductsToCampaign()`
- Lista `#console-products-list`
- Paginação `#console-pagination` `#admin-prev` `#admin-page-info` `#admin-next`

**Como o produto aparece:**
```
[☑] [foto 48×48]  título
                  [categoria] [RELÂMPAGO?]  R$ preço  -X%  comissão  #id
                  loja
                  [📢 campanha] [↗ abrir link] [🗑 excluir]
```
Foto: `p.image` do banco `ofertas`. Fallback placehold.co.

---

## H. Página 5 — REMOVER DUPLICADOS  `/admin/duplicados`  `#admin-view-duplicados`

**Ao abrir:** `scanCatalogDuplicates()`

Estrutura (1 card):
- Status `#duplicates-status-line`
- Botões: Analisar `scanCatalogDuplicates()` · Remover `#btn-remove-duplicates` `removeCatalogDuplicates()` · Analisar fracos `scanWeakOffers()` · Limpar fracos `#btn-purge-weak` `purgeWeakOffers()` · Atualizar top `refreshTopOffers()`
- Resultado duplicados `#duplicates-table`
  - Grupo: “Manter” (itemId, loja, shope.ee, score) + lista “Remover”
  - **Sem foto** hoje (só texto)
- Resultado fracos `#weak-offers-table` (hidden até analisar)

Critério: mesma loja+nome OU mesmo item/link; mantém melhor (shortlink + comissão + vendas).

---

## I. Página 6 — CRIAR CAMPANHA  `/admin/campanhas`  `#admin-view-campanhas`

**Ao abrir:** `renderCampaignSelectedProducts()` · `updateCampaignLinkPreview()` · `syncSavedCampaigns()`

### I.1 Formulário
| ID | Campo |
|----|-------|
| `#campaign-link-channel` | facebook, instagram, whatsapp, tiktok, stories, google, email, organico |
| `#campaign-link-name` | nome campanha (slot 3) |
| `#campaign-name-normalized` | hint |
| `#campaign-product-search` | busca ID / URL / nome |
| `#campaign-product-status` | |
| `#campaign-product-picker` | sugestões |
| `#campaign-selected-products` | chips selecionados |
| `#campaign-link-preview` | links gerados |
| `#subid-preview` | string dos 5 slots |

Botões: Buscar `addCampaignProductById()` · Escolher na lista (vai Produtos) · Copiar anúncio `copyCampaignLink()` · Gerar Shopee `generateCampaignShopeeLinks()` · Copiar Shopee `copyCampaignShopeeLinks()` · Salvar `saveCurrentCampaign()`

**Picker item:** foto 32×32 + nome  
**Selecionado:** foto 40×40 + nome + remover  
**Preview de link:** foto 36×36 por produto

Sem produtos = link da vitrine. Com produtos = 1 link por item.

### I.2 Como anunciar no Facebook/Meta (`#campaigns-section`)
Checklist 5 passos + botão “Ver campanhas e desempenho”.  
Campanhas salvas **não têm lista nesta página** — aparecem em Desempenho campanhas.

**Slots Sub ID (fixos):**
1. `afiliadamestre` (site)  
2. canal  
3. campanha  
4. categoria (no clique)  
5. produto `p`+ID (no clique)

---

## J. Página 7 — DESEMPENHO DE CAMPANHAS  `/admin/campanha-desempenho`  `#admin-view-campanha-desempenho`

**Ao abrir:** `loadCampaignPerformance({reset:true, pull:true})`  
Fonte: `GET /api/admin/campanhas/performance` (DB, `is_meu_site`, agrupa slot 3)

### J.1 Header
Nova campanha · `#camp-perf-days` 7/30/60/90 · `#camp-perf-status` Todos/PENDING/COMPLETED/CANCELLED/UNPAID · Atualizar

### J.2 KPIs
`#camp-perf-count` · `#camp-perf-conversions` · `#camp-perf-orders` · `#camp-perf-commission` · `#camp-perf-items`

### J.3 Lista `#camp-perf-list`
**Card de campanha (com fotos):**
```
[stack até 3 thumbs 48×48 +N]  nome  [Ativa | Sem vendas | Fora do painel]
                               canal · N produtos · data criação
                               1º produto +N
                               Canais · status dos pedidos · última venda
                               R$ comissão · N pedidos · conv · itens
                               [Copiar anúncio] [Copiar Shopee] [Editar] [Apagar]
                               “Ver detalhes →”
```
Clique no card → `openCampaignPerfDetail(key)`

### J.4 Detalhe (sub-página na mesma view) `#camp-perf-detail` hidden
- Título `#camp-perf-detail-title` · meta `#camp-perf-detail-meta`
- Stats `#camp-perf-detail-stats`
- Canais `#camp-perf-detail-channels`
- Produtos mais vendidos `#camp-perf-detail-products` — **foto + nome + R$**
- Pedidos `#camp-perf-detail-orders`
- Fecha: `closeCampaignPerfDetail()`

---

## K. Página 8 — DESEMPENHO GERAL  `/admin/desempenho`  `#admin-view-desempenho`

**Ao abrir:** `loadConversions({reset:true, pull:true})`  
Só pedidos com Sub ID slot1 = `afiliadamestre`.

### K.1 Header `#performance-section`
- `#conversion-days` 7/30/60/90
- hidden `#conversion-status`
- Atualizar Shopee `loadConversions({reset:true,forcePull:true})`
- Priorizar no sync `prioritizeConversionWinners()`
- Por canal `loadConversionSummary()` (substitui a lista por breakdown de canal)

### K.2 4 KPIs
| ID | Significado | Visual |
|----|-------------|--------|
| `#conversion-confirmed` | Σ COMPLETED | card verde sólido |
| `#conversion-estimated` | Σ PENDING+UNPAID | card âmbar sólido |
| `#conversion-orders` + `#conversion-total` + `#conversion-subids` | contagens | branco |
| `#conversion-cancelled` | qtd cancelados | rose |

### K.3 Funil `#conversion-funnel` — chips UNPAID → PENDING → COMPLETED → CANCELLED (JS)

### K.4 Abas + busca
- `#conversion-status-tabs` → `setConversionStatusFilter`
- `#conversion-search` → `onConversionSearch`
- `#conversion-filter-hint`

### K.5 Lista compacta `#conversion-list` (CSS `.conv-row` ~56px)
**Como o pedido aparece (COM FOTO):**
```
[foto 40×40]  nome produto (1 linha)
              Pedido {orderId} · data · loja     | campanha/canal | badge status
                                                                  label confirmado/estimativa/sem comissão
                                                                  R$ comissão
```
Foto: **não vem do conversionReport**. Enrich pelo `item_id` em `ofertas.image_url`. Sem match → placeholder.

### K.6 Paginação `#conversion-pagination`
`#conversion-page-size` 10/20/50 · prev/next · `#conversion-page-buttons` · `#conversion-page-info`

---

## L. Página 9 — MEU SITE  `/admin/meu-site`  `#admin-view-meu-site`

**Ao abrir:** `loadMeuSiteSummary({pull:true})`  
API: `GET /api/admin/meu-site/summary?days=&onlyMeuSite=`

### L.1 Header
`#ms-days` (1/7/30/60/90) · `#ms-only-me` · Atualizar `loadMeuSiteSummary({pull:true})` · Puxar Shopee `pullConversionsNow()`

### L.2 Card dark “Como ler seus ganhos” (verde / âmbar / cancelado)

### L.3 Funil `#ms-funnel`

### L.4 KPIs
| ID | Significado |
|----|-------------|
| `#ms-net` | net COMPLETED |
| `#ms-pending-net` | estimado |
| `#ms-orders` `#ms-orders-break` | total + breakdown |
| `#ms-cancel-count` `#ms-cancel-pct` `#ms-fraud-pct` | cancelamentos |
| `#ms-gross` `#ms-ticket` | bruta / ticket |
| `#ms-health` | hidden (texto saúde) |

### L.5 Tops (3 colunas) — **SEM FOTO hoje** (só texto)
- `#ms-top-items` nome · N vendas · id · R$
- `#ms-top-shops` loja · N vendas · R$
- `#ms-top-campaigns` campanha (slot 3) · R$

### L.6 Rodapé
`#ms-window` · `#ms-sample` · `reprocessSubIdsDry()` · `reprocessSubIdsRun()`

---

## M. Página 10 — FERRAMENTAS  `/admin/ferramentas`  `#admin-view-ferramentas`

**Ao abrir:** `loadFeedInventory()` · `loadShopeeHealth()`  
**Não é grade de produtos.** Tabelas/logs.

### M.1 Feeds
1. Inventário `listItemFeeds`
   - `#feed-inventory-mode` Todos/FULL/DELTA
   - `loadFeedInventory()` → `#feed-inventory-result`
   - **Tabela:** Data · Modo · Ref · Registros · Nome — **sem foto**
2. Rodar feed
   - `runFeed('feed-full')` · `runFeed('feed-delta')` → `#feed-result` (contagens upsert/erro)
3. Reverify métricas
   - `#refresh-metrics-batch` (default 60) · `#refresh-metrics-stale` (12h)
   - `runRefreshMetrics()` — atualiza sales/rating/comissão% no banco (efeito em Produtos/vitrine)

### M.2 Diagnóstico
1. Saúde API `#shopee-health-result` `loadShopeeHealth()` — últimas chamadas GraphQL (status, ms)
2. Comissão validada `validatedReport`
   - `#validated-id` · `loadValidatedReport()` · `#validated-result`

---

## N. Overlays (não são menu, mas existem no HTML)

### `#product-modal` (cliente / vitrine)
Foto grande `#modal-img` · desconto · categoria · título · estrelas · vendas · preço antigo/novo · opções · loja · benefícios · CTA Comprar `#modal-buy-btn`.  
Não redesenhar junto com o admin a menos que o pedido cubra a vitrine.

### `#toast-container` — toasts globais `showToast(msg, tipo)`

---

## O. O que a Shopee entrega × o que a UI mostra

### Conversões (`conversionReport` → tabela `conversions`)
pedido, status, produto, loja, comissão, utmContent/sub_id1–5, data.  
**Foto não vem nesse report** — join com `ofertas`.

### Catálogo (search / offers / feeds)
`item_id`, título, `image`, preço, loja, comissão %, sales, rating, short_link, sub_ids.

### Status → dinheiro (NÃO MISTURAR)
| Status | UI | Cor |
|--------|----|-----|
| COMPLETED | Você já ganhou / confirmado | Verde |
| PENDING + UNPAID | Ainda pode virar / estimativa | Âmbar |
| CANCELLED | Sem comissão | Rose |

Slot 1 = `afiliadamestre` = Meu Site.

---

## P. Mapa de fotos (todas as listas)

| Tela | Foto? | Tamanho | Fonte |
|------|-------|---------|-------|
| Explorador | sim | 48px | API ao vivo |
| Money queue | sim | 40px | ofertas |
| Ofertas oficiais | sim | 40px | API campanhas Shopee |
| Produtos | sim | 48px | ofertas |
| Campanha picker/sel. | sim | 32–40px | ofertas |
| Campanha desempenho card | sim (stack 3) | 48px | produtos da campanha |
| Detalhe campanha produtos | sim | ~48px | enrich |
| Conversões | sim | 40px | enrich ofertas |
| Meu Site tops | **não** | — | só texto |
| Duplicados | **não** | — | só texto |
| Ferramentas | **não** | — | tabela/log |
| Dashboard | não | — | números |

---

## Q. Regras para a IA de design

1. **As 10 views + login são o menu inteiro.** Não invente Configurações / Notificações / etc.
2. Preserve **todos** os IDs desta spec e os `onclick` / handlers do `admin.js`.
3. Pode reorganizar **layout** (tabs no Catálogo, cards mais densos), não apagar blocos F.1–F.8.
4. Lista de conversões = **linhas compactas** (`.conv-row`), nunca cards altos.
5. Verde/âmbar/rose = regra de dinheiro acima.
6. Preview = iframe `/`, não mock estático.
7. Rebuild: `npm run build:js` e `npm run build:css` (Tailwind precisa escanear `admin.js`).
8. Não colar JS do arquivo mock (`loadConversionReports`, login hardcoded, `MOCK_PRODUCTS`).
9. Classes geradas em JS precisam existir no CSS (ou no `<style>` do HTML).

---

## R. Prompt curto (copiar para outra IA)

```
Você vai melhorar ESTRUTURA e DESIGN do admin Afiliada Mestre.
Fonte da verdade: ADMIN_UI_INDEX.md (índice completo).

Há EXATAMENTE estas páginas:
Login, Dashboard, Preview Index, Catálogo & Sync, Produtos, Remover duplicados,
Criar campanha, Desempenho campanhas (+ detalhe), Desempenho geral, Meu Site, Ferramentas.

Tarefa:
- Redesene visual + hierarquia (Catálogo está denso demais; Conversões devem ser linhas compactas com foto)
- Mantenha TODOS os IDs, handlers e blocos listados no índice
- Dinheiro: COMPLETED=verde, PENDING+UNPAID=âmbar, CANCELLED=0
- Produtos/Explorador/Conversões/Campanhas: preserve foto + título + preço/comissão
- Ferramentas e Meu Site tops: sem inventar fotos se o índice diz que não têm
- Arquivos: uploads/painel_e_vitrine_afiliado_mestre.html + uploads/admin.js
- Depois: npm run build:js && npm run build:css
Não invente itens de menu. Não cole o HTML mock.
```

---

## S. Checklist (nada de menu omitido)

- [x] Login
- [x] Shell (sidebar 10 itens + header + rodapé)
- [x] Dashboard
- [x] Preview Index
- [x] Catálogo & Sync (8 blocos + Explorador completo + fotos)
- [x] Produtos (form URL + lista com foto + bulk)
- [x] Remover duplicados (+ fracos)
- [x] Criar campanha (form + Meta checklist + thumbs)
- [x] Desempenho campanhas (lista com fotos + detalhe)
- [x] Desempenho geral (KPIs + lista com foto + paginação)
- [x] Meu Site (KPIs + tops sem foto)
- [x] Ferramentas (feeds + diagnóstico, sem foto)
- [x] Overlays (modal produto, toast)
- [x] Páginas que NÃO existem (para não inventar)

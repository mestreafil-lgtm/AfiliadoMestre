"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

test("servidor publica somente assets permitidos e bloqueia relatórios administrativos", async (t) => {
  const app = require("../server/index");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const request = (pathname) => fetch(`http://127.0.0.1:${port}${pathname}`);

  for (const pathname of ["/server/index.js", "/package.json", "/Designer/support.js"]) {
    const response = await request(pathname);
    assert.equal(response.status, 404, `${pathname} não deve ser público`);
  }

  const asset = await request("/uploads/storefront.min.js");
  assert.equal(asset.status, 200);

  const adminPage = await request("/admin");
  assert.equal(adminPage.status, 200);

  for (const pathname of ["/api/campanhas-rastreio", "/api/conversions"]) {
    const response = await request(pathname);
    assert.ok(
      response.status === 401 || response.status === 503,
      `${pathname} deve negar acesso sem sessão antes de consultar dados`
    );
  }
});

test("admin é identificado antes do primeiro paint e mantém controles acessíveis", () => {
  const html = fs.readFileSync(
    path.join(ROOT, "uploads", "painel_e_vitrine_afiliado_mestre.html"),
    "utf8"
  );

  const earlyAdminMarker = html.indexOf("document.documentElement.classList.add('admin-mode')");
  const storefrontMarkup = html.indexOf('id="main-storefront-section"');
  assert.ok(earlyAdminMarker > 0 && earlyAdminMarker < storefrontMarkup);
  assert.match(html, /id="meta-capi-silence-modal"/);
  assert.match(html, /label for="admin-login-user"/);
  assert.match(html, /label for="admin-login-pass"/);
  assert.match(html, /aria-label="Abrir menu administrativo"/);
  assert.match(html, /class="admin-stat-card[^"]*" role="button" tabindex="0"/);
});

test("admin usa sessão ao carregar campanhas e não inicializa a vitrine pública", () => {
  const adminJs = fs.readFileSync(path.join(ROOT, "uploads", "admin.js"), "utf8");
  const storefrontJs = fs.readFileSync(path.join(ROOT, "uploads", "storefront.js"), "utf8");

  assert.match(
    adminJs,
    /adminFetch\(`\$\{API_BASE\}\/api\/campanhas-rastreio`\)/
  );

  const bootStart = storefrontJs.indexOf("async function bootStorefront()");
  const bootEnd = storefrontJs.indexOf("function scheduleHomeSections()", bootStart);
  const boot = storefrontJs.slice(bootStart, bootEnd);
  assert.match(boot, /if \(!admin\) \{\s*captureTrafficAttribution\(\)/);
  assert.match(boot, /if \(!admin\) \{\s*await applyRoute/);
});

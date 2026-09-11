"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getMetaCapiConfig,
  eventIdForConversion,
  buildPurchaseEvent,
  sendMetaPurchase,
} = require("../server/metaCapi");

function conversion(overrides = {}) {
  return {
    conversion_id: 242525858128294,
    purchase_time: new Date().toISOString(),
    order_id: "260908F9QSCCP0",
    item_id: 58215637914,
    item_price: 16.99,
    actual_amount: 16.99,
    qty: 1,
    sub_id2: "cf8c66bbbd5fb8f8b28f8d44c34f9b70",
    ...overrides,
  };
}

function click(overrides = {}) {
  return {
    session_id: "50b87030-6651-4dd9-af6d-6fc1a68172df",
    user_agent: "Mozilla/5.0 Test",
    raw: {
      fbc: "fb.1.1788820000000.click",
      fbp: "fb.1.1788820000000.browser",
      url: "https://www.afiliadamestre.com/p/58215637914?utm_campaign=afiliadamestre09",
    },
    ...overrides,
  };
}

test("CAPI fica desligada sem ativação explícita", () => {
  const config = getMetaCapiConfig({
    META_PIXEL_ID: "123",
    META_CAPI_ACCESS_TOKEN: "secret",
  });
  assert.equal(config.mode, "off");
  assert.equal(config.configured, false);
});

test("modo test exige token e test_event_code", () => {
  assert.equal(getMetaCapiConfig({ META_CAPI_MODE: "test" }).configured, false);
  assert.equal(getMetaCapiConfig({
    META_CAPI_MODE: "test",
    META_PIXEL_ID: "123",
    META_CAPI_ACCESS_TOKEN: "secret",
    META_CAPI_TEST_EVENT_CODE: "TEST123",
  }).configured, true);
});

test("Purchase usa event_id determinístico e dados de match do clique", () => {
  const event = buildPurchaseEvent(conversion(), click(), { actionSource: "website" });
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "shopee_242525858128294");
  assert.equal(event.event_id, eventIdForConversion(242525858128294));
  assert.equal(event.action_source, "website");
  assert.equal(event.custom_data.currency, "BRL");
  assert.equal(event.custom_data.value, 16.99);
  assert.deepEqual(event.custom_data.content_ids, ["58215637914"]);
  assert.equal(event.user_data.fbc, "fb.1.1788820000000.click");
  assert.equal(event.user_data.fbp, "fb.1.1788820000000.browser");
  assert.equal(event.user_data.client_user_agent, "Mozilla/5.0 Test");
});

test("rejeita evento antigo demais para a janela da Meta", () => {
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.throws(
    () => buildPurchaseEvent(conversion({ purchase_time: old }), click(), { actionSource: "website" }),
    /mais de 7 dias/
  );
});

test("envia somente para Test Events quando modo é test", async () => {
  const config = getMetaCapiConfig({
    META_CAPI_MODE: "test",
    META_PIXEL_ID: "123",
    META_CAPI_ACCESS_TOKEN: "secret",
    META_CAPI_TEST_EVENT_CODE: "TEST123",
    META_GRAPH_API_VERSION: "v26.0",
  });
  let request;
  const fetchMock = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events_received: 1, fbtrace_id: "trace" }),
    };
  };
  const event = buildPurchaseEvent(conversion(), click(), config);
  const response = await sendMetaPurchase(event, config, fetchMock);
  assert.equal(response.events_received, 1);
  assert.equal(request.url, "https://graph.facebook.com/v26.0/123/events");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.equal(request.body.test_event_code, "TEST123");
  assert.deepEqual(request.body.data, [event]);
});

test("silêncio dispara alerta após X horas sem Purchase", async () => {
  const { silenceConfig } = require("../server/metaCapi");
  const silence = silenceConfig({
    META_CAPI_SILENCE_HOURS: "6",
    META_CAPI_ALERT_COOLDOWN_HOURS: "6",
    META_CAPI_ALERT_WEBHOOK: "https://example.com/hook",
  });
  assert.equal(silence.silenceHours, 6);
  assert.equal(silence.webhook, "https://example.com/hook");
});

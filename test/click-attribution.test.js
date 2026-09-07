"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CLICK_ID_RE,
  createClickId,
  normalizeClickId,
  buildClickSubIds,
} = require("../server/clickAttribution");

test("gera click_id único compatível com SubID Shopee", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => createClickId()));
  assert.equal(ids.size, 1000);
  for (const id of ids) {
    assert.equal(id.length, 32);
    assert.match(id, CLICK_ID_RE);
  }
});

test("mantém campanha no sub_id1 e clique no sub_id2", () => {
  const clickId = "c1234567890abcdef1234567890abcde";
  assert.deepEqual(
    buildClickSubIds("Afiliada Mestre 09", clickId),
    ["afiliadamestre09", clickId]
  );
});

test("rejeita click_id adulterado", () => {
  assert.equal(normalizeClickId("uuid-com-hifens"), null);
  assert.throws(
    () => buildClickSubIds("afiliadamestre09", "uuid-com-hifens"),
    /click_id invalido/
  );
});

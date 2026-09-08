"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  productIdsOfCampaign,
  buildCampaignProductMap,
  classifyOrganicAttribution,
} = require("../server/organicSales");

test("extrai produtos salvos em formatos diferentes", () => {
  assert.deepEqual(
    [...productIdsOfCampaign({
      products: [{ id: 101 }, { itemId: "202" }, { item_id: 303 }, "404"],
    })],
    ["101", "202", "303", "404"]
  );
});

test("classifica acesso sem campanha como orgânico direto", () => {
  const result = classifyOrganicAttribution({
    itemId: 101,
    subId1: "afiliadamestre",
    subId3: "vitrine",
    campaignProducts: new Map(),
  });
  assert.equal(result.type, "organic_direct");
});

test("não trata campanha interna vitrine como anúncio", () => {
  const campaigns = buildCampaignProductMap([
    { id: "interno", campaign: "vitrine", products: [{ id: 101 }] },
  ]);
  const result = classifyOrganicAttribution({
    itemId: 202,
    subId1: "afiliadamestre",
    subId3: "vitrine",
    campaignProducts: campaigns,
  });
  assert.equal(result.type, "organic_direct");
});

test("exclui produto anunciado da lista orgânica", () => {
  const campaigns = buildCampaignProductMap([
    { id: "afiliadamestre09", campaign: "afiliadamestre09", products: [{ id: 101 }] },
  ]);
  const result = classifyOrganicAttribution({
    itemId: 101,
    subId1: "afiliadamestre09",
    campaignProducts: campaigns,
  });
  assert.equal(result.type, "campaign_product");
  assert.equal(result.campaign, "afiliadamestre09");
});

test("classifica outro produto como venda assistida pela campanha", () => {
  const campaigns = buildCampaignProductMap([
    { id: "afiliadamestre09", campaign: "afiliadamestre09", products: [{ id: 101 }] },
  ]);
  const result = classifyOrganicAttribution({
    itemId: 202,
    subId1: "afiliadamestre09",
    campaignProducts: campaigns,
  });
  assert.equal(result.type, "campaign_assisted");
  assert.equal(result.campaign, "afiliadamestre09");
});

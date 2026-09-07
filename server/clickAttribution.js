"use strict";

const crypto = require("crypto");
const { sanitizeSubId } = require("./tracking");

const CLICK_ID_RE = /^c[a-f0-9]{31}$/;

function createClickId() {
  return `c${crypto.randomBytes(16).toString("hex").slice(0, 31)}`;
}

function normalizeClickId(value) {
  const clean = String(value || "").trim().toLowerCase();
  return CLICK_ID_RE.test(clean) ? clean : null;
}

function buildClickSubIds(campaign, clickId = createClickId()) {
  const campaignId = sanitizeSubId(campaign, "");
  const normalizedClickId = normalizeClickId(clickId);
  if (!campaignId || !normalizedClickId) {
    const err = new Error("campanha ou click_id invalido");
    err.status = 400;
    throw err;
  }
  return [campaignId, normalizedClickId];
}

module.exports = {
  CLICK_ID_RE,
  createClickId,
  normalizeClickId,
  buildClickSubIds,
};

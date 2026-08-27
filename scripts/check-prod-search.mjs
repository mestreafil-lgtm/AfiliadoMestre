import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    }).on("error", reject);
  });
}

const home = await get("https://www.afiliadamestre.com/");
console.log("home status", home.status);
console.log("store-search-btn", home.body.includes("store-search-btn"));
console.log("runStoreSearch", home.body.includes("runStoreSearch"));
console.log("data-search-active", home.body.includes("data-search-active"));
console.log("store-grid-title-text", home.body.includes("store-grid-title-text"));
const m = home.body.match(/storefront\.min\.js\?v=[^"']+/);
console.log("js ref", m && m[0]);
console.log("cf-cache", home.headers["cf-cache-status"] || "-");

const api = await get("https://www.afiliadamestre.com/api/ofertas/db?keyword=legging&limit=5&sort=sales");
const j = JSON.parse(api.body);
console.log("api count", j.count, "error", j.error || null);
if (j.products && j.products[0]) console.log("first", j.products[0].title.slice(0, 60));

const health = await get("https://www.afiliadamestre.com/api/health");
console.log("health", health.body);

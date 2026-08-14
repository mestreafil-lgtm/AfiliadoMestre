import fs from "fs";
const html = fs.readFileSync("uploads/painel_e_vitrine_afiliado_mestre.html", "utf8");
const start = html.indexOf("<!-- ADMIN PANEL");
const end = html.indexOf("<!-- POPUP DE DETALHES");
const chunk = html.slice(start, end);
const lines = chunk.split(/\n/);
let depth = 0;
const absBase = html.slice(0, start).split(/\n/).length;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div\b/gi) || []).length;
  const closes = (line.match(/<\/div>/gi) || []).length;
  const before = depth;
  depth += opens - closes;
  if (opens || closes) {
    if (depth < 2 || before < 2 || i > lines.length - 15 || /admin-panel-root|admin-shell|main-wrap|<\/main>/.test(line)) {
      console.log(String(absBase + i).padStart(5), `d:${before}->${depth}`, `+${opens}-${closes}`, line.trim().slice(0, 110));
    }
  }
}
console.log("FINAL", depth);
console.log("opens", (chunk.match(/<div\b/gi) || []).length, "closes", (chunk.match(/<\/div>/gi) || []).length);

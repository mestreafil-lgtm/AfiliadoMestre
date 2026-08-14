import fs from "fs";
const html = fs.readFileSync("uploads/painel_e_vitrine_afiliado_mestre.html", "utf8");
const start = html.indexOf("<!-- ADMIN PANEL");
const end = html.indexOf("<!-- POPUP DE DETALHES");
const chunk = html.slice(start, end);
const lines = chunk.split(/\n/);
let depth = 0;
const events = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const openTags = line.match(/<div\b[^>]*(?<!\/)>/gi) || [];
  // rough: count <div and </div, ignore self-closing
  const opens = (line.match(/<div\b/gi) || []).length;
  const closes = (line.match(/<\/div>/gi) || []).length;
  // subtract self-closing-ish rare cases
  for (let o = 0; o < opens; o++) depth++;
  for (let c = 0; c < closes; c++) {
    depth--;
    if (depth < 0) {
      events.push({ line: i + 1, abs: html.slice(0, start).split(/\n/).length + i, depth, text: line.trim().slice(0, 120) });
      depth = 0; // resync for further reporting
    }
  }
}
console.log("final depth", depth);
console.log("negative events", events.slice(0, 20));
// also find sections with high close spikes
let d = 0;
const spikes = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div\b/gi) || []).length;
  const closes = (line.match(/<\/div>/gi) || []).length;
  d += opens - closes;
  if (closes >= 2 || (closes && opens === 0 && d < 5)) {
    if (closes > opens) spikes.push({ i: i + 1, d, opens, closes, text: line.trim().slice(0, 100) });
  }
}
console.log("close-heavy lines", spikes.filter(s => s.closes > s.opens).slice(0, 40));

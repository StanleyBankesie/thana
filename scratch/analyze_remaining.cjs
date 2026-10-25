const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith(".jsx")) {
      results.push(full);
    }
  });
  return results;
}

const files = walk("client/src/pages/modules/project-management");

const pattern = /\b(bg-slate-50(?:\/\d+)?|bg-slate-100(?:\/\d+)?|bg-gray-50|bg-gray-100|bg-\[#f8f9fa\]|bg-slate-850)\b/;

const categorized = {
  hoverState: [],
  badgeOrPill: [],
  containerOrCard: [],
  input: [],
  other: []
};

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const rel = path.relative(".", f).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    if (pattern.test(line)) {
      const isHeading = /<thead\b|<th\b|table thead|SortableHeader/.test(line);
      if (isHeading) return;

      const trimmed = line.trim();
      if (/hover:bg-/.test(trimmed)) {
        categorized.hoverState.push({ file: rel, line: trimmed, lineNum: idx + 1 });
      } else if (/badge|rounded-full.*text-\[10px\]|rounded-full.*text-xs/.test(trimmed)) {
        categorized.badgeOrPill.push({ file: rel, line: trimmed, lineNum: idx + 1 });
      } else if (/<input|<select|<textarea/.test(trimmed)) {
        categorized.input.push({ file: rel, line: trimmed, lineNum: idx + 1 });
      } else if (/<div|<section|<article/.test(trimmed)) {
        categorized.containerOrCard.push({ file: rel, line: trimmed, lineNum: idx + 1 });
      } else {
        categorized.other.push({ file: rel, line: trimmed, lineNum: idx + 1 });
      }
    }
  });
});

console.log("Hover states:", categorized.hoverState.length);
console.log("Badges/Pills:", categorized.badgeOrPill.length);
console.log("Inputs:", categorized.input.length);
console.log("Containers/Cards:", categorized.containerOrCard.length);
console.log("Other:", categorized.other.length);

console.log("\n--- Containers / Cards (" + categorized.containerOrCard.length + ") ---");
categorized.containerOrCard.forEach(c => console.log(`${c.file}:${c.lineNum}: ${c.line}`));

console.log("\n--- Inputs (" + categorized.input.length + ") ---");
categorized.input.forEach(c => console.log(`${c.file}:${c.lineNum}: ${c.line}`));

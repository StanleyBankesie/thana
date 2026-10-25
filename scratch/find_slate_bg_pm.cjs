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

const matches = [];

const pattern = /\b(bg-slate-50(?:\/\d+)?|bg-slate-100|bg-gray-50|bg-gray-100|bg-\[#f8f9fa\]|bg-slate-850)\b/;

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const rel = path.relative(".", f).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    if (pattern.test(line)) {
      // Check if it is a table heading
      const isTheadOrTh = /<thead\b|<th\b|table thead|SortableHeader/.test(line);
      matches.push({
        file: rel,
        lineNum: idx + 1,
        isTheadOrTh,
        line: line.trim()
      });
    }
  });
});

console.log("Total matches:", matches.length);
console.log("Non-table heading matches:", matches.filter(m => !m.isTheadOrTh).length);
console.log(JSON.stringify(matches.filter(m => !m.isTheadOrTh), null, 2));

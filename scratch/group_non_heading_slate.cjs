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

const byFile = {};

const pattern = /\b(bg-slate-50(?:\/\d+)?|bg-slate-100(?:\/\d+)?|bg-gray-50|bg-gray-100|bg-\[#f8f9fa\]|bg-slate-850)\b/;

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const rel = path.relative(".", f).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    if (pattern.test(line)) {
      // Check if it is a table heading
      // Heuristic: line contains thead, th, SortableHeader, or within thead block
      const isHeading = /<thead\b|<th\b|table thead|SortableHeader/.test(line);
      // Also check context: lines before and after
      const prevLines = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      const inThead = /<thead[\s\S]*?$/.test(prevLines) && !/<\/thead>[\s\S]*?$/.test(prevLines);

      if (!isHeading && !inThead) {
        if (!byFile[rel]) byFile[rel] = [];
        byFile[rel].push({ lineNum: idx + 1, text: line.trim() });
      }
    }
  });
});

console.log("Files with non-heading slate backgrounds:", Object.keys(byFile).length);
for (const [file, items] of Object.entries(byFile)) {
  console.log(`${file}: ${items.length} occurrences`);
}

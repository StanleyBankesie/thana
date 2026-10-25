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
console.log("Total JSX files:", files.length);

const results = [];
for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const rel = path.relative(".", f).replace(/\\/g, "/");
  const flags = [];

  if (/bg-indigo-[0-9]{3}/.test(content) || /text-indigo-[0-9]{3}/.test(content)) {
    flags.push("indigo-palette");
  }
  if (/bg-blue-600/.test(content) || /hover:bg-blue-700/.test(content)) {
    flags.push("blue-accent-buttons");
  }
  if (/bg-\[#[0-9a-fA-F]{3,8}\]/.test(content) || /text-\[#[0-9a-fA-F]{3,8}\]/.test(content)) {
    flags.push("arbitrary-hex");
  }
  if (/\bbg-gray-[0-9]{2,3}\b/.test(content) || /\btext-gray-[0-9]{2,3}\b/.test(content)) {
    flags.push("tailwind-gray-instead-of-slate");
  }
  if (content.includes("<table") && !content.includes("overflow-x-auto")) {
    flags.push("unwrapped-table");
  }
  if (content.includes("rounded-md") || content.includes("rounded-sm")) {
    flags.push("small-radii-legacy");
  }
  if (content.includes("shadow-lg") || content.includes("shadow-2xl")) {
    flags.push("heavy-shadows");
  }

  // Check header
  const hasH1 = content.includes("<h1");
  const hasBreadcrumbOrBack = /Back|ArrowLeft|ChevronLeft/.test(content);

  results.push({
    file: rel,
    flags,
    hasH1,
    hasBreadcrumbOrBack
  });
}

console.log(JSON.stringify(results.filter(r => r.flags.length > 0), null, 2));

const fs = require("fs");
const file = "client/src/pages/modules/project-management/construction/BOQManager.jsx";
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");

lines.forEach((l, i) => {
  if (/bg-slate-50|bg-slate-100|bg-slate-850/.test(l)) {
    const isHeading = /<thead\b|<th\b|table thead/.test(l);
    console.log(`${i+1} [${isHeading ? "HEADING" : "OTHER"}]: ${l.trim()}`);
  }
});

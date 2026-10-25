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

let modifiedFiles = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, "utf8");
  const orig = content;

  // Replace container and card background patterns
  const replacements = [
    ['bg-slate-50/70 dark:bg-slate-850', 'bg-white dark:bg-slate-900'],
    ['bg-slate-50 dark:bg-slate-850', 'bg-white dark:bg-slate-900'],
    ['bg-white dark:bg-slate-850', 'bg-white dark:bg-slate-900'],
    ['bg-slate-100/50 dark:bg-slate-900/50', 'bg-white dark:bg-slate-900'],
    ['bg-slate-50 dark:bg-slate-800/40 p-', 'bg-white dark:bg-slate-900 p-'],
    ['bg-slate-50 dark:bg-slate-800/60 p-', 'bg-white dark:bg-slate-900 p-'],
    ['bg-slate-50 dark:bg-slate-800/80 p-', 'bg-white dark:bg-slate-900 p-'],
    ['bg-slate-50 dark:bg-slate-800/60 border', 'bg-white dark:bg-slate-900 border'],
    ['bg-slate-50 dark:bg-slate-800/80 border', 'bg-white dark:bg-slate-900 border'],
    ['bg-slate-50 dark:bg-slate-800/80 rounded', 'bg-white dark:bg-slate-900 rounded'],
    ['bg-slate-50 dark:bg-slate-800/40 rounded', 'bg-white dark:bg-slate-900 rounded'],
    ['bg-slate-50 dark:bg-slate-800/60 rounded', 'bg-white dark:bg-slate-900 rounded'],
    ['bg-slate-50 dark:bg-slate-800 p-4', 'bg-white dark:bg-slate-900 p-4'],
    ['bg-slate-50 dark:bg-slate-800 p-5', 'bg-white dark:bg-slate-900 p-5'],
    ['bg-slate-50 dark:bg-slate-800 p-6', 'bg-white dark:bg-slate-900 p-6'],
    ['bg-slate-50 dark:bg-slate-800 rounded-lg border self-start', 'bg-white dark:bg-slate-900 rounded-lg border self-start'],
    ['bg-slate-50 dark:bg-slate-800" value={item.itemName}', 'bg-white dark:bg-slate-900" value={item.itemName}'],
    ['bg-slate-50 dark:bg-slate-800 font-mono" value={item.transferQty}', 'bg-white dark:bg-slate-900 font-mono" value={item.transferQty}'],
    ['bg-slate-100 dark:bg-slate-800/80 rounded-lg border', 'bg-white dark:bg-slate-900 rounded-lg border'],
  ];

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
    }
  }

  if (content !== orig) {
    fs.writeFileSync(f, content, "utf8");
    modifiedFiles++;
    console.log(`Updated: ${path.relative(".", f).replace(/\\/g, "/")}`);
  }
});

console.log("Total updated:", modifiedFiles);

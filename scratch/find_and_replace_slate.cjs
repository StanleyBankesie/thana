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

let totalReplacements = 0;
const report = [];

files.forEach(f => {
  let content = fs.readFileSync(f, "utf8");
  const rel = path.relative(".", f).replace(/\\/g, "/");
  let fileChanges = 0;

  // Patterns to replace when NOT in thead or th
  // 1. Common card toolbar: p-4 bg-slate-50 dark:bg-slate-800/50 border-b
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 border-b')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 border-b', 'bg-white dark:bg-slate-900 border-b');
    fileChanges++;
  }
  if (content.includes('bg-slate-50/70 dark:bg-slate-850 border-b')) {
    content = content.replaceAll('bg-slate-50/70 dark:bg-slate-850 border-b', 'bg-white dark:bg-slate-900 border-b');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-850 border-b')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-850 border-b', 'bg-white dark:bg-slate-900 border-b');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-850 border-t')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-850 border-t', 'bg-white dark:bg-slate-900 border-t');
    fileChanges++;
  }

  // 2. Input/select/textarea bg-slate-50 dark:bg-slate-800
  if (content.includes('bg-slate-50 dark:bg-slate-800 border')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800 border', 'bg-white dark:bg-slate-900 border');
    fileChanges++;
  }

  // 3. Card containers: bg-slate-50 dark:bg-slate-800/50 border
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 border')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 border', 'bg-white dark:bg-slate-900 border');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/60 border')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/60 border', 'bg-white dark:bg-slate-900 border');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/80 border')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/80 border', 'bg-white dark:bg-slate-900 border');
    fileChanges++;
  }

  // 4. Modal headers/footers with bg-slate-50
  if (content.includes('bg-slate-50 dark:bg-slate-850 flex')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-850 flex', 'bg-white dark:bg-slate-900 flex');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-700/40 p-5')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-700/40 p-5', 'bg-white dark:bg-slate-900 p-5');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 p-5')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 p-5', 'bg-white dark:bg-slate-900 p-5');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 p-4')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 p-4', 'bg-white dark:bg-slate-900 p-4');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 p-6')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 p-6', 'bg-white dark:bg-slate-900 p-6');
    fileChanges++;
  }
  if (content.includes('bg-slate-50 dark:bg-slate-800/50 rounded')) {
    content = content.replaceAll('bg-slate-50 dark:bg-slate-800/50 rounded', 'bg-white dark:bg-slate-900 rounded');
    fileChanges++;
  }

  if (fileChanges > 0) {
    fs.writeFileSync(f, content, "utf8");
    report.push({ file: rel, fileChanges });
    totalReplacements += fileChanges;
  }
});

console.log("Total files modified:", report.length);
console.log("Total pattern changes:", totalReplacements);
console.log(JSON.stringify(report, null, 2));

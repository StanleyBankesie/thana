const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.jsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('./client/src/pages');

let count = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  // Safe Replacements
  content = content.replace(/text-gray-900/g, 'text-slate-900 dark:text-slate-100');
  content = content.replace(/text-gray-800/g, 'text-slate-800 dark:text-slate-200');
  content = content.replace(/text-gray-700/g, 'text-slate-700 dark:text-slate-300');
  content = content.replace(/text-gray-600/g, 'text-slate-600 dark:text-slate-400');
  content = content.replace(/text-gray-500/g, 'text-slate-500 dark:text-slate-500');

  content = content.replace(/bg-gray-50/g, 'bg-slate-50 dark:bg-slate-800/50');
  content = content.replace(/bg-gray-100/g, 'bg-slate-100 dark:bg-slate-800');
  content = content.replace(/border-gray-200/g, 'border-slate-200 dark:border-slate-700');
  content = content.replace(/border-gray-300/g, 'border-slate-300 dark:border-slate-600');
  content = content.replace(/bg-white(?!\s+dark:)/g, 'bg-white dark:bg-slate-800');
  
  if (content !== original) {
    fs.writeFileSync(f, content);
    count++;
  }
});
console.log('Fixed dark mode in ' + count + ' files');

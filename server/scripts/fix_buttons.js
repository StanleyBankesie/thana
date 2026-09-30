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

const files = walk('./client/src');
const oldClassRegex = /className="([^"]*)border border-brand text-brand hover:bg-brand hover:text-white([^"]*)"/g;

let count = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (oldClassRegex.test(content)) {
    const newContent = content.replace(oldClassRegex, 'className="-brand-solid"');
    fs.writeFileSync(f, newContent);
    count++;
  }
});
console.log('Replaced in ' + count + ' files');

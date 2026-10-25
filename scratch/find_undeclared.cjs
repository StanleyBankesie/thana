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

let issues = [];

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  // JSX tag match <Component
  const matches = [...content.matchAll(/<([A-Z][a-zA-Z0-9]+)\b/g)].map(m => m[1]);
  const uniqueTags = [...new Set(matches)];
  
  const undeclared = [];
  uniqueTags.forEach(tag => {
    // Check if declared or imported (with multiline support)
    const hasImport = new RegExp(`import[\\s\\S]*?\\b${tag}\\b[\\s\\S]*?from`).test(content);
    const hasDecl = new RegExp(`(const|let|var|function|class)\\s+${tag}\\b`).test(content) ||
                    // Also check function arguments or props e.g. icon: Icon
                    new RegExp(`\\b${tag}\\b`).test(content.slice(0, content.indexOf("<" + tag)));
    if (!hasImport && !hasDecl) {
      undeclared.push(tag);
    }
  });

  if (undeclared.length > 0) {
    issues.push({ file: path.relative(".", f).replace(/\\/g, "/"), undeclared });
  }
});

console.log(JSON.stringify(issues, null, 2));

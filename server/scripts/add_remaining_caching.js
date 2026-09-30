const fs = require('fs');
const path = require('path');

const routesToCache = {
  'sales.route.js': ['"/orders"', '"/deliveries"', '"/returns"'],
  'finance.routes.js': ['"/vouchers"']
};

for (const [filename, endpoints] of Object.entries(routesToCache)) {
  const filePath = path.join(__dirname, '../server/routes', filename);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not exists
  if (!content.includes('cacheListResponse')) {
    const importStmt = 'import { cacheListResponse } from "../middleware/cache.middleware.js";\n';
    content = content.replace(/(import express from "express";\s*)/, `$1${importStmt}`);
  }

  // Inject middleware into specific endpoints
  let modified = false;
  for (const endpoint of endpoints) {
    // We want to find the specific router.get(endpoint, ...) block
    // and inject cacheListResponse(30) after requireBranchScope,
    const regex = new RegExp(`(router\\.get\\(\\s*${endpoint}[\\s\\S]*?requireBranchScope,)`, 'g');
    
    if (regex.test(content)) {
      content = content.replace(regex, `$1\n  cacheListResponse(30),`);
      modified = true;
      console.log(`Injected caching for ${endpoint} in ${filename}`);
    } else {
      console.log(`Could not find a match for injecting ${endpoint} in ${filename}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Saved ${filename}`);
  }
}

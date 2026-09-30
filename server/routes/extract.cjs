const fs = require('fs');
const code = fs.readFileSync('sales.route.js', 'utf8');

let result = 'import express from "express";\nimport { query } from "../db/pool.js";\nimport { checkAuth } from "../middleware/auth.js";\nconst router = express.Router();\nrouter.use(checkAuth);\n\n';

let lines = code.split('\n');
let insideRoute = false;
let braceCount = 0;
let parensCount = 0;

for (let line of lines) {
  if (!insideRoute && line.includes('router.') && line.includes('"/invoices')) {
    insideRoute = true;
    braceCount = 0;
    parensCount = 0;
  }

  if (insideRoute) {
    result += line + '\n';
    braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    parensCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    
    if (braceCount === 0 && parensCount === 0 && line.trim().endsWith(';')) {
      insideRoute = false;
      result += '\n';
    }
  }
}

result += 'export default router;\n';
result = result.replace(/sal_invoices/g, 'srv_service_invoices');
result = result.replace(/sal_invoice_details/g, 'srv_service_invoice_details');

fs.writeFileSync('srv_invoices.route.js', result);
console.log('Extraction complete, size:', result.length);

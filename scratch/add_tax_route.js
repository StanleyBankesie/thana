import fs from 'fs';

const filePath = './server/routes/finance.routes.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = 'router.put(\r\n  "/tax-components/:id",';
const targetLf = 'router.put(\n  "/tax-components/:id",';
const insertion = 'router.get(\n  "/tax-components",\n  requireAuth,\n  requireCompanyScope,\n  financeController.listAllTaxComponents,\n);\n\n';

if (content.includes(target)) {
  content = content.replace(target, insertion.replace(/\n/g, '\r\n') + target);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added /tax-components route (CRLF)');
} else if (content.includes(targetLf)) {
  content = content.replace(targetLf, insertion + targetLf);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added /tax-components route (LF)');
} else {
  console.error('Target not found in routes');
  process.exit(1);
}

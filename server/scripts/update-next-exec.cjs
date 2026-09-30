/**
 * Script to update nextServiceExecutionNo logic in purchase.routes.js.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes/purchase.routes.js');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /async function nextServiceExecutionNo\(companyId, branchId\) \{([\s\S]*?)WHERE company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)([\s\S]*?)LIMIT 1\s*`,\s*\{\s*companyId,\s*branchId,\s*branchIdsStr\s*\},/g,
  `async function nextServiceExecutionNo(companyId, branchId, branchIdsStr = '') {$1WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))$2LIMIT 1\n    \`,\n    { companyId, branchId, branchIdsStr },`
);

c = c.replace(
  /\(await nextServiceExecutionNo\(companyId, branchId\)\);/g,
  `(await nextServiceExecutionNo(companyId, branchId, branchIdsStr));`
);

fs.writeFileSync(file, c);
console.log("Updated nextServiceExecutionNo");

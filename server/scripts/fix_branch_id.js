const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/routes/sales.route.js');
let content = fs.readFileSync(filePath, 'utf8');

// The goal is to replace `FIND_IN_SET(branch_id, :branchIdsStr)` with `FIND_IN_SET(alias.branch_id, :branchIdsStr)`
// where alias is derived from the nearest `FROM table alias` or `UPDATE table alias`.

// For now, I will use a simple regex replacement for the UNION ALL queries in getRecentTransactions.
// q.branch_id
content = content.replace(/WHERE q\.company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)/g, "WHERE q.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(q.branch_id, :branchIdsStr))");

// o.branch_id
content = content.replace(/WHERE o\.company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)/g, "WHERE o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))");

// i.branch_id
content = content.replace(/WHERE i\.company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)/g, "WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr))");

// d.branch_id
content = content.replace(/WHERE d\.company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)/g, "WHERE d.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(d.branch_id, :branchIdsStr))");

// r.branch_id
content = content.replace(/WHERE r\.company_id = :companyId AND \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)/g, "WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fixed ambiguities in sales.route.js!");

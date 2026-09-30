const fs = require('fs');
let code = fs.readFileSync('finance.controller.js', 'utf8');
code = code.replace(/AND \(:branchId IS NULL OR \(:branchIdsStr = '' OR FIND_IN_SET\(branch_id, :branchIdsStr\)\)\)/g, "AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)");
fs.writeFileSync('finance.controller.js', code);

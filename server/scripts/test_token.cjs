const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'c:/Users/stanl/baseline/server/.env' });
const token = jwt.sign({ sub: 1, companyId: 1, branchId: 1, branchIdsStr: '1', roles: ['ADMIN'] }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);

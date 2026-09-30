const fs = require('fs');

const content = fs.readFileSync('../server/routes/sales.route.js', 'utf8');
const regex = /router\.(?:get|post|put|delete|patch)\(\s*["']([^"']+)["']/g;
let match;
const endpoints = new Set();
while ((match = regex.exec(content)) !== null) {
  endpoints.add(match[1]);
}
console.log(Array.from(endpoints).join(', '));

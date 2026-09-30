/**
 * Script to update purchase.routes.js validation logic to include order_id and execution_id.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes/purchase.routes.js');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /sc_date DATE NOT NULL,\s*supplier_id BIGINT UNSIGNED NOT NULL,/g,
  `sc_date DATE NOT NULL,
        order_id BIGINT UNSIGNED NULL,
        execution_id BIGINT UNSIGNED NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,`
);

c = c.replace(
  /status ENUM\('DRAFT','CONFIRMED','CANCELLED'\) NOT NULL DEFAULT 'DRAFT',/g,
  `status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',`
);

fs.writeFileSync(file, c);
console.log("Updated purchase.routes.js");

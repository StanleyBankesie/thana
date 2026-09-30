/**
 * Script to update purchase.controller.js with order_id and execution_id fields.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'controllers/purchase.controller.js');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /c\.status,(\s*)c\.total_amount,(\s*)s\.supplier_name,/g,
  `c.status,$1c.total_amount,$1c.order_id,$1c.execution_id,$2s.supplier_name,`
);

c = c.replace(
  /const scDate = body\.sc_date;\s*const supplierId = toNumber\(body\.supplier_id\);/g,
  `const scDate = body.sc_date;
    const supplierId = toNumber(body.supplier_id);
    const orderId = toNumber(body.order_id) || null;
    const executionId = toNumber(body.execution_id) || null;`
);

c = c.replace(
  /\(company_id, branch_id, sc_no, sc_date, supplier_id, total_amount, status, remarks, created_by\)\s*VALUES\s*\(:companyId, :branchId, :scNo, :scDate, :supplierId, :totalAmount, :status, :remarks, :createdBy\)/g,
  `(company_id, branch_id, sc_no, sc_date, supplier_id, order_id, execution_id, total_amount, status, remarks, created_by)
      VALUES
        (:companyId, :branchId, :scNo, :scDate, :supplierId, :orderId, :executionId, :totalAmount, :status, :remarks, :createdBy)`
);

c = c.replace(
  /supplierId,\s*totalAmount,\s*status,/g,
  `supplierId,
        orderId,
        executionId,
        totalAmount,
        status,`
);

c = c.replace(
  /SET sc_date = :scDate,\s*supplier_id = :supplierId,\s*total_amount = :totalAmount,/g,
  `SET sc_date = :scDate,
          supplier_id = :supplierId,
          order_id = :orderId,
          execution_id = :executionId,
          total_amount = :totalAmount,`
);


fs.writeFileSync(file, c);
console.log("Updated purchase.controller.js");

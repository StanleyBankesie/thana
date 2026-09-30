const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, 'server/controllers/transport.controller.js');
const routesPath = path.join(__dirname, 'server/routes/transport.route.js');

let controllerContent = fs.readFileSync(controllerPath, 'utf8');

const controllerAddition = `
// === FUEL BILLS ===
export const listFuelBills = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      "SELECT * FROM trans_fuel_bills WHERE company_id = :companyId ORDER BY id DESC",
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const items = await query("SELECT * FROM trans_fuel_bills WHERE id = :id", { id });
    const details = await query("SELECT * FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    res.json({ success: true, data: { ...items[0], items: details } });
  } catch (err) {
    next(err);
  }
};

export const createFuelBill = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    const result = await query(
      "INSERT INTO trans_fuel_bills (company_id, bill_no, bill_date, supplier_id, total_amount) VALUES (:companyId, :bill_no, :bill_date, :supplier_id, :total_amount)",
      { companyId, bill_no, bill_date: bill_date || new Date(), supplier_id: supplier_id || 0, total_amount: total_amount || 0 }
    );
    const billId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_fuel_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:billId, :item_id, :quantity, :unit_price, :total_amount)",
          { billId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true, data: { id: billId } });
  } catch (err) {
    next(err);
  }
};

export const updateFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    await query(
      "UPDATE trans_fuel_bills SET bill_no = :bill_no, bill_date = :bill_date, supplier_id = :supplier_id, total_amount = :total_amount WHERE id = :id",
      { bill_no, bill_date, supplier_id: supplier_id || 0, total_amount: total_amount || 0, id }
    );
    await query("DELETE FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_fuel_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    await query("DELETE FROM trans_fuel_bills WHERE id = :id", { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === TRANSPORT INVOICES / BILLING ===
export const getBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const items = await query("SELECT * FROM trans_invoices WHERE id = :id", { id });
    const details = await query("SELECT * FROM trans_invoice_details WHERE invoice_id = :id", { id });
    res.json({ success: true, data: { ...items[0], items: details } });
  } catch (err) {
    next(err);
  }
};

export const createBilling = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { invoice_no, invoice_date, customer_id, total_amount, items } = req.body;
    const result = await query(
      "INSERT INTO trans_invoices (company_id, invoice_no, invoice_date, customer_id, total_amount) VALUES (:companyId, :invoice_no, :invoice_date, :customer_id, :total_amount)",
      { companyId, invoice_no: invoice_no || 'INV-TEMP', invoice_date: invoice_date || new Date(), customer_id: customer_id || 0, total_amount: total_amount || 0 }
    );
    const invoiceId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_invoice_details (invoice_id, item_id, quantity, unit_price, total_amount) VALUES (:invoiceId, :item_id, :quantity, :unit_price, :total_amount)",
          { invoiceId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true, data: { id: invoiceId } });
  } catch (err) {
    next(err);
  }
};

export const updateBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { invoice_no, invoice_date, customer_id, total_amount, items } = req.body;
    await query(
      "UPDATE trans_invoices SET invoice_no = :invoice_no, invoice_date = :invoice_date, customer_id = :customer_id, total_amount = :total_amount WHERE id = :id",
      { invoice_no, invoice_date, customer_id: customer_id || 0, total_amount: total_amount || 0, id }
    );
    await query("DELETE FROM trans_invoice_details WHERE invoice_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_invoice_details (invoice_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM trans_invoice_details WHERE invoice_id = :id", { id });
    await query("DELETE FROM trans_invoices WHERE id = :id", { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
`;

if (!controllerContent.includes('listFuelBills')) {
  // modify listBilling inside controller Content
  controllerContent = controllerContent.replace(
    /export const listBilling = async \([\s\S]*?};\n/,
    `export const listBilling = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query("SELECT * FROM trans_invoices WHERE company_id = :companyId ORDER BY id DESC", { companyId });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};\n\n`
  );
  fs.writeFileSync(controllerPath, controllerContent + '\n' + controllerAddition);
}

let routesContent = fs.readFileSync(routesPath, 'utf8');
if (!routesContent.includes('listFuelBills')) {
  routesContent = routesContent.replace(
    'import {',
    `import {
  listFuelBills, getFuelBill, createFuelBill, updateFuelBill, deleteFuelBill,
  getBilling, createBilling, updateBilling, deleteBilling,`
  );
  
  routesContent = routesContent.replace(
    '// Billing\nrouter.get("/billing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.VIEW"), listBilling);',
    `// Billing
router.get("/billing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.VIEW"), listBilling);
router.get("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.VIEW"), getBilling);
router.post("/billing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), createBilling);
router.put("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), updateBilling);
router.delete("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), deleteBilling);

// Fuel Bills
router.get("/fuel-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), listFuelBills);
router.get("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), getFuelBill);
router.post("/fuel-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), createFuelBill);
router.put("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), updateFuelBill);
router.delete("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), deleteFuelBill);
`
  );
  fs.writeFileSync(routesPath, routesContent);
}

console.log("Backend routes and controllers updated successfully.");

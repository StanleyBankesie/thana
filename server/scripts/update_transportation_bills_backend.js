const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, 'server/controllers/transport.controller.js');
const routesPath = path.join(__dirname, 'server/routes/transport.route.js');

let controllerContent = fs.readFileSync(controllerPath, 'utf8');

const controllerAddition = `
// === TRANSPORTATION BILLS ===
export const listTransportationBills = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      "SELECT * FROM trans_transportation_bills WHERE company_id = :companyId ORDER BY id DESC",
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const items = await query("SELECT * FROM trans_transportation_bills WHERE id = :id", { id });
    const details = await query("SELECT * FROM trans_transportation_bill_details WHERE bill_id = :id", { id });
    res.json({ success: true, data: { ...items[0], items: details } });
  } catch (err) {
    next(err);
  }
};

export const createTransportationBill = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    const result = await query(
      "INSERT INTO trans_transportation_bills (company_id, bill_no, bill_date, supplier_id, total_amount) VALUES (:companyId, :bill_no, :bill_date, :supplier_id, :total_amount)",
      { companyId, bill_no, bill_date: bill_date || new Date(), supplier_id: supplier_id || 0, total_amount: total_amount || 0 }
    );
    const billId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_transportation_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:billId, :item_id, :quantity, :unit_price, :total_amount)",
          { billId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true, data: { id: billId } });
  } catch (err) {
    next(err);
  }
};

export const updateTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    await query(
      "UPDATE trans_transportation_bills SET bill_no = :bill_no, bill_date = :bill_date, supplier_id = :supplier_id, total_amount = :total_amount WHERE id = :id",
      { bill_no, bill_date, supplier_id: supplier_id || 0, total_amount: total_amount || 0, id }
    );
    await query("DELETE FROM trans_transportation_bill_details WHERE bill_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_transportation_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM trans_transportation_bill_details WHERE bill_id = :id", { id });
    await query("DELETE FROM trans_transportation_bills WHERE id = :id", { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
`;

if (!controllerContent.includes('listTransportationBills')) {
  fs.writeFileSync(controllerPath, controllerContent + '\n' + controllerAddition);
}

let routesContent = fs.readFileSync(routesPath, 'utf8');
if (!routesContent.includes('listTransportationBills')) {
  routesContent = routesContent.replace(
    'import { requirePermission } from "../middleware/requirePermission.js";',
    `import { requirePermission } from "../middleware/requirePermission.js";
import {
  listTransportationBills, getTransportationBill, createTransportationBill, updateTransportationBill, deleteTransportationBill
} from "../controllers/transport.controller.js";`
  );
  
  routesContent = routesContent.replace(
    '// Fuel Bills',
    `// Transportation Bills
router.get("/transportation-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.VIEW"), listTransportationBills);
router.get("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.VIEW"), getTransportationBill);
router.post("/transportation-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), createTransportationBill);
router.put("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), updateTransportationBill);
router.delete("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), deleteTransportationBill);

// Fuel Bills`
  );
  fs.writeFileSync(routesPath, routesContent);
}

console.log("Transportation Bills routes and controllers updated successfully.");

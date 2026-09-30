import fs from 'fs';

// 1. Update transport.controller.js
let controllerPath = 'server/controllers/transport.controller.js';
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

const controllerLogic = `
// === FUEL EXPENSES ===
export const listFuelExpenses = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      \`SELECT f.*, v.vehicle_name, v.registration_number, c.customer_name as supplier_name_mapped
       FROM trans_fuel_expenses f
       LEFT JOIN trans_vehicles v ON f.vehicle_id = v.id
       LEFT JOIN sal_customers c ON f.supplier_id = c.id
       WHERE f.company_id = :companyId ORDER BY f.id DESC\`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const createFuelExpense = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = Number(branchIdStr) || 1;
    const { vehicle_id, driver_name, description, supplier_id, supplier_name, expense_type, is_tax_included, tax_code_id, amount, remarks } = req.body;

    const result = await query(
      \`INSERT INTO trans_fuel_expenses 
       (company_id, branch_id, vehicle_id, driver_name, description, supplier_id, supplier_name, expense_type, is_tax_included, tax_code_id, amount, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :vehicle_id, :driver_name, :description, :supplier_id, :supplier_name, :expense_type, :is_tax_included, :tax_code_id, :amount, :remarks, :userId)\`,
      {
        companyId, branchId, vehicle_id: vehicle_id || null, driver_name: driver_name || null,
        description: description || null, supplier_id: supplier_id || null, supplier_name: supplier_name || null,
        expense_type: expense_type || null, is_tax_included: is_tax_included ? 1 : 0,
        tax_code_id: tax_code_id || null, amount: amount || 0, remarks: remarks || null,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};
`;

if (!controllerContent.includes('listFuelExpenses')) {
  controllerContent += controllerLogic;
  fs.writeFileSync(controllerPath, controllerContent);
  console.log('Updated transport.controller.js');
}

// 2. Update transport.route.js
let routePath = 'server/routes/transport.route.js';
let routeContent = fs.readFileSync(routePath, 'utf8');

if (!routeContent.includes('listFuelExpenses')) {
  routeContent = routeContent.replace(
    /import \{\s*/,
    `import {\n  listFuelExpenses,\n  createFuelExpense,\n  `
  );
  
  const routeLogic = `
// Fuel Expenses
router.get("/fuel-expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL_EXPENSES.VIEW"), listFuelExpenses);
router.post("/fuel-expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL_EXPENSES.CREATE"), createFuelExpense);
`;
  routeContent += routeLogic;
  fs.writeFileSync(routePath, routeContent);
  console.log('Updated transport.route.js');
}

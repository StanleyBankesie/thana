const fs = require('fs');

const routes = `
// ─── Salespersons Setup ────────────────────────────────────────────────────────
router.get(
  "/sales-persons",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope || {};
      const rows = await query(
        "SELECT * FROM sal_salespersons WHERE company_id = :companyId ORDER BY name ASC",
        { companyId }
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/sales-persons",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope || {};
      const salespersons = req.body?.salespersons || [];
      if (!Array.isArray(salespersons)) {
        return res.status(400).json({ message: "salespersons array required" });
      }

      await query("DELETE FROM sal_salespersons WHERE company_id = :companyId", { companyId });

      for (const sp of salespersons) {
        if (!sp.name?.trim()) continue;
        await query(
          "INSERT INTO sal_salespersons (company_id, branch_id, name, email, is_active) VALUES (:companyId, :branchId, :name, :email, :isActive)",
          {
            companyId,
            branchId,
            name: sp.name.trim(),
            email: sp.email?.trim() || null,
            isActive: sp.is_active === 0 || sp.is_active === false ? 0 : 1
          }
        );
      }
      res.json({ status: "SUCCESS" });
    } catch (err) {
      next(err);
    }
  }
);

`;

const path = 'server/routes/sales.route.js';
let content = fs.readFileSync(path, 'utf8');

const searchString = '// ─── Zones ─────────────────────────────────────────────────────────────────';
const index = content.indexOf(searchString);

if (index !== -1) {
  content = content.substring(0, index) + routes + content.substring(index);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Routes added successfully.');
} else {
  // try fallback
  const fallback = 'router.get(\n  "/zones",';
  const i2 = content.indexOf(fallback);
  if (i2 !== -1) {
    content = content.substring(0, i2) + routes + content.substring(i2);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Routes added via fallback successfully.');
  } else {
    console.log('Insertion point not found.');
  }
}

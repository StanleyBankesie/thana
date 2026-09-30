const fs = require('fs');

const routes = `
// ─── Fast Moving Items Report ────────────────────────────────────────────────
router.get(
  "/reports/fast-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query?.from || null;
      const to = req.query?.to || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "r.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))"
      ];
      if (from) { where.push("DATE(r.issue_date) >= :from"); params.from = from; }
      if (to) { where.push("DATE(r.issue_date) <= :to"); params.to = to; }
      const rows = await query(
        \`SELECT 
           d.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(d.qty_issued) AS issued_qty, 
           SUM(d.qty_issued * d.cost_price) AS turnover 
         FROM inv_issue_to_requirement r 
         JOIN inv_issue_to_requirement_details d ON d.issue_id = r.id 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE \${where.join(" AND ")} 
         GROUP BY d.item_id, i.item_code, i.item_name 
         HAVING issued_qty > 0 
         ORDER BY turnover DESC, issued_qty DESC 
         LIMIT 100\`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Slow Moving Items Report ────────────────────────────────────────────────
router.get(
  "/reports/slow-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query?.from || null;
      const to = req.query?.to || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "r.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))"
      ];
      if (from) { where.push("DATE(r.issue_date) >= :from"); params.from = from; }
      if (to) { where.push("DATE(r.issue_date) <= :to"); params.to = to; }
      const rows = await query(
        \`SELECT 
           d.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(d.qty_issued) AS issued_qty, 
           SUM(d.qty_issued * d.cost_price) AS turnover 
         FROM inv_issue_to_requirement r 
         JOIN inv_issue_to_requirement_details d ON d.issue_id = r.id 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE \${where.join(" AND ")} 
         GROUP BY d.item_id, i.item_code, i.item_name 
         HAVING issued_qty > 0 
         ORDER BY turnover ASC, issued_qty ASC 
         LIMIT 100\`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Non Moving Items Report ─────────────────────────────────────────────────
router.get(
  "/reports/non-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const asOf = req.query?.asOf || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "b.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(b.branch_id, :branchIdsStr))",
        "b.qty > 0"
      ];
      
      const rows = await query(
        \`SELECT 
           b.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(b.qty) AS available_qty,
           DATEDIFF(IFNULL(:asOf, CURDATE()), MAX(t.transaction_date)) AS days_since_last
         FROM inv_stock_balances b 
         JOIN inv_items i ON i.id = b.item_id 
         LEFT JOIN v_inv_stock_ledger_computed t ON t.item_id = b.item_id AND t.company_id = b.company_id
         WHERE \${where.join(" AND ")} 
         GROUP BY b.item_id, i.item_code, i.item_name 
         HAVING days_since_last IS NULL OR days_since_last > 90
         ORDER BY days_since_last DESC, available_qty DESC 
         LIMIT 100\`,
        { ...params, asOf }
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Aging Analysis Report ─────────────────────────────────────────────
router.get(
  "/reports/stock-aging-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const asOf = req.query?.asOf || null;
      const params = { companyId, branchIdsStr, asOf };
      const where = [
        "b.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(b.branch_id, :branchIdsStr))",
        "b.qty > 0"
      ];
      
      const rows = await query(
        \`SELECT 
           b.item_id, 
           i.item_code, 
           i.item_name,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) <= 30 THEN b.qty ELSE 0 END) AS bucket_0_30,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) BETWEEN 31 AND 60 THEN b.qty ELSE 0 END) AS bucket_31_60,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) BETWEEN 61 AND 90 THEN b.qty ELSE 0 END) AS bucket_61_90,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) > 90 THEN b.qty ELSE 0 END) AS bucket_90_plus
         FROM inv_stock_balances b 
         JOIN inv_items i ON i.id = b.item_id 
         WHERE \${where.join(" AND ")} 
         GROUP BY b.item_id, i.item_code, i.item_name\`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

`;

const content = fs.readFileSync('server/routes/inventory.routes.js', 'utf8');
const searchString = '// ─── Stock Balances Report ────────────────────────────────────────────────────';
const index = content.indexOf(searchString);

if (index !== -1) {
  const newContent = content.substring(0, index) + routes + content.substring(index);
  fs.writeFileSync('server/routes/inventory.routes.js', newContent, 'utf8');
  console.log('Routes added successfully.');
} else {
  console.log('Insertion point not found.');
}

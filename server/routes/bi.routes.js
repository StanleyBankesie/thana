import express from "express";
import multer from "multer";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { query } from "../db/pool.js";
import {
  getDashboards,
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getHomeOverview,
  getModuleAnalytics,
  getDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  syncDataSourceNow,
  getDataSourceSyncHistory,
  uploadSourceFile,
  getDatasets,
  getDatasetPreview,
  previewTransformations,
  getEtlPipelines,
  createEtlPipeline,
  runEtlPipelineNow,
  getPipelineRuns,
  getPipelineRunLogs,
  getDataQualitySummary,
  executeMultidimensionalAnalysis,
  getAutomatedBusinessInsights,
  getCustomDashboards,
  createCustomDashboard,
  getCustomDashboardById,
  deleteCustomDashboard,
  exportCustomBiDataset,
} from "../controllers/bi.controller.js";

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = express.Router();

// Shared auth middleware for all BI routes
router.use(requireAuth, requireCompanyScope, requireBranchScope);

// Utility: safe query with fallback
async function sq(sql, params, fallback = []) {
  try {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows : fallback;
  } catch {
    return fallback;
  }
}

// ===== DATA SOURCES & INGESTION =====
router.get("/data-sources", (req, res, next) => getDataSources(req, res, next));
router.post("/data-sources", (req, res, next) => createDataSource(req, res, next));
router.put("/data-sources/:id", (req, res, next) => updateDataSource(req, res, next));
router.delete("/data-sources/:id", (req, res, next) => deleteDataSource(req, res, next));
router.post("/data-sources/:id/test", (req, res, next) => testDataSourceConnection(req, res, next));
router.post("/data-sources/:id/sync", (req, res, next) => syncDataSourceNow(req, res, next));
router.get("/data-sources/:id/history", (req, res, next) => getDataSourceSyncHistory(req, res, next));
router.post("/upload-source-file", uploadMemory.single("file"), (req, res, next) => uploadSourceFile(req, res, next));

// ===== DATASETS & PREPARATION =====
router.get("/datasets", (req, res, next) => getDatasets(req, res, next));
router.get("/datasets/:id/preview", (req, res, next) => getDatasetPreview(req, res, next));
router.post("/data-preparation/preview-transform", (req, res, next) => previewTransformations(req, res, next));

// ===== ETL PIPELINES & RUNS =====
router.get("/etl-pipelines", (req, res, next) => getEtlPipelines(req, res, next));
router.post("/etl-pipelines", (req, res, next) => createEtlPipeline(req, res, next));
router.post("/etl-pipelines/:id/run", (req, res, next) => runEtlPipelineNow(req, res, next));
router.get("/etl-pipelines/:id/runs", (req, res, next) => getPipelineRuns(req, res, next));
router.get("/etl-pipeline-runs/:runId/logs", (req, res, next) => getPipelineRunLogs(req, res, next));

// ===== DATA QUALITY =====
router.get("/data-quality/summary", (req, res, next) => getDataQualitySummary(req, res, next));

// ===== MULTIDIMENSIONAL ANALYTICS =====
router.post("/multidimensional-analysis", (req, res, next) => executeMultidimensionalAnalysis(req, res, next));

// ===== AUTOMATED INSIGHTS =====
router.get("/insights/automated", (req, res, next) => getAutomatedBusinessInsights(req, res, next));

// ===== CUSTOM DASHBOARDS & WIDGETS =====
router.get("/custom-dashboards", (req, res, next) => getCustomDashboards(req, res, next));
router.post("/custom-dashboards", (req, res, next) => createCustomDashboard(req, res, next));
router.get("/custom-dashboards/:id", (req, res, next) => getCustomDashboardById(req, res, next));
router.delete("/custom-dashboards/:id", (req, res, next) => deleteCustomDashboard(req, res, next));

// ===== ADVANCED EXPORT =====
router.post("/export-custom", (req, res, next) => exportCustomBiDataset(req, res, next));

// ===== LEGACY ROUTES =====
router.get("/module-analytics", (req, res, next) => getModuleAnalytics(req, res, next));

router.get("/dashboards", (req, res, next) => getDashboards(req, res, next));
router.get("/home-overview", (req, res, next) => getHomeOverview(req, res, next));
router.get("/sales-report", (req, res, next) => getSalesReport(req, res, next));
router.get("/purchase-report", (req, res, next) => getPurchaseReport(req, res, next));
router.get("/inventory-report", (req, res, next) => getInventoryReport(req, res, next));

// ===== DASHBOARD STATS (legacy for landing page) =====
router.get("/dashboard-stats", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };

    const [[s], [pu], [inv], [hr]] = await Promise.all([
      sq("SELECT COALESCE(SUM(total_amount),0) as total FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr) OR branch_id IS NULL) AND invoice_date >= DATE_SUB(NOW(),INTERVAL 30 DAY)", p, [{ total: 0 }]),
      sq("SELECT COALESCE(SUM(total_amount),0) as total FROM pur_orders WHERE (company_id = :companyId OR company_id IS NULL) AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr) OR branch_id IS NULL) AND po_date >= DATE_SUB(NOW(),INTERVAL 30 DAY)", p, [{ total: 0 }]),
      sq("SELECT COUNT(DISTINCT item_id) as count FROM inv_stock_balances WHERE (company_id = :companyId OR company_id IS NULL) AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr) OR branch_id IS NULL)", p, [{ count: 0 }]),
      sq("SELECT COUNT(*) as count FROM hr_employees WHERE (company_id = :companyId OR company_id IS NULL) AND status IN ('ACTIVE','PROBATION') AND deleted_at IS NULL", p, [{ count: 0 }]),
    ]);

    res.json({
      success: true,
      data: {
        activeDashboards: 1,
        sales30d: Number(s?.total || 0),
        purchase30d: Number(pu?.total || 0),
        inventoryItems: Number(inv?.count || 0),
        hrEmployees: Number(hr?.count || 0),
        reportTypes: 4,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== EXECUTIVE DASHBOARD =====
router.get("/executive-dashboard", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { from, to } = req.query;
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";
    const whereSbBranch = "(:branchId IS NULL OR sb.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(sb.branch_id, :branchIdsStr) OR sb.branch_id IS NULL)";

    const [
      [revenue], [purchases], [invSummary], [projects], [production], [employees],
      [posSales], [deliveries], [maintenance],
      revTrend, purTrend, projectsByStatus, posTrend,
    ] = await Promise.all([
      // Omnichannel Revenue (Invoices + POS Sales)
      sq(`SELECT
          (
            COALESCE((SELECT SUM(total_amount) FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) AND status NOT IN ('CANCELLED','DRAFT')),0) +
            COALESCE((SELECT SUM(net_amount) FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime)=MONTH(CURDATE()) AND YEAR(sale_datetime)=YEAR(CURDATE()) AND status!='VOID'),0)
          ) as thisMonth,
          (
            COALESCE((SELECT SUM(total_amount) FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status NOT IN ('CANCELLED','DRAFT')),0) +
            COALESCE((SELECT SUM(net_amount) FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(sale_datetime)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status!='VOID'),0)
          ) as lastMonth,
          (
            COALESCE((SELECT SUM(total_amount) FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')),0) +
            COALESCE((SELECT SUM(net_amount) FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status!='VOID'),0)
          ) as allTime
          `, p, [{ thisMonth: 0, lastMonth: 0, allTime: 0 }]),

      // Enterprise Expenses (POs + Projects + Transport)
      sq(`SELECT
          (
            COALESCE((SELECT SUM(total_amount) FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(po_date)=MONTH(CURDATE()) AND YEAR(po_date)=YEAR(CURDATE()) AND status NOT IN ('CANCELLED')),0) +
            COALESCE((SELECT SUM(amount) FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(expense_date)=MONTH(CURDATE()) AND YEAR(expense_date)=YEAR(CURDATE())),0) +
            COALESCE((SELECT SUM(amount) FROM trn_transport_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(expense_date)=MONTH(CURDATE()) AND YEAR(expense_date)=YEAR(CURDATE())),0)
          ) as thisMonth,
          (
            COALESCE((SELECT SUM(total_amount) FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(po_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(po_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status NOT IN ('CANCELLED')),0) +
            COALESCE((SELECT SUM(amount) FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(expense_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(expense_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))),0) +
            COALESCE((SELECT SUM(amount) FROM trn_transport_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(expense_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(expense_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))),0)
          ) as lastMonth,
          (
            COALESCE((SELECT SUM(total_amount) FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED')),0) +
            COALESCE((SELECT SUM(amount) FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}),0) +
            COALESCE((SELECT SUM(amount) FROM trn_transport_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}),0)
          ) as allTime
          `, p, [{ thisMonth: 0, lastMonth: 0, allTime: 0 }]),

      // Inventory valuation & low-stock
      sq(`SELECT 
          COUNT(DISTINCT i.id) as itemCount,
          COALESCE(SUM(sb.qty * COALESCE(i.cost_price, i.selling_price, 0)), 0) as stockValue,
          COUNT(DISTINCT CASE WHEN COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0) AND i.reorder_level > 0 THEN i.id END) as belowReorder
          FROM inv_items i
          LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL) AND ${whereSbBranch}
          WHERE (i.company_id = :companyId OR i.company_id IS NULL)`, p, [{ itemCount: 0, stockValue: 0, belowReorder: 0 }]),

      // Project Portfolios
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('COMPLETED','DONE') THEN 1 ELSE 0 END) as completed,
          COALESCE(SUM(budget),0) as totalBudget
          FROM pm_projects WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total: 0, active: 0, completed: 0, totalBudget: 0 }]),

      // Production Output
      sq(`SELECT COUNT(*) as totalOrders,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completedOrders,
          SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgressOrders,
          COALESCE(SUM(CASE WHEN status='COMPLETED' THEN qty_to_produce ELSE 0 END),0) as totalProduced
          FROM prod_work_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ totalOrders: 0, completedOrders: 0, inProgressOrders: 0, totalProduced: 0 }]),

      // HR Headcount
      sq(`SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('ACTIVE','CONFIRMED') THEN 1 ELSE 0 END) as active
          FROM hr_employees WHERE (company_id=:companyId OR company_id IS NULL) AND deleted_at IS NULL`, p, [{ total: 0, active: 0 }]),

      // POS Live Performance
      sq(`SELECT COALESCE(SUM(net_amount),0) as today, COUNT(*) as txns
          FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(sale_datetime)=CURDATE() AND status!='VOID'`, p, [{ today: 0, txns: 0 }]),

      // Deliveries / Transport
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='DELIVERED' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status IN ('IN_TRANSIT','PACKED','DISPATCHED') THEN 1 ELSE 0 END) as inUse
          FROM sal_deliveries WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total: 0, available: 0, inUse: 0 }]),

      // Maintenance Work Orders
      sq(`SELECT COUNT(*) as open FROM maint_job_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('COMPLETED','CANCELLED','CLOSED')`, p, [{ open: 0 }]),

      // Combined Monthly Revenue Trend
      sq(`SELECT month, SUM(rev) as revenue FROM (
            SELECT DATE_FORMAT(invoice_date, '%Y-%m') as month, total_amount as rev 
            FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')
            UNION ALL
            SELECT DATE_FORMAT(sale_datetime, '%Y-%m') as month, net_amount as rev 
            FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status!='VOID'
          ) combined
          GROUP BY month ORDER BY month ASC LIMIT 12`, p, []),

      // Combined Monthly Spend Trend
      sq(`SELECT month, SUM(exp) as spend FROM (
            SELECT DATE_FORMAT(po_date, '%Y-%m') as month, total_amount as exp 
            FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED')
            UNION ALL
            SELECT DATE_FORMAT(expense_date, '%Y-%m') as month, amount as exp 
            FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}
            UNION ALL
            SELECT DATE_FORMAT(expense_date, '%Y-%m') as month, amount as exp 
            FROM trn_transport_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}
          ) combined
          GROUP BY month ORDER BY month ASC LIMIT 12`, p, []),

      // Projects by Status
      sq(`SELECT COALESCE(project_status, 'PLANNING') as status, COUNT(*) as count 
          FROM pm_projects WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} 
          GROUP BY COALESCE(project_status, 'PLANNING')`, p, []),

      // POS Daily Trend
      sq(`SELECT DATE(sale_datetime) as day, COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status!='VOID'
          AND sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 14 DAY)
          GROUP BY DATE(sale_datetime) ORDER BY day ASC`, p, []),
    ]);

    const thisMonthRevenue = Number(revenue?.thisMonth || 0);
    const lastMonthRevenue = Number(revenue?.lastMonth || 0);
    const allTimeRevenue = Number(revenue?.allTime || 0);
    const thisMonthExpenses = Number(purchases?.thisMonth || 0);
    const lastMonthExpenses = Number(purchases?.lastMonth || 0);
    const allTimeExpenses = Number(purchases?.allTime || 0);

    const revenueGrowth =
      lastMonthRevenue > 0
        ? Number(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1))
        : thisMonthRevenue > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        kpis: {
          revenue: { 
            thisMonth: thisMonthRevenue, 
            lastMonth: lastMonthRevenue, 
            allTime: allTimeRevenue, 
            growth: revenueGrowth 
          },
          expenses: { 
            thisMonth: thisMonthExpenses, 
            lastMonth: lastMonthExpenses, 
            allTime: allTimeExpenses 
          },
          grossProfit: { 
            thisMonth: thisMonthRevenue - thisMonthExpenses,
            allTime: allTimeRevenue - allTimeExpenses
          },
          inventory: { 
            itemCount: Number(invSummary?.itemCount || 0), 
            stockValue: Number(invSummary?.stockValue || 0), 
            belowReorder: Number(invSummary?.belowReorder || 0) 
          },
          projects: { 
            total: Number(projects?.total || 0), 
            active: Number(projects?.active || 0), 
            completed: Number(projects?.completed || 0), 
            totalBudget: Number(projects?.totalBudget || 0) 
          },
          production: { 
            totalOrders: Number(production?.totalOrders || 0), 
            completedOrders: Number(production?.completedOrders || 0), 
            inProgressOrders: Number(production?.inProgressOrders || 0), 
            totalProduced: Number(production?.totalProduced || 0) 
          },
          hr: { 
            total: Number(employees?.total || 0), 
            active: Number(employees?.active || 0) 
          },
          pos: { 
            todaySales: Number(posSales?.today || 0), 
            todayTxns: Number(posSales?.txns || 0) 
          },
          fleet: { 
            total: Number(deliveries?.total || 0), 
            available: Number(deliveries?.available || 0), 
            inUse: Number(deliveries?.inUse || 0) 
          },
          maintenance: { 
            openJobs: Number(maintenance?.open || 0) 
          },
        },
        charts: {
          revenueTrend: revTrend,
          purchaseTrend: purTrend,
          projectsByStatus,
          posDailyTrend: posTrend,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== FINANCIAL ANALYTICS =====
router.get("/financial", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const months = parseInt(req.query.months) || 6;
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [
      [summaryRev],
      [summarySpend],
      revenueTrend,
      purchaseTrend,
      topCustomers,
      topSuppliers
    ] = await Promise.all([
      sq(`SELECT COALESCE(SUM(total_amount), 0) as totalRevenue, COUNT(id) as totalInvoices
          FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')`, p, [{ totalRevenue: 0, totalInvoices: 0 }]),
      sq(`SELECT COALESCE(SUM(total_amount), 0) as totalSpend, COUNT(id) as totalOrders
          FROM pur_orders WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED')`, p, [{ totalSpend: 0, totalOrders: 0 }]),
      sq(`SELECT DATE_FORMAT(COALESCE(invoice_date, created_at), '%Y-%m') as month, COALESCE(SUM(total_amount), 0) as revenue
          FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')
          GROUP BY month ORDER BY month ASC LIMIT ${months}`, p, []),
      sq(`SELECT DATE_FORMAT(COALESCE(po_date, created_at), '%Y-%m') as month, COALESCE(SUM(total_amount), 0) as spend
          FROM pur_orders WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED')
          GROUP BY month ORDER BY month ASC LIMIT ${months}`, p, []),
      sq(`SELECT c.id, c.customer_name, COALESCE(SUM(i.total_amount), 0) as revenue, COUNT(i.id) as invoices
          FROM sal_customers c
          JOIN sal_invoices i ON i.customer_id = c.id AND (i.company_id = :companyId OR i.company_id IS NULL) AND (:branchId IS NULL OR i.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr) OR i.branch_id IS NULL)
          WHERE (c.company_id = :companyId OR c.company_id IS NULL) AND i.status NOT IN ('CANCELLED','DRAFT')
          GROUP BY c.id, c.customer_name ORDER BY revenue DESC LIMIT 10`, p, []),
      sq(`SELECT s.id, s.supplier_name, COALESCE(SUM(o.total_amount), 0) as spend, COUNT(o.id) as orders
          FROM pur_suppliers s
          JOIN pur_orders o ON o.supplier_id = s.id AND (o.company_id = :companyId OR o.company_id IS NULL) AND (:branchId IS NULL OR o.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr) OR o.branch_id IS NULL)
          WHERE (s.company_id = :companyId OR s.company_id IS NULL) AND o.status NOT IN ('CANCELLED')
          GROUP BY s.id, s.supplier_name ORDER BY spend DESC LIMIT 10`, p, []),
    ]);

    const totalRev = Number(summaryRev?.totalRevenue || 0);
    const totalSpd = Number(summarySpend?.totalSpend || 0);
    const grossMargin = totalRev > 0 ? (((totalRev - totalSpd) / totalRev) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome: totalRev,
          totalExpense: totalSpd,
          netProfit: totalRev - totalSpd,
          profitMargin: Number(grossMargin),
          invoicesCount: Number(summaryRev?.totalInvoices || 0),
          ordersCount: Number(summarySpend?.totalOrders || 0),
        },
        revenueTrend,
        purchaseTrend,
        topCustomers,
        topSuppliers,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== INVENTORY ANALYTICS =====
router.get("/inventory", async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const branchIdsStr = req.scope?.branchIdsStr || (branchId ? String(branchId) : "");
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR sb.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(sb.branch_id, :branchIdsStr) OR sb.branch_id IS NULL)";

    const [
      [summary],
      byCategory,
      lowStock,
      topMovingItems,
      byWarehouse
    ] = await Promise.all([
      sq(`SELECT 
            COUNT(DISTINCT i.id) as totalItems,
            COALESCE(SUM(sb.qty), 0) as totalQty,
            COALESCE(SUM(sb.qty * COALESCE(i.cost_price, i.selling_price, 0)), 0) as totalValue,
            COUNT(DISTINCT CASE WHEN COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0) AND i.reorder_level > 0 THEN i.id END) as lowStockItems
          FROM inv_items i
          LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL) AND ${whereBranch}
          WHERE (i.company_id = :companyId OR i.company_id IS NULL)`, p, [{ totalItems: 0, totalQty: 0, totalValue: 0, lowStockItems: 0 }]),
      sq(`SELECT 
            COALESCE(c.category_name, 'General / Unassigned') as category_name,
            COUNT(DISTINCT i.id) as itemCount,
            COALESCE(SUM(sb.qty), 0) as totalQty,
            COALESCE(SUM(sb.qty * COALESCE(i.cost_price, i.selling_price, 0)), 0) as totalValue
          FROM inv_items i
          LEFT JOIN inv_item_categories c ON i.category_id = c.id
          LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL) AND ${whereBranch}
          WHERE (i.company_id = :companyId OR i.company_id IS NULL)
          GROUP BY c.id, c.category_name
          ORDER BY totalQty DESC`, p, []),
      sq(`SELECT 
            i.id,
            i.item_code,
            i.item_name,
            COALESCE(SUM(sb.qty), 0) as qty,
            COALESCE(i.reorder_level, 0) as reorderLevel,
            COALESCE(i.reorder_level, 0) - COALESCE(SUM(sb.qty), 0) as deficit
          FROM inv_items i
          LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL) AND ${whereBranch}
          WHERE (i.company_id = :companyId OR i.company_id IS NULL)
            AND i.reorder_level > 0
          GROUP BY i.id, i.item_code, i.item_name, i.reorder_level
          HAVING qty <= i.reorder_level
          ORDER BY deficit DESC
          LIMIT 20`, p, []),
      sq(`SELECT 
            i.id,
            i.item_name,
            i.item_code,
            COALESCE(SUM(moved.qty), 0) as moved
          FROM inv_items i
          JOIN (
            SELECT item_id, qty FROM pos_sale_lines WHERE (company_id = :companyId OR company_id IS NULL)
            UNION ALL
            SELECT item_id, quantity as qty FROM sal_invoice_details WHERE (company_id = :companyId OR company_id IS NULL)
          ) moved ON moved.item_id = i.id
          WHERE (i.company_id = :companyId OR i.company_id IS NULL)
          GROUP BY i.id, i.item_name, i.item_code
          ORDER BY moved DESC
          LIMIT 10`, p, []),
      sq(`SELECT 
            COALESCE(w.warehouse_name, 'Main Warehouse') as warehouse_name,
            COALESCE(w.warehouse_code, 'WH') as warehouse_code,
            COUNT(DISTINCT sb.item_id) as itemCount,
            COALESCE(SUM(sb.qty), 0) as totalQty
          FROM inv_stock_balances sb
          LEFT JOIN inv_warehouses w ON sb.warehouse_id = w.id
          WHERE (sb.company_id = :companyId OR sb.company_id IS NULL) AND ${whereBranch}
          GROUP BY w.id, w.warehouse_name, w.warehouse_code
          ORDER BY totalQty DESC`, p, []),
    ]);

    res.json({
      success: true,
      data: {
        summary,
        byCategory,
        lowStock,
        topMovingItems,
        byWarehouse,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ===== PROJECT ANALYTICS =====
router.get("/projects", async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const branchIdsStr = req.scope?.branchIdsStr || (branchId ? String(branchId) : "");
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [
      [summary],
      [finances],
      [tasksSummary],
      [timesheetSummary],
      byStatus,
      recentProjects,
      budgetAnalysis,
      monthlySpendTrend
    ] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('COMPLETED','DONE') THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('PLANNING','PENDING','DRAFT') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN COALESCE(project_status,'') IN ('ON_HOLD','HOLD') THEN 1 ELSE 0 END) as onHold,
          COALESCE(SUM(budget),0) as totalBudget
          FROM pm_projects WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total: 0, active: 0, completed: 0, pending: 0, onHold: 0, totalBudget: 0 }]),
      sq(`SELECT 
          COALESCE(SUM(amount), 0) as totalExpenses,
          COALESCE(SUM(CASE WHEN status IN ('APPROVED','PAID') THEN amount ELSE 0 END), 0) as approvedExpenses
          FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ totalExpenses: 0, approvedExpenses: 0 }]),
      sq(`SELECT COUNT(*) as totalTasks,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completedTasks,
          SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgressTasks,
          SUM(CASE WHEN status NOT IN ('COMPLETED','CANCELLED') AND end_date < CURDATE() THEN 1 ELSE 0 END) as overdueTasks
          FROM pm_tasks WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0 }]),
      sq(`SELECT COALESCE(SUM(hours),0) as totalHours, COUNT(DISTINCT log_date) as loggedDays
          FROM pm_timesheets WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ totalHours: 0, loggedDays: 0 }]),
      sq(`SELECT COALESCE(project_status, 'PLANNING') as status, COUNT(*) as count 
          FROM pm_projects WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}
          GROUP BY COALESCE(project_status, 'PLANNING')`, p, []),
      sq(`SELECT p.id, p.project_name, p.project_code, p.client_name, COALESCE(p.project_status,'PLANNING') as status, p.budget, 
          COALESCE(e.spent,0) as spent, 0 as income, p.start_date, p.end_date, COALESCE(p.completion_percent,0) as completion_percent
          FROM pm_projects p 
          LEFT JOIN (SELECT project_id, SUM(amount) as spent FROM pm_expenses GROUP BY project_id) e ON e.project_id=p.id
          WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND (:branchId IS NULL OR p.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr) OR p.branch_id IS NULL)
          ORDER BY p.created_at DESC LIMIT 10`, p, []),
      sq(`SELECT p.id, p.project_name, p.budget, COALESCE(e.spent,0) as spent,
          CASE WHEN p.budget > 0 THEN ROUND(COALESCE(e.spent,0)/p.budget*100,1) ELSE 0 END as budgetUsedPct
          FROM pm_projects p 
          LEFT JOIN (SELECT project_id, SUM(amount) as spent FROM pm_expenses GROUP BY project_id) e ON e.project_id=p.id
          WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND COALESCE(p.project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION')
          ORDER BY budgetUsedPct DESC LIMIT 10`, p, []),
      sq(`SELECT DATE_FORMAT(expense_date,'%Y-%m') as month, COALESCE(SUM(amount),0) as monthly_spend
          FROM pm_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(expense_date,'%Y-%m') ORDER BY month ASC`, p, []),
    ]);

    const totalBudget = Number(summary?.totalBudget || 0);
    const totalExpenses = Number(finances?.totalExpenses || 0);
    const totalIncome = 0;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = 0;

    res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          totalBudget,
          totalExpenses,
          totalIncome,
          netProfit,
          profitMargin,
          ...tasksSummary,
          ...timesheetSummary,
        },
        byStatus,
        recentProjects,
        budgetAnalysis,
        monthlySpendTrend,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ===== HR ANALYTICS =====
router.get("/hr", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };

    const [summary, byDept, attendanceToday, recentHires] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('ACTIVE','CONFIRMED') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='PROBATION' THEN 1 ELSE 0 END) as probation
          FROM hr_employees WHERE (company_id=:companyId OR company_id IS NULL) AND deleted_at IS NULL`, p, [{ total: 0, active: 0, probation: 0 }]),
      sq(`SELECT COALESCE(d.dept_name, 'General Administration') as department_name, COUNT(e.id) as count
          FROM hr_employees e LEFT JOIN hr_departments d ON e.dept_id=d.id
          WHERE (e.company_id=:companyId OR e.company_id IS NULL) AND e.deleted_at IS NULL
          GROUP BY d.id, d.dept_name ORDER BY count DESC LIMIT 10`, p, []),
      sq(`SELECT SUM(CASE WHEN status='PRESENT' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status='ABSENT' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN status='LATE' THEN 1 ELSE 0 END) as late, COUNT(*) as total
          FROM hr_attendance WHERE (company_id=:companyId OR company_id IS NULL) AND DATE(attendance_date)=CURDATE()`, p, [{ present: 0, absent: 0, late: 0, total: 0 }]),
      sq(`SELECT first_name, last_name, joining_date as date_joined FROM hr_employees
          WHERE (company_id=:companyId OR company_id IS NULL) AND deleted_at IS NULL ORDER BY joining_date DESC LIMIT 5`, p, []),
    ]);

    res.json({ success: true, data: { summary: summary[0], byDepartment: byDept, attendanceToday: attendanceToday[0], recentHires } });
  } catch (err) {
    next(err);
  }
});

// ===== POS ANALYTICS =====
router.get("/pos", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [[today], [thisMonth], dailyTrend, topProducts, byBranch] = await Promise.all([
      sq(`SELECT COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns, COALESCE(AVG(net_amount),0) as avgBasket
          FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(sale_datetime)=CURDATE() AND status!='VOID'`, p, [{ sales: 0, txns: 0, avgBasket: 0 }]),
      sq(`SELECT COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime)=MONTH(CURDATE()) AND YEAR(sale_datetime)=YEAR(CURDATE()) AND status!='VOID'`, p, [{ sales: 0, txns: 0 }]),
      sq(`SELECT DATE(sale_datetime) as day, COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status!='VOID' AND sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
          GROUP BY DATE(sale_datetime) ORDER BY day ASC`, p, []),
      sq(`SELECT i.item_name, COALESCE(SUM(sl.qty),0) as qty, COALESCE(SUM(sl.qty),0) as unitsSold, COALESCE(SUM(sl.line_total),0) as revenue
          FROM pos_sale_lines sl JOIN inv_items i ON sl.item_id=i.id
          JOIN pos_sales s ON sl.sale_id=s.id
          WHERE (s.company_id=:companyId OR s.company_id IS NULL) AND (:branchId IS NULL OR s.branch_id=:branchId OR :branchIdsStr='' OR FIND_IN_SET(s.branch_id,:branchIdsStr) OR s.branch_id IS NULL) AND s.status!='VOID' AND s.sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
          GROUP BY sl.item_id, i.item_name ORDER BY revenue DESC LIMIT 10`, p, []),
      sq(`SELECT b.branch_name, COALESCE(SUM(ps.net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales ps JOIN adm_branches b ON ps.branch_id=b.id
          WHERE (ps.company_id=:companyId OR ps.company_id IS NULL) AND (:branchId IS NULL OR ps.branch_id=:branchId OR :branchIdsStr='' OR FIND_IN_SET(ps.branch_id,:branchIdsStr) OR ps.branch_id IS NULL) AND ps.status!='VOID' AND MONTH(ps.sale_datetime)=MONTH(CURDATE())
          GROUP BY ps.branch_id, b.branch_name ORDER BY sales DESC`, p, []),
    ]);

    const summary = {
      todaySales: Number(today?.sales || 0),
      todayTxns: Number(today?.txns || 0),
      monthSales: Number(thisMonth?.sales || 0),
      avgTxn: Number(today?.avgBasket || 0),
    };

    res.json({ success: true, data: { summary, today, thisMonth, dailyTrend, topProducts, byBranch } });
  } catch (err) {
    next(err);
  }
});

// ===== TRANSPORT ANALYTICS =====
router.get("/transport", async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr) OR branch_id IS NULL)";

    const [[deliverySummary], [financialSummary], deliveriesTrend, recentDeliveries] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='DELIVERED' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status IN ('IN_TRANSIT','PACKED','DISPATCHED') THEN 1 ELSE 0 END) as inUse,
          SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) as maintenance
          FROM sal_deliveries WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total: 0, available: 0, inUse: 0, maintenance: 0 }]),
      sq(`SELECT 
          (SELECT COALESCE(SUM(amount),0) FROM trn_transport_income WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}) as totalIncome,
          (SELECT COALESCE(SUM(amount),0) FROM trn_transport_expenses WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}) as totalExpenses,
          (SELECT COUNT(*) FROM sal_deliveries WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(delivery_date)=CURDATE()) as today`, p, [{ totalIncome: 0, totalExpenses: 0, today: 0 }]),
      sq(`SELECT DATE_FORMAT(COALESCE(delivery_date, created_at),'%Y-%m') as month, COUNT(*) as trips
          FROM sal_deliveries WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}
          GROUP BY month ORDER BY month ASC LIMIT 6`, p, []),
      sq(`SELECT d.delivery_no, COALESCE(c.customer_name, 'General Client') as driver_name, 1 as trips, CASE WHEN d.status='DELIVERED' THEN 1 ELSE 0 END as completed, d.status
          FROM sal_deliveries d LEFT JOIN sal_customers c ON d.customer_id=c.id
          WHERE (d.company_id=:companyId OR d.company_id IS NULL) AND ${whereBranch}
          ORDER BY d.created_at DESC LIMIT 10`, p, []),
    ]);

    const vehicles = {
      total: Number(deliverySummary?.total || 0),
      available: Number(deliverySummary?.available || 0),
      inUse: Number(deliverySummary?.inUse || 0),
      maintenance: Number(deliverySummary?.maintenance || 0),
    };

    const trips = {
      today: Number(financialSummary?.today || 0),
      totalIncome: Number(financialSummary?.totalIncome || 0),
      totalExpenses: Number(financialSummary?.totalExpenses || 0),
    };

    res.json({ success: true, data: { vehicles, trips, tripsTrend: deliveriesTrend, topDrivers: recentDeliveries } });
  } catch (err) {
    next(err);
  }
});

// ===== MAINTENANCE ANALYTICS =====
router.get("/maintenance-analytics", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };

    const [[jobSummary], [assetSummary], recentJobs] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('COMPLETED','CLOSED') THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status NOT IN ('COMPLETED','CLOSED','CANCELLED') THEN 1 ELSE 0 END) as open
          FROM maint_job_orders WHERE (company_id=:companyId OR company_id IS NULL)`, p, [{ total: 0, completed: 0, open: 0 }]),
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('ACTIVE','OPERATIONAL') OR status IS NULL THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='UNDER_MAINTENANCE' THEN 1 ELSE 0 END) as underMaintenance
          FROM maint_equipment WHERE (company_id=:companyId OR company_id IS NULL)`, p, [{ total: 0, active: 0, underMaintenance: 0 }]),
      sq(`SELECT order_no as job_number, COALESCE(instructions, notes, asset_name, 'Routine Inspection') as description, status, job_order_type as priority, created_at 
          FROM maint_job_orders WHERE (company_id=:companyId OR company_id IS NULL) 
          ORDER BY created_at DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { jobs: jobSummary, assets: assetSummary, recentJobs } });
  } catch (err) {
    next(err);
  }
});

// ===== PURCHASE ANALYTICS =====
router.get("/purchase", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const months = parseInt(req.query.months) || 6;
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [[summary], byStatus, spendTrend, topSuppliers] = await Promise.all([
      sq(`SELECT COUNT(*) as total, 
          SUM(CASE WHEN status IN ('APPROVED','RECEIVED','COMPLETED') THEN 1 ELSE 0 END) as approved, 
          SUM(CASE WHEN status IN ('PENDING','DRAFT','SUBMITTED') THEN 1 ELSE 0 END) as pending, 
          SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) as cancelled, 
          COALESCE(SUM(total_amount),0) as totalSpend, 
          COALESCE(AVG(total_amount),0) as avgOrder 
          FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{total:0,approved:0,pending:0,cancelled:0,totalSpend:0,avgOrder:0}]),
      sq(`SELECT status, COUNT(*) as count FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} GROUP BY status`, p, []),
      sq(`SELECT DATE_FORMAT(COALESCE(po_date, created_at),'%Y-%m') as month, COALESCE(SUM(total_amount),0) as spend, COUNT(*) as orders 
          FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED') 
          GROUP BY month ORDER BY month ASC LIMIT ${months}`, p, []),
      sq(`SELECT s.id, s.supplier_name, COUNT(o.id) as orders, COALESCE(SUM(o.total_amount),0) as spend 
          FROM pur_orders o JOIN pur_suppliers s ON o.supplier_id=s.id 
          WHERE (o.company_id=:companyId OR o.company_id IS NULL) AND (:branchId IS NULL OR o.branch_id=:branchId OR :branchIdsStr='' OR FIND_IN_SET(o.branch_id,:branchIdsStr) OR o.branch_id IS NULL) AND o.status NOT IN ('CANCELLED') 
          GROUP BY o.supplier_id, s.supplier_name, s.id ORDER BY spend DESC LIMIT 10`, p, []),
    ]);
    res.json({ success: true, data: { summary, byStatus, spendTrend, topSuppliers } });
  } catch (err) { next(err); }
});

// ===== PRODUCTION ANALYTICS =====
router.get("/production", async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const branchIdsStr = req.scope?.branchIdsStr || (branchId ? String(branchId) : "");
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [
      [summary],
      [bomSummary],
      [machineSummary],
      [jcSummary],
      [qcSummary],
      byStatus,
      outputTrend,
      topProducts,
    ] = await Promise.all([
      sq(`SELECT COUNT(*) as total, 
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed, 
          SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress, 
          SUM(CASE WHEN status IN ('DRAFT','RELEASED','PENDING') THEN 1 ELSE 0 END) as pending, 
          SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) as cancelled,
          COALESCE(SUM(qty_to_produce),0) as totalPlanned,
          COALESCE(SUM(CASE WHEN status='COMPLETED' THEN qty_to_produce ELSE 0 END),0) as totalProduced 
          FROM prod_work_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total:0, completed:0, inProgress:0, pending:0, cancelled:0, totalPlanned:0, totalProduced:0 }]),
      sq(`SELECT COUNT(*) as total_boms, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_boms FROM prod_boms WHERE (company_id=:companyId OR company_id IS NULL)`, p, [{ total_boms:0, active_boms:0 }]),
      sq(`SELECT COUNT(*) as total_machines, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_machines FROM prod_machines WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total_machines:0, active_machines:0 }]),
      sq(`SELECT COUNT(*) as total_jc, COALESCE(SUM(planned_qty),0) as planned_qty, COALESCE(SUM(good_qty),SUM(actual_qty),0) as good_qty, COALESCE(SUM(scrap_qty),SUM(rejected_qty),0) as scrap_qty FROM prod_job_cards WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total_jc:0, planned_qty:0, good_qty:0, scrap_qty:0 }]),
      sq(`SELECT COUNT(*) as total_qc, SUM(CASE WHEN quality_status='PASSED' THEN 1 ELSE 0 END) as passed_qc, COALESCE(SUM(rejected_qty),0) as total_defects FROM prod_qc_inspections WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ total_qc:0, passed_qc:0, total_defects:0 }]),
      sq(`SELECT status, COUNT(*) as count FROM prod_work_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} GROUP BY status`, p, []),
      sq(`SELECT DATE_FORMAT(COALESCE(work_order_date, created_at),'%Y-%m') as month, COUNT(*) as orders, COALESCE(SUM(CASE WHEN status='COMPLETED' THEN qty_to_produce ELSE 0 END),0) as produced, COALESCE(SUM(qty_to_produce),0) as planned FROM prod_work_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} GROUP BY month ORDER BY month ASC LIMIT 6`, p, []),
      sq(`SELECT COALESCE(i.item_name, b.bom_name, 'Manufactured Good') as item_name, COALESCE(i.item_code, CONCAT('BOM-',b.id)) as item_code, COUNT(wo.id) as runs, COALESCE(SUM(wo.qty_to_produce),0) as total_qty FROM prod_work_orders wo LEFT JOIN prod_boms b ON wo.bom_id=b.id LEFT JOIN inv_items i ON b.item_id=i.id WHERE (wo.company_id=:companyId OR wo.company_id IS NULL) AND (:branchId IS NULL OR wo.branch_id=:branchId OR :branchIdsStr='' OR FIND_IN_SET(wo.branch_id,:branchIdsStr) OR wo.branch_id IS NULL) GROUP BY b.id, i.id, i.item_name, b.bom_name, i.item_code ORDER BY total_qty DESC LIMIT 5`, p, []),
    ]);

    const goodOutput = Number(jcSummary?.good_qty || 0);
    const scrapOutput = Number(jcSummary?.scrap_qty || 0);
    const totalOut = goodOutput + scrapOutput;
    const yieldRate = totalOut > 0 ? Math.round((goodOutput / totalOut) * 1000) / 10 : 100;
    const scrapRate = totalOut > 0 ? Math.round((scrapOutput / totalOut) * 1000) / 10 : 0;
    const totM = Number(machineSummary?.total_machines || 0);
    const actM = Number(machineSummary?.active_machines || 0);
    const machineUptime = totM > 0 ? Math.round((actM / totM) * 100) : 0;
    const totalQc = Number(qcSummary?.total_qc || 0);
    const passedQc = Number(qcSummary?.passed_qc || 0);
    const qcPassRate = totalQc > 0 ? Math.round((passedQc / totalQc) * 1000) / 10 : 100;

    res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          activeBoms: Number(bomSummary?.active_boms || bomSummary?.total_boms || 0),
          totalBoms: Number(bomSummary?.total_boms || 0),
          totalMachines: totM,
          activeMachines: actM,
          machineUptime,
          yieldRate,
          scrapRate,
          qcPassRate,
          totalQc,
        },
        byStatus,
        outputTrend,
        topProducts,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ===== SERVICE ANALYTICS =====
router.get("/service", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };
    const [[summary], recentRequests] = await Promise.all([
      sq(`SELECT 
          (SELECT COUNT(*) FROM svc_visitors_log WHERE (company_id=:companyId OR company_id IS NULL)) as total,
          (SELECT COUNT(*) FROM svc_visitors_log WHERE (company_id=:companyId OR company_id IS NULL) AND check_out_time IS NULL) as open,
          (SELECT COUNT(*) FROM svc_visitors_log WHERE (company_id=:companyId OR company_id IS NULL) AND check_out_time IS NOT NULL) as completed,
          (SELECT COUNT(*) FROM svc_service_categories WHERE (company_id=:companyId OR company_id IS NULL)) as inProgress`, p, [{total:0,open:0,completed:0,inProgress:0}]),
      sq(`SELECT visitor_name as so_number, purpose as description, CASE WHEN check_out_time IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END as status, 'MEDIUM' as priority, check_in_time as created_at 
          FROM svc_visitors_log WHERE (company_id=:companyId OR company_id IS NULL) ORDER BY check_in_time DESC LIMIT 10`, p, []),
    ]);
    res.json({ success: true, data: { summary, recentRequests } });
  } catch (err) { next(err); }
});

// ===== ADMINISTRATION ANALYTICS =====
router.get("/administration", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };
    const [[userSummary], roleDistribution] = await Promise.all([
      sq("SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) as inactive FROM adm_users WHERE (company_id=:companyId OR company_id IS NULL)", p, [{total:0,active:0,inactive:0}]),
      sq("SELECT r.name as role_name, COUNT(u.id) as userCount FROM adm_roles r LEFT JOIN adm_users u ON u.role_id=r.id AND (u.company_id=:companyId OR u.company_id IS NULL) WHERE (r.company_id=:companyId OR r.company_id IS NULL) GROUP BY r.id, r.name ORDER BY userCount DESC LIMIT 10", p, []),
    ]);
    res.json({ success: true, data: { users: userSummary, roleDistribution } });
  } catch (err) { next(err); }
});

// ===== CROSS MODULE ANALYTICS =====
router.get("/cross-module", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const [projectProfitability, productionVsInventory, inventoryPosSales] = await Promise.all([
      sq(`SELECT p.project_name, 
          COALESCE(p.budget, 0) as revenue, 
          COALESCE((SELECT SUM(amount) FROM pm_expenses WHERE project_id=p.id),0) as cost,
          COALESCE(p.budget, 0) as budget
          FROM pm_projects p WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND ${whereBranch} ORDER BY cost DESC LIMIT 10`, p, []),
      sq(`SELECT i.item_name, COALESCE(SUM(wo.qty_to_produce),0) as producedQty, COALESCE(sb.qty,0) as inStockQty
          FROM prod_work_orders wo
          JOIN prod_boms b ON wo.bom_id=b.id
          JOIN inv_items i ON b.item_id=i.id
          LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND (sb.company_id=:companyId OR sb.company_id IS NULL)
          WHERE (wo.company_id=:companyId OR wo.company_id IS NULL) AND wo.status='COMPLETED'
          GROUP BY i.id, i.item_name, sb.qty ORDER BY producedQty DESC LIMIT 10`, p, []),
      sq(`SELECT i.item_name, COALESCE(SUM(sl.qty),0) as unitsSold, COALESCE(SUM(sl.line_total),0) as posRevenue 
          FROM pos_sale_lines sl 
          JOIN pos_sales s ON sl.sale_id=s.id AND (s.company_id=:companyId OR s.company_id IS NULL) AND s.status!='VOID' 
          JOIN inv_items i ON sl.item_id=i.id 
          WHERE (i.company_id=:companyId OR i.company_id IS NULL)
          GROUP BY i.id, i.item_name 
          ORDER BY posRevenue DESC LIMIT 10`, p, []),
    ]);

    res.json({
      success: true,
      data: {
        projectProfitability,
        productionVsInventory,
        inventoryPosSales,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== AI INSIGHTS =====
router.get("/insights", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const insights = [];
    const [[rev], lowStock, overBudget, overdueTasks, scrapAnomaly, openMaint] = await Promise.all([
      sq(`SELECT COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as thisMonth, COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END),0) as lastMonth FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')`, p, [{thisMonth:0,lastMonth:0}]),
      sq(`SELECT COUNT(*) as cnt FROM inv_items i LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND (sb.company_id=:companyId OR sb.company_id IS NULL) LEFT JOIN inv_reorder_points r ON r.item_id=i.id AND (r.company_id=:companyId OR r.company_id IS NULL) WHERE (i.company_id=:companyId OR i.company_id IS NULL) AND COALESCE(sb.qty,0) <= COALESCE(r.reorder_level,0) AND r.reorder_level IS NOT NULL`, p, [{cnt:0}]),
      sq(`SELECT COUNT(*) as cnt FROM pm_projects p WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND COALESCE(p.project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION') AND p.budget > 0 AND (SELECT COALESCE(SUM(amount),0) FROM pm_expenses WHERE project_id=p.id) > p.budget`, p, [{cnt:0}]),
      sq(`SELECT COUNT(*) as cnt FROM pm_tasks WHERE (company_id=:companyId OR company_id IS NULL) AND status NOT IN ('COMPLETED','CANCELLED') AND end_date < CURDATE()`, p, [{cnt:0}]),
      sq(`SELECT COALESCE(SUM(good_qty),SUM(actual_qty),0) as good, COALESCE(SUM(scrap_qty),SUM(rejected_qty),0) as scrap FROM prod_job_cards WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{good:0,scrap:0}]),
      sq(`SELECT COUNT(*) as cnt FROM maint_job_orders WHERE (company_id=:companyId OR company_id IS NULL) AND status NOT IN ('COMPLETED','CANCELLED') AND deleted_at IS NULL`, p, [{cnt:0}]),
    ]);

    if (Number(lowStock[0]?.cnt||0) > 0) insights.push({ type: "warning", category: "Inventory", title: lowStock[0].cnt + " items below reorder level", description: "Immediate restocking required to prevent stockouts.", recommendation: "Generate purchase orders for affected items." });
    if (Number(overBudget[0]?.cnt||0) > 0) insights.push({ type: "critical", category: "Projects", title: overBudget[0].cnt + " projects exceeding budget", description: "Active projects have overspent their allocated budget.", recommendation: "Review project expenditures and request budget revisions." });
    if (Number(overdueTasks[0]?.cnt||0) > 0) insights.push({ type: "warning", category: "Projects", title: overdueTasks[0].cnt + " overdue project task(s)", description: "Milestone completion is pending behind scheduled end date.", recommendation: "Reallocate resources to clear task bottlenecks." });
    const totProdOut = Number(scrapAnomaly[0]?.good || 0) + Number(scrapAnomaly[0]?.scrap || 0);
    const scrapRatePct = totProdOut > 0 ? (Number(scrapAnomaly[0]?.scrap || 0) / totProdOut) * 100 : 0;
    if (scrapRatePct > 3) {
      insights.push({ type: "warning", category: "Production", title: `Scrap rate elevated at ${scrapRatePct.toFixed(1)}%`, description: "Production wastage is currently above the 2.0% standard tolerance.", recommendation: "Inspect machine calibration, cutting setups, and raw material quality." });
    }
    if (Number(openMaint[0]?.cnt||0) > 5) insights.push({ type: "warning", category: "Maintenance", title: openMaint[0].cnt + " open maintenance jobs", description: "High volume of unresolved maintenance tasks.", recommendation: "Assign additional maintenance personnel to clear the backlog." });
    
    res.json({ success: true, data: { insights, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

// ===== SAVED FILTERS =====
router.get("/saved-filters", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { moduleKey } = req.query;
    
    let sql = `SELECT * FROM bi_saved_filters WHERE (company_id = :companyId OR company_id IS NULL) AND user_id = :userId`;
    const params = { companyId, userId };
    if (moduleKey) {
      sql += ` AND module_key = :moduleKey`;
      params.moduleKey = moduleKey;
    }
    sql += ` ORDER BY is_default DESC, created_at DESC`;
    
    const rows = await query(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      filter_payload: typeof r.filter_payload === 'string' ? JSON.parse(r.filter_payload) : r.filter_payload
    }));
    res.json({ success: true, data: parsed });
  } catch (err) { next(err); }
});

router.post("/saved-filters", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { filter_name, module_key, filter_payload, is_default } = req.body;
    
    if (!filter_name || !module_key || !filter_payload) {
      return res.status(400).json({ success: false, message: "filter_name, module_key and filter_payload are required" });
    }

    if (is_default) {
      await query(`UPDATE bi_saved_filters SET is_default = 0 WHERE company_id = :companyId AND user_id = :userId AND module_key = :moduleKey`, { companyId, userId, moduleKey: module_key });
    }

    const result = await query(
      `INSERT INTO bi_saved_filters (company_id, user_id, filter_name, module_key, filter_payload, is_default)
       VALUES (:companyId, :userId, :filterName, :moduleKey, :filterPayload, :isDefault)`,
      {
        companyId,
        userId,
        filterName: filter_name,
        moduleKey: module_key,
        filterPayload: JSON.stringify(filter_payload),
        isDefault: is_default ? 1 : 0
      }
    );

    res.json({ success: true, id: result.insertId, message: "Filter saved successfully" });
  } catch (err) { next(err); }
});

router.delete("/saved-filters/:id", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { id } = req.params;

    await query(`DELETE FROM bi_saved_filters WHERE id = :id AND (company_id = :companyId OR company_id IS NULL) AND user_id = :userId`, { id, companyId, userId });
    res.json({ success: true, message: "Filter deleted" });
  } catch (err) { next(err); }
});

// ===== SAVED ANALYSES =====
router.get("/saved-analyses", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { moduleKey } = req.query;

    let sql = `SELECT a.*, u.name as creator_name 
               FROM bi_saved_analyses a
               LEFT JOIN adm_users u ON a.user_id = u.id
               WHERE (a.company_id = :companyId OR a.company_id IS NULL) 
                 AND (a.user_id = :userId OR a.id IN (SELECT analysis_id FROM bi_shared_analyses WHERE target_id = :userId AND share_type = 'USER'))`;
    const params = { companyId, userId };
    if (moduleKey) {
      sql += ` AND a.module_key = :moduleKey`;
      params.moduleKey = moduleKey;
    }
    sql += ` ORDER BY a.updated_at DESC`;

    const rows = await query(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      filters: typeof r.filters === 'string' ? JSON.parse(r.filters) : r.filters,
      metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics
    }));
    res.json({ success: true, data: parsed });
  } catch (err) { next(err); }
});

router.post("/saved-analyses", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { title, description, module_key, dimension, filters, chart_type, metrics } = req.body;

    if (!title || !module_key) {
      return res.status(400).json({ success: false, message: "title and module_key are required" });
    }

    const result = await query(
      `INSERT INTO bi_saved_analyses (company_id, user_id, title, description, module_key, dimension, filters, chart_type, metrics)
       VALUES (:companyId, :userId, :title, :description, :moduleKey, :dimension, :filters, :chartType, :metrics)`,
      {
        companyId,
        userId,
        title,
        description: description || null,
        moduleKey: module_key,
        dimension: dimension || null,
        filters: JSON.stringify(filters || {}),
        chartType: chart_type || 'bar',
        metrics: JSON.stringify(metrics || {})
      }
    );

    res.json({ success: true, id: result.insertId, message: "Analysis saved successfully" });
  } catch (err) { next(err); }
});

router.delete("/saved-analyses/:id", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { id } = req.params;

    await query(`DELETE FROM bi_saved_analyses WHERE id = :id AND (company_id = :companyId OR company_id IS NULL) AND user_id = :userId`, { id, companyId, userId });
    await query(`DELETE FROM bi_shared_analyses WHERE analysis_id = :id`, { id });
    res.json({ success: true, message: "Analysis deleted" });
  } catch (err) { next(err); }
});

// ===== SHARE ANALYSIS =====
router.post("/share-analysis", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.id || 1;
    const { analysis_id, share_type = 'USER', target_id, permission_level = 'VIEW_FILTER' } = req.body;

    if (!analysis_id || !target_id) {
      return res.status(400).json({ success: false, message: "analysis_id and target_id are required" });
    }

    await query(
      `INSERT INTO bi_shared_analyses (company_id, analysis_id, shared_by_id, share_type, target_id, permission_level)
       VALUES (:companyId, :analysisId, :userId, :shareType, :targetId, :permLevel)`,
      { companyId, analysisId: analysis_id, userId, shareType: share_type, targetId: target_id, permLevel: permission_level }
    );

    res.json({ success: true, message: "Analysis shared successfully" });
  } catch (err) { next(err); }
});

// ===== DRILL-DOWN ENGINE =====
router.post("/drill-down", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { module = "sales", dimension = "summary", filters = {} } = req.body;
    const { from, to, customerId, supplierId, warehouseId, categoryId, status, branchId: filterBranchId } = filters;

    const activeBranchId = filterBranchId || branchId;
    const p = {
      companyId,
      branchId: activeBranchId,
      branchIdsStr: String(branchIdsStr || (activeBranchId ? String(activeBranchId) : "")),
      from: from || null,
      to: to || null,
      customerId: customerId || null,
      supplierId: supplierId || null,
      warehouseId: warehouseId || null,
      categoryId: categoryId || null,
      status: status || null,
    };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";
    const dateRangeSales = from && to ? "AND invoice_date BETWEEN :from AND :to" : from ? "AND invoice_date >= :from" : to ? "AND invoice_date <= :to" : "";
    const dateRangePurch = from && to ? "AND po_date BETWEEN :from AND :to" : from ? "AND po_date >= :from" : to ? "AND po_date <= :to" : "";
    const dateRangeWO = from && to ? "AND work_order_date BETWEEN :from AND :to" : from ? "AND work_order_date >= :from" : to ? "AND work_order_date <= :to" : "";

    let result = {
      module,
      dimension,
      levelTitle: "",
      nextDimension: "",
      totalAmount: 0,
      totalCount: 0,
      items: []
    };

    // ─── 1. SALES DRILL-DOWN ──────────────────────────────
    if (module === "sales" || module === "financial") {
      if (dimension === "summary" || dimension === "branch") {
        result.levelTitle = "Revenue by Branch";
        result.nextDimension = "customer";
        const rows = await sq(
          `SELECT 
             b.id as id,
             COALESCE(b.branch_name, 'Headquarters') as name,
             b.branch_code as code,
             COUNT(i.id) as count,
             COALESCE(SUM(i.total_amount), 0) as metricValue,
             COALESCE(SUM(i.net_amount), 0) as netAmount
           FROM sal_invoices i
           LEFT JOIN adm_branches b ON i.branch_id = b.id
           WHERE (i.company_id = :companyId OR i.company_id IS NULL) AND ${whereBranch} ${dateRangeSales}
             AND i.status NOT IN ('CANCELLED', 'DRAFT')
           GROUP BY b.id, b.branch_name, b.branch_code
           ORDER BY metricValue DESC`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: r.name, subLabel: `${r.count} invoice(s)` }));
      } else if (dimension === "customer") {
        result.levelTitle = "Revenue by Customer";
        result.nextDimension = "invoices";
        const rows = await sq(
          `SELECT 
             c.id as id,
             c.customer_name as name,
             c.customer_code as code,
             COUNT(i.id) as count,
             COALESCE(SUM(i.total_amount), 0) as metricValue,
             COALESCE(SUM(i.balance_due), 0) as outstanding
           FROM sal_invoices i
           JOIN sal_customers c ON i.customer_id = c.id
           WHERE (i.company_id = :companyId OR i.company_id IS NULL) AND ${whereBranch} ${dateRangeSales}
             AND i.status NOT IN ('CANCELLED', 'DRAFT')
           GROUP BY c.id, c.customer_name, c.customer_code
           ORDER BY metricValue DESC LIMIT 50`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: r.name, subLabel: `${r.count} invoice(s) • Outstanding: GHS ${Number(r.outstanding||0).toFixed(2)}` }));
      } else if (dimension === "invoices" || dimension === "transactions") {
        result.levelTitle = "Invoices & Transaction Line Items";
        result.nextDimension = "detail";
        const rows = await sq(
          `SELECT 
             i.id as id,
             i.invoice_number as name,
             i.invoice_number as code,
             c.customer_name,
             i.total_amount as metricValue,
             i.invoice_date as transactionDate,
             i.status,
             CONCAT('/sales/invoices/', i.id) as sourceRecordUrl
           FROM sal_invoices i
           LEFT JOIN sal_customers c ON i.customer_id = c.id
           WHERE (i.company_id = :companyId OR i.company_id IS NULL) AND ${whereBranch} ${dateRangeSales}
             AND (:customerId IS NULL OR i.customer_id = :customerId)
             AND i.status NOT IN ('CANCELLED', 'DRAFT')
           ORDER BY i.invoice_date DESC, i.id DESC LIMIT 50`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: `${r.name} (${r.customer_name || 'Walk-in'})`, subLabel: `Date: ${String(r.transactionDate||'').split('T')[0]} • Status: ${r.status}`, canDrillThrough: true }));
      }
    }

    // ─── 2. PURCHASE DRILL-DOWN ───────────────────────────
    else if (module === "purchase") {
      if (dimension === "summary" || dimension === "supplier") {
        result.levelTitle = "Spend by Supplier";
        result.nextDimension = "orders";
        const rows = await sq(
          `SELECT 
             s.id as id,
             s.supplier_name as name,
             s.supplier_code as code,
             COUNT(p.id) as count,
             COALESCE(SUM(p.total_amount), 0) as metricValue
           FROM pur_orders p
           JOIN pur_suppliers s ON p.supplier_id = s.id
           WHERE (p.company_id = :companyId OR p.company_id IS NULL) AND ${whereBranch} ${dateRangePurch}
             AND p.status NOT IN ('CANCELLED')
           GROUP BY s.id, s.supplier_name, s.supplier_code
           ORDER BY metricValue DESC LIMIT 50`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: r.name, subLabel: `${r.count} PO(s)` }));
      } else if (dimension === "orders" || dimension === "transactions") {
        result.levelTitle = "Purchase Orders & Source Records";
        result.nextDimension = "detail";
        const rows = await sq(
          `SELECT 
             p.id as id,
             p.po_number as name,
             p.po_number as code,
             s.supplier_name,
             p.total_amount as metricValue,
             p.po_date as transactionDate,
             p.status,
             CONCAT('/purchase/orders/', p.id) as sourceRecordUrl
           FROM pur_orders p
           LEFT JOIN pur_suppliers s ON p.supplier_id = s.id
           WHERE (p.company_id = :companyId OR p.company_id IS NULL) AND ${whereBranch} ${dateRangePurch}
             AND (:supplierId IS NULL OR p.supplier_id = :supplierId)
             AND p.status NOT IN ('CANCELLED')
           ORDER BY p.po_date DESC, p.id DESC LIMIT 50`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: `${r.name} (${r.supplier_name || 'Vendor'})`, subLabel: `PO Date: ${String(r.transactionDate||'').split('T')[0]} • Status: ${r.status}`, canDrillThrough: true }));
      }
    }

    // ─── 3. INVENTORY DRILL-DOWN ──────────────────────────
    else if (module === "inventory") {
      if (dimension === "summary" || dimension === "category") {
        result.levelTitle = "Stock Value by Category";
        result.nextDimension = "items";
        const rows = await sq(
          `SELECT 
             c.id as id,
             COALESCE(c.category_name, 'Uncategorized') as name,
             COUNT(DISTINCT i.id) as count,
             COALESCE(SUM(sb.qty), 0) as totalQty,
             COALESCE(SUM(sb.qty * COALESCE(ip.unit_price, 0)), 0) as metricValue
           FROM inv_items i
           LEFT JOIN inv_item_categories c ON i.category_id = c.id
           LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL)
           LEFT JOIN inv_product_prices ip ON ip.item_id = i.id
           WHERE (i.company_id = :companyId OR i.company_id IS NULL)
           GROUP BY c.id, c.category_name
           ORDER BY metricValue DESC`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: r.name, subLabel: `${r.count} item(s) • ${Number(r.totalQty||0).toLocaleString()} in stock` }));
      } else if (dimension === "items" || dimension === "transactions") {
        result.levelTitle = "Stock Items & Valuation";
        result.nextDimension = "detail";
        const rows = await sq(
          `SELECT 
             i.id as id,
             i.item_name as name,
             i.item_code as code,
             COALESCE(sb.qty, 0) as stockQty,
             COALESCE(r.reorder_level, 0) as reorderPoint,
             COALESCE(sb.qty * COALESCE(ip.unit_price, 0), 0) as metricValue,
             CONCAT('/inventory/items/', i.id) as sourceRecordUrl
           FROM inv_items i
           LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL)
           LEFT JOIN inv_product_prices ip ON ip.item_id = i.id
           LEFT JOIN inv_reorder_points r ON r.item_id = i.id AND (r.company_id = :companyId OR r.company_id IS NULL)
           WHERE (i.company_id = :companyId OR i.company_id IS NULL)
             AND (:categoryId IS NULL OR i.category_id = :categoryId)
           ORDER BY metricValue DESC LIMIT 50`,
          p
        );
        result.items = rows.map(r => ({ ...r, label: `${r.name} (${r.code || 'SKU'})`, subLabel: `Stock: ${Number(r.stockQty||0).toLocaleString()} • Reorder Level: ${r.reorderPoint}`, canDrillThrough: true }));
      }
    }

    // ─── 4. PRODUCTION DRILL-DOWN ─────────────────────────
    else if (module === "production") {
      result.levelTitle = "Production Orders & Shop Floor Runs";
      result.nextDimension = "detail";
      const rows = await sq(
        `SELECT 
           wo.id as id,
           wo.work_order_no as name,
           wo.work_order_no as code,
           COALESCE(i.item_name, b.bom_name, 'Manufactured Item') as itemName,
           wo.qty_to_produce as metricValue,
           wo.status,
           wo.work_order_date as transactionDate,
           CONCAT('/production/work-orders/', wo.id) as sourceRecordUrl
         FROM prod_work_orders wo
         LEFT JOIN prod_boms b ON wo.bom_id = b.id
         LEFT JOIN inv_items i ON b.item_id = i.id
         WHERE (wo.company_id = :companyId OR wo.company_id IS NULL) AND ${whereBranch} ${dateRangeWO}
         ORDER BY wo.work_order_date DESC, wo.id DESC LIMIT 50`,
        p
      );
      result.items = rows.map(r => ({ ...r, label: `${r.name} • ${r.itemName}`, subLabel: `Target: ${Number(r.metricValue||0).toLocaleString()} units • Status: ${r.status}`, canDrillThrough: true }));
    }

    // ─── 5. PROJECTS DRILL-DOWN ───────────────────────────
    else if (module === "projects") {
      result.levelTitle = "Project Portfolios & Budget Tracking";
      result.nextDimension = "detail";
      const rows = await sq(
        `SELECT 
           p.id as id,
           p.project_name as name,
           p.project_code as code,
           COALESCE(p.budget, 0) as metricValue,
           COALESCE(e.spent, 0) as spent,
           COALESCE(p.project_status, 'PLANNING') as status,
           CONCAT('/project-management/projects/', p.id) as sourceRecordUrl
         FROM pm_projects p
         LEFT JOIN (SELECT project_id, SUM(amount) as spent FROM pm_expenses GROUP BY project_id) e ON e.project_id = p.id
         WHERE (p.company_id = :companyId OR p.company_id IS NULL) AND ${whereBranch}
         ORDER BY p.created_at DESC LIMIT 50`,
        p
      );
      result.items = rows.map(r => ({ ...r, label: `${r.name} (${r.code || 'PRJ'})`, subLabel: `Budget: GHS ${Number(r.metricValue||0).toLocaleString()} • Spent: GHS ${Number(r.spent||0).toLocaleString()} • Status: ${r.status}`, canDrillThrough: true }));
    }

    result.totalAmount = result.items.reduce((sum, item) => sum + Number(item.metricValue || 0), 0);
    result.totalCount = result.items.length;

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ===== EXECUTIVE DIAGNOSTICS & ANOMALIES =====
router.get("/diagnostics", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const diagnostics = [];
    const [
      [salesComp],
      [lowStockRows],
      [overBudgetRows],
      [overdueTaskRows],
      [scrapRows],
      [arAgingRows],
    ] = await Promise.all([
      sq(`SELECT 
            COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as currRev,
            COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END),0) as prevRev
          FROM sal_invoices WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')`, p, [{ currRev: 0, prevRev: 0 }]),
      sq(`SELECT COUNT(*) as count FROM inv_items i JOIN inv_stock_balances sb ON sb.item_id=i.id JOIN inv_reorder_points r ON r.item_id=i.id WHERE (i.company_id=:companyId OR i.company_id IS NULL) AND COALESCE(sb.qty,0) <= r.reorder_level`, p, [{ count: 0 }]),
      sq(`SELECT COUNT(*) as count FROM pm_projects p WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND COALESCE(p.project_status,'') IN ('IN_PROGRESS','active') AND p.budget > 0 AND (SELECT COALESCE(SUM(amount),0) FROM pm_expenses WHERE project_id=p.id) > p.budget`, p, [{ count: 0 }]),
      sq(`SELECT COUNT(*) as count FROM pm_tasks WHERE (company_id=:companyId OR company_id IS NULL) AND status NOT IN ('COMPLETED','CANCELLED') AND end_date < CURDATE()`, p, [{ count: 0 }]),
      sq(`SELECT COALESCE(SUM(good_qty),SUM(actual_qty),0) as good, COALESCE(SUM(scrap_qty),SUM(rejected_qty),0) as scrap FROM prod_job_cards WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch}`, p, [{ good: 0, scrap: 0 }]),
      sq(`SELECT COALESCE(SUM(balance),0) as totalAR FROM fin_customer_balances WHERE (company_id=:companyId OR company_id IS NULL)`, p, [{ totalAR: 0 }]),
    ]);

    // 1. Sales Growth / Decline
    const curr = Number(salesComp?.currRev || 0);
    const prev = Number(salesComp?.prevRev || 0);
    if (prev > 0) {
      const growthPct = ((curr - prev) / prev) * 100;
      diagnostics.push({
        id: "sales-variance",
        category: "Sales",
        severity: growthPct < -10 ? "critical" : growthPct < 0 ? "warning" : "positive",
        title: growthPct >= 0 ? `Revenue increased by ${growthPct.toFixed(1)}%` : `Revenue dropped by ${Math.abs(growthPct).toFixed(1)}%`,
        message: `Current month revenue (GHS ${curr.toLocaleString()}) vs last month (GHS ${prev.toLocaleString()}).`,
        targetLink: "/business-intelligence/financial",
        recommendedDimension: "customer"
      });
    }

    // 2. Inventory Deficits
    const lowStockCount = Number(lowStockRows?.count || 0);
    if (lowStockCount > 0) {
      diagnostics.push({
        id: "inventory-deficit",
        category: "Inventory",
        severity: "warning",
        title: `${lowStockCount} stock item(s) below reorder threshold`,
        message: "Immediate purchase orders or production replenishments recommended to prevent stockout bottlenecks.",
        targetLink: "/business-intelligence/inventory",
        recommendedDimension: "items"
      });
    }

    // 3. Project Budget Overruns
    const overBudgetCount = Number(overBudgetRows?.count || 0);
    if (overBudgetCount > 0) {
      diagnostics.push({
        id: "project-overbudget",
        category: "Projects",
        severity: "critical",
        title: `${overBudgetCount} project(s) exceeded authorized budget`,
        message: "Cumulative expenditures exceed the approved baseline budget limit.",
        targetLink: "/business-intelligence/projects",
        recommendedDimension: "projects"
      });
    }

    // 4. Overdue Tasks
    const overdueTasksCount = Number(overdueTaskRows?.count || 0);
    if (overdueTasksCount > 0) {
      diagnostics.push({
        id: "project-overdue-tasks",
        category: "Projects",
        severity: "warning",
        title: `${overdueTasksCount} overdue project milestone task(s)`,
        message: "Milestone completion dates have slipped past scheduled finish dates.",
        targetLink: "/business-intelligence/projects",
        recommendedDimension: "tasks"
      });
    }

    // 5. Production Scrap Rate
    const goodQty = Number(scrapRows?.good || 0);
    const scrapQty = Number(scrapRows?.scrap || 0);
    const totalOutput = goodQty + scrapQty;
    const scrapRate = totalOutput > 0 ? (scrapQty / totalOutput) * 100 : 0;
    if (scrapRate > 2.0) {
      diagnostics.push({
        id: "production-scrap-elevated",
        category: "Production",
        severity: scrapRate > 5.0 ? "critical" : "warning",
        title: `Shop floor scrap rate at ${scrapRate.toFixed(1)}%`,
        message: "Scrap generation is above the 2.0% enterprise operational tolerance.",
        targetLink: "/business-intelligence/production",
        recommendedDimension: "production"
      });
    }

    res.json({ success: true, data: { count: diagnostics.length, items: diagnostics, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

// ===== ALERTS CENTER =====
router.get("/alerts", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || "") };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

    const alerts = [];
    const [lowStock, overBudget, overdueTasks, vehicles, openMaint, pendingPOs] = await Promise.all([
      sq(`SELECT i.item_name, COALESCE(sb.qty,0) as qty, COALESCE(r.reorder_level,0) as reorder FROM inv_items i LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND (sb.company_id=:companyId OR sb.company_id IS NULL) AND (:branchId IS NULL OR sb.branch_id=:branchId OR :branchIdsStr='' OR FIND_IN_SET(sb.branch_id,:branchIdsStr) OR sb.branch_id IS NULL) LEFT JOIN inv_reorder_points r ON r.item_id=i.id AND (r.company_id=:companyId OR r.company_id IS NULL) WHERE (i.company_id=:companyId OR i.company_id IS NULL) AND COALESCE(sb.qty,0) <= COALESCE(r.reorder_level,0) AND r.reorder_level IS NOT NULL LIMIT 20`, p, []),
      sq(`SELECT p.project_name, p.budget, COALESCE(SUM(e.amount),0) as spent FROM pm_projects p LEFT JOIN pm_expenses e ON e.project_id=p.id WHERE (p.company_id=:companyId OR p.company_id IS NULL) AND COALESCE(p.project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION') AND p.budget > 0 GROUP BY p.id, p.project_name, p.budget HAVING spent > p.budget LIMIT 10`, p, []),
      sq(`SELECT task_title, end_date FROM pm_tasks WHERE (company_id=:companyId OR company_id IS NULL) AND status NOT IN ('COMPLETED','CANCELLED') AND end_date < CURDATE() LIMIT 10`, p, []),
      sq("SELECT vehicle_number, model FROM trans_vehicles WHERE (company_id=:companyId OR company_id IS NULL) AND status='MAINTENANCE' AND deleted_at IS NULL LIMIT 10", p, []),
      sq("SELECT COUNT(*) as cnt FROM maint_job_orders WHERE (company_id=:companyId OR company_id IS NULL) AND status NOT IN ('COMPLETED','CANCELLED') AND deleted_at IS NULL", p, [{cnt:0}]),
      sq(`SELECT COUNT(*) as cnt FROM pur_orders WHERE (company_id=:companyId OR company_id IS NULL) AND ${whereBranch} AND status='PENDING'`, p, [{cnt:0}]),
    ]);
    lowStock.forEach(i => alerts.push({ severity: "warning", category: "Inventory", message: i.item_name + " is below reorder level (" + i.qty + " / " + i.reorder + ")" }));
    overBudget.forEach(ob => alerts.push({ severity: "critical", category: "Projects", message: 'Project "' + ob.project_name + '" exceeded budget' }));
    overdueTasks.forEach(t => alerts.push({ severity: "warning", category: "Projects", message: 'Task "' + t.task_title + '" is overdue' }));
    vehicles.forEach(v => alerts.push({ severity: "info", category: "Fleet", message: "Vehicle " + v.vehicle_number + " (" + v.model + ") is under maintenance" }));
    if (Number(openMaint[0]?.cnt||0) > 3) alerts.push({ severity: "warning", category: "Maintenance", message: openMaint[0].cnt + " open maintenance jobs need attention" });
    if (Number(pendingPOs[0]?.cnt||0) > 0) alerts.push({ severity: "info", category: "Purchase", message: pendingPOs[0].cnt + " purchase orders pending approval" });
    res.json({ success: true, data: { alerts, count: alerts.length, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

export default router;

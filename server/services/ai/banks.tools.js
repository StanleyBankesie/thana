/**
 * @fileoverview Banks AI Tools definition & database execution.
 * Equips the "Banks" AI Assistant with read-only domain queries across all OmniSuite ERP modules.
 * Fully enforces RBAC and module-level permission security.
 */

import { query } from "../../db/pool.js";

// Helper safe query
async function sq(sql, params = {}, fallback = []) {
  try {
    const res = await query(sql, params);
    return Array.isArray(res) ? res : [res];
  } catch (err) {
    console.error("[Banks AI Tool SQL Error]:", err?.message);
    return fallback;
  }
}

/**
 * Maps tools to the module(s) required to execute them.
 */
export const TOOL_MODULES = {
  get_executive_overview: ["business_intelligence", "administration", "sales", "finance"],
  get_financial_analytics: ["sales", "finance", "purchase", "purchases", "accounting"],
  get_recent_sales: ["sales", "pos", "finance", "business_intelligence", "administration"],
  get_recent_purchases: ["purchase", "purchases", "procurement", "finance", "accounting", "business_intelligence"],
  get_recent_payments_and_receipts: ["finance", "accounting", "purchase", "sales"],
  get_inventory_health: ["inventory"],
  get_production_status: ["production"],
  get_project_analytics: ["project_management", "projects"],
  get_pos_performance: ["pos", "sales"],
  get_hr_overview: ["human_resource", "hr"],
  get_transport_fleet: ["transport"],
  get_maintenance_jobs: ["maintenance"],
  search_erp_entity: ["*"],
  get_erp_workflow_guide: ["*"],
  run_sql_query: ["*"],
  get_database_schema: ["*"],
};

/**
 * Check if the user has access to a required module.
 */
function hasModuleAccess(requiredModules, scope = {}) {
  if (
    scope.isSuperAdmin ||
    scope.userContext?.isSuperAdmin ||
    scope.userId === 1 ||
    scope.id === 1
  ) {
    return true;
  }
  if (!requiredModules || requiredModules.includes("*")) return true;
  const rawAllowed = scope.allowedModules || scope.userContext?.allowedModules || ["*"];
  const allowed = (Array.isArray(rawAllowed) ? rawAllowed : [rawAllowed]).map((m) => String(m).toLowerCase());
  if (allowed.includes("*")) return true;

  return requiredModules.some((reqMod) => allowed.includes(reqMod.toLowerCase()));
}

/**
 * List of tools in OpenAI/Groq function calling format.
 */
export const BANKS_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_executive_overview",
      description: "Get high-level executive KPIs across revenue, expenses, inventory valuation, production output, active projects, POS sales, headcount, and fleet deliveries.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "Optional period filter: 'this_month', 'last_month', 'all_time'",
            enum: ["this_month", "last_month", "all_time"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_analytics",
      description: "Get financial performance including total revenue, purchase expenses, gross profit, recent monthly revenue trends, top customers by revenue, and top suppliers by spend.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of top customers/suppliers to retrieve (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_health",
      description: "Get inventory statistics: total items, total units in stock, total inventory valuation (GHS), items below safety reorder level, and stock distribution by category or warehouse.",
      parameters: {
        type: "object",
        properties: {
          warehouseId: { type: "number", description: "Optional warehouse ID filter" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_production_status",
      description: "Get production floor status: active work orders by status, completed output units, machine uptime/status, active BOMs, and QC pass rate.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_analytics",
      description: "Get project management status: total projects, active projects, total allocated budget, expenses incurred, and recent milestones.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_purchases",
      description: "CRITICAL: Call this tool whenever the user asks about ANY 'purchase', 'last purchase', 'latest purchase', 'purchase amount', 'what did I purchase / buy', 'purchase bill', 'direct purchase', 'purchase order', 'supplier bills', or procurement expenses. Retrieves live purchase orders, bills, and direct purchases from suppliers with exact dates and amounts in GH₵.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of recent purchases to retrieve (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_sales",
      description: "Get recent SALES transactions (Customer Sales Invoices and POS Retail Sales to customers). DO NOT call this tool for questions about 'purchases' or 'buying' (use get_recent_purchases instead).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of recent transactions to return (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_payments_and_receipts",
      description: "Get recent finance payment vouchers (disbursements/settlements) and receipt vouchers (collections), voucher numbers, dates, amounts in GH₵, bank/cash accounts, and narrations.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of recent vouchers to retrieve (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pos_performance",
      description: "Get retail POS customer sales metrics: today's revenue, today's transaction count, top selling products. This is exclusively for retail sales to customers, NOT for business purchases.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hr_overview",
      description: "Get workforce overview: total active staff headcount, department distribution, and recent hires.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transport_fleet",
      description: "Get transport and logistics statistics: deliveries by status (Delivered, In Transit, Pending), total transport income and expenses.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_maintenance_jobs",
      description: "Get maintenance department status: total job orders, open/pending jobs, and completed maintenance tasks.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_erp_entity",
      description: "Search specific ERP records (customer by name/code, inventory item by code/name, invoice by number, purchase order by number, or work order by number).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search keyword, document number, code, or name" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_erp_workflow_guide",
      description: "Get step-by-step guidance on how to perform specific workflows or navigate pages in OmniSuite ERP (e.g., how to create a work order, approve an invoice, perform stock count, or manage fleet).",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The workflow or topic to get instructions for (e.g., 'production', 'inventory', 'sales', 'pos', 'projects', 'hr')" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description: "Execute any read-only SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN) directly against the OmniSuite ERP MySQL database to fetch any raw records, transactions, ledger entries, accounts, custom metrics, users, or line items. Use this whenever you need deep or unrestricted access to any database table.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "The SQL SELECT statement to execute against the database. Example: 'SELECT * FROM pur_direct_purchase_hdr ORDER BY id DESC LIMIT 5;'",
          },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_database_schema",
      description: "Get the database schema (list of all tables or column definitions for a specific table) in the OmniSuite ERP database.",
      parameters: {
        type: "object",
        properties: {
          tableName: {
            type: "string",
            description: "Optional specific table name (e.g., 'sal_invoices', 'pur_bills', 'fin_vouchers', 'inv_items', 'adm_users'). If omitted, returns all table names.",
          },
        },
      },
    },
  },
];

/**
 * Execute a safe, read-only database query for a requested tool.
 *
 * @param {string} name Tool function name
 * @param {object} args Function arguments
 * @param {object} scope Multi-tenant / branch scope & user RBAC context
 * @returns {Promise<object>} Query result object
 */
export async function executeTool(name, args = {}, scope = {}) {
  const companyId = scope.companyId || 1;
  const branchId = scope.branchId || null;
  const p = { companyId, ...(branchId ? { branchId } : {}) };

  // RBAC Permission Check
  if (TOOL_MODULES[name]) {
    const requiredMods = TOOL_MODULES[name];
    if (!hasModuleAccess(requiredMods, scope)) {
      return {
        accessDenied: true,
        error: `PERMISSION DENIED: You do not have authorization to view ${name.replace("get_", "").replace(/_/g, " ")} data in OmniSuite ERP.`,
      };
    }
  }

  try {
    switch (name) {
      case "get_executive_overview": {
        const canSales = hasModuleAccess(["sales", "finance"], scope);
        const canInv = hasModuleAccess(["inventory"], scope);
        const canProd = hasModuleAccess(["production"], scope);
        const canProj = hasModuleAccess(["projects", "project_management"], scope);
        const canPos = hasModuleAccess(["pos"], scope);
        const canHr = hasModuleAccess(["hr", "human_resource"], scope);

        const queries = [];
        queries.push(canSales ? sq(`SELECT COALESCE(SUM(total_amount), 0) as totalRevenue, COUNT(*) as invoiceCount FROM sal_invoices WHERE status != 'CANCELLED'`, p, [{ totalRevenue: 0, invoiceCount: 0 }]) : Promise.resolve([{ totalRevenue: "Restricted", invoiceCount: "Restricted" }]));
        queries.push(canSales ? sq(`SELECT COALESCE(SUM(total_amount), 0) as totalPurchases, COUNT(*) as poCount FROM pur_orders WHERE status != 'CANCELLED'`, p, [{ totalPurchases: 0, poCount: 0 }]) : Promise.resolve([{ totalPurchases: "Restricted", poCount: "Restricted" }]));
        queries.push(canInv ? sq(`SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity_on_hand), 0) as totalUnits, COALESCE(SUM(quantity_on_hand * cost_price), 0) as inventoryValuation FROM inv_items WHERE is_active = 1`, p, [{ totalItems: 0, totalUnits: 0, inventoryValuation: 0 }]) : Promise.resolve([{ totalItems: "Restricted", totalUnits: "Restricted", inventoryValuation: "Restricted" }]));
        queries.push(canProd ? sq(`SELECT COUNT(*) as totalWorkOrders, COALESCE(SUM(qty_to_produce), 0) as totalTargetUnits, COALESCE(SUM(qty_produced), 0) as completedUnits FROM prod_work_orders`, p, [{ totalWorkOrders: 0, totalTargetUnits: 0, completedUnits: 0 }]) : Promise.resolve([{ totalWorkOrders: "Restricted", totalTargetUnits: "Restricted", completedUnits: "Restricted" }]));
        queries.push(canProj ? sq(`SELECT COUNT(*) as totalProjects, COALESCE(SUM(budget), 0) as totalBudget, COALESCE(SUM(spent), 0) as totalSpent FROM pm_projects`, p, [{ totalProjects: 0, totalBudget: 0, totalSpent: 0 }]) : Promise.resolve([{ totalProjects: "Restricted", totalBudget: "Restricted", totalSpent: "Restricted" }]));
        queries.push(canPos ? sq(`SELECT COALESCE(SUM(total_amount), 0) as posSalesToday, COUNT(*) as posOrdersToday FROM pos_orders WHERE DATE(created_at) = CURDATE()`, p, [{ posSalesToday: 0, posOrdersToday: 0 }]) : Promise.resolve([{ posSalesToday: "Restricted", posOrdersToday: "Restricted" }]));
        queries.push(canHr ? sq(`SELECT COUNT(*) as totalEmployees FROM hr_employees WHERE status = 'ACTIVE'`, p, [{ totalEmployees: 0 }]) : Promise.resolve([{ totalEmployees: "Restricted" }]));

        const [
          [sales],
          [purchases],
          [inventory],
          [production],
          [projects],
          [pos],
          [hr],
        ] = await Promise.all(queries);

        const rev = Number(sales?.totalRevenue || 0);
        const exp = Number(purchases?.totalPurchases || 0);

        return {
          currency: "GHS (GH₵)",
          financials: canSales ? {
            totalRevenue: rev,
            totalPurchases: exp,
            grossProfitEstimate: rev - exp,
            invoiceCount: Number(sales?.invoiceCount || 0),
            poCount: Number(purchases?.poCount || 0),
          } : { status: "Access Restricted by Role" },
          inventory: canInv ? {
            totalCatalogItems: Number(inventory?.totalItems || 0),
            totalStockUnits: Number(inventory?.totalUnits || 0),
            totalInventoryValuation: Number(inventory?.inventoryValuation || 0),
          } : { status: "Access Restricted by Role" },
          production: canProd ? {
            totalWorkOrders: Number(production?.totalWorkOrders || 0),
            completedUnits: Number(production?.completedUnits || 0),
            targetUnits: Number(production?.totalTargetUnits || 0),
          } : { status: "Access Restricted by Role" },
          projects: canProj ? {
            totalProjects: Number(projects?.totalProjects || 0),
            totalAllocatedBudget: Number(projects?.totalBudget || 0),
            totalSpent: Number(projects?.totalSpent || 0),
          } : { status: "Access Restricted by Role" },
          pos: canPos ? {
            posSalesToday: Number(pos?.posSalesToday || 0),
            posOrdersToday: Number(pos?.posOrdersToday || 0),
          } : { status: "Access Restricted by Role" },
          hr: canHr ? {
            activeHeadcount: Number(hr?.totalEmployees || 0),
          } : { status: "Access Restricted by Role" },
        };
      }

      case "get_financial_analytics": {
        const limit = Number(args.limit) || 5;

        const [
          [summary],
          monthlyTrends,
          topCustomers,
          topSuppliers,
        ] = await Promise.all([
          sq(
            `SELECT 
              (SELECT COALESCE(SUM(total_amount), 0) FROM sal_invoices WHERE status != 'CANCELLED') as totalRevenue,
              (SELECT COALESCE(SUM(total_amount), 0) FROM pur_orders WHERE status != 'CANCELLED') as totalPurchases,
              (SELECT COUNT(*) FROM sal_invoices WHERE status = 'PAID') as paidInvoices,
              (SELECT COUNT(*) FROM sal_invoices WHERE status = 'UNPAID') as unpaidInvoices`,
            p,
            [{ totalRevenue: 0, totalPurchases: 0, paidInvoices: 0, unpaidInvoices: 0 }]
          ),
          sq(
            `SELECT 
              DATE_FORMAT(invoice_date, '%Y-%m') as month,
              COALESCE(SUM(total_amount), 0) as revenue,
              COUNT(*) as count
             FROM sal_invoices 
             WHERE invoice_date IS NOT NULL AND status != 'CANCELLED'
             GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
             ORDER BY month DESC
             LIMIT 6`,
            p,
            []
          ),
          sq(
            `SELECT 
              COALESCE(c.customer_name, 'Unknown') as customerName,
              SUM(i.total_amount) as totalSpend,
              COUNT(i.id) as invoiceCount
             FROM sal_invoices i
             LEFT JOIN sal_customers c ON i.customer_id = c.id
             WHERE i.status != 'CANCELLED'
             GROUP BY i.customer_id, c.customer_name
             ORDER BY totalSpend DESC
             LIMIT ?`,
            [limit],
            []
          ),
          sq(
            `SELECT 
              COALESCE(s.supplier_name, 'Unknown') as supplierName,
              SUM(po.total_amount) as totalPurchases,
              COUNT(po.id) as orderCount
             FROM pur_orders po
             LEFT JOIN pur_suppliers s ON po.supplier_id = s.id
             WHERE po.status != 'CANCELLED'
             GROUP BY po.supplier_id, s.supplier_name
             ORDER BY totalPurchases DESC
             LIMIT ?`,
            [limit],
            []
          ),
        ]);

        const rev = Number(summary?.totalRevenue || 0);
        const exp = Number(summary?.totalPurchases || 0);

        return {
          currency: "GHS (GH₵)",
          totals: {
            totalRevenue: rev,
            totalPurchaseSpend: exp,
            grossProfit: rev - exp,
            paidInvoicesCount: Number(summary?.paidInvoices || 0),
            unpaidInvoicesCount: Number(summary?.unpaidInvoices || 0),
          },
          recentMonthlyRevenueTrends: monthlyTrends,
          topCustomersByRevenue: topCustomers,
          topSuppliersBySpend: topSuppliers,
        };
      }

      case "get_inventory_health": {
        const [
          [totals],
          lowStockItems,
          warehouseDistribution,
        ] = await Promise.all([
          sq(
            `SELECT 
              COUNT(*) as totalItems,
              COALESCE(SUM(quantity_on_hand), 0) as totalUnits,
              COALESCE(SUM(quantity_on_hand * cost_price), 0) as totalValuationGhs,
              SUM(CASE WHEN quantity_on_hand <= reorder_level THEN 1 ELSE 0 END) as lowStockCount
             FROM inv_items WHERE is_active = 1`,
            p,
            [{ totalItems: 0, totalUnits: 0, totalValuationGhs: 0, lowStockCount: 0 }]
          ),
          sq(
            `SELECT 
              item_code, 
              item_name, 
              quantity_on_hand, 
              reorder_level, 
              cost_price, 
              (reorder_level - quantity_on_hand) as deficitQty
             FROM inv_items
             WHERE is_active = 1 AND quantity_on_hand <= reorder_level
             ORDER BY deficitQty DESC
             LIMIT 10`,
            p,
            []
          ),
          sq(
            `SELECT 
              w.warehouse_name,
              COUNT(i.id) as itemCount,
              COALESCE(SUM(i.quantity_on_hand), 0) as totalUnits
             FROM inv_items i
             LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
             WHERE i.is_active = 1
             GROUP BY i.warehouse_id, w.warehouse_name`,
            p,
            []
          ),
        ]);

        return {
          currency: "GHS (GH₵)",
          summary: {
            totalCatalogItems: Number(totals?.totalItems || 0),
            totalStockUnitsOnHand: Number(totals?.totalUnits || 0),
            totalInventoryValuationGhs: Number(totals?.totalValuationGhs || 0),
            itemsBelowReorderLevel: Number(totals?.lowStockCount || 0),
          },
          urgentDeficitReorderItems: lowStockItems,
          warehouseBreakdown: warehouseDistribution,
        };
      }

      case "get_production_status": {
        const [
          [stats],
          workOrdersByStatus,
          machineStatus,
          activeBOMs,
        ] = await Promise.all([
          sq(
            `SELECT 
              COUNT(*) as totalWorkOrders,
              COALESCE(SUM(qty_to_produce), 0) as targetQty,
              COALESCE(SUM(qty_produced), 0) as completedQty
             FROM prod_work_orders`,
            p,
            [{ totalWorkOrders: 0, targetQty: 0, completedQty: 0 }]
          ),
          sq(
            `SELECT status, COUNT(*) as count, COALESCE(SUM(qty_to_produce),0) as plannedUnits
             FROM prod_work_orders
             GROUP BY status`,
            p,
            []
          ),
          sq(
            `SELECT machine_code, machine_name, status, hourly_rate
             FROM prod_machines
             LIMIT 10`,
            p,
            []
          ),
          sq(
            `SELECT bom_code, bom_name, total_cost, is_active
             FROM prod_boms
             WHERE is_active = 1
             LIMIT 5`,
            p,
            []
          ),
        ]);

        const target = Number(stats?.targetQty || 0);
        const produced = Number(stats?.completedQty || 0);
        const completionRate = target > 0 ? ((produced / target) * 100).toFixed(1) : "0.0";

        return {
          workOrderSummary: {
            totalWorkOrders: Number(stats?.totalWorkOrders || 0),
            totalTargetUnits: target,
            totalCompletedUnits: produced,
            completionRatePercent: `${completionRate}%`,
          },
          statusBreakdown: workOrdersByStatus,
          activeMachines: machineStatus,
          activeBOMs: activeBOMs,
        };
      }

      case "get_project_analytics": {
        const [
          [stats],
          recentProjects,
        ] = await Promise.all([
          sq(
            `SELECT 
              COUNT(*) as totalProjects,
              SUM(CASE WHEN status='ACTIVE' OR status='IN_PROGRESS' THEN 1 ELSE 0 END) as activeProjects,
              SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completedProjects,
              COALESCE(SUM(budget), 0) as totalBudget,
              COALESCE(SUM(spent), 0) as totalSpent
             FROM pm_projects`,
            p,
            [{ totalProjects: 0, activeProjects: 0, completedProjects: 0, totalBudget: 0, totalSpent: 0 }]
          ),
          sq(
            `SELECT project_code, name, budget, spent, status, start_date, end_date
             FROM pm_projects
             ORDER BY id DESC
             LIMIT 5`,
            p,
            []
          ),
        ]);

        const budget = Number(stats?.totalBudget || 0);
        const spent = Number(stats?.totalSpent || 0);

        return {
          currency: "GHS (GH₵)",
          projectSummary: {
            totalProjects: Number(stats?.totalProjects || 0),
            activeProjects: Number(stats?.activeProjects || 0),
            completedProjects: Number(stats?.completedProjects || 0),
            totalAllocatedBudget: budget,
            totalExpensesIncurred: spent,
            remainingBudget: budget - spent,
          },
          projectsList: recentProjects,
        };
      }

      case "get_recent_sales": {
        const limit = Number(args.limit) || 5;
        const [
          recentInvoices,
          recentPosSales
        ] = await Promise.all([
          sq(
            `SELECT i.id, i.invoice_no, i.total_amount, i.invoice_date, i.status, c.customer_name 
             FROM sal_invoices i
             LEFT JOIN sal_customers c ON i.customer_id = c.id
             WHERE (i.company_id = :companyId OR i.company_id IS NULL) AND i.status != 'CANCELLED'
             ORDER BY i.invoice_date DESC, i.id DESC 
             LIMIT ${limit}`,
            p,
            []
          ),
          sq(
            `SELECT id, receipt_no, gross_amount, net_amount, payment_method, sale_datetime, status, customer_name 
             FROM pos_sales 
             WHERE (company_id = :companyId OR company_id IS NULL) AND status != 'VOID'
             ORDER BY sale_datetime DESC, id DESC 
             LIMIT ${limit}`,
            p,
            []
          )
        ]);

        const mostRecent = (recentPosSales[0] || recentInvoices[0]) ? {
          type: (recentPosSales[0]?.sale_datetime >= (recentInvoices[0]?.invoice_date || '')) ? 'POS Retail Receipt' : 'Sales Invoice',
          receiptOrInvoiceNumber: recentPosSales[0]?.receipt_no || recentInvoices[0]?.invoice_no,
          amountGHS: Number(recentPosSales[0]?.net_amount || recentInvoices[0]?.total_amount || 0),
          transactionDateTime: recentPosSales[0]?.sale_datetime || recentInvoices[0]?.invoice_date,
          paymentMethod: recentPosSales[0]?.payment_method || 'Official Invoice',
          customer: recentPosSales[0]?.customer_name || recentInvoices[0]?.customer_name || 'Walk-in Retail Customer',
          status: recentPosSales[0]?.status || recentInvoices[0]?.status,
        } : null;

        return {
          currency: "GHS (GH₵)",
          mostRecentCompletedSale: mostRecent,
          recentSalesInvoices: recentInvoices,
          recentPOSRetailSales: recentPosSales,
        };
      }

      case "get_recent_purchases": {
        const limit = Number(args.limit) || 5;
        const [
          recentDirectPurchases,
          recentBills,
          recentPOs,
        ] = await Promise.all([
          sq(
            `SELECT dp.id, dp.dp_no as purchaseNo, dp.dp_date as purchaseDate, dp.net_amount as amount, dp.status, dp.remarks,
                    s.supplier_name as supplierName, s.supplier_code as supplierCode, 'Direct Purchase' as purchaseType
             FROM pur_direct_purchase_hdr dp
             LEFT JOIN pur_suppliers s ON dp.supplier_id = s.id
             WHERE (dp.company_id = :companyId OR dp.company_id IS NULL)
             ORDER BY dp.dp_date DESC, dp.id DESC
             LIMIT ${limit}`,
            p,
            [],
          ),
          sq(
            `SELECT b.id, b.bill_no as purchaseNo, b.bill_date as purchaseDate, b.net_amount as amount, b.amount_paid as amountPaid, b.payment_status as paymentStatus, b.status,
                    s.supplier_name as supplierName, s.supplier_code as supplierCode, 'Purchase Bill' as purchaseType
             FROM pur_bills b
             LEFT JOIN pur_suppliers s ON b.supplier_id = s.id
             WHERE (b.company_id = :companyId OR b.company_id IS NULL)
             ORDER BY b.bill_date DESC, b.id DESC
             LIMIT ${limit}`,
            p,
            [],
          ),
          sq(
            `SELECT po.id, po.po_no as purchaseNo, po.po_date as purchaseDate, po.total_amount as amount, po.status,
                    s.supplier_name as supplierName, s.supplier_code as supplierCode, 'Purchase Order' as purchaseType
             FROM pur_orders po
             LEFT JOIN pur_suppliers s ON po.supplier_id = s.id
             WHERE (po.company_id = :companyId OR po.company_id IS NULL)
             ORDER BY po.po_date DESC, po.id DESC
             LIMIT ${limit}`,
            p,
            [],
          ),
        ]);

        const allCombined = [
          ...recentDirectPurchases,
          ...recentBills,
          ...recentPOs,
        ].sort((a, b) => {
          const dateA = new Date(a.purchaseDate || 0).getTime();
          const dateB = new Date(b.purchaseDate || 0).getTime();
          return dateB - dateA || (b.id || 0) - (a.id || 0);
        });

        const latest = allCombined[0] || null;

        return {
          currency: "GHS (GH₵)",
          latestPurchase: latest
            ? {
                purchaseType: latest.purchaseType,
                documentNumber: latest.purchaseNo,
                supplierName: latest.supplierName || "Supplier",
                purchaseDate: latest.purchaseDate,
                amount: Number(latest.amount || latest.netAmount || 0),
                formattedAmount: `GH₵ ${Number(latest.amount || latest.netAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                status: latest.status,
                paymentStatus:
                  latest.paymentStatus ||
                  (latest.purchaseType === "Direct Purchase"
                    ? "Settled / Paid Upon Purchase"
                    : "N/A"),
              }
            : "No purchase records found in the system.",
          allRecentPurchasesChronological: allCombined.slice(0, limit),
          recentDirectPurchases,
          recentPurchaseBills: recentBills,
          recentPurchaseOrders: recentPOs,
        };
      }

      case "get_recent_payments_and_receipts": {
        const limit = Number(args.limit) || 5;
        const [
          recentPaymentVouchers,
          recentReceiptVouchers,
        ] = await Promise.all([
          sq(
            `SELECT v.id, v.voucher_no as voucherNo, v.voucher_date as voucherDate, v.total_debit as amount, v.narration, v.status,
                    vt.name as voucherTypeName, vt.code as voucherTypeCode
             FROM fin_vouchers v
             INNER JOIN fin_voucher_types vt ON v.voucher_type_id = vt.id
             WHERE (v.company_id = :companyId OR v.company_id IS NULL)
               AND vt.category = 'PAYMENT'
             ORDER BY v.voucher_date DESC, v.id DESC
             LIMIT ${limit}`,
            p,
            [],
          ),
          sq(
            `SELECT v.id, v.voucher_no as voucherNo, v.voucher_date as voucherDate, v.total_credit as amount, v.narration, v.status,
                    vt.name as voucherTypeName, vt.code as voucherTypeCode
             FROM fin_vouchers v
             INNER JOIN fin_voucher_types vt ON v.voucher_type_id = vt.id
             WHERE (v.company_id = :companyId OR v.company_id IS NULL)
               AND vt.category = 'RECEIPT'
             ORDER BY v.voucher_date DESC, v.id DESC
             LIMIT ${limit}`,
            p,
            [],
          ),
        ]);

        return {
          currency: "GHS (GH₵)",
          recentPaymentVouchers,
          recentReceiptVouchers,
        };
      }

      case "get_pos_performance": {
        const [
          [todayStats],
          [lastSale],
          topSellingItems,
        ] = await Promise.all([
          sq(
            `SELECT 
              COALESCE(SUM(net_amount), 0) as todaySales,
              COUNT(*) as todayOrders
             FROM pos_sales
             WHERE (company_id = :companyId OR company_id IS NULL)
               AND DATE(sale_datetime) = CURDATE()
               AND status != 'VOID'`,
            p,
            [{ todaySales: 0, todayOrders: 0 }]
          ),
          sq(
            `SELECT 
              id, receipt_no, gross_amount, net_amount, payment_method, sale_datetime, status
             FROM pos_sales
             WHERE (company_id = :companyId OR company_id IS NULL)
               AND status != 'VOID'
             ORDER BY sale_datetime DESC, id DESC
             LIMIT 1`,
            p,
            []
          ),
          sq(
            `SELECT 
              COALESCE(i.item_name, psl.item_name, 'Item') as item_name,
              SUM(psl.qty) as totalQtySold,
              SUM(psl.line_total) as totalRevenue
             FROM pos_sale_lines psl
             LEFT JOIN inv_items i ON psl.item_id = i.id
             GROUP BY psl.item_id, i.item_name, psl.item_name
             ORDER BY totalRevenue DESC
             LIMIT 5`,
            p,
            []
          ),
        ]);

        return {
          currency: "GHS (GH₵)",
          todaySalesSummary: {
            todaySalesTotal: Number(todayStats?.todaySales || 0),
            todayOrdersCount: Number(todayStats?.todayOrders || 0),
          },
          lastCompletedPOSSale: lastSale || null,
          topSellingRetailItems: topSellingItems,
        };
      }

      case "get_hr_overview": {
        const [
          [headcount],
          departments,
        ] = await Promise.all([
          sq(`SELECT COUNT(*) as total, SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active FROM hr_employees`, p, [{ total: 0, active: 0 }]),
          sq(`SELECT d.name as departmentName, COUNT(e.id) as staffCount 
              FROM hr_employees e 
              LEFT JOIN hr_departments d ON e.department_id = d.id 
              WHERE e.status='ACTIVE' 
              GROUP BY e.department_id, d.name`, p, [])
        ]);

        return {
          totalStaffHeadcount: Number(headcount?.total || 0),
          activeStaff: Number(headcount?.active || 0),
          departmentDistribution: departments,
        };
      }

      case "get_transport_fleet": {
        const [
          deliveriesStatus,
          [finances]
        ] = await Promise.all([
          sq(`SELECT delivery_status, COUNT(*) as count FROM trn_deliveries GROUP BY delivery_status`, p, []),
          sq(`SELECT 
              (SELECT COALESCE(SUM(amount),0) FROM trn_transport_income) as totalIncome,
              (SELECT COALESCE(SUM(amount),0) FROM trn_transport_expenses) as totalExpenses`, p, [{ totalIncome: 0, totalExpenses: 0 }])
        ]);

        return {
          currency: "GHS (GH₵)",
          deliveryStatusBreakdown: deliveriesStatus,
          finances: {
            transportIncome: Number(finances?.totalIncome || 0),
            transportExpenses: Number(finances?.totalExpenses || 0),
          },
        };
      }

      case "get_maintenance_jobs": {
        const [
          [stats],
          recentJobs
        ] = await Promise.all([
          sq(`SELECT COUNT(*) as total,
              SUM(CASE WHEN status NOT IN ('COMPLETED','CANCELLED','CLOSED') THEN 1 ELSE 0 END) as openJobs,
              SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completedJobs
              FROM maint_job_orders`, p, [{ total: 0, openJobs: 0, completedJobs: 0 }]),
          sq(`SELECT order_no, job_order_type, status, priority, instructions FROM maint_job_orders ORDER BY id DESC LIMIT 5`, p, [])
        ]);

        return {
          jobOrdersSummary: {
            total: Number(stats?.total || 0),
            open: Number(stats?.openJobs || 0),
            completed: Number(stats?.completedJobs || 0),
          },
          recentJobOrders: recentJobs,
        };
      }

      case "search_erp_entity": {
        const q = `%${args.query}%`;
        const results = {};
        const canSales = hasModuleAccess(["sales", "finance"], scope);
        const canInv = hasModuleAccess(["inventory"], scope);
        const canPurch = hasModuleAccess(["purchase", "procurement", "finance"], scope);
        const canProd = hasModuleAccess(["production"], scope);
        const canFin = hasModuleAccess(["finance", "accounting"], scope);

        const queries = [];
        queries.push(canSales ? sq(`SELECT id, customer_name, customer_code, email, phone FROM sal_customers WHERE customer_name LIKE ? OR customer_code LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canPurch ? sq(`SELECT id, supplier_name, supplier_code, email, phone FROM pur_suppliers WHERE supplier_name LIKE ? OR supplier_code LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canInv ? sq(`SELECT id, item_code, item_name, cost_price, selling_price FROM inv_items WHERE item_name LIKE ? OR item_code LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canSales ? sq(`SELECT id, invoice_no, total_amount, status, invoice_date FROM sal_invoices WHERE invoice_no LIKE ? LIMIT 5`, [q], []) : Promise.resolve([]));
        queries.push(canPurch ? sq(`SELECT dp.id, dp.dp_no, dp.net_amount as amount, dp.status, dp.dp_date, s.supplier_name FROM pur_direct_purchase_hdr dp LEFT JOIN pur_suppliers s ON dp.supplier_id = s.id WHERE dp.dp_no LIKE ? OR s.supplier_name LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canPurch ? sq(`SELECT b.id, b.bill_no, b.net_amount as amount, b.amount_paid, b.payment_status, b.status, b.bill_date, s.supplier_name FROM pur_bills b LEFT JOIN pur_suppliers s ON b.supplier_id = s.id WHERE b.bill_no LIKE ? OR s.supplier_name LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canPurch ? sq(`SELECT id, po_no, total_amount, status, po_date FROM pur_orders WHERE po_no LIKE ? LIMIT 5`, [q], []) : Promise.resolve([]));
        queries.push(canFin ? sq(`SELECT id, voucher_no, total_debit, total_credit, narration, status, voucher_date FROM fin_vouchers WHERE voucher_no LIKE ? OR narration LIKE ? LIMIT 5`, [q, q], []) : Promise.resolve([]));
        queries.push(canProd ? sq(`SELECT id, work_order_no, qty_to_produce, status FROM prod_work_orders WHERE work_order_no LIKE ? LIMIT 5`, [q], []) : Promise.resolve([]));

        const [customers, suppliers, products, invoices, directPurchases, bills, pos, vouchers, workOrders] = await Promise.all(queries);

        if (customers.length) results.customers = customers;
        if (suppliers.length) results.suppliers = suppliers;
        if (products.length) results.products = products;
        if (invoices.length) results.salesInvoices = invoices;
        if (directPurchases.length) results.directPurchases = directPurchases;
        if (bills.length) results.purchaseBills = bills;
        if (pos.length) results.purchaseOrders = pos;
        if (vouchers.length) results.financeVouchers = vouchers;
        if (workOrders.length) results.workOrders = workOrders;

        return Object.keys(results).length ? results : { message: `No matching authorized ERP records found for query "${args.query}"` };
      }

      case "get_erp_workflow_guide": {
        const topic = (args.topic || "").toLowerCase();
        const guides = {
          production: "To manage production in OmniSuite ERP:\n1. Create a Bill of Materials (BOM) in Production -> Bill of Materials.\n2. Create a Work Order referencing the BOM in Production -> Work Orders.\n3. Issue Job Cards for shop-floor operators.\n4. Perform QC inspections on finished goods in Production -> Quality Inspections.",
          inventory: "To manage inventory in OmniSuite ERP:\n1. Add Items under Inventory -> Item Master.\n2. Setup Warehouses & Bins in Inventory -> Setup.\n3. Track stock balance across locations in Inventory -> Stock Balance.\n4. Perform physical stock verifications under Inventory -> Stock Verification.",
          sales: "To process sales in OmniSuite ERP:\n1. Issue Quotations under Sales -> Quotations.\n2. Convert approved Quotation to a Sales Order in Sales -> Sales Orders.\n3. Generate Dispatch / Delivery Note in Sales -> Deliveries.\n4. Issue official Invoice under Sales -> Invoices.",
          purchases: "To procure items in OmniSuite ERP:\n1. Raise Purchase Requisitions.\n2. Issue Purchase Orders under Purchase -> Purchase Orders.\n3. Record Goods Receipt Note (GRN) upon warehouse delivery.\n4. Match against Supplier Invoices / Bills.",
          pos: "To use the Retail POS:\n1. Open POS Module -> POS Terminal.\n2. Scan barcode or click product tile.\n3. Apply discount or customer account.\n4. Select payment method (Cash, MoMo, Card, Split) and click Complete Sale to print receipt.",
          projects: "To manage projects in OmniSuite ERP:\n1. Create project with budget in Project Management -> Projects.\n2. Assign milestones and tasks to team members.\n3. Log team timesheets under Project Management -> Timesheets.\n4. Track actual project costs vs budget in Project Management -> Expenses.",
        };

        const matchedKey = Object.keys(guides).find(k => topic.includes(k));
        return {
          topic: args.topic,
          guide: matchedKey ? guides[matchedKey] : "OmniSuite ERP integrates all business modules. Navigate via the left sidebar or top module switcher to access authorized functions.",
        };
      }

      case "run_sql_query": {
        const rawSql = String(args.sql || "").trim();
        if (!rawSql) {
          return { error: "No SQL query provided." };
        }

        // Safety check: ensure query is read-only (disallow mutating operations)
        const forbiddenPatterns = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|FLUSH|KILL|EXEC|CALL|LOCK)\b/i;
        if (forbiddenPatterns.test(rawSql)) {
          return {
            error: "Security restriction: Only read-only SQL queries (SELECT, SHOW, DESCRIBE, EXPLAIN) are permitted.",
          };
        }

        try {
          let sqlToRun = rawSql.replace(/;+\s*$/, "");
          // Auto-append LIMIT 100 if no LIMIT is provided to prevent memory overload
          if (!/\bLIMIT\s+\d+/i.test(sqlToRun)) {
            sqlToRun += " LIMIT 100";
          }
          const rows = await query(sqlToRun);
          const resultList = Array.isArray(rows) ? rows : [rows];
          return {
            queryExecuted: sqlToRun,
            rowCount: resultList.length,
            rows: resultList,
          };
        } catch (dbErr) {
          return {
            queryExecuted: rawSql,
            error: `SQL Execution Error: ${dbErr.message}`,
          };
        }
      }

      case "get_database_schema": {
        const table = String(args.tableName || "").trim();
        if (table) {
          const cols = await sq(
            `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = :table AND TABLE_SCHEMA = DATABASE()`,
            { table },
            [],
          );
          return {
            table,
            columns: cols,
          };
        } else {
          const tables = await sq(
            `SELECT TABLE_NAME, TABLE_COMMENT 
             FROM INFORMATION_SCHEMA.TABLES 
             WHERE TABLE_SCHEMA = DATABASE() 
             ORDER BY TABLE_NAME`,
            {},
            [],
          );
          return {
            databaseTables: tables.map((t) => t.TABLE_NAME || t.table_name),
          };
        }
      }

      default:
        return { error: `Tool ${name} not found` };
    }
  } catch (err) {
    return { error: `Tool execution error: ${err.message}` };
  }
}

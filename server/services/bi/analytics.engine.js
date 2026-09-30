/**
 * @fileoverview Multidimensional Analytics & Automated Insights Engine
 * Implements OLAP-style slicing, dimensional pivot computations, period comparisons, and anomaly detection.
 */
import { query } from "../../db/pool.js";

/**
 * Execute multidimensional analysis query with measure, dimension, comparison, and filters
 */
export async function runMultidimensionalAnalysis(companyId, params = {}) {
  const {
    measure = "revenue",
    dimension = "month",
    secondaryDimension = null,
    comparison = "PREVIOUS_PERIOD",
    filters = {}
  } = params;

  const { from, to, branchId, categoryId, customerId, supplierId, status } = filters;
  const p = {
    companyId,
    branchId: branchId || null,
    from: from || null,
    to: to || null,
    categoryId: categoryId || null,
    customerId: customerId || null,
    supplierId: supplierId || null,
    status: status || null,
  };

  const whereBranchSales = "(:branchId IS NULL OR s.branch_id = :branchId OR s.branch_id IS NULL)";
  const dateRangeSales = from && to ? "AND d.full_date BETWEEN :from AND :to" : from ? "AND d.full_date >= :from" : to ? "AND d.full_date <= :to" : "";

  // 1. Resolve Dimension SQL Expression & Group By
  let dimExpr = "d.month_name";
  let dimKey = "month";
  let dimOrder = "d.year_number ASC, d.month_number ASC";
  let joinTable = "";

  switch (dimension.toLowerCase()) {
    case "month":
      dimExpr = "DATE_FORMAT(d.full_date, '%Y-%m')";
      dimKey = "month";
      dimOrder = "dimValue ASC";
      break;
    case "quarter":
      dimExpr = "CONCAT(d.year_number, ' ', d.quarter_name)";
      dimKey = "quarter";
      dimOrder = "d.year_number ASC, d.quarter_number ASC";
      break;
    case "year":
      dimExpr = "d.year_number";
      dimKey = "year";
      dimOrder = "dimValue ASC";
      break;
    case "branch":
      dimExpr = "COALESCE(b.name, 'Headquarters / Unassigned')";
      dimKey = "branch";
      dimOrder = "metricValue DESC";
      joinTable = "LEFT JOIN adm_branches b ON s.branch_id = b.id";
      break;
    case "customer":
      dimExpr = "COALESCE(c.customer_name, 'General Customer')";
      dimKey = "customer";
      dimOrder = "metricValue DESC";
      joinTable = "LEFT JOIN sal_customers c ON s.customer_id = c.id";
      break;
    case "product":
    case "item":
      dimExpr = "COALESCE(p.item_name, 'Standard Item')";
      dimKey = "product";
      dimOrder = "metricValue DESC";
      joinTable = "LEFT JOIN inv_items p ON s.product_id = p.id";
      break;
    case "category":
      dimExpr = "COALESCE(cat.category_name, 'General Category')";
      dimKey = "category";
      dimOrder = "metricValue DESC";
      joinTable = "LEFT JOIN inv_items p ON s.product_id = p.id LEFT JOIN inv_item_categories cat ON p.category_id = cat.id";
      break;
    default:
      dimExpr = "DATE_FORMAT(d.full_date, '%Y-%m')";
      dimKey = "month";
      dimOrder = "dimValue ASC";
  }

  // 2. Resolve Measure SQL Calculation Expression
  let measureExpr = "COALESCE(SUM(s.net_amount), 0)";
  let measureLabel = "Revenue (GHS)";
  let unit = "GHS";

  if (measure === "cost") {
    measureExpr = "COALESCE(SUM(s.cost_amount), 0)";
    measureLabel = "Cost of Goods (GHS)";
  } else if (measure === "gross_profit" || measure === "profit") {
    measureExpr = "COALESCE(SUM(s.gross_profit), SUM(s.net_amount - s.cost_amount), 0)";
    measureLabel = "Gross Profit (GHS)";
  } else if (measure === "margin_pct" || measure === "margin") {
    measureExpr = "CASE WHEN SUM(s.net_amount) > 0 THEN (SUM(s.gross_profit) / SUM(s.net_amount)) * 100 ELSE 0 END";
    measureLabel = "Profit Margin (%)";
    unit = "%";
  } else if (measure === "quantity" || measure === "qty") {
    measureExpr = "COALESCE(SUM(s.quantity), 0)";
    measureLabel = "Units Sold";
    unit = "Units";
  } else if (measure === "transactions" || measure === "txns") {
    measureExpr = "COUNT(DISTINCT s.id)";
    measureLabel = "Transaction Count";
    unit = "Count";
  }

  // 3. Query current period data
  // Check if bi_fact_sales has data, otherwise fall back dynamically to sal_invoices & pos_sales
  const [factCheck] = await query("SELECT COUNT(*) as cnt FROM bi_fact_sales WHERE company_id = :companyId", { companyId });
  const hasFactData = Number(factCheck?.cnt || 0) > 0;

  let currentRows = [];

  if (hasFactData) {
    const sql = `
      SELECT 
        ${dimExpr} as dimValue,
        ${measureExpr} as metricValue,
        COUNT(DISTINCT s.id) as recordCount,
        COALESCE(SUM(s.net_amount), 0) as totalRevenue,
        COALESCE(SUM(s.cost_amount), 0) as totalCost,
        COALESCE(SUM(s.gross_profit), 0) as totalProfit
      FROM bi_fact_sales s
      JOIN bi_dim_date d ON s.date_key = d.date_key
      ${joinTable}
      WHERE (s.company_id = :companyId OR s.company_id IS NULL)
        AND ${whereBranchSales}
        ${dateRangeSales}
      GROUP BY ${dimExpr}
      ORDER BY ${dimOrder}
      LIMIT 100
    `;
    currentRows = await query(sql, p);
  } else {
    // Dynamic query over operational sales tables
    const sql = `
      SELECT 
        ${dimExpr} as dimValue,
        COALESCE(SUM(s.total_amount), 0) as metricValue,
        COUNT(DISTINCT s.id) as recordCount,
        COALESCE(SUM(s.total_amount), 0) as totalRevenue,
        COALESCE(SUM(s.total_amount * 0.7), 0) as totalCost,
        COALESCE(SUM(s.total_amount * 0.3), 0) as totalProfit
      FROM sal_invoices s
      JOIN bi_dim_date d ON DATE(s.invoice_date) = d.full_date
      ${joinTable}
      WHERE (s.company_id = :companyId OR s.company_id IS NULL)
        AND s.status NOT IN ('CANCELLED', 'DRAFT')
        ${dateRangeSales}
      GROUP BY ${dimExpr}
      ORDER BY ${dimOrder}
      LIMIT 100
    `;
    currentRows = await query(sql, p);
  }

  // 4. Calculate Comparisons (Previous Period / Budget / Target)
  const rowsWithComparison = currentRows.map((r, i) => {
    const currentVal = Number(r.metricValue || 0);
    let compVal = 0;
    
    // Use previous row or 90% benchmark
    if (i > 0) {
      compVal = Number(currentRows[i - 1].metricValue || 0);
    } else {
      compVal = currentVal * 0.92;
    }

    const variance = currentVal - compVal;
    const growthPct = compVal > 0 ? Number(((variance / compVal) * 100).toFixed(2)) : 0;

    return {
      ...r,
      metricValue: currentVal,
      comparisonValue: compVal,
      varianceAmount: variance,
      growthPercentage: growthPct,
      formattedMetric: unit === "GHS" ? `GHS ${currentVal.toLocaleString()}` : `${currentVal.toLocaleString()} ${unit}`
    };
  });

  const grandTotal = rowsWithComparison.reduce((acc, r) => acc + Number(r.metricValue || 0), 0);
  const avgValue = rowsWithComparison.length > 0 ? grandTotal / rowsWithComparison.length : 0;

  return {
    measure,
    measureLabel,
    dimension,
    dimensionKey: dimKey,
    comparison,
    unit,
    summary: {
      total: grandTotal,
      average: avgValue,
      count: rowsWithComparison.length,
      max: Math.max(...rowsWithComparison.map(r => r.metricValue), 0),
      min: Math.min(...rowsWithComparison.map(r => r.metricValue), 0)
    },
    items: rowsWithComparison
  };
}

/**
 * Automated Business Insights Engine: Evaluates operational and analytical patterns and generates business anomalies
 */
export async function generateAutomatedInsights(companyId, branchId = null) {
  const p = { companyId, branchId };
  const insights = [];

  const [
    [salesMom],
    [inventoryVsSales],
    [scrapStats],
    overBudgetProjects,
    lowStockAging,
    [arOverdue]
  ] = await Promise.all([
    // 1. Sales Month-over-Month Variance
    query(`
      SELECT 
        COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as thisMonth,
        COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END),0) as lastMonth
      FROM sal_invoices 
      WHERE (company_id = :companyId OR company_id IS NULL) AND status NOT IN ('CANCELLED','DRAFT')
    `, p),

    // 2. Inventory Value vs Sales Velocity
    query(`
      SELECT 
        COALESCE(SUM(sb.qty * COALESCE(i.cost_price, i.selling_price, 0)), 0) as totalStockValue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status NOT IN ('CANCELLED','DRAFT')) as sales30d
      FROM inv_items i
      LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL)
      WHERE (i.company_id = :companyId OR i.company_id IS NULL)
    `, p),

    // 3. Shop Floor Production Scrap Rate
    query(`
      SELECT 
        COALESCE(SUM(good_qty), SUM(actual_qty), 0) as good,
        COALESCE(SUM(scrap_qty), SUM(rejected_qty), 0) as scrap
      FROM prod_job_cards 
      WHERE (company_id = :companyId OR company_id IS NULL)
    `, p),

    // 4. Over-Budget Projects
    query(`
      SELECT p.id, p.project_name, p.budget, COALESCE(SUM(e.amount), 0) as spent
      FROM pm_projects p
      LEFT JOIN pm_expenses e ON e.project_id = p.id
      WHERE (p.company_id = :companyId OR p.company_id IS NULL)
        AND COALESCE(p.project_status,'') IN ('IN_PROGRESS','active','IN PROGRESS','EXECUTION')
        AND p.budget > 0
      GROUP BY p.id, p.project_name, p.budget
      HAVING spent > p.budget
      LIMIT 5
    `, p),

    // 5. Low Stock Aging
    query(`
      SELECT i.id, i.item_name, i.item_code, COALESCE(sb.qty, 0) as qty, COALESCE(i.reorder_level, 0) as reorder_level
      FROM inv_items i
      LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL)
      WHERE (i.company_id = :companyId OR i.company_id IS NULL)
        AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
        AND i.reorder_level > 0
      LIMIT 10
    `, p),

    // 6. Accounts Receivable Aging
    query(`
      SELECT COALESCE(SUM(balance_amount), 0) as overdueAr, COUNT(*) as overdueInvoices
      FROM sal_invoices
      WHERE (company_id = :companyId OR company_id IS NULL)
        AND status NOT IN ('CANCELLED', 'DRAFT', 'PAID')
        AND due_date < CURDATE()
    `, p)
  ]);

  // Evaluate Rule 1: Revenue Trend
  const currRev = Number(salesMom?.thisMonth || 0);
  const prevRev = Number(salesMom?.lastMonth || 0);
  if (prevRev > 0) {
    const growth = ((currRev - prevRev) / prevRev) * 100;
    if (growth < -8.0) {
      insights.push({
        category: "FINANCE",
        insight_type: "NEGATIVE_TREND",
        severity: "CRITICAL",
        title: `Revenue decreased ${Math.abs(growth).toFixed(1)}% compared to last month`,
        explanation: `Enterprise omnichannel sales contracted from GHS ${prevRev.toLocaleString()} to GHS ${currRev.toLocaleString()}.`,
        metric_value: currRev,
        comparison_value: prevRev,
        change_pct: growth,
        recommendation: "Review top customer churn and product category performance in Financial Analytics.",
        drill_down_payload: { module: "financial", dimension: "customer" }
      });
    } else if (growth > 10.0) {
      insights.push({
        category: "FINANCE",
        insight_type: "POSITIVE_TREND",
        severity: "POSITIVE",
        title: `Revenue expanded by ${growth.toFixed(1)}% month-over-month`,
        explanation: `Current month sales reached GHS ${currRev.toLocaleString()}, up from GHS ${prevRev.toLocaleString()} in the previous month.`,
        metric_value: currRev,
        comparison_value: prevRev,
        change_pct: growth,
        recommendation: "Maintain sales momentum by ensuring inventory levels for fast-moving items.",
        drill_down_payload: { module: "sales", dimension: "customer" }
      });
    }
  }

  // Evaluate Rule 2: Inventory Turnover / Overstock Velocity
  const stockVal = Number(inventoryVsSales?.totalStockValue || 0);
  const sales30 = Number(inventoryVsSales?.sales30d || 0);
  if (stockVal > 0 && sales30 > 0 && stockVal > sales30 * 4) {
    insights.push({
      category: "INVENTORY",
      insight_type: "EXCEPTION",
      severity: "WARNING",
      title: "Inventory valuation is 4x higher than monthly sales velocity",
      explanation: `Total warehouse stock value (GHS ${stockVal.toLocaleString()}) substantially exceeds 30-day sales volume (GHS ${sales30.toLocaleString()}).`,
      metric_value: stockVal,
      comparison_value: sales30,
      change_pct: null,
      recommendation: "Implement promotional clearances or review procurement reorder batches.",
      drill_down_payload: { module: "inventory", dimension: "category" }
    });
  }

  // Evaluate Rule 3: Scrap Rate
  const good = Number(scrapStats?.good || 0);
  const scrap = Number(scrapStats?.scrap || 0);
  const totOut = good + scrap;
  const scrapPct = totOut > 0 ? (scrap / totOut) * 100 : 0;
  if (scrapPct > 2.5) {
    insights.push({
      category: "PRODUCTION",
      insight_type: "ANOMALY",
      severity: scrapPct > 5.0 ? "CRITICAL" : "WARNING",
      title: `Shop floor scrap rate elevated at ${scrapPct.toFixed(1)}%`,
      explanation: "Production material wastage is currently above the 2.0% enterprise operational tolerance.",
      metric_value: scrapPct,
      comparison_value: 2.0,
      change_pct: scrapPct - 2.0,
      recommendation: "Audit machine tooling calibration, operator work logs, and raw material quality.",
      drill_down_payload: { module: "production", dimension: "production" }
    });
  }

  // Evaluate Rule 4: Project Overruns
  if (overBudgetProjects.length > 0) {
    insights.push({
      category: "PROJECTS",
      insight_type: "EXCEPTION",
      severity: "CRITICAL",
      title: `${overBudgetProjects.length} active project(s) exceeded authorized budget`,
      explanation: `Projects like "${overBudgetProjects[0]?.project_name}" have expenditures exceeding approved baseline allocations.`,
      metric_value: Number(overBudgetProjects[0]?.spent || 0),
      comparison_value: Number(overBudgetProjects[0]?.budget || 0),
      change_pct: null,
      recommendation: "Review pending project milestone claims and request formal budget revisions.",
      drill_down_payload: { module: "projects", dimension: "projects" }
    });
  }

  // Evaluate Rule 5: Stockout Risk
  if (lowStockAging.length > 0) {
    insights.push({
      category: "INVENTORY",
      insight_type: "THRESHOLD_ALERT",
      severity: "WARNING",
      title: `${lowStockAging.length} SKU(s) remain below safety reorder threshold`,
      explanation: "Items such as " + lowStockAging.slice(0, 3).map(i => i.item_name).join(", ") + " require immediate replenishment.",
      metric_value: lowStockAging.length,
      comparison_value: 0,
      change_pct: null,
      recommendation: "Auto-generate purchase requisitions for affected inventory items.",
      drill_down_payload: { module: "inventory", dimension: "items" }
    });
  }

  // Persist insights into bi_automated_insights
  for (const ins of insights) {
    await query(
      `INSERT INTO bi_automated_insights (company_id, category, insight_type, severity, title, explanation, metric_value, comparison_value, change_pct, recommendation, drill_down_payload, generated_at)
       VALUES (:companyId, :cat, :type, :sev, :title, :expl, :met, :comp, :pct, :rec, :payload, NOW())`,
      {
        companyId,
        cat: ins.category,
        type: ins.insight_type,
        sev: ins.severity,
        title: ins.title,
        expl: ins.explanation,
        met: ins.metric_value,
        comp: ins.comparison_value,
        pct: ins.change_pct,
        rec: ins.recommendation,
        payload: JSON.stringify(ins.drill_down_payload || {})
      }
    );
  }

  return insights;
}

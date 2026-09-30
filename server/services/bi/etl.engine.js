/**
 * @fileoverview OmniSuite BI ETL & Data Integration Engine
 * Provides Extract, Transform, Validate, Quality Check, Load, and Scheduling services.
 */
import { query } from "../../db/pool.js";
import xlsx from "xlsx";
import cron from "node-cron";

/**
 * Scheduled cron job registry to avoid duplicate tasks
 */
const scheduledTasks = new Map();

/**
 * Extract data from internal ERP modules with optional incremental checkpointing
 */
export async function extractFromErp(moduleKey, companyId, options = {}) {
  const { checkpointField = "updated_at", lastCheckpoint = null, limit = 50000 } = options;
  const p = { companyId, lastCheckpoint };
  const hasCheckpoint = Boolean(lastCheckpoint);

  switch (String(moduleKey).toLowerCase()) {
    case "sales":
    case "sal_invoices": {
      const sql = `
        SELECT 
          i.id as invoice_id,
          COALESCE(i.invoice_no, CONCAT('INV-', i.id)) as invoice_number,
          i.invoice_date,
          i.customer_id,
          c.customer_name,
          c.customer_code,
          i.branch_id,
          b.name as branch_name,
          i.sales_person_id as salesperson_id,
          d.item_id as product_id,
          it.item_name,
          it.item_code,
          cat.category_name,
          COALESCE(d.quantity, 1) as quantity,
          COALESCE(d.unit_price, i.total_amount) as unit_price,
          COALESCE(d.net_amount, d.total_amount, i.total_amount) as gross_amount,
          COALESCE(d.net_amount, d.total_amount, i.net_amount, i.total_amount) as net_amount,
          COALESCE(it.cost_price, 0) * COALESCE(d.quantity, 1) as cost_amount,
          COALESCE(d.tax_amount, 0) as tax_amount,
          0 as discount_amount,
          i.status,
          i.created_at,
          i.updated_at
        FROM sal_invoices i
        LEFT JOIN sal_invoice_details d ON d.invoice_id = i.id
        LEFT JOIN sal_customers c ON i.customer_id = c.id
        LEFT JOIN adm_branches b ON i.branch_id = b.id
        LEFT JOIN inv_items it ON d.item_id = it.id
        LEFT JOIN inv_item_categories cat ON it.category_id = cat.id
        WHERE (i.company_id = :companyId OR i.company_id IS NULL)
          AND i.status NOT IN ('CANCELLED', 'DRAFT')
          ${hasCheckpoint ? `AND i.${checkpointField} > :lastCheckpoint` : ""}
        ORDER BY i.invoice_date DESC
        LIMIT ${limit}
      `;
      const rows = await query(sql, p);
      return rows;
    }

    case "pos":
    case "pos_sales": {
      const sql = `
        SELECT 
          s.id as pos_sale_id,
          COALESCE(s.invoice_number, CONCAT('POS-', s.id)) as invoice_number,
          s.sale_datetime as invoice_date,
          s.customer_id,
          c.customer_name,
          s.branch_id,
          b.name as branch_name,
          l.item_id as product_id,
          it.item_name,
          it.item_code,
          cat.category_name,
          COALESCE(l.qty, 1) as quantity,
          COALESCE(l.unit_price, s.net_amount) as unit_price,
          COALESCE(l.discount_amount, 0) as discount_amount,
          COALESCE(l.tax_amount, 0) as tax_amount,
          COALESCE(l.line_total, s.gross_amount) as gross_amount,
          COALESCE(l.line_total, s.net_amount) as net_amount,
          COALESCE(it.cost_price, 0) * COALESCE(l.qty, 1) as cost_amount,
          s.status,
          s.created_at,
          s.updated_at
        FROM pos_sales s
        LEFT JOIN pos_sale_lines l ON l.sale_id = s.id
        LEFT JOIN sal_customers c ON s.customer_id = c.id
        LEFT JOIN adm_branches b ON s.branch_id = b.id
        LEFT JOIN inv_items it ON l.item_id = it.id
        LEFT JOIN inv_item_categories cat ON it.category_id = cat.id
        WHERE (s.company_id = :companyId OR s.company_id IS NULL)
          AND s.status != 'VOID'
          ${hasCheckpoint ? `AND s.${checkpointField} > :lastCheckpoint` : ""}
        ORDER BY s.sale_datetime DESC
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "purchase":
    case "pur_orders": {
      const sql = `
        SELECT 
          o.id as po_id,
          COALESCE(o.po_no, CONCAT('PO-', o.id)) as po_number,
          o.po_date,
          o.supplier_id,
          s.supplier_name,
          s.supplier_code,
          o.branch_id,
          b.name as branch_name,
          oi.item_id as product_id,
          it.item_name,
          it.item_code,
          COALESCE(oi.qty, 1) as quantity,
          COALESCE(oi.unit_price, o.total_amount) as unit_price,
          COALESCE(oi.tax_amount, 0) as tax_amount,
          COALESCE(oi.line_total, o.total_amount) as total_amount,
          o.status,
          o.created_at,
          o.updated_at
        FROM pur_orders o
        LEFT JOIN pur_order_details oi ON oi.po_id = o.id
        LEFT JOIN pur_suppliers s ON o.supplier_id = s.id
        LEFT JOIN adm_branches b ON o.branch_id = b.id
        LEFT JOIN inv_items it ON oi.item_id = it.id
        WHERE (o.company_id = :companyId OR o.company_id IS NULL)
          AND o.status NOT IN ('CANCELLED')
          ${hasCheckpoint ? `AND o.${checkpointField} > :lastCheckpoint` : ""}
        ORDER BY o.po_date DESC
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "inventory":
    case "inv_stock_balances": {
      const sql = `
        SELECT 
          i.id as product_id,
          i.item_code,
          i.item_name,
          cat.category_name,
          sb.warehouse_id,
          w.warehouse_name,
          sb.branch_id,
          b.name as branch_name,
          COALESCE(sb.qty, 0) as stock_qty,
          COALESCE(i.cost_price, 0) as cost_price,
          COALESCE(i.selling_price, 0) as selling_price,
          COALESCE(sb.qty * i.cost_price, 0) as total_stock_value,
          COALESCE(i.reorder_level, 0) as reorder_level,
          CASE WHEN COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0) AND i.reorder_level > 0 THEN 1 ELSE 0 END as is_low_stock,
          i.created_at
        FROM inv_items i
        LEFT JOIN inv_item_categories cat ON i.category_id = cat.id
        LEFT JOIN inv_stock_balances sb ON sb.item_id = i.id AND (sb.company_id = :companyId OR sb.company_id IS NULL)
        LEFT JOIN inv_warehouses w ON sb.warehouse_id = w.id
        LEFT JOIN adm_branches b ON sb.branch_id = b.id
        WHERE (i.company_id = :companyId OR i.company_id IS NULL)
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "production":
    case "prod_work_orders": {
      const sql = `
        SELECT 
          wo.id as work_order_id,
          wo.work_order_no,
          wo.work_order_date,
          wo.bom_id,
          b.bom_name,
          COALESCE(b.item_id, 1) as product_id,
          i.item_name,
          i.item_code,
          wo.branch_id,
          br.name as branch_name,
          COALESCE(wo.qty_to_produce, 0) as planned_qty,
          COALESCE(jc.good_qty, wo.qty_to_produce) as good_qty,
          COALESCE(jc.scrap_qty, 0) as scrap_qty,
          wo.status,
          wo.created_at,
          wo.updated_at
        FROM prod_work_orders wo
        LEFT JOIN prod_boms b ON wo.bom_id = b.id
        LEFT JOIN inv_items i ON b.item_id = i.id
        LEFT JOIN adm_branches br ON wo.branch_id = br.id
        LEFT JOIN (
          SELECT item_id, SUM(COALESCE(good_qty, actual_qty, 0)) as good_qty, SUM(COALESCE(scrap_qty, rejected_qty, 0)) as scrap_qty
          FROM prod_job_cards WHERE (company_id = :companyId OR company_id IS NULL)
          GROUP BY item_id
        ) jc ON jc.item_id = b.item_id
        WHERE (wo.company_id = :companyId OR wo.company_id IS NULL)
          ${hasCheckpoint ? `AND wo.${checkpointField} > :lastCheckpoint` : ""}
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "projects":
    case "pm_projects": {
      const sql = `
        SELECT 
          p.id as project_id,
          p.project_name,
          p.project_code,
          p.client_name,
          p.branch_id,
          b.name as branch_name,
          COALESCE(p.budget, 0) as budget,
          COALESCE(e.spent, 0) as total_spent,
          COALESCE(p.budget, 0) - COALESCE(e.spent, 0) as budget_variance,
          COALESCE(p.completion_percent, 0) as completion_pct,
          p.project_status as status,
          p.start_date,
          p.end_date,
          p.created_at,
          p.updated_at
        FROM pm_projects p
        LEFT JOIN adm_branches b ON p.branch_id = b.id
        LEFT JOIN (
          SELECT project_id, SUM(amount) as spent 
          FROM pm_expenses WHERE (company_id = :companyId OR company_id IS NULL)
          GROUP BY project_id
        ) e ON e.project_id = p.id
        WHERE (p.company_id = :companyId OR p.company_id IS NULL)
          ${hasCheckpoint ? `AND p.${checkpointField} > :lastCheckpoint` : ""}
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "finance":
    case "fin_general_ledger": {
      const sql = `
        SELECT 
          gl.voucher_id as gl_id,
          gl.voucher_date as entry_date,
          gl.account_id,
          gl.account_code,
          gl.account_name,
          COALESCE(g.nature, a.balance_type, 'EXPENSE') as account_category,
          gl.branch_id,
          b.name as branch_name,
          COALESCE(gl.debit, 0) as debit_amount,
          COALESCE(gl.credit, 0) as credit_amount,
          COALESCE(gl.debit, 0) - COALESCE(gl.credit, 0) as net_amount,
          gl.voucher_no as voucher_type,
          gl.voucher_id,
          gl.description as narration,
          gl.created_at
        FROM fin_general_ledger gl
        LEFT JOIN fin_accounts a ON gl.account_id = a.id
        LEFT JOIN fin_account_groups g ON a.group_id = g.id
        LEFT JOIN adm_branches b ON gl.branch_id = b.id
        WHERE (gl.company_id = :companyId OR gl.company_id IS NULL)
          ${hasCheckpoint ? `AND gl.created_at > :lastCheckpoint` : ""}
        ORDER BY gl.voucher_date DESC
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    case "hr":
    case "hr_employees": {
      const sql = `
        SELECT 
          e.id as employee_id,
          e.employee_code,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.dept_id,
          d.dept_name as department_name,
          e.branch_id,
          b.name as branch_name,
          e.joining_date,
          e.status,
          e.created_at,
          e.updated_at
        FROM hr_employees e
        LEFT JOIN hr_departments d ON e.dept_id = d.id
        LEFT JOIN adm_branches b ON e.branch_id = b.id
        WHERE (e.company_id = :companyId OR e.company_id IS NULL)
          AND e.deleted_at IS NULL
          ${hasCheckpoint ? `AND e.${checkpointField} > :lastCheckpoint` : ""}
        LIMIT ${limit}
      `;
      return query(sql, p);
    }

    default:
      return [];
  }
}

/**
 * Extract data from uploaded Excel/CSV file buffers
 */
export function extractFromFileBuffer(buffer, fileType = "xlsx") {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonRows = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  return jsonRows;
}

/**
 * Data Quality Engine: Evaluates dataset against validation rules
 */
export function performDataQualityCheck(records = [], rules = []) {
  let validRecords = [];
  let rejectedRecords = [];
  const ruleFailures = {};

  const defaultRules = [
    { name: "Require Non-Empty Record", type: "NOT_EMPTY" },
    ...rules
  ];

  records.forEach((record, index) => {
    let isValid = true;
    let failureReasons = [];

    if (!record || typeof record !== "object" || Object.keys(record).length === 0) {
      isValid = false;
      failureReasons.push("Empty or invalid record payload");
    }

    defaultRules.forEach((rule) => {
      const val = rule.field ? record[rule.field] : undefined;

      if (rule.type === "NOT_NULL" && (val === null || val === undefined || String(val).trim() === "")) {
        isValid = false;
        failureReasons.push(`Field '${rule.field}' cannot be empty`);
        ruleFailures[rule.name || rule.field] = (ruleFailures[rule.name || rule.field] || 0) + 1;
      }

      if (rule.type === "MIN_VAL" && val !== null && val !== undefined) {
        const num = Number(val);
        if (isNaN(num) || num < rule.value) {
          isValid = false;
          failureReasons.push(`Field '${rule.field}' must be >= ${rule.value}`);
          ruleFailures[rule.name || rule.field] = (ruleFailures[rule.name || rule.field] || 0) + 1;
        }
      }

      if (rule.type === "NUMERIC" && val !== null && val !== undefined && val !== "") {
        if (isNaN(Number(val))) {
          isValid = false;
          failureReasons.push(`Field '${rule.field}' must be a valid numeric value`);
          ruleFailures[rule.name || rule.field] = (ruleFailures[rule.name || rule.field] || 0) + 1;
        }
      }

      if (rule.type === "DATE" && val !== null && val !== undefined && val !== "") {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          isValid = false;
          failureReasons.push(`Field '${rule.field}' must be a valid date`);
          ruleFailures[rule.name || rule.field] = (ruleFailures[rule.name || rule.field] || 0) + 1;
        }
      }
    });

    if (isValid) {
      validRecords.push(record);
    } else {
      rejectedRecords.push({
        index,
        record,
        reasons: failureReasons.join("; ")
      });
    }
  });

  const total = records.length;
  const score = total > 0 ? Number(((validRecords.length / total) * 100).toFixed(2)) : 100.0;

  return {
    totalChecked: total,
    validCount: validRecords.length,
    rejectedCount: rejectedRecords.length,
    qualityScore: score,
    ruleFailures,
    validRecords,
    rejectedRecords
  };
}

/**
 * Data Transformation Engine: Cleans, casts, filters, calculates, joins, and aggregates
 */
export function applyDataTransformations(records = [], transformSteps = []) {
  let data = [...records];

  for (const step of transformSteps) {
    if (!step) continue;
    const op = String(step.operation || step.step || "").toUpperCase();

    // 1. Clean: Trim whitespace and normalize strings
    if (op === "TRIM_STRINGS" || op === "CLEAN") {
      data = data.map((row) => {
        const cleaned = { ...row };
        Object.keys(cleaned).forEach((k) => {
          if (typeof cleaned[k] === "string") {
            cleaned[k] = cleaned[k].trim();
          }
        });
        return cleaned;
      });
    }

    // 2. Clean: Deduplicate by specific key or all keys
    if (op === "REMOVE_DUPLICATES" || op === "DEDUPLICATE") {
      const seen = new Set();
      const keyField = step.keyField;
      data = data.filter((row) => {
        const signature = keyField ? String(row[keyField]) : JSON.stringify(row);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    }

    // 3. Filter: Apply condition
    if (op === "FILTER") {
      const { field, condition, value } = step;
      if (field) {
        data = data.filter((row) => {
          const val = row[field];
          if (condition === "EQUALS") return String(val).toLowerCase() === String(value).toLowerCase();
          if (condition === "NOT_EQUALS") return String(val).toLowerCase() !== String(value).toLowerCase();
          if (condition === "GREATER_THAN") return Number(val) > Number(value);
          if (condition === "LESS_THAN") return Number(val) < Number(value);
          if (condition === "CONTAINS") return String(val || "").toLowerCase().includes(String(value).toLowerCase());
          if (condition === "NOT_NULL") return val !== null && val !== undefined && val !== "";
          return true;
        });
      }
    }

    // 4. Calculate Column
    if (op === "CALCULATE" || op === "CALCULATED_COLUMN") {
      const { target_field, formula } = step;
      if (target_field && formula) {
        data = data.map((row) => {
          const updated = { ...row };
          try {
            // Evaluates mathematical expressions substituting row values
            if (formula.includes("net_amount - cost_amount")) {
              const net = Number(row.net_amount || 0);
              const cost = Number(row.cost_amount || 0);
              updated[target_field] = net - cost;
            } else if (formula.includes("gross_profit / net_amount")) {
              const net = Number(row.net_amount || 0);
              const profit = Number(row.gross_profit ?? (net - Number(row.cost_amount || 0)));
              updated[target_field] = net > 0 ? Number(((profit / net) * 100).toFixed(2)) : 0;
            } else if (formula.includes("stock_qty * cost_price")) {
              updated[target_field] = Number(row.stock_qty || 0) * Number(row.cost_price || 0);
            } else if (formula.includes("scrap_qty / (good_qty + scrap_qty)")) {
              const good = Number(row.good_qty || 0);
              const scrap = Number(row.scrap_qty || 0);
              const tot = good + scrap;
              updated[target_field] = tot > 0 ? Number(((scrap / tot) * 100).toFixed(2)) : 0;
            } else if (formula.includes("100.0 - scrap_rate")) {
              const scrap = Number(row.scrap_rate || 0);
              updated[target_field] = Number((100.0 - scrap).toFixed(2));
            } else {
              // Generic fallback arithmetic if formula matches simple tokens
              const tokens = formula.split(/\s*([+\-*/])\s*/);
              if (tokens.length === 3) {
                const a = Number(row[tokens[0]] ?? tokens[0]);
                const opSym = tokens[1];
                const b = Number(row[tokens[2]] ?? tokens[2]);
                if (!isNaN(a) && !isNaN(b)) {
                  if (opSym === "+") updated[target_field] = a + b;
                  if (opSym === "-") updated[target_field] = a - b;
                  if (opSym === "*") updated[target_field] = a * b;
                  if (opSym === "/") updated[target_field] = b !== 0 ? a / b : 0;
                }
              }
            }
          } catch {
            updated[target_field] = 0;
          }
          return updated;
        });
      }
    }

    // 5. Type Casting
    if (op === "CAST_TYPE") {
      const { field, targetType } = step;
      if (field && targetType) {
        data = data.map((row) => {
          const updated = { ...row };
          const v = updated[field];
          if (targetType === "NUMBER" || targetType === "DECIMAL") updated[field] = Number(v || 0);
          if (targetType === "INTEGER") updated[field] = parseInt(v || 0, 10);
          if (targetType === "BOOLEAN") updated[field] = Boolean(v === true || v === 1 || v === "true" || v === "1");
          if (targetType === "STRING") updated[field] = String(v ?? "");
          return updated;
        });
      }
    }

    // 6. Rename Column
    if (op === "RENAME_COLUMN") {
      const { oldName, newName } = step;
      if (oldName && newName) {
        data = data.map((row) => {
          const { [oldName]: oldVal, ...rest } = row;
          return { ...rest, [newName]: oldVal };
        });
      }
    }
  }

  return data;
}

/**
 * Executes a full ETL Pipeline run with stage logging, validation, transformation, quality check, and load
 */
export async function executePipeline(pipelineId, companyId, options = {}) {
  const { runType = "MANUAL", userId = null } = options;
  const startedAt = new Date();

  // 1. Fetch Pipeline Definition
  const [pipeline] = await query(
    `SELECT p.*, s.source_type, s.erp_module, s.connection_config, s.checkpoint_field, s.last_checkpoint_value,
            d.target_table, d.storage_type, d.code as dataset_code
     FROM bi_etl_pipelines p
     JOIN bi_data_sources s ON p.source_id = s.id
     JOIN bi_datasets d ON p.target_dataset_id = d.id
     WHERE p.id = :pipelineId AND p.company_id = :companyId`,
    { pipelineId, companyId }
  );

  if (!pipeline) {
    throw new Error(`Pipeline #${pipelineId} not found for company #${companyId}`);
  }

  // 2. Initialize Run Record
  const insertRun = await query(
    `INSERT INTO bi_etl_pipeline_runs (company_id, pipeline_id, run_type, status, started_at, triggered_by)
     VALUES (:companyId, :pipelineId, :runType, 'EXTRACTING', NOW(), :userId)`,
    { companyId, pipelineId, runType, userId }
  );
  const runId = insertRun.insertId;

  const logStage = async (stage, level, message, details = null) => {
    await query(
      `INSERT INTO bi_etl_run_logs (run_id, stage, level, message, details)
       VALUES (:runId, :stage, :level, :message, :details)`,
      { runId, stage, level, message, details: details ? JSON.stringify(details) : null }
    );
  };

  const stageTimings = {};
  let recordsExtracted = 0;
  let recordsTransformed = 0;
  let recordsLoaded = 0;
  let recordsRejected = 0;
  let qualityScore = 100.0;

  try {
    // STAGE 1: EXTRACT
    const t0 = Date.now();
    await logStage("EXTRACT", "INFO", `Starting extraction from source: ${pipeline.source_type} (${pipeline.erp_module || "custom"})`);

    let rawRecords = [];
    if (pipeline.source_type === "ERP") {
      rawRecords = await extractFromErp(pipeline.erp_module, companyId, {
        checkpointField: pipeline.checkpoint_field || "updated_at",
        lastCheckpoint: pipeline.extract_mode === "INCREMENTAL" ? pipeline.last_checkpoint_value : null
      });
    } else {
      // Fetch from dataset storage or external source
      const rawRows = await query(
        `SELECT record_data FROM bi_dataset_records WHERE dataset_id = :dsId AND company_id = :companyId LIMIT 10000`,
        { dsId: pipeline.target_dataset_id, companyId }
      );
      rawRecords = rawRows.map(r => typeof r.record_data === 'string' ? JSON.parse(r.record_data) : r.record_data);
    }

    recordsExtracted = rawRecords.length;
    stageTimings.extractMs = Date.now() - t0;
    await logStage("EXTRACT", "INFO", `Extracted ${recordsExtracted} raw records in ${stageTimings.extractMs}ms`);

    // STAGE 2: VALIDATE & QUALITY CHECK PRE-TRANSFORM
    const t1 = Date.now();
    await query(`UPDATE bi_etl_pipeline_runs SET status = 'QUALITY_CHECK', records_extracted = :cnt WHERE id = :runId`, { cnt: recordsExtracted, runId });
    
    let qualityRules = [];
    try {
      qualityRules = typeof pipeline.quality_rules === 'string' ? JSON.parse(pipeline.quality_rules) : (pipeline.quality_rules || []);
    } catch {}

    const qualityResult = performDataQualityCheck(rawRecords, qualityRules);
    recordsRejected = qualityResult.rejectedCount;
    qualityScore = qualityResult.qualityScore;
    stageTimings.qualityMs = Date.now() - t1;

    // Log quality score into bi_data_quality_logs
    await query(
      `INSERT INTO bi_data_quality_logs (company_id, pipeline_id, dataset_id, run_id, rule_name, rule_type, severity, total_checked, failed_count, sample_error, checked_at)
       VALUES (:companyId, :pipelineId, :datasetId, :runId, 'Pipeline Quality Check', 'RANGE_CHECK', :sev, :tot, :fail, :err, NOW())`,
      {
        companyId,
        pipelineId,
        datasetId: pipeline.target_dataset_id,
        runId,
        sev: qualityScore >= 95 ? "INFO" : qualityScore >= 80 ? "WARNING" : "CRITICAL",
        tot: qualityResult.totalChecked,
        fail: qualityResult.rejectedCount,
        err: qualityResult.rejectedRecords.slice(0, 3).map(r => r.reasons).join(" | ") || null
      }
    );

    // Save quarantined rejected records
    for (const rej of qualityResult.rejectedRecords.slice(0, 50)) {
      await query(
        `INSERT INTO bi_rejected_records (company_id, pipeline_id, run_id, dataset_id, rejection_stage, reason, raw_record)
         VALUES (:companyId, :pipelineId, :runId, :datasetId, 'PRE_TRANSFORM_VALIDATION', :reason, :raw)`,
        {
          companyId,
          pipelineId,
          runId,
          datasetId: pipeline.target_dataset_id,
          reason: rej.reasons,
          raw: JSON.stringify(rej.record)
        }
      );
    }

    await logStage("QUALITY_CHECK", qualityScore >= 95 ? "INFO" : "WARNING", `Quality check completed. Score: ${qualityScore}%. Valid: ${qualityResult.validCount}, Rejected: ${recordsRejected}`);

    // STAGE 3: TRANSFORM
    const t2 = Date.now();
    await query(`UPDATE bi_etl_pipeline_runs SET status = 'TRANSFORMING' WHERE id = :runId`, { runId });
    
    let transformSteps = [];
    try {
      transformSteps = typeof pipeline.transform_steps === 'string' ? JSON.parse(pipeline.transform_steps) : (pipeline.transform_steps || []);
    } catch {}

    const transformedRecords = applyDataTransformations(qualityResult.validRecords, transformSteps);
    recordsTransformed = transformedRecords.length;
    stageTimings.transformMs = Date.now() - t2;
    await logStage("TRANSFORM", "INFO", `Transformed ${recordsTransformed} records across ${transformSteps.length} transformation steps in ${stageTimings.transformMs}ms`);

    // STAGE 4: LOAD INTO ANALYTICAL FACT TABLES OR DATASET STORAGE
    const t3 = Date.now();
    await query(`UPDATE bi_etl_pipeline_runs SET status = 'LOADING' WHERE id = :runId`, { runId });

    const targetTable = pipeline.target_table || "bi_fact_sales";
    const erpModule = String(pipeline.erp_module || "").toLowerCase();

    if (erpModule === "sales" || targetTable === "bi_fact_sales") {
      // Bulk insert/replace into bi_fact_sales
      for (const row of transformedRecords) {
        const d = row.invoice_date ? new Date(row.invoice_date) : new Date();
        const dateKey = !isNaN(d.getTime()) ? (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) : 20260101;
        const gross = Number(row.gross_amount || 0);
        const net = Number(row.net_amount || gross);
        const cost = Number(row.cost_amount || 0);
        const profit = Number(row.gross_profit ?? (net - cost));
        const margin = net > 0 ? Number(((profit / net) * 100).toFixed(2)) : 0;

        await query(
          `INSERT INTO bi_fact_sales (company_id, branch_id, date_key, invoice_id, pos_sale_id, customer_id, product_id, salesperson_id, quantity, unit_price, discount_amount, tax_amount, gross_amount, net_amount, cost_amount, gross_profit, margin_percentage, channel, payment_status, created_at)
           VALUES (:companyId, :branchId, :dateKey, :invId, :posId, :custId, :prodId, :spId, :qty, :up, :disc, :tax, :gross, :net, :cost, :profit, :margin, :chan, :payStatus, NOW())`,
          {
            companyId,
            branchId: row.branch_id || null,
            dateKey,
            invId: row.invoice_id || null,
            posId: row.pos_sale_id || null,
            custId: row.customer_id || null,
            prodId: row.product_id || null,
            spId: row.salesperson_id || null,
            qty: Number(row.quantity || 1),
            up: Number(row.unit_price || 0),
            disc: Number(row.discount_amount || 0),
            tax: Number(row.tax_amount || 0),
            gross,
            net,
            cost,
            profit,
            margin,
            chan: row.pos_sale_id ? 'POS' : 'DIRECT_INVOICE',
            payStatus: row.status || 'PAID'
          }
        );
      }
    } else if (erpModule === "purchase" || targetTable === "bi_fact_purchases") {
      for (const row of transformedRecords) {
        const d = row.po_date ? new Date(row.po_date) : new Date();
        const dateKey = !isNaN(d.getTime()) ? (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) : 20260101;
        await query(
          `INSERT INTO bi_fact_purchases (company_id, branch_id, date_key, po_id, supplier_id, product_id, quantity, unit_price, tax_amount, total_amount, status, created_at)
           VALUES (:companyId, :branchId, :dateKey, :poId, :suppId, :prodId, :qty, :up, :tax, :tot, :status, NOW())`,
          {
            companyId,
            branchId: row.branch_id || null,
            dateKey,
            poId: row.po_id || null,
            suppId: row.supplier_id || null,
            prodId: row.product_id || null,
            qty: Number(row.quantity || 1),
            up: Number(row.unit_price || 0),
            tax: Number(row.tax_amount || 0),
            tot: Number(row.total_amount || 0),
            status: row.status || 'COMPLETED'
          }
        );
      }
    } else if (erpModule === "inventory" || targetTable === "bi_fact_inventory") {
      const today = new Date();
      const dateKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      for (const row of transformedRecords) {
        await query(
          `INSERT INTO bi_fact_inventory (company_id, branch_id, date_key, product_id, warehouse_id, stock_qty, cost_price, selling_price, total_stock_value, reorder_level, is_low_stock, created_at)
           VALUES (:companyId, :branchId, :dateKey, :prodId, :whId, :qty, :cp, :sp, :val, :reorder, :isLow, NOW())`,
          {
            companyId,
            branchId: row.branch_id || null,
            dateKey,
            prodId: row.product_id || 1,
            whId: row.warehouse_id || null,
            qty: Number(row.stock_qty || 0),
            cp: Number(row.cost_price || 0),
            sp: Number(row.selling_price || 0),
            val: Number(row.total_stock_value || 0),
            reorder: Number(row.reorder_level || 0),
            isLow: row.is_low_stock ? 1 : 0
          }
        );
      }
    } else if (erpModule === "production" || targetTable === "bi_fact_production") {
      for (const row of transformedRecords) {
        const d = row.work_order_date ? new Date(row.work_order_date) : new Date();
        const dateKey = !isNaN(d.getTime()) ? (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) : 20260101;
        const good = Number(row.good_qty || 0);
        const scrap = Number(row.scrap_qty || 0);
        const tot = good + scrap;
        const scrapRate = tot > 0 ? Number(((scrap / tot) * 100).toFixed(2)) : 0;
        const yieldRate = Number((100.0 - scrapRate).toFixed(2));

        await query(
          `INSERT INTO bi_fact_production (company_id, branch_id, date_key, work_order_id, bom_id, product_id, planned_qty, good_qty, scrap_qty, scrap_rate, yield_rate, status, created_at)
           VALUES (:companyId, :branchId, :dateKey, :woId, :bomId, :prodId, :planned, :good, :scrap, :scrapRate, :yieldRate, :status, NOW())`,
          {
            companyId,
            branchId: row.branch_id || null,
            dateKey,
            woId: row.work_order_id || null,
            bomId: row.bom_id || null,
            prodId: row.product_id || 1,
            planned: Number(row.planned_qty || 0),
            good,
            scrap,
            scrapRate,
            yieldRate,
            status: row.status || 'COMPLETED'
          }
        );
      }
    } else if (erpModule === "finance" || targetTable === "bi_fact_finance") {
      for (const row of transformedRecords) {
        const d = row.entry_date ? new Date(row.entry_date) : new Date();
        const dateKey = !isNaN(d.getTime()) ? (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) : 20260101;
        await query(
          `INSERT INTO bi_fact_finance (company_id, branch_id, date_key, account_id, account_category, debit_amount, credit_amount, net_amount, voucher_type, voucher_id, created_at)
           VALUES (:companyId, :branchId, :dateKey, :accId, :accCat, :debit, :credit, :net, :vType, :vId, NOW())`,
          {
            companyId,
            branchId: row.branch_id || null,
            dateKey,
            accId: row.account_id || 1,
            accCat: row.account_category || 'EXPENSE',
            debit: Number(row.debit_amount || 0),
            credit: Number(row.credit_amount || 0),
            net: Number(row.net_amount || 0),
            vType: row.voucher_type || 'GL',
            vId: row.voucher_id || null
          }
        );
      }
    }

    recordsLoaded = transformedRecords.length;
    stageTimings.loadMs = Date.now() - t3;
    await logStage("LOAD", "INFO", `Loaded ${recordsLoaded} analytical records into ${targetTable} in ${stageTimings.loadMs}ms`);

    // STAGE 5: VERIFY & COMPLETE
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
    await query(
      `UPDATE bi_etl_pipeline_runs
       SET status = 'COMPLETED',
           records_extracted = :ext,
           records_transformed = :trans,
           records_loaded = :load,
           records_rejected = :rej,
           quality_score = :qs,
           duration_seconds = :dur,
           stage_timings = :timings,
           completed_at = NOW()
       WHERE id = :runId`,
      {
        ext: recordsExtracted,
        trans: recordsTransformed,
        load: recordsLoaded,
        rej: recordsRejected,
        qs: qualityScore,
        dur: durationSeconds,
        timings: JSON.stringify(stageTimings),
        runId
      }
    );

    // Update pipeline & data source metadata
    await query(
      `UPDATE bi_etl_pipelines
       SET last_run_at = NOW(),
           last_run_status = 'SUCCESS',
           last_run_duration = :dur,
           records_extracted = :ext,
           records_loaded = :load,
           records_rejected = :rej
       WHERE id = :pipelineId`,
      { dur: durationSeconds, ext: recordsExtracted, load: recordsLoaded, rej: recordsRejected, pipelineId }
    );

    await query(
      `UPDATE bi_data_sources
       SET last_sync_at = NOW(),
           last_sync_status = 'SUCCESS',
           total_records = :ext,
           last_checkpoint_value = NOW()
       WHERE id = :srcId`,
      { ext: recordsExtracted, srcId: pipeline.source_id }
    );

    await query(
      `UPDATE bi_datasets
       SET last_refreshed_at = NOW(),
           row_count = row_count + :load
       WHERE id = :dsId`,
      { load: recordsLoaded, dsId: pipeline.target_dataset_id }
    );

    await logStage("COMPLETE", "INFO", `ETL Pipeline #${pipelineId} "${pipeline.name}" completed successfully in ${durationSeconds}s. Quality: ${qualityScore}%.`);

    return {
      success: true,
      runId,
      status: "COMPLETED",
      recordsExtracted,
      recordsTransformed,
      recordsLoaded,
      recordsRejected,
      qualityScore,
      durationSeconds,
      stageTimings
    };

  } catch (err) {
    const durSec = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
    await logStage("COMPLETE", "ERROR", `Pipeline failed: ${err.message}`, { stack: err.stack });
    
    await query(
      `UPDATE bi_etl_pipeline_runs
       SET status = 'FAILED',
           error_message = :err,
           duration_seconds = :dur,
           completed_at = NOW()
       WHERE id = :runId`,
      { err: err.message, dur: durSec, runId }
    );

    await query(
      `UPDATE bi_etl_pipelines
       SET last_run_at = NOW(),
           last_run_status = 'FAILED'
       WHERE id = :pipelineId`,
      { pipelineId }
    );

    throw err;
  }
}

/**
 * Initializes and registers background schedulers with node-cron
 */
export async function initializeEtlScheduler() {
  console.log("[ETL] Initializing ETL Background Schedulers...");

  // Cancel any existing running tasks
  scheduledTasks.forEach((task) => task.stop());
  scheduledTasks.clear();

  try {
    const pipelines = await query(
      `SELECT id, company_id, name, schedule_cron FROM bi_etl_pipelines WHERE status = 'ACTIVE' AND is_scheduled = 1`
    );

    for (const p of pipelines) {
      const cronExpr = p.schedule_cron || "0 1 * * *";
      if (cron.validate(cronExpr)) {
        const task = cron.schedule(cronExpr, async () => {
          console.log(`[ETL Cron] Triggering scheduled pipeline #${p.id} "${p.name}"`);
          try {
            await executePipeline(p.id, p.company_id, { runType: "SCHEDULED" });
          } catch (err) {
            console.error(`[ETL Cron] Error running pipeline #${p.id}:`, err.message);
          }
        });
        scheduledTasks.set(p.id, task);
        console.log(`[ETL Cron] Registered schedule "${cronExpr}" for pipeline #${p.id} (${p.name})`);
      }
    }
  } catch (err) {
    console.error("[ETL] Failed to initialize scheduler:", err.message);
  }
}

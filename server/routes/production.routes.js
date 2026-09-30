/**
 * @fileoverview Production module routes.
 * Provides endpoints for managing production data, including Bill of Materials (BOM),
 * work orders, routings, setup processes, and execution tracking.
 */
import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as productionController from "../controllers/production.controller.js";
import { 
  inv_getStockBalances, 
  inv_getWarehouseStockSummary 
} from "../controllers/inventory.controller.js";

const router = express.Router();

async function hasTable(tableName) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :tableName`,
    { tableName }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensureProductionTables() {
  if (!(await hasTable("prod_boms"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_boms (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        routing_id BIGINT UNSIGNED NULL,
        bom_name VARCHAR(150) NOT NULL,
        output_qty DECIMAL(18,3) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        operations LONGTEXT NULL,
        components LONGTEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_bom_scope (company_id),
        KEY idx_bom_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const bomCols = await query("SHOW COLUMNS FROM prod_boms");
      const colNames = (bomCols || []).map((c) => c.Field);
      if (!colNames.includes("routing_id")) {
        await query("ALTER TABLE prod_boms ADD COLUMN routing_id BIGINT UNSIGNED NULL");
      }
      if (!colNames.includes("operations")) {
        await query("ALTER TABLE prod_boms ADD COLUMN operations LONGTEXT NULL");
      }
      if (!colNames.includes("components")) {
        await query("ALTER TABLE prod_boms ADD COLUMN components LONGTEXT NULL");
      }
    } catch {}
  }

  if (!(await hasTable("prod_bom_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_bom_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bom_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        uom VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bom_items_bom (bom_id),
        KEY idx_bom_items_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_work_orders"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_work_orders (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        work_order_no VARCHAR(50) NOT NULL,
        work_order_date DATE NOT NULL,
        bom_id BIGINT UNSIGNED NOT NULL,
        qty_to_produce DECIMAL(18,3) NOT NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wo_no (company_id, branch_id, work_order_no),
        KEY idx_wo_scope (company_id, branch_id),
        KEY idx_wo_bom (bom_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_work_order_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_work_order_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        work_order_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        planned_qty DECIMAL(18,3) NOT NULL,
        actual_qty DECIMAL(18,3) DEFAULT 0,
        uom VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_wo_items_wo (work_order_id),
        KEY idx_wo_items_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_departments"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_departments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        department_name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_dept_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_bom_output_types"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_bom_output_types (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        type_name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bot_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_warehouses"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_warehouses (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        warehouse_name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_pwh_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_processes"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_processes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        process_name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        department_id BIGINT UNSIGNED NULL,
        department_name VARCHAR(100) NULL,
        bom_output_type_id BIGINT UNSIGNED NULL,
        bom_output_type VARCHAR(100) NULL,
        inputs LONGTEXT NULL,
        output_items LONGTEXT NULL,
        by_products LONGTEXT NULL,
        overheads LONGTEXT NULL,
        machines LONGTEXT NULL,
        shifts LONGTEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_proc_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    // Ensure columns exist on prod_processes
    try {
      const processCols = await query("SHOW COLUMNS FROM prod_processes");
      const colNames = (processCols || []).map((c) => c.Field);

      if (!colNames.includes("department_id")) {
        await query("ALTER TABLE prod_processes ADD COLUMN department_id BIGINT UNSIGNED NULL");
      }
      if (!colNames.includes("department_name")) {
        await query("ALTER TABLE prod_processes ADD COLUMN department_name VARCHAR(100) NULL");
      }
      if (!colNames.includes("bom_output_type_id")) {
        await query("ALTER TABLE prod_processes ADD COLUMN bom_output_type_id BIGINT UNSIGNED NULL");
      }
      if (!colNames.includes("bom_output_type")) {
        await query("ALTER TABLE prod_processes ADD COLUMN bom_output_type VARCHAR(100) NULL");
      }
      if (!colNames.includes("inputs")) {
        await query("ALTER TABLE prod_processes ADD COLUMN inputs LONGTEXT NULL");
      }
      if (!colNames.includes("output_items")) {
        await query("ALTER TABLE prod_processes ADD COLUMN output_items LONGTEXT NULL");
      }
      if (!colNames.includes("by_products")) {
        await query("ALTER TABLE prod_processes ADD COLUMN by_products LONGTEXT NULL");
      }
      if (!colNames.includes("overheads")) {
        await query("ALTER TABLE prod_processes ADD COLUMN overheads LONGTEXT NULL");
      }
      if (!colNames.includes("machines")) {
        await query("ALTER TABLE prod_processes ADD COLUMN machines LONGTEXT NULL");
      }
      if (!colNames.includes("shifts")) {
        await query("ALTER TABLE prod_processes ADD COLUMN shifts LONGTEXT NULL");
      }
    } catch {}
  }

  if (!(await hasTable("prod_machines"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_machines (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        machine_name VARCHAR(100) NOT NULL,
        machine_code VARCHAR(50) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_mac_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_overheads"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_overheads (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        overhead_name VARCHAR(150) NOT NULL,
        code VARCHAR(50) NULL,
        allocation_basis VARCHAR(50) NOT NULL DEFAULT 'per Hour',
        default_cost_rate DECIMAL(18,2) DEFAULT 0,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ovh_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_shifts"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_shifts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        shift_name VARCHAR(50) NOT NULL,
        start_time TIME NULL,
        end_time TIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_shift_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  try {
    const itemCols = await query("SHOW COLUMNS FROM inv_items");
    const colNames = (itemCols || []).map((c) => c.Field);
    if (!colNames.includes("is_production_item")) {
      await query("ALTER TABLE inv_items ADD COLUMN is_production_item VARCHAR(5) DEFAULT 'N'");
    }
  } catch {}

  if (!(await hasTable("prod_routings"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_routings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        routing_name VARCHAR(150) NOT NULL,
        is_default TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_rout_scope (company_id),
        KEY idx_rout_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const routCols = await query("SHOW COLUMNS FROM prod_routings");
      const colNames = (routCols || []).map((c) => c.Field);
      if (!colNames.includes("is_active")) {
        await query("ALTER TABLE prod_routings ADD COLUMN is_active TINYINT(1) DEFAULT 1");
      }
    } catch {}
  }

  if (!(await hasTable("prod_routing_steps"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_routing_steps (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        routing_id BIGINT UNSIGNED NOT NULL,
        process_id BIGINT UNSIGNED NOT NULL,
        step_order INT NOT NULL DEFAULT 1,
        setup_time_mins INT DEFAULT 0,
        cycle_time_mins INT DEFAULT 0,
        KEY idx_rs_rout (routing_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_daily_plans"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_daily_plans (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        plan_no VARCHAR(50) NOT NULL,
        plan_date DATE NOT NULL,
        work_order_id BIGINT UNSIGNED NULL,
        work_order_no VARCHAR(100) NULL,
        item_id BIGINT UNSIGNED NULL,
        product_name VARCHAR(150) NULL,
        bom_id BIGINT UNSIGNED NULL,
        bom_description TEXT NULL,
        quantity DECIMAL(18,3) DEFAULT 0,
        manufacture_date DATE NULL,
        expiry_date DATE NULL,
        batch_number VARCHAR(100) NULL,
        job_card_no VARCHAR(100) NULL,
        job_card_date DATE NULL,
        processes LONGTEXT NULL,
        status VARCHAR(30) DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_plan_no (company_id, branch_id, plan_no),
        KEY idx_plan_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const planCols = await query("SHOW COLUMNS FROM prod_daily_plans");
      const colNames = (planCols || []).map((c) => c.Field);
      if (!colNames.includes("work_order_id")) await query("ALTER TABLE prod_daily_plans ADD COLUMN work_order_id BIGINT UNSIGNED NULL");
      if (!colNames.includes("work_order_no")) await query("ALTER TABLE prod_daily_plans ADD COLUMN work_order_no VARCHAR(100) NULL");
      if (!colNames.includes("item_id")) await query("ALTER TABLE prod_daily_plans ADD COLUMN item_id BIGINT UNSIGNED NULL");
      if (!colNames.includes("product_name")) await query("ALTER TABLE prod_daily_plans ADD COLUMN product_name VARCHAR(150) NULL");
      if (!colNames.includes("bom_id")) await query("ALTER TABLE prod_daily_plans ADD COLUMN bom_id BIGINT UNSIGNED NULL");
      if (!colNames.includes("bom_description")) await query("ALTER TABLE prod_daily_plans ADD COLUMN bom_description TEXT NULL");
      if (!colNames.includes("quantity")) await query("ALTER TABLE prod_daily_plans ADD COLUMN quantity DECIMAL(18,3) DEFAULT 0");
      if (!colNames.includes("manufacture_date")) await query("ALTER TABLE prod_daily_plans ADD COLUMN manufacture_date DATE NULL");
      if (!colNames.includes("expiry_date")) await query("ALTER TABLE prod_daily_plans ADD COLUMN expiry_date DATE NULL");
      if (!colNames.includes("batch_number")) await query("ALTER TABLE prod_daily_plans ADD COLUMN batch_number VARCHAR(100) NULL");
      if (!colNames.includes("job_card_no")) await query("ALTER TABLE prod_daily_plans ADD COLUMN job_card_no VARCHAR(100) NULL");
      if (!colNames.includes("job_card_date")) await query("ALTER TABLE prod_daily_plans ADD COLUMN job_card_date DATE NULL");
      if (!colNames.includes("plan_period")) await query("ALTER TABLE prod_daily_plans ADD COLUMN plan_period VARCHAR(50) NULL DEFAULT 'DAILY'");
      if (!colNames.includes("start_date")) await query("ALTER TABLE prod_daily_plans ADD COLUMN start_date DATE NULL");
      if (!colNames.includes("end_date")) await query("ALTER TABLE prod_daily_plans ADD COLUMN end_date DATE NULL");
      if (!colNames.includes("processes")) await query("ALTER TABLE prod_daily_plans ADD COLUMN processes LONGTEXT NULL");
    } catch {}
  }

  if (!(await hasTable("prod_daily_plan_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_daily_plan_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        plan_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        bom_id BIGINT UNSIGNED NULL,
        qty_to_produce DECIMAL(18,3) NOT NULL,
        status VARCHAR(30) DEFAULT 'PENDING',
        KEY idx_dpi_plan (plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_job_cards"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_job_cards (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        plan_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        process_id BIGINT UNSIGNED NOT NULL,
        machine_id BIGINT UNSIGNED NULL,
        shift_id BIGINT UNSIGNED NULL,
        planned_qty DECIMAL(18,3) NOT NULL,
        actual_qty DECIMAL(18,3) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'PENDING',
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_jc_scope (company_id, branch_id),
        KEY idx_jc_plan (plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
  
  if (await hasTable("prod_job_cards")) {
    try {
      const cols = (await query("SHOW COLUMNS FROM prod_job_cards") || []).map(c => c.Field);
      if (!cols.includes("job_card_no")) await query("ALTER TABLE prod_job_cards ADD COLUMN job_card_no VARCHAR(50) NULL");
      if (!cols.includes("job_card_date")) await query("ALTER TABLE prod_job_cards ADD COLUMN job_card_date DATE NULL");
      if (!cols.includes("batch_no")) await query("ALTER TABLE prod_job_cards ADD COLUMN batch_no VARCHAR(100) NULL");
      if (!cols.includes("mfg_date")) await query("ALTER TABLE prod_job_cards ADD COLUMN mfg_date DATE NULL");
      if (!cols.includes("expiry_date")) await query("ALTER TABLE prod_job_cards ADD COLUMN expiry_date DATE NULL");
      if (!cols.includes("good_qty")) await query("ALTER TABLE prod_job_cards ADD COLUMN good_qty DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("rejected_qty")) await query("ALTER TABLE prod_job_cards ADD COLUMN rejected_qty DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("scrap_qty")) await query("ALTER TABLE prod_job_cards ADD COLUMN scrap_qty DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("operator_id")) await query("ALTER TABLE prod_job_cards ADD COLUMN operator_id BIGINT UNSIGNED NULL");
      if (!cols.includes("operator_name")) await query("ALTER TABLE prod_job_cards ADD COLUMN operator_name VARCHAR(100) NULL");
      if (!cols.includes("assistant_name")) await query("ALTER TABLE prod_job_cards ADD COLUMN assistant_name VARCHAR(100) NULL");
      if (!cols.includes("defect_reason")) await query("ALTER TABLE prod_job_cards ADD COLUMN defect_reason TEXT NULL");
      if (!cols.includes("total_wastage")) await query("ALTER TABLE prod_job_cards ADD COLUMN total_wastage DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("total_overhead")) await query("ALTER TABLE prod_job_cards ADD COLUMN total_overhead DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("total_consumption")) await query("ALTER TABLE prod_job_cards ADD COLUMN total_consumption DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("total_production_cost")) await query("ALTER TABLE prod_job_cards ADD COLUMN total_production_cost DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("consumption_details")) await query("ALTER TABLE prod_job_cards ADD COLUMN consumption_details LONGTEXT NULL");
      if (!cols.includes("overhead_details")) await query("ALTER TABLE prod_job_cards ADD COLUMN overhead_details LONGTEXT NULL");
      if (!cols.includes("by_products_details")) await query("ALTER TABLE prod_job_cards ADD COLUMN by_products_details LONGTEXT NULL");
      if (!cols.includes("breakdown_details")) await query("ALTER TABLE prod_job_cards ADD COLUMN breakdown_details LONGTEXT NULL");
      if (!cols.includes("wastage_details")) await query("ALTER TABLE prod_job_cards ADD COLUMN wastage_details LONGTEXT NULL");
      if (!cols.includes("qc_status")) await query("ALTER TABLE prod_job_cards ADD COLUMN qc_status VARCHAR(30) NULL");
      if (!cols.includes("qc_inspected_at")) await query("ALTER TABLE prod_job_cards ADD COLUMN qc_inspected_at TIMESTAMP NULL");
    } catch {}
  }

  if (!(await hasTable("prod_qc_checklists"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_qc_checklists (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NULL,
        checklist_name VARCHAR(150) NOT NULL,
        category VARCHAR(100) DEFAULT 'General Inspection',
        min_pass_score DECIMAL(5,2) DEFAULT 70.00,
        items LONGTEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_qc_inspections"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_qc_inspections (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        job_card_id BIGINT UNSIGNED NOT NULL,
        checklist_id BIGINT UNSIGNED NULL,
        inspection_date DATE NOT NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        batch_no VARCHAR(100) NULL,
        mfg_date DATE NULL,
        expiry_date DATE NULL,
        planned_qty DECIMAL(18,3) DEFAULT 0,
        inspected_qty DECIMAL(18,3) DEFAULT 0,
        good_qty DECIMAL(18,3) DEFAULT 0,
        rejected_qty DECIMAL(18,3) DEFAULT 0,
        quality_score DECIMAL(5,2) DEFAULT 100,
        quality_status VARCHAR(30) DEFAULT 'PASSED',
        criteria_scores LONGTEXT NULL,
        remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_qc_job (job_card_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_material_receipts"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_receipts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        receipt_no VARCHAR(50) NOT NULL,
        receipt_date DATE NOT NULL,
        work_order_id BIGINT UNSIGNED NULL,
        plan_id BIGINT UNSIGNED NULL,
        requisition_id BIGINT UNSIGNED NULL,
        source_warehouse_id BIGINT UNSIGNED NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        received_by BIGINT UNSIGNED NULL,
        remarks TEXT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_mr_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const cols = (await query("SHOW COLUMNS FROM prod_material_receipts") || []).map(c => c.Field);
      if (!cols.includes("work_order_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN work_order_id BIGINT UNSIGNED NULL");
      if (!cols.includes("plan_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN plan_id BIGINT UNSIGNED NULL");
      if (!cols.includes("requisition_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN requisition_id BIGINT UNSIGNED NULL");
      if (!cols.includes("issue_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN issue_id BIGINT UNSIGNED NULL");
      if (!cols.includes("department_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN department_id BIGINT UNSIGNED NULL");
      if (!cols.includes("source_doc")) await query("ALTER TABLE prod_material_receipts ADD COLUMN source_doc VARCHAR(100) NULL");
      if (!cols.includes("warehouse_id")) await query("ALTER TABLE prod_material_receipts ADD COLUMN warehouse_id BIGINT UNSIGNED NULL");
      if (!cols.includes("received_by")) await query("ALTER TABLE prod_material_receipts ADD COLUMN received_by BIGINT UNSIGNED NULL");
    } catch {}
  }

  if (!(await hasTable("prod_material_receipt_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_receipt_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        receipt_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_received DECIMAL(18,3) NOT NULL,
        qty_utilized DECIMAL(18,3) DEFAULT 0,
        uom VARCHAR(50) NULL,
        batch_no VARCHAR(50) NULL,
        expiry_date DATE NULL,
        KEY idx_mri_rec (receipt_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const cols = (await query("SHOW COLUMNS FROM prod_material_receipt_items") || []).map(c => c.Field);
      if (!cols.includes("qty_utilized")) await query("ALTER TABLE prod_material_receipt_items ADD COLUMN qty_utilized DECIMAL(18,3) DEFAULT 0");
      if (!cols.includes("batch_no")) await query("ALTER TABLE prod_material_receipt_items ADD COLUMN batch_no VARCHAR(50) NULL");
      if (!cols.includes("expiry_date")) await query("ALTER TABLE prod_material_receipt_items ADD COLUMN expiry_date DATE NULL");
    } catch {}
  }

  if (!(await hasTable("prod_material_requisitions"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_requisitions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        requisition_no VARCHAR(50) NOT NULL,
        work_order_id BIGINT UNSIGNED NULL,
        plan_id BIGINT UNSIGNED NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        department_id BIGINT UNSIGNED NULL,
        priority VARCHAR(20) DEFAULT 'MEDIUM',
        requisition_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'DRAFT',
        requested_by BIGINT UNSIGNED NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_req_no (company_id, branch_id, requisition_no),
        KEY idx_req_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const cols = (await query("SHOW COLUMNS FROM prod_material_requisitions") || []).map(c => c.Field);
      if (!cols.includes("work_order_id")) await query("ALTER TABLE prod_material_requisitions ADD COLUMN work_order_id BIGINT UNSIGNED NULL");
      if (!cols.includes("warehouse_id")) await query("ALTER TABLE prod_material_requisitions ADD COLUMN warehouse_id BIGINT UNSIGNED NULL");
      if (!cols.includes("department_id")) await query("ALTER TABLE prod_material_requisitions ADD COLUMN department_id BIGINT UNSIGNED NULL");
      if (!cols.includes("priority")) await query("ALTER TABLE prod_material_requisitions ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM'");
      if (!cols.includes("requested_by")) await query("ALTER TABLE prod_material_requisitions ADD COLUMN requested_by BIGINT UNSIGNED NULL");
    } catch {}
  }

  if (!(await hasTable("prod_material_requisition_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_requisition_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        requisition_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_requested DECIMAL(18,3) NOT NULL,
        qty_received DECIMAL(18,3) DEFAULT 0,
        uom VARCHAR(50) NULL,
        batch_no VARCHAR(50) NULL,
        KEY idx_mri_req (requisition_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const cols = (await query("SHOW COLUMNS FROM prod_material_requisition_items") || []).map(c => c.Field);
      if (!cols.includes("batch_no")) await query("ALTER TABLE prod_material_requisition_items ADD COLUMN batch_no VARCHAR(50) NULL AFTER uom");
    } catch {}
  }

  if (!(await hasTable("prod_material_utilizations"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_utilizations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        utilization_no VARCHAR(50) NOT NULL,
        utilization_date DATE NOT NULL,
        work_order_id BIGINT UNSIGNED NULL,
        requisition_id BIGINT UNSIGNED NULL,
        receipt_id BIGINT UNSIGNED NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        utilized_by BIGINT UNSIGNED NULL,
        remarks TEXT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_util_no (company_id, branch_id, utilization_no),
        KEY idx_mu_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_material_utilization_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_utilization_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        utilization_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_required DECIMAL(18,3) DEFAULT 0,
        qty_received DECIMAL(18,3) DEFAULT 0,
        qty_utilized DECIMAL(18,3) NOT NULL,
        uom VARCHAR(50) NULL,
        batch_no VARCHAR(50) NULL,
        KEY idx_mui_util (utilization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_transfers"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_transfers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        transfer_no VARCHAR(50) NOT NULL,
        plan_id BIGINT UNSIGNED NULL,
        target_warehouse_id BIGINT UNSIGNED NOT NULL,
        transfer_date DATE NOT NULL,
        remarks TEXT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tr_no (company_id, branch_id, transfer_no),
        KEY idx_tr_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_transfer_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_transfer_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        transfer_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        uom VARCHAR(50) NULL,
        KEY idx_ti_tr (transfer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_stock_journals"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_stock_journals (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        journal_no VARCHAR(50) NOT NULL,
        plan_id BIGINT UNSIGNED NULL,
        journal_date DATE NOT NULL,
        item_id BIGINT UNSIGNED NULL,
        qty DECIMAL(18,3) NULL,
        type ENUM('IN', 'OUT') NULL,
        reason VARCHAR(150) NULL,
        remarks TEXT NULL,
        items JSON NULL,
        status VARCHAR(50) DEFAULT 'POSTED',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_psj_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    try {
      const sjCols = await query("SHOW COLUMNS FROM prod_stock_journals");
      const colNames = (sjCols || []).map(c => c.Field);
      if (!colNames.includes("plan_id")) {
        await query("ALTER TABLE prod_stock_journals ADD COLUMN plan_id BIGINT UNSIGNED NULL").catch(() => {});
      }
      if (!colNames.includes("remarks")) {
        await query("ALTER TABLE prod_stock_journals ADD COLUMN remarks TEXT NULL").catch(() => {});
      }
      if (!colNames.includes("items")) {
        await query("ALTER TABLE prod_stock_journals ADD COLUMN items JSON NULL").catch(() => {});
      }
      if (!colNames.includes("status")) {
        await query("ALTER TABLE prod_stock_journals ADD COLUMN status VARCHAR(50) DEFAULT 'POSTED'").catch(() => {});
      }
      if (!colNames.includes("created_by")) {
        await query("ALTER TABLE prod_stock_journals ADD COLUMN created_by BIGINT UNSIGNED NULL").catch(() => {});
      }
    } catch {}
  }

  if (!(await hasTable("prod_stock_journal_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_stock_journal_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        journal_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        type ENUM('IN', 'OUT') NOT NULL DEFAULT 'IN',
        qty DECIMAL(18,3) NOT NULL DEFAULT 1,
        uom VARCHAR(50) DEFAULT 'Pcs',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sji_journal (journal_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_operators"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_operators (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
        branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
        user_id BIGINT UNSIGNED NULL,
        operator_name VARCHAR(150) NOT NULL,
        employee_code VARCHAR(50) NULL,
        machine_id BIGINT UNSIGNED NULL,
        shift_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_op_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_settings"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_settings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        settings JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_prod_cfg (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

// Ensure tables on first request
router.use(async (req, res, next) => {
  try {
    await ensureProductionTables();
    next();
  } catch (err) {
    next(err);
  }
});

// ===== BILL OF MATERIALS (BOM) =====
router.get("/boms", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.VIEW"), productionController.listBoms);
router.get("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.VIEW"), productionController.getBomById);
router.post("/boms", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.createBom);
router.put("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.updateBom);
router.delete("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.deleteBom);

// ===== WORK ORDERS =====
router.get("/work-orders", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.VIEW"), productionController.listWorkOrders);
router.get("/work-orders/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.VIEW"), productionController.getWorkOrderById);
router.post("/work-orders", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.MANAGE"), productionController.createWorkOrder);
router.put("/work-orders/:id/status", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.MANAGE"), productionController.updateWorkOrderStatus);

// ===== SETUP MASTERS =====
router.get("/setup/config", requireAuth, requireCompanyScope, productionController.getProductionConfig);
router.post("/setup/config", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.saveProductionConfig);
router.get("/setup/processes", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listProcesses);
router.post("/setup/processes", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createProcess);
router.put("/setup/processes/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateProcess);
router.delete("/setup/processes/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteProcess);

router.get("/setup/departments", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listDepartments);
router.post("/setup/departments", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createDepartment);
router.put("/setup/departments/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateDepartment);
router.delete("/setup/departments/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteDepartment);

router.get("/setup/warehouses", requireAuth, requireCompanyScope, productionController.listProductionWarehouses);
router.post("/setup/warehouses", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createProductionWarehouse);
router.put("/setup/warehouses/:id/default", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.setDefaultProductionWarehouse);
router.put("/setup/warehouses/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateProductionWarehouse);
router.delete("/setup/warehouses/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteProductionWarehouse);

router.get("/setup/bom-output-types", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listBomOutputTypes);
router.post("/setup/bom-output-types", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createBomOutputType);
router.put("/setup/bom-output-types/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateBomOutputType);
router.delete("/setup/bom-output-types/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteBomOutputType);

router.get("/setup/machines", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listMachines);
router.post("/setup/machines", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createMachine);
router.put("/setup/machines/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateMachine);
router.delete("/setup/machines/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteMachine);

router.get("/setup/shifts", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listShifts);
router.post("/setup/shifts", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createShift);
router.put("/setup/shifts/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateShift);
router.delete("/setup/shifts/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteShift);

router.get("/setup/overheads", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listOverheads);
router.post("/setup/overheads", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createOverhead);
router.put("/setup/overheads/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateOverhead);
router.delete("/setup/overheads/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteOverhead);

router.get("/setup/qc-checklists", requireAuth, requireCompanyScope, productionController.listQcChecklists);
router.post("/setup/qc-checklists", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createQcChecklist);
router.put("/setup/qc-checklists/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateQcChecklist);
router.delete("/setup/qc-checklists/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteQcChecklist);

router.get("/setup/operators", requireAuth, requireCompanyScope, productionController.listOperators);
router.post("/setup/operators", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createOperator);
router.put("/setup/operators/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateOperator);
router.delete("/setup/operators/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteOperator);

// ===== PLANNING & EXECUTION =====
router.get("/routings", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.VIEW"), productionController.listRoutings);
router.get("/routings/:id", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.VIEW"), productionController.getRoutingById);
router.post("/routings", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.MANAGE"), productionController.createRouting);
router.put("/routings/:id", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.MANAGE"), productionController.updateRouting);

router.get("/planning/daily", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.VIEW"), productionController.listDailyPlans);
router.get("/planning/daily/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.VIEW"), productionController.getDailyPlanById);
router.post("/planning/daily", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.MANAGE"), productionController.createDailyPlan);
router.put("/planning/daily/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.MANAGE"), productionController.updateDailyPlan);

router.get("/execution/job-cards", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listJobCards);
router.get("/execution/job-cards/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getJobCardById);
router.post("/execution/job-cards/generate", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.generateJobCards);
router.put("/execution/job-cards/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.updateJobCard);

router.get("/qc/executions", requireAuth, requireCompanyScope, productionController.listCompletedExecutionsForQc);
router.get("/qc/inspections", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listQcInspections);
router.get("/qc/inspections/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getQcInspectionById);
router.post("/qc/inspections", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createQcInspection);
router.delete("/qc/inspections/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.deleteQcInspection);

router.get("/execution/material-requisition", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listMaterialRequisitions);
router.get("/execution/material-requisition/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getMaterialRequisitionById);
router.post("/execution/material-requisition", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createMaterialRequisition);
router.put("/execution/material-requisition/:id/status", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.updateMaterialRequisitionStatus);

router.get("/execution/material-receipt", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listMaterialReceipts);
router.get("/execution/material-receipt/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getMaterialReceiptById);
router.post("/execution/material-receipt", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createMaterialReceipt);

router.get("/execution/material-utilization", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listMaterialUtilizations);
router.get("/execution/material-utilization/next-no", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getNextMaterialUtilizationNo);
router.get("/execution/material-utilization/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getMaterialUtilizationById);
router.post("/execution/material-utilization", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createMaterialUtilization);

router.get("/execution/transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listProductionTransfers);
router.post("/execution/transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createProductionTransfer);

router.get("/execution/fg-transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listFinishedGoodsTransfers);
router.get("/execution/fg-transfer/next-no", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getNextFgTransferNo);
router.get("/execution/fg-transfer/eligible-executions", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getEligibleExecutionsForFgTransfer);
router.get("/execution/fg-transfer/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getFinishedGoodsTransferById);
router.post("/execution/fg-transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createFinishedGoodsTransfer);
router.delete("/execution/fg-transfer/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.deleteFinishedGoodsTransfer);

// ===== INVENTORY & STOCK BALANCES =====
router.get("/stock", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), inv_getStockBalances);
router.get("/stock/warehouses", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), inv_getWarehouseStockSummary);
router.get("/inventory/stock-journal/next-no", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.getNextProductionStockJournalNo);
router.get("/inventory/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.listStockJournals);
router.post("/inventory/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.MANAGE"), productionController.createStockJournal);
router.get("/stock-journal/next-no", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.getNextProductionStockJournalNo);
router.get("/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.listStockJournals);
router.post("/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.MANAGE"), productionController.createStockJournal);
router.get("/inventory/journal/next-no", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.getNextProductionStockJournalNo);
router.get("/inventory/journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.listStockJournals);
router.post("/inventory/journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.MANAGE"), productionController.createStockJournal);

router.get("/reports/efficiency", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getEfficiencyReport);
router.get("/reports/warehouse-stock", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getProductionWarehouseStockReport);
router.get("/reports/variance", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getMaterialVarianceReport);
router.get("/reports/bom-explosion", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getBomExplosionReport);
router.get("/reports/machines", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getMachineUtilizationReport);
router.get("/reports/production-detail", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getProductionReportDetails);
router.get("/reports/costing-data", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getProductionCostingData);
router.get("/reports/summary", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getProductionSummaryReport);

router.get("/dashboard/stats", requireAuth, requireCompanyScope, requireBranchScope, productionController.getProductionStats);
router.get("/dashboard/analytics", requireAuth, requireCompanyScope, requireBranchScope, productionController.getProductionDashboardAnalytics);

// Warm up production schema checks without crashing startup when DB is offline.
ensureProductionTables().catch((err) => {
  console.warn("Failed to ensure production tables during startup:", err);
});

export default router;

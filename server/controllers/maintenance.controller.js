/**
 * @file maintenance.controller.js
 * @description Controller for maintenance operations including requests, assets, schedules, and setup items.
 */
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { recordMovementTx } from "../services/stock.service.js";
import { sendMail } from "../utils/mailer.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../utils/redis.js";

// Utility: safely parse a value to a finite number
function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

let tablesEnsuredPromise = null;

// Helper to run database migrations/ensure tables exist for maintenance module
function ensureTables(companyId, branchId) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (!tablesEnsuredPromise) {
    tablesEnsuredPromise = (async () => {
      try {
  await query(`CREATE TABLE IF NOT EXISTS maint_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    request_no VARCHAR(50), request_date DATE,
    breakdown_date DATE NULL,
    maintenance_section_id INT NULL,
    maintenance_section_name VARCHAR(200) NULL,
    location_item_id INT NULL,
    location VARCHAR(200) NULL,
    requester_name VARCHAR(200), department VARCHAR(200),
    asset_id INT, asset_name VARCHAR(200),
    maintenance_type VARCHAR(100), priority VARCHAR(50) DEFAULT 'NORMAL',
    description TEXT, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE maint_requests
      ADD COLUMN IF NOT EXISTS breakdown_date DATE NULL AFTER request_date`,
  );
  await query(`ALTER TABLE maint_requests
      ADD COLUMN IF NOT EXISTS location VARCHAR(200) NULL AFTER breakdown_date`,
  );
  await query(`ALTER TABLE maint_requests
      ADD COLUMN IF NOT EXISTS maintenance_section_id INT NULL AFTER breakdown_date`,
  );
  await query(`ALTER TABLE maint_requests
      ADD COLUMN IF NOT EXISTS maintenance_section_name VARCHAR(200) NULL AFTER maintenance_section_id`,
  );
  await query(`ALTER TABLE maint_requests
      ADD COLUMN IF NOT EXISTS location_item_id INT NULL AFTER maintenance_section_name`,
  );

  await query(`CREATE TABLE IF NOT EXISTS maint_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    asset_no VARCHAR(100), asset_name VARCHAR(200),
    location VARCHAR(200), status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_job_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    order_no VARCHAR(50), order_date DATE,
    request_id INT, asset_id INT, asset_name VARCHAR(200),
    order_type VARCHAR(100), assigned_team VARCHAR(200),
    assigned_technician VARCHAR(200), scheduled_date DATE,
    instructions TEXT, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE maint_job_orders
      ADD COLUMN IF NOT EXISTS job_order_type VARCHAR(50) NULL AFTER order_type`
  );
  await query(`ALTER TABLE maint_job_orders
      ADD COLUMN IF NOT EXISTS location VARCHAR(200) NULL AFTER assigned_technician`
  );
  await query(`ALTER TABLE maint_job_orders
      ADD COLUMN IF NOT EXISTS supervisor VARCHAR(200) NULL AFTER location`
  );
  await query(`ALTER TABLE maint_job_orders
      ADD COLUMN IF NOT EXISTS service_provider VARCHAR(200) NULL AFTER supervisor`
  );

  await query(`CREATE TABLE IF NOT EXISTS maint_rfqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    rfq_no VARCHAR(50), rfq_date DATE,
    request_id INT, scope_of_work TEXT,
    response_deadline DATE, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_rfq_suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL, supplier_id INT, supplier_name VARCHAR(200)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  
  await query(`ALTER TABLE maint_rfqs ADD INDEX IF NOT EXISTS idx_maint_rfqs_company (company_id)`).catch(() => {});
  await query(`ALTER TABLE maint_rfq_suppliers ADD INDEX IF NOT EXISTS idx_maint_rfq_suppliers_rfq (rfq_id)`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_supplier_quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    quotation_no VARCHAR(50), quotation_date DATE,
    rfq_id INT, supplier_id INT, supplier_name VARCHAR(200),
    subtotal DECIMAL(18,4) DEFAULT 0, tax_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'GHS', exchange_rate DECIMAL(18,6) DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE maint_supplier_quotations ADD COLUMN IF NOT EXISTS valid_until DATE`).catch(() => {});
  await query(`ALTER TABLE maint_quotation_lines ADD COLUMN IF NOT EXISTS item_id INT, ADD COLUMN IF NOT EXISTS item_name VARCHAR(200), ADD COLUMN IF NOT EXISTS delivery_date DATE`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_quotation_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    description VARCHAR(500), qty DECIMAL(18,4) DEFAULT 1,
    rate DECIMAL(18,4) DEFAULT 0, discount_percent DECIMAL(8,4) DEFAULT 0,
    tax_code_id INT, amount DECIMAL(18,4) DEFAULT 0,
    item_id INT, item_name VARCHAR(200), delivery_date DATE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_quotation_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    url VARCHAR(1000) NOT NULL,
    filename VARCHAR(500),
    note VARCHAR(1000)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_job_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    execution_no VARCHAR(50), job_order_id INT,
    start_date DATE, end_date DATE,
    technicians TEXT, work_done TEXT,
    materials_used TEXT, completion_status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    sign_off_by VARCHAR(200), status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await query('ALTER TABLE maint_job_executions ADD COLUMN IF NOT EXISTS warehouse_id BIGINT UNSIGNED DEFAULT NULL AFTER created_by').catch(() => {});

  // Ensure all columns exist on maint_job_executions
  const jeMigrations = [
    ["start_time", "VARCHAR(10) NULL AFTER start_date"],
    ["end_time", "VARCHAR(10) NULL AFTER end_date"],
    ["downtime_hours", "DECIMAL(8,2) NULL AFTER end_time"],
    ["current_step", "INT NOT NULL DEFAULT 1 AFTER notes"],
    ["material_lines", "TEXT NULL AFTER materials_used"],
    ["checklist", "TEXT NULL AFTER material_lines"],
    ["approval_status", "VARCHAR(50) DEFAULT 'PENDING' AFTER checklist"],
    ["approved_by", "VARCHAR(200) NULL AFTER approval_status"],
    ["approval_date", "DATE NULL AFTER approved_by"],
    ["approval_notes", "TEXT NULL AFTER approval_date"],
    ["total_labor_hours", "DECIMAL(8,2) DEFAULT 0 AFTER approval_notes"],
    ["labor_cost", "DECIMAL(18,4) DEFAULT 0 AFTER total_labor_hours"],
    ["materials_cost", "DECIMAL(18,4) DEFAULT 0 AFTER labor_cost"],
    ["total_cost", "DECIMAL(18,4) DEFAULT 0 AFTER materials_cost"],
    ["created_by", "INT UNSIGNED NULL AFTER total_cost"],
  ];
  for (const [col, def] of jeMigrations) {
    try {
      const [chk] = await query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='maint_job_executions' AND column_name=?`,
        [col],
      );
      if (!chk?.cnt) {
        await pool.query(`ALTER TABLE maint_job_executions ADD COLUMN ${col} ${def}`);
      }
    } catch {}
  }

  await query(`CREATE TABLE IF NOT EXISTS maint_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    bill_no VARCHAR(50), bill_date DATE, due_date DATE,
    execution_id INT, supplier_id INT, supplier_name VARCHAR(200),
    subtotal DECIMAL(18,4) DEFAULT 0, discount_amount DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0, other_charges DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'GHS', exchange_rate DECIMAL(18,6) DEFAULT 1,
    payment_terms VARCHAR(100), payment_method VARCHAR(50),
    payment_reference VARCHAR(200), payment_status VARCHAR(50) DEFAULT 'UNPAID',
    status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_bill_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL, description VARCHAR(500),
    category VARCHAR(100), qty DECIMAL(18,4) DEFAULT 1,
    rate DECIMAL(18,4) DEFAULT 0, discount_percent DECIMAL(8,4) DEFAULT 0,
    tax_code_id INT, amount DECIMAL(18,4) DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    schedule_name VARCHAR(200), asset_id INT, asset_name VARCHAR(200),
    frequency VARCHAR(50), next_due_date DATE,
    assigned_to VARCHAR(200), description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS classification VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS maintenance_days VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS maintenance_routine VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS start_date DATE NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS end_date DATE NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS tasks TEXT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_schedules ADD COLUMN IF NOT EXISTS selected_assets TEXT NULL`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_rosters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    roster_name VARCHAR(200), period_start DATE, period_end DATE,
    team_members TEXT, shift_details TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS employee_id INT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS employee_name VARCHAR(200) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS team VARCHAR(200) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS supervisor VARCHAR(200) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS roster_date DATE NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS shift VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS start_time TIME NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS end_time TIME NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS asset_classification VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS asset_category VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS asset_group VARCHAR(100) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS assigned_area VARCHAR(200) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS primary_asset VARCHAR(200) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS overtime_eligible BOOLEAN DEFAULT FALSE`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS max_work_hours DECIMAL(5,2) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS remarks TEXT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS total_hours DECIMAL(5,2) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS schedule_id INT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS selected_assets TEXT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS maintenance_days VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS maintenance_routine VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS task_description TEXT NULL`).catch(() => {});
  await query(`ALTER TABLE maint_rosters ADD COLUMN IF NOT EXISTS estimated_duration DECIMAL(5,2) NULL`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    equipment_code VARCHAR(100), equipment_name VARCHAR(200),
    category VARCHAR(100), location VARCHAR(200),
    manufacturer VARCHAR(200), model VARCHAR(200),
    serial_number VARCHAR(200), purchase_date DATE,
    warranty_expiry DATE, status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE maint_equipment
    ADD COLUMN IF NOT EXISTS brand VARCHAR(200) NULL AFTER location`
  ).catch(() => {});
  await query(`ALTER TABLE maint_equipment
    ADD COLUMN IF NOT EXISTS group_name VARCHAR(200) NULL AFTER brand`
  ).catch(() => {});
  await query(`ALTER TABLE maint_equipment
    ADD COLUMN IF NOT EXISTS classification VARCHAR(200) NULL AFTER group_name`
  ).catch(() => {});
  await query(`ALTER TABLE maint_equipment
    ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL AFTER notes`
  ).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    param_key VARCHAR(100), param_value TEXT,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_param (company_id, branch_id, param_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  try { await query(`ALTER TABLE maint_parameters ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL AFTER param_value`); } catch (e) {}
  try { await query(`ALTER TABLE maint_parameters ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by`); } catch (e) {}
  try { await query(`ALTER TABLE maint_parameters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`); } catch (e) {}

  await query(`CREATE TABLE IF NOT EXISTS maint_contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    contract_no VARCHAR(100), supplier_id INT, supplier_name VARCHAR(200),
    start_date DATE, end_date DATE, contract_value DECIMAL(18,4) DEFAULT 0,
    scope TEXT, payment_terms VARCHAR(200),
    renewal_alert_days INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  try {
    const hasFileUrl = await hasColumn("maint_contracts", "contract_file_url");
    if (!hasFileUrl) {
      await query("ALTER TABLE maint_contracts ADD COLUMN contract_file_url VARCHAR(500) NULL AFTER notes");
      await query("ALTER TABLE maint_contracts ADD COLUMN contract_file_name VARCHAR(200) NULL AFTER contract_file_url");
    }
  } catch {}

  await query(`CREATE TABLE IF NOT EXISTS maint_contract_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL, asset_id INT, asset_name VARCHAR(200)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_setup_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_maint_setup_item (company_id, branch_id, item_type, item_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await query(`ALTER TABLE maint_setup_items ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL AFTER description`).catch(() => {});
  await query(`ALTER TABLE maint_setup_items ADD COLUMN IF NOT EXISTS currency_id BIGINT UNSIGNED NULL AFTER email`).catch(() => {});
  await query(`ALTER TABLE maint_setup_items ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL`).catch(() => {});
  await query(`ALTER TABLE maint_setup_items ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL`).catch(() => {});
  await query(`ALTER TABLE maint_setup_items ADD COLUMN IF NOT EXISTS parent_id INT NULL AFTER item_type`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS maint_section_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    section_item_id INT NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    assign_work TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_maint_section_user (company_id, branch_id, section_item_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_asset_meters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    asset_id INT NOT NULL,
    reading_date DATE NOT NULL,
    reading_value DECIMAL(18,4) NOT NULL,
    uom VARCHAR(20) NULL,
    recorded_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_am_asset (asset_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_downtime_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    asset_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    reason VARCHAR(255) NULL,
    category VARCHAR(50) DEFAULT 'UNPLANNED',
    impact_level VARCHAR(50) DEFAULT 'MEDIUM',
    recorded_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dl_asset (asset_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE maint_downtime_logs
    ADD COLUMN IF NOT EXISTS impact_level VARCHAR(50) DEFAULT 'MEDIUM' AFTER reason`
  ).catch(() => {});
  await query(`ALTER TABLE maint_downtime_logs
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'UNPLANNED' AFTER impact_level`
  ).catch(() => {});

  const auditTables = [
    "maint_requests", "maint_assets", "maint_job_orders", "maint_rfqs",
    "maint_rfq_suppliers", "maint_supplier_quotations", "maint_quotation_lines",
    "maint_job_executions", "maint_bills", "maint_bill_lines", "maint_schedules",
    "maint_rosters", "maint_equipment", "maint_parameters", "maint_contracts",
    "maint_contract_assets", "maint_setup_items", "maint_section_users",
    "maint_asset_meters", "maint_downtime_logs",
  ];
  for (const t of auditTables) {
    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL`).catch(() => {});
    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP`).catch(() => {});
    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL`).catch(() => {});
  }
  const noCreatedAt = ["maint_rfq_suppliers", "maint_quotation_lines", "maint_bill_lines", "maint_contract_assets"];
  for (const t of noCreatedAt) {
    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  }
  } finally {
    // Done
  }
    })();
  }
  return tablesEnsuredPromise;
}

// ===== HELPERS =====
// Helper to generate next sequential number based on existing records
function nextNo(prefix, rows) {
  if (!rows.length) return `${prefix}-000001`;
  const nums = rows.map((r) => {
    const m = String(r.no || "").match(/(\d+)$/);
    return m ? Number(m[1]) : 0;
  });
  return `${prefix}-${String(Math.max(...nums) + 1).padStart(6, "0")}`;
}

// Retrieves current user's full name or username, falling back to auth scope/request info
async function getCurrentUserName(req, companyId) {
  const userId =
    toNumber(req.scope?.userId) ||
    toNumber(req.user?.id) ||
    toNumber(req.user?.sub);

  if (!userId) {
    return (
      String(req.user?.full_name || req.user?.username || "").trim() || null
    );
  }

  try {
    const rows = await query(`SELECT full_name, username,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :userId
         AND company_id = :companyId
       LIMIT 1`,
      { userId, companyId },
    );
    const item = rows[0] || null;
    return (
      String(item?.full_name || "").trim() ||
      String(item?.username || "").trim() ||
      String(req.user?.full_name || req.user?.username || "").trim() ||
      null
    );
  } catch {
    return (
      String(req.user?.full_name || req.user?.username || "").trim() || null
    );
  }
}

// Auto-generate the next maintenance request number string
async function getNextMaintenanceRequestNo(companyId, branchId) {
  const existing = await query(`SELECT request_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_requests
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
       AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
    { companyId, branchId },
  );
  return nextNo("MTR", existing);
}

// Sanitizes input text, returning null if empty
function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  const diff = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekdayIndex(maintenanceDay) {
  const key = String(maintenanceDay || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, key)
    ? WEEKDAY_INDEX[key]
    : null;
}

function firstWeekdayOnOrAfter(date, weekday) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const diff = (weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diff);
  return next;
}

function nthWeekdayOfMonth(year, month, weekday, occurrence) {
  const firstDay = new Date(year, month, 1);
  const firstMatch = firstWeekdayOnOrAfter(firstDay, weekday);
  const result = addDays(firstMatch, (occurrence - 1) * 7);
  return result.getMonth() === month ? result : null;
}

function normalizeMaintenanceRoutine(value) {
  const raw = String(value || "").trim();
  const text = raw.toLowerCase();

  if (!raw) return null;
  if (
    text === "daily" ||
    text === "every day" ||
    text === "once a day"
  ) {
    return { unit: "day", interval: 1, occurrences: 1, label: "Daily" };
  }
  if (
    text === "weekly" ||
    text === "once a week" ||
    text === "every week"
  ) {
    return { unit: "week", interval: 1, occurrences: 1, label: "Once a week" };
  }
  if (
    text === "twice a week" ||
    text === "2x a week" ||
    text === "2 times a week" ||
    text === "two times a week"
  ) {
    return { unit: "week", interval: 1, occurrences: 2, label: "Twice a week" };
  }
  if (
    text === "biweekly" ||
    text === "every 2 weeks" ||
    text === "once every 2 weeks"
  ) {
    return { unit: "week", interval: 2, occurrences: 1, label: "Every 2 weeks" };
  }
  if (
    text === "monthly" ||
    text === "once a month" ||
    text === "every month"
  ) {
    return { unit: "month", interval: 1, occurrences: 1, label: "Once a month" };
  }
  if (
    text === "twice a month" ||
    text === "2x a month" ||
    text === "2 times a month" ||
    text === "two times a month"
  ) {
    return { unit: "month", interval: 1, occurrences: 2, label: "Twice a month" };
  }
  if (text === "quarterly" || text === "every quarter") {
    return { unit: "month", interval: 3, occurrences: 1, label: "Quarterly" };
  }
  if (
    text === "biannual" ||
    text === "bi-annual" ||
    text === "twice a year" ||
    text === "every 6 months" ||
    text === "semi-annual"
  ) {
    return { unit: "month", interval: 6, occurrences: 1, label: "Every 6 months" };
  }
  if (
    text === "annual" ||
    text === "annually" ||
    text === "yearly" ||
    text === "once a year" ||
    text === "every year"
  ) {
    return { unit: "month", interval: 12, occurrences: 1, label: "Annually" };
  }

  return null;
}

function generateRosterDates(periodStart, periodEnd, maintenanceDay, maintenanceRoutine) {
  const start = parseIsoDate(periodStart);
  const end = parseIsoDate(periodEnd);
  const routine = normalizeMaintenanceRoutine(maintenanceRoutine);

  if (!start || !end || start > end || !routine) return [];

  if (routine.unit === "day") {
    const dates = [];
    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(formatIsoDate(cursor));
    }
    return dates;
  }

  const weekday = getWeekdayIndex(maintenanceDay);
  if (weekday === null) return [];

  const generated = new Set();

  if (routine.unit === "week") {
    const offsets =
      routine.occurrences >= 2
        ? weekday <= 3
          ? [0, 3]
          : [-3, 0]
        : [0];
    const anchor = startOfWeek(start);

    for (
      let weekCursor = new Date(anchor);
      weekCursor <= end;
      weekCursor = addDays(weekCursor, routine.interval * 7)
    ) {
      const primary = firstWeekdayOnOrAfter(weekCursor, weekday);
      for (const offset of offsets) {
        const occurrence = addDays(primary, offset);
        if (occurrence < start || occurrence > end) continue;
        generated.add(formatIsoDate(occurrence));
      }
    }
  }

  if (routine.unit === "month") {
    for (
      let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
      monthCursor <= end;
      monthCursor = addMonths(monthCursor, routine.interval)
    ) {
      const first = nthWeekdayOfMonth(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        weekday,
        1,
      );
      if (first && first >= start && first <= end) {
        generated.add(formatIsoDate(first));
      }

      if (routine.occurrences >= 2) {
        const third = nthWeekdayOfMonth(
          monthCursor.getFullYear(),
          monthCursor.getMonth(),
          weekday,
          3,
        );
        if (third && third >= start && third <= end) {
          generated.add(formatIsoDate(third));
        }
      }
    }
  }

  return Array.from(generated).sort();
}

function buildGeneratedRosterName(baseName, rosterDate, totalCount) {
  const name = cleanText(baseName) || "Maintenance Roster";
  if (totalCount <= 1) return name;
  return `${name} - ${rosterDate}`;
}

async function insertRosterRecord(params) {
  return query(
    `INSERT INTO maint_rosters (company_id,branch_id,roster_name,period_start,period_end,team_members,shift_details,status,employee_id,employee_name,team,supervisor,roster_date,shift,start_time,end_time,asset_classification,asset_category,asset_group,assigned_area,primary_asset,availability_status,overtime_eligible,max_work_hours,remarks,total_hours,schedule_id,selected_assets,frequency,maintenance_days,maintenance_routine,task_description,estimated_duration) VALUES (:companyId,:branchId,:roster_name,:period_start,:period_end,:team_members,:shift_details,:status,:employee_id,:employee_name,:team,:supervisor,:roster_date,:shift,:start_time,:end_time,:asset_classification,:asset_category,:asset_group,:assigned_area,:primary_asset,:availability_status,:overtime_eligible,:max_work_hours,:remarks,:total_hours,:schedule_id,:selected_assets,:frequency,:maintenance_days,:maintenance_routine,:task_description,:estimated_duration)`,
    params,
  );
}

const SETUP_ITEM_TYPE_MAP = {
  "maintenance-types": "MAINTENANCE_TYPE",
  priorities: "PRIORITY",
  "execution-types": "EXECUTION_TYPE",
  sections: "SECTION",
  locations: "LOCATION",
  departments: "DEPARTMENT",
  brands: "BRAND",
  models: "MODEL",
  "status-types": "STATUS_TYPE",
  supervisors: "SUPERVISOR",
  technicians: "TECHNICIAN",
  teams: "TEAM",
  "service-providers": "SERVICE_PROVIDER",
  "maintenance-routines": "MAINTENANCE_ROUTINE",
  "job-order-types": "JOB_ORDER_TYPE",
  classifications: "CLASSIFICATION",
  categories: "CATEGORY",
  groups: "GROUP",
  manufacturers: "MANUFACTURER",
};

// Resolves setup item types from URL slugs/kebab-case keywords to DB ENUM strings
function resolveSetupItemType(kind) {
  return (
    SETUP_ITEM_TYPE_MAP[
      String(kind || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

// Helper query to list all active setup items by their category
async function listSetupItems(companyId, branchId, branchIdsStr = '', itemType = null) {
  const params = { companyId, branchId, branchIdsStr };
  let sql = `
    SELECT si.id, si.item_type, si.parent_id, si.item_name, si.description, si.email, si.currency_id, si.sort_order, si.is_active,
           si.created_at, u.username AS created_by_name
    FROM maint_setup_items si
    LEFT JOIN adm_users u ON u.id = si.created_by
    WHERE si.company_id = :companyId
      AND (:branchIdsStr = '' OR FIND_IN_SET(si.branch_id, :branchIdsStr))
  `;
  if (itemType) {
    sql += ` AND si.item_type = :itemType`;
    params.itemType = itemType;
  }
  sql += ` ORDER BY si.sort_order ASC, si.item_name ASC, si.id ASC`;
  return query(sql, params);
}

// Comprehensive endpoint helper that retrieves parameters, setups, catalogs, and user assignments
async function getSetupSummary(companyId, branchId, branchIdsStr = '') {
  const [paramsRows, itemRows, linkRows, userRows] = await Promise.all([
    query(`SELECT param_key, param_value,
          created_at,
          u.username AS created_by_name
         FROM maint_parameters
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
       { companyId, branchId, branchIdsStr },
    ),
    listSetupItems(companyId, branchId, branchIdsStr),
    query(`SELECT
         su.id,
         su.section_item_id,
         su.user_id,
         su.assign_work,
         su.is_active,
         si.item_name AS section_name,
         uw.username,
         uw.full_name,
         uw.email,
          su.created_at,
          cu.username AS created_by_name
         FROM maint_section_users su
       JOIN maint_setup_items si
         ON si.id = su.section_item_id
        AND si.company_id = su.company_id
        AND si.branch_id = su.branch_id
       JOIN adm_users uw
         ON uw.id = su.user_id
        LEFT JOIN adm_users cu ON cu.id = su.created_by
         WHERE su.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(su.branch_id, :branchIdsStr))
       ORDER BY si.item_name ASC, COALESCE(uw.full_name, uw.username) ASC`,
      { companyId, branchId, branchIdsStr },
    ),
    query(`SELECT id, username, email, full_name, is_active,
          created_at,
          cu.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users cu ON cu.id = created_by
         WHERE company_id = :companyId
         AND is_active = 1
       ORDER BY COALESCE(full_name, username) ASC, id ASC`,
      { companyId },
    ),
  ]);

  const params = {};
  for (const row of paramsRows) params[row.param_key] = row.param_value;

  const catalogs = {
    maintenanceTypes: [],
    priorities: [],
    executionTypes: [],
    sections: [],
    locations: [],
    departments: [],
    brands: [],
    models: [],
    statusTypes: [],
    supervisors: [],
    technicians: [],
    teams: [],
    serviceProviders: [],
    maintenanceRoutines: [],
    jobOrderTypes: [],
    classifications: [],
    categories: [],
    groups: [],
    manufacturers: [],
  };

  for (const row of itemRows) {
    const item = {
      id: Number(row.id),
      item_type: row.item_type,
      parent_id: row.parent_id ? Number(row.parent_id) : null,
      item_name: row.item_name,
      description: row.description || "",
      email: row.email || null,
      currency_id: row.currency_id ? Number(row.currency_id) : null,
      sort_order: Number(row.sort_order || 0),
      is_active: Number(row.is_active) === 1,
    };

    if (row.item_type === "MAINTENANCE_TYPE")
      catalogs.maintenanceTypes.push(item);
    if (row.item_type === "PRIORITY") catalogs.priorities.push(item);
    if (row.item_type === "EXECUTION_TYPE")
      catalogs.executionTypes.push(item);
    if (row.item_type === "SECTION") catalogs.sections.push(item);
    if (row.item_type === "LOCATION") catalogs.locations.push(item);
    if (row.item_type === "DEPARTMENT") catalogs.departments.push(item);
    if (row.item_type === "BRAND") catalogs.brands.push(item);
    if (row.item_type === "MODEL") catalogs.models.push(item);
    if (row.item_type === "STATUS_TYPE") catalogs.statusTypes.push(item);
    if (row.item_type === "SUPERVISOR") catalogs.supervisors.push(item);
    if (row.item_type === "TECHNICIAN") catalogs.technicians.push(item);
    if (row.item_type === "TEAM") catalogs.teams.push(item);
    if (row.item_type === "SERVICE_PROVIDER") catalogs.serviceProviders.push(item);
    if (row.item_type === "MAINTENANCE_ROUTINE") catalogs.maintenanceRoutines.push(item);
    if (row.item_type === "JOB_ORDER_TYPE") catalogs.jobOrderTypes.push(item);
    if (row.item_type === "CLASSIFICATION") catalogs.classifications.push(item);
    if (row.item_type === "CATEGORY") catalogs.categories.push(item);
    if (row.item_type === "GROUP") catalogs.groups.push(item);
    if (row.item_type === "MANUFACTURER") catalogs.manufacturers.push(item);
  }

  const sectionUsers = linkRows.map((row) => ({
    id: Number(row.id),
    section_item_id: Number(row.section_item_id),
    section_name: row.section_name || "",
    user_id: Number(row.user_id),
    username: row.username || "",
    full_name: row.full_name || "",
    email: row.email || "",
    assign_work: Number(row.assign_work) === 1,
    is_active: Number(row.is_active) === 1,
  }));

  const users = userRows.map((row) => ({
    id: Number(row.id),
    username: row.username || "",
    full_name: row.full_name || "",
    email: row.email || "",
    is_active: Number(row.is_active) === 1,
  }));

  return { params, catalogs, sectionUsers, users };
}

// Maps request body into an object, enforcing types and defaults
function parseRequestPayload(body = {}, requesterName = null) {
  return {
    request_no: cleanText(body.request_no),
    request_date: cleanText(body.request_date),
    breakdown_date: cleanText(body.breakdown_date),
    maintenance_section_id: toNumber(body.maintenance_section_id),
    maintenance_section_name: cleanText(body.maintenance_section_name),
    location_item_id: toNumber(body.location_item_id),
    location: cleanText(body.location),
    requester_name: requesterName || cleanText(body.requester_name),
    department: cleanText(body.department),
    asset_id: toNumber(body.asset_id),
    asset_name: cleanText(body.asset_name),
    maintenance_type: cleanText(body.maintenance_type),
    priority: cleanText(body.priority) || "NORMAL",
    description: cleanText(body.description),
    status: cleanText(body.status) || "DRAFT",
    notes: cleanText(body.notes),
  };
}

// Checks if a table contains a specific column, handling schema validation dynamically
async function hasColumn(tableName, columnName) {
  try {
    const rows = await query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1",
      { t: tableName, c: columnName },
    );
    return rows.length > 0;
  } catch { return false; }
}

// ===== ASSETS =====
// Fetch all maintenance assets for the branch and company
export const listAssets = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_assets:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_assets
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
       ORDER BY asset_name ASC, id ASC`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_assets:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve a specific asset by ID
export const getAssetById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_assets
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Create a new asset under the company and branch
export const createAsset = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(`INSERT INTO maint_assets
        (company_id, branch_id, asset_no, asset_name, location, status, notes)
       VALUES
        (:companyId, :branchId, :asset_no, :asset_name, :location, :status, :notes)`,
      {
        companyId,
        branchId, branchIdsStr,
        asset_no: cleanText(b.asset_no),
        asset_name: cleanText(b.asset_name),
        location: cleanText(b.location),
        status: cleanText(b.status) || "ACTIVE",
        notes: cleanText(b.notes),
      },
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

// Update an existing maintenance asset based on its ID
export const updateAsset = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await ensureTables(companyId, branchId);
    await query(`UPDATE maint_assets
       SET asset_no = :asset_no,
           asset_name = :asset_name,
           location = :location,
           status = :status,
           notes = :notes
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        asset_no: cleanText(b.asset_no),
        asset_name: cleanText(b.asset_name),
        location: cleanText(b.location),
        status: cleanText(b.status) || "ACTIVE",
        notes: cleanText(b.notes),
      },
    );
    await cacheDelPattern(`maint_assets:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== MAINTENANCE REQUESTS =====
// Fetch maintenance requests with basic workflow tracking info
export const listRequests = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_requests:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT r.*,
          r.created_at,
          u.username AS created_by_name,
          dw.assigned_to_user_id,
          au.username AS forwarded_to_username
         FROM maint_requests r
        LEFT JOIN adm_users u ON u.id = r.created_by
        LEFT JOIN adm_document_workflows dw ON dw.document_id = r.id AND dw.document_type = 'MAINT_REQUEST' AND dw.status = 'PENDING'
        LEFT JOIN adm_users au ON au.id = dw.assigned_to_user_id
         WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) ORDER BY r.created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_requests:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details for a specific maintenance request
export const getRequestById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_requests
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Generate and send the next maintenance request sequence number
export const getNextRequestNo = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const request_no = await getNextMaintenanceRequestNo(companyId, branchId);
    res.json({ request_no });
  } catch (err) {
    next(err);
  }
};

// Create a new maintenance request entry
export const createRequest = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '', userId } = req.scope || {};
    await ensureTables(companyId, branchId);
    const requesterName = await getCurrentUserName(req, companyId);
    const payload = parseRequestPayload(req.body, requesterName);
    const request_no =
      payload.request_no ||
      (await getNextMaintenanceRequestNo(companyId, branchId));
    const r = await query(`INSERT INTO maint_requests
        (company_id, branch_id, request_no, request_date, breakdown_date, maintenance_section_id, maintenance_section_name, location_item_id, location, requester_name, department, asset_id, asset_name, maintenance_type, priority, description, status, notes, created_by)
       VALUES
        (:companyId, :branchId, :request_no, :request_date, :breakdown_date, :maintenance_section_id, :maintenance_section_name, :location_item_id, :location, :requester_name, :department, :asset_id, :asset_name, :maintenance_type, :priority, :description, :status, :notes, :created_by)`,
      { companyId, branchId, branchIdsStr, ...payload, request_no, created_by: userId || null },
    );
    res.status(201).json({ id: r.insertId, request_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing maintenance request 
export const updateRequest = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const requesterName = await getCurrentUserName(req, companyId);
    const payload = parseRequestPayload(req.body, requesterName);
    await query(`UPDATE maint_requests
       SET request_date = :request_date,
           breakdown_date = :breakdown_date,
           maintenance_section_id = :maintenance_section_id,
           maintenance_section_name = :maintenance_section_name,
           location_item_id = :location_item_id,
           location = :location,
           requester_name = :requester_name,
           department = :department,
           asset_id = :asset_id,
           asset_name = :asset_name,
           maintenance_type = :maintenance_type,
           priority = :priority,
           description = :description,
           status = :status,
           notes = :notes
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr, ...payload },
    );
    await cacheDelPattern(`maint_requests:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Handles moving a draft request into an approval workflow
export const submitRequest = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);

    const [doc] = await query(`SELECT id, status, request_no FROM maint_requests WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!doc) throw httpError(404, "NOT_FOUND", "Not found");
    if (doc.status !== "DRAFT") throw httpError(400, "BAD_REQUEST", "Can only submit DRAFT requests");

    const docType = "MAINT_REQUEST";
    const docRouteBase = "/maintenance/maintenance-requests";

    const wfByRoute = await query(
      `SELECT * FROM adm_workflows WHERE company_id=:companyId AND (document_route=:docRouteBase OR document_type=:docType) AND is_active=1 ORDER BY id ASC LIMIT 1`,
      { companyId, docRouteBase, docType },
    ).catch(() => []);
    const activeWf = wfByRoute[0] || null;

    if (!activeWf) {
      await query(`UPDATE maint_requests SET status='APPROVED' WHERE id=:id`, { id });
      return await cacheDelPattern(`maint_requests:company:${companyId}:*`);
    res.json({ status: "APPROVED" });
    }

    const steps = await query(
      `SELECT * FROM adm_workflow_steps WHERE workflow_id=:wf ORDER BY step_order ASC LIMIT 1`,
      { wf: activeWf.id },
    );
    if (!steps.length) {
      await query(`UPDATE maint_requests SET status='APPROVED' WHERE id=:id`, { id });
      return await cacheDelPattern(`maint_requests:company:${companyId}:*`);
    res.json({ status: "APPROVED" });
    }

    const first = steps[0];
    const assignedToUserId = toNumber(req.body?.target_user_id) || toNumber(first.approver_user_id);

    await query(
      `INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id) VALUES (:companyId, :workflowId, :documentId, :docType, :stepOrder, 'PENDING', :assignedTo)`,
      { companyId, workflowId: activeWf.id, documentId: id, docType, stepOrder: first.step_order, assignedTo: assignedToUserId },
    );

    await query(`UPDATE maint_requests SET status='PENDING_APPROVAL' WHERE id=:id`, { id });

    res.status(201).json({ status: "PENDING_APPROVAL" });
  } catch (err) {
    next(err);
  }
};

// ===== JOB ORDERS =====
// Retrieve a list of all maintenance job orders
export const listJobOrders = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_job_orders:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_job_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) ORDER BY created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_job_orders:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details of a specific job order by ID
export const getJobOrderById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_job_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Create a new maintenance job order, assigning teams/technicians
export const createJobOrder = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '', userId } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT order_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_job_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const order_no = b.order_no || nextNo("MJO", existing);
    const r = await query(`INSERT INTO maint_job_orders (company_id,branch_id,order_no,order_date,request_id,asset_id,asset_name,order_type,job_order_type,assigned_team,assigned_technician,location,supervisor,service_provider,scheduled_date,instructions,status,notes,created_by) VALUES (:companyId,:branchId,:order_no,:order_date,:request_id,:asset_id,:asset_name,:order_type,:job_order_type,:assigned_team,:assigned_technician,:location,:supervisor,:service_provider,:scheduled_date,:instructions,:status,:notes,:created_by)`,
      {
        companyId,
        branchId, branchIdsStr,
        order_no,
        order_date: b.order_date || null,
        request_id: toNumber(b.request_id),
        asset_id: toNumber(b.asset_id),
        asset_name: b.asset_name || null,
        order_type: b.order_type || null,
        job_order_type: b.job_order_type || null,
        assigned_team: b.assigned_team || null,
        assigned_technician: b.assigned_technician || null,
        location: b.location || null,
        supervisor: b.supervisor || null,
        service_provider: b.service_provider || null,
        scheduled_date: b.scheduled_date || null,
        instructions: b.instructions || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        created_by: userId || null,
      },
    );
    res.status(201).json({ id: r.insertId, order_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing maintenance job order
export const updateJobOrder = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_job_orders SET order_date=:order_date,request_id=:request_id,asset_id=:asset_id,asset_name=:asset_name,order_type=:order_type,job_order_type=:job_order_type,assigned_team=:assigned_team,assigned_technician=:assigned_technician,location=:location,supervisor=:supervisor,service_provider=:service_provider,scheduled_date=:scheduled_date,instructions=:instructions,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        order_date: b.order_date || null,
        request_id: toNumber(b.request_id),
        asset_id: toNumber(b.asset_id),
        asset_name: b.asset_name || null,
        order_type: b.order_type || null,
        job_order_type: b.job_order_type || null,
        assigned_team: b.assigned_team || null,
        assigned_technician: b.assigned_technician || null,
        location: b.location || null,
        supervisor: b.supervisor || null,
        service_provider: b.service_provider || null,
        scheduled_date: b.scheduled_date || null,
        instructions: b.instructions || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
      },
    );
    await cacheDelPattern(`maint_job_orders:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== RFQ =====
// Fetch a list of all RFQs (Requests for Quotation) along with supplier names
export const listRFQs = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_rfqs:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT r.*, GROUP_CONCAT(s.supplier_name) AS supplier_names,
          r.created_at,
          u.username AS created_by_name
         FROM maint_rfqs r LEFT JOIN maint_rfq_suppliers s ON s.rfq_id=r.id
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) GROUP BY r.id ORDER BY r.created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_rfqs:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details of a specific RFQ and its associated suppliers
export const getRFQById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_rfqs
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const suppliers = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_rfq_suppliers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE rfq_id=:id`,
      { id },
    );
    res.json({ item: rows[0], suppliers });
  } catch (err) {
    next(err);
  }
};

// Create a new RFQ and record the selected suppliers
export const createRFQ = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '', userId = null } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT rfq_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_rfqs
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const rfq_no = b.rfq_no || nextNo("MRFQ", existing);
    const r = await query(`INSERT INTO maint_rfqs (company_id,branch_id,rfq_no,rfq_date,request_id,scope_of_work,response_deadline,status,notes,created_by) VALUES (:companyId,:branchId,:rfq_no,:rfq_date,:request_id,:scope_of_work,:response_deadline,:status,:notes,:created_by)`,
      {
        companyId,
        branchId, branchIdsStr,
        rfq_no,
        rfq_date: b.rfq_date || null,
        request_id: toNumber(b.request_id),
        scope_of_work: b.scope_of_work || null,
        response_deadline: b.response_deadline || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        created_by: userId,
      },
    );
    const rfqId = r.insertId;
    if (Array.isArray(b.suppliers)) {
      for (const s of b.suppliers) {
        await query(`INSERT INTO maint_rfq_suppliers (rfq_id,supplier_id,supplier_name) VALUES (:rfqId,:supplier_id,:supplier_name)`,
          {
            rfqId,
            supplier_id: toNumber(s.supplier_id),
            supplier_name: s.supplier_name || null,
          },
        );
      }
    }
    await cacheDelPattern(`maint_rfqs:company:${companyId}:*`);
    res.status(201).json({ id: rfqId, rfq_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing RFQ, fully replacing the old suppliers list
export const updateRFQ = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_rfqs SET rfq_date=:rfq_date,request_id=:request_id,scope_of_work=:scope_of_work,response_deadline=:response_deadline,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        rfq_date: b.rfq_date || null,
        request_id: toNumber(b.request_id),
        scope_of_work: b.scope_of_work || null,
        response_deadline: b.response_deadline || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
      },
    );
    if (Array.isArray(b.suppliers)) {
      await query(`DELETE FROM maint_rfq_suppliers WHERE rfq_id=:id`, { id });
      for (const s of b.suppliers) {
        await query(`INSERT INTO maint_rfq_suppliers (rfq_id,supplier_id,supplier_name) VALUES (:id,:supplier_id,:supplier_name)`,
          {
            id,
            supplier_id: toNumber(s.supplier_id),
            supplier_name: s.supplier_name || null,
          },
        );
      }
    }
    await cacheDelPattern(`maint_rfqs:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== SUPPLIER QUOTATIONS =====
// Fetch all supplier quotations
export const listSupplierQuotations = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_supplier_quotations:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_supplier_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) ORDER BY created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_supplier_quotations:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve a supplier quotation and its line items
export const getSupplierQuotationById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_supplier_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const lines = await query(`SELECT l.*, i.item_name, i.item_code,
          l.created_at,
          u.username AS created_by_name
         FROM maint_quotation_lines l
         LEFT JOIN inv_items i ON i.id = l.item_id
        LEFT JOIN adm_users u ON u.id = l.created_by
         WHERE l.quotation_id=:id`,
      { id },
    );
    const attachments = await query(`SELECT * FROM maint_quotation_attachments WHERE quotation_id=:id`, { id });
    res.json({ item: rows[0], details: lines, attachments });
  } catch (err) {
    next(err);
  }
};

// Record a new supplier quotation with its specific line items
export const createSupplierQuotation = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT quotation_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_supplier_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const quotation_no = b.quotation_no || nextNo("MSQ", existing);
    const r = await query(`INSERT INTO maint_supplier_quotations (company_id,branch_id,quotation_no,quotation_date,rfq_id,supplier_id,supplier_name,subtotal,tax_amount,total_amount,currency,exchange_rate,status,notes,valid_until) VALUES (:companyId,:branchId,:quotation_no,:quotation_date,:rfq_id,:supplier_id,:supplier_name,:subtotal,:tax_amount,:total_amount,:currency,:exchange_rate,:status,:notes,:valid_until)`,
      {
        companyId,
        branchId, branchIdsStr,
        quotation_no,
        quotation_date: b.quotation_date || null,
        rfq_id: toNumber(b.rfq_id),
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        subtotal: Number(b.subtotal || 0),
        tax_amount: Number(b.tax_amount || 0),
        total_amount: Number(b.total_amount || 0),
        currency: b.currency || "GHS",
        exchange_rate: Number(b.exchange_rate || 1),
        status: b.status || "DRAFT",
        notes: b.remarks || b.notes || null,
        valid_until: b.valid_until || null,
      },
    );
    const qId = r.insertId;
    if (Array.isArray(b.details)) {
      for (const l of b.details) {
        await query(`INSERT INTO maint_quotation_lines (quotation_id,item_id,item_name,qty,rate,tax_code_id,amount,delivery_date) VALUES (:qId,:item_id,:item_name,:qty,:rate,:tax_code_id,:amount,:delivery_date)`,
          {
            qId,
            item_id: toNumber(l.item_id),
            item_name: l.item_name || null,
            qty: Number(l.qty || 1),
            rate: Number(l.unit_price || 0),
            tax_code_id: toNumber(l.tax_code_id),
            amount: Number(l.line_total || 0),
            delivery_date: l.delivery_date || null,
          },
        );
      }
    }
    if (Array.isArray(b.attachments)) {
      for (const att of b.attachments) {
        if (att.url) {
          await query(
            `INSERT INTO maint_quotation_attachments (quotation_id, url, filename, note) VALUES (:qId, :url, :filename, :note)`,
            {
              qId,
              url: att.url,
              filename: att.filename || null,
              note: att.note || null,
            }
          );
        }
      }
    }
    res.status(201).json({ id: qId, quotation_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing supplier quotation, replacing all line items
export const updateSupplierQuotation = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_supplier_quotations SET quotation_date=:quotation_date,rfq_id=:rfq_id,supplier_id=:supplier_id,supplier_name=:supplier_name,subtotal=:subtotal,tax_amount=:tax_amount,total_amount=:total_amount,currency=:currency,exchange_rate=:exchange_rate,status=:status,notes=:notes,valid_until=:valid_until WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        quotation_date: b.quotation_date || null,
        rfq_id: toNumber(b.rfq_id),
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        subtotal: Number(b.subtotal || 0),
        tax_amount: Number(b.tax_amount || 0),
        total_amount: Number(b.total_amount || 0),
        currency: b.currency || "GHS",
        exchange_rate: Number(b.exchange_rate || 1),
        status: b.status || "DRAFT",
        notes: b.remarks || b.notes || null,
        valid_until: b.valid_until || null,
      },
    );
    if (Array.isArray(b.details)) {
      await query(`DELETE FROM maint_quotation_lines WHERE quotation_id=:id`, {
        id,
      });
      for (const l of b.details) {
        await query(`INSERT INTO maint_quotation_lines (quotation_id,item_id,item_name,qty,rate,tax_code_id,amount,delivery_date) VALUES (:id,:item_id,:item_name,:qty,:rate,:tax_code_id,:amount,:delivery_date)`,
          {
            id,
            item_id: toNumber(l.item_id),
            item_name: l.item_name || null,
            qty: Number(l.qty || 1),
            rate: Number(l.unit_price || 0),
            tax_code_id: toNumber(l.tax_code_id),
            amount: Number(l.line_total || 0),
            delivery_date: l.delivery_date || null,
          },
        );
      }
    }
    if (Array.isArray(b.attachments)) {
      await query(`DELETE FROM maint_quotation_attachments WHERE quotation_id=:id`, { id });
      for (const att of b.attachments) {
        if (att.url) {
          await query(
            `INSERT INTO maint_quotation_attachments (quotation_id, url, filename, note) VALUES (:id, :url, :filename, :note)`,
            {
              id,
              url: att.url,
              filename: att.filename || null,
              note: att.note || null,
            }
          );
        }
      }
    }
    await cacheDelPattern(`maint_supplier_quotations:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== JOB EXECUTIONS =====
// Fetch all maintenance job executions
export const listJobExecutions = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_job_executions:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const status = String(req.query.status || "").trim().toUpperCase();
    let sql = `SELECT e.id, e.company_id, e.branch_id, e.execution_no, e.job_order_id, 
          e.start_date, e.start_time, e.end_date, e.end_time, e.downtime_hours, 
          e.completion_status, e.sign_off_by, e.sign_off_date, e.status, 
          e.approval_status, e.approved_by, e.approval_date, e.total_labor_hours, 
          e.labor_cost, e.materials_cost, e.total_cost, e.current_step, e.created_by, 
          o.order_no, e.created_at,
          (SELECT username FROM adm_users WHERE id = e.created_by) AS created_by_name
         FROM maint_job_executions e LEFT JOIN maint_job_orders o ON o.id=e.job_order_id
         WHERE e.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr))`;
    const params = { companyId, branchId, branchIdsStr };
    if (status) {
      sql += " AND UPPER(e.completion_status) = :status";
      params.status = status;
    }
    sql += " ORDER BY e.created_at DESC LIMIT 200";
    const items = await query(sql, params);
    await cacheSet(`maint_job_executions:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details for a specific job execution record
export const getJobExecutionById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          (SELECT username FROM adm_users WHERE id = created_by) AS created_by_name
         FROM maint_job_executions
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const item = rows[0];
    try { item.technicians = JSON.parse(item.technicians || "[]"); } catch { item.technicians = []; }
    try { item.material_lines = JSON.parse(item.material_lines || "[]"); } catch { item.material_lines = []; }
    try { item.checklist = JSON.parse(item.checklist || "[]"); } catch { item.checklist = []; }
    res.json({ item });
  } catch (err) {
    next(err);
  }
};

// Record a new job execution/completion report

async function ensureMaintMaterialUtilizationTables(companyId, branchId) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await query(`CREATE TABLE IF NOT EXISTS maint_material_utilization (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    utilization_no VARCHAR(50) NOT NULL,
    utilization_date DATE NOT NULL,
    execution_id INT NOT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maint_mu_scope_no (company_id, branch_id, utilization_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_material_utilization_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    utilization_id BIGINT UNSIGNED NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    uom VARCHAR(50) DEFAULT 'PCS',
    required_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
    qty_in_stock DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_maint_mu_id (utilization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export const createJobExecution = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT execution_no AS no FROM maint_job_executions WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const execution_no = b.execution_no || nextNo("MJE", existing);
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    const r = await query(`INSERT INTO maint_job_executions (company_id,branch_id,execution_no,job_order_id,start_date,start_time,end_date,end_time,downtime_hours,technicians,work_done,materials_used,material_lines,checklist,completion_status,sign_off_by,sign_off_date,status,notes,approval_status,approved_by,approval_date,approval_notes,total_labor_hours,labor_cost,materials_cost,total_cost,current_step,created_by) VALUES (:companyId,:branchId,:execution_no,:job_order_id,:start_date,:start_time,:end_date,:end_time,:downtime_hours,:technicians,:work_done,:materials_used,:material_lines,:checklist,:completion_status,:sign_off_by,:sign_off_date,:status,:notes,:approval_status,:approved_by,:approval_date,:approval_notes,:total_labor_hours,:labor_cost,:materials_cost,:total_cost,:current_step,:created_by)`,
      {
        companyId,
        branchId, branchIdsStr,
        execution_no,
        job_order_id: toNumber(b.job_order_id),
        start_date: b.start_date || null,
        start_time: b.start_time || null,
        end_date: b.end_date || null,
        end_time: b.end_time || null,
        downtime_hours: b.downtime_hours || null,
        technicians: JSON.stringify(b.technicians || []),
        work_done: b.work_done || null,
        materials_used: b.materials_used || null,
        material_lines: JSON.stringify(b.material_lines || []),
        checklist: JSON.stringify(b.checklist || []),
        completion_status: b.completion_status || "IN_PROGRESS",
        sign_off_by: b.sign_off_by || null,
        sign_off_date: b.sign_off_date || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        approval_status: b.approval_status || "PENDING",
        approved_by: b.approved_by || null,
        approval_date: b.approval_date || null,
        approval_notes: b.approval_notes || null,
        total_labor_hours: Number(b.total_labor_hours || 0),
        labor_cost: Number(b.labor_cost || 0),
        materials_cost: Number(b.materials_cost || 0),
        total_cost: Number(b.total_cost || 0),
        current_step: Number(b.current_step || 1),
        created_by: userId,
      },
    );
    res.status(201).json({ id: r.insertId, execution_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing job execution record
export const updateJobExecution = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_job_executions SET job_order_id=:job_order_id,start_date=:start_date,start_time=:start_time,end_date=:end_date,end_time=:end_time,downtime_hours=:downtime_hours,technicians=:technicians,work_done=:work_done,materials_used=:materials_used,material_lines=:material_lines,checklist=:checklist,completion_status=:completion_status,sign_off_by=:sign_off_by,sign_off_date=:sign_off_date,status=:status,notes=:notes,approval_status=:approval_status,approved_by=:approved_by,approval_date=:approval_date,approval_notes=:approval_notes,total_labor_hours=:total_labor_hours,labor_cost=:labor_cost,materials_cost=:materials_cost,total_cost=:total_cost,current_step=:current_step WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        job_order_id: toNumber(b.job_order_id),
        start_date: b.start_date || null,
        start_time: b.start_time || null,
        end_date: b.end_date || null,
        end_time: b.end_time || null,
        downtime_hours: b.downtime_hours || null,
        technicians: JSON.stringify(b.technicians || []),
        work_done: b.work_done || null,
        materials_used: b.materials_used || null,
        material_lines: JSON.stringify(b.material_lines || []),
        checklist: JSON.stringify(b.checklist || []),
        completion_status: b.completion_status || "IN_PROGRESS",
        sign_off_by: b.sign_off_by || null,
        sign_off_date: b.sign_off_date || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        approval_status: b.approval_status || "PENDING",
        approved_by: b.approved_by || null,
        approval_date: b.approval_date || null,
        approval_notes: b.approval_notes || null,
        total_labor_hours: Number(b.total_labor_hours || 0),
        labor_cost: Number(b.labor_cost || 0),
        materials_cost: Number(b.materials_cost || 0),
        total_cost: Number(b.total_cost || 0),
        current_step: Number(b.current_step || 1),
      },
    );
    await cacheDelPattern(`maint_job_executions:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== MAINTENANCE BILLS =====
// Fetch all maintenance bills
export const listBills = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_bills:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_bills
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) ORDER BY created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_bills:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details for a specific maintenance bill and its line items
export const getBillById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_bills
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const lines = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_bill_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE bill_id=:id`,
      { id },
    );
    res.json({ item: rows[0], lines });
  } catch (err) {
    next(err);
  }
};

// Generate and return the next sequential bill number
export const getNextBillNo = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const existing = await query(`SELECT bill_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_bills
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ nextNo: nextNo("MBL", existing) });
  } catch (err) {
    next(err);
  }
};

// Record a new maintenance bill and its individual line items
export const createBill = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT bill_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_bills
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const bill_no = b.bill_no || nextNo("MBL", existing);
    const r = await query(`INSERT INTO maint_bills (company_id,branch_id,bill_no,bill_date,due_date,execution_id,supplier_id,supplier_name,subtotal,discount_amount,tax_amount,other_charges,total_amount,currency,exchange_rate,payment_terms,payment_method,payment_reference,payment_status,status,notes,cost_center_id) VALUES (:companyId,:branchId,:bill_no,:bill_date,:due_date,:execution_id,:supplier_id,:supplier_name,:subtotal,:discount_amount,:tax_amount,:other_charges,:total_amount,:currency,:exchange_rate,:payment_terms,:payment_method,:payment_reference,:payment_status,:status,:notes,:costCenterId)`,
      {
        companyId,
        branchId, branchIdsStr,
        bill_no,
        bill_date: b.bill_date || null,
        due_date: b.due_date || null,
        execution_id: toNumber(b.execution_id),
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        subtotal: Number(b.subtotal || 0),
        discount_amount: Number(b.discount_amount || 0),
        tax_amount: Number(b.tax_amount || 0),
        other_charges: Number(b.other_charges || 0),
        total_amount: Number(b.total_amount || 0),
        currency: b.currency || "GHS",
        exchange_rate: Number(b.exchange_rate || 1),
        payment_terms: b.payment_terms || null,
        payment_method: b.payment_method || null,
        payment_reference: b.payment_reference || null,
        payment_status: b.payment_status || "UNPAID",
        status: "POSTED",
        notes: b.notes || null,
        costCenterId: b.cost_center_id ? toNumber(b.cost_center_id) : null,
      },
    );
    const billId = r.insertId;
    if (Array.isArray(b.lines)) {
      for (const l of b.lines) {
        await query(`INSERT INTO maint_bill_lines (bill_id,description,category,qty,rate,discount_percent,tax_code_id,amount) VALUES (:billId,:description,:category,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          {
            billId,
            description: l.description || null,
            category: l.category || null,
            qty: Number(l.qty || 1),
            rate: Number(l.rate || 0),
            discount_percent: Number(l.discount_percent || 0),
            tax_code_id: toNumber(l.tax_code_id),
            amount: Number(l.amount || 0),
          },
        );
      }
    }
    res.status(201).json({ id: billId, bill_no });
  } catch (err) {
    next(err);
  }
};

// Update an existing maintenance bill, replacing all line items
export const updateBill = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    
    if (b.status === "CANCELLED") {
      const uRows = await query(
        `SELECT 1 FROM adm_exceptional_permissions WHERE user_id = :uid AND effect = 'ALLOW' AND is_active = 1 AND permission_code = 'MAINTENANCE.BILL.CANCEL' LIMIT 1`,
        { uid: req.user?.id }
      );
      if (!uRows || uRows.length === 0) {
        throw httpError(403, "FORBIDDEN", "You do not have exceptional permission to cancel maintenance bills");
      }
    }
    
    await query(`UPDATE maint_bills SET bill_date=:bill_date,due_date=:due_date,execution_id=:execution_id,supplier_id=:supplier_id,supplier_name=:supplier_name,subtotal=:subtotal,discount_amount=:discount_amount,tax_amount=:tax_amount,other_charges=:other_charges,total_amount=:total_amount,currency=:currency,exchange_rate=:exchange_rate,payment_terms=:payment_terms,payment_method=:payment_method,payment_reference=:payment_reference,payment_status=:payment_status,status=:status,notes=:notes,cost_center_id=:costCenterId WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        bill_date: b.bill_date || null,
        due_date: b.due_date || null,
        execution_id: toNumber(b.execution_id),
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        subtotal: Number(b.subtotal || 0),
        discount_amount: Number(b.discount_amount || 0),
        tax_amount: Number(b.tax_amount || 0),
        other_charges: Number(b.other_charges || 0),
        total_amount: Number(b.total_amount || 0),
        currency: b.currency || "GHS",
        exchange_rate: Number(b.exchange_rate || 1),
        payment_terms: b.payment_terms || null,
        payment_method: b.payment_method || null,
        payment_reference: b.payment_reference || null,
        payment_status: b.payment_status || "UNPAID",
        status: b.status || "DRAFT",
        notes: b.notes || null,
        costCenterId: b.cost_center_id ? toNumber(b.cost_center_id) : null,
      },
    );
    if (Array.isArray(b.lines)) {
      await query(`DELETE FROM maint_bill_lines WHERE bill_id=:id`, { id });
      for (const l of b.lines) {
        await query(`INSERT INTO maint_bill_lines (bill_id,description,category,qty,rate,discount_percent,tax_code_id,amount) VALUES (:id,:description,:category,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          {
            id,
            description: l.description || null,
            category: l.category || null,
            qty: Number(l.qty || 1),
            rate: Number(l.rate || 0),
            discount_percent: Number(l.discount_percent || 0),
            tax_code_id: toNumber(l.tax_code_id),
            amount: Number(l.amount || 0),
          },
        );
      }
    }

    if (b.status === "CANCELLED" || b.status === "REVERSED") {
      const prevRows = await query(`SELECT bill_no FROM maint_bills WHERE id=:id AND company_id=:companyId`, { id, companyId });
      const billNo = prevRows[0]?.bill_no;
      if (billNo) {
        const vRows = await query(
          `SELECT DISTINCT v.id AS voucher_id
             FROM fin_vouchers v
             JOIN fin_voucher_lines l ON l.voucher_id = v.id
            WHERE v.company_id = :companyId
              AND l.reference_no = :referenceNo`,
          { companyId, referenceNo: billNo }
        ).catch(() => []);
        const voucherIds = vRows.map((r) => Number(r.voucher_id)).filter((n) => Number.isFinite(n) && n > 0);
        if (voucherIds.length > 0) {
          const inList = voucherIds.join(",");
          await query(`DELETE FROM fin_voucher_lines WHERE voucher_id IN (${inList})`).catch(() => null);
          await query(`DELETE FROM fin_vouchers WHERE id IN (${inList})`).catch(() => null);
        }
      }
    }
    await cacheDelPattern(`maint_bills:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== SCHEDULES =====
// Fetch all scheduled maintenance tasks
export const listSchedules = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_schedules:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT m.id, m.company_id, m.branch_id, m.schedule_name, 
          m.asset_id, m.asset_name, m.frequency, m.start_date, m.end_date, m.classification, m.category, m.group_name, m.maintenance_days, m.maintenance_routine, m.assigned_to, 
          m.status, m.created_at, m.created_by, m.tasks,
          u.username AS created_by_name
         FROM maint_schedules m
        LEFT JOIN adm_users u ON u.id = m.created_by
         WHERE m.company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(m.branch_id, :branchIdsStr)) ORDER BY m.start_date ASC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_schedules:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details for a specific maintenance schedule
export const getScheduleById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_schedules
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Create a new recurring or one-off maintenance schedule
export const createSchedule = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(`INSERT INTO maint_schedules (company_id,branch_id,schedule_name,asset_id,asset_name,frequency,start_date,end_date,classification,category,group_name,maintenance_days,maintenance_routine,assigned_to,description,status,tasks,selected_assets) VALUES (:companyId,:branchId,:schedule_name,:asset_id,:asset_name,:frequency,:start_date,:end_date,:classification,:category,:group_name,:maintenance_days,:maintenance_routine,:assigned_to,:description,:status,:tasks,:selected_assets)`,
      {
        companyId,
        branchId, branchIdsStr,
        schedule_name: b.schedule_name || null,
        asset_id: toNumber(b.asset_id),
        asset_name: b.asset_name || null,
        frequency: b.frequency || null,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        classification: b.classification || null,
        category: b.category || null,
        group_name: b.group_name || null,
        maintenance_days: b.maintenance_days || null,
        maintenance_routine: b.maintenance_routine || null,
        assigned_to: b.assigned_to || null,
        description: b.description || null,
        status: b.status || "ACTIVE",
        tasks: b.tasks ? (typeof b.tasks === 'string' ? b.tasks : JSON.stringify(b.tasks)) : null,
        selected_assets: b.selected_assets ? (typeof b.selected_assets === 'string' ? b.selected_assets : JSON.stringify(b.selected_assets)) : null,
      },
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

// Update an existing maintenance schedule
export const updateSchedule = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_schedules SET schedule_name=:schedule_name,asset_id=:asset_id,asset_name=:asset_name,frequency=:frequency,start_date=:start_date,end_date=:end_date,classification=:classification,category=:category,group_name=:group_name,maintenance_days=:maintenance_days,maintenance_routine=:maintenance_routine,assigned_to=:assigned_to,description=:description,status=:status,tasks=:tasks,selected_assets=:selected_assets WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        schedule_name: b.schedule_name || null,
        asset_id: toNumber(b.asset_id),
        asset_name: b.asset_name || null,
        frequency: b.frequency || null,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        classification: b.classification || null,
        category: b.category || null,
        group_name: b.group_name || null,
        maintenance_days: b.maintenance_days || null,
        maintenance_routine: b.maintenance_routine || null,
        assigned_to: b.assigned_to || null,
        description: b.description || null,
        status: b.status || "ACTIVE",
        tasks: b.tasks ? (typeof b.tasks === 'string' ? b.tasks : JSON.stringify(b.tasks)) : null,
        selected_assets: b.selected_assets ? (typeof b.selected_assets === 'string' ? b.selected_assets : JSON.stringify(b.selected_assets)) : null,
      },
    );
    await cacheDelPattern(`maint_schedules:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== ROSTERS =====
// Fetch all maintenance staff shift rosters
export const listRosters = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_rosters:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT
          r.id,
          r.roster_name,
          r.period_start,
          r.period_end,
          r.status,
          r.employee_name,
          r.roster_date,
          r.shift,
          r.start_time,
          r.end_time,
          r.assigned_area,
          r.total_hours,
          r.schedule_id,
          r.maintenance_days,
          r.maintenance_routine,
          r.frequency,
          r.task_description,
          r.estimated_duration,
          r.created_at,
          u.username AS created_by_name,
          s.schedule_name
         FROM maint_rosters r
        LEFT JOIN adm_users u ON u.id = r.created_by
        LEFT JOIN maint_schedules s ON s.id = r.schedule_id
         WHERE r.company_id=:companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
         ORDER BY COALESCE(r.roster_date, r.period_start, r.created_at) DESC, r.id DESC
         LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_rosters:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details of a specific staff roster
export const getRosterById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_rosters
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Create a new staff shift roster
export const createRoster = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};

    if (b.start_time && b.end_time && b.start_time >= b.end_time) {
      throw httpError(400, "BAD_REQUEST", "End time must be after start time");
    }
    if (b.total_hours && b.max_work_hours && Number(b.total_hours) > Number(b.max_work_hours)) {
      throw httpError(400, "BAD_REQUEST", "Total hours exceed maximum work hours");
    }

    if (b.employee_id && b.roster_date && b.start_time && b.end_time) {
      const overlaps = await query(`SELECT id FROM maint_rosters WHERE employee_id = ? AND roster_date = ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))`, 
        [b.employee_id, b.roster_date, b.start_time, b.start_time, b.end_time, b.end_time, b.start_time, b.end_time]
      );
      if (overlaps.length > 0) throw httpError(400, "BAD_REQUEST", "Employee already has an overlapping roster for this time");

      try {
        const leaves = await query(`SELECT id FROM hr_leave_records WHERE employee_id = ? AND start_date <= ? AND end_date >= ? AND status = 'ACTIVE'`, [b.employee_id, b.roster_date, b.roster_date]);
        if (leaves.length > 0) throw httpError(400, "BAD_REQUEST", "Employee is on leave on this date");
      } catch (e) {
        if (e.status === 400) throw e;
      }
    }

    const basePayload = {
      companyId,
      branchId, branchIdsStr,
      roster_name: b.roster_name || null,
      period_start: b.period_start || null,
      period_end: b.period_end || null,
      team_members: b.team_members || null,
      shift_details: b.shift_details || null,
      status: b.status || "DRAFT",
      employee_id: b.employee_id || null,
      employee_name: b.employee_name || null,
      team: b.team || null,
      supervisor: b.supervisor || null,
      roster_date: b.roster_date || null,
      shift: b.shift || null,
      start_time: b.start_time || null,
      end_time: b.end_time || null,
      asset_classification: b.asset_classification || null,
      asset_category: b.asset_category || null,
      asset_group: b.asset_group || null,
      assigned_area: b.assigned_area || null,
      primary_asset: b.primary_asset || null,
      availability_status: b.availability_status || null,
      overtime_eligible: b.overtime_eligible ? 1 : 0,
      max_work_hours: b.max_work_hours || null,
      remarks: b.remarks || null,
      total_hours: b.total_hours || b.estimated_duration || null,
      schedule_id: b.schedule_id ? Number(b.schedule_id) : null,
      selected_assets: b.selected_assets ? (typeof b.selected_assets === 'string' ? b.selected_assets : JSON.stringify(b.selected_assets)) : null,
      frequency: b.frequency || null,
      maintenance_days: b.maintenance_days || null,
      maintenance_routine: b.maintenance_routine || null,
      task_description: b.task_description || null,
      estimated_duration: b.estimated_duration || null,
    };

    const generatedDates = generateRosterDates(
      b.period_start,
      b.period_end,
      b.maintenance_days,
      b.maintenance_routine || b.frequency,
    );

    if (generatedDates.length > 0) {
      const existing = await query(
        `SELECT roster_date
           FROM maint_rosters
          WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND schedule_id = :scheduleId
            AND roster_date BETWEEN :periodStart AND :periodEnd`,
        {
          companyId,
          branchId, branchIdsStr,
          scheduleId: basePayload.schedule_id,
          periodStart: b.period_start,
          periodEnd: b.period_end,
        },
      );

      const existingDates = new Set(
        existing.map((row) => formatIsoDate(new Date(row.roster_date))),
      );
      const datesToCreate = generatedDates.filter((date) => !existingDates.has(date));

      if (!datesToCreate.length) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Generated rosters already exist for the selected schedule and period",
        );
      }

      const ids = [];
      for (const rosterDate of datesToCreate) {
        const result = await insertRosterRecord({
          ...basePayload,
          roster_name: buildGeneratedRosterName(basePayload.roster_name, rosterDate, datesToCreate.length),
          roster_date: rosterDate,
        });
        ids.push(result.insertId);
      }
      await cacheDelPattern(`maint_rosters:company:${companyId}:*`);
      return res.status(201).json({
        ids,
        generatedCount: ids.length,
        skippedCount: generatedDates.length - ids.length,
      });
    }

    const r = await insertRosterRecord(basePayload);
    await cacheDelPattern(`maint_rosters:company:${companyId}:*`);
    res.status(201).json({ id: r.insertId, generatedCount: 1, skippedCount: 0 });
  } catch (err) {
    next(err);
  }
};

// Update an existing staff shift roster
export const updateRoster = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    if (b.start_time && b.end_time && b.start_time >= b.end_time) {
      throw httpError(400, "BAD_REQUEST", "End time must be after start time");
    }
    if (b.total_hours && b.max_work_hours && Number(b.total_hours) > Number(b.max_work_hours)) {
      throw httpError(400, "BAD_REQUEST", "Total hours exceed maximum work hours");
    }

    if (b.employee_id && b.roster_date && b.start_time && b.end_time) {
      const overlaps = await query(`SELECT id FROM maint_rosters WHERE employee_id = ? AND roster_date = ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?)) AND id != ?`, 
        [b.employee_id, b.roster_date, b.start_time, b.start_time, b.end_time, b.end_time, b.start_time, b.end_time, id]
      );
      if (overlaps.length > 0) throw httpError(400, "BAD_REQUEST", "Employee already has an overlapping roster for this time");

      try {
        const leaves = await query(`SELECT id FROM hr_leave_records WHERE employee_id = ? AND start_date <= ? AND end_date >= ? AND status = 'ACTIVE'`, [b.employee_id, b.roster_date, b.roster_date]);
        if (leaves.length > 0) throw httpError(400, "BAD_REQUEST", "Employee is on leave on this date");
      } catch (e) {
        if (e.status === 400) throw e;
      }
    }

    await query(`UPDATE maint_rosters SET roster_name=:roster_name,period_start=:period_start,period_end=:period_end,team_members=:team_members,shift_details=:shift_details,status=:status,employee_id=:employee_id,employee_name=:employee_name,team=:team,supervisor=:supervisor,roster_date=:roster_date,shift=:shift,start_time=:start_time,end_time=:end_time,asset_classification=:asset_classification,asset_category=:asset_category,asset_group=:asset_group,assigned_area=:assigned_area,primary_asset=:primary_asset,availability_status=:availability_status,overtime_eligible=:overtime_eligible,max_work_hours=:max_work_hours,remarks=:remarks,total_hours=:total_hours,schedule_id=:schedule_id,selected_assets=:selected_assets,frequency=:frequency,maintenance_days=:maintenance_days,maintenance_routine=:maintenance_routine,task_description=:task_description,estimated_duration=:estimated_duration WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        roster_name: b.roster_name || null,
        period_start: b.period_start || null,
        period_end: b.period_end || null,
        team_members: b.team_members || null,
        shift_details: b.shift_details || null,
        status: b.status || "DRAFT",
        employee_id: b.employee_id || null,
        employee_name: b.employee_name || null,
        team: b.team || null,
        supervisor: b.supervisor || null,
        roster_date: b.roster_date || null,
        shift: b.shift || null,
        start_time: b.start_time || null,
        end_time: b.end_time || null,
        asset_classification: b.asset_classification || null,
        asset_category: b.asset_category || null,
        asset_group: b.asset_group || null,
        assigned_area: b.assigned_area || null,
        primary_asset: b.primary_asset || null,
        availability_status: b.availability_status || null,
        overtime_eligible: b.overtime_eligible ? 1 : 0,
        max_work_hours: b.max_work_hours || null,
        remarks: b.remarks || null,
        total_hours: b.total_hours || b.estimated_duration || null,
        schedule_id: b.schedule_id ? Number(b.schedule_id) : null,
        selected_assets: b.selected_assets ? (typeof b.selected_assets === 'string' ? b.selected_assets : JSON.stringify(b.selected_assets)) : null,
        frequency: b.frequency || null,
        maintenance_days: b.maintenance_days || null,
        maintenance_routine: b.maintenance_routine || null,
        task_description: b.task_description || null,
        estimated_duration: b.estimated_duration || null,
      },
    );
    await cacheDelPattern(`maint_rosters:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== EQUIPMENT =====
// Fetch all maintained equipment/assets
export const listEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const cacheKey = `maint_equipment:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ items: cached });

    await ensureTables(companyId, branchId);
    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_equipment
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) ORDER BY equipment_name ASC LIMIT 500`,
      { companyId, branchId, branchIdsStr },
    );
    await cacheSet(`maint_equipment:company:${companyId}:branches:${branchIdsStr}`, items, 300);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve details of a specific piece of equipment
export const getEquipmentById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_equipment
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Register a new piece of equipment for maintenance tracking
export const createEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '', userId } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(`INSERT INTO maint_equipment (company_id,branch_id,equipment_code,equipment_name,category,location,brand,group_name,classification,manufacturer,model,serial_number,purchase_date,warranty_expiry,status,notes,created_by) VALUES (:companyId,:branchId,:equipment_code,:equipment_name,:category,:location,:brand,:group_name,:classification,:manufacturer,:model,:serial_number,:purchase_date,:warranty_expiry,:status,:notes,:created_by)`,
      {
        companyId,
        branchId, branchIdsStr,
        equipment_code: b.equipment_code || null,
        equipment_name: b.equipment_name || null,
        category: b.category || null,
        location: b.location || null,
        brand: b.brand || null,
        group_name: b.group_name || null,
        classification: b.classification || null,
        manufacturer: b.manufacturer || null,
        model: b.model || null,
        serial_number: b.serial_number || null,
        purchase_date: b.purchase_date || null,
        warranty_expiry: b.warranty_expiry || null,
        status: b.status || "ACTIVE",
        notes: b.notes || null,
        created_by: userId || null,
      },
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

// Update an existing piece of equipment's details
export const updateEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_equipment SET equipment_code=:equipment_code,equipment_name=:equipment_name,category=:category,location=:location,brand=:brand,group_name=:group_name,classification=:classification,manufacturer=:manufacturer,model=:model,serial_number=:serial_number,purchase_date=:purchase_date,warranty_expiry=:warranty_expiry,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        equipment_code: b.equipment_code || null,
        equipment_name: b.equipment_name || null,
        category: b.category || null,
        location: b.location || null,
        brand: b.brand || null,
        group_name: b.group_name || null,
        classification: b.classification || null,
        manufacturer: b.manufacturer || null,
        model: b.model || null,
        serial_number: b.serial_number || null,
        purchase_date: b.purchase_date || null,
        warranty_expiry: b.warranty_expiry || null,
        status: b.status || "ACTIVE",
        notes: b.notes || null,
      },
    );
    await cacheDelPattern(`maint_equipment:company:${companyId}:*`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== PARAMETERS/SETUP =====
// Fetch configuration parameters for the maintenance module
export const getParameters = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT param_key, param_value,
          created_at,
          u.username AS created_by_name
         FROM maint_parameters
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const params = {};
    for (const r of rows) params[r.param_key] = r.param_value;
    res.json({ params });
  } catch (err) {
    next(err);
  }
};

// Save or update configuration parameters for the maintenance module
export const saveParameters = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const { params } = req.body || {};
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        await query(`INSERT INTO maint_parameters (company_id,branch_id,param_key,param_value) VALUES (:companyId,:branchId,:k,:v) ON DUPLICATE KEY UPDATE param_value=:v`,
          { companyId, branchId, branchIdsStr, k, v: v != null ? String(v) : null },
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Get full catalog of setup/reference data (categories, priorities, etc.)
export const getSetupCatalog = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const data = await getSetupSummary(companyId, branchId, branchIdsStr);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// Create a new reference/setup item (e.g. new priority, new section)
export const createSetupItem = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const itemType = resolveSetupItemType(req.params.kind);
    const body = req.body || {};
    const itemName = cleanText(body.item_name);

    if (!itemType)
      throw httpError(400, "VALIDATION_ERROR", "Invalid setup type");
    if (!itemName)
      throw httpError(400, "VALIDATION_ERROR", "Item name is required");

    await ensureTables(companyId, branchId);
    const userId = toNumber(req.scope?.userId) || toNumber(req.user?.id) || toNumber(req.user?.sub) || null;

    const result = await query(`INSERT INTO maint_setup_items
        (company_id, branch_id, item_type, parent_id, item_name, description, email, currency_id, sort_order, is_active, created_by, updated_by)
       VALUES
        (:companyId, :branchId, :itemType, :parentId, :itemName, :description, :email, :currencyId, :sortOrder, :isActive, :userId, :userId)`,
      {
        companyId,
        branchId, branchIdsStr,
        itemType,
        itemName,
        description: body.description ? String(body.description).trim() : null,
        email: body.email ? String(body.email).slice(0, 255) : null,
        parentId: body.parent_id ? Number(body.parent_id) : null,
        currencyId: body.currency_id ? Number(body.currency_id) : null,
        sortOrder: Number(body.sort_order) || 0,
        isActive: Number(body.is_active) === 0 ? 0 : 1,
        userId,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

// Update an existing setup/reference item
export const updateSetupItem = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const itemType = resolveSetupItemType(req.params.kind);
    const id = toNumber(req.params.id);
    const body = req.body || {};
    const itemName = cleanText(body.item_name);

    if (!itemType || !id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid setup item");
    if (!itemName)
      throw httpError(400, "VALIDATION_ERROR", "Item name is required");

    const userId = toNumber(req.scope?.userId) || toNumber(req.user?.id) || toNumber(req.user?.sub) || null;
    await ensureTables(companyId, branchId);
    await query(`UPDATE maint_setup_items
       SET item_name = :itemName,
           parent_id = :parentId,
           description = :description,
           email = :email,
           currency_id = :currencyId,
           sort_order = :sortOrder,
           is_active = :isActive,
           updated_by = :userId
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND item_type = :itemType`,
      {
        id,
        companyId, branchIdsStr,
        itemType,
        itemName,
        parentId: body.parent_id ? Number(body.parent_id) : null,
        description: body.description ? String(body.description).trim() : null,
        email: body.email ? String(body.email).slice(0, 255) : null,
        currencyId: body.currency_id ? Number(body.currency_id) : null,
        sortOrder: Number(body.sort_order) || 0,
        isActive: Number(body.is_active) === 0 ? 0 : 1,
        userId,
      },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Delete a setup item and associated mapping records if applicable
export const deleteSetupItem = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const itemType = resolveSetupItemType(req.params.kind);
    const id = toNumber(req.params.id);
    if (!itemType || !id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid setup item");

    await ensureTables(companyId, branchId);
    if (itemType === "SECTION") {
      await query(`DELETE FROM maint_section_users
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND section_item_id = :id`,
        { companyId, branchId, id },
      );
    }
    await query(`DELETE FROM maint_setup_items
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND item_type = :itemType`,
      { id, companyId, branchId, branchIdsStr, itemType },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Map a user to a specific maintenance section
export const createSectionUser = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const sectionItemId = toNumber(req.body?.section_item_id);
    const userId = toNumber(req.body?.user_id);
    const assignWork = Number(req.body?.assign_work) === 1 ? 1 : 0;

    if (!sectionItemId || !userId) {
      throw httpError(400, "VALIDATION_ERROR", "Section and user are required");
    }

    await ensureTables(companyId, branchId);
    const [section] = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM maint_setup_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :sectionItemId
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND item_type = 'SECTION'
       LIMIT 1`,
      { sectionItemId, companyId, branchId, branchIdsStr },
    );
    if (!section) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid maintenance section");
    }

    const result = await query(`INSERT INTO maint_section_users
        (company_id, branch_id, section_item_id, user_id, assign_work, is_active)
       VALUES
        (:companyId, :branchId, :sectionItemId, :userId, :assignWork, 1)
       ON DUPLICATE KEY UPDATE
        assign_work = VALUES(assign_work),
        is_active = 1`,
      { companyId, branchId, branchIdsStr, sectionItemId, userId, assignWork },
    );
    res.status(201).json({ id: result.insertId || null, ok: true });
  } catch (err) {
    next(err);
  }
};

// Update a user's maintenance section mapping and permissions
export const updateSectionUser = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const sectionItemId = toNumber(req.body?.section_item_id);
    const userId = toNumber(req.body?.user_id);
    const assignWork = Number(req.body?.assign_work) === 1 ? 1 : 0;
    const isActive = Number(req.body?.is_active) === 0 ? 0 : 1;

    if (!id || !sectionItemId || !userId) {
      throw httpError(400, "VALIDATION_ERROR", "Section and user are required");
    }

    await ensureTables(companyId, branchId);
    await query(`UPDATE maint_section_users
       SET section_item_id = :sectionItemId,
           user_id = :userId,
           assign_work = :assignWork,
           is_active = :isActive
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr, sectionItemId, userId, assignWork, isActive },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Remove a user's maintenance section mapping
export const deleteSectionUser = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await ensureTables(companyId, branchId);
    await query(`DELETE FROM maint_section_users
       WHERE id = :id
         AND company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== CONTRACTS =====
// Fetch all maintenance contracts along with covered assets
export const listContracts = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT c.*, GROUP_CONCAT(a.asset_name) AS asset_names,
          c.created_at,
          u.username AS created_by_name
         FROM maint_contracts c LEFT JOIN maint_contract_assets a ON a.contract_id=c.id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(c.branch_id, :branchIdsStr)) GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Retrieve a specific maintenance contract and its covered assets
export const getContractById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_contracts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const assets = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_contract_assets
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE contract_id=:id`,
      { id },
    );
    res.json({ item: rows[0], assets });
  } catch (err) {
    next(err);
  }
};

// Register a new maintenance contract and link to covered assets
export const createContract = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT contract_no AS no,
          created_at,
          u.username AS created_by_name
         FROM maint_contracts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
    );
    const contract_no = b.contract_no || nextNo("MCT", existing);
    const r = await query(`INSERT INTO maint_contracts (company_id,branch_id,contract_no,supplier_id,supplier_name,start_date,end_date,contract_value,scope,payment_terms,renewal_alert_days,status,notes,contract_file_url,contract_file_name) VALUES (:companyId,:branchId,:contract_no,:supplier_id,:supplier_name,:start_date,:end_date,:contract_value,:scope,:payment_terms,:renewal_alert_days,:status,:notes,:contract_file_url,:contract_file_name)`,
      {
        companyId,
        branchId, branchIdsStr,
        contract_no,
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        contract_value: Number(b.contract_value || 0),
        scope: b.scope || null,
        payment_terms: b.payment_terms || null,
        renewal_alert_days: toNumber(b.renewal_alert_days) || 30,
        status: b.status || "ACTIVE",
        notes: b.notes || null,
        contract_file_url: b.contract_file_url || null,
        contract_file_name: b.contract_file_name || null,
      },
    );
    const cId = r.insertId;
    if (Array.isArray(b.assets)) {
      for (const a of b.assets) {
        await query(`INSERT INTO maint_contract_assets (contract_id,asset_id,asset_name) VALUES (:cId,:asset_id,:asset_name)`,
          {
            cId,
            asset_id: toNumber(a.asset_id),
            asset_name: a.asset_name || null,
          },
        );
      }
    }
    res.status(201).json({ id: cId, contract_no });
  } catch (err) {
    next(err);
  }
};

// Update a maintenance contract and explicitly replace all covered assets
export const updateContract = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_contracts SET supplier_id=:supplier_id,supplier_name=:supplier_name,start_date=:start_date,end_date=:end_date,contract_value=:contract_value,scope=:scope,payment_terms=:payment_terms,renewal_alert_days=:renewal_alert_days,status=:status,notes=:notes,contract_file_url=:contract_file_url,contract_file_name=:contract_file_name WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        supplier_id: toNumber(b.supplier_id),
        supplier_name: b.supplier_name || null,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        contract_value: Number(b.contract_value || 0),
        scope: b.scope || null,
        payment_terms: b.payment_terms || null,
        renewal_alert_days: toNumber(b.renewal_alert_days) || 30,
        status: b.status || "ACTIVE",
        notes: b.notes || null,
        contract_file_url: b.contract_file_url || null,
        contract_file_name: b.contract_file_name || null,
      },
    );
    if (Array.isArray(b.assets)) {
      await query(`DELETE FROM maint_contract_assets WHERE contract_id=:id`, {
        id,
      });
      for (const a of b.assets) {
        await query(`INSERT INTO maint_contract_assets (contract_id,asset_id,asset_name) VALUES (:id,:asset_id,:asset_name)`,
          {
            id,
            asset_id: toNumber(a.asset_id),
            asset_name: a.asset_name || null,
          },
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== DASHBOARD STATS =====

// Gather high-level stats (e.g., pending requests, active jobs) for the dashboard
export const getMaintenanceStats = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);

    const [requests] = await query(
      "SELECT COUNT(*) as count FROM maint_requests WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'DRAFT'",
      { companyId, branchId, branchIdsStr }
    );
    const [activeJobs] = await query(
      "SELECT COUNT(*) as count FROM maint_job_orders WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'IN_PROGRESS'",
      { companyId, branchId, branchIdsStr }
    );
    const [assets] = await query(
      "SELECT COUNT(*) as count FROM maint_assets WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'ACTIVE'",
      { companyId, branchId, branchIdsStr }
    );
    const [overduePm] = await query(
      "SELECT COUNT(*) as count FROM maint_schedules WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND next_due_date < CURDATE() AND status = 'ACTIVE'",
      { companyId, branchId, branchIdsStr }
    );

    res.json({
      openRequests: requests.count,
      activeJobs: activeJobs.count,
      totalAssets: assets.count,
      overduePm: overduePm.count,
      assetHealth: 98 // Placeholder for logic
    });
  } catch (err) {
    next(err);
  }
};

// ===== ASSET METERS =====

// Fetch history of meter readings for an asset
export const listAssetMeters = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { asset_id } = req.query;
    await ensureTables(companyId, branchId);
    const items = await query(
      "SELECT * FROM maint_asset_meters WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) " +
      (asset_id ? "AND asset_id = :asset_id " : "") +
      "ORDER BY reading_date DESC, id DESC",
      { companyId, branchId, branchIdsStr, asset_id }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Log a new meter reading for an asset
export const createAssetMeter = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const userId = req.user?.id;
    await ensureTables(companyId, branchId);
    const { asset_id, reading_date, reading_value, uom } = req.body;
    
    const r = await query(
      "INSERT INTO maint_asset_meters (company_id, branch_id, asset_id, reading_date, reading_value, uom, recorded_by) VALUES (:companyId, :branchId, :asset_id, :reading_date, :reading_value, :uom, :userId)",
      { companyId, branchId, branchIdsStr, asset_id, reading_date, reading_value, uom, userId }
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

// ===== DOWNTIME LOGS =====

// Fetch logs of recorded downtime events for assets
export const listDowntimeLogs = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { asset_id } = req.query;
    await ensureTables(companyId, branchId);
    const items = await query(
      "SELECT dl.*, a.asset_name FROM maint_downtime_logs dl " +
      "JOIN maint_assets a ON dl.asset_id = a.id " +
      "WHERE dl.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(dl.branch_id, :branchIdsStr)) " +
      (asset_id ? "AND dl.asset_id = :asset_id " : "") +
      "ORDER BY dl.start_time DESC",
      { companyId, branchId, branchIdsStr, asset_id }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Record a new downtime incident for an asset
export const createDowntimeLog = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const userId = req.user?.id;
    await ensureTables(companyId, branchId);
    const { asset_id, start_time, end_time, reason, category, impact_level } = req.body;
    
    const r = await query(
      "INSERT INTO maint_downtime_logs (company_id, branch_id, asset_id, start_time, end_time, reason, category, impact_level, recorded_by) VALUES (:companyId, :branchId, :asset_id, :start_time, :end_time, :reason, :category, :impact_level, :userId)",
      { companyId, branchId, branchIdsStr, asset_id, start_time, end_time, reason, category, impact_level, userId }
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

// ===== REPORTS =====

// Generate an aggregated report summarizing total and average asset downtime
export const getDowntimeReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { start_date, end_date } = req.query;

    const data = await query(
      `SELECT 
        a.asset_name, 
        a.asset_no,
        COUNT(dl.id) as total_incidents,
        SUM(TIMESTAMPDIFF(MINUTE, dl.start_time, COALESCE(dl.end_time, NOW()))) as total_downtime_mins,
        AVG(TIMESTAMPDIFF(MINUTE, dl.start_time, COALESCE(dl.end_time, NOW()))) as avg_downtime_mins
       FROM maint_assets a
       LEFT JOIN maint_downtime_logs dl ON a.id = dl.asset_id
       WHERE a.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(a.branch_id, :branchIdsStr))
       ${start_date && end_date ? 'AND dl.start_time BETWEEN :start_date AND :end_date' : ''}
       GROUP BY a.id`,
      { companyId, branchId, branchIdsStr, start_date, end_date }
    );

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MAINTENANCE MATERIAL REQUISITIONS
// ============================================================

// Setup routine to ensure material requisition tables exist
async function ensureMaintMaterialRequisitionTables() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await query(`CREATE TABLE IF NOT EXISTS maint_material_requisitions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    requisition_no VARCHAR(50) NOT NULL,
    requisition_date DATE NOT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    department_id BIGINT UNSIGNED DEFAULT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    requested_by VARCHAR(255) DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maint_mr_scope_no (company_id, branch_id, requisition_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_material_requisition_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requisition_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    qty_requested DECIMAL(18,3) NOT NULL DEFAULT 0,
    qty_received DECIMAL(18,3) NOT NULL DEFAULT 0,
    uom VARCHAR(20) DEFAULT 'PCS',
    batch_no VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_maint_mri_req (requisition_id),
    CONSTRAINT fk_maint_mri_req FOREIGN KEY (requisition_id) REFERENCES maint_material_requisitions (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  try { await query(`ALTER TABLE maint_material_requisitions ADD COLUMN IF NOT EXISTS is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'`); } catch (e) {}
  try { await query(`ALTER TABLE maint_material_requisitions ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL`); } catch (e) {}
}

// Generate the next sequential number for Material Requisitions
async function nextMaintMRNo(companyId, branchId) {
  const rows = await query(`SELECT requisition_no FROM maint_material_requisitions WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND requisition_no LIKE 'MMR-%' ORDER BY CAST(SUBSTRING(requisition_no, 5) AS UNSIGNED) DESC LIMIT 1`, { companyId, branchId });
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].requisition_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MMR-${String(nextNum).padStart(6, "0")}`;
}

// Fetch next material requisition number
export const getNextMaintMRNo = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureMaintMaterialRequisitionTables();
    const nextNo = await nextMaintMRNo(companyId, branchId);
    res.json({ nextNo });
  } catch (err) { next(err); }
};

// Fetch list of all active maintenance material requisitions
export const listMaintMaterialRequisitions = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureMaintMaterialRequisitionTables();
    const rows = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM maint_material_requisitions r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) AND COALESCE(r.is_active,'Y') = 'Y'
      ORDER BY r.created_at DESC`, { companyId, branchId, branchIdsStr });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

// Retrieve details for a specific maintenance material requisition
export const getMaintMaterialRequisitionById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureMaintMaterialRequisitionTables();
    const [hdr] = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM maint_material_requisitions r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.id = :id LIMIT 1`, { id });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Material requisition not found");
    const details = await query(`SELECT d.*, i.item_code, i.item_name FROM maint_material_requisition_items d LEFT JOIN inv_items i ON d.item_id = i.id WHERE d.requisition_id = :id ORDER BY d.id`, { id });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

// Record a new maintenance material requisition using transactions
export const createMaintMaterialRequisition = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureMaintMaterialRequisitionTables();
    const b = req.body || {};
    const reqNo = b.requisition_no || await nextMaintMRNo(companyId, branchId);
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(`INSERT INTO maint_material_requisitions (company_id, branch_id, requisition_no, requisition_date, warehouse_id, department_id, priority, requested_by, remarks, status, created_by)
      VALUES (:companyId, :branchId, :reqNo, :reqDate, :warehouseId, :departmentId, :priority, :requestedBy, :remarks, :status, :createdBy)`, {
      companyId, branchId, branchIdsStr, reqNo,
      reqDate: b.requisition_date || new Date().toISOString().split('T')[0],
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      priority: b.priority || 'MEDIUM',
      requestedBy: b.requested_by || null,
      remarks: b.remarks || null,
      status: b.status || 'DRAFT',
      createdBy: req.user?.sub || null
    });
    const reqId = hdr.insertId;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId || !Number(d.qty_requested)) continue;
      await conn.execute(`INSERT INTO maint_material_requisition_items (requisition_id, item_id, qty_requested, qty_received, uom, batch_no) VALUES (:reqId, :itemId, :qtyReq, :qtyRecv, :uom, :batchNo)`, {
        reqId, itemId,
        qtyReq: Number(d.qty_requested) || 0,
        qtyRecv: Number(d.qty_received || 0),
        uom: d.uom || 'PCS',
        batchNo: d.batch_no || null
      });
    }
    await conn.commit();
    res.status(201).json({ id: reqId, requisition_no: reqNo });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

// Update a material requisition (or cancel it) inside a transaction
export const updateMaintMaterialRequisition = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureMaintMaterialRequisitionTables();
    const b = req.body || {};
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    await conn.execute(`UPDATE maint_material_requisitions SET requisition_date = :reqDate, warehouse_id = :warehouseId, department_id = :departmentId, priority = :priority, requested_by = :requestedBy, remarks = :remarks, status = :status WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`, {
      id, companyId, branchId, branchIdsStr,
      reqDate: b.requisition_date || null,
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      priority: b.priority || 'MEDIUM',
      requestedBy: b.requested_by || null,
      remarks: b.remarks || null,
      status: b.status || 'DRAFT'
    });
    if (b.status === 'CANCELLED') {
      await conn.execute(`UPDATE maint_material_requisitions SET is_active = 'N', deleted_at = NOW() WHERE id = :id`, { id });
    }
    await conn.execute(`DELETE FROM maint_material_requisition_items WHERE requisition_id = :id`, { id });
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId || !Number(d.qty_requested)) continue;
      await conn.execute(`INSERT INTO maint_material_requisition_items (requisition_id, item_id, qty_requested, qty_received, uom, batch_no) VALUES (:id, :itemId, :qtyReq, :qtyRecv, :uom, :batchNo)`, {
        id, itemId,
        qtyReq: Number(d.qty_requested) || 0,
        qtyRecv: Number(d.qty_received || 0),
        uom: d.uom || 'PCS',
        batchNo: d.batch_no || null
      });
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

// Push a material requisition from DRAFT to an approval workflow if applicable
export const submitMaintMaterialRequisition = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`UPDATE maint_material_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`, { id, companyId });
    const wfByRoute = await query(`SELECT * FROM adm_workflows WHERE company_id = :companyId AND document_route = '/maintenance/material-requisitions' ORDER BY id ASC`, { companyId });
    const wfDefs = await query(`SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_type = 'MAINT_MATERIAL_REQUISITION' OR document_type = 'MAINT Material Requisition') ORDER BY id ASC`, { companyId });
    let activeWf = null;
    for (const list of [wfByRoute, wfDefs]) {
      for (const wf of list) {
        if (Number(wf.is_active) !== 1) continue;
        activeWf = wf; break;
      } if (activeWf) break;
    }
    if (!activeWf) {
      await query(`UPDATE maint_material_requisitions SET status = 'APPROVED' WHERE id = :id`, { id });
      return res.json({ status: 'APPROVED' });
    }
    const [firstStep] = await query(`SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`, { wf: activeWf.id });
    if (!firstStep || !firstStep.approver_user_id) {
      await query(`UPDATE maint_material_requisitions SET status = 'APPROVED' WHERE id = :id`, { id });
      return res.json({ status: 'APPROVED' });
    }
    await query(`INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
      VALUES (:companyId, :wfId, :docId, 'MAINT_MATERIAL_REQUISITION', :stepOrder, 'PENDING', :assignedTo)`, {
      companyId, wfId: activeWf.id, docId: id, stepOrder: firstStep.step_order, assignedTo: firstStep.approver_user_id
    });
    await query(`INSERT INTO adm_workflow_tasks (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
      VALUES (:companyId, :wfId, LAST_INSERT_ID(), :docId, 'MAINT_MATERIAL_REQUISITION', :stepOrder, :assignedTo, 'PENDING')`, {
      companyId, wfId: activeWf.id, docId: id, stepOrder: firstStep.step_order, assignedTo: firstStep.approver_user_id
    });
    res.json({ status: 'PENDING_APPROVAL' });
  } catch (err) { next(err); }
};

// ===== MAINTENANCE MATERIAL RECEIPT TABLES =====
async function ensureMaintMaterialReceiptTables(companyId, branchId) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await query(`CREATE TABLE IF NOT EXISTS maint_material_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    receipt_no VARCHAR(50) NOT NULL,
    receipt_date DATE NOT NULL,
    issue_id BIGINT UNSIGNED DEFAULT NULL,
    source_doc VARCHAR(50) DEFAULT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    department_id BIGINT UNSIGNED DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maint_mrcpt_scope_no (company_id, branch_id, receipt_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_material_receipt_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    uom VARCHAR(20) DEFAULT 'PCS',
    transfer_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    receipt_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    batch_no VARCHAR(100) DEFAULT NULL,
    expiry_date DATE DEFAULT NULL,
    mfg_date DATE DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_maint_mrcpt_i_rcpt (receipt_id),
    CONSTRAINT fk_maint_mrcpt_i_rcpt FOREIGN KEY (receipt_id) REFERENCES maint_material_receipts (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function nextMaintRcptNo(companyId, branchId) {
  const rows = await query(`SELECT receipt_no FROM maint_material_receipts WHERE company_id = :companyId AND branch_id = :branchId AND receipt_no LIKE 'RCPT-%' ORDER BY CAST(SUBSTRING(receipt_no, 6) AS UNSIGNED) DESC LIMIT 1`, { companyId, branchId });
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(5);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RCPT-${String(nextNum).padStart(6, "0")}`;
}

export const listMaintMaterialReceipts = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureMaintMaterialReceiptTables(companyId, branchId);
    const rows = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM maint_material_receipts r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.company_id = :companyId AND r.branch_id = :branchId
      ORDER BY r.created_at DESC`, { companyId, branchId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getMaintMaterialReceiptById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureMaintMaterialReceiptTables(companyId, branchId);
    const [hdr] = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM maint_material_receipts r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.id = :id LIMIT 1`, { id });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Materials receipt not found");
    const details = await query(`SELECT d.* FROM maint_material_receipt_items d WHERE d.receipt_id = :id ORDER BY d.id`, { id });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

export const createMaintMaterialReceipt = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId, branchIdsStr = '' } = req.scope;
    await ensureMaintMaterialReceiptTables(companyId, branchId);
    const b = req.body || {};
    const rcptNo = b.receipt_no || await nextMaintRcptNo(companyId, branchId);
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(`INSERT INTO maint_material_receipts (company_id, branch_id, receipt_no, receipt_date, issue_id, source_doc, warehouse_id, department_id, remarks, status, created_by)
      VALUES (:companyId, :branchId, :rcptNo, :rcptDate, :issueId, :sourceDoc, :warehouseId, :departmentId, :remarks, :status, :createdBy)`, {
      companyId, branchId, rcptNo,
      rcptDate: b.receipt_date || new Date().toISOString().split('T')[0],
      issueId: toNumber(b.issue_id),
      sourceDoc: b.source_doc || null,
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      remarks: b.remarks || null,
      status: b.status || 'DRAFT',
      createdBy: req.user?.sub || null
    });
    const rcptId = hdr.insertId;
    const warehouseId = toNumber(b.warehouse_id);
    const userId = req.user?.sub || null;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      const receiptQty = Number(d.receipt_qty || 0);
      await conn.execute(`INSERT INTO maint_material_receipt_items (receipt_id, item_id, item_name, uom, transfer_qty, receipt_qty, batch_no, expiry_date, mfg_date) VALUES (:rcptId, :itemId, :itemName, :uom, :transferQty, :receiptQty, :batchNo, :expiryDate, :mfgDate)`, {
        rcptId, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        transferQty: Number(d.transfer_qty || 0),
        receiptQty,
        batchNo: d.batch_no || null,
        expiryDate: d.expiry_date || null,
        mfgDate: d.mfg_date || null
      });
      if ((b.status || 'DRAFT') === 'POSTED' && receiptQty > 0 && warehouseId) {
        await recordMovementTx(conn, {
          companyId, branchId, branchIdsStr,
          warehouseId,
          itemId,
          transactionType: 'MATERIAL_RECEIPT',
          qtyChange: receiptQty,
          batchNo: d.batch_no || null,
          expiryDate: d.expiry_date || null,
          sourceRef: rcptNo,
          createdBy: userId,
          sourceType: 'MAINT_MATERIAL_RECEIPT',
          sourceId: rcptId,
        });
      }
    }
    await conn.commit();
    res.status(201).json({ id: rcptId, receipt_no: rcptNo });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const updateMaintMaterialReceipt = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId, branchIdsStr = '' } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureMaintMaterialReceiptTables(companyId, branchId);
    const b = req.body || {};
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [oldHdr] = await conn.execute(`SELECT warehouse_id, status, issue_id FROM maint_material_receipts WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    const oldItems = await conn.execute(`SELECT item_id, receipt_qty, batch_no, expiry_date FROM maint_material_receipt_items WHERE receipt_id = :id`, { id });
    if (oldHdr.length) {
      const old = oldHdr[0];
      if (['POSTED', 'APPROVED'].includes(old.status) && old.warehouse_id) {
        for (const oi of oldItems) {
          const oldQty = Number(oi.receipt_qty || 0);
          if (oldQty > 0) {
            await recordMovementTx(conn, {
              companyId, branchId, branchIdsStr,
              warehouseId: Number(old.warehouse_id),
              itemId: Number(oi.item_id),
              transactionType: 'MATERIAL_RECEIPT_ADJUSTMENT',
              qtyChange: -oldQty,
              batchNo: oi.batch_no || null,
              expiryDate: oi.expiry_date || null,
              sourceRef: `REVERSAL-${id}`,
              createdBy: req.user?.sub || null,
              sourceType: 'MAINT_MATERIAL_RECEIPT',
              sourceId: id,
            });
          }
        }
      }
    }
    await conn.execute(`UPDATE maint_material_receipts SET receipt_date = :rcptDate, issue_id = :issueId, source_doc = :sourceDoc, warehouse_id = :warehouseId, department_id = :departmentId, remarks = :remarks, status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, {
      id, companyId, branchId,
      rcptDate: b.receipt_date || null,
      issueId: toNumber(b.issue_id),
      sourceDoc: b.source_doc || null,
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      remarks: b.remarks || null,
      status: b.status || 'DRAFT'
    });
    await conn.execute(`DELETE FROM maint_material_receipt_items WHERE receipt_id = :id`, { id });
    const warehouseId = toNumber(b.warehouse_id);
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      const receiptQty = Number(d.receipt_qty || 0);
      await conn.execute(`INSERT INTO maint_material_receipt_items (receipt_id, item_id, item_name, uom, transfer_qty, receipt_qty, batch_no, expiry_date, mfg_date) VALUES (:id, :itemId, :itemName, :uom, :transferQty, :receiptQty, :batchNo, :expiryDate, :mfgDate)`, {
        id, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        transferQty: Number(d.transfer_qty || 0),
        receiptQty,
        batchNo: d.batch_no || null,
        expiryDate: d.expiry_date || null,
        mfgDate: d.mfg_date || null
      });
      if ((b.status || 'DRAFT') === 'POSTED' && receiptQty > 0 && warehouseId) {
        await recordMovementTx(conn, {
          companyId, branchId, branchIdsStr,
          warehouseId,
          itemId,
          transactionType: 'MATERIAL_RECEIPT',
          qtyChange: receiptQty,
          batchNo: d.batch_no || null,
          expiryDate: d.expiry_date || null,
          sourceRef: `RCPT-${id}`,
          createdBy: req.user?.sub || null,
          sourceType: 'MAINT_MATERIAL_RECEIPT',
          sourceId: id,
        });
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const getPendingMaintIssueToRequirement = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const departmentId = req.query.department_id ? toNumber(req.query.department_id) : null;
    await ensureMaintMaterialReceiptTables(companyId, branchId);

    let sql = `SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.department_id, i.issued_to, i.status, i.remarks,
      w.warehouse_name, d.name AS department_name
      FROM inv_issue_to_requirement i
      LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN adm_departments d ON i.department_id = d.id
      WHERE i.company_id = :companyId AND i.branch_id = :branchId
      AND i.status IN ('POSTED', 'ISSUED')
      AND (i.requisition_source = 'maintenance' OR i.issue_type = 'MAINTENANCE')
      AND i.id NOT IN (SELECT issue_id FROM maint_material_receipts WHERE issue_id IS NOT NULL)`;

    const params = { companyId, branchId };

    if (departmentId) {
      sql += ` AND i.department_id = :departmentId`;
      params.departmentId = departmentId;
    }

    sql += ` ORDER BY i.issue_date DESC`;

    const rows = await query(sql, params);
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getMaintIssueToRequirementDetail = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const issueId = toNumber(req.params.issueId);
    if (!issueId) throw httpError(400, "VALIDATION_ERROR", "Invalid issue id");
    const [hdr] = await query(`SELECT i.*, w.warehouse_name, d.name AS department_name
      FROM inv_issue_to_requirement i
      LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN adm_departments d ON i.department_id = d.id
      WHERE i.id = :issueId AND i.company_id = :companyId AND i.branch_id = :branchId LIMIT 1`, { issueId, companyId, branchId });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Issue not found");
    const details = await query(`SELECT d.*, i.item_code, i.item_name, i.uom, sb.qty AS stock_qty
      FROM inv_issue_to_requirement_details d
      LEFT JOIN inv_items i ON d.item_id = i.id
      LEFT JOIN (SELECT item_id, SUM(qty) AS qty FROM inv_stock_balances WHERE company_id = :companyId GROUP BY item_id) sb ON sb.item_id = d.item_id
      WHERE d.issue_id = :issueId ORDER BY d.id`, { issueId, companyId });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};



export const sendRFQEmail = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR", "Invalid RFQ ID");

    // 1. Get RFQ details
    const [rfq] = await query(`SELECT * FROM maint_rfqs WHERE id = :id AND company_id = :companyId`, { id, companyId });
    if (!rfq) throw httpError(404, "NOT_FOUND", "RFQ not found");

    // 2. Get invited suppliers
    const suppliers = await query(`SELECT supplier_name FROM maint_rfq_suppliers WHERE rfq_id = :id`, { id });
    if (!suppliers.length) throw httpError(400, "BAD_REQUEST", "No suppliers invited to this RFQ");

    const names = suppliers.map(s => s.supplier_name);

    // 3. Match with setup items
    const setupItems = await query(
      `SELECT item_name, email FROM maint_setup_items WHERE company_id = :companyId AND item_type = 'SERVICE_PROVIDER' AND item_name IN (:names)`,
      { companyId, names }
    );

    const emails = setupItems.filter(s => s.email).map(s => s.email);
    if (!emails.length) {
      throw httpError(400, "BAD_REQUEST", "None of the selected suppliers have an email configured in Setup > Service Providers");
    }

    // 4. Send email
    await sendMail({
      to: emails.join(','),
      subject: `Maintenance RFQ: ${rfq.rfq_no}`,
      text: `Dear Service Provider,\n\nPlease find the details for RFQ ${rfq.rfq_no}.\n\nScope of Work:\n${rfq.scope_of_work}\n\nResponse Deadline: ${rfq.response_deadline || 'N/A'}\n\nBest Regards.`,
      html: `<p>Dear Service Provider,</p><p>Please find the details for RFQ <b>${rfq.rfq_no}</b>.</p><p><b>Scope of Work:</b><br/>${String(rfq.scope_of_work).replace(/\n/g, '<br/>')}</p><p><b>Response Deadline:</b> ${rfq.response_deadline || 'N/A'}</p><p>Best Regards.</p>`,
    });

    res.json({ ok: true, message: "Emails sent successfully to: " + emails.join(', ') });
  } catch (err) {
    next(err);
  }
};

export const sendJobOrderNotification = async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = Number(req.params.id);
    const { type } = req.body;
    
    if (!Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    if (!["email", "sms", "whatsapp", "all"].includes(type)) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid notification type");
    }

    const { sendExternalNotification } = await import("../utils/externalNotification.js");

    const [order] = await query(
      `SELECT o.id, o.job_order_no, o.description,
              s.item_name AS service_provider, s.email AS provider_email, s.phone AS provider_phone
       FROM maint_job_orders o
       LEFT JOIN maint_setup_items s ON (s.id = o.assigned_to_id AND s.item_type = 'SERVICE_PROVIDER')
       WHERE o.id = :id AND o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );

    if (!order) throw httpError(404, "NOT_FOUND", "Job Order not found");

    const subject = `Job Order ${order.job_order_no} from OmniSuite`;
    const text = `Dear ${order.service_provider || 'Service Provider'},\n\nPlease find the details regarding Job Order ${order.job_order_no}: ${order.description}\n\nThank you!`;
    const html = `<p>Dear ${order.service_provider || 'Service Provider'},</p><p>Please find the details regarding Job Order <strong>${order.job_order_no}</strong>: ${order.description}</p><p>Thank you!</p>`;

    const results = await sendExternalNotification({
      type,
      recipientEmail: order.provider_email,
      recipientPhone: order.provider_phone, // assuming phone exists in setup_items, else it will be null and skip
      subject,
      text,
      html
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
};

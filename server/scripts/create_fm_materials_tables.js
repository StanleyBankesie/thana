import { query } from "../db/pool.js";

async function createFmTables() {
  console.log("Creating FM execution and materials tables...");

  const queries = [
    `CREATE TABLE IF NOT EXISTS \`fm_tasks\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`company_id\` bigint(20) unsigned NOT NULL,
      \`branch_id\` bigint(20) unsigned NOT NULL,
      \`task_no\` varchar(50) NOT NULL,
      \`property_id\` bigint(20) unsigned DEFAULT NULL,
      \`property_name\` varchar(255) DEFAULT NULL,
      \`building_zone\` varchar(150) DEFAULT NULL,
      \`service_category\` varchar(100) DEFAULT NULL,
      \`work_order_no\` varchar(50) DEFAULT NULL,
      \`ticket_id\` bigint(20) unsigned DEFAULT NULL,
      \`task_title\` varchar(255) NOT NULL,
      \`task_description\` text DEFAULT NULL,
      \`assigned_to_id\` bigint(20) unsigned DEFAULT NULL,
      \`assigned_to_name\` varchar(200) DEFAULT NULL,
      \`supervisor_name\` varchar(200) DEFAULT NULL,
      \`priority\` varchar(50) DEFAULT 'MEDIUM',
      \`status\` varchar(50) DEFAULT 'PENDING',
      \`start_date\` date DEFAULT NULL,
      \`end_date\` date DEFAULT NULL,
      \`estimated_hours\` decimal(10,2) DEFAULT 0.00,
      \`actual_hours\` decimal(10,2) DEFAULT 0.00,
      \`completion_percent\` decimal(5,2) DEFAULT 0.00,
      \`reason_for_delay\` text DEFAULT NULL,
      \`checklist_data\` longtext DEFAULT NULL,
      \`due_status\` varchar(50) DEFAULT 'ON_SCHEDULE',
      \`is_active\` enum('Y','N') NOT NULL DEFAULT 'Y',
      \`created_by\` bigint(20) unsigned DEFAULT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_fm_task_scope_no\` (\`company_id\`, \`branch_id\`, \`task_no\`),
      KEY \`idx_fm_tasks_prop\` (\`property_id\`),
      KEY \`idx_fm_tasks_status\` (\`status\`),
      KEY \`idx_fm_tasks_assignee\` (\`assigned_to_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_purchase_requisitions\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`company_id\` bigint(20) unsigned NOT NULL,
      \`branch_id\` bigint(20) unsigned NOT NULL,
      \`requisition_no\` varchar(50) NOT NULL,
      \`requisition_date\` date NOT NULL,
      \`property_id\` bigint(20) unsigned DEFAULT NULL,
      \`property_name\` varchar(255) DEFAULT NULL,
      \`contract_id\` bigint(20) unsigned DEFAULT NULL,
      \`task_id\` bigint(20) unsigned DEFAULT NULL,
      \`work_order_ref\` varchar(100) DEFAULT NULL,
      \`department\` varchar(100) DEFAULT 'Facilities Management',
      \`requested_by\` varchar(150) DEFAULT NULL,
      \`purpose\` text DEFAULT NULL,
      \`priority\` enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
      \`required_date\` date DEFAULT NULL,
      \`status\` varchar(32) NOT NULL DEFAULT 'DRAFT',
      \`remarks\` text DEFAULT NULL,
      \`timeline\` varchar(255) DEFAULT NULL,
      \`is_active\` enum('Y','N') NOT NULL DEFAULT 'Y',
      \`created_by\` bigint(20) unsigned DEFAULT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_fm_pr_scope_no\` (\`company_id\`, \`branch_id\`, \`requisition_no\`),
      KEY \`idx_fm_pr_prop\` (\`property_id\`),
      KEY \`idx_fm_pr_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_purchase_requisition_items\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`requisition_id\` bigint(20) unsigned NOT NULL,
      \`item_id\` bigint(20) unsigned DEFAULT NULL,
      \`description\` varchar(255) NOT NULL,
      \`qty\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`uom\` varchar(20) DEFAULT 'PCS',
      \`estimated_unit_cost\` decimal(18,2) NOT NULL DEFAULT 0.00,
      \`estimated_total\` decimal(18,2) NOT NULL DEFAULT 0.00,
      \`remarks\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_fm_pri_req\` (\`requisition_id\`),
      CONSTRAINT \`fk_fm_pri_req\` FOREIGN KEY (\`requisition_id\`) REFERENCES \`fm_purchase_requisitions\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_requisitions\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`company_id\` bigint(20) unsigned NOT NULL,
      \`branch_id\` bigint(20) unsigned NOT NULL,
      \`requisition_no\` varchar(50) NOT NULL,
      \`requisition_date\` date NOT NULL,
      \`property_id\` bigint(20) unsigned DEFAULT NULL,
      \`property_name\` varchar(255) DEFAULT NULL,
      \`task_id\` bigint(20) unsigned DEFAULT NULL,
      \`task_name\` varchar(255) DEFAULT NULL,
      \`warehouse_id\` bigint(20) unsigned DEFAULT NULL,
      \`department_id\` bigint(20) unsigned DEFAULT NULL,
      \`priority\` varchar(20) DEFAULT 'MEDIUM',
      \`requested_by\` varchar(255) DEFAULT NULL,
      \`remarks\` text DEFAULT NULL,
      \`status\` varchar(30) DEFAULT 'DRAFT',
      \`is_active\` enum('Y','N') NOT NULL DEFAULT 'Y',
      \`created_by\` bigint(20) unsigned DEFAULT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_fm_mr_scope_no\` (\`company_id\`, \`branch_id\`, \`requisition_no\`),
      KEY \`idx_fm_mr_prop\` (\`property_id\`),
      KEY \`idx_fm_mr_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_requisition_items\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`requisition_id\` bigint(20) unsigned NOT NULL,
      \`item_id\` bigint(20) unsigned NOT NULL,
      \`qty_requested\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`qty_received\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`uom\` varchar(20) DEFAULT 'PCS',
      \`batch_no\` varchar(100) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_fm_mri_req\` (\`requisition_id\`),
      CONSTRAINT \`fk_fm_mri_req\` FOREIGN KEY (\`requisition_id\`) REFERENCES \`fm_material_requisitions\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_receipts\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`company_id\` bigint(20) unsigned NOT NULL,
      \`branch_id\` bigint(20) unsigned NOT NULL,
      \`receipt_no\` varchar(50) NOT NULL,
      \`receipt_date\` date NOT NULL,
      \`property_id\` bigint(20) unsigned DEFAULT NULL,
      \`property_name\` varchar(255) DEFAULT NULL,
      \`issue_id\` bigint(20) unsigned DEFAULT NULL,
      \`source_doc\` varchar(50) DEFAULT NULL,
      \`warehouse_id\` bigint(20) unsigned DEFAULT NULL,
      \`department_id\` bigint(20) unsigned DEFAULT NULL,
      \`remarks\` text DEFAULT NULL,
      \`status\` varchar(30) DEFAULT 'DRAFT',
      \`created_by\` bigint(20) unsigned DEFAULT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_fm_rcpt_scope_no\` (\`company_id\`, \`branch_id\`, \`receipt_no\`),
      KEY \`idx_fm_rcpt_prop\` (\`property_id\`),
      KEY \`idx_fm_rcpt_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_receipt_items\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`receipt_id\` bigint(20) unsigned NOT NULL,
      \`item_id\` bigint(20) unsigned NOT NULL,
      \`item_name\` varchar(255) DEFAULT NULL,
      \`uom\` varchar(20) DEFAULT 'PCS',
      \`transfer_qty\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`receipt_qty\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`batch_no\` varchar(100) DEFAULT NULL,
      \`expiry_date\` date DEFAULT NULL,
      \`mfg_date\` date DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_fm_mrcpt_i_rcpt\` (\`receipt_id\`),
      CONSTRAINT \`fk_fm_mrcpt_i_rcpt\` FOREIGN KEY (\`receipt_id\`) REFERENCES \`fm_material_receipts\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_utilization\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`company_id\` bigint(20) unsigned NOT NULL,
      \`branch_id\` bigint(20) unsigned NOT NULL,
      \`utilization_no\` varchar(50) NOT NULL,
      \`utilization_date\` date NOT NULL,
      \`property_id\` bigint(20) unsigned DEFAULT NULL,
      \`property_name\` varchar(255) DEFAULT NULL,
      \`task_id\` bigint(20) unsigned DEFAULT NULL,
      \`task_summary\` varchar(500) DEFAULT NULL,
      \`location\` varchar(255) DEFAULT NULL,
      \`warehouse_id\` bigint(20) unsigned DEFAULT NULL,
      \`remarks\` text DEFAULT NULL,
      \`status\` varchar(30) DEFAULT 'DRAFT',
      \`created_by\` bigint(20) unsigned DEFAULT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_fm_mu_scope_no\` (\`company_id\`, \`branch_id\`, \`utilization_no\`),
      KEY \`idx_fm_mu_prop\` (\`property_id\`),
      KEY \`idx_fm_mu_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`fm_material_utilization_items\` (
      \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      \`utilization_id\` bigint(20) unsigned NOT NULL,
      \`item_id\` bigint(20) unsigned NOT NULL,
      \`item_name\` varchar(255) DEFAULT NULL,
      \`uom\` varchar(20) DEFAULT 'PCS',
      \`required_qty\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`qty_in_stock\` decimal(18,3) NOT NULL DEFAULT 0.000,
      \`cost_price\` decimal(18,4) DEFAULT 0.0000,
      PRIMARY KEY (\`id\`),
      KEY \`idx_fm_mui_util\` (\`utilization_id\`),
      CONSTRAINT \`fk_fm_mui_util\` FOREIGN KEY (\`utilization_id\`) REFERENCES \`fm_material_utilization\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const q of queries) {
    await query(q);
  }

  console.log("ALL FM TABLES CREATED SUCCESSFULLY!");
}

createFmTables().then(() => process.exit(0)).catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

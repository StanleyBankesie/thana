const { query } = require('./db/pool.js');
const sql = `
CREATE TABLE IF NOT EXISTS \`srv_service_invoices\` (
  \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  \`company_id\` bigint(20) unsigned NOT NULL,
  \`branch_id\` bigint(20) unsigned DEFAULT NULL,
  \`invoice_no\` varchar(50) NOT NULL,
  \`invoice_date\` date NOT NULL,
  \`customer_id\` bigint(20) unsigned NOT NULL,
  \`due_date\` date DEFAULT NULL,
  \`status\` varchar(20) DEFAULT 'DRAFT',
  \`remarks\` text DEFAULT NULL,
  \`total_amount\` decimal(18,2) DEFAULT 0.00,
  \`tax_amount\` decimal(18,2) DEFAULT 0.00,
  \`tax_components\` longtext DEFAULT NULL,
  \`net_amount\` decimal(18,2) DEFAULT 0.00,
  \`created_by\` bigint(20) unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  \`price_type\` varchar(50) DEFAULT NULL,
  \`payment_type\` varchar(50) DEFAULT NULL,
  \`currency_id\` bigint(20) unsigned DEFAULT NULL,
  \`exchange_rate\` decimal(18,6) NOT NULL DEFAULT 1.000000,
  \`payment_status\` enum('UNPAID','PARTIALLY_PAID','PAID') DEFAULT NULL,
  \`balance_amount\` decimal(18,2) NOT NULL DEFAULT 0.00,
  \`payment_date\` date DEFAULT NULL,
  \`service_execution_id\` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_srv_invoices_co_br\` (\`company_id\`,\`branch_id\`),
  KEY \`idx_srv_invoices_status\` (\`status\`),
  KEY \`idx_srv_invoices_created\` (\`created_at\`),
  KEY \`idx_srv_invoices_invoice_no\` (\`invoice_no\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`srv_service_invoice_details\` (
  \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  \`invoice_id\` bigint(20) unsigned NOT NULL,
  \`item_id\` bigint(20) unsigned NOT NULL,
  \`quantity\` decimal(18,6) NOT NULL DEFAULT 0.000000,
  \`unit_price\` decimal(18,6) NOT NULL DEFAULT 0.000000,
  \`tax_id\` bigint(20) unsigned DEFAULT NULL,
  \`tax_rate\` decimal(10,2) DEFAULT 0.00,
  \`tax_amount\` decimal(18,2) DEFAULT 0.00,
  \`total_amount\` decimal(18,2) DEFAULT 0.00,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`discount_percent\` decimal(10,2) DEFAULT 0.00,
  \`net_amount\` decimal(18,2) DEFAULT 0.00,
  \`uom\` varchar(20) DEFAULT NULL,
  \`remarks\` varchar(255) DEFAULT NULL,
  \`tax_type\` bigint(20) unsigned DEFAULT NULL,
  \`created_by\` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_srv_invoice_details_created\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

(async () => {
  try {
    for (let s of sql.split(';')) {
      if (s.trim().length > 0) {
        await query(s);
        console.log('Executed statement');
      }
    }
  } catch(e) { console.error(e); }
  process.exit(0);
})();

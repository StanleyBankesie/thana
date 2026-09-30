import { query } from './server/db/pool.js';

async function setup() {
  console.log("Creating trn_transport_income...");
  await query(`
    CREATE TABLE IF NOT EXISTS \`trn_transport_income\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`company_id\` int(11) NOT NULL,
      \`branch_id\` int(11) DEFAULT NULL,
      \`trip_id\` int(11) DEFAULT NULL,
      \`vehicle_id\` int(11) DEFAULT NULL,
      \`income_date\` date DEFAULT NULL,
      \`category\` varchar(100) DEFAULT NULL,
      \`amount\` decimal(18,4) DEFAULT 0.0000,
      \`currency\` varchar(10) DEFAULT 'GHS',
      \`description\` text DEFAULT NULL,
      \`recorded_by\` varchar(100) DEFAULT NULL,
      \`status\` varchar(50) DEFAULT 'PENDING',
      \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`customer_id\` int(11) DEFAULT NULL,
      \`payment_method\` varchar(50) DEFAULT NULL,
      \`payment_account_id\` int(11) DEFAULT NULL,
      \`is_tax_included\` tinyint(1) DEFAULT 0,
      \`tax_code_id\` int(11) DEFAULT NULL,
      \`reference_no\` varchar(100) DEFAULT NULL,
      \`cheque_date\` date DEFAULT NULL,
      \`cost_center_id\` int(11) DEFAULT NULL,
      \`voucher_id\` int(11) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_trn_income_co_br\` (\`company_id\`,\`branch_id\`),
      KEY \`idx_trn_income_trip\` (\`trip_id\`),
      KEY \`idx_trn_income_vehicle\` (\`vehicle_id\`),
      KEY \`idx_trn_income_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating trn_transport_expenses...");
  await query(`
    CREATE TABLE IF NOT EXISTS \`trn_transport_expenses\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`company_id\` int(11) NOT NULL,
      \`branch_id\` int(11) NOT NULL,
      \`trip_id\` int(11) DEFAULT NULL,
      \`vehicle_id\` int(11) DEFAULT NULL,
      \`expense_date\` date NOT NULL,
      \`category\` varchar(100) DEFAULT NULL,
      \`amount\` decimal(18,4) NOT NULL,
      \`currency\` varchar(10) DEFAULT 'GHS',
      \`description\` text DEFAULT NULL,
      \`recorded_by\` varchar(200) DEFAULT NULL,
      \`status\` varchar(50) DEFAULT 'PENDING',
      \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`supplier_id\` bigint(20) unsigned DEFAULT NULL,
      \`payment_method\` varchar(50) DEFAULT NULL,
      \`payment_account_id\` bigint(20) unsigned DEFAULT NULL,
      \`is_tax_included\` tinyint(1) DEFAULT 0,
      \`tax_code_id\` bigint(20) unsigned DEFAULT NULL,
      \`reference_no\` varchar(100) DEFAULT NULL,
      \`cheque_date\` date DEFAULT NULL,
      \`cost_center_id\` int(11) DEFAULT NULL,
      \`voucher_id\` int(11) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_trn_expenses_co_br\` (\`company_id\`,\`branch_id\`),
      KEY \`idx_trn_expenses_trip\` (\`trip_id\`),
      KEY \`idx_trn_expenses_vehicle\` (\`vehicle_id\`),
      KEY \`idx_trn_expenses_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Tables created successfully.");
  process.exit(0);
}

setup().catch(err => {
  console.error("Error creating tables:", err);
  process.exit(1);
});

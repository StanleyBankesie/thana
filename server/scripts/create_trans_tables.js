const { pool } = require('./server/db/pool.js');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_fuel_bills (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        company_id bigint(20) unsigned NOT NULL,
        branch_id bigint(20) unsigned DEFAULT NULL,
        bill_no varchar(50) NOT NULL,
        bill_date date NOT NULL,
        supplier_id bigint(20) unsigned NOT NULL,
        order_id bigint(20) unsigned DEFAULT NULL,
        due_date date DEFAULT NULL,
        status varchar(20) DEFAULT 'DRAFT',
        remarks text,
        total_amount decimal(18,2) DEFAULT 0.00,
        tax_amount decimal(18,2) DEFAULT 0.00,
        net_amount decimal(18,2) DEFAULT 0.00,
        currency_id bigint(20) unsigned DEFAULT NULL,
        exchange_rate decimal(18,6) DEFAULT 1.000000,
        tax_components longtext,
        created_by bigint(20) unsigned DEFAULT NULL,
        created_at timestamp NULL DEFAULT current_timestamp(),
        updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_fuel_bills');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_fuel_bill_details (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        bill_id bigint(20) unsigned NOT NULL,
        item_id bigint(20) unsigned NOT NULL,
        quantity decimal(18,6) NOT NULL DEFAULT 0.000000,
        unit_price decimal(18,6) NOT NULL DEFAULT 0.000000,
        tax_id bigint(20) unsigned DEFAULT NULL,
        tax_rate decimal(10,2) DEFAULT 0.00,
        tax_amount decimal(18,2) DEFAULT 0.00,
        discount_percent decimal(10,2) DEFAULT 0.00,
        total_amount decimal(18,2) DEFAULT 0.00,
        net_amount decimal(18,2) DEFAULT 0.00,
        uom varchar(20) DEFAULT NULL,
        remarks varchar(255) DEFAULT NULL,
        created_at timestamp NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_fuel_bill_details');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_invoices (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        company_id bigint(20) unsigned NOT NULL,
        branch_id bigint(20) unsigned DEFAULT NULL,
        invoice_no varchar(50) NOT NULL,
        invoice_date date NOT NULL,
        customer_id bigint(20) unsigned NOT NULL,
        due_date date DEFAULT NULL,
        status varchar(20) DEFAULT 'DRAFT',
        remarks text,
        total_amount decimal(18,2) DEFAULT 0.00,
        tax_amount decimal(18,2) DEFAULT 0.00,
        tax_components longtext,
        net_amount decimal(18,2) DEFAULT 0.00,
        price_type varchar(50) DEFAULT NULL,
        currency_id bigint(20) unsigned DEFAULT NULL,
        exchange_rate decimal(18,6) DEFAULT 1.000000,
        payment_status enum('UNPAID','PARTIALLY_PAID','PAID') DEFAULT 'UNPAID',
        balance_amount decimal(18,2) NOT NULL DEFAULT 0.00,
        payment_date date DEFAULT NULL,
        created_by bigint(20) unsigned DEFAULT NULL,
        created_at timestamp NULL DEFAULT current_timestamp(),
        updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_invoices');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_invoice_details (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        invoice_id bigint(20) unsigned NOT NULL,
        item_id bigint(20) unsigned NOT NULL,
        quantity decimal(18,6) NOT NULL DEFAULT 0.000000,
        unit_price decimal(18,6) NOT NULL DEFAULT 0.000000,
        tax_id bigint(20) unsigned DEFAULT NULL,
        tax_rate decimal(10,2) DEFAULT 0.00,
        tax_amount decimal(18,2) DEFAULT 0.00,
        total_amount decimal(18,2) DEFAULT 0.00,
        discount_percent decimal(10,2) DEFAULT 0.00,
        net_amount decimal(18,2) DEFAULT 0.00,
        uom varchar(20) DEFAULT NULL,
        remarks varchar(255) DEFAULT NULL,
        tax_type bigint(20) unsigned DEFAULT NULL,
        created_by bigint(20) unsigned DEFAULT NULL,
        created_at timestamp NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_invoice_details');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

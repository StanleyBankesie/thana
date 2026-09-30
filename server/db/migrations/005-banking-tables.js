export async function up(db) {
  // fin_bank_accounts table
  await db.query(`
    CREATE TABLE IF NOT EXISTS fin_bank_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(150) NOT NULL,
      bank_name VARCHAR(100),
      account_number VARCHAR(50),
      gl_account_id BIGINT UNSIGNED,
      currency_id BIGINT UNSIGNED,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bank_account_code (company_id, branch_id, code),
      KEY idx_bank_account_company (company_id),
      KEY idx_bank_account_branch (branch_id),
      KEY idx_bank_account_gl (gl_account_id),
      CONSTRAINT fk_bank_account_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_bank_account_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_bank_account_currency FOREIGN KEY (currency_id) REFERENCES fin_currencies(id),
      CONSTRAINT fk_bank_account_gl FOREIGN KEY (gl_account_id) REFERENCES fin_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // fin_pdc_postings table (Postdated Cheques)
  await db.query(`
    CREATE TABLE IF NOT EXISTS fin_pdc_postings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED,
      bank_account_id BIGINT UNSIGNED NOT NULL,
      instrument_no VARCHAR(50) NOT NULL,
      instrument_date DATE NOT NULL,
      amount DECIMAL(18, 2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      voucher_date DATE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pdc_instrument (company_id, instrument_no),
      KEY idx_pdc_company (company_id),
      KEY idx_pdc_branch (branch_id),
      KEY idx_pdc_bank_account (bank_account_id),
      KEY idx_pdc_status (status),
      CONSTRAINT fk_pdc_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_pdc_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_pdc_bank_account FOREIGN KEY (bank_account_id) REFERENCES fin_bank_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // fin_bank_reconciliations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS fin_bank_reconciliations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED,
      bank_account_id BIGINT UNSIGNED NOT NULL,
      reconciliation_date DATE NOT NULL,
      bank_statement_balance DECIMAL(18, 2) NOT NULL,
      calculated_balance DECIMAL(18, 2),
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_recon_company (company_id),
      KEY idx_recon_branch (branch_id),
      KEY idx_recon_bank_account (bank_account_id),
      KEY idx_recon_date (reconciliation_date),
      CONSTRAINT fk_recon_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_recon_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_recon_bank_account FOREIGN KEY (bank_account_id) REFERENCES fin_bank_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function down(db) {
  await db.query("DROP TABLE IF EXISTS fin_bank_reconciliations");
  await db.query("DROP TABLE IF EXISTS fin_pdc_postings");
  await db.query("DROP TABLE IF EXISTS fin_bank_accounts");
}

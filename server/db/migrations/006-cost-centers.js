export async function up(db) {
  // fin_cost_centers table
  await db.query(`
    CREATE TABLE IF NOT EXISTS fin_cost_centers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cost_center_code (company_id, branch_id, code),
      KEY idx_cost_center_company (company_id),
      KEY idx_cost_center_branch (branch_id),
      CONSTRAINT fk_cost_center_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_cost_center_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS fin_cost_centers');
}

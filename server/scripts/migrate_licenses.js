import { query } from "../db/pool.js";

async function runMigration() {
  console.log("Starting License tables migration...");

  try {
    const createLicensesTableSQL = `
      CREATE TABLE IF NOT EXISTS adm_company_licenses (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          company_id BIGINT UNSIGNED NOT NULL,
          license_key VARCHAR(100) NOT NULL UNIQUE,
          license_type ENUM(
              'TRIAL',
              'STANDARD',
              'PROFESSIONAL',
              'ENTERPRISE'
          ) DEFAULT 'STANDARD',
          max_users INT NOT NULL DEFAULT 5,
          start_date DATE NOT NULL,
          expiry_date DATE NOT NULL,
          grace_days INT DEFAULT 15,
          status ENUM(
              'ACTIVE',
              'EXPIRED',
              'SUSPENDED',
              'CANCELLED'
          ) DEFAULT 'ACTIVE',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_license_company
              FOREIGN KEY (company_id)
              REFERENCES adm_companies(id)
      );
    `;

    const createModulesTableSQL = `
      CREATE TABLE IF NOT EXISTS adm_license_modules (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          license_id BIGINT UNSIGNED NOT NULL,
          module_code VARCHAR(100) NOT NULL,
          CONSTRAINT fk_license_module
              FOREIGN KEY (license_id)
              REFERENCES adm_company_licenses(id)
              ON DELETE CASCADE
      );
    `;

    console.log("Creating adm_company_licenses...");
    await query(createLicensesTableSQL);

    console.log("Creating adm_license_modules...");
    await query(createModulesTableSQL);

    console.log("Migration successful.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

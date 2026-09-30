import { query } from "../pool.js";

export async function runBiMigration() {
  console.log("Running BI workflow tables migration...");
  
  await query(`
    CREATE TABLE IF NOT EXISTS bi_saved_filters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NOT NULL,
      filter_name VARCHAR(150) NOT NULL,
      module_key VARCHAR(50) NOT NULL,
      filter_payload JSON NOT NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bi_filter_user (company_id, user_id, module_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bi_saved_analyses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      module_key VARCHAR(50) NOT NULL,
      dimension VARCHAR(100) NULL,
      filters JSON NOT NULL,
      chart_type VARCHAR(50) DEFAULT 'bar',
      metrics JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bi_saved_analysis (company_id, user_id, module_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bi_shared_analyses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      analysis_id INT NOT NULL,
      shared_by_id INT NOT NULL,
      share_type ENUM('USER', 'ROLE', 'DEPARTMENT', 'BRANCH') NOT NULL DEFAULT 'USER',
      target_id INT NOT NULL,
      permission_level ENUM('VIEW', 'VIEW_FILTER', 'VIEW_ANALYZE', 'FULL') NOT NULL DEFAULT 'VIEW_FILTER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_shared_target (company_id, share_type, target_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("BI workflow tables migration completed successfully.");
}

// If executed directly
if (process.argv[1]?.endsWith("create_bi_workflow_tables.js")) {
  runBiMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

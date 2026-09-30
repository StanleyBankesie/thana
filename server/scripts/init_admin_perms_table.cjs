import { query } from './server/db/pool.js';

async function init() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS adm_admin_page_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        module_key VARCHAR(100) NOT NULL,
        feature_key VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_user_feature (user_id, feature_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Table adm_admin_page_permissions created or verified.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

init();

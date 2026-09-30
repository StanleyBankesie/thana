import { query } from './db/pool.js';

async function run() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        value LONGTEXT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("app_settings table created successfully.");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    process.exit(0);
  }
}

run();

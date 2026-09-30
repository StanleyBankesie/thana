export async function up(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS adm_notification_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      module_code VARCHAR(50) NOT NULL,
      status_trigger VARCHAR(50) NOT NULL,
      send_email ENUM('Y','N') NOT NULL DEFAULT 'N',
      send_sms ENUM('Y','N') NOT NULL DEFAULT 'N',
      send_whatsapp ENUM('Y','N') NOT NULL DEFAULT 'N',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_notification_setting (company_id, module_code, status_trigger),
      KEY idx_notification_setting_company (company_id),
      CONSTRAINT fk_notification_setting_company FOREIGN KEY (company_id) REFERENCES adm_companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS adm_notification_settings');
}

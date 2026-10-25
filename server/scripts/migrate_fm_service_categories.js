import { pool } from "../db/pool.js";

export async function migrateFMServiceCategories() {
  console.log("[FM Migration] Ensuring fm_service_categories table exists...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_service_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL DEFAULT 1,
      category_code VARCHAR(50) NOT NULL,
      category_name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fm_sc_comp (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [existing] = await pool.query("SELECT COUNT(*) as count FROM fm_service_categories");
  if (existing[0]?.count === 0) {
    await pool.query(`
      INSERT INTO fm_service_categories (company_id, category_code, category_name, description) VALUES
      (1, 'JANITORIAL', 'Janitorial & Cleaning', 'Restroom sanitization, daily office floor maintenance, trash emptying and hygiene supplies'),
      (1, 'SECURITY_PATROL', 'Security Patrol & Guarding', 'Checkpoint monitoring, access control, perimeter patrols, incident logging and visitor assistance'),
      (1, 'PEST_CONTROL', 'Pest Control & Extermination', 'Bait station inspection, routine chemical fumigation, insect barrier protection and infestation prevention'),
      (1, 'WASTE_MANAGEMENT', 'Waste & Refuse Management', 'Garbage collection, compactor management, municipal waste carrier coordination and recycling disposal'),
      (1, 'LANDSCAPING', 'Landscaping & Grounds Care', 'Lawn mowing, tree trimming, irrigation management, weed control and outdoor property upkeep'),
      (1, 'CONCIERGE_FRONTDESK', 'Concierge & Front Desk', 'Reception services, mail dispatch, visitor check-in, key management and tenant inquiries'),
      (1, 'GENERAL_FACILITIES', 'General Site Operations', 'Day-to-day facilities operational coverage, routine site checks, lighting verification and supervisor audits');
    `);
    console.log("[FM Migration] Seeded 7 default FM service categories.");
  }
}

migrateFMServiceCategories()
  .then(() => {
    console.log("[FM Migration] Categories migration complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[FM Migration] Categories migration error:", err);
    process.exit(1);
  });

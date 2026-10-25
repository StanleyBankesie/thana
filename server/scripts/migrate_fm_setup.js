import { pool } from "../db/pool.js";

export async function migrateFMSetup() {
  console.log("[FM Setup Migration] Ensuring tables exist...");

  // 1. fm_shifts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL DEFAULT 1,
      branch_id INT NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      description VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fm_shifts_comp (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. fm_supervisors
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_supervisors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL DEFAULT 1,
      branch_id INT NULL,
      employee_id INT NULL,
      name VARCHAR(150) NOT NULL,
      employee_code VARCHAR(50) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      shift_id INT NULL,
      shift_name VARCHAR(100) NULL,
      department VARCHAR(100) NULL,
      notes TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fm_sup_comp (company_id),
      INDEX idx_fm_sup_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. fm_personnel
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_personnel (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL DEFAULT 1,
      branch_id INT NULL,
      employee_id INT NULL,
      name VARCHAR(150) NOT NULL,
      employee_code VARCHAR(50) NULL,
      category ENUM('JANITORIAL', 'SECURITY_PATROL', 'PEST_CONTROL', 'WASTE_MANAGEMENT', 'LANDSCAPING', 'CONCIERGE_FRONTDESK', 'GENERAL_FACILITIES') DEFAULT 'JANITORIAL',
      phone VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      shift_id INT NULL,
      shift_name VARCHAR(100) NULL,
      supervisor_id INT NULL,
      supervisor_name VARCHAR(150) NULL,
      notes TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fm_pers_comp (company_id),
      INDEX idx_fm_pers_emp (employee_id),
      INDEX idx_fm_pers_sup (supervisor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed default shifts if none exist
  const [existingShifts] = await pool.query("SELECT COUNT(*) as count FROM fm_shifts");
  if (existingShifts[0]?.count === 0) {
    await pool.query(`
      INSERT INTO fm_shifts (company_id, name, code, start_time, end_time, description) VALUES
      (1, 'Morning Shift', 'MORNING', '06:00:00', '14:00:00', 'Early morning site opening, deep sanitation, security morning briefing'),
      (1, 'Afternoon Shift', 'AFTERNOON', '14:00:00', '22:00:00', 'Midday operational cleaning, waste clearance, afternoon patrol'),
      (1, 'Night Shift', 'NIGHT', '22:00:00', '06:00:00', 'Overnight security watch, floor scrubbing, quiet hour maintenance'),
      (1, 'Full Day General', 'ALL_DAY', '08:00:00', '17:00:00', 'Standard business hours site facilities coverage');
    `);
    console.log("[FM Setup Migration] Seeded 4 default shifts.");
  }

  // Seed default supervisors if none exist
  const [existingSup] = await pool.query("SELECT COUNT(*) as count FROM fm_supervisors");
  if (existingSup[0]?.count === 0) {
    // Check if we have employees from hr_employees to link
    const [hrEmps] = await pool.query("SELECT id, emp_code, first_name, last_name, email, phone FROM hr_employees LIMIT 2");
    if (hrEmps.length > 0) {
      const e1 = hrEmps[0];
      await pool.query(`
        INSERT INTO fm_supervisors (company_id, employee_id, name, employee_code, phone, email, shift_id, shift_name, department, notes) VALUES
        (1, ?, ?, ?, ?, ?, 1, 'Morning Shift', 'Facilities & Estate', 'Head of Janitorial and Soft Services Operations')
      `, [e1.id, `${e1.first_name} ${e1.last_name}`, e1.emp_code, e1.phone, e1.email]);
    } else {
      await pool.query(`
        INSERT INTO fm_supervisors (company_id, name, employee_code, phone, email, shift_name, department, notes) VALUES
        (1, 'David Osei', 'SUP-001', '0244123456', 'david.osei@omnisuite.com', 'Morning Shift', 'Facilities & Estate', 'Head of Soft Services Operations');
      `);
    }
    console.log("[FM Setup Migration] Seeded initial supervisor.");
  }

  // Seed default personnel if none exist
  const [existingPers] = await pool.query("SELECT COUNT(*) as count FROM fm_personnel");
  if (existingPers[0]?.count === 0) {
    const [hrEmps] = await pool.query("SELECT id, emp_code, first_name, last_name, email, phone FROM hr_employees LIMIT 5");
    if (hrEmps.length >= 2) {
      const e2 = hrEmps[1];
      await pool.query(`
        INSERT INTO fm_personnel (company_id, employee_id, name, employee_code, category, phone, email, shift_name, supervisor_name, notes) VALUES
        (1, ?, ?, ?, 'JANITORIAL', ?, ?, 'Morning Shift', 'David Osei', 'Restroom sanitation and office cleaning specialist')
      `, [e2.id, `${e2.first_name} ${e2.last_name}`, e2.emp_code, e2.phone, e2.email]);
    } else {
      await pool.query(`
        INSERT INTO fm_personnel (company_id, name, employee_code, category, phone, shift_name, supervisor_name, notes) VALUES
        (1, 'Grace Mensah', 'PER-001', 'JANITORIAL', '0541987654', 'Morning Shift', 'David Osei', 'Office cleaning & waste disposal'),
        (1, 'Kofi Boateng', 'PER-002', 'SECURITY_PATROL', '0209876543', 'Night Shift', 'David Osei', 'Perimeter & access control officer');
      `);
    }
    console.log("[FM Setup Migration] Seeded initial personnel.");
  }

  console.log("[FM Setup Migration] Setup tables ensured successfully!");
}

if (process.argv[1]?.endsWith("migrate_fm_setup.js")) {
  migrateFMSetup().then(() => process.exit(0)).catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

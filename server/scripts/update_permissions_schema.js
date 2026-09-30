import { query } from "../db/pool.js";

async function migrate() {
  try {
    console.log("Starting permissions migration...");

    // 1. Create adm_pages table
    await query(`
      CREATE TABLE IF NOT EXISTS adm_pages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        module VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        path VARCHAR(255) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_module (module)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Created adm_pages table");

    // 2. Create adm_role_permissions table
    await query(`
      CREATE TABLE IF NOT EXISTS adm_role_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        role_id BIGINT UNSIGNED NOT NULL,
        page_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_role_page (role_id, page_id),
        FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Created adm_role_permissions table");

    // 3. Populate adm_pages with initial data
    const pages = [
      // Administration
      { module: 'Administration', name: 'Users', code: 'admin.users', path: '/administration/users' },
      { module: 'Administration', name: 'Roles', code: 'admin.roles', path: '/administration/roles' },
      { module: 'Administration', name: 'Companies', code: 'admin.companies', path: '/administration/companies' },
      { module: 'Administration', name: 'Branches', code: 'admin.branches', path: '/administration/branches' },
      { module: 'Administration', name: 'Exceptional Permissions', code: 'admin.exceptional_permissions', path: '/administration/exceptional-permissions' },
      
      // Sales
      { module: 'Sales', name: 'Quotations', code: 'sales.quotations', path: '/sales/quotations' },
      { module: 'Sales', name: 'Orders', code: 'sales.orders', path: '/sales/orders' },
      { module: 'Sales', name: 'Invoices', code: 'sales.invoices', path: '/sales/invoices' },
      
      // Inventory
      { module: 'Inventory', name: 'Items', code: 'inventory.items', path: '/inventory/items' },
      { module: 'Inventory', name: 'Stock', code: 'inventory.stock', path: '/inventory/stock' },
      { module: 'Inventory', name: 'Transfers', code: 'inventory.transfers', path: '/inventory/transfers' },
      
      // Purchase
      { module: 'Purchase', name: 'Orders', code: 'purchase.orders', path: '/purchase/orders' },
      { module: 'Purchase', name: 'Bills', code: 'purchase.bills', path: '/purchase/bills' },
      
      // Finance
      { module: 'Finance', name: 'Vouchers', code: 'finance.vouchers', path: '/finance/vouchers' },
      { module: 'Finance', name: 'Reports', code: 'finance.reports', path: '/finance/reports' },
      { module: 'Finance', name: 'Chart of Accounts', code: 'finance.accounts', path: '/finance/accounts' },
      
      // HR
      { module: 'Human Resources', name: 'Employees', code: 'hr.employees', path: '/hr/employees' },
      { module: 'Human Resources', name: 'Payroll', code: 'hr.payroll', path: '/hr/payroll' },
      { module: 'Human Resources', name: 'Leave', code: 'hr.leave', path: '/hr/leave' }
    ];

    for (const page of pages) {
      try {
        await query(
          "INSERT INTO adm_pages (module, name, code, path) VALUES (:module, :name, :code, :path) ON DUPLICATE KEY UPDATE module = :module, name = :name, path = :path",
          page
        );
        console.log(`Upserted page: ${page.code}`);
      } catch (err) {
        console.error(`Error upserting page ${page.code}:`, err.message);
      }
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();

import { query } from './server/db/pool.js';

async function cleanupOrphanedModules() {
  try {
    console.log("Cleaning up orphaned modules from adm_role_modules...");
    
    // Delete role modules that don't have a corresponding license module for that company
    const result = await query(`
      DELETE arm
      FROM adm_role_modules arm
      JOIN adm_roles r ON arm.role_id = r.id
      LEFT JOIN adm_company_licenses acl ON acl.company_id = r.company_id
      LEFT JOIN adm_license_modules alm ON alm.license_id = acl.id AND alm.module_code COLLATE utf8mb4_unicode_ci = arm.module_key COLLATE utf8mb4_unicode_ci
      WHERE alm.license_id IS NULL
    `);
    
    console.log(`Cleanup complete. Deleted ${result.affectedRows} orphaned records.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to clean up orphaned modules:", err);
    process.exit(1);
  }
}

cleanupOrphanedModules();

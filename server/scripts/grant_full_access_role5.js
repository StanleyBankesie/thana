import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";
import { getAllFeatures } from "../data/featuresRegistry.js";

async function run() {
  try {
    const roleId = 5; // Developer
    
    console.log(`Granting full access to Role ${roleId}...`);
    
    // Modules
    const modules = [
      'administration', 'business-intelligence', 'finance', 'human-resources',
      'maintenance', 'pos', 'production', 'project-management', 'purchase',
      'sales', 'service-management', 'inventory', '*'
    ];
    
    await query("DELETE FROM adm_role_modules WHERE role_id = :roleId", { roleId });
    for (const mk of modules) {
      await query("INSERT INTO adm_role_modules (role_id, module_key) VALUES (:roleId, :mk)", { roleId, mk });
    }
    
    // Features
    const allFeatures = getAllFeatures();
    await query("DELETE FROM adm_role_permissions WHERE role_id = :roleId", { roleId });
    
    for (const f of allFeatures) {
      const mk = f.feature_key.split(':')[0];
      await query(`
        INSERT INTO adm_role_permissions 
        (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
        VALUES (:roleId, :mk, :fk, 1, 1, 1, 1)
      `, { roleId, mk, fk: f.feature_key });
    }
    
    // Role Features
    await query("DELETE FROM adm_role_features WHERE role_id = :roleId", { roleId });
    for (const f of allFeatures) {
      await query("INSERT INTO adm_role_features (role_id, feature_key) VALUES (:roleId, :fk)", { roleId, fk: f.feature_key });
    }
    
    console.log("Full access granted to Role 5.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

const fs = require('fs');
let c = fs.readFileSync('server/routes/admin.route.js', 'utf8');

// 1. Add exclusive permissions query to user-permissions
const userPermQuery = `
    const explicitModules = new Set(
      modules
        .map((row) => normalizeModuleKey(row.module_key))
        .filter(Boolean),
    );

    // Fetch exclusive permissions for this user
    const exclusivePerms = await query(
      \`SELECT module_key, feature_key FROM adm_admin_page_permissions WHERE user_id = :userId\`,
      { userId }
    );
    for (const ep of exclusivePerms) {
      const mk = normalizeModuleKey(ep.module_key);
      const fk = normalizeFeatureKey(ep.feature_key, mk);
      explicitModules.add(mk);
      normalizedRoleFeatures.push(fk);
    }
`;

if (!c.includes('FROM adm_admin_page_permissions WHERE user_id')) {
  c = c.replace(`
    const explicitModules = new Set(
      modules
        .map((row) => normalizeModuleKey(row.module_key))
        .filter(Boolean),
    );`, userPermQuery);
}

// 2. Add exclusive-permissions endpoints at the bottom
const endpoints = `
// ==========================================
// Admin Page Permissions Routes
// ==========================================

router.get('/exclusive-permissions', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(\`
      SELECT p.*, u.username, u.full_name 
      FROM adm_admin_page_permissions p
      JOIN adm_users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    \`);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/exclusive-permissions', requireAuth, async (req, res, next) => {
  try {
    const { user_id, module_key, feature_key } = req.body;
    if (!user_id || !module_key || !feature_key) {
      throw httpError(400, "Missing required fields");
    }
    
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE \`key\` = 'super_admin_id'").catch(()=>[]);
    const superIdVal = superRes[0]?.value || (superRes.rows && superRes.rows[0]?.value);
    const superId = superIdVal ? parseInt(superIdVal, 10) : 1;
    if (req.user.id !== superId) {
       throw httpError(403, "Only Super Admin can assign page permissions");
    }

    await query(
      \`INSERT INTO adm_admin_page_permissions (user_id, module_key, feature_key) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE module_key=VALUES(module_key)\`,
      [user_id, module_key, feature_key]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/exclusive-permissions/:id', requireAuth, async (req, res, next) => {
  try {
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE \`key\` = 'super_admin_id'").catch(()=>[]);
    const superIdVal = superRes[0]?.value || (superRes.rows && superRes.rows[0]?.value);
    const superId = superIdVal ? parseInt(superIdVal, 10) : 1;
    if (req.user.id !== superId) {
       throw httpError(403, "Only Super Admin can delete page permissions");
    }

    await query("DELETE FROM adm_admin_page_permissions WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
`;

if (!c.includes("router.get('/exclusive-permissions'")) {
  c = c.replace(/export default router;\s*$/, endpoints);
}

fs.writeFileSync('server/routes/admin.route.js', c);
console.log('Restored exclusive permissions');

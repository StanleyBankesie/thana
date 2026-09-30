const fs = require('fs');

const routeFile = 'server/routes/admin.route.js';
let content = fs.readFileSync(routeFile, 'utf8');

const newRoutes = `
// ==========================================
// Admin Page Permissions Routes
// ==========================================

router.get('/page-permissions', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(\`
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

router.post('/page-permissions', requireAuth, async (req, res, next) => {
  try {
    const { user_id, module_key, feature_key } = req.body;
    if (!user_id || !module_key || !feature_key) {
      throw httpError(400, "Missing required fields");
    }
    
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE \`key\` = 'super_admin_id'");
    const superId = superRes.rows[0]?.value ? parseInt(superRes.rows[0].value, 10) : 1;
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

router.delete('/page-permissions/:id', requireAuth, async (req, res, next) => {
  try {
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE \`key\` = 'super_admin_id'");
    const superId = superRes.rows[0]?.value ? parseInt(superRes.rows[0].value, 10) : 1;
    if (req.user.id !== superId) {
       throw httpError(403, "Only Super Admin can delete page permissions");
    }

    await query("DELETE FROM adm_admin_page_permissions WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
`;

if (!content.includes('/page-permissions')) {
  // insert before module.exports or export default
  content = content.replace('export default router;', newRoutes + '\nexport default router;');
  fs.writeFileSync(routeFile, content, 'utf8');
  console.log('Added routes to admin.route.js');
} else {
  console.log('Routes already exist');
}

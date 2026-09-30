const fs = require('fs');

function updateAdminRoute() {
  let content = fs.readFileSync('server/routes/admin.route.js', 'utf8');
  if (!content.includes('stock_upload_user_id')) {
    content = content.replace(
      'await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`);\n  }',
      'await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`);\n  }\n  if (!(await hasColumn(table, "stock_upload_user_id"))) {\n    await query(`ALTER TABLE ${table} ADD COLUMN stock_upload_user_id BIGINT UNSIGNED NULL`);\n  }'
    );
    fs.writeFileSync('server/routes/admin.route.js', content, 'utf8');
    console.log('Updated admin.route.js');
  }
}

function updateCompaniesController() {
  let content = fs.readFileSync('server/controllers/companies.controller.js', 'utf8');
  
  // createBranch
  content = content.replace(
    'email,\n      remarks,\n    } = req.body || {};',
    'email,\n      remarks,\n      stock_upload_user_id,\n    } = req.body || {};'
  );
  content = content.replace(
    'location, telephone, email, remarks\n        ) VALUES (',
    'location, telephone, email, remarks, stock_upload_user_id\n        ) VALUES ('
  );
  content = content.replace(
    ':location, :telephone, :email, :remarks\n        )`',
    ':location, :telephone, :email, :remarks, :stock_upload_user_id\n        )`'
  );
  content = content.replace(
    'email: email || null,\n      remarks: remarks || null,\n    });',
    'email: email || null,\n      remarks: remarks || null,\n      stock_upload_user_id: stock_upload_user_id || null,\n    });'
  );

  // updateBranch
  content = content.replace(
    'email,\n      remarks,\n    } = req.body || {};',
    'email,\n      remarks,\n      stock_upload_user_id,\n    } = req.body || {};'
  );
  content = content.replace(
    'email = :email,\n            remarks = :remarks\n          WHERE id = :id',
    'email = :email,\n            remarks = :remarks,\n            stock_upload_user_id = :stock_upload_user_id\n          WHERE id = :id'
  );
  content = content.replace(
    'email: email || null,\n        remarks: remarks || null,\n      });',
    'email: email || null,\n        remarks: remarks || null,\n        stock_upload_user_id: stock_upload_user_id || null,\n      });'
  );

  fs.writeFileSync('server/controllers/companies.controller.js', content, 'utf8');
  console.log('Updated companies.controller.js');
}

updateAdminRoute();
updateCompaniesController();

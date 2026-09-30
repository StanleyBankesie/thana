const fs = require('fs');
let content = fs.readFileSync('./client/src/components/Sidebar.jsx', 'utf8');
content = content.replace(
  'if (isExpired || user?.licenseExpired) {\n    menuItems = menuItems.filter((item) => item.key === "administration");\n  }',
  'if (isExpired || user?.licenseExpired) {\n    const adminItem = menuItems.find((item) => item.key === "administration");\n    const hasAdminPerm = canViewModule("administration");\n    if (hasAdminPerm && adminItem) {\n      menuItems = [adminItem];\n    } else {\n      menuItems = [{\n        key: "license-renewal",\n        label: "License Renewal",\n        icon: "??",\n        path: "/administration/licenses",\n        children: []\n      }];\n    }\n  }'
);
fs.writeFileSync('./client/src/components/Sidebar.jsx', content);

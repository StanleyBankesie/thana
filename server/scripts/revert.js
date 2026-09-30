const fs = require('fs');
let content = fs.readFileSync('./client/src/components/Sidebar.jsx', 'utf8');
content = content.replace(/if \(isExpired \|\| user\?\.licenseExpired\) \{[\s\S]*?\}\n  \}/g, 
  'if (isExpired || user?.licenseExpired) {\n    menuItems = menuItems.filter((item) => item.key === "administration");\n  }'
);
fs.writeFileSync('./client/src/components/Sidebar.jsx', content);

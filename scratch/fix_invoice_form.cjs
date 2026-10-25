const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management', 'project-invoices', 'ProjectInvoiceForm.jsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the duplicate </div> before <form
content = content.replace(
  /(\s*<\/div>\s*<\/div>)\s*<\/div>\s*<form onSubmit=\{submit\}/m,
  '$1\n\n      <form onSubmit={submit}'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ProjectInvoiceForm.jsx');

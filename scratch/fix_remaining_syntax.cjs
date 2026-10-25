const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management');

// 1. project-invoices/ProjectInvoiceList.jsx
{
  const file = path.join(root, 'project-invoices', 'ProjectInvoiceList.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /(\s*<\/div>\s*<\/div>)\s*<\/div>\s*(<div className="card">)/m,
    '$1\n\n      $2'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ProjectInvoiceList.jsx');
}

// 2. project-orders/ProjectOrderList.jsx
{
  const file = path.join(root, 'project-orders', 'ProjectOrderList.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /(\s*<\/div>\s*<\/div>)\s*<\/div>\s*(<div className="card">)/m,
    '$1\n\n      $2'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ProjectOrderList.jsx');
}

// 3. purchase-requisitions/PMPurchaseRequisitionList.jsx
{
  const file = path.join(root, 'purchase-requisitions', 'PMPurchaseRequisitionList.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /(\s*<\/div>\s*<\/div>)\s*<\/div>\s*(<div className="card">)/m,
    '$1\n\n      $2'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed PMPurchaseRequisitionList.jsx');
}

// 4. quotations/ProjectQuotationList.jsx
{
  const file = path.join(root, 'quotations', 'ProjectQuotationList.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /(\s*<\/div>\s*<\/div>)\s*<\/div>\s*(\{\/\* Meaningful Metrics Overview \*\/)/m,
    '$1\n\n      $2'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ProjectQuotationList.jsx');
}

// 5. purchase-requisitions/PMPurchaseRequisitionForm.jsx
{
  const file = path.join(root, 'purchase-requisitions', 'PMPurchaseRequisitionForm.jsx');
  let content = fs.readFileSync(file, 'utf8');
  // Remove the duplicate button block
  content = content.replace(
    /<\/div>\s*<button\s*type="button"\s*onClick=\{\(\) => navigate\("\/project-management\/purchase-requisitions"\)\}\s*className="px-3 py-1\.5 rounded bg-white text-brand hover:bg-slate-100 text-sm font-semibold transition-colors"\s*>\s*← Back to List\s*<\/button>\s*<\/div>/m,
    '</div>'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed PMPurchaseRequisitionForm.jsx');
}

// 6. tasks/TaskForm.jsx
{
  const file = path.join(root, 'tasks', 'TaskForm.jsx');
  let content = fs.readFileSync(file, 'utf8');
  // Add opening <div className="card..."> before <div className="card-body p-6">
  content = content.replace(
    /<\/div>\s*<div className="card-body p-6">/m,
    '</div>\n\n      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">\n        <div className="card-body p-6">'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed TaskForm.jsx');
}

console.log('All fixes applied.');

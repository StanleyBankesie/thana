const fs = require('fs');
const file = './client/src/pages/modules/sales/invoices/InvoiceForm.jsx';
let content = fs.readFileSync(file, 'utf8');

const thStr = 'className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider"';
content = content.split(thStr).join('');

const theadStr = '<thead className="bg-gray-100">';
content = content.split(theadStr).join('<thead>');

const tdStr = 'className="px-4 py-3 text-slate-900 dark:text-slate-100"';
content = content.split(tdStr).join('');

const trStr = 'className="hover:bg-slate-50 dark:bg-slate-800/50"';
content = content.split(trStr).join('');

fs.writeFileSync(file, content);
console.log('Done!');

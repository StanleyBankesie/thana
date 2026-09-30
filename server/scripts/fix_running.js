const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\.slice\(0,\s*idx \+ 1\)/g, '.slice(0, items.indexOf(r) + 1)');
  fs.writeFileSync(file, content);
}

fix('C:/Users/stanl/baseline/client/src/pages/modules/finance/reports/DebtorsLedgerReportPage.jsx');
fix('C:/Users/stanl/baseline/client/src/pages/modules/finance/reports/CreditorsLedgerReportPage.jsx');

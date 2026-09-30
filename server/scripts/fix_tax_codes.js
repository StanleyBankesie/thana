import fs from 'fs';

// Expense List
let expensePath = 'client/src/pages/modules/transport/expenses/TransportExpenseList.jsx';
let expenseContent = fs.readFileSync(expensePath, 'utf8');

expenseContent = expenseContent.replace(
  /api\.get\("\/finance\/tax-codes"\)\.then\(r => setTaxCodes\(r\.data\?\.items \|\| r\.data\?\.data\?\.items \|\| \[\]\)\)/,
  `api.get("/finance/tax-codes", { params: { form: "payment-voucher" } }).then(r => {
      const allTaxes = r.data?.items || r.data?.data?.items || [];
      setTaxCodes(allTaxes.filter(t => t.active === 1));
    })`
);

fs.writeFileSync(expensePath, expenseContent);
console.log("Updated Expense List to fetch tax codes for payment-voucher.");

// Income List
let incomePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let incomeContent = fs.readFileSync(incomePath, 'utf8');

incomeContent = incomeContent.replace(
  /api\.get\("\/finance\/tax-codes"\)\.then\(r => setTaxCodes\(r\.data\?\.items \|\| r\.data\?\.data\?\.items \|\| \[\]\)\)/,
  `api.get("/finance/tax-codes", { params: { form: "receipt-voucher" } }).then(r => {
      const allTaxes = r.data?.items || r.data?.data?.items || [];
      setTaxCodes(allTaxes.filter(t => t.active === 1));
    })`
);

fs.writeFileSync(incomePath, incomeContent);
console.log("Updated Income List to fetch tax codes for receipt-voucher.");

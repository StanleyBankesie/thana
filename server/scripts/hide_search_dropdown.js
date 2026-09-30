import fs from 'fs';

// Income List
let incomePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let incomeContent = fs.readFileSync(incomePath, 'utf8');

// The line is: {customerSearchResults.length > 0 && (
incomeContent = incomeContent.replace(
  /\{customerSearchResults\.length > 0 && \(/,
  `{customerSearchResults.length > 0 && customerSearch !== form.customer_name && (`
);

// To ensure it opens again, onClick should clear the search or add a space if it equals the current name
incomeContent = incomeContent.replace(
  /onClick=\{\(\) => setCustomerSearch\(form\.customer_name \|\| " "\)\}/,
  `onClick={() => setCustomerSearch(" ")}`
);

fs.writeFileSync(incomePath, incomeContent);
console.log("Updated Income List to hide search dropdown on selection.");

// Expense List
let expensePath = 'client/src/pages/modules/transport/expenses/TransportExpenseList.jsx';
let expenseContent = fs.readFileSync(expensePath, 'utf8');

// The line is: {supplierSearchResults.length > 0 && (
expenseContent = expenseContent.replace(
  /\{supplierSearchResults\.length > 0 && \(/,
  `{supplierSearchResults.length > 0 && supplierSearch !== form.supplier_name && (`
);

expenseContent = expenseContent.replace(
  /onClick=\{\(\) => setSupplierSearch\(form\.supplier_name \|\| " "\)\}/,
  `onClick={() => setSupplierSearch(" ")}`
);

fs.writeFileSync(expensePath, expenseContent);
console.log("Updated Expense List to hide search dropdown on selection.");

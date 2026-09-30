const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn("File not found: " + filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [search, replace] of Object.entries(replacements)) {
    const regex = new RegExp(search, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, replace);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log("Fixed endpoints in " + path.basename(filePath));
  }
}

const transportDir = path.join(__dirname, 'client/src/pages/modules/transport');

// Fix Fuel Bills and Transportation Bills
const billReplacements = {
  '/purchase/fuel-bills': '/transport/fuel-bills',
  '/service-management/fuel-bills': '/transport/fuel-bills',
  '"service-management:fuel-bills"': '"transport:fuel-bills"',
  
  '/purchase/transportation-bills': '/transport/transportation-bills',
  '/service-management/transportation-bills': '/transport/transportation-bills',
  '"service-management:transportation-bills"': '"transport:bills"',
  '"service-management:bills"': '"transport:bills"'
};

replaceInFile(path.join(transportDir, 'fuel-bills', 'FuelBillsList.jsx'), billReplacements);
replaceInFile(path.join(transportDir, 'fuel-bills', 'FuelBillForm.jsx'), billReplacements);
replaceInFile(path.join(transportDir, 'transportation-bills', 'TransportationBillsList.jsx'), billReplacements);
replaceInFile(path.join(transportDir, 'transportation-bills', 'TransportationBillForm.jsx'), billReplacements);

// Fix Billing (Sales Invoices clones)
const billingReplacements = {
  '/sales/invoices': '/transport/billing',
  '"sales:invoices"': '"transport:billing"',
  '"sales-invoice"': '"transport-billing"',
  '/sales': '/transport',
  'SALES.INVOICE': 'TRANSPORT.BILLING',
  '"sales:customers"': '"transport:settings"'
};

replaceInFile(path.join(transportDir, 'billing', 'BillingList.jsx'), billingReplacements);
replaceInFile(path.join(transportDir, 'billing', 'BillingForm.jsx'), billingReplacements);

console.log("Deep clean of Transport endpoints completed.");

import fs from 'fs';

// Fix ServiceOrderForm.jsx
let soFormPath = 'client/src/pages/modules/service-management/service-orders/ServiceOrderForm.jsx';
let soFormContent = fs.readFileSync(soFormPath, 'utf8');

soFormContent = soFormContent.replace(
  /const resp = await api\.get\("\/sales\/customers"\);/g,
  `const resp = await api.get("/sales/customers", { params: { service_customer: "Y" } });`
);
fs.writeFileSync(soFormPath, soFormContent);
console.log("Updated ServiceOrderForm.jsx");

// Fix CustomerServiceRequestForm.jsx
let reqFormPath = 'client/src/pages/modules/service-management/service-requests/CustomerServiceRequestForm.jsx';
let reqFormContent = fs.readFileSync(reqFormPath, 'utf8');

reqFormContent = reqFormContent.replace(
  /const resp = await api\.get\("\/sales\/customers"\);/g,
  `const resp = await api.get("/sales/customers", { params: { service_customer: "Y" } });`
);
fs.writeFileSync(reqFormPath, reqFormContent);
console.log("Updated CustomerServiceRequestForm.jsx");

const fs = require('fs');

const file = 'client/src/pages/modules/finance/setup/TaxCodesPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  TRANSPORT_EXPENSES: 22,
  TRANSPORT_INCOME: 23,
};`;
const target1_crlf = `  TRANSPORT_EXPENSES: 22,\r\n  TRANSPORT_INCOME: 23,\r\n};`;

const rep1 = `  TRANSPORT_EXPENSES: 22,
  TRANSPORT_INCOME: 23,
  ASSET_INVOICE: 24,
  FACILITIES_SERVICE_BILLING: 25,
  PROJECT_INVOICE: 26,
  SERVICE_INVOICE: 27,
  TRANSPORT_BILLING: 28,
};`;
const rep1_crlf = `  TRANSPORT_EXPENSES: 22,\r\n  TRANSPORT_INCOME: 23,\r\n  ASSET_INVOICE: 24,\r\n  FACILITIES_SERVICE_BILLING: 25,\r\n  PROJECT_INVOICE: 26,\r\n  SERVICE_INVOICE: 27,\r\n  TRANSPORT_BILLING: 28,\r\n};`;

if (content.includes(target1_crlf)) {
  content = content.replace(target1_crlf, rep1_crlf);
} else if (content.includes(target1)) {
  content = content.replace(target1, rep1);
} else {
  console.error('Target 1 not found');
  process.exit(1);
}

const target2 = `  {
    value: PAGE_IDS.TRANSPORT_INCOME,
    code: "TRANSPORT_INCOME",
    label: "Transportation Income",
  },
];`;
const target2_crlf = `  {\r\n    value: PAGE_IDS.TRANSPORT_INCOME,\r\n    code: "TRANSPORT_INCOME",\r\n    label: "Transportation Income",\r\n  },\r\n];`;

const rep2 = `  {
    value: PAGE_IDS.TRANSPORT_INCOME,
    code: "TRANSPORT_INCOME",
    label: "Transportation Income",
  },
  {
    value: PAGE_IDS.ASSET_INVOICE,
    code: "ASSET_INVOICE",
    label: "Asset Invoices (Asset Management)",
  },
  {
    value: PAGE_IDS.FACILITIES_SERVICE_BILLING,
    code: "FACILITIES_SERVICE_BILLING",
    label: "Facilities Invoices / Service Billing",
  },
  {
    value: PAGE_IDS.PROJECT_INVOICE,
    code: "PROJECT_INVOICE",
    label: "Project Invoices (Project Management)",
  },
  {
    value: PAGE_IDS.SERVICE_INVOICE,
    code: "SERVICE_INVOICE",
    label: "Service Invoices (Service Management)",
  },
  {
    value: PAGE_IDS.TRANSPORT_BILLING,
    code: "TRANSPORT_BILLING",
    label: "Transport Invoices and Billing",
  },
];`;
const rep2_crlf = `  {\r\n    value: PAGE_IDS.TRANSPORT_INCOME,\r\n    code: "TRANSPORT_INCOME",\r\n    label: "Transportation Income",\r\n  },\r\n  {\r\n    value: PAGE_IDS.ASSET_INVOICE,\r\n    code: "ASSET_INVOICE",\r\n    label: "Asset Invoices (Asset Management)",\r\n  },\r\n  {\r\n    value: PAGE_IDS.FACILITIES_SERVICE_BILLING,\r\n    code: "FACILITIES_SERVICE_BILLING",\r\n    label: "Facilities Invoices / Service Billing",\r\n  },\r\n  {\r\n    value: PAGE_IDS.PROJECT_INVOICE,\r\n    code: "PROJECT_INVOICE",\r\n    label: "Project Invoices (Project Management)",\r\n  },\r\n  {\r\n    value: PAGE_IDS.SERVICE_INVOICE,\r\n    code: "SERVICE_INVOICE",\r\n    label: "Service Invoices (Service Management)",\r\n  },\r\n  {\r\n    value: PAGE_IDS.TRANSPORT_BILLING,\r\n    code: "TRANSPORT_BILLING",\r\n    label: "Transport Invoices and Billing",\r\n  },\r\n];`;

if (content.includes(target2_crlf)) {
  content = content.replace(target2_crlf, rep2_crlf);
} else if (content.includes(target2)) {
  content = content.replace(target2, rep2);
} else {
  console.error('Target 2 not found');
  process.exit(1);
}

const target3 = `  PAGE_IDS.CREDIT_NOTE,
];`;
const target3_crlf = `  PAGE_IDS.CREDIT_NOTE,\r\n];`;

const rep3 = `  PAGE_IDS.CREDIT_NOTE,
  PAGE_IDS.ASSET_INVOICE,
  PAGE_IDS.FACILITIES_SERVICE_BILLING,
  PAGE_IDS.PROJECT_INVOICE,
  PAGE_IDS.SERVICE_INVOICE,
  PAGE_IDS.TRANSPORT_BILLING,
];`;
const rep3_crlf = `  PAGE_IDS.CREDIT_NOTE,\r\n  PAGE_IDS.ASSET_INVOICE,\r\n  PAGE_IDS.FACILITIES_SERVICE_BILLING,\r\n  PAGE_IDS.PROJECT_INVOICE,\r\n  PAGE_IDS.SERVICE_INVOICE,\r\n  PAGE_IDS.TRANSPORT_BILLING,\r\n];`;

if (content.includes(target3_crlf)) {
  content = content.replace(target3_crlf, rep3_crlf);
} else if (content.includes(target3)) {
  content = content.replace(target3, rep3);
} else {
  console.error('Target 3 not found');
  process.exit(1);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated TaxCodesPage.jsx');

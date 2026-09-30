import fs from 'fs';
import path from 'path';

const files = [
  "client/src/pages/modules/human-resources/reports/HRReports.jsx",
  "client/src/pages/modules/project-management/reports/ProjectExpenseReport.jsx",
  "client/src/pages/modules/project-management/reports/ProjectIncomeReport.jsx",
  "client/src/pages/modules/project-management/reports/ProjectStatusReport.jsx",
  "client/src/pages/modules/service-management/reports/OutstandingServiceBillsReport.jsx",
  "client/src/pages/modules/service-management/reports/RepeatServiceRequestReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceConfirmationReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceCostAnalysisReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceRevenueReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceTypePerformanceReport.jsx",
  "client/src/pages/modules/service-management/reports/TechnicianUtilizationReport.jsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Fix the invalid syntax: ${...} -> v.something
  // Wait, the invalid syntax is: `${(v.description || "").replace(/"/g, '""')}`
  // Because it was originally inside backticks \`"\${...}"\` and my script removed the backticks!
  // Let's just find anything like `\$\{\(v\.[a-zA-Z_]+\s*\|\|\s*""\)\.replace\(\/"\/g,\s*'""'\)\}` 
  // And replace it with `(v.$1 || "")`
  content = content.replace(/\$\{\(v\.([a-zA-Z_]+)\s*\|\|\s*""\)\.replace\(\/"\/g,\s*'""'\)\}/g, '(v.$1 || "")');

  // Also some might be `\$\{v\.([a-zA-Z_]+)\}` without the `replace`
  content = content.replace(/\$\{v\.([a-zA-Z_]+)\}/g, 'v.$1');

  // Remove trailing semicolons on exportPdf };; -> };
  content = content.replace(/\};\s*;/g, '};');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  }
}

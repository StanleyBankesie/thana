import fs from 'fs';
import path from 'path';

const files = [
  "client/src/pages/modules/service-management/reports/OutstandingServiceBillsReport.jsx",
  "client/src/pages/modules/service-management/reports/RepeatServiceRequestReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceConfirmationReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceCostAnalysisReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceRevenueReport.jsx",
  "client/src/pages/modules/service-management/reports/ServiceTypePerformanceReport.jsx",
  "client/src/pages/modules/service-management/reports/TechnicianUtilizationReport.jsx",
  "client/src/pages/modules/service-management/reports/VisitorsLogReport.jsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Remove the exportCSV function definition.
  // We match from function exportCSV() { up to doc.save(URL.revokeObjectURL...) or similar.
  // Actually, we can just look for function exportCSV() { ... }
  // Since we know where it ends, let's just match it.
  const exportCsvMatch = content.match(/function\s+exportCSV\(\)\s*\{[\s\S]*?URL\.revokeObjectURL\(url\);\s*\}/);
  if (exportCsvMatch) {
    content = content.replace(exportCsvMatch[0], '');
  }

  // Remove the button.
  const btnPattern = /<button[^>]*onClick=\{exportCSV\}[^>]*>[\s\S]*?Export CSV[\s\S]*?<\/button>/;
  content = content.replace(btnPattern, '');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Cleaned ' + file);
  }
}

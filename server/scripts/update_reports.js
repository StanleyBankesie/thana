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

  // Add imports
  if (!content.includes('import * as XLSX')) {
    const importMatch = content.match(/import React.*?;\n/);
    if (importMatch) {
      content = content.replace(importMatch[0], importMatch[0] + 'import * as XLSX from "xlsx";\nimport { jsPDF } from "jspdf";\nimport "jspdf-autotable";\n');
    }
  }

  // Find the export CSV function signature.
  // It could be `const exportCsv = () => {` or `function exportCSV() {` or `const exportCSV = () => {`
  const exportMatch = content.match(/(?:const\s+export(?:Csv|CSV)\s*=\s*\(\)\s*=>\s*\{|function\s+export(?:Csv|CSV)\s*\(\)\s*\{)([\s\S]*?)URL\.revokeObjectURL\(url\);\s*\}/);

  if (exportMatch) {
    const body = exportMatch[1];
    
    // The body usually contains `const headers = ...` and `const rows = ...`
    // We want to extract the headers and rows logic.
    // Let's grab everything up to `const csv = `
    const logicMatch = body.match(/([\s\S]*?)const\s+csv\s*=/);
    
    if (logicMatch) {
      let dataLogic = logicMatch[1].trim();
      
      // Some `rows` mapping includes `"..."` replacement for CSV. 
      // For Excel/PDF we don't need the string escaping, but keeping it won't break anything.
      // However, it's better to remove the explicit quote wrapping if possible, but it's safe to just reuse.
      // Wait, `""` wrapping might look ugly in Excel.
      // Let's just create exportExcel and exportPdf directly!

      const reportNameMatch = body.match(/download\s*=\s*`([^$]+)/);
      const reportNameBase = reportNameMatch ? reportNameMatch[1].replace(/[-_]$/, '') : 'report';

      const newFunctions = `
  const exportExcel = () => {
    ${dataLogic.replace(/`"([^`]+)"`/g, '$1').replace(/"\$\{\(v\.description \|\| ""\)\.replace\(\/"\/g, '""'\)\}"/g, 'v.description')}
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, \`${reportNameBase}-\${new Date().toISOString().split("T")[0]}.xlsx\`);
  };

  const exportPdf = () => {
    ${dataLogic.replace(/`"([^`]+)"`/g, '$1').replace(/"\$\{\(v\.description \|\| ""\)\.replace\(\/"\/g, '""'\)\}"/g, 'v.description')}
    const doc = new jsPDF();
    doc.autoTable({
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(\`${reportNameBase}-\${new Date().toISOString().split("T")[0]}.pdf\`);
  };
`;
      
      content = content.replace(exportMatch[0], newFunctions.trim());
    }
  }

  // Replace buttons
  // Pattern 1: {items.length > 0 && <button onClick={exportCsv} ...>...Export CSV</button>}
  const btnPattern1 = /\{[a-zA-Z0-9_.]+\.length\s*>\s*0\s*&&\s*<button\s+onClick=\{export(?:Csv|CSV)\}[^>]+>.*?Export CSV<\/button>\}/g;
  content = content.replace(btnPattern1, (match) => {
    // Extract the condition
    const condMatch = match.match(/\{([a-zA-Z0-9_.]+\.length\s*>\s*0)\s*&&/);
    if (condMatch) {
      return `{${condMatch[1]} && (
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success flex items-center gap-2"><Download size={18} /> Excel</button>
              <button onClick={exportPdf} className="btn-error flex items-center gap-2 text-white bg-rose-600 hover:bg-rose-700"><Download size={18} /> PDF</button>
            </div>
          )}`;
    }
    return match;
  });

  // Pattern 2: HRReports style (no condition wrapping the button, or different text)
  const btnPattern2 = /<button\s+onClick=\{export(?:Csv|CSV)\}[^>]+>.*?Export CSV<\/button>/g;
  content = content.replace(btnPattern2, (match) => {
    // Don't double replace if we already matched in Pattern 1
    if (content.includes('exportExcel} className="btn-success')) {
      // It's possible this pattern matches remaining instances.
    }
    return `<div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">Excel</button>
              <button onClick={exportPdf} className="btn-error px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center gap-2">PDF</button>
            </div>`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
  }
}

const fs = require('fs');
const files = [
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\human-resources\\leave\\LeaveApplicationForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\human-resources\\leave\\LeaveRequestForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\execution\\MaterialReceiptForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\execution\\MaterialRequisitionForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\execution\\ProductionTransferForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\inventory\\StockJournalForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\service-management\\service-execution\\ServiceExecutionForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\service-management\\service-requests\\CustomerServiceRequestForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\transport\\breakdowns\\BreakdownForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\transport\\requests\\TransportRequestForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\transport\\vehicles\\VehicleForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\transport\\drivers\\DriverForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\transport\\inspections\\InspectionForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\banking\\BankReconciliationForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\banking\\PdcPostingForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\human-resources\\recruitment\\RequisitionForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\planning\\DailyPlanForm.jsx',
  'C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\production\\routings\\RoutingForm.jsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!content.includes('useParams')) {
    content = content.replace(/import \{([^}]+)\} from ["']react-router-dom["'];/, (match, p1) => {
      return `import { ${p1.trim()}, useParams } from "react-router-dom";`;
    });
    changed = true;
  }

  const componentMatch = content.match(/export default function \w+\([^)]*\)\s*\{/);
  if (componentMatch && !content.includes('const { id } = useParams();')) {
    const insertPos = componentMatch.index + componentMatch[0].length;
    content = content.slice(0, insertPos) + '\n  const { id } = useParams();' + content.slice(insertPos);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Patched ' + file);
  }
}

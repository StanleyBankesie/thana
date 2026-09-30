import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `import TransportReports from "./reports/TransportReports.jsx";`;

const replacementStr = `import TransportReports from "./reports/TransportReports.jsx";
import TransportIncomeList from "./income/TransportIncomeList.jsx";
import TransportExpenseList from "./expenses/TransportExpenseList.jsx";`;

if (content.includes(targetStr) && !content.includes('TransportIncomeList')) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content);
  console.log("Imports added.");
} else {
  console.log("No changes made.");
}

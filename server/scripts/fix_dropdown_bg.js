import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove customer code from the search results
content = content.replace(
  /\{c\.customer_name\} \(\{c\.customer_code\}\)/g,
  '{c.customer_name}'
);

// 2. Make the dropdown background explicitly solid white and a very high z-index
content = content.replace(
  /className="absolute z-\[100\] w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto border border-gray-200"/g,
  'className="absolute z-[9999] w-full bg-white opacity-100 shadow-2xl rounded-box mt-1 max-h-48 overflow-y-auto border border-slate-300 isolate"'
);

fs.writeFileSync(filePath, content);
console.log("Successfully removed customer code and updated dropdown background in TransportIncomeList.jsx.");

import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Extract the tax block using a broad regex
const taxBlockRegex = /(<div className="form-control">\s*<label className="inline-flex items-center gap-2 text-sm pt-8 cursor-pointer">[\s\S]*?<\/select>\s*\)\}\s*<\/div>)/;
const match = content.match(taxBlockRegex);

if (match) {
  const taxBlock = match[1];
  
  // Remove taxBlock from its original position (handling whitespace/newlines)
  content = content.replace(new RegExp(taxBlock.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '');
  
  // Find Deposit Account block
  const depositBlockRegex = /(<div className="form-control">\s*<label className="label"><span className="label-text">Deposit Account \(RV\) \*<\/span><\/label>[\s\S]*?<\/select>\s*<\/div>)/;
  
  content = content.replace(depositBlockRegex, `$1\n                ${taxBlock}`);
  
  fs.writeFileSync(filePath, content);
  console.log("Moved tax block successfully in TransportIncomeList.jsx.");
} else {
  console.log("Could not find the tax block in TransportIncomeList.jsx");
}

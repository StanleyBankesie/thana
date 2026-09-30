import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /<textarea required className="textarea textarea-bordered w-full h-24"/g,
  '<textarea required className="textarea textarea-bordered border border-slate-300 rounded-lg w-full h-24 p-3"'
);

fs.writeFileSync(filePath, content);
console.log("Successfully added border and rounded edges to Description textarea in TransportIncomeList.jsx.");

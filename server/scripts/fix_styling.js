import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the corrupted classes from the previous run
content = content.replace(/className="select input input-bordered w-full/g, 'className="input input-bordered w-full');
content = content.replace(/className="textarea input input-bordered w-full h-24"/g, 'className="textarea textarea-bordered w-full h-24"');

fs.writeFileSync(filePath, content);
console.log("Successfully fixed styling in TransportIncomeList.jsx.");

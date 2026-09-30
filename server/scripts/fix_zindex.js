import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// The line is exactly: <div className="form-control">\n                  <label className="label"><span className="label-text font-bold">Client / Organization <span className="text-error">*</span></span></label>
content = content.replace(
  /<div className="form-control">\s*<label className="label"><span className="label-text font-bold">Client \/ Organization/g,
  '<div className="form-control relative z-50">\n                  <label className="label"><span className="label-text font-bold">Client / Organization'
);

fs.writeFileSync(filePath, content);
console.log("Successfully fixed stacking context for Client dropdown in TransportIncomeList.jsx.");

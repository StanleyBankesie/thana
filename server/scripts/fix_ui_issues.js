import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix overlap issue: Add z-50 to the relative container of the customer search, and z-[100] to the ul
content = content.replace(
  /<div className="relative">\s*<input type="text" placeholder="Search Client..."/g,
  '<div className="relative z-50">\n                    <input type="text" placeholder="Search Client..."'
);
content = content.replace(
  /className="absolute z-10 w-full bg-base-100/g,
  'className="absolute z-[100] w-full bg-base-100'
);

// 2. Change color of Amount and Client labels
content = content.replace(
  /<span className="label-text text-red-500 font-bold">Amount \*/g,
  '<span className="label-text font-bold">Amount <span className="text-error">*</span>'
);
content = content.replace(
  /<span className="label-text text-red-500 font-bold">Client \/ Organization \*/g,
  '<span className="label-text font-bold">Client / Organization <span className="text-error">*</span>'
);

// 3. Make Description field required
content = content.replace(
  /<span className="label-text">Description<\/span>/g,
  '<span className="label-text font-bold">Description <span className="text-error">*</span></span>'
);
content = content.replace(
  /<textarea className="textarea textarea-bordered w-full h-24"/g,
  '<textarea required className="textarea textarea-bordered w-full h-24"'
);

fs.writeFileSync(filePath, content);
console.log("Successfully fixed UI issues in TransportIncomeList.jsx.");

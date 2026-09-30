import fs from 'fs';

let listPath = 'client/src/pages/modules/transport/drivers/DriversList.jsx';
let content = fs.readFileSync(listPath, 'utf8');

content = content.replace(
  /<td className="px-6 py-4">\{`\$\{d\.first_name \|\| ""\} \$\{d\.last_name \|\| ""\}`\.trim\(\)\}<\/td>/,
  `<td className="px-6 py-4">{d.employee_name || \`\${d.first_name || ""} \${d.last_name || ""}\`.trim() || "N/A"}</td>`
);

fs.writeFileSync(listPath, content);
console.log("Updated DriversList.jsx to display employee_name.");

const fs = require('fs');

let file = 'client/src/pages/modules/project-management/ProjectManagementHome.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = 'export default function ProjectManagementHome() {\n  return (\n    <ModuleLayout';
const target1CRLF = 'export default function ProjectManagementHome() {\r\n  return (\r\n    <ModuleLayout';

const replacement1 = `export default function ProjectManagementHome() {
  return (
    <div className="pm-module-scope w-full">
      <style>{\`
        /* Scoped strictly to the Project Management module */
        .pm-module-scope div[class*="bg-slate-50"],
        .pm-module-scope div[class*="bg-slate-100"],
        .pm-module-scope div[class*="bg-gray-50"],
        .pm-module-scope div[class*="bg-gray-100"],
        .pm-module-scope section[class*="bg-slate-50"],
        .pm-module-scope section[class*="bg-slate-100"],
        .pm-module-scope form[class*="bg-slate-50"],
        .pm-module-scope form[class*="bg-slate-100"],
        .pm-module-scope [class*="bg-slate-850"] {
          background-color: #ffffff;
        }

        :is(.dark) .pm-module-scope div[class*="bg-slate-50"],
        :is(.dark) .pm-module-scope div[class*="bg-slate-100"],
        :is(.dark) .pm-module-scope div[class*="bg-gray-50"],
        :is(.dark) .pm-module-scope div[class*="bg-gray-100"],
        :is(.dark) .pm-module-scope section[class*="bg-slate-50"],
        :is(.dark) .pm-module-scope section[class*="bg-slate-100"],
        :is(.dark) .pm-module-scope form[class*="bg-slate-50"],
        :is(.dark) .pm-module-scope form[class*="bg-slate-100"],
        :is(.dark) .pm-module-scope [class*="bg-slate-850"] {
          background-color: #0f172a;
        }

        /* Strictly ensure table headings preserve their distinct background across the module */
        .pm-module-scope thead,
        .pm-module-scope thead tr,
        .pm-module-scope thead th {
          background-color: #f8fafc !important;
        }
        :is(.dark) .pm-module-scope thead,
        :is(.dark) .pm-module-scope thead tr,
        :is(.dark) .pm-module-scope thead th {
          background-color: rgba(30, 41, 59, 0.7) !important;
        }
      \`}</style>
      <ModuleLayout`;

if (content.includes(target1CRLF)) {
  content = content.replace(target1CRLF, replacement1);
} else if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
} else {
  console.error("target1 not found");
}

const target2 = '</Routes>\n    </ModuleLayout>\n  );\n}';
const target2CRLF = '</Routes>\r\n    </ModuleLayout>\r\n  );\r\n}';
const replacement2 = `</Routes>
    </ModuleLayout>
    </div>
  );
}`;

if (content.includes(target2CRLF)) {
  content = content.replace(target2CRLF, replacement2);
} else if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
} else {
  console.error("target2 not found");
}

fs.writeFileSync(file, content, 'utf8');
console.log('ProjectManagementHome.jsx updated successfully.');

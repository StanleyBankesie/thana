const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management', 'setup', 'Setup.jsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('ArrowLeft')) {
  content = content.replace('Settings } from "lucide-react";', 'Settings, ArrowLeft } from "lucide-react";');
}

content = content.replace(
  /<div className="flex items-center gap-3">[\s\S]*?<\/div>\s*<\/div>/m,
  `<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Settings size={26} className="text-brand-900 dark:text-brand-400" />
              Operations Setup
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure managers, operational departments, temporal warehouses, and service suppliers
            </p>
          </div>
        </div>
      </div>`
);

content = content.replace(
  /<div className="flex border-b overflow-x-auto gap-1">[\s\S]*?<\/div>/m,
  `<div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={\`px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 \${
              activeTab === tab.id
                ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }\`}>
            {tab.label}
          </button>
        ))}
      </div>`
);

content = content.replace(/className="btn-primary flex items-center gap-1\.5 text-xs py-1\.5 px-3"/g, 'className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"');
content = content.replace(/className="btn-primary flex items-center gap-2 w-full justify-center"/g, 'className="btn btn-primary inline-flex items-center gap-2 w-full justify-center text-sm"');

fs.writeFileSync(file, content, 'utf8');
console.log('Setup.jsx updated successfully');

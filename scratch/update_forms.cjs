const fs = require('fs');
const path = require('path');

const root = 'c:/Users/stanl/OneDrive/Documents/Stanness Technologies/thana';

function updateFile(relPath, fn) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('File not found:', relPath);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const updated = fn(content);
  if (updated !== content) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('No change needed:', relPath);
  }
}

// 1. ProjectForm.jsx
updateFile('client/src/pages/modules/project-management/projects/ProjectForm.jsx', content => {
  return content
    .replace(/className=["']btn-success flex items-center gap-2["']/g, 'className="btn btn-primary inline-flex items-center gap-2"')
    .replace(/w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm/g, 'input w-full')
    .replace(/w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm/g, 'input w-full')
    .replace(/w-full pl-4 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm appearance-none/g, 'input w-full appearance-none pr-10')
    .replace(/w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm min-h-\[120px\]/g, 'input w-full min-h-[120px]');
});

// 2. TaskList.jsx
updateFile('client/src/pages/modules/project-management/tasks/TaskList.jsx', content => {
  return content
    .replace(
      /<div className="card shadow-md">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg p-5">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Task Management<\/h1>[\s\S]*?<p className="text-sm opacity-90">[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
      `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ListTodo size={24} className="text-brand-900 dark:text-brand-400" /> Task Management
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              WBS task allocation, scope management & assignment tracking
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/project-management/tasks/new"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Task
          </Link>
        </div>
      </div>`
    );
});

// 3. TaskForm.jsx
updateFile('client/src/pages/modules/project-management/tasks/TaskForm.jsx', content => {
  return content
    .replace(
      /<div className="card shadow-md">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg p-5">[\s\S]*?<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold dark:text-brand-300">[\s\S]*?<\/h1>[\s\S]*?<p className="text-sm opacity-90 mt-0.5">[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex items-center gap-3">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
      `{/* Canonical Form Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => window.history.back()} className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ListTodo size={24} className="text-brand-900 dark:text-brand-400" /> {isNew ? "New Task" : "Edit Task"}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              WBS Item Specification & Execution Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={() => setShowAttach(true)}
              className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              📎 Attachments
            </button>
          )}
          <button type="button" onClick={() => window.history.back()} className="btn btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary text-sm inline-flex items-center gap-2"
          >
            {saving ? "Saving…" : "Save Task Assignment"}
          </button>
        </div>
      </div>`
    );
});

console.log('Batch 1 processing done');

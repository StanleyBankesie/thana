const fs = require('fs');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      changed = true;
    } else {
      console.warn(`Target not found in ${filePath}:\n${target}`);
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// 1. VariationRegister.jsx
replaceInFile('client/src/pages/modules/project-management/construction/VariationRegister.jsx', [
  [
    '<div className="p-4 bg-slate-100/70 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">',
    '<div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">'
  ],
  [
    ': "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"',
    ': "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400"'
  ],
  [
    ': isPassed\n                          ? "bg-slate-50 border-emerald-400 text-emerald-700 dark:bg-slate-850 dark:text-emerald-400"\n                          : "bg-slate-50/50 border-slate-200 text-slate-400 dark:bg-slate-850/50 dark:border-slate-800"',
    ': isPassed\n                          ? "bg-white border-emerald-400 text-emerald-700 dark:bg-slate-900 dark:text-emerald-400"\n                          : "bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800"'
  ]
]);

// 2. ProjectInvoiceForm.jsx
replaceInFile('client/src/pages/modules/project-management/project-invoices/ProjectInvoiceForm.jsx', [
  [
    '<div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">',
    '<div className="bg-white dark:bg-slate-900 p-4 rounded-lg mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">'
  ]
]);

// 3. ProjectOrderForm.jsx
replaceInFile('client/src/pages/modules/project-management/project-orders/ProjectOrderForm.jsx', [
  [
    '<div className="bg-slate-50 rounded-lg px-6 py-3">',
    '<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-6 py-3 shadow-sm">'
  ]
]);

// 4. ProjectDetailDashboard.jsx
replaceInFile('client/src/pages/modules/project-management/projects/ProjectDetailDashboard.jsx', [
  [
    '<div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">',
    '<div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center shadow-sm">'
  ],
  [
    '<div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">',
    '<div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center shadow-sm">'
  ],
  [
    '<div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">',
    '<div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center shadow-sm">'
  ],
  [
    '<div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 mb-2">',
    '<div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-2">'
  ]
]);

// 5. ProjectQuotationForm.jsx
replaceInFile('client/src/pages/modules/project-management/quotations/ProjectQuotationForm.jsx', [
  [
    '<div className="mt-4 ml-auto w-full max-w-md rounded-md bg-gray-100 px-4 py-3 space-y-2">',
    '<div className="mt-4 ml-auto w-full max-w-md rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2 shadow-sm">'
  ],
  [
    '<div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">',
    '<div className="text-center py-10 text-gray-500 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">'
  ],
  [
    '<div className="rounded-md bg-gray-100 px-4 py-3 space-y-2">',
    '<div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2 shadow-sm">'
  ],
  [
    '<div className="rounded-md bg-gray-100 px-4 py-3 space-y-2">',
    '<div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2 shadow-sm">'
  ]
]);

// 6. ClientValuationList.jsx read-only inputs
replaceInFile('client/src/pages/modules/project-management/construction/ClientValuationList.jsx', [
  [
    'className="input text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 w-full"',
    'className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 w-full"'
  ],
  [
    'className="input text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-full"',
    'className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 w-full"'
  ],
  [
    'className="input text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-full"',
    'className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 w-full"'
  ]
]);

// 7. PaymentApplicationList.jsx inputs
replaceInFile('client/src/pages/modules/project-management/construction/PaymentApplicationList.jsx', [
  [
    'className="input text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 w-full"',
    'className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 w-full"'
  ],
  [
    'className="input text-sm font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 w-full"',
    'className="input text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 w-full"'
  ]
]);

// 8. TaskExecution.jsx checklist items
replaceInFile('client/src/pages/modules/project-management/tasks/TaskExecution.jsx', [
  [
    ': "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"',
    ': "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"'
  ]
]);

// 9. TaskList.jsx buttons
replaceInFile('client/src/pages/modules/project-management/tasks/TaskList.jsx', [
  [
    'className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"',
    'className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"'
  ],
  [
    'className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1 mx-auto"',
    'className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 mx-auto"'
  ]
]);

// 10. TimesheetList.jsx buttons
replaceInFile('client/src/pages/modules/project-management/timesheets/TimesheetList.jsx', [
  [
    'className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition-colors"',
    'className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"'
  ],
  [
    'className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"',
    'className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"'
  ]
]);

// 11. ExpenseList.jsx
replaceInFile('client/src/pages/modules/project-management/expenses/ExpenseList.jsx', [
  [
    '<button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200">Edit</button>',
    '<button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>'
  ]
]);

// 12. ProjectIncomeList.jsx
replaceInFile('client/src/pages/modules/project-management/income/ProjectIncomeList.jsx', [
  [
    '<button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200">Edit</button>',
    '<button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>'
  ]
]);

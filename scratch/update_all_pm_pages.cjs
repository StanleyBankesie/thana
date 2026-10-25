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

// 1. TaskExecution.jsx
updateFile('client/src/pages/modules/project-management/tasks/TaskExecution.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('MousePointerClick\n} from "lucide-react";', 'MousePointerClick,\n  ArrowLeft\n} from "lucide-react";')
                     .replace('MousePointerClick\r\n} from "lucide-react";', 'MousePointerClick,\r\n  ArrowLeft\r\n} from "lucide-react";');
  }

  content = content.replace(
    /<div className="card shadow-md overflow-hidden">[\s\S]*?<div className="card-header bg-brand text-white p-4 sm:p-5">[\s\S]*?<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">[\s\S]*?<div>[\s\S]*?<h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">[\s\S]*?<ListTodo className="w-6 h-6 sm:w-7 sm:h-7" \/> Task Execution[\s\S]*?<\/h1>[\s\S]*?<p className="text-xs sm:text-sm mt-1 opacity-90">[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex flex-wrap gap-2 w-full sm:w-auto">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ListTodo size={24} className="text-brand-900 dark:text-brand-400" /> Task Execution
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Interactive WBS execution, checklist tracking & gauge progress monitoring
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/project-management/tasks" className="btn btn-primary inline-flex items-center gap-1.5">
            Task Management
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 2. ExpenseList.jsx
updateFile('client/src/pages/modules/project-management/expenses/ExpenseList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Expenses<\/h1>[\s\S]*?<p className="text-sm mt-1">Track and manage project-related costs<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign size={24} className="text-brand-900 dark:text-brand-400" /> Project Expenses
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track and manage site petty cash, supplier invoices, and project-related costs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openCreate} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>`
  );
  return content;
});

// 3. ProjectIncomeList.jsx
updateFile('client/src/pages/modules/project-management/income/ProjectIncomeList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Income<\/h1>[\s\S]*?<p className="text-sm mt-1">Track and manage project revenues<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign size={24} className="text-brand-900 dark:text-brand-400" /> Project Income
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track and manage project milestone billings, receipts, and revenues
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openCreate} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Record Income
          </button>
        </div>
      </div>`
  );
  return content;
});

// 4. TimesheetList.jsx
updateFile('client/src/pages/modules/project-management/timesheets/TimesheetList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Clock,\n', 'Clock,\n  ArrowLeft,\n').replace('Clock,\r\n', 'Clock,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Timeline<\/h1>[\s\S]*?<p className="text-sm mt-1 opacity-80">Work hours logged against projects and tasks<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock size={24} className="text-brand-900 dark:text-brand-400" /> Project Timeline & Timesheets
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Work hours logged against projects, tasks, and labor costing
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openCreate} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Log Hours
          </button>
        </div>
      </div>`
  );
  return content;
});

// 5. MaterialRequisitionList.jsx
updateFile('client/src/pages/modules/project-management/material-requisition/MaterialRequisitionList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Package,\n', 'Package,\n  ArrowLeft,\n').replace('Package,\r\n', 'Package,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Material Requisitions<\/h1>[\s\S]*?<p className="text-sm mt-1">Project material requests with approval workflow<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={24} className="text-brand-900 dark:text-brand-400" /> Material Requisitions
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Project material requests with stock reservation and approval workflow
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/material-requisitions/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Requisition
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 6. MaterialReceiptList.jsx
updateFile('client/src/pages/modules/project-management/material-receipt/MaterialReceiptList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('PackageCheck,\n', 'PackageCheck,\n  ArrowLeft,\n').replace('PackageCheck,\r\n', 'PackageCheck,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Material Receipts<\/h1>[\s\S]*?<p className="text-sm mt-1">Receive requested items on site<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={24} className="text-brand-900 dark:text-brand-400" /> Material Receipts
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Receive and inspect requested stock deliveries on site
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/material-receipts/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Receipt
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 7. MaterialUtilizationList.jsx
updateFile('client/src/pages/modules/project-management/material-utilization/MaterialUtilizationList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Hammer,\n', 'Hammer,\n  ArrowLeft,\n').replace('Hammer,\r\n', 'Hammer,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Material Utilization<\/h1>[\s\S]*?<p className="text-sm mt-1">Track material consumption against tasks<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={24} className="text-brand-900 dark:text-brand-400" /> Material Utilization
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track site material consumption, wastage, and cost attribution against tasks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/material-utilizations/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Utilization
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 8. ProjectOrderList.jsx
updateFile('client/src/pages/modules/project-management/project-orders/ProjectOrderList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Orders<\/h1>[\s\S]*?<p className="text-sm mt-1 opacity-80">[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase size={24} className="text-brand-900 dark:text-brand-400" /> Project Orders
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Client project engagements, service contracts, and commercial orders
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/project-orders/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Project Order
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 9. PMPurchaseRequisitionList.jsx
updateFile('client/src/pages/modules/project-management/purchase-requisitions/PMPurchaseRequisitionList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Purchase Requisitions<\/h1>[\s\S]*?<p className="text-sm mt-1">Project purchase requisitions<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={24} className="text-brand-900 dark:text-brand-400" /> Project Purchase Requisitions
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Procure goods and services from external vendors routed into Procurement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/purchase-requisitions/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Purchase Requisition
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 10. ProjectQuotationList.jsx
updateFile('client/src/pages/modules/project-management/quotations/ProjectQuotationList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Quotations<\/h1>[\s\S]*?<p className="text-sm mt-1">Draft quotes for clients based on project estimates<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText size={24} className="text-brand-900 dark:text-brand-400" /> Project Quotations
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Draft commercial quotations for clients based on project cost estimates
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/quotations/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Quotation
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 11. ProjectInvoiceList.jsx
updateFile('client/src/pages/modules/project-management/project-invoices/ProjectInvoiceList.jsx', content => {
  if (!content.includes('ArrowLeft')) {
    content = content.replace('Plus,\n', 'Plus,\n  ArrowLeft,\n').replace('Plus,\r\n', 'Plus,\r\n  ArrowLeft,\r\n');
  }
  content = content.replace(
    /<div className="card">[\s\S]*?<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<div className="flex justify-between items-center">[\s\S]*?<div>[\s\S]*?<h1 className="text-2xl font-bold">Project Invoices<\/h1>[\s\S]*?<p className="text-sm mt-1">Bill clients for completed project work<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `{/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck2 size={24} className="text-brand-900 dark:text-brand-400" /> Project Invoices
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Bill clients for completed project milestones and work packages
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/project-management/project-invoices/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Invoice
          </Link>
        </div>
      </div>`
  );
  return content;
});

// 12. BOQManager.jsx
updateFile('client/src/pages/modules/project-management/construction/BOQManager.jsx', content => {
  content = content.replace(
    /className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500\/20 flex items-center gap-1\.5 transition-all"/g,
    'className="btn btn-primary inline-flex items-center gap-2"'
  );
  content = content.replace(
    /className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-\[200px\]"/g,
    'className="input text-sm py-1.5 h-auto min-w-[200px]"'
  );
  content = content.replace(
    /className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full min-w-\[220px\]"/g,
    'className="input text-sm py-1.5 h-auto w-full min-w-[220px]"'
  );
  return content;
});

// 13. CostControlDashboard.jsx
updateFile('client/src/pages/modules/project-management/construction/CostControlDashboard.jsx', content => {
  content = content.replace(
    /className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-\[220px\]"/g,
    'className="input text-sm py-1.5 h-auto min-w-[220px]"'
  );
  content = content.replace(
    /className="btn btn-secondary inline-flex items-center gap-1\.5 text-xs py-2"/g,
    'className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"'
  );
  content = content.replace(
    /className="btn btn-outline inline-flex items-center gap-1\.5 text-xs py-2"/g,
    'className="btn btn-outline inline-flex items-center gap-1.5 text-sm"'
  );
  return content;
});

console.log('All updates in script completed');

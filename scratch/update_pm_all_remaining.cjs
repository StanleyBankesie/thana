const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management');

function updateFile(relPath, fn) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const updated = fn(content);
  if (updated !== content) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log(`Updated ${relPath}`);
  } else {
    console.log(`No changes made to ${relPath}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. MaterialRequisitionForm.jsx
// ─────────────────────────────────────────────────────────────
updateFile('material-requisition/MaterialRequisitionForm.jsx', content => {
  // Add Lucide imports if missing
  if (!content.includes('ArrowLeft') && !content.includes('PackagePlus')) {
    content = content.replace(
      'import { Link, useNavigate, useParams } from "react-router-dom";',
      'import { Link, useNavigate, useParams } from "react-router-dom";\nimport { ArrowLeft, Save, PackagePlus, Plus, Trash2 } from "lucide-react";'
    );
  }

  // Replace header
  content = content.replace(
    /<div className="space-y-6">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<div className="card-body">/m,
    `<div className="space-y-6">
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <PackagePlus size={26} className="text-brand-900 dark:text-brand-400" />
              {isNew ? "New Material Requisition" : "Edit Material Requisition"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Request materials for your project
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Requisition"}
          </button>
        </div>
      </div>

      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">`
  );

  // Replace Add Item button
  content = content.replace(
    /<button type="button" onClick=\{addItem\} className="btn-success text-sm">\+ Add Item<\/button>/g,
    `<button type="button" onClick={addItem} className="btn btn-secondary text-xs inline-flex items-center gap-1.5"><Plus size={14} /> Add Item</button>`
  );

  // Replace bottom buttons
  content = content.replace(
    /<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">\s*<button onClick=\{\(\) => window\.history\.back\(\)\} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Cancel<\/button>\s*<button type="submit" className="btn-success" disabled=\{saving\}>\s*\{saving \? "Saving\.\.\." : "Save"\}\s*<\/button>\s*<\/div>\s*<\/form>\s*<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                disabled={saving}
              >
                <Save size={16} /> {saving ? "Saving..." : "Save Requisition"}
              </button>
            </div>
          </form>
      </div>
    </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 2. MaterialUtilizationList.jsx
// ─────────────────────────────────────────────────────────────
updateFile('material-utilization/MaterialUtilizationList.jsx', content => {
  // Update imports
  content = content.replace(
    'import { Plus } from "lucide-react";',
    'import { Plus, ArrowLeft, RefreshCw, Wrench, Search } from "lucide-react";'
  );

  // Replace header and search
  content = content.replace(
    /<div className="space-y-4">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<div className="card">\s*<div className="card-body">\s*<div className="flex flex-col md:flex-row gap-4 mb-6">\s*<div className="flex-1">\s*<input type="text" placeholder="Search utilization\.\.\." className="input" value=\{searchTerm\} onChange=\{e => setSearchTerm\(e\.target\.value\)\} \/>\s*<\/div>\s*<\/div>/m,
    `<div className="space-y-6">
      {/* Canonical ERP Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Wrench size={26} className="text-brand-900 dark:text-brand-400" />
              Material Utilization
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Track material consumption against projects and tasks
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={loadData} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/material-utilizations/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Utilization
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search utilization..."
              className="input pl-9 w-full text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>`
  );

  // Cleanup dangling ViewToggle container that was after search
  content = content.replace(
    /<div className="flex justify-end mb-4">\s*<ViewToggle viewMode=\{viewMode\} setViewMode=\{setViewMode\} \/>\s*<\/div>/m,
    ''
  );

  // Standardize confirm and view buttons
  content = content.replace(
    'className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"',
    'className="btn btn-primary text-xs px-2.5 py-1 disabled:opacity-50"'
  );
  content = content.replace(
    'className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 inline-block"',
    'className="btn btn-outline text-xs px-2.5 py-1 inline-block"'
  );

  // Fix card close tags if needed: replace `</div>\s*</div>\s*</div>\s*\);\s*}` with `</div>\s*</div>\s*\);\s*}`
  content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*}\s*$/m,
    '</div>\n    </div>\n  );\n}'
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 3. MaterialUtilizationForm.jsx
// ─────────────────────────────────────────────────────────────
updateFile('material-utilization/MaterialUtilizationForm.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('Wrench')) {
    content = content.replace(
      'import { Link, useNavigate, useParams } from "react-router-dom";',
      'import { Link, useNavigate, useParams } from "react-router-dom";\nimport { ArrowLeft, Save, Wrench, Plus, Trash2 } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="space-y-6">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<div className="card-body">/m,
    `<div className="space-y-6">
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Wrench size={26} className="text-brand-900 dark:text-brand-400" />
              {isNew ? "New Material Utilization" : "Edit Material Utilization"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Record material consumption against project tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Utilization"}
          </button>
        </div>
      </div>

      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">`
  );

  content = content.replace(
    /className="btn-success text-sm"\s*>\s*\+ Add Item/g,
    'className="btn btn-secondary text-xs inline-flex items-center gap-1.5"><Plus size={14} /> Add Item'
  );

  content = content.replace(
    /<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">\s*<button onClick=\{\(\) => window\.history\.back\(\)\} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"\s*>\s*Cancel\s*<\/button>\s*<button type="submit" className="btn-success" disabled=\{saving\}>\s*\{saving \? "Saving\.\.\." : "Save"\}\s*<\/button>\s*<\/div>\s*<\/form>\s*<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                disabled={saving}
              >
                <Save size={16} /> {saving ? "Saving..." : "Save Utilization"}
              </button>
            </div>
          </form>
      </div>
    </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 4. ProjectInvoiceList.jsx
// ─────────────────────────────────────────────────────────────
updateFile('project-invoices/ProjectInvoiceList.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('FileText')) {
    content = content.replace(
      'import { Send } from "lucide-react";',
      'import { Send, ArrowLeft, FileText, Plus, RefreshCw, Search } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="space-y-4">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="space-y-6">
      {/* Canonical ERP Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <FileText size={26} className="text-brand-900 dark:text-brand-400" />
              Project Invoices
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Generate and manage client invoices
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => fetchAll(pagination.page || 1)} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/project-invoices/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Invoice
          </Link>
        </div>
      </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 5. ProjectInvoiceForm.jsx
// ─────────────────────────────────────────────────────────────
updateFile('project-invoices/ProjectInvoiceForm.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('FileText')) {
    content = content.replace(
      'import React, { useState, useEffect, useMemo, useRef } from "react";',
      'import React, { useState, useEffect, useMemo, useRef } from "react";\nimport { ArrowLeft, Save, FileText } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="card print:hidden">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/m,
    `{/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <FileText size={26} className="text-brand-900 dark:text-brand-400" />
              {isEdit ? "Edit Invoice" : "New Invoice"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Create and manage project invoices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
            >
              <Save size={16} /> {loading ? "Saving..." : "Save Invoice"}
            </button>
          )}
        </div>
      </div>`
  );

  // Bottom buttons
  content = content.replace(
    /<div className="flex justify-end gap-3">\s*<button onClick=\{\(\) => window\.history\.back\(\)\} className="btn-success">\s*Cancel\s*<\/button>\s*\{!readOnly && \(\s*<button\s*className="btn-success"\s*type="submit"\s*disabled=\{loading\}\s*>\s*\{loading \? "Saving\.\.\." : "Save Invoice"\}\s*<\/button>\s*\)\}\s*<\/div>/m,
    `<div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                  disabled={loading}
                >
                  <Save size={16} /> {loading ? "Saving..." : "Save Invoice"}
                </button>
              )}
            </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 6. ProjectOrderList.jsx
// ─────────────────────────────────────────────────────────────
updateFile('project-orders/ProjectOrderList.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('ShoppingCart')) {
    content = content.replace(
      'import { Plus } from "lucide-react";',
      'import { Plus, ArrowLeft, ShoppingCart, RefreshCw } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="space-y-4">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="space-y-6">
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <ShoppingCart size={26} className="text-brand-900 dark:text-brand-400" />
              Project Orders
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage orders placed against projects
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => fetchOrders(pagination.page || 1)} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/project-orders/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Order
          </Link>
        </div>
      </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 7. ProjectOrderForm.jsx
// ─────────────────────────────────────────────────────────────
updateFile('project-orders/ProjectOrderForm.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('ShoppingCart')) {
    content = content.replace(
      'import { Link, useNavigate, useParams } from "react-router-dom";',
      'import { Link, useNavigate, useParams } from "react-router-dom";\nimport { ArrowLeft, Save, ShoppingCart, Plus, Trash2 } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="space-y-6" data-no-overview="true">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<div className="card-body">/m,
    `<div className="space-y-6" data-no-overview="true">
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <ShoppingCart size={26} className="text-brand-900 dark:text-brand-400" />
              {isNew ? "New Project Order" : \`Project Order \${formData.orderNo}\`}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Create and manage items for a project
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {!isViewMode && formData.status === "DRAFT" && !isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-outline text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
            >
              Delete
            </button>
          )}
          {!isNew && formData.status !== "DRAFT" && (
            <button
              type="button"
              onClick={handleCancelOrder}
              className="btn btn-outline text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              Cancel Order
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary text-xs"
            >
              Print
            </button>
          )}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Close
          </button>
          {!readOnly && formData.status === "DRAFT" && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Order"}
            </button>
          )}
        </div>
      </div>

      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">`
  );

  // Bottom buttons
  content = content.replace(
    /<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">\s*<Link to="\/project-management\/project-orders"\s*className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Close<\/Link>\s*\{!readOnly && formData\.status === "DRAFT" && \(\s*<button type="submit" className="btn-success" disabled=\{saving\}>\s*\{saving \? "Saving\.\.\." : "Save"\}\s*<\/button>\s*\)\}\s*<\/div>\s*<\/form>\s*<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <Link
                to="/project-management/project-orders"
                className="btn btn-secondary text-sm"
              >
                Close
              </Link>
              {!readOnly && formData.status === "DRAFT" && (
                <button
                  type="submit"
                  className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                  disabled={saving}
                >
                  <Save size={16} /> {saving ? "Saving..." : "Save Order"}
                </button>
              )}
            </div>
          </form>
      </div>
    </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 8. PMPurchaseRequisitionList.jsx
// ─────────────────────────────────────────────────────────────
updateFile('purchase-requisitions/PMPurchaseRequisitionList.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('ClipboardCheck')) {
    content = content.replace(
      'import { Plus } from "lucide-react";',
      'import { Plus, ArrowLeft, ClipboardCheck, RefreshCw } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="space-y-4">\s*<div className="card">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/m,
    `<div className="space-y-6">
      {/* Canonical ERP Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <ClipboardCheck size={26} className="text-brand-900 dark:text-brand-400" />
              Purchase Requisitions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Request materials and services for project procurement
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={loadRequisitions} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/purchase-requisitions/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Requisition
          </Link>
        </div>
      </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 9. PMPurchaseRequisitionForm.jsx
// ─────────────────────────────────────────────────────────────
updateFile('purchase-requisitions/PMPurchaseRequisitionForm.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('ClipboardCheck')) {
    content = content.replace(
      'import React, { useEffect, useMemo, useState } from "react";',
      'import React, { useEffect, useMemo, useState } from "react";\nimport { ArrowLeft, Save, ClipboardCheck, Plus, Trash2 } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg flex items-center justify-between">[\s\S]*?<\/div>/m,
    `<div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {reqId
                  ? isEditMode
                    ? "Edit Purchase Requisition"
                    : "View Purchase Requisition"
                  : "New Purchase Requisition"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {headerData?.requisition_no
                  ? \`Requisition: \${headerData.requisition_no}\`
                  : "Request items or services for project procurement"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/project-management/purchase-requisitions")}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back to List
          </button>
        </div>`
  );

  content = content.replace(
    'className="btn btn-success text-xs px-4 py-2"',
    'className="btn btn-secondary text-xs inline-flex items-center gap-1.5"'
  );

  content = content.replace(
    'className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand hover:opacity-90 shadow-sm disabled:opacity-50 disabled:pointer-events-none transition-colors"',
    'className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"'
  );

  content = content.replace(
    'className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-sm transition-colors"',
    'className="btn btn-secondary text-sm"'
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 10. ProjectQuotationList.jsx
// ─────────────────────────────────────────────────────────────
updateFile('quotations/ProjectQuotationList.jsx', content => {
  if (!content.includes('ArrowLeft') && !content.includes('FileSpreadsheet')) {
    content = content.replace(
      'import { X, FileText, DollarSign, CheckCircle2, Clock, Send } from "lucide-react";',
      'import { X, FileText, DollarSign, CheckCircle2, Clock, Send, ArrowLeft, FileSpreadsheet, RefreshCw, Plus } from "lucide-react";'
    );
  }

  content = content.replace(
    /<div className="card no-overview" data-no-overview="true">\s*<div className="card-header bg-brand text-white rounded-t-lg">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/m,
    `{/* Canonical ERP Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <FileSpreadsheet size={26} className="text-brand-900 dark:text-brand-400" />
              Project Quotations
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage project proposals, client quotes, and commercial terms
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => fetchQuotations(pagination.page || 1)} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/quotations/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Quotation
          </Link>
        </div>
      </div>`
  );

  return content;
});

// ─────────────────────────────────────────────────────────────
// 11. TaskExecution.jsx
// ─────────────────────────────────────────────────────────────
updateFile('tasks/TaskExecution.jsx', content => {
  content = content.replace(
    'className="btn-success text-xs px-4 py-2 flex items-center gap-1.5 w-full sm:w-auto justify-center"',
    'className="btn btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 w-full sm:w-auto justify-center shadow-sm"'
  );
  return content;
});

// ─────────────────────────────────────────────────────────────
// 12. ProjectExpenseReport.jsx, ProjectIncomeReport.jsx, ProjectStatusReport.jsx
// ─────────────────────────────────────────────────────────────
updateFile('reports/ProjectExpenseReport.jsx', content => {
  content = content.replace(
    'className="btn-success flex items-center gap-2"',
    'className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"'
  );
  content = content.replace(
    'className="btn-error flex items-center gap-2 text-white bg-rose-600 hover:bg-rose-700"',
    'className="btn btn-outline inline-flex items-center gap-1.5 text-sm text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"'
  );
  return content;
});

updateFile('reports/ProjectIncomeReport.jsx', content => {
  content = content.replace(
    'className="btn-success flex items-center gap-2"',
    'className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"'
  );
  content = content.replace(
    'className="btn-error flex items-center gap-2 text-white bg-rose-600 hover:bg-rose-700"',
    'className="btn btn-outline inline-flex items-center gap-1.5 text-sm text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"'
  );
  return content;
});

updateFile('reports/ProjectStatusReport.jsx', content => {
  content = content.replace(
    'className="btn-success px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"',
    'className="btn btn-secondary inline-flex items-center gap-1.5 text-sm font-medium"'
  );
  content = content.replace(
    'className="btn-error px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center gap-2"',
    'className="btn btn-outline inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"'
  );
  return content;
});

console.log('Update script completed.');

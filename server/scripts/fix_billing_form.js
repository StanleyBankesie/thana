import fs from 'fs';
import path from 'path';

// 1. Create BillingForm.jsx
const billingFormPath = 'client/src/pages/modules/transport/billing/BillingForm.jsx';
const billingFormContent = `import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";

export default function BillingForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    customer_id: "",
    total_amount: "",
    description: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.info("Invoice creation is under construction");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Link to="/transport/billing" className="btn btn-ghost btn-sm px-2 text-slate-500">
              <ArrowLeftOutlined /> Back
            </Link>
            Create Invoice
          </h1>
        </div>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label"><span className="label-text">Invoice Date</span></label>
              <input type="date" name="invoice_date" className="input input-bordered w-full" value={formData.invoice_date} onChange={handleChange} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Amount (GH₵)</span></label>
              <input type="number" step="0.01" name="total_amount" className="input input-bordered w-full" value={formData.total_amount} onChange={handleChange} required />
            </div>
            <div className="form-control md:col-span-2">
              <label className="label"><span className="label-text">Description</span></label>
              <textarea name="description" className="textarea textarea-bordered w-full" value={formData.description} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <Link to="/transport/billing" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <SaveOutlined /> {loading ? "Saving..." : "Save Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(billingFormPath, billingFormContent);
console.log("Created BillingForm.jsx");

// 2. Update BillingList.jsx to navigate to the new form
const billingListPath = 'client/src/pages/modules/transport/billing/BillingList.jsx';
let listContent = fs.readFileSync(billingListPath, 'utf8');
listContent = listContent.replace(
  /<button className="btn-success" onClick=\{.*?console\.log\("Feature under construction"\).*?>\s*<PlusOutlined \/> Create Invoice\s*<\/button>/s,
  `<Link to="/transport/billing/new" className="btn btn-success"><PlusOutlined /> Create Invoice</Link>`
);
fs.writeFileSync(billingListPath, listContent);
console.log("Updated BillingList.jsx to link to form");

// 3. Update TransportLayout.jsx to include route
const layoutPath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

if (!layoutContent.includes('import BillingForm')) {
  layoutContent = layoutContent.replace(
    /import BillingList from "\.\/billing\/BillingList\.jsx";/,
    `import BillingList from "./billing/BillingList.jsx";\nimport BillingForm from "./billing/BillingForm.jsx";`
  );
}

if (!layoutContent.includes('path="billing/new"')) {
  layoutContent = layoutContent.replace(
    /<Route path="billing" element=\{<BillingList \/>\} \/>/,
    `<Route path="billing" element={<BillingList />} />\n        <Route path="billing/new" element={<BillingForm />} />\n        <Route path="billing/:id" element={<BillingForm />} />`
  );
}

fs.writeFileSync(layoutPath, layoutContent);
console.log("Updated TransportLayout.jsx with BillingForm routes");

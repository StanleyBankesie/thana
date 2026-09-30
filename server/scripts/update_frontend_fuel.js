import fs from 'fs';
import path from 'path';

// 1. Create FuelExpenseList.jsx
const dirPath = 'client/src/pages/modules/transport/fuel-expenses';
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const listPath = path.join(dirPath, 'FuelExpenseList.jsx');
const listContent = `import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PlusOutlined, DeleteOutlined, CloseOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FuelExpenseList() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [vehicles, setVehicles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  
  // State for search fields
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);

  const [form, setForm] = useState({
    vehicle_id: "", driver_name: "", description: "", supplier_id: "",
    supplier_name: "", expense_type: "", is_tax_included: false,
    tax_code_id: "", amount: "", remarks: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/fuel-expenses");
      setExpenses(res.data?.data?.items || []);
    } catch (err) {
      if (err.response?.status !== 403) toast.error("Failed to fetch fuel expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    api.get("/transport/vehicles").then(r => setVehicles(r.data?.data?.items || r.data?.items || [])).catch(() => {});
    api.get("/sales/customers").then(r => setSuppliers(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/tax-codes", { params: { form: "payment-voucher" } }).then(r => {
      const allTaxes = r.data?.items || r.data?.data?.items || [];
      setTaxCodes(allTaxes.filter(t => t.active === 1));
    }).catch(() => {});
    
    const typesStr = localStorage.getItem("transport_expense_types") || "FUEL, MAINTENANCE, TOLL, PARKING, OTHER";
    setExpenseTypes(typesStr.split(',').map(s => s.trim()).filter(Boolean));
  }, []);

  const handleOpenCreate = () => {
    setForm({
      vehicle_id: "", driver_name: "", description: "", supplier_id: "",
      supplier_name: "", expense_type: "", is_tax_included: false,
      tax_code_id: "", amount: "", remarks: ""
    });
    setSupplierSearch("");
    setShowSupplierSearch(false);
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/transport/fuel-expenses", form);
      toast.success("Expense request created successfully");
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create expense request");
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = supplierSearch 
    ? suppliers.filter(s => s.customer_name?.toLowerCase().includes(supplierSearch.toLowerCase()))
    : suppliers;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center p-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Fuel & Vehicle Expense Requests</h1>
            <p className="text-sm mt-1">Manage fuel and other vehicle expenses</p>
          </div>
          <div className="flex gap-2">
            <Link to="/transport" className="btn btn-secondary">Return to Menu</Link>
            <button className="btn-success btn" onClick={handleOpenCreate}>
              <PlusOutlined /> Create Request
            </button>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-brand-600 bg-brand-50 border-b border-brand-200 uppercase">
              <tr>
                <th className="px-6 py-4">Vehicle No</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Expense Type</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Amount (GH₵)</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-6">Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-6 text-slate-500">No requests found.</td></tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{exp.registration_number || exp.vehicle_id}</td>
                    <td className="px-6 py-4">{exp.driver_name}</td>
                    <td className="px-6 py-4">{exp.expense_type}</td>
                    <td className="px-6 py-4">{exp.supplier_name_mapped || exp.supplier_name}</td>
                    <td className="px-6 py-4 font-semibold">{Number(exp.amount).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">
                        {exp.status || "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Create Expense Request</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <CloseOutlined />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="expenseForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Vehicle No *</span></label>
                  <select name="vehicle_id" className="select select-bordered w-full rounded-md" value={form.vehicle_id} onChange={handleFormChange} required>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Driver's Name *</span></label>
                  <input type="text" name="driver_name" className="input input-bordered w-full rounded-md" value={form.driver_name} onChange={handleFormChange} required />
                </div>
                
                <div className="form-control md:col-span-2">
                  <label className="label font-medium"><span className="label-text">Description *</span></label>
                  <textarea name="description" className="textarea textarea-bordered w-full rounded-md" value={form.description} onChange={handleFormChange} required rows="2" />
                </div>
                
                <div className="form-control relative">
                  <label className="label font-medium"><span className="label-text">Supplier's Name</span></label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="input input-bordered w-full rounded-md" 
                      placeholder="Search supplier..." 
                      value={supplierSearch} 
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierSearch(true);
                        if (!e.target.value) setForm(prev => ({ ...prev, supplier_id: "", supplier_name: "" }));
                      }}
                      onFocus={() => setShowSupplierSearch(true)}
                    />
                    {showSupplierSearch && filteredSuppliers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredSuppliers.map(s => (
                          <div 
                            key={s.id} 
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer"
                            onClick={() => {
                              setForm(prev => ({ ...prev, supplier_id: s.id, supplier_name: s.customer_name }));
                              setSupplierSearch(s.customer_name);
                              setShowSupplierSearch(false);
                            }}
                          >
                            {s.customer_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Expense Type *</span></label>
                  <select name="expense_type" className="select select-bordered w-full rounded-md" value={form.expense_type} onChange={handleFormChange} required>
                    <option value="">Select Type</option>
                    {expenseTypes.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                  </select>
                </div>
                
                <div className="form-control flex flex-row items-center gap-3">
                  <label className="cursor-pointer label p-0 mt-8">
                    <span className="label-text mr-3 font-medium">Is Tax Included</span> 
                    <input type="checkbox" name="is_tax_included" className="checkbox checkbox-primary" checked={form.is_tax_included} onChange={handleFormChange} />
                  </label>
                </div>
                
                {form.is_tax_included && (
                  <div className="form-control">
                    <label className="label font-medium"><span className="label-text">Related Tax Code (from Payment Voucher) *</span></label>
                    <select name="tax_code_id" className="select select-bordered w-full rounded-md" value={form.tax_code_id} onChange={handleFormChange} required>
                      <option value="">Select Tax Code</option>
                      {taxCodes.map(t => <option key={t.id} value={t.id}>{t.code} - {t.description}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Amount *</span></label>
                  <input type="number" step="0.01" name="amount" className="input input-bordered w-full rounded-md" value={form.amount} onChange={handleFormChange} required />
                </div>
                
                <div className="form-control md:col-span-2">
                  <label className="label font-medium"><span className="label-text">Remarks</span></label>
                  <textarea name="remarks" className="textarea textarea-bordered w-full rounded-md" value={form.remarks} onChange={handleFormChange} rows="2" />
                </div>
                
              </form>
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="expenseForm" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Create Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync(listPath, listContent);
console.log("Created FuelExpenseList.jsx");

// 2. Update TransportLayout.jsx
const layoutPath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

if (!layoutContent.includes('import FuelExpenseList')) {
  layoutContent = layoutContent.replace(
    /import TransportExpenseList from "\.\/expenses\/TransportExpenseList\.jsx";/,
    `import TransportExpenseList from "./expenses/TransportExpenseList.jsx";\nimport FuelExpenseList from "./fuel-expenses/FuelExpenseList.jsx";`
  );
}

if (!layoutContent.includes('path="fuel-expenses"')) {
  layoutContent = layoutContent.replace(
    /<Route path="billing" element=\{<BillingList \/>\} \/>/,
    `<Route path="fuel-expenses" element={<FuelExpenseList />} />\n        <Route path="billing" element={<BillingList />} />`
  );
}

if (!layoutContent.includes('Fuel & Vehicle Expenses')) {
  layoutContent = layoutContent.replace(
    /<ActionButton\s+label="Transport Expenses"/,
    `<ActionButton\n                  label="Fuel & Vehicle Expenses"\n                  path="fuel-expenses"\n                  type="btn-outline"\n                  featureKey="TRANSPORT.FUEL_EXPENSES"\n                  action="VIEW"\n                />\n                <ActionButton\n                  label="Transport Expenses"`
  );
}

fs.writeFileSync(layoutPath, layoutContent);
console.log("Updated TransportLayout.jsx");

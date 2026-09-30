import fs from 'fs';
import path from 'path';

// Generate TransportIncomeList.jsx
const incomeContent = `import React, { useState, useEffect } from "react";
import { Plus, Loader2, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function TransportIncomeList() {
  const [items, setItems] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    trip_id: "", vehicle_id: "", income_date: new Date().toISOString().split('T')[0],
    amount: "", currency: "GHS", description: "", status: "PENDING",
    customer_id: "", customer_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "",
    reference_no: "", cheque_date: "", cost_center_id: ""
  });

  const customerSearchResults = React.useMemo(() => {
    const q = String(customerSearch || "").trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c => 
      String(c.customer_name || "").toLowerCase().includes(q) ||
      String(c.customer_code || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [customerSearch, customers]);

  const fetchIncome = async () => {
    try {
      const res = await api.get("/transport/income");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load income"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchIncome();
    api.get("/transport/trips").then(r => setTrips(r.data?.items || [])).catch(() => {});
    api.get("/transport/vehicles").then(r => setVehicles(r.data?.items || [])).catch(() => {});
    api.get("/sales/customers").then(r => {
      setCustomers(r.data?.items || r.data?.data?.items || []);
    }).catch(() => {});
    api.get("/finance/accounts").then(r => setAccounts(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/tax-codes").then(r => setTaxCodes(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/cost-centers").then(r => setCostCenters(r.data?.items || r.data?.data?.items || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCustomerSearch("");
    setForm({ trip_id: "", vehicle_id: "", income_date: new Date().toISOString().split('T')[0], amount: "", currency: "GHS", description: "", status: "PENDING", customer_id: "", customer_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "", reference_no: "", cheque_date: "", cost_center_id: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setCustomerSearch("");
    const matchedCustomer = customers.find(c => String(c.id) === String(item.customer_id));
    setForm({ 
      trip_id: item.trip_id || "", vehicle_id: item.vehicle_id || "", income_date: item.income_date?.split('T')[0] || "", amount: item.amount, currency: item.currency || "GHS", description: item.description || "", status: item.status,
      customer_id: item.customer_id || "", customer_name: matchedCustomer?.customer_name || "", payment_method: item.payment_method || "Cash", payment_account_id: item.payment_account_id || "", is_tax_included: Boolean(item.is_tax_included), tax_code_id: item.tax_code_id || "",
      reference_no: item.reference_no || "", cheque_date: item.cheque_date?.split('T')[0] || "", cost_center_id: item.cost_center_id || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.amount || !form.customer_id || !form.payment_method || !form.payment_account_id) {
      toast.error("Please fill in all required fields (Amount, Customer, Payment Method, Account)");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(\`/transport/income/\${editing.id}\`, form);
        toast.success("Income updated");
      } else {
        const incomeRes = await api.post("/transport/income", form);
        const incomeId = incomeRes.data?.id;
        toast.success("Income recorded");
        
        try {
          const customer = customers.find(c => String(c.id) === String(form.customer_id));
          const trip = trips.find(p => String(p.id) === String(form.trip_id));
          const vehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id));
          
          let customerAcc = accounts.find(a => String(a.code) === String(customer?.customer_code));
          if (!customerAcc) {
            toast.error("Could not auto-create Receipt Voucher: Customer has no linked Financial Account.");
          } else {
            const rvData = {
              date: form.income_date,
              reference_no: form.reference_no || \`TRN-INC-\${incomeId}\`,
              currency: form.currency,
              cheque_no: form.reference_no,
              cheque_date: form.cheque_date,
              payment_method: form.payment_method,
              financial_account_id: form.payment_account_id,
              cost_center_id: form.cost_center_id,
              total_amount: form.amount,
              notes: form.description || \`Transportation Income - Trip: \${trip?.trip_no || 'N/A'}, Vehicle: \${vehicle?.registration_number || 'N/A'}\`,
              entries: [
                {
                  account_id: customerAcc.id,
                  description: form.description || "Transport Income",
                  amount: form.amount
                }
              ]
            };
            const rvRes = await api.post("/finance/vouchers/receipts", rvData);
            if (rvRes.data?.id) {
              await api.put(\`/transport/income/\${incomeId}/voucher\`, { voucher_id: rvRes.data.id });
              toast.success("Auto-created Receipt Voucher in Finance");
            }
          }
        } catch (e) {
          console.error("Auto RV error:", e);
        }
      }
      setShowModal(false);
      fetchIncome();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save income");
    } finally {
      setSaving(false);
    }
  };

  const { items: sortedItems, requestSort, sortConfig } = useSort(items);
  const filteredItems = sortedItems.filter(i => 
    String(i.trip_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.vehicle_reg || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transportation Income</h2>
          <p className="text-gray-500">Manage income records for trips and vehicles.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/transport" className="btn btn-outline">Back to Transport</Link>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Record Income
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search income records..."
            className="input w-full max-w-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <SortableHeader label="Date" field="income_date" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Trip No" field="trip_no" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Vehicle" field="vehicle_reg" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Customer" field="customer_name" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Amount" field="amount" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Status" field="status" sortConfig={sortConfig} requestSort={requestSort} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.income_date).toLocaleDateString()}</td>
                    <td>{item.trip_no || '-'}</td>
                    <td>{item.vehicle_reg || '-'}</td>
                    <td>{item.customer_name || '-'}</td>
                    <td>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={\`badge \${item.status === 'POSTED' || item.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}\`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status !== 'POSTED' && item.status !== 'APPROVED' && (
                        <button onClick={() => openEdit(item)} className="btn btn-ghost btn-sm text-blue-600">Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan="7" className="text-center py-4 text-gray-500">No income records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{editing ? "Edit Income" : "Record Income"}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Trip (Optional)</span></label>
                  <select className="select select-bordered" value={form.trip_id} onChange={e => setForm({...form, trip_id: e.target.value})}>
                    <option value="">-- Select Trip --</option>
                    {trips.map(p => <option key={p.id} value={p.id}>{p.trip_no}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Vehicle (Optional)</span></label>
                  <select className="select select-bordered" value={form.vehicle_id} onChange={e => setForm({...form, vehicle_id: e.target.value})}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map(p => <option key={p.id} value={p.id}>{p.registration_number}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Amount *</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">{form.currency}</span>
                    <input type="number" step="0.01" required className="input input-bordered w-full pl-12" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Date *</span></label>
                  <input type="date" required className="input input-bordered w-full" value={form.income_date} onChange={e => setForm({...form, income_date: e.target.value})} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Client / Organization *</span></label>
                  <div className="relative">
                    <input type="text" placeholder="Search Client..." className="input input-bordered w-full" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onClick={() => setCustomerSearch(form.customer_name || " ")} />
                    {customerSearchResults.length > 0 && (
                      <ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto">
                        {customerSearchResults.map(c => (
                          <li key={c.id}>
                            <button type="button" className="w-full text-left px-4 py-2 hover:bg-base-200" onClick={() => { setForm({...form, customer_id: c.id, customer_name: c.customer_name}); setCustomerSearch(""); }}>
                              {c.customer_name} ({c.customer_code})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {form.customer_id && <div className="text-sm text-green-600 mt-1">Selected: {form.customer_name}</div>}
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Payment Method *</span></label>
                  <select className="select select-bordered" required value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option><option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Deposit Account (RV) *</span></label>
                  <select className="select select-bordered" required value={form.payment_account_id} onChange={e => setForm({...form, payment_account_id: e.target.value})}>
                    <option value="">-- Select Account --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Cost Center</span></label>
                  <select className="select select-bordered" value={form.cost_center_id} onChange={e => setForm({...form, cost_center_id: e.target.value})}>
                    <option value="">-- No Cost Center --</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} />
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Description</span></label>
                <textarea className="textarea textarea-bordered h-24" value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.mkdirSync('client/src/pages/modules/transport/income', { recursive: true });
fs.writeFileSync('client/src/pages/modules/transport/income/TransportIncomeList.jsx', incomeContent);


// Generate TransportExpenseList.jsx
const expenseContent = `import React, { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function TransportExpenseList() {
  const [items, setItems] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [form, setForm] = useState({
    trip_id: "", vehicle_id: "", expense_date: new Date().toISOString().split('T')[0],
    amount: "", currency: "GHS", description: "", status: "PENDING",
    supplier_id: "", supplier_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "",
    reference_no: "", cheque_date: "", cost_center_id: ""
  });

  const supplierSearchResults = React.useMemo(() => {
    const q = String(supplierSearch || "").trim().toLowerCase();
    if (!q) return [];
    return suppliers.filter(s => 
      String(s.supplier_name || "").toLowerCase().includes(q) ||
      String(s.supplier_code || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [supplierSearch, suppliers]);

  const fetchExpenses = async () => {
    try {
      const res = await api.get("/transport/expenses");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load expenses"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchExpenses();
    api.get("/transport/trips").then(r => setTrips(r.data?.items || [])).catch(() => {});
    api.get("/transport/vehicles").then(r => setVehicles(r.data?.items || [])).catch(() => {});
    api.get("/purchase/suppliers").then(r => {
      setSuppliers(r.data?.items || r.data?.data?.items || []);
    }).catch(() => {});
    api.get("/finance/accounts").then(r => setAccounts(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/tax-codes").then(r => setTaxCodes(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/cost-centers").then(r => setCostCenters(r.data?.items || r.data?.data?.items || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setSupplierSearch("");
    setForm({ trip_id: "", vehicle_id: "", expense_date: new Date().toISOString().split('T')[0], amount: "", currency: "GHS", description: "", status: "PENDING", supplier_id: "", supplier_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "", reference_no: "", cheque_date: "", cost_center_id: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setSupplierSearch("");
    const matchedSupplier = suppliers.find(s => String(s.id) === String(item.supplier_id));
    setForm({ 
      trip_id: item.trip_id || "", vehicle_id: item.vehicle_id || "", expense_date: item.expense_date?.split('T')[0] || "", amount: item.amount, currency: item.currency || "GHS", description: item.description || "", status: item.status,
      supplier_id: item.supplier_id || "", supplier_name: matchedSupplier?.supplier_name || "", payment_method: item.payment_method || "Cash", payment_account_id: item.payment_account_id || "", is_tax_included: Boolean(item.is_tax_included), tax_code_id: item.tax_code_id || "",
      reference_no: item.reference_no || "", cheque_date: item.cheque_date?.split('T')[0] || "", cost_center_id: item.cost_center_id || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.amount || !form.supplier_id || !form.payment_method || !form.payment_account_id) {
      toast.error("Please fill in all required fields (Amount, Supplier, Payment Method, Account)");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(\`/transport/expenses/\${editing.id}\`, form);
        toast.success("Expense updated");
      } else {
        const expRes = await api.post("/transport/expenses", form);
        const expId = expRes.data?.id;
        toast.success("Expense recorded");
        
        try {
          const supplier = suppliers.find(s => String(s.id) === String(form.supplier_id));
          const trip = trips.find(p => String(p.id) === String(form.trip_id));
          const vehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id));
          
          let suppAcc = accounts.find(a => String(a.code) === String(supplier?.supplier_code));
          if (!suppAcc) {
            toast.error("Could not auto-create Payment Voucher: Supplier has no linked Financial Account.");
          } else {
            const pvData = {
              date: form.expense_date,
              reference_no: form.reference_no || \`TRN-EXP-\${expId}\`,
              currency: form.currency,
              cheque_no: form.reference_no,
              cheque_date: form.cheque_date,
              payment_method: form.payment_method,
              financial_account_id: form.payment_account_id,
              cost_center_id: form.cost_center_id,
              total_amount: form.amount,
              notes: form.description || \`Transportation Expense - Trip: \${trip?.trip_no || 'N/A'}, Vehicle: \${vehicle?.registration_number || 'N/A'}\`,
              entries: [
                {
                  account_id: suppAcc.id,
                  description: form.description || "Transport Expense",
                  amount: form.amount
                }
              ]
            };
            const pvRes = await api.post("/finance/vouchers/payments", pvData);
            if (pvRes.data?.id) {
              await api.put(\`/transport/expenses/\${expId}/voucher\`, { voucher_id: pvRes.data.id });
              toast.success("Auto-created Payment Voucher in Finance");
            }
          }
        } catch (e) {
          console.error("Auto PV error:", e);
        }
      }
      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const { items: sortedItems, requestSort, sortConfig } = useSort(items);
  const filteredItems = sortedItems.filter(i => 
    String(i.trip_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.vehicle_reg || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.supplier_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transportation Expenses</h2>
          <p className="text-gray-500">Manage expense records for trips and vehicles.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/transport" className="btn btn-outline">Back to Transport</Link>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Record Expense
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search expense records..."
            className="input w-full max-w-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <SortableHeader label="Date" field="expense_date" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Trip No" field="trip_no" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Vehicle" field="vehicle_reg" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Supplier" field="supplier_name" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Amount" field="amount" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Status" field="status" sortConfig={sortConfig} requestSort={requestSort} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.expense_date).toLocaleDateString()}</td>
                    <td>{item.trip_no || '-'}</td>
                    <td>{item.vehicle_reg || '-'}</td>
                    <td>{item.supplier_name || '-'}</td>
                    <td>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={\`badge \${item.status === 'POSTED' || item.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}\`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status !== 'POSTED' && item.status !== 'APPROVED' && (
                        <button onClick={() => openEdit(item)} className="btn btn-ghost btn-sm text-blue-600">Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan="7" className="text-center py-4 text-gray-500">No expense records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{editing ? "Edit Expense" : "Record Expense"}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Trip (Optional)</span></label>
                  <select className="select select-bordered" value={form.trip_id} onChange={e => setForm({...form, trip_id: e.target.value})}>
                    <option value="">-- Select Trip --</option>
                    {trips.map(p => <option key={p.id} value={p.id}>{p.trip_no}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Vehicle (Optional)</span></label>
                  <select className="select select-bordered" value={form.vehicle_id} onChange={e => setForm({...form, vehicle_id: e.target.value})}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map(p => <option key={p.id} value={p.id}>{p.registration_number}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Amount *</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">{form.currency}</span>
                    <input type="number" step="0.01" required className="input input-bordered w-full pl-12" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Date *</span></label>
                  <input type="date" required className="input input-bordered w-full" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Supplier *</span></label>
                  <div className="relative">
                    <input type="text" placeholder="Search Supplier..." className="input input-bordered w-full" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} onClick={() => setSupplierSearch(form.supplier_name || " ")} />
                    {supplierSearchResults.length > 0 && (
                      <ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto">
                        {supplierSearchResults.map(s => (
                          <li key={s.id}>
                            <button type="button" className="w-full text-left px-4 py-2 hover:bg-base-200" onClick={() => { setForm({...form, supplier_id: s.id, supplier_name: s.supplier_name}); setSupplierSearch(""); }}>
                              {s.supplier_name} ({s.supplier_code})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {form.supplier_id && <div className="text-sm text-green-600 mt-1">Selected: {form.supplier_name}</div>}
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Payment Method *</span></label>
                  <select className="select select-bordered" required value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option><option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Payment Source (PV) *</span></label>
                  <select className="select select-bordered" required value={form.payment_account_id} onChange={e => setForm({...form, payment_account_id: e.target.value})}>
                    <option value="">-- Select Account --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Cost Center</span></label>
                  <select className="select select-bordered" value={form.cost_center_id} onChange={e => setForm({...form, cost_center_id: e.target.value})}>
                    <option value="">-- No Cost Center --</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} />
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Description</span></label>
                <textarea className="textarea textarea-bordered h-24" value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.mkdirSync('client/src/pages/modules/transport/expenses', { recursive: true });
fs.writeFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', expenseContent);

console.log('Successfully created TransportIncomeList.jsx and TransportExpenseList.jsx');

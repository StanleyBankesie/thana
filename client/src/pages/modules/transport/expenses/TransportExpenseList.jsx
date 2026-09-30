import React, { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function TransportExpenseList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [expenseLogs, setExpenseLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [complianceBills, setComplianceBills] = useState([]);
  const [servicingBills, setServicingBills] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
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
    expense_log_id: "", vehicle_id: "", compliance_id: "", servicing_id: "", expense_date: new Date().toISOString().split('T')[0],
    amount: "", currency: "GHS", description: "", status: "PENDING",
    supplier_id: "", supplier_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "",
    reference_no: "", cheque_date: "", cost_center_id: "", expense_type: "Other"
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
    api.get("/transport/expense-logs").then(r => setExpenseLogs(r.data?.data?.items || r.data?.items || [])).catch(() => {});
    api.get("/transport/vehicles").then(r => setVehicles(r.data?.data?.items || r.data?.items || [])).catch(() => {});
    api.get("/transport/compliance").then(r => setComplianceBills(r.data?.data?.items || r.data?.items || [])).catch(() => {});
    api.get("/transport/servicing").then(r => setServicingBills(r.data?.data?.items || r.data?.items || [])).catch(() => {});
    api.get("/transport/setup").then(r => {
      const items = r.data?.data?.items || r.data?.items || [];
      setExpenseTypes(items.filter(i => i.setup_type === 'EXPENSE_TYPE' && i.is_active));
    }).catch(() => {});
    api.get("/purchase/suppliers").then(r => {
      setSuppliers(r.data?.items || r.data?.data?.items || []);
    }).catch(() => {});
    api.get("/finance/accounts").then(r => setAccounts(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/tax-codes", { params: { form: "TRANSPORT_EXPENSES" } }).then(r => {
      const allTaxes = r.data?.items || r.data?.data?.items || [];
      setTaxCodes(allTaxes.filter(t => Number(t.is_active || 0) === 1));
    }).catch(() => {});
    api.get("/finance/cost-centers").then(r => setCostCenters(r.data?.items || r.data?.data?.items || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ expense_log_id: "", vehicle_id: "", compliance_id: "", servicing_id: "", expense_date: new Date().toISOString().split('T')[0], amount: "", currency: "GHS", description: "", status: "PENDING", supplier_id: "", supplier_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "", reference_no: "", cheque_date: "", cost_center_id: "", expense_type: "Other" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const matchedSupplier = suppliers.find(s => String(s.id) === String(item.supplier_id));
    setSupplierSearch(matchedSupplier?.supplier_name || "");
    setForm({
      expense_type: item.expense_type || "Other",
      expense_log_id: item.expense_log_id || "", vehicle_id: item.vehicle_id || "", compliance_id: item.compliance_id || "", servicing_id: item.servicing_id || "", 
      expense_date: item.expense_date?.split('T')[0] || "", amount: item.amount, currency: item.currency || "GHS", description: item.description || "", status: item.status,
      supplier_id: item.supplier_id || "", supplier_name: item.supplier_name || "", payment_method: item.payment_method || "Cash", payment_account_id: item.payment_account_id || "", is_tax_included: Number(item.is_tax_included)===1, tax_code_id: item.tax_code_id || "",
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
    let description = form.description;
    if (!description) {
      if (form.expense_type === "Compliance" && form.compliance_id) {
        const comp = complianceBills.find(p => String(p.id) === String(form.compliance_id));
        description = `Transportation Expense - Compliance: ${comp?.compliance_type || 'N/A'}`;
      } else if (form.expense_type === "Servicing" && form.servicing_id) {
        const srv = servicingBills.find(p => String(p.id) === String(form.servicing_id));
        description = `Transportation Expense - Servicing: ${srv?.service_no || 'N/A'}`;
      } else if (form.expense_log_id) {
        const log = expenseLogs.find(p => String(p.id) === String(form.expense_log_id));
        description = `Transportation Expense - Log: ${log?.log_no || 'N/A'}`;
      } else {
        const vehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id));
        description = `Transportation Expense - Vehicle: ${vehicle?.registration_number || 'N/A'}`;
      }
    }
    const finalForm = { ...form, description };

    try {
      if (editing) {
        await api.put(`/transport/expenses/${editing.id}`, finalForm);
        toast.success("Expense updated");
      } else {
        const expRes = await api.post("/transport/expenses", finalForm);
        const expId = expRes.data?.id;
        toast.success("Expense recorded");
        
        try {
          const supplier = suppliers.find(s => String(s.id) === String(form.supplier_id));
          const vehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id));
          
          let suppAcc = accounts.find(a => String(a.code) === String(supplier?.supplier_code));
          if (!suppAcc) {
            toast.error("Could not auto-create Payment Voucher: Supplier has no linked Financial Account.");
          } else {
            const totalAmount = Number(form.amount);
            let totalTaxAmount = 0;
            const newLines = [];
            const currencyCode = form.currency || "GHS";

            // 1. Credit the Supplier Account
            newLines.push({
              accountId: String(suppAcc.id),
              accountName: suppAcc.name || "",
              description: description,
              currencyCode,
              debit: 0,
              credit: totalAmount,
            });

            // 2. Debit Tax Components if applicable
            if (form.is_tax_included && form.tax_code_id) {
              try {
                const resp = await api.get(`/finance/tax-codes/${form.tax_code_id}/components`);
                const comps = Array.isArray(resp.data?.items) ? resp.data.items : [];
                comps.forEach(comp => {
                  const rate = Number(comp.rate_percent || 0);
                  const compTaxAmount = Math.round(totalAmount * rate) / 100;
                  totalTaxAmount += compTaxAmount;
                  if (comp.account_id) {
                    newLines.push({
                      accountId: String(comp.account_id),
                      accountName: comp.account_name || "",
                      description: description || `Tax - ${comp.component_name || ""}`,
                      currencyCode,
                      debit: compTaxAmount,
                      credit: 0,
                      taxCodeId: form.tax_code_id
                    });
                  }
                });
              } catch (err) {
                console.error("Failed to load tax components", err);
              }
            }

            // 3. Debit Expense Account (Net Amount)
            const netAmount = totalAmount - totalTaxAmount;
            if (netAmount > 0) {
              const defaultExpAcc = accounts.find(a => String(a.group_code || "").toUpperCase() === "EXP_OPS" || String(a.group_name || "").toUpperCase().includes("EXPENSE"));
              newLines.push({
                accountId: String(defaultExpAcc?.id || suppAcc.id),
                accountName: defaultExpAcc?.name || suppAcc.name || "",
                description: description,
                currencyCode,
                debit: netAmount,
                credit: 0,
                taxCodeId: form.is_tax_included ? form.tax_code_id : undefined
              });
            }

            const voucherPayload = {
              voucherTypeCode: "PAYV",
              voucherDate: form.expense_date,
              isDirectPayment: true,
              status: "DRAFT",
              paymentDetails: {
                accountId: suppAcc.id,
                paymentAccountId: form.payment_account_id,
                totalAmount: totalAmount,
                baseAmount: totalAmount,
                baseCurrencyCode: currencyCode,
                currencyCode: currencyCode,
                description: description,
                referenceNo: form.reference_no,
              },
              narration: `Paid to: ${form.supplier_name} | Method: ${form.payment_method}${form.reference_no ? ` | Ref: ${form.reference_no}` : ''} | ${description || ''}`,
              lines: newLines,
              costCenterId: form.cost_center_id
            };
            
            const resVoucher = await api.post("/finance/vouchers", voucherPayload);
            if (resVoucher.data?.id && expId) {
              await api.put(`/transport/expenses/${expId}/voucher`, { voucher_id: resVoucher.data.id });
              toast.success("Payment Voucher auto-generated");
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

  const { sorted: sortedItems, sortKey, sortDir, toggle: requestSort } = useSort(items, "expense_date", "desc");
  const filteredItems = sortedItems.filter(i => 
    String(i.trip_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.vehicle_reg || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.supplier_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableServicingBills = servicingBills.filter(p => !items.some(exp => String(exp.servicing_id) === String(p.id)) || String(p.id) === String(form.servicing_id));

  const handleServicingChange = (e) => {
    const val = e.target.value;
    const selected = servicingBills.find(p => String(p.id) === String(val));
    if (selected) {
      setForm(f => ({ ...f, servicing_id: val, amount: selected.total_cost || f.amount, vehicle_id: selected.vehicle_id || f.vehicle_id }));
    } else {
      setForm(f => ({ ...f, servicing_id: val }));
    }
  };

  const handleComplianceChange = (e) => {
    const val = e.target.value;
    const selected = complianceBills.find(p => String(p.id) === String(val));
    if (selected) {
      setForm(f => ({ ...f, compliance_id: val, amount: selected.premium_amount || f.amount, vehicle_id: selected.vehicle_id || f.vehicle_id }));
    } else {
      setForm(f => ({ ...f, compliance_id: val }));
    }
  };

  const handleExpenseLogChange = (e) => {
    const val = e.target.value;
    const selected = expenseLogs.find(p => String(p.id) === String(val));
    if (selected) {
      setForm(f => ({ 
        ...f, 
        expense_log_id: val, 
        amount: selected.amount || f.amount, 
        vehicle_id: selected.vehicle_id || f.vehicle_id,
        supplier_id: selected.supplier_id || f.supplier_id,
        supplier_name: selected.supplier_name || f.supplier_name
      }));
      if (selected.supplier_name) {
        setSupplierSearch(selected.supplier_name);
      }
    } else {
      setForm(f => ({ ...f, expense_log_id: val }));
    }
  };

  return (
    <div className="p-4 w-full mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transportation Expenses</h2>
          <p className="text-gray-500">Manage expense records for trips and vehicles.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn btn-outline">Back to Transport</button>
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
          
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "table w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead>
                <tr>
                  <SortableHeader label="Date" sortKey="expense_date" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Trip No" sortKey="trip_no" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Vehicle" sortKey="vehicle_reg" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Expense Type" sortKey="expense_type" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={requestSort} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.expense_date).toLocaleDateString()}</td>
                    <td>{item.trip_no || '-'}</td>
                    <td>{item.vehicle_reg || '-'}</td>
                    <td><span className="badge badge-outline">{item.expense_type || 'Other'}</span></td>
                    <td>{item.supplier_name || '-'}</td>
                    <td>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${item.status === 'POSTED' || item.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="btn btn-ghost btn-sm text-slate-500 hover:text-slate-700" title="View Details">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
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
        
</>
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
                  <label className="label"><span className="label-text">Expense Type</span></label>
                  <select className="input input-bordered w-full" value={form.expense_type} onChange={e => setForm({...form, expense_type: e.target.value, expense_log_id: "", compliance_id: "", servicing_id: ""})}>
                    {expenseTypes.map(t => (
                      <option key={t.id} value={t.setup_value}>{t.setup_value}</option>
                    ))}
                    <option value="Compliance">Compliance</option>
                    <option value="Servicing">Servicing</option>
                    {expenseTypes.length === 0 && (
                      <>
                        <option value="Road Worthy">Road Worthy</option>
                        <option value="Spare Parts">Spare Parts</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Fuel">Fuel</option>
                        <option value="Tolls">Tolls</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Vehicle</span></label>
                  <select className="input input-bordered w-full" value={form.vehicle_id} onChange={e => setForm({...form, vehicle_id: e.target.value})}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map(p => <option key={p.id} value={p.id}>{p.reg_number || p.registration_number}</option>)}
                  </select>
                </div>

                {form.expense_type === "Compliance" ? (
                  <div className="form-control">
                    <label className="label"><span className="label-text">Compliance Record</span></label>
                    <select className="input input-bordered w-full" value={form.compliance_id} onChange={handleComplianceChange}>
                      <option value="">-- Select Compliance --</option>
                      {complianceBills.map(p => <option key={p.id} value={p.id}>{p.compliance_type} ({p.premium_amount})</option>)}
                    </select>
                  </div>
                ) : form.expense_type === "Servicing" ? (
                  <div className="form-control">
                    <label className="label"><span className="label-text">Servicing Record</span></label>
                    <select className="input input-bordered w-full" value={form.servicing_id} onChange={handleServicingChange}>
                      <option value="">-- Select Servicing --</option>
                      {availableServicingBills.map(p => <option key={p.id} value={p.id}>{p.service_no} ({p.total_cost})</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="form-control">
                    <label className="label"><span className="label-text">Expense Log</span></label>
                    <select className="input input-bordered w-full" value={form.expense_log_id} onChange={handleExpenseLogChange}>
                      <option value="">-- Select Expense Log --</option>
                      {expenseLogs.map(p => <option key={p.id} value={p.id}>{p.expense_type} ({p.amount})</option>)}
                    </select>
                  </div>
                )}

                <div className="form-control">
                  <label className="label"><span className="label-text font-bold">Amount <span className="text-error">*</span></span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">{form.currency}</span>
                    <input type="number" step="0.01" required className="input input-bordered w-full pl-12" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Date *</span></label>
                  <input type="date" required className="input input-bordered w-full" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
                <div className="form-control relative z-50">
                  <label className="label"><span className="label-text font-bold">Supplier <span className="text-error">*</span></span></label>
                  <div className="relative z-50">
                    <input type="text" placeholder="Search Supplier..." className="input input-bordered w-full text-slate-900 font-medium" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); if(!e.target.value) setForm({...form, supplier_id: "", supplier_name: ""}); }} onClick={() => setSupplierSearch(" ")} />
                    {supplierSearchResults.length > 0 && supplierSearch !== form.supplier_name && (
                      <ul className="absolute z-[9999] w-full bg-white opacity-100 shadow-2xl rounded-box mt-1 max-h-48 overflow-y-auto border border-slate-300 isolate">
                        {supplierSearchResults.map(s => (
                          <li key={s.id}>
                            <button type="button" className="w-full text-left px-4 py-2 hover:bg-base-200" onClick={() => { setForm({...form, supplier_id: s.id, supplier_name: s.supplier_name}); setSupplierSearch(s.supplier_name); }}>
                              {s.supplier_name}
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
                  <select className="input input-bordered w-full" required value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option><option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Payment Source (PV) *</span></label>
                  <select className="input input-bordered w-full" required value={form.payment_account_id} onChange={e => setForm({...form, payment_account_id: e.target.value})}>
                    <option value="">-- Select Account --</option>
                    {accounts.filter(a => {
                      const gc = String(a.group_code || "").toUpperCase();
                      const gn = String(a.group_name || "").toUpperCase();
                      const isChequeLike = ['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method);
                      return isChequeLike ? (gc === "AST_BANK" || gn === "BANK ACCOUNTS") : (gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS");
                    }).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Cost Center</span></label>
                  <select className="input input-bordered w-full" value={form.cost_center_id} onChange={e => setForm({...form, cost_center_id: e.target.value})}>
                    <option value="">-- No Cost Center --</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="inline-flex items-center gap-2 text-sm pt-8 cursor-pointer">
                    <input type="checkbox" className="checkbox checkbox-primary" checked={form.is_tax_included} onChange={e => {
                        const checked = Boolean(e.target.checked);
                        setForm({...form, is_tax_included: checked, tax_code_id: checked ? form.tax_code_id : ""});
                      }} />
                    <span className="font-medium text-slate-700">Tax Applicable</span>
                  </label>
                  {form.is_tax_included && (
                    <select className="input input-bordered w-full mt-2" value={form.tax_code_id || ""} onChange={e => setForm({...form, tax_code_id: e.target.value})}>
                      <option value="">Select tax code</option>
                      {taxCodes.map(t => <option key={t.id} value={t.id}>{t.name || t.tax_name || t.code}</option>)}
                    </select>
                  )}
                </div>
                {['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method) && (
                  <>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                      <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} placeholder="Reference Number or Cheque Number" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Cheque Date</span></label>
                      <input type="date" className="input input-bordered w-full" value={form.cheque_date} onChange={e => setForm({...form, cheque_date: e.target.value})} />
                    </div>
                  </>
                )}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Description <span className="text-error">*</span></span></label>
                <textarea required className="textarea textarea-bordered border border-slate-300 rounded-lg w-full h-24 p-3" value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                {(!editing || (editing.status !== 'POSTED' && editing.status !== 'APPROVED')) && (
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

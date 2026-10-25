import React, { useState, useEffect } from "react";
import { Plus, Loader2, DollarSign, TrendingUp, ArrowLeft, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import ProjectModal from "../components/ProjectModal.jsx";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function ProjectIncomeList() {
  const location = useLocation();
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
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
    project_id: "", income_date: new Date().toISOString().split('T')[0],
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
      const res = await api.get("/projects/income");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load income"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchIncome();
    api.get("/projects/projects").then(r => setProjects(r.data?.items || [])).catch(() => {});
    api.get("/sales/customers?service_customer=Y").then(r => {
      setCustomers(r.data?.items || r.data?.data?.items || []);
    }).catch(() => {});
    api.get("/finance/accounts").then(r => setAccounts(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/tax-codes").then(r => setTaxCodes(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    api.get("/finance/cost-centers").then(r => setCostCenters(r.data?.items || r.data?.data?.items || [])).catch(() => {});
    if (location.pathname.endsWith("/new")) {
      openCreate();
    }
  }, [location.pathname]);

  const openCreate = () => {
    setEditing(null);
    setCustomerSearch("");
    setForm({ project_id: "", income_date: new Date().toISOString().split('T')[0], amount: "", currency: "GHS", description: "", status: "PENDING", customer_id: "", customer_name: "", payment_method: "Cash", payment_account_id: "", is_tax_included: false, tax_code_id: "", reference_no: "", cheque_date: "", cost_center_id: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setCustomerSearch("");
    const matchedCustomer = customers.find(c => String(c.id) === String(item.customer_id));
    setForm({ 
      project_id: item.project_id, income_date: item.income_date?.split('T')[0] || "", amount: item.amount, currency: item.currency || "GHS", description: item.description || "", status: item.status,
      customer_id: item.customer_id || "", customer_name: matchedCustomer?.customer_name || "", payment_method: item.payment_method || "Cash", payment_account_id: item.payment_account_id || "", is_tax_included: Boolean(item.is_tax_included), tax_code_id: item.tax_code_id || "",
      reference_no: item.reference_no || "", cheque_date: item.cheque_date?.split('T')[0] || "", cost_center_id: item.cost_center_id || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.project_id || !form.income_date || !form.amount || !form.customer_id || !form.payment_method || !form.payment_account_id) {
      toast.error("Please fill in all required fields (Project, Date, Amount, Client, Payment Method, Account)");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/projects/income/${editing.id}`, form);
        toast.success("Income updated");
      } else {
        const incomeRes = await api.post("/projects/income", form);
        const incomeId = incomeRes.data?.id;
        toast.success("Income recorded");
        
        try {
          const customer = customers.find(c => String(c.id) === String(form.customer_id));
          const project = projects.find(p => String(p.id) === String(form.project_id));
          
          let customerAcc = accounts.find(a => String(a.code) === String(customer?.customer_code));
          if (customerAcc && customerAcc.name !== customer?.customer_name) {
            const nameMatch = accounts.find(a => String(a.name).trim().toLowerCase() === String(customer?.customer_name).trim().toLowerCase());
            if (nameMatch) customerAcc = nameMatch;
          } else if (!customerAcc) {
            const nameMatch = accounts.find(a => String(a.name).trim().toLowerCase() === String(customer?.customer_name).trim().toLowerCase());
            if (nameMatch) customerAcc = nameMatch;
          }

          if (!customerAcc) {
            try {
              const freshRes = await api.get(`/finance/accounts?search=${encodeURIComponent(customer?.customer_name || '')}&t=${Date.now()}`);
              const freshAccounts = freshRes.data?.items || [];
              customerAcc = freshAccounts.find(a => String(a.name).trim().toLowerCase() === String(customer?.customer_name).trim().toLowerCase()) 
                         || freshAccounts.find(a => String(a.code) === String(customer?.customer_code));
            } catch (e) {}
          }

          const incomeAccountId = customer?.sales_account_id;
          
          if (!customerAcc) {
            toast.warn("Could not auto-create Receipt Voucher: Customer has no linked Financial Account.");
          } else if (!incomeAccountId) {
            toast.warn("Could not auto-create Receipt Voucher: Customer has no default Sales/Income Account.");
          } else {
            const totalAmount = Number(form.amount);
            let totalTaxAmount = 0;
            const newLines = [];
            const description = form.description || `Project Income: ${project?.project_name || ''}`;
            const currencyCode = form.currency || "GHS";

            // 1. Debit the Customer Account initially
            newLines.push({
              accountId: String(customerAcc.id),
              accountName: customerAcc.name || "",
              description: description,
              currencyCode,
              debit: totalAmount,
              credit: 0,
            });

            // 2. Credit Tax Components if applicable
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
                      debit: 0,
                      credit: compTaxAmount,
                      taxCodeId: form.tax_code_id
                    });
                  }
                });
              } catch (err) {
                console.error("Failed to load tax components", err);
              }
            }

            // 3. Credit Income Account (Net Amount)
            const netAmount = totalAmount - totalTaxAmount;
            if (netAmount > 0) {
              const incomeAccObj = accounts.find(a => String(a.id) === String(incomeAccountId));
              newLines.push({
                accountId: String(incomeAccountId),
                accountName: incomeAccObj?.name || customer?.customer_name || "",
                description: description,
                currencyCode,
                debit: 0,
                credit: netAmount,
                taxCodeId: form.is_tax_included ? form.tax_code_id : undefined
              });
            }

            const voucherPayload = {
              voucherTypeCode: "RV",
              voucherDate: form.income_date,
              isDirectPayment: true,
              status: "POSTED",
              paymentDetails: {
                accountId: customerAcc.id,
                paymentAccountId: form.payment_account_id,
                totalAmount: totalAmount,
                baseAmount: totalAmount,
                baseCurrencyCode: currencyCode,
                currencyCode: currencyCode,
                description: description,
              },
              narration: `Received from: ${form.customer_name} | Method: ${form.payment_method}${form.reference_no ? ` | Ref: ${form.reference_no}` : ''} | ${form.description || ''}`,
              lines: newLines,
              projectId: form.project_id,
              costCenterId: form.cost_center_id
            };
            
            const resVoucher = await api.post("/finance/vouchers", voucherPayload);
            if (resVoucher.data?.id && incomeId) {
              await api.put(`/projects/income/${incomeId}/voucher`, { voucher_id: resVoucher.data.id });
            }
            toast.success("Receipt Voucher auto-generated");
          }
        } catch (err) {
           console.error("Voucher creation error", err?.response?.data || err);
           toast.error(err?.response?.data?.message || err?.response?.data?.error || "Income saved but failed to generate Receipt Voucher");
        }
      }
      setShowModal(false);
      fetchIncome();
    } catch { toast.error("Failed to save income"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this income entry?")) return;
    try {
      await api.delete(`/projects/income/${id}`);
      toast.success("Income deleted");
      fetchIncome();
    } catch { toast.error("Failed to delete"); }
  };

  const filtered = items.filter(i =>
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.cost_center_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "id", "desc");
  const totalIncome = items.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      {/* Canonical Header */}
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
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Search income..." className="input pl-9 pr-3 py-1.5 text-sm h-auto w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "table table-fixed w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead>
                <tr>
                  <SortableHeader label="Project" sortKey="project_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-[15%]" />
                  <SortableHeader label="Date" sortKey="income_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-[12%]" />
                  <SortableHeader label="Client" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-[15%]" />
                  <SortableHeader label="Cost Center" sortKey="cost_center_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-[12%]" />
                  <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-[20%]" />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right w-[10%]" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center w-[8%]" />
                  <th className="text-right w-[8%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sorted.length > 0 ? sorted.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">
                      <div className="font-bold text-sm">{item.project_name || "—"}</div>
                    </td>
                    <td className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">{item.income_date ? new Date(item.income_date).toLocaleDateString() : "—"}</td>
                    <td className="text-sm text-slate-700 dark:text-slate-300 font-medium overflow-hidden text-ellipsis whitespace-nowrap">{item.customer_name || "—"}</td>
                    <td className="text-sm text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">{item.cost_center_name || "—"}</td>
                    <td className="text-sm text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap">{item.description || "—"}</td>
                    <td className="text-right font-semibold">GHS {Number(item.amount).toLocaleString()}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.status === 'APPROVED' || item.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{item.status || 'PENDING'}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status !== 'APPROVED' && item.status !== 'POSTED' && (
                          <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="text-center py-8 text-slate-400">No income recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Income" : "Record Income"}
        subtitle={editing ? "Update milestone payment, client receipt, or contract billing" : "Record project inflows, milestone payments, and client receipts"}
        icon={TrendingUp}
        onSubmit={handleSubmit}
        submitting={saving}
        submitLabel={editing ? "Update Income" : "Confirm Income"}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Project <span className="text-red-500">*</span></label>
            <select required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}>
              <option value="">Select Project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Client <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Type to search clients"
              value={customerSearch || form.customer_name || ""}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (!e.target.value) {
                  setForm(prev => ({ ...prev, customer_name: "", customer_id: "" }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customerSearchResults.length > 0) {
                  e.preventDefault();
                  const selected = customerSearchResults[0];
                  setCustomerSearch("");
                  setForm(prev => ({ ...prev, customer_id: selected.id, customer_name: selected.customer_name }));
                }
              }}
            />
            {customerSearch && customerSearchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                {customerSearchResults.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs"
                    onClick={() => {
                      setCustomerSearch("");
                      setForm(prev => ({ ...prev, customer_id: c.id, customer_name: c.customer_name }));
                    }}
                  >
                    {c.customer_name} {c.customer_code ? `(${c.customer_code})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Date <span className="text-red-500">*</span></label>
            <input type="date" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.income_date} onChange={e => setForm({...form, income_date: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Amount (GHS) <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Cost Center</label>
            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.cost_center_id} onChange={e => setForm({...form, cost_center_id: e.target.value})}>
              <option value="">Select Cost Center...</option>
              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Method</label>
            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.payment_method} onChange={e => {
              const newMethod = e.target.value;
              setForm({...form, payment_method: newMethod, payment_account_id: ""});
            }}>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Transfer">Transfer</option>
              <option value="Credit">Credit</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Receipt Account</label>
            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.payment_account_id} onChange={e => setForm({...form, payment_account_id: e.target.value})}>
              <option value="">Select Account...</option>
              {accounts.filter(a => {
                const gc = String(a.group_code || "").toUpperCase();
                const gn = String(a.group_name || "").toUpperCase();
                return form.payment_method !== "Cash" 
                  ? (gc === "AST_BANK" || gn === "BANK ACCOUNTS")
                  : (gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS");
              }).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          {form.payment_method !== "Cash" ? (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Reference / Cheque No</label>
              <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} />
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" className="checkbox checkbox-sm" checked={form.is_tax_included} onChange={e => setForm({...form, is_tax_included: e.target.checked})} />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tax Included</span>
            </div>
          )}
        </div>

        {form.payment_method !== "Cash" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Cheque Date</label>
              <input type="date" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.cheque_date} onChange={e => setForm({...form, cheque_date: e.target.value})} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" className="checkbox checkbox-sm" checked={form.is_tax_included} onChange={e => setForm({...form, is_tax_included: e.target.checked})} />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tax Included</span>
            </div>
          </div>
        )}

        {form.is_tax_included && (
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Tax Code</label>
            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.tax_code_id} onChange={e => setForm({...form, tax_code_id: e.target.value})}>
              <option value="">Select Tax Code...</option>
              {taxCodes.map(t => <option key={t.id} value={t.id}>{t.name || t.tax_name || t.code}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Description / Notes</label>
          <textarea rows={3} placeholder="Notes, milestone billing reference, or remarks..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
      </ProjectModal>
    </div>
  );
}

/**
 * @fileoverview ServiceParametersPage component.
 * Provides functionality for ServiceParametersPage.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Plus, Edit2, Trash2, Loader2, X, Building2, Pencil } from "lucide-react";
import PhoneInput from "../../../../components/PhoneInput.jsx";

const TABS = [
  { key: "clients", label: "Clients" },
  { key: "suppliers", label: "Suppliers" },
  { key: "work-locations", label: "Work Locations", endpoint: "/purchase/service-setup/work-locations", fieldLabel: "Location Name", placeholder: "e.g., HQ Facility" },
  { key: "service-types", label: "Service Types", endpoint: "/purchase/service-setup/service-types", fieldLabel: "Type Name", placeholder: "e.g., Installation" },
  { key: "categories", label: "Service Categories", endpoint: "/purchase/service-setup/categories", fieldLabel: "Category Name", placeholder: "e.g., Maintenance" },
  { key: "time-slots", label: "Time Slots", endpoint: "/purchase/service-setup/time-slots", fieldLabel: "Time Range", placeholder: "e.g., 12:00pm - 2:00pm" },
  { key: "timelines", label: "Timelines", endpoint: "/purchase/service-setup/timelines", fieldLabel: "Timeline", placeholder: "e.g., 1 - 7 Days" },
  { key: "supervisors", label: "Supervisors", endpoint: "/purchase/service-setup/supervisors", fieldLabel: "Supervisor", placeholder: null },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */

/* --- Helpers --- */
function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CrudSection({ title, icon, emptyMsg, columns, rows, loading, onAdd, onEdit, onDelete, renderRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          {icon} {title}
        </h3>
        <button onClick={onAdd} className="btn-primary text-xs py-1.5 px-3 rounded flex items-center gap-1">
          <Plus size={14} /> Add New
        </button>
      </div>
      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              {columns.map((c, i) => <th key={i} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={columns.length} className="p-8 text-center"><Loader2 className="animate-spin inline-block" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="p-8 text-center text-slate-500 text-sm">{emptyMsg}</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {renderRow(r)}
                  <td className="px-4 py-2 text-right space-x-2 w-24">
                    {onEdit && <button onClick={() => onEdit(r)} className="p-1 text-sky-600 hover:bg-sky-50 rounded"><Pencil size={14}/></button>}
                    {onDelete && <button onClick={() => onDelete(r)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ServiceParametersPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "work-locations";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  
  const [suppliers, setSuppliers] = useState([]);
  const [supModal, setSupModal] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({
    supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
    city: "", state: "", country: "Ghana", payment_terms: "", 
    tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
    service_contractor: true, industry: "Services", is_active: 1
  });
  const [supSaving, setSupSaving] = useState(false);

  const [clients, setClients] = useState([]);
  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    customer_name: "", customer_code: "", contact_person: "", email: "", phone: "", address: "", 
    city: "", state: "", country: "Ghana", payment_terms: "", 
    customer_type: "LOCAL", service_customer: true, is_active: 1,
    sales_account_id: "", currency_id: ""
  });
  const [clientSaving, setClientSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [supExpenseAccountSearch, setSupExpenseAccountSearch] = useState("");
  const supExpenseAccountResults = useMemo(() => {
    if (!supExpenseAccountSearch) return [];
    const q = supExpenseAccountSearch.toLowerCase();
    return accounts
      .filter((a) => String(a.name || "").toLowerCase().includes(q) || String(a.code || "").toLowerCase().includes(q))
      .slice(0, 50)
      .map((a) => ({ value: String(a.id), label: String(a.name), code: String(a.code) }));
  }, [supExpenseAccountSearch, accounts]);

  const [clientRevenueAccountSearch, setClientRevenueAccountSearch] = useState("");
  const clientRevenueAccountResults = useMemo(() => {
    if (!clientRevenueAccountSearch) return [];
    const q = clientRevenueAccountSearch.toLowerCase();
    return accounts
      .filter((a) => String(a.name || "").toLowerCase().includes(q) || String(a.code || "").toLowerCase().includes(q))
      .slice(0, 50)
      .map((a) => ({ value: String(a.id), label: String(a.name), code: String(a.code) }));
  }, [clientRevenueAccountSearch, accounts]);

  /* ── Data Loaders ── */


  const loadSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/purchase/suppliers?contractor=Y");
      setSuppliers(res.data?.data?.items || res.data?.items || []);
    } catch { toast.error("Failed to load suppliers"); }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const res = await api.get("/sales/customers?service_customer=Y");
      setClients(res.data?.items || []);
    } catch { toast.error("Failed to load clients"); }
  }, []);

  const loadAccountsAndCurrencies = useCallback(async () => {
    try {
      const [accRes, curRes] = await Promise.all([
        api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
        api.get("/finance/currencies").catch(() => ({ data: { items: [] } }))
      ]);
      setAccounts(accRes.data?.items || accRes.data || []);
      setCurrencies(curRes.data?.items || curRes.data || []);
    } catch { console.error("Failed to load accounts or currencies"); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSuppliers(), loadClients(), loadAccountsAndCurrencies()]).finally(() => setLoading(false));
  }, [loadSuppliers, loadClients, loadAccountsAndCurrencies]);



  /* ── Suppliers ── */
  const openSupAdd = () => { 
    setEditingSup(null); 
    setSupExpenseAccountSearch("");
    setSupForm({ 
      supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
      city: "", state: "", country: "Ghana", payment_terms: "", 
      tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
      service_contractor: true, industry: "Services", is_active: 1,
      expense_account_id: "", currency_id: ""
    }); 
    setSupModal(true); 
  };
  const openSupEdit = (s) => { 
    setEditingSup(s); 
    setSupExpenseAccountSearch(s.expense_account_id ? String(accounts.find(a => String(a.id) === String(s.expense_account_id))?.name || "") : "");
    setSupForm({ 
      supplier_name: s.supplier_name || "", supplier_code: s.supplier_code || "", 
      contact_person: s.contact_person || "", email: s.email || "", phone: s.phone || "", 
      address: s.address || "", city: s.city || "", state: s.state || "", country: s.country || "Ghana", 
      payment_terms: s.payment_terms || "", tax_id: s.tax_id || "", business_reg_no: s.business_reg_no || "", 
      supplier_type: s.supplier_type || "LOCAL", service_contractor: s.service_contractor === 'Y' || s.service_contractor === true, 
      industry: "Services", is_active: s.is_active ?? 1,
      expense_account_id: s.expense_account_id || "", currency_id: s.currency_id || ""
    }); 
    setSupModal(true); 
  };

  const saveSup = async () => {
    if (!supForm.supplier_name.trim()) { toast.error("Supplier name is required"); return; }
    setSupSaving(true);
    try {
      // Backend expects service_contractor as string Y/N
      const payload = { ...supForm, service_contractor: supForm.service_contractor ? 'Y' : 'N' };
      
      if (editingSup) {
        await api.put(`/purchase/suppliers/${editingSup.id}`, payload);
        toast.success("Supplier updated");
      } else {
        await api.post("/purchase/suppliers", payload);
        toast.success("Supplier created");
      }
      setSupModal(false);
      loadSuppliers();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save supplier"); }
    finally { setSupSaving(false); }
  };

  const deleteSup = async (id) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      await api.delete(`/purchase/suppliers/${id}`);
      toast.success("Supplier deleted");
      loadSuppliers();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete supplier"); }
  };

  /* ── Clients ── */
  const openClientAdd = async () => { 
    setEditingClient(null); 
    setClientRevenueAccountSearch("");
    let nextCode = "";
    try {
      const response = await api.get("/sales/customers/next-code");
      if (response.data?.code) nextCode = response.data.code;
    } catch (err) {}
    setClientForm({ 
      customer_name: "", customer_code: nextCode, contact_person: "", email: "", phone: "", address: "", 
      city: "", state: "", country: "Ghana", payment_terms: "", 
      customer_type: "LOCAL", service_customer: true, is_active: 1,
      sales_account_id: "", currency_id: ""
    }); 
    setClientModal(true); 
  };
  const openClientEdit = (c) => { 
    setEditingClient(c); 
    setClientRevenueAccountSearch(c.sales_account_id ? String(accounts.find(a => String(a.id) === String(c.sales_account_id))?.name || "") : "");
    setClientForm({ 
      customer_name: c.customer_name || "", customer_code: c.customer_code || "", 
      contact_person: c.contact_person || "", email: c.email || "", phone: c.phone || "", 
      address: c.address || "", city: c.city || "", state: c.state || "", country: c.country || "Ghana", 
      payment_terms: c.payment_terms || "", customer_type: c.customer_type || "LOCAL", 
      service_customer: c.service_customer === 'Y' || c.service_customer === true, 
      is_active: c.is_active ?? 1,
      sales_account_id: c.sales_account_id || "", currency_id: c.currency_id || ""
    }); 
    setClientModal(true); 
  };

  const saveClient = async () => {
    if (!clientForm.customer_name.trim()) { toast.error("Client name is required"); return; }
    setClientSaving(true);
    try {
      const payload = { ...clientForm, service_customer: clientForm.service_customer ? 'Y' : 'N' };
      
      if (editingClient) {
        await api.put(`/sales/customers/${editingClient.id}`, payload);
        toast.success("Client updated");
      } else {
        await api.post("/sales/customers", payload);
        toast.success("Client created");
      }
      setClientModal(false);
      loadClients();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save client"); }
    finally { setClientSaving(false); }
  };

  const deleteClient = async (id) => {
    if (!confirm("Delete this client?")) return;
    try {
      await api.delete(`/sales/customers/${id}`);
      toast.success("Client deleted");
      loadClients();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }
  };


  

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];
  const isSupervisorTab = activeTab === "supervisors";

  const loadData = async () => {
    if (activeTab === "clients" || activeTab === "suppliers") return;
    setLoading(true);
    try {
      const res = await api.get(currentTab.endpoint);
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setInputValue("");
  }, [activeTab]);

  useEffect(() => {
    if (!isSupervisorTab) return;
    let mounted = true;
    async function loadUsers() {
      try {
        const resp = await api.get("/purchase/service-setup/users");
        if (mounted) setAllUsers(Array.isArray(resp?.data?.items) ? resp.data.items : []);
      } catch {
        if (mounted) setAllUsers([]);
      }
    }
    loadUsers();
    return () => { mounted = false; };
  }, [isSupervisorTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isSupervisorTab) {
        if (!inputValue) return;
        await api.post(currentTab.endpoint, { user_id: Number(inputValue) });
        setInputValue("");
      } else {
        const v = String(inputValue || "").trim();
        if (!v) return;
        await api.post(currentTab.endpoint, { name: v });
        setInputValue("");
      }
      toast.success("Saved successfully");
      loadData();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`${currentTab.endpoint}/${id}`);
      setItems((prev) => prev.filter((x) => Number(x.id) !== Number(id)));
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back to Menu
        </button>
        <h2 className="text-lg font-semibold">Service Setup & Parameters</h2>
      </div>

      <div className="flex border-b mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${
              activeTab === tab.key
                ? "border-b-2 border-brand text-brand"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      


      {activeTab === "suppliers" && (
        <>
          <CrudSection
            title="Service Contractors / Suppliers"
            icon={<Building2 size={18} className="text-brand" />}
            emptyMsg="No suppliers defined yet."
            columns={["Name", "Contact Person", "Phone", "Status"]}
            rows={suppliers}
            loading={loading}
            onAdd={openSupAdd}
            onEdit={openSupEdit}
            onDelete={deleteSup}
            renderRow={(s) => (
              <>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{s.supplier_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.contact_person || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.phone || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  {s.is_active ? (
                    <span className="badge badge-success badge-sm">Active</span>
                  ) : (
                    <span className="badge badge-neutral badge-sm">Inactive</span>
                  )}
                </td>
              </>
            )}
          />

          <ModalForm open={supModal} onClose={() => setSupModal(false)} title={editingSup ? "Edit Supplier" : "New Supplier"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Name *</label>
                <input type="text" className="input w-full" placeholder="Company Name" value={supForm.supplier_name} onChange={e => setSupForm(p => ({ ...p, supplier_name: e.target.value }))} />
              </div>
              {/* Supplier Code hidden as requested */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Type</label>
                <select className="select w-full" value={supForm.supplier_type} onChange={e => setSupForm(p => ({ ...p, supplier_type: e.target.value }))}>
                  <option value="LOCAL">LOCAL</option>
                  <option value="FOREIGN">FOREIGN</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                <input type="text" className="input w-full" placeholder="John Doe" value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                <input type="email" className="input w-full" placeholder="contact@example.com" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                <PhoneInput value={supForm.phone} onChange={v => setSupForm(p => ({ ...p, phone: v }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tax ID / TIN</label>
                <input type="text" className="input w-full" placeholder="Tax ID" value={supForm.tax_id} onChange={e => setSupForm(p => ({ ...p, tax_id: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                <input type="text" className="input w-full" placeholder="123 Street Name" value={supForm.address} onChange={e => setSupForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">City</label>
                <input type="text" className="input w-full" placeholder="City" value={supForm.city} onChange={e => setSupForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">State/Region</label>
                <input type="text" className="input w-full" placeholder="State" value={supForm.state} onChange={e => setSupForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Country</label>
                <input type="text" className="input w-full" placeholder="Country" value={supForm.country} onChange={e => setSupForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Expense Account</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Search account..."
                  value={supExpenseAccountSearch || ""}
                  onChange={(e) => {
                    setSupExpenseAccountSearch(e.target.value);
                    if (!e.target.value) {
                      setSupForm((p) => ({ ...p, expense_account_id: "" }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && supExpenseAccountResults.length) {
                      const selected = supExpenseAccountResults[0];
                      const acc = accounts.find((a) => String(a.id) === selected.value);
                      if (acc) {
                        setSupExpenseAccountSearch(acc.name || "");
                        setSupForm((p) => ({ ...p, expense_account_id: String(acc.id) }));
                      }
                    }
                  }}
                />
                {supExpenseAccountSearch && supExpenseAccountResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {supExpenseAccountResults.map((o) => (
                      <button
                        type="button"
                        key={o.value}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                        onClick={() => {
                          const acc = accounts.find((a) => String(a.id) === o.value);
                          if (acc) {
                            setSupExpenseAccountSearch(acc.name || "");
                            setSupForm((p) => ({ ...p, expense_account_id: String(acc.id) }));
                          }
                        }}
                      >
                        {o.label} {o.code ? `(${o.code})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Default Currency</label>
                <select className="select w-full" value={supForm.currency_id} onChange={e => setSupForm(p => ({ ...p, currency_id: e.target.value }))}>
                  <option value="">-- Select Currency --</option>
                  {currencies.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              
              <div className="sm:col-span-2 flex items-center gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={supForm.service_contractor} onChange={e => setSupForm(p => ({ ...p, service_contractor: e.target.checked }))} />
                  <span className="text-sm font-medium">Service Contractor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={Number(supForm.is_active) === 1} onChange={e => setSupForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button className="btn-outline" onClick={() => setSupModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={supSaving} onClick={saveSup}>
                {supSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}

      {activeTab === "clients" && (
        <>
          <CrudSection
            title="Service Clients / Customers"
            icon={<Building2 size={18} className="text-brand" />}
            emptyMsg="No service clients defined yet."
            columns={["Name", "Contact Person", "Phone", "Status"]}
            rows={clients}
            loading={loading}
            onAdd={openClientAdd}
            onEdit={openClientEdit}
            renderRow={(c) => (
              <>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{c.customer_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.contact_person || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.phone || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  {c.is_active ? (
                    <span className="badge badge-success badge-sm">Active</span>
                  ) : (
                    <span className="badge badge-neutral badge-sm">Inactive</span>
                  )}
                </td>
              </>
            )}
          />

          <ModalForm open={clientModal} onClose={() => setClientModal(false)} title={editingClient ? "Edit Client" : "New Client"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Client Name *</label>
                <input type="text" className="input w-full" placeholder="Client Name" value={clientForm.customer_name} onChange={e => setClientForm(p => ({ ...p, customer_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Client Type</label>
                <select className="select w-full" value={clientForm.customer_type} onChange={e => setClientForm(p => ({ ...p, customer_type: e.target.value }))}>
                  <option value="LOCAL">LOCAL</option>
                  <option value="FOREIGN">FOREIGN</option>
                  <option value="Individual">Individual</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                <input type="text" className="input w-full" placeholder="John Doe" value={clientForm.contact_person} onChange={e => setClientForm(p => ({ ...p, contact_person: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                <input type="email" className="input w-full" placeholder="contact@example.com" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                <PhoneInput value={clientForm.phone} onChange={v => setClientForm(p => ({ ...p, phone: v }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                <input type="text" className="input w-full" placeholder="123 Street Name" value={clientForm.address} onChange={e => setClientForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">City</label>
                <input type="text" className="input w-full" placeholder="City" value={clientForm.city} onChange={e => setClientForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">State/Region</label>
                <input type="text" className="input w-full" placeholder="State" value={clientForm.state} onChange={e => setClientForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Country</label>
                <input type="text" className="input w-full" placeholder="Country" value={clientForm.country} onChange={e => setClientForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Revenue Account</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Search account..."
                  value={clientRevenueAccountSearch || ""}
                  onChange={(e) => {
                    setClientRevenueAccountSearch(e.target.value);
                    if (!e.target.value) {
                      setClientForm((p) => ({ ...p, sales_account_id: "" }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && clientRevenueAccountResults.length) {
                      const selected = clientRevenueAccountResults[0];
                      const acc = accounts.find((a) => String(a.id) === selected.value);
                      if (acc) {
                        setClientRevenueAccountSearch(acc.name || "");
                        setClientForm((p) => ({ ...p, sales_account_id: String(acc.id) }));
                      }
                    }
                  }}
                />
                {clientRevenueAccountSearch && clientRevenueAccountResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {clientRevenueAccountResults.map((o) => (
                      <button
                        type="button"
                        key={o.value}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                        onClick={() => {
                          const acc = accounts.find((a) => String(a.id) === o.value);
                          if (acc) {
                            setClientRevenueAccountSearch(acc.name || "");
                            setClientForm((p) => ({ ...p, sales_account_id: String(acc.id) }));
                          }
                        }}
                      >
                        {o.label} {o.code ? `(${o.code})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Default Currency</label>
                <select className="select w-full" value={clientForm.currency_id} onChange={e => setClientForm(p => ({ ...p, currency_id: e.target.value }))}>
                  <option value="">-- Select Currency --</option>
                  {currencies.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              
              <div className="sm:col-span-2 flex items-center gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={clientForm.service_customer} onChange={e => setClientForm(p => ({ ...p, service_customer: e.target.checked }))} />
                  <span className="text-sm font-medium">Service Customer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={Number(clientForm.is_active) === 1} onChange={e => setClientForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button className="btn-outline" onClick={() => setClientModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={clientSaving} onClick={saveClient}>
                {clientSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}
      {activeTab !== "clients" && activeTab !== "suppliers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
            <h3 className="font-medium mb-4">
              {"Add New " + currentTab.label.replace(/-/g, " ")}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isSupervisorTab ? (
                <div>
                  <label className="block text-sm mb-1">{currentTab.fieldLabel}</label>
                  <input
                    className="input"
                    type={currentTab.inputType || "text"}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={currentTab.placeholder}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1">User</label>
                  <select
                    className="input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    required
                  >
                    <option value="">-- Select User --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Details
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {item.name || item.username || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

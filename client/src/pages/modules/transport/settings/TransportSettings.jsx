import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Trash2, X, Pencil, Building2, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../../../../api/client.js";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import VehiclesList from "../vehicles/VehiclesList.jsx";
import DriversList from "../drivers/DriversList.jsx";
import PhoneInput from "../../../../components/PhoneInput.jsx";
import ComplianceSettingsTab from "./ComplianceSettingsTab.jsx";
import ItemSettingsTab from "./ItemSettingsTab.jsx";


/* ─────────────────────────────────────── helpers ─── */
function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function CrudSection({ title, icon, emptyMsg, columns, rows, loading, onAdd, onEdit, onDelete, onToggleActive, renderRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          Add
        </button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              {columns.map(c => <th key={c} className="px-4 py-3">{c}</th>)}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : rows.length > 0 ? rows.map(row => (
              <tr key={row.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                {renderRow(row)}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && (
                      <button onClick={() => onEdit(row)} className="p-1.5 text-brand hover:text-brand-700 rounded hover:bg-brand-50 transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                    {onToggleActive && (
                      <button onClick={() => onToggleActive(row)} className={`p-1.5 rounded transition-colors ${row.is_active ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        {row.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    )}
                    {onDelete && !onToggleActive && (
                      <button onClick={() => onDelete(row.id)} className="p-1.5 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">{emptyMsg}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TAB_LABELS = [
  { key: "general", label: "General Settings" },
  { key: "notifications", label: "Notifications" },
  { key: "vehicles", label: "Vehicles" },
  { key: "drivers", label: "Drivers" },
  { key: "compliance", label: "Lookups / Setup Data" },
  { key: "items", label: "Item Setup" },
  { key: "suppliers", label: "Suppliers" },
  { key: "clients", label: "Clients" },
];

export default function TransportSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Transport settings saved successfully");
    }, 1000);
  };

  
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

  const [clientRevenueAccountSearch, setClientRevenueAccountSearch] = useState("");
  const clientRevenueAccountResults = useMemo(() => {
    if (!clientRevenueAccountSearch) return [];
    const q = clientRevenueAccountSearch.toLowerCase();
    return accounts
      .filter((a) => String(a.name || "").toLowerCase().includes(q) || String(a.code || "").toLowerCase().includes(q))
      .slice(0, 50)
      .map((a) => ({ value: String(a.id), label: String(a.name), code: String(a.code) }));
  }, [clientRevenueAccountSearch, accounts]);

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
    if (activeTab === "suppliers") {
      setLoading(true);
      Promise.all([loadSuppliers(), loadAccountsAndCurrencies()]).finally(() => setLoading(false));
    }
    if (activeTab === "clients") {
      setLoading(true);
      Promise.all([loadClients(), loadAccountsAndCurrencies()]).finally(() => setLoading(false));
    }
  }, [activeTab, loadClients, loadAccountsAndCurrencies]);

  const openSupAdd = () => { 
    setEditingSup(null); 
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
    if (!window.confirm("Delete this client?")) return;
    try {
      await api.delete(`/sales/customers/${id}`);
      toast.success("Client deleted");
      loadClients();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }
  };

  const toggleClientActive = async (client) => {
    try {
      await api.put(`/sales/customers/${client.id}`, { ...client, is_active: client.is_active ? 0 : 1 });
      toast.success(client.is_active ? "Client deactivated" : "Client activated");
      loadClients();
    } catch (e) { toast.error("Failed to update status"); }
  };

  const renderSuppliers = () => (
    <div className="space-y-6 max-w-5xl">
      <CrudSection
        title="Service Contractors / Suppliers"
        icon={<Building2 size={18} className="text-brand" />}
        emptyMsg="No suppliers defined yet."
        columns={["Name", "Contact Person", "Phone", "Status"]}
        rows={suppliers}
        loading={loading}
        onAdd={openSupAdd}
        onEdit={openSupEdit}
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
            <input type="text" className="input w-full" value={supForm.supplier_name} onChange={e => setSupForm(p => ({ ...p, supplier_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Type</label>
            <select className="select w-full" value={supForm.supplier_type} onChange={e => setSupForm(p => ({ ...p, supplier_type: e.target.value }))}>
              <option value="LOCAL">LOCAL</option>
              <option value="FOREIGN">FOREIGN</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
            <input type="text" className="input w-full" value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
            <input type="email" className="input w-full" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
            <PhoneInput value={supForm.phone} onChange={v => setSupForm(p => ({ ...p, phone: v }))} />
          </div>
          <div className="sm:col-span-2 pt-2 border-t flex justify-end gap-2 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setSupModal(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={saveSup} disabled={supSaving}>
              {supSaving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null} Save Supplier
            </button>
          </div>
        </div>
      </ModalForm>
    </div>
  );

  const renderClients = () => (
    <div className="space-y-6 max-w-5xl">
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
    </div>
  );


  const renderGeneral = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-slate-100 dark:bg-slate-800 rounded-t-lg p-4">
          <h2 className="font-bold text-lg">General Settings</h2>
        </div>
        <div className="card-body p-6 space-y-4">
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Enable GPS Tracking Integration</span> 
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Require Pre-Trip Inspections</span> 
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="toggle toggle-primary" />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Require Post-Trip Inspections</span> 
            </label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          className={`btn btn-primary ${loading ? "loading" : ""}`}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-slate-100 dark:bg-slate-800 rounded-t-lg p-4">
          <h2 className="font-bold text-lg">Notifications</h2>
        </div>
        <div className="card-body p-6 space-y-4">
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="checkbox checkbox-primary" defaultChecked />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Email customer on Dispatch</span> 
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="checkbox checkbox-primary" defaultChecked />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Email driver on Route Assignment</span> 
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer flex justify-start gap-4">
              <input type="checkbox" className="checkbox checkbox-primary" defaultChecked />
              <span className="label-text font-medium text-slate-700 dark:text-slate-200">Alert manager on Over-budget Expenses</span> 
            </label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          className={`btn btn-primary ${loading ? "loading" : ""}`}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "general": return renderGeneral();
      case "notifications": return renderNotifications();
      case "vehicles": return <VehiclesList isTab={true} />;
      case "drivers": return <DriversList isTab={true} />;
      case "compliance": return <ComplianceSettingsTab />;
      case "items": return <ItemSettingsTab />;
      case "suppliers": return renderSuppliers();
      case "clients": return renderClients();
      default: return null;
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          ← Back
        </button>
        <h2 className="text-lg font-semibold">Transport Settings</h2>
      </div>

      <div className="flex border-b mb-6 overflow-x-auto">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${
              activeTab === tab.key
                ? "border-b-2 border-brand text-brand dark:border-brand-500 dark:text-brand-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

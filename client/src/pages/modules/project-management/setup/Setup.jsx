/**
 * @fileoverview Setup component.
 * Provides functionality for Setup.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, User, Trash2, Plus, X, Pencil, Building2, Warehouse, Wrench } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import PhoneInput from "../../../../components/PhoneInput.jsx";

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

/* ─────────────────────── Generic CRUD Section ─── */
function CrudSection({ title, icon, emptyMsg, columns, rows, loading, onAdd, onEdit, onDelete, renderRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={14} /> Add
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
                    {onDelete && (
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

/* ───────────────────────────── Main Component ─── */
/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function Setup() {
  const [activeTab, setActiveTab] = useState("managers");
  const [loading, setLoading] = useState(false);

  // ── Project Managers ──────────────────────────────
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // ── Departments ───────────────────────────────────
  const [departments, setDepartments] = useState([]);
  const [deptModal, setDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: "", code: "", is_active: "Y" });
  const [deptSaving, setDeptSaving] = useState(false);

  // ── Warehouses ────────────────────────────────────
  const [warehouses, setWarehouses] = useState([]);
  const [whModal, setWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [whForm, setWhForm] = useState({ warehouse_name: "", warehouse_code: "", location: "", is_active: 1 });
  const [whSaving, setWhSaving] = useState(false);

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

  // ── Equipments ────────────────────────────────────
  const [equipments, setEquipments] = useState([]);
  const [eqModal, setEqModal] = useState(false);
  const [editingEq, setEditingEq] = useState(null);
  const [eqForm, setEqForm] = useState({ name: "", description: "", status: "ACTIVE", maint_equipment_id: "" });
  const [eqSaving, setEqSaving] = useState(false);
  const [maintAssets, setMaintAssets] = useState([]);

  const [accounts, setAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const baseCurrencyId = currencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)?.id || "";
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
  const loadManagers = useCallback(async () => {
    try {
      const [mRes, uRes] = await Promise.all([
        api.get("/projects/project-managers").catch(() => ({ data: { items: [] } })),
        api.get("/admin/users", { params: { active: 1 } }).catch(() => ({ data: { items: [] } })),
      ]);
      setManagers(mRes.data?.items || []);
      setUsers(uRes.data?.data?.items || uRes.data?.items || []);
    } catch { toast.error("Failed to load managers"); }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get("/admin/departments");
      setDepartments(res.data?.items || res.data || []);
    } catch { toast.error("Failed to load departments"); }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      setWarehouses(res.data?.items || res.data || []);
    } catch { toast.error("Failed to load warehouses"); }
  }, []);

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

  const loadEquipments = useCallback(async () => {
    try {
      const res = await api.get("/projects/equipments");
      setEquipments(res.data || []);
    } catch { toast.error("Failed to load equipments"); }
  }, []);

  const loadMaintAssets = useCallback(async () => {
    try {
      const res = await api.get("/maintenance/assets").catch(() => ({ data: { items: [] }}));
      setMaintAssets(res.data?.items || res.data || []);
    } catch { }
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
    Promise.all([loadManagers(), loadDepartments(), loadWarehouses(), loadSuppliers(), loadClients(), loadEquipments(), loadMaintAssets(), loadAccountsAndCurrencies()]).finally(() => setLoading(false));
  }, [loadManagers, loadDepartments, loadWarehouses, loadSuppliers, loadClients, loadEquipments, loadMaintAssets, loadAccountsAndCurrencies]);

  /* ── Project Managers ── */
  const handleAddManager = async () => {
    if (!selectedUserId) { toast.error("Select a user"); return; }
    try {
      await api.post("/projects/project-managers", { user_id: Number(selectedUserId) });
      toast.success("Project manager added");
      setSelectedUserId("");
      loadManagers();
    } catch { toast.error("Failed to add manager"); }
  };

  const handleRemoveManager = async (id) => {
    if (!confirm("Remove this user from project managers?")) return;
    try {
      await api.delete(`/projects/project-managers/${id}`);
      toast.success("Manager removed");
      loadManagers();
    } catch { toast.error("Failed to remove manager"); }
  };

  const availableUsers = users.filter(u => !managers.some(m => String(m.user_id) === String(u.id)));

  /* ── Departments ── */
  const openDeptAdd = () => { setEditingDept(null); setDeptForm({ name: "", code: "", is_active: "Y" }); setDeptModal(true); };
  const openDeptEdit = (d) => { setEditingDept(d); setDeptForm({ name: d.name || "", code: d.code || "", is_active: d.is_active || "Y" }); setDeptModal(true); };

  const saveDept = async () => {
    if (!deptForm.name.trim()) { toast.error("Department name is required"); return; }
    setDeptSaving(true);
    try {
      if (editingDept) {
        await api.put(`/admin/departments/${editingDept.id}`, deptForm);
        toast.success("Department updated");
      } else {
        await api.post("/admin/departments", deptForm);
        toast.success("Department created");
      }
      setDeptModal(false);
      loadDepartments();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save department"); }
    finally { setDeptSaving(false); }
  };

  const deleteDept = async (id) => {
    if (!confirm("Delete this department?")) return;
    try {
      await api.delete(`/admin/departments/${id}`);
      toast.success("Department deleted");
      loadDepartments();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete department"); }
  };

  /* ── Warehouses ── */
  const openWhAdd = () => { setEditingWh(null); setWhForm({ warehouse_name: "", warehouse_code: "", location: "", is_active: 1 }); setWhModal(true); };
  const openWhEdit = (w) => { setEditingWh(w); setWhForm({ warehouse_name: w.warehouse_name || "", warehouse_code: w.warehouse_code || "", location: w.location || "", is_active: w.is_active ?? 1 }); setWhModal(true); };

  const saveWh = async () => {
    if (!whForm.warehouse_name.trim()) { toast.error("Warehouse name is required"); return; }
    if (!whForm.warehouse_code.trim()) { toast.error("Warehouse code is required"); return; }
    setWhSaving(true);
    try {
      if (editingWh) {
        await api.put(`/inventory/warehouses/${editingWh.id}`, whForm);
        toast.success("Warehouse updated");
      } else {
        await api.post("/inventory/warehouses", whForm);
        toast.success("Warehouse created");
      }
      setWhModal(false);
      loadWarehouses();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save warehouse"); }
    finally { setWhSaving(false); }
  };

  const deleteWh = async (id) => {
    if (!confirm("Delete this warehouse?")) return;
    try {
      await api.delete(`/inventory/warehouses/${id}`);
      toast.success("Warehouse deleted");
      loadWarehouses();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete warehouse"); }
  };

  /* ── Suppliers ── */
  const openSupAdd = () => { 
    setEditingSup(null); 
    setSupExpenseAccountSearch("");
    setSupForm({ 
      supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
      city: "", state: "", country: "Ghana", payment_terms: "", 
      tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
      service_contractor: true, industry: "Services", is_active: 1,
      expense_account_id: "", currency_id: baseCurrencyId
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
      sales_account_id: "", currency_id: baseCurrencyId
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

  const TABS = [
    { id: "managers",    label: "Project Managers" },
    { id: "departments", label: "Departments" },
    { id: "warehouses",  label: "Temp. Storage / Warehouses" },
    { id: "suppliers",   label: "Suppliers" },
    { id: "clients",     label: "Clients" },
    { id: "equipments",  label: "Equipments" },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">Back</button>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Project Setup</h2>
          <p className="text-xs text-slate-500">Configure managers, departments, and storage</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand text-brand"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Project Managers Tab ── */}
      {activeTab === "managers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">Add Project Manager</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select User</label>
                  <select className="input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">-- Choose User --</option>
                    {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
                <button type="button" onClick={handleAddManager} className="btn-primary flex items-center gap-2 w-full justify-center">
                  <Plus size={16} /> Add Manager
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(m => (
                    <tr key={m.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <User size={14} className="text-slate-400" />{m.username}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{m.email || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRemoveManager(m.id)} className="p-1.5 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {managers.length === 0 && !loading && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No project managers configured</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Departments Tab ── */}
      {activeTab === "departments" && (
        <>
          <CrudSection
            title="Departments"
            icon={<Building2 size={18} className="text-indigo-500" />}
            emptyMsg="No departments found. Add one to get started."
            columns={["Name", "Code", "Status"]}
            rows={departments}
            loading={loading}
            onAdd={openDeptAdd}
            onEdit={openDeptEdit}
            renderRow={d => (
              <>
                <td className="px-4 py-3 font-medium text-sm">{d.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{d.code || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.is_active === "Y" || d.is_active === 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {d.is_active === "Y" || d.is_active === 1 ? "Active" : "Inactive"}
                  </span>
                </td>
              </>
            )}
          />

          {/* Department Modal */}
          <ModalForm open={deptModal} onClose={() => setDeptModal(false)} title={editingDept ? "Edit Department" : "New Department"}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Department Name *</label>
                <input type="text" className="input w-full" placeholder="e.g. Construction" value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Code</label>
                <input type="text" className="input w-full" placeholder="e.g. CONS" value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="checkbox" checked={deptForm.is_active === "Y"} onChange={e => setDeptForm(p => ({ ...p, is_active: e.target.checked ? "Y" : "N" }))} />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setDeptModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={deptSaving} onClick={saveDept}>
                {deptSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}

      {/* ── Warehouses Tab ── */}
      {activeTab === "warehouses" && (
        <>
          <CrudSection
            title="Temporal Storage / Warehouses"
            icon={<Warehouse size={18} className="text-amber-500" />}
            emptyMsg="No warehouses found. Add one to get started."
            columns={["Name", "Code", "Location", "Status"]}
            rows={warehouses}
            loading={loading}
            onAdd={openWhAdd}
            onEdit={openWhEdit}
            renderRow={w => (
              <>
                <td className="px-4 py-3 font-medium text-sm">{w.warehouse_name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{w.warehouse_code}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{w.location || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${w.is_active === 1 || w.is_active === "1" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {w.is_active === 1 || w.is_active === "1" ? "Active" : "Inactive"}
                  </span>
                </td>
              </>
            )}
          />

          {/* Warehouse Modal */}
          <ModalForm open={whModal} onClose={() => setWhModal(false)} title={editingWh ? "Edit Warehouse" : "New Warehouse"}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Warehouse Name *</label>
                <input type="text" className="input w-full" placeholder="e.g. Site A Storage" value={whForm.warehouse_name} onChange={e => setWhForm(p => ({ ...p, warehouse_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Warehouse Code *</label>
                <input type="text" className="input w-full" placeholder="e.g. WH-001" value={whForm.warehouse_code} onChange={e => setWhForm(p => ({ ...p, warehouse_code: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Location</label>
                <input type="text" className="input w-full" placeholder="e.g. Block C, Floor 2" value={whForm.location} onChange={e => setWhForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="checkbox" checked={Number(whForm.is_active) === 1} onChange={e => setWhForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setWhModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={whSaving} onClick={saveWh}>
                {whSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}

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

      {/* ── Equipments Tab ── */}
      {activeTab === "equipments" && (
        <>
          <CrudSection
            title="Project Equipments"
            icon={<Wrench size={18} className="text-slate-600" />}
            emptyMsg="No equipments found. Add one to get started."
            columns={["Name", "Linked Maintenance Asset", "Status"]}
            rows={equipments}
            loading={loading}
            onAdd={() => { setEditingEq(null); setEqForm({ name: "", description: "", status: "ACTIVE", maint_equipment_id: "" }); setEqModal(true); }}
            onEdit={(e) => { setEditingEq(e); setEqForm({ name: e.name || "", description: e.description || "", status: e.status || "ACTIVE", maint_equipment_id: e.maint_equipment_id || "" }); setEqModal(true); }}
            onDelete={async (id) => {
              if (!confirm("Delete this equipment?")) return;
              try {
                await api.delete(`/projects/equipments/${id}`);
                toast.success("Equipment deleted");
                loadEquipments();
              } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete equipment"); }
            }}
            renderRow={e => (
              <>
                <td className="px-4 py-3 font-medium text-sm">{e.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{e.maint_equipment_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${e.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {e.status}
                  </span>
                </td>
              </>
            )}
          />

          <ModalForm open={eqModal} onClose={() => setEqModal(false)} title={editingEq ? "Edit Equipment" : "New Equipment"}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Equipment Name *</label>
                <input type="text" className="input w-full" placeholder="e.g. Excavator Model X" value={eqForm.name} onChange={e => setEqForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
                <textarea className="input w-full" placeholder="Specs, details..." value={eqForm.description} onChange={e => setEqForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Link to Maintenance Asset (Optional)</label>
                <select className="input w-full" value={eqForm.maint_equipment_id} onChange={e => setEqForm(p => ({ ...p, maint_equipment_id: e.target.value }))}>
                  <option value="">-- None --</option>
                  {maintAssets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                <select className="input w-full" value={eqForm.status} onChange={e => setEqForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setEqModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={eqSaving} onClick={async () => {
                if (!eqForm.name.trim()) { toast.error("Equipment name is required"); return; }
                setEqSaving(true);
                try {
                  const payload = { ...eqForm, maint_equipment_id: eqForm.maint_equipment_id || null };
                  if (editingEq) {
                    await api.put(`/projects/equipments/${editingEq.id}`, payload);
                    toast.success("Equipment updated");
                  } else {
                    await api.post("/projects/equipments", payload);
                    toast.success("Equipment created");
                  }
                  setEqModal(false);
                  loadEquipments();
                } catch (e) { toast.error(e?.response?.data?.message || "Failed to save equipment"); }
                finally { setEqSaving(false); }
              }}>
                {eqSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}
    </div>
  );
}

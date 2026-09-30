/**
 * @fileoverview MaintenanceSetupPage component.
 * Provides functionality for MaintenanceSetupPage.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Plus, X, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import HierarchyEditor from "./HierarchyEditor";
import PhoneInput from "../../../../components/PhoneInput.jsx";

function GenericModal({ open, onClose, title, children }) {
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
                      <button onClick={() => onDelete(row.id)} className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors">
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

const DEFAULT_PARAMS = {
  default_currency: "GHS",
  warranty_alert_days: "30",
  rfq_response_days: "7",
  notify_email: "",
  auto_schedule_enabled: "false",
};

const TAB_LABELS = [
  { key: "general", label: "General" },
  { key: "sections", label: "Sections" },
  { key: "departments", label: "Departments" },
  { key: "locations", label: "Locations" },
  { key: "brands", label: "Brands" },
  { key: "models", label: "Models" },
  { key: "manufacturers", label: "Manufacturers" },
  { key: "classification-hierarchy", label: "Equip. Classification & Grouping" },
  { key: "status-types", label: "Status Types" },
  { key: "maintenance-types", label: "Maint. Types" },
  { key: "maintenance-routines", label: "Maint. Routines" },
  { key: "priorities", label: "Priorities" },
  { key: "technicians", label: "Technicians" },
  { key: "teams", label: "Teams" },
  { key: "assignments", label: "Assignments" },
  { key: "service-providers", label: "Service Providers" },
];

const EMPTY_ITEM = {
  item_name: "",
  description: "",
  sort_order: "",
  is_active: true,
};

function ModalForm({ open, title, hideDescription, showEmail, showCurrency, currencies = [], draft, onDraftChange, onClose, onSubmit, nameOptions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            {nameOptions?.length ? (
              <select
                className="input w-full"
                value={draft.item_name}
                onChange={e => {
                  const val = e.target.value;
                  onDraftChange("item_name", val);
                  if (nameOptions) {
                    const opt = nameOptions.find((o) => o.name === val);
                    if (opt) {
                      if (showEmail) onDraftChange("email", opt.email || "");
                      if (showCurrency && opt.currency_id) onDraftChange("currency_id", opt.currency_id);
                    }
                  }
                }}
              >
                <option value="">-- Select --</option>
                {nameOptions.map((opt) => (
                  <option key={opt.id} value={opt.name}>{opt.name}</option>
                ))}
              </select>
            ) : (
              <input className="input w-full" value={draft.item_name || ""} onChange={e => onDraftChange("item_name", e.target.value)} />
            )}
          </div>
          {showEmail && (
            <div>
              <label className="label">Email</label>
              <input className="input w-full" type="email" value={draft.email || ""} onChange={e => onDraftChange("email", e.target.value)} />
            </div>
          )}
          {showCurrency && (
            <div>
              <label className="label">Currency</label>
              <select className="input w-full" value={draft.currency_id || ""} onChange={e => onDraftChange("currency_id", e.target.value)}>
                <option value="">Select Currency...</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.symbol}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Description</label>
            <input className="input w-full" value={draft.description} onChange={e => onDraftChange("description", e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={Boolean(draft.is_active)} onChange={e => onDraftChange("is_active", e.target.checked)} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSubmit}>Add</button>
        </div>
      </div>
    </div>
  );
}

function SetupItemsEditor({
  title,
  description,
  kind,
  items,
  draft,
  onDraftChange,
  onCreate,
  onSave,
  onSaveAndReload,
  onDelete,
  hideDescription = false,
  showEmail = false,
  showCurrency = false,
  currencies = [],
  onOpenModal,
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={() => onOpenModal(kind)}>
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {!hideDescription && <th>Description</th>}
              {showEmail && <th>Email</th>}
              {showCurrency && <th>Currency</th>}
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center py-6 text-slate-500">
                  No records found
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    className="input"
                    value={item.item_name || ""}
                    onChange={(e) => onSave(kind, { ...item, item_name: e.target.value })}
                    onBlur={() => onSave(kind, { ...item, item_name: item.item_name })}
                  />
                </td>
                {!hideDescription && (
                <td>
                  <input
                    className="input"
                    value={item.description || ""}
                    onChange={(e) => onSave(kind, { ...item, description: e.target.value })}
                    onBlur={() => onSave(kind, { ...item, description: item.description })}
                  />
                </td>
                )}
                {showEmail && (
                <td>
                  <input
                    className="input"
                    type="email"
                    value={item.email || ""}
                    onChange={(e) => onSave(kind, { ...item, email: e.target.value })}
                    onBlur={() => onSave(kind, { ...item, email: item.email })}
                  />
                </td>
                )}
                {showCurrency && (
                <td>
                  <select
                    className="input"
                    value={item.currency_id || ""}
                    onChange={(e) => onSave(kind, { ...item, currency_id: e.target.value })}
                  >
                    <option value="">Select Currency...</option>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.symbol}
                      </option>
                    ))}
                  </select>
                </td>
                )}
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(item.is_active)}
                    onChange={(e) =>
                      onSave(kind, { ...item, is_active: e.target.checked })
                    }
                  />
                </td>
                <td className="whitespace-nowrap space-x-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => onSaveAndReload(kind, item)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    onClick={() => onDelete(kind, item.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceSetupPage() {
  const [tab, setTab] = useState("general");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [catalogs, setCatalogs] = useState({
    maintenanceTypes: [],
    maintenanceRoutines: [],
    priorities: [],
    executionTypes: [],
    sections: [],
    locations: [],
    departments: [],
    brands: [],
    models: [],
    statusTypes: [],
  });
  const [modalKind, setModalKind] = useState(null);
  const [modalDraft, setModalDraft] = useState({ ...EMPTY_ITEM });
  const [sectionUsers, setSectionUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [drafts, setDrafts] = useState({
    "maintenance-types": { ...EMPTY_ITEM },
    "maintenance-routines": { ...EMPTY_ITEM },
    priorities: { ...EMPTY_ITEM },
    "execution-types": { ...EMPTY_ITEM },
    sections: { ...EMPTY_ITEM },
    locations: { ...EMPTY_ITEM },
    departments: { ...EMPTY_ITEM },
    brands: { ...EMPTY_ITEM },
    models: { ...EMPTY_ITEM },
    manufacturers: { ...EMPTY_ITEM },
    "status-types": { ...EMPTY_ITEM },
    supervisors: { ...EMPTY_ITEM },
    technicians: { ...EMPTY_ITEM },
    teams: { ...EMPTY_ITEM },
    "service-providers": { ...EMPTY_ITEM },
    "job-order-types": { ...EMPTY_ITEM },
  });
  const [assignmentDraft, setAssignmentDraft] = useState({
    section_item_id: "",
    user_id: "",
    assign_work: true,
  });
  const [saving, setSaving] = useState(false);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [providerModal, setProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [providerForm, setProviderForm] = useState({
    supplier_name: "", contact_person: "", email: "", phone: "", address: "",
    tax_id: "", supplier_type: "LOCAL",
  });

  const loadServiceProviders = useCallback(async () => {
    try {
      const res = await api.get("/purchase/suppliers?contractor=Y");
      setServiceProviders(res.data?.data?.items || res.data?.items || []);
    } catch { toast.error("Failed to load service providers"); }
  }, []);

  useEffect(() => {
    loadServiceProviders();
  }, [loadServiceProviders]);

  const openProviderAdd = () => {
    setEditingProvider(null);
    setProviderForm({ supplier_name: "", contact_person: "", email: "", phone: "", address: "", tax_id: "", supplier_type: "LOCAL" });
    setProviderModal(true);
  };
  const openProviderEdit = (p) => {
    setEditingProvider(p);
    setProviderForm({
      supplier_name: p.supplier_name || "", contact_person: p.contact_person || "",
      email: p.email || "", phone: p.phone || "", address: p.address || "",
      tax_id: p.tax_id || "", supplier_type: p.supplier_type || "LOCAL"
    });
    setProviderModal(true);
  };
  const saveProvider = async () => {
    if (!providerForm.supplier_name.trim()) { toast.error("Name is required"); return; }
    try {
      const payload = { ...providerForm, service_contractor: true };
      if (editingProvider) {
        await api.put(`/purchase/suppliers/${editingProvider.id}`, payload);
        toast.success("Service Provider updated");
      } else {
        await api.post("/purchase/suppliers", payload);
        toast.success("Service Provider created");
      }
      setProviderModal(false);
      loadServiceProviders();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
  };
  const deleteProvider = async (id) => {
    if (!confirm("Delete this service provider?")) return;
    try {
      await api.delete(`/purchase/suppliers/${id}`);
      toast.success("Service Provider deleted");
      loadServiceProviders();
    } catch (e) { toast.error("Failed to delete"); }
  };

  async function loadSetup() {
    const [catalogRes, paramRes, curRes] = await Promise.all([
      api.get("/maintenance/setup/catalog"),
      api.get("/maintenance/parameters").catch(() => ({ data: { params: {} } })),
      api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
    ]);

    setCatalogs({
      maintenanceTypes: [],
      maintenanceRoutines: [],
      priorities: [],
      executionTypes: [],
      sections: [],
      locations: [],
      departments: [],
      brands: [],
      models: [],
      statusTypes: [],
      ...(catalogRes.data?.catalogs || {}),
    });
    setSectionUsers(Array.isArray(catalogRes.data?.sectionUsers) ? catalogRes.data.sectionUsers : []);
    setUsers(Array.isArray(catalogRes.data?.users) ? catalogRes.data.users : []);
    setCurrencies(Array.isArray(curRes.data?.items) ? curRes.data.items : []);
    setParams((prev) => ({ ...prev, ...(paramRes.data?.params || {}), ...(catalogRes.data?.params || {}) }));
  }

  useEffect(() => {
    let m = true;
    loadSetup().catch(() => {
      if (m) toast.error("Failed to load setup");
    });
    return () => { m = false; };
  }, []);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const setDraft = (kind, key, value) =>
    setDrafts((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [key]: value },
    }));

  async function save() {
    setSaving(true);
    try {
      await api.put("/maintenance/parameters", { params });
      toast.success("Settings saved");
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  async function createItem(kind) {
    const payload = drafts[kind];
    if (!String(payload.item_name || "").trim()) {
      toast.error("Item name is required");
      return;
    }
    try {
      await api.post(`/maintenance/setup/catalog/${kind}`, payload);
      setDrafts((prev) => ({ ...prev, [kind]: { ...EMPTY_ITEM } }));
      await loadSetup();
      toast.success("Item added");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to add item");
    }
  }

  async function saveItem(kind, item) {
    setCatalogs((prev) => {
      const mapping = {
        "maintenance-types": "maintenanceTypes",
        "maintenance-routines": "maintenanceRoutines",
        priorities: "priorities",
        "execution-types": "executionTypes",
        sections: "sections",
        locations: "locations",
        departments: "departments",
        brands: "brands",
        models: "models",
        manufacturers: "manufacturers",
        classifications: "classifications",
        categories: "categories",
        groups: "groups",
        "status-types": "statusTypes",
        supervisors: "supervisors",
        technicians: "technicians",
        teams: "teams",
        "service-providers": "serviceProviders",
        "job-order-types": "jobOrderTypes",
      };
      const key = mapping[kind];
      return {
        ...prev,
        [key]: prev[key].map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                ...item,
                sort_order: item.sort_order === "" ? 0 : Number(item.sort_order || 0),
                is_active: Boolean(item.is_active),
              }
            : entry,
        ),
      };
    });

    try {
      await api.put(`/maintenance/setup/catalog/${kind}/${item.id}`, {
        ...item,
        sort_order: item.sort_order === "" ? 0 : Number(item.sort_order || 0),
        is_active: item.is_active ? 1 : 0,
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update item");
    }
  }

  async function saveItemAndReload(kind, item) {
    await saveItem(kind, item);
    await loadSetup();
    toast.success("Item updated");
  }

  function openModal(kind) {
    setModalKind(kind);
    setModalDraft({ ...EMPTY_ITEM });
  }
  function closeModal() {
    setModalKind(null);
  }
  function setModalField(key, value) {
    setModalDraft((prev) => ({ ...prev, [key]: value }));
  }
  async function submitModal() {
    if (!modalKind) return;
    const payload = modalDraft;
    if (!String(payload.item_name || "").trim()) {
      toast.error("Item name is required");
      return;
    }
    try {
      await api.post(`/maintenance/setup/catalog/${modalKind}`, payload);
      setModalKind(null);
      await loadSetup();
      toast.success("Item added");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to add item");
    }
  }

  async function deleteItem(kind, id) {
    try {
      await api.delete(`/maintenance/setup/catalog/${kind}/${id}`);
      await loadSetup();
      toast.success("Item deleted");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete item");
    }
  }

  async function createAssignment() {
    if (!assignmentDraft.section_item_id || !assignmentDraft.user_id) {
      toast.error("Select a maintenance section and user");
      return;
    }
    try {
      await api.post("/maintenance/setup/section-users", {
        section_item_id: Number(assignmentDraft.section_item_id),
        user_id: Number(assignmentDraft.user_id),
        assign_work: assignmentDraft.assign_work ? 1 : 0,
      });
      setAssignmentDraft({ section_item_id: "", user_id: "", assign_work: true });
      await loadSetup();
      toast.success("User linked to maintenance section");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save assignment");
    }
  }

  async function saveAssignment(item) {
    try {
      await api.put(`/maintenance/setup/section-users/${item.id}`, {
        section_item_id: Number(item.section_item_id),
        user_id: Number(item.user_id),
        assign_work: item.assign_work ? 1 : 0,
        is_active: item.is_active ? 1 : 0,
      });
      await loadSetup();
      toast.success("Assignment updated");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update assignment");
    }
  }

  async function deleteAssignment(id) {
    try {
      await api.delete(`/maintenance/setup/section-users/${id}`);
      await loadSetup();
      toast.success("Assignment removed");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to remove assignment");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance?section=Reports %26 Setup" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Maintenance Setup</h1>
            <p className="text-slate-500 text-sm">Configure maintenance parameters and system settings</p>
          </div>
        </div>
        <button type="button" className="btn-success px-8" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10 overflow-x-auto">
        {TAB_LABELS.map(t => (
          <button key={t.key} type="button"
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${tab === t.key ? "border-brand-600 text-brand-600 bg-brand-50/50" : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500"}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="card max-h-[calc(100vh-280px)] overflow-y-auto">
        <div className="p-4 space-y-6">
          {tab === "general" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                 <h2 className="font-bold uppercase text-xs tracking-wider">Financial & Service Limits</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="label">Default Currency</label>
                  <input className="input w-full" value={params.default_currency} onChange={e => set("default_currency", e.target.value)} />
                </div>
                <div>
                  <label className="label">Warranty Alert (days)</label>
                  <input className="input w-full" type="number" value={params.warranty_alert_days} onChange={e => set("warranty_alert_days", e.target.value)} />
                </div>
                <div>
                  <label className="label">RFQ Response Deadline (days)</label>
                  <input className="input w-full" type="number" value={params.rfq_response_days} onChange={e => set("rfq_response_days", e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {tab === "sections" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Maintenance Section"
                description="Maintenance sections for organizing work."
                kind="sections"
                items={catalogs.sections}
                draft={drafts.sections}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "departments" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Department"
                description="Departments that request maintenance."
                kind="departments"
                items={catalogs.departments}
                draft={drafts.departments}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "locations" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Sub-Locations"
                description="Specific points or bins within sections."
                kind="locations"
                items={catalogs.locations}
                draft={drafts.locations}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "brands" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Brands"
                description="Equipment brand names."
                kind="brands"
                items={catalogs.brands}
                draft={drafts.brands}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "models" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Models"
                description="Equipment model names."
                kind="models"
                items={catalogs.models}
                draft={drafts.models}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "manufacturers" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Manufacturers"
                description="Equipment manufacturers."
                kind="manufacturers"
                items={catalogs.manufacturers || []}
                draft={drafts.manufacturers}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "classification-hierarchy" && (
            <div className="space-y-8">
              <HierarchyEditor catalogs={catalogs} reloadSetup={loadSetup} />
            </div>
          )}
          {tab === "status-types" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Status Types"
                description="Equipment status types."
                kind="status-types"
                items={catalogs.statusTypes}
                draft={drafts["status-types"]}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "maintenance-types" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Maintenance Type"
                description="Types of maintenance activities."
                kind="maintenance-types"
                items={catalogs.maintenanceTypes}
                draft={drafts["maintenance-types"]}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "maintenance-routines" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Maintenance Routine"
                description="Define reusable maintenance routines for maintenance schedules."
                kind="maintenance-routines"
                items={catalogs.maintenanceRoutines}
                draft={drafts["maintenance-routines"]}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "priorities" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Service Priorities"
                description="Manage allowed urgency levels for work orders."
                kind="priorities"
                items={catalogs.priorities}
                draft={drafts.priorities}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}

          {tab === "technicians" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Technicians"
                description="Configure technician names for work orders."
                kind="technicians"
                items={catalogs.technicians}
                draft={drafts.technicians}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "teams" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Teams"
                description="Configure team names for work orders."
                kind="teams"
                items={catalogs.teams}
                draft={drafts.teams}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onSaveAndReload={saveItemAndReload}
                onDelete={deleteItem}
                hideDescription
                onOpenModal={openModal}
              />
            </div>
          )}
          {tab === "service-providers" && (
            <div className="space-y-8">
              <CrudSection
                title="Service Providers"
                icon={<Building2 size={18} className="text-brand" />}
                emptyMsg="No service providers defined yet."
                columns={["Name", "Contact Person", "Phone", "Status"]}
                rows={serviceProviders}
                loading={false}
                onAdd={openProviderAdd}
                onEdit={openProviderEdit}
                onDelete={deleteProvider}
                renderRow={(p) => (
                  <>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{p.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.contact_person || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.phone || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.is_active ? (
                        <span className="badge badge-success badge-sm">Active</span>
                      ) : (
                        <span className="badge badge-neutral badge-sm">Inactive</span>
                      )}
                    </td>
                  </>
                )}
              />

              <GenericModal open={providerModal} onClose={() => setProviderModal(false)} title={editingProvider ? "Edit Service Provider" : "New Service Provider"}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Provider Name *</label>
                    <input type="text" className="input w-full" placeholder="Company Name" value={providerForm.supplier_name} onChange={e => setProviderForm(p => ({ ...p, supplier_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Provider Type</label>
                    <select className="select w-full" value={providerForm.supplier_type} onChange={e => setProviderForm(p => ({ ...p, supplier_type: e.target.value }))}>
                      <option value="LOCAL">LOCAL</option>
                      <option value="FOREIGN">FOREIGN</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                    <input type="text" className="input w-full" placeholder="John Doe" value={providerForm.contact_person} onChange={e => setProviderForm(p => ({ ...p, contact_person: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="email" className="input w-full" placeholder="contact@example.com" value={providerForm.email} onChange={e => setProviderForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                    <PhoneInput value={providerForm.phone} onChange={v => setProviderForm(p => ({ ...p, phone: v }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tax ID / TIN</label>
                    <input type="text" className="input w-full" placeholder="Tax ID" value={providerForm.tax_id} onChange={e => setProviderForm(p => ({ ...p, tax_id: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                    <input type="text" className="input w-full" placeholder="123 Street Name" value={providerForm.address} onChange={e => setProviderForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t flex justify-end gap-2 mt-4">
                    <button type="button" className="btn-secondary" onClick={() => setProviderModal(false)}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={saveProvider}>Save Provider</button>
                  </div>
                </div>
              </GenericModal>
            </div>
          )}

          {tab === "assignments" && (
            <div className="space-y-6">
              <div className="card bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-6 border-dashed">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Technical Resource Assignment
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Link technicians to specific facility sections.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="label">Section</label>
                    <select
                      className="input w-full"
                      value={assignmentDraft.section_item_id}
                      onChange={(e) =>
                        setAssignmentDraft((prev) => ({
                          ...prev,
                          section_item_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select Section --</option>
                      {catalogs.sections
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <label className="label">User/Technician</label>
                    <select
                      className="input w-full"
                      value={assignmentDraft.user_id}
                      onChange={(e) =>
                        setAssignmentDraft((prev) => ({
                          ...prev,
                          user_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select User --</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.username} {user.email ? `(${user.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="btn-success w-full" onClick={createAssignment}>
                      Add Link
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Resource</th>
                      <th>Communication</th>
                      <th>Work Flow</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sectionUsers.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-10 text-slate-400 italic">No resources assigned.</td></tr>
                    ) : sectionUsers.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold text-slate-900 dark:text-slate-200">{item.section_name}</td>
                        <td className="text-sm font-medium">{item.full_name || item.username}</td>
                        <td className="text-xs text-slate-500">{item.email || "-"}</td>
                        <td>
                           <div className="flex items-center gap-3">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={Boolean(item.assign_work)} onChange={e => {
                                   setSectionUsers(prev => prev.map(en => en.id === item.id ? { ...en, assign_work: e.target.checked } : en));
                                }} />
                                <span className="text-[10px] font-bold uppercase text-slate-500">Assign</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={Boolean(item.is_active)} onChange={e => {
                                   setSectionUsers(prev => prev.map(en => en.id === item.id ? { ...en, is_active: e.target.checked } : en));
                                }} />
                                <span className="text-[10px] font-bold uppercase text-slate-500">Active</span>
                             </label>
                           </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                             <button type="button" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" onClick={() => saveAssignment(item)} title="Save changes"><Save size={16} /></button>
                             <button type="button" className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" onClick={() => deleteAssignment(item.id)} title="Remove assignment">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      <ModalForm
        open={!!modalKind}
        title={`Add ${TAB_LABELS.find(t => t.key === modalKind)?.label || ""}`}
        hideDescription={["maintenance-types","maintenance-routines","priorities","brands","models","manufacturers","classifications","categories","groups","status-types","technicians","teams","service-providers"].includes(modalKind)}
        showEmail={modalKind === "service-providers"}
        showCurrency={modalKind === "service-providers"}
        currencies={currencies}
        draft={modalDraft}
        onDraftChange={setModalField}
        onClose={closeModal}
        onSubmit={submitModal}
        nameOptions={undefined}
      />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { X, Pencil, ShieldCheck, FileText, Building2, ToggleLeft, ToggleRight } from "lucide-react";

function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function CrudSection({ title, icon, emptyMsg, rows, loading, onAdd, onEdit, onToggleActive }) {
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
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3 w-24 text-center">Status</th>
              <th className="px-4 py-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : rows.length > 0 ? rows.map(row => (
              <tr key={row.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{row.setup_value}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {row.is_active ? (
                    <span className="badge badge-success badge-sm">Active</span>
                  ) : (
                    <span className="badge badge-neutral badge-sm">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(row)} className="p-1.5 text-brand hover:text-brand-700 rounded hover:bg-brand-50 transition-colors">
                      <Pencil size={14} />
                    </button>
                    {onToggleActive && (
                      <button onClick={() => onToggleActive(row)} className={`p-1.5 rounded transition-colors ${row.is_active ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        {row.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{emptyMsg}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComplianceSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    ISSUING_AUTHORITY: [],
    POLICY_TYPE: [],
    INSURANCE_COMPANY: [],
    EXPENSE_TYPE: [],
    FUEL_STATION: []
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ setup_value: "", is_active: 1 });
  const [supForm, setSupForm] = useState({
    contact_person: "", email: "", phone: "", address: "", 
    supplier_type: "LOCAL", service_contractor: false, currency: "GHS", payment_terms: "30_DAYS"
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/setup");
      const items = res.data?.data?.items || [];
      const grouped = { ISSUING_AUTHORITY: [], POLICY_TYPE: [], INSURANCE_COMPANY: [], EXPENSE_TYPE: [], FUEL_STATION: [] };
      items.forEach(item => {
        if (grouped[item.setup_type]) {
          grouped[item.setup_type].push(item);
        }
      });
      setData(grouped);
    } catch (err) {
      toast.error("Failed to load compliance settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = (type) => {
    setModalType(type);
    setEditingItem(null);
    setForm({ setup_value: "", is_active: 1 });
    setSupForm({
      contact_person: "", email: "", phone: "", address: "", 
      supplier_type: "LOCAL", service_contractor: type === "FUEL_STATION", currency: "GHS", payment_terms: "30_DAYS"
    });
    setModalOpen(true);
  };

  const openEdit = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    setForm({ setup_value: item.setup_value, is_active: item.is_active });
    setModalOpen(true);
  };

  const saveItem = async () => {
    if (!form.setup_value.trim()) {
      toast.error("Value is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { setup_type: modalType, setup_value: form.setup_value, is_active: form.is_active };
      if (editingItem) {
        await api.put(`/transport/setup/${editingItem.id}`, payload);
        toast.success("Updated successfully");
      } else {
        await api.post("/transport/setup", payload);
        toast.success("Added successfully");
        
        if (modalType === "FUEL_STATION") {
          try {
            await api.post("/purchase/suppliers", {
              supplier_name: form.setup_value,
              ...supForm,
              service_contractor: supForm.service_contractor ? 'Y' : 'N'
            });
            toast.success("Also created as a new Supplier");
          } catch (e) {
            toast.error("Fuel station created, but failed to automatically create Supplier");
          }
        }
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveItem = async (item) => {
    try {
      await api.put(`/transport/setup/${item.id}`, { ...item, is_active: item.is_active ? 0 : 1 });
      toast.success(item.is_active ? "Item deactivated" : "Item activated");
      loadData();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const getTypeLabel = (type) => {
    if (type === "ISSUING_AUTHORITY") return "Issuing Authority";
    if (type === "POLICY_TYPE") return "Policy Type";
    if (type === "INSURANCE_COMPANY") return "Insurance Company";
    if (type === "EXPENSE_TYPE") return "Expense Type";
    if (type === "FUEL_STATION") return "Fuel Station";
    return type;
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrudSection
          title="Issuing Authorities"
          icon={<ShieldCheck size={18} className="text-brand" />}
          emptyMsg="No issuing authorities defined."
          rows={data.ISSUING_AUTHORITY}
          loading={loading}
          onAdd={() => openAdd("ISSUING_AUTHORITY")}
          onEdit={(item) => openEdit("ISSUING_AUTHORITY", item)}
          onToggleActive={toggleActiveItem}
        />
        <CrudSection
          title="Policy Types"
          icon={<FileText size={18} className="text-brand" />}
          emptyMsg="No policy types defined."
          rows={data.POLICY_TYPE}
          loading={loading}
          onAdd={() => openAdd("POLICY_TYPE")}
          onEdit={(item) => openEdit("POLICY_TYPE", item)}
          onToggleActive={toggleActiveItem}
        />
        <CrudSection
          title="Insurance Companies"
          icon={<Building2 size={18} className="text-brand" />}
          emptyMsg="No insurance companies defined."
          rows={data.INSURANCE_COMPANY}
          loading={loading}
          onAdd={() => openAdd("INSURANCE_COMPANY")}
          onEdit={(item) => openEdit("INSURANCE_COMPANY", item)}
          onToggleActive={toggleActiveItem}
        />
        <CrudSection
          title="Fuel Stations"
          icon={<Building2 size={18} className="text-brand" />}
          emptyMsg="No fuel stations defined."
          rows={data.FUEL_STATION}
          loading={loading}
          onAdd={() => openAdd("FUEL_STATION")}
          onEdit={(item) => openEdit("FUEL_STATION", item)}
          onToggleActive={toggleActiveItem}
        />

        <CrudSection
          title="Expense Types"
          icon={<FileText size={18} className="text-brand" />}
          emptyMsg="No expense types defined."
          rows={data.EXPENSE_TYPE}
          loading={loading}
          onAdd={() => openAdd("EXPENSE_TYPE")}
          onEdit={(item) => openEdit("EXPENSE_TYPE", item)}
          onToggleActive={toggleActiveItem}
        />
      </div>

      <ModalForm 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={`${editingItem ? "Edit" : "New"} ${getTypeLabel(modalType)}`}
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label text-sm font-medium text-slate-700">
              {modalType === "FUEL_STATION" ? "Fuel Station Name" : "Value"} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              className="input input-bordered w-full"
              value={form.setup_value}
              onChange={e => setForm({...form, setup_value: e.target.value})}
              placeholder={modalType === "FUEL_STATION" ? "Enter fuel station name..." : "Enter value"}
            />
          </div>

          {modalType === "FUEL_STATION" && !editingItem && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Supplier Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                  <input type="text" className="input input-bordered w-full" value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Type</label>
                  <select className="select select-bordered w-full" value={supForm.supplier_type} onChange={e => setSupForm(p => ({ ...p, supplier_type: e.target.value }))}>
                    <option value="LOCAL">LOCAL</option>
                    <option value="FOREIGN">FOREIGN</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                  <input type="email" className="input input-bordered w-full" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                  <input type="text" className="input input-bordered w-full" value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                  <input type="text" className="input input-bordered w-full" value={supForm.address} onChange={e => setSupForm(p => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div className="form-control mt-4">
            <label className="label cursor-pointer justify-start gap-3">
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={form.is_active === 1}
                onChange={e => setForm({...form, is_active: e.target.checked ? 1 : 0})}
              />
              <span className="label-text text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveItem} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

import os
import sys

setup_path = os.path.join('client', 'src', 'pages', 'modules', 'service-management', 'setup', 'ServiceParametersPage.jsx')

with open(setup_path, 'r', encoding='utf8') as f:
    content = f.read()

# 1. Inject missing Lucide icons
if 'Building2' not in content:
    content = content.replace(
        'import { Plus, Edit2, Trash2, Loader2, X } from "lucide-react";',
        'import { Plus, Edit2, Trash2, Loader2, X, Building2, Pencil } from "lucide-react";'
    )

# 2. Inject ModalForm and CrudSection
if 'function ModalForm' not in content:
    helpers = """
/* --- Helpers --- */
function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
"""
    content = content.replace(
        'export default function ServiceParametersPage() {',
        helpers + '\nexport default function ServiceParametersPage() {'
    )

# 3. Add Suppliers to TABS
if '{ key: "suppliers", label: "Suppliers" }' not in content:
    content = content.replace(
        '{ key: "clients", label: "Clients" },',
        '{ key: "clients", label: "Clients" },\n  { key: "suppliers", label: "Suppliers" },'
    )

# 4. Add Suppliers State and load logic
if 'const [suppliers, setSuppliers] = useState([]);' not in content:
    content = content.replace(
        'const [clients, setClients] = useState([]);',
        """const [suppliers, setSuppliers] = useState([]);
  const [supModal, setSupModal] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({
    supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
    city: "", state: "", country: "Ghana", payment_terms: "", 
    tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
    service_contractor: true, industry: "Services", is_active: 1
  });
  const [supSaving, setSupSaving] = useState(false);
  
  const [clients, setClients] = useState([]);"""
    )
    
    content = content.replace(
        'const loadClients = async () => {',
        """const loadSuppliers = async () => {
    try {
      const res = await api.get("/purchase/suppliers?contractor=Y");
      setSuppliers(res.data?.data?.items || res.data?.items || []);
    } catch { toast.error("Failed to load suppliers"); }
  };
  
  const loadClients = async () => {"""
    )
    
    content = content.replace(
        'if (activeTab === "clients") {',
        """if (activeTab === "suppliers") {
      loadSuppliers();
    }
    if (activeTab === "clients") {"""
    )

# 5. Add Suppliers Methods
if 'const openSupAdd = () => {' not in content:
    content = content.replace(
        'const openClientAdd = async () => {',
        """const openSupAdd = () => { 
    setEditingSup(null); 
    setSupForm({ 
      supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
      city: "", state: "", country: "Ghana", payment_terms: "", 
      tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
      service_contractor: true, industry: "Services", is_active: 1
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
      industry: "Services", is_active: s.is_active ?? 1
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

  const deleteSup = async (id) => {
    import_toast = toast; # Avoid Python syntax error
    if not confirm("Delete this supplier?"): return;
  }; 
  # Wait, wait, this is inside a JS string block for the Python script, I should write raw JS
  const deleteSupJS = \"\"\"const deleteSup = async (id) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      await api.delete(`/purchase/suppliers/${id}`);
      toast.success("Supplier deleted");
      loadSuppliers();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete supplier"); }
  };\"\"\"
  const openClientAdd = async () => {"""
    # Uh, I will just rewrite it cleanly without confusing Python variable names.
    )

    content = content.replace(
        '# Wait, wait, this is inside a JS string block for the Python script, I should write raw JS\n  const deleteSupJS = """const deleteSup = async (id) => {\n    if (!confirm("Delete this supplier?")) return;\n    try {\n      await api.delete(`/purchase/suppliers/${id}`);\n      toast.success("Supplier deleted");\n      loadSuppliers();\n    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete supplier"); }\n  };"""\n  const openClientAdd = async () => {',
        """const deleteSup = async (id) => {
    if (!window.confirm("Delete this supplier?")) return;
    try {
      await api.delete(`/purchase/suppliers/${id}`);
      toast.success("Supplier deleted");
      loadSuppliers();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete supplier"); }
  };

  const openClientAdd = async () => {"""
    )

# 6. Rewrite the massive rendering JSX block
split_token_start = '{activeTab === "clients" ? ('
split_token_end = ') : activeTab === "supervisors" ? ('

if split_token_start in content and split_token_end in content:
    parts1 = content.split(split_token_start)
    parts2 = parts1[1].split(split_token_end)
    
    new_jsx = """
      {activeTab === "suppliers" && (
        <>
          <CrudSection
            title="Service Contractors / Suppliers"
            icon={<Building2 size={18} className="text-brand" />}
            emptyMsg="No suppliers defined yet."
            columns={["Name", "Contact Person", "Phone", "Status", "Actions"]}
            rows={suppliers}
            loading={loading}
            onAdd={openSupAdd}
            onEdit={openSupEdit}
            onDelete={(s) => deleteSup(s.id)}
            renderRow={(s) => (
              <>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{s.supplier_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.contact_person || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.phone || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`badge ${s.is_active ? 'badge-success' : 'badge-error'} badge-sm`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </>
            )}
          />

          <ModalForm open={supModal} onClose={() => setSupModal(false)} title={editingSup ? "Edit Supplier" : "New Supplier"}>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Supplier Name *</label>
                  <input type="text" className="input w-full input-bordered" value={supForm.supplier_name} onChange={e => setSupForm(p => ({ ...p, supplier_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Supplier Type</label>
                  <select className="select w-full select-bordered" value={supForm.supplier_type} onChange={e => setSupForm(p => ({ ...p, supplier_type: e.target.value }))}>
                    <option value="LOCAL">LOCAL</option>
                    <option value="FOREIGN">FOREIGN</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Contact Person</label>
                  <input type="text" className="input w-full input-bordered" value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
                  <input type="email" className="input w-full input-bordered" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Phone</label>
                  <input type="text" className="input w-full input-bordered" value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-lg">
              <button type="button" className="btn btn-ghost" onClick={() => setSupModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSup} disabled={supSaving}>
                {supSaving ? "Saving..." : "Save Supplier"}
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
            columns={["Code", "Name", "Contact Person", "Phone", "Status", "Actions"]}
            rows={clients}
            loading={loading}
            onAdd={openClientAdd}
            onEdit={openClientEdit}
            onDelete={(c) => deleteClient(c.id)}
            renderRow={(c) => (
              <>
                <td className="px-4 py-3 text-sm text-slate-600">{c.customer_code}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{c.customer_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.contact_person || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.phone || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`badge ${c.is_active ? 'badge-success' : 'badge-error'} badge-sm`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </>
            )}
          />

          <ModalForm open={clientModal} onClose={() => setClientModal(false)} title={editingClient ? "Edit Client" : "New Client"}>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Client Name *</label>
                  <input type="text" className="input w-full input-bordered" value={clientForm.customer_name} onChange={e => setClientForm(p => ({ ...p, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Customer Code</label>
                  <input type="text" className="input w-full input-bordered" value={clientForm.customer_code} onChange={e => setClientForm(p => ({ ...p, customer_code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Client Type</label>
                  <select className="select w-full select-bordered" value={clientForm.customer_type} onChange={e => setClientForm(p => ({ ...p, customer_type: e.target.value }))}>
                    <option value="LOCAL">LOCAL</option>
                    <option value="FOREIGN">FOREIGN</option>
                    <option value="Individual">Individual</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Contact Person</label>
                  <input type="text" className="input w-full input-bordered" value={clientForm.contact_person} onChange={e => setClientForm(p => ({ ...p, contact_person: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
                  <input type="email" className="input w-full input-bordered" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Phone</label>
                  <input type="text" className="input w-full input-bordered" value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Address</label>
                  <input type="text" className="input w-full input-bordered" value={clientForm.address} onChange={e => setClientForm(p => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-lg">
              <button type="button" className="btn btn-ghost" onClick={() => setClientModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveClient} disabled={clientSaving}>
                {clientSaving ? "Saving..." : "Save Client"}
              </button>
            </div>
          </ModalForm>
        </>
      )}
      
      {activeTab === "supervisors" && (
"""
    content = parts1[0] + new_jsx + parts2[1]

with open(setup_path, 'w', encoding='utf8') as f:
    f.write(content)

print('Suppliers and Clients section updated in ServiceParametersPage.jsx successfully.')

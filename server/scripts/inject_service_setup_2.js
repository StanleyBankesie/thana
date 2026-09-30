const fs = require('fs');
const path = require('path');

const setupPath = path.join(__dirname, 'client/src/pages/modules/service-management/setup/ServiceParametersPage.jsx');
let content = fs.readFileSync(setupPath, 'utf8');

// 1. Rewrite loadClients and loadSuppliers to include setLoading(true)
content = content.replace(
  'const loadSuppliers = async () => {',
  'const loadSuppliers = async () => { setLoading(true);'
);
content = content.replace(
  '} catch { toast.error("Failed to load suppliers"); }',
  '} catch { toast.error("Failed to load suppliers"); } finally { setLoading(false); }'
);
content = content.replace(
  'const loadClients = async () => {',
  'const loadClients = async () => { setLoading(true);'
);
content = content.replace(
  '} catch { toast.error("Failed to load clients"); }',
  '} catch { toast.error("Failed to load clients"); } finally { setLoading(false); }'
);

// 2. We need to replace the entire `{activeTab === "clients" ? ( ... ) : (` block!
const splitTokenStart = '{activeTab === "clients" ? (';
const splitTokenEnd = ') : (\\n    <div className="bg-white';

const lines = content.split('\\n');
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{activeTab === "clients" ? (')) {
    startIndex = i;
  }
  if (startIndex !== -1 && lines[i].includes(') : (') && lines[i+1] && lines[i+1].includes('<div className="bg-white')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newJSX = \`
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
                <input type="text" className="input w-full" value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 pt-2 border-t flex justify-end gap-2 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setSupModal(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={saveSup} disabled={supSaving}>
                  {supSaving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null} Save Supplier
                </button>
              </div>
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
                <input type="text" className="input w-full" placeholder="+1234567890" value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 pt-2 border-t flex justify-end gap-2 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setClientModal(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={saveClient} disabled={clientSaving}>
                  {clientSaving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null} Save Client
                </button>
              </div>
            </div>
          </ModalForm>
        </>
      )}

      {activeTab !== "clients" && activeTab !== "suppliers" ? (
\`;

  const before = lines.slice(0, startIndex).join('\\n');
  const after = lines.slice(endIndex + 1).join('\\n');
  content = before + '\\n' + newJSX + '\\n' + after;
}

fs.writeFileSync(setupPath, content);
console.log("Successfully replaced the UI block!");

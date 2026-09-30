import os

setup_path = os.path.join('client', 'src', 'pages', 'modules', 'service-management', 'setup', 'ServiceParametersPage.jsx')

with open(setup_path, 'r', encoding='utf8') as f:
    content = f.read()

# 1. Rewrite loadClients and loadSuppliers to include setLoading(true)
content = content.replace(
  'const loadSuppliers = async () => {',
  'const loadSuppliers = async () => { setLoading(true);'
)
content = content.replace(
  '} catch { toast.error("Failed to load suppliers"); }',
  '} catch { toast.error("Failed to load suppliers"); } finally { setLoading(false); }'
)
content = content.replace(
  'const loadClients = async () => {',
  'const loadClients = async () => { setLoading(true);'
)
content = content.replace(
  '} catch { toast.error("Failed to load clients"); }',
  '} catch { toast.error("Failed to load clients"); } finally { setLoading(false); }'
)

# 2. Find the exact boundaries of the ternary to replace
lines = content.split('\n')
start_index = -1
end_index = -1

for i, line in enumerate(lines):
    if '{activeTab === "clients" ? (' in line:
        start_index = i
    if start_index != -1 and ') : (' in line and i+1 < len(lines) and '<div className="grid' in lines[i+1]:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    new_jsx = """
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
            onDelete={(s) => deleteSup(s.id)}
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
            onDelete={(c) => deleteClient(c.id)}
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
"""
    before = "\n".join(lines[:start_index])
    after = "\n".join(lines[end_index+1:])
    content = before + "\n" + new_jsx + "\n" + after

with open(setup_path, 'w', encoding='utf8') as f:
    f.write(content)

print(f"Replaced {start_index} to {end_index}")

const fs = require('fs');
const path = 'client/src/pages/modules/transport/settings/TransportSettings.jsx';
let content = fs.readFileSync(path, 'utf8');

// Add TAB_LABELS if missing
if (!content.includes('{ key: "suppliers", label: "Suppliers" }')) {
  content = content.replace(
    /const TAB_LABELS = \[[\s\S]*?\];/,
    (match) => {
      if(match.includes('suppliers')) return match;
      return match.replace(
        '{ key: "clients", label: "Service Clients" }',
        '{ key: "suppliers", label: "Suppliers" },\n  { key: "clients", label: "Service Clients" }'
      );
    }
  );
}

// Add state for suppliers
if (!content.includes('const [suppliers, setSuppliers] = useState([]);')) {
  content = content.replace(
    'const [clients, setClients] = useState([]);',
    `const [suppliers, setSuppliers] = useState([]);
  const [supModal, setSupModal] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({
    supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
    city: "", state: "", country: "Ghana", payment_terms: "", 
    tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
    service_contractor: true, industry: "Services", is_active: 1
  });
  const [supSaving, setSupSaving] = useState(false);

  const [clients, setClients] = useState([]);`
  );
}

// Add loadSuppliers
if (!content.includes('const loadSuppliers = useCallback(async () => {')) {
  content = content.replace(
    'const loadClients = useCallback(async () => {',
    `const loadSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/purchase/suppliers?contractor=Y");
      setSuppliers(res.data?.data?.items || res.data?.items || []);
    } catch { toast.error("Failed to load suppliers"); }
  }, []);

  const loadClients = useCallback(async () => {`
  );
}

// Add activeTab check for suppliers
if (!content.includes('if (activeTab === "suppliers") {')) {
  content = content.replace(
    'if (activeTab === "clients") {',
    `if (activeTab === "suppliers") {
      setLoading(true);
      Promise.all([loadSuppliers(), loadAccountsAndCurrencies()]).finally(() => setLoading(false));
    }
    if (activeTab === "clients") {`
  );
}

// Add suppliers methods
if (!content.includes('const openSupAdd = () => {')) {
  content = content.replace(
    'const openClientAdd = async () => {',
    `const openSupAdd = () => { 
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
        await api.put(\`/purchase/suppliers/\${editingSup.id}\`, payload);
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

  const openClientAdd = async () => {`
  );
}

// Add renderSuppliers
if (!content.includes('const renderSuppliers = () => {')) {
  content = content.replace(
    'const renderClients = () => {',
    `const renderSuppliers = () => {
    return (
      <>
        <CrudSection
          title="Service Contractors / Suppliers"
          icon={<span className="text-brand">🏢</span>}
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
                <span className={\`badge \${s.is_active ? 'badge-success' : 'badge-error'} badge-sm\`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </>
          )}
        />

        {supModal && (
          <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingSup ? "Edit Supplier" : "New Supplier"}</h3>
                <button onClick={() => setSupModal(false)} className="btn btn-ghost btn-sm">✕</button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Name *</label>
                    <input type="text" className="input w-full input-bordered" placeholder="Company Name" value={supForm.supplier_name} onChange={e => setSupForm(p => ({ ...p, supplier_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Supplier Type</label>
                    <select className="select w-full select-bordered" value={supForm.supplier_type} onChange={e => setSupForm(p => ({ ...p, supplier_type: e.target.value }))}>
                      <option value="LOCAL">LOCAL</option>
                      <option value="FOREIGN">FOREIGN</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                    <input type="text" className="input w-full input-bordered" value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="email" className="input w-full input-bordered" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                    <input type="text" className="input w-full input-bordered" value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-lg">
                <button type="button" className="btn btn-ghost" onClick={() => setSupModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveSup} disabled={supSaving}>
                  {supSaving ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderClients = () => {`
  );
}

// Add to switch case
if (!content.includes('case "suppliers": return renderSuppliers();')) {
  content = content.replace(
    'case "clients": return renderClients();',
    `case "suppliers": return renderSuppliers();\n        case "clients": return renderClients();`
  );
}

fs.writeFileSync(path, content);
console.log('Suppliers section added to TransportSettings.jsx successfully (without delete).');

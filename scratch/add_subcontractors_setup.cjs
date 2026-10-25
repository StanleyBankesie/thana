const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management', 'setup', 'Setup.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add HardHat and ArrowLeft imports if missing
if (!content.includes('HardHat')) {
  content = content.replace(
    'import { Loader2, User, Trash2, Plus, X, Pencil, Building2, Warehouse, Wrench, Settings',
    'import { Loader2, User, Trash2, Plus, X, Pencil, Building2, Warehouse, Wrench, Settings, HardHat'
  );
}

// 2. Add state for subcontractors
const subStateCode = `
  // ── Contractors / Subcontractors ───────────────────
  const [subcontractors, setSubcontractors] = useState([]);
  const [subModal, setSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [subForm, setSubForm] = useState({
    supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
    city: "", state: "", country: "Ghana", payment_terms: "", 
    tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
    service_contractor: true, industry: "Contractor/Subcontractor", is_active: 1,
    expense_account_id: "", currency_id: ""
  });
  const [subSaving, setSubSaving] = useState(false);
  const [subExpenseAccountSearch, setSubExpenseAccountSearch] = useState("");
  const subExpenseAccountResults = useMemo(() => {
    if (!subExpenseAccountSearch) return [];
    const q = subExpenseAccountSearch.toLowerCase();
    return accounts
      .filter((a) => String(a.name || "").toLowerCase().includes(q) || String(a.code || "").toLowerCase().includes(q))
      .slice(0, 50)
      .map((a) => ({ value: String(a.id), label: String(a.name), code: String(a.code) }));
  }, [subExpenseAccountSearch, accounts]);
`;

if (!content.includes('setSubcontractors')) {
  content = content.replace(
    'const [suppliers, setSuppliers] = useState([]);',
    `${subStateCode}\n  const [suppliers, setSuppliers] = useState([]);`
  );
}

// 3. Add loadSubcontractors loader
const subLoaderCode = `
  const loadSubcontractors = useCallback(async () => {
    try {
      const res = await api.get("/purchase/suppliers?contractor=Y");
      setSubcontractors(res.data?.data?.items || res.data?.items || []);
    } catch { toast.error("Failed to load contractors/subcontractors"); }
  }, []);
`;

if (!content.includes('loadSubcontractors')) {
  content = content.replace(
    'const loadSuppliers = useCallback(async () => {',
    `${subLoaderCode}\n  const loadSuppliers = useCallback(async () => {`
  );
  // Add to Promise.all
  content = content.replace(
    'loadSuppliers(), loadClients(),',
    'loadSubcontractors(), loadSuppliers(), loadClients(),'
  );
  content = content.replace(
    'loadSuppliers, loadClients,',
    'loadSubcontractors, loadSuppliers, loadClients,'
  );
}

// 4. Add handlers for Contractors / Subcontractors
const subHandlersCode = `
  /* ── Contractors / Subcontractors ── */
  const openSubAdd = () => { 
    setEditingSub(null); 
    setSubExpenseAccountSearch("");
    setSubForm({ 
      supplier_name: "", supplier_code: "", contact_person: "", email: "", phone: "", address: "", 
      city: "", state: "", country: "Ghana", payment_terms: "", 
      tax_id: "", business_reg_no: "", supplier_type: "LOCAL", 
      service_contractor: true, industry: "Contractor/Subcontractor", is_active: 1,
      expense_account_id: "", currency_id: baseCurrencyId
    }); 
    setSubModal(true); 
  };
  const openSubEdit = (s) => { 
    setEditingSub(s); 
    setSubExpenseAccountSearch(s.expense_account_id ? String(accounts.find(a => String(a.id) === String(s.expense_account_id))?.name || "") : "");
    setSubForm({ 
      supplier_name: s.supplier_name || "", supplier_code: s.supplier_code || "", 
      contact_person: s.contact_person || "", email: s.email || "", phone: s.phone || "", 
      address: s.address || "", city: s.city || "", state: s.state || "", country: s.country || "Ghana", 
      payment_terms: s.payment_terms || "", tax_id: s.tax_id || "", business_reg_no: s.business_reg_no || "", 
      supplier_type: s.supplier_type || "LOCAL", service_contractor: true, 
      industry: "Contractor/Subcontractor", is_active: s.is_active ?? 1,
      expense_account_id: s.expense_account_id || "", currency_id: s.currency_id || ""
    }); 
    setSubModal(true); 
  };

  const saveSub = async () => {
    if (!subForm.supplier_name.trim()) { toast.error("Contractor / Subcontractor name is required"); return; }
    setSubSaving(true);
    try {
      const payload = { ...subForm, service_contractor: "Y" };
      
      if (editingSub) {
        await api.put(\`/purchase/suppliers/\${editingSub.id}\`, payload);
        toast.success("Contractor / Subcontractor updated");
      } else {
        await api.post("/purchase/suppliers", payload);
        toast.success("Contractor / Subcontractor created");
      }
      setSubModal(false);
      loadSubcontractors();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save contractor/subcontractor"); }
    finally { setSubSaving(false); }
  };

  const deleteSub = async (id) => {
    if (!confirm("Delete this contractor/subcontractor?")) return;
    try {
      await api.delete(\`/purchase/suppliers/\${id}\`);
      toast.success("Contractor / Subcontractor deleted");
      loadSubcontractors();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete contractor/subcontractor"); }
  };
`;

if (!content.includes('openSubAdd')) {
  content = content.replace(
    '/* ── Suppliers ── */',
    `${subHandlersCode}\n  /* ── Suppliers ── */`
  );
}

// 5. Update TABS
if (!content.includes('"subcontractors"')) {
  content = content.replace(
    '{ id: "warehouses",  label: "Temp. Storage / Warehouses" },',
    `{ id: "warehouses",     label: "Temp. Storage / Warehouses" },\n    { id: "subcontractors", label: "Contractor / Subcontractor" },`
  );
}

// 6. Add UI section for activeTab === "subcontractors"
const subSectionJSX = `
      {activeTab === "subcontractors" && (
        <>
          <CrudSection
            title="Contractors / Subcontractors"
            icon={<HardHat size={18} className="text-brand-900 dark:text-brand-400" />}
            emptyMsg="No contractors or subcontractors defined yet."
            columns={["Name", "Contact Person", "Phone", "Status"]}
            rows={subcontractors}
            loading={loading}
            onAdd={openSubAdd}
            onEdit={openSubEdit}
            onDelete={deleteSub}
            renderRow={(s) => (
              <>
                <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{s.supplier_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{s.contact_person || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{s.phone || "—"}</td>
                <td className="px-4 py-3 text-sm">
                  {s.is_active ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Active</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Inactive</span>
                  )}
                </td>
              </>
            )}
          />

          <ModalForm open={subModal} onClose={() => setSubModal(false)} title={editingSub ? "Edit Contractor / Subcontractor" : "New Contractor / Subcontractor"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contractor / Subcontractor Name *</label>
                <input type="text" className="input w-full text-sm" placeholder="e.g. Acme Concrete & Engineering Ltd" value={subForm.supplier_name} onChange={e => setSubForm(p => ({ ...p, supplier_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contractor Type</label>
                <select className="input w-full text-sm" value={subForm.supplier_type} onChange={e => setSubForm(p => ({ ...p, supplier_type: e.target.value }))}>
                  <option value="LOCAL">LOCAL</option>
                  <option value="FOREIGN">FOREIGN</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Person</label>
                <input type="text" className="input w-full text-sm" placeholder="John Doe" value={subForm.contact_person} onChange={e => setSubForm(p => ({ ...p, contact_person: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                <input type="email" className="input w-full text-sm" placeholder="contact@example.com" value={subForm.email} onChange={e => setSubForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                <PhoneInput value={subForm.phone} onChange={v => setSubForm(p => ({ ...p, phone: v }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tax ID / TIN</label>
                <input type="text" className="input w-full text-sm" placeholder="Tax ID / TIN" value={subForm.tax_id} onChange={e => setSubForm(p => ({ ...p, tax_id: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Business Reg No</label>
                <input type="text" className="input w-full text-sm" placeholder="Registration No" value={subForm.business_reg_no} onChange={e => setSubForm(p => ({ ...p, business_reg_no: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                <input type="text" className="input w-full text-sm" placeholder="Physical Address" value={subForm.address} onChange={e => setSubForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">City</label>
                <input type="text" className="input w-full text-sm" placeholder="City" value={subForm.city} onChange={e => setSubForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">State/Region</label>
                <input type="text" className="input w-full text-sm" placeholder="State/Region" value={subForm.state} onChange={e => setSubForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Country</label>
                <input type="text" className="input w-full text-sm" placeholder="Country" value={subForm.country} onChange={e => setSubForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Expense Account</label>
                <input
                  type="text"
                  className="input w-full text-sm"
                  placeholder="Search account..."
                  value={subExpenseAccountSearch || ""}
                  onChange={(e) => {
                    setSubExpenseAccountSearch(e.target.value);
                    if (!e.target.value) {
                      setSubForm((p) => ({ ...p, expense_account_id: "" }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subExpenseAccountResults.length) {
                      const selected = subExpenseAccountResults[0];
                      const acc = accounts.find((a) => String(a.id) === selected.value);
                      if (acc) {
                        setSubExpenseAccountSearch(acc.name || "");
                        setSubForm((p) => ({ ...p, expense_account_id: String(acc.id) }));
                      }
                    }
                  }}
                />
                {subExpenseAccountSearch && subExpenseAccountResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {subExpenseAccountResults.map((o) => (
                      <button
                        type="button"
                        key={o.value}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                        onClick={() => {
                          setSubExpenseAccountSearch(o.label);
                          setSubForm((p) => ({ ...p, expense_account_id: o.value }));
                        }}
                      >
                        {o.label} <span className="text-xs text-slate-400">({o.code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Currency</label>
                <select
                  className="input w-full text-sm"
                  value={subForm.currency_id || ""}
                  onChange={(e) => setSubForm((p) => ({ ...p, currency_id: e.target.value }))}
                >
                  <option value="">Default Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment Terms</label>
                <input type="text" className="input w-full text-sm" placeholder="e.g. Net 30 days" value={subForm.payment_terms} onChange={e => setSubForm(p => ({ ...p, payment_terms: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="sub_active" checked={!!subForm.is_active} onChange={e => setSubForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} className="checkbox checkbox-sm" />
                <label htmlFor="sub_active" className="text-xs font-medium cursor-pointer">Active Contractor / Subcontractor</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setSubModal(false)} className="btn btn-secondary text-xs">Cancel</button>
              <button type="button" onClick={saveSub} disabled={subSaving} className="btn btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm">
                {subSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingSub ? "Update Contractor / Subcontractor" : "Create Contractor / Subcontractor"}
              </button>
            </div>
          </ModalForm>
        </>
      )}
`;

if (!content.includes('activeTab === "subcontractors"')) {
  content = content.replace(
    '{activeTab === "suppliers" && (',
    `${subSectionJSX}\n      {activeTab === "suppliers" && (`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Setup.jsx successfully updated with Contractors / Subcontractors section.');

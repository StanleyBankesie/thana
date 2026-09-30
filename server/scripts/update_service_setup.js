import fs from 'fs';

const filePath = 'client/src/pages/modules/service-management/setup/ServiceParametersPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add "clients" tab
if (!content.includes('{ key: "clients"')) {
  content = content.replace(
    /const TABS = \[/,
    `const TABS = [\n  { key: "clients", label: "Clients" },`
  );
}

// 2. Add lucide imports and accounts state if not there
if (!content.includes('import { Plus, Edit2, Trash2, Loader2, X } from "lucide-react"')) {
  content = content.replace(
    /import { toast } from "react-toastify";/,
    `import { toast } from "react-toastify";\nimport { Plus, Edit2, Trash2, Loader2, X } from "lucide-react";`
  );
}

// 3. Add states
const stateInjection = `
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
  const [clientRevenueAccountSearch, setClientRevenueAccountSearch] = useState("");

  const loadClients = async () => {
    try {
      const res = await api.get("/sales/customers");
      setClients(res.data?.items || res.data?.data?.items || []);
    } catch { toast.error("Failed to load clients"); }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/finance/accounts");
      setAccounts(res.data?.items || res.data?.data?.items || []);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === "clients") {
      loadClients();
      loadAccounts();
    }
  }, [activeTab]);

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
        await api.put(\`/sales/customers/\${editingClient.id}\`, payload);
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
      await api.delete(\`/sales/customers/\${id}\`);
      toast.success("Client deleted");
      loadClients();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }
  };
`;

if (!content.includes('const [clients, setClients] = useState([]);')) {
  content = content.replace(
    /const currentTab = TABS\.find/,
    stateInjection + '\n  const currentTab = TABS.find'
  );
}

// 4. Inject JSX
const customJSX = `
      {activeTab === "clients" ? (
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Service Clients</h3>
            <button onClick={openClientAdd} className="btn-primary text-xs py-1.5 px-3">
              <Plus size={14} className="inline mr-1" /> Add Client
            </button>
          </div>
          <table className="min-w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{c.customer_code}</td>
                  <td className="px-4 py-3 text-sm font-medium">{c.customer_name}</td>
                  <td className="px-4 py-3 text-sm">{c.contact_person || "-"}</td>
                  <td className="px-4 py-3 text-sm">{c.phone || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openClientEdit(c)} className="text-sky-600 mr-3 hover:underline">Edit</button>
                    <button onClick={() => deleteClient(c.id)} className="text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No clients defined</td></tr>
              )}
            </tbody>
          </table>

          {clientModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">{editingClient ? "Edit Client" : "New Client"}</h3>
                  <button onClick={() => setClientModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Customer Code *</label>
                      <input className="input" value={clientForm.customer_code} onChange={e => setClientForm({...clientForm, customer_code: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Customer Name *</label>
                      <input className="input" value={clientForm.customer_name} onChange={e => setClientForm({...clientForm, customer_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Contact Person</label>
                      <input className="input" value={clientForm.contact_person} onChange={e => setClientForm({...clientForm, contact_person: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Phone</label>
                      <input className="input" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold mb-1">Email</label>
                      <input className="input" type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold mb-1">Address</label>
                      <input className="input" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                  <button onClick={() => setClientModal(false)} className="btn-secondary">Cancel</button>
                  <button className="btn-primary" disabled={clientSaving} onClick={saveClient}>
                    {clientSaving ? <Loader2 size={14} className="animate-spin mr-1 inline" /> : null} Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (`;

if (!content.includes('activeTab === "clients" ? (')) {
  content = content.replace(
    /<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">/,
    customJSX + '\n        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">'
  );
  
  // Close the ternary that we opened
  content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*}\s*$/m,
    '      </div>\n      </div>\n      )}\n    </div>\n  );\n}\n'
  );
}

fs.writeFileSync(filePath, content);
console.log("Service parameters page updated with clients section.");

const fs = require('fs');
let c = fs.readFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', 'utf8');

if (!c.includes('const [salespersons, setSalespersons] = useState([]);')) {
  c = c.replace(
    'const [customers, setCustomers] = useState([]);',
    'const [customers, setCustomers] = useState([]);\n  const [salespersons, setSalespersons] = useState([]);'
  );
}

if (!c.includes('fetchSalespersons();')) {
  c = c.replace(
    'fetchCustomers();',
    'fetchCustomers();\n    fetchSalespersons();'
  );
}

if (!c.includes('const fetchSalespersons = async () => {')) {
  c = c.replace(
    'const fetchCustomers = async () => {',
    'const fetchSalespersons = async () => {\n    try {\n      const response = await api.get(\'/sales/sales-persons\');\n      setSalespersons(Array.isArray(response.data?.items) ? response.data.items : []);\n    } catch (error) {\n      console.error(\'Error fetching salespersons:\', error);\n    }\n  };\n\n  const fetchCustomers = async () => {'
  );
}

if (!c.includes('salesperson: "",')) {
  c = c.replace(
    'project_id: "",',
    'project_id: "",\n    salesperson: "",'
  );
}

// Replace the salesperson input with a dropdown
const oldInput = `                <label className="label">Salesperson</label>
                <input
                  type="text"
                  className="input"
                  value={form.salesperson}
                  onChange={(e) =>
                    setForm({ ...form, salesperson: e.target.value })
                  }
                  readOnly={readOnly}
                  placeholder="e.g. John Doe"
                />`;

const newDropdown = `                <label className="label">Salesperson</label>
                <select
                  className="input"
                  value={form.salesperson}
                  onChange={(e) => update("salesperson", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select Salesperson</option>
                  {salespersons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>`;

if (c.includes(oldInput)) {
  c = c.replace(oldInput, newDropdown);
} else {
  // Try regex in case of formatting differences
  c = c.replace(/<label className="label">Salesperson<\/label>\s*<input[^>]+value={form\.salesperson}[^>]+\/>/g, newDropdown);
}

fs.writeFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', c);
console.log('Done!');

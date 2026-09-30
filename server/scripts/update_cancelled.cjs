const fs = require('fs');
const path = 'client/src/pages/modules/sales/reports/CancelledOrdersReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
const statesToAdd = `
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);

  async function loadFilters() {
    try {
      const res = await api.get("/sales/customers");
      setCustomers(res.data?.items || []);
    } catch {}
  }
`;
content = content.replace('  const [loading, setLoading] = useState(false);', statesToAdd + '\n  const [loading, setLoading] = useState(false);');

// 2. add params to api.get
content = content.replace('api.get("/sales/reports/cancelled-orders");', 'api.get("/sales/reports/cancelled-orders", { params: { from: from || null, to: to || null, customerId: customerId || null } });');

// 3. run on loadFilters
content = content.replace('run();\n  }, []);', 'loadFilters();\n    run();\n  }, []);\n\n  useEffect(() => {\n    run();\n  }, [from, to, customerId]);');

// 4. Render UI
const filtersUi = `
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Customer</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">All</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
          </div>
`;
content = content.replace('{error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}', '{error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}\n' + filtersUi);

fs.writeFileSync(path, content, 'utf8');
console.log('CancelledOrdersReportPage updated');

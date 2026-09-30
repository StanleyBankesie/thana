const fs = require('fs');
const path = 'client/src/pages/modules/sales/sales-orders/SalesOrderForm.jsx';
let content = fs.readFileSync(path, 'utf8');

// add state
if (!content.includes('const [salespersons, setSalespersons] = useState([]);')) {
  content = content.replace(
    'const [customers, setCustomers] = useState([]);',
    'const [customers, setCustomers] = useState([]);\n  const [salespersons, setSalespersons] = useState([]);'
  );
}

// add to fetch
if (!content.includes('api.get("/sales/sales-persons")')) {
  content = content.replace(
    'api.get("/sales/price-types"),',
    'api.get("/sales/price-types"),\n        api.get("/sales/sales-persons"),'
  );
  content = content.replace(
    'const [tz, tp] = await Promise.all([',
    'const [tz, tp, ts] = await Promise.all(['
  );
  content = content.replace(
    'setPriceTypes(tp.data?.items || []);',
    'setPriceTypes(tp.data?.items || []);\n      setSalespersons(ts.data?.items || []);'
  );
}

// render dropdown
const dpHtml = `
          <div>
            <label className="label">Salesperson</label>
            <select
              className="input"
              value={formData.sales_person_id || ""}
              onChange={(e) => setFormData({ ...formData, sales_person_id: e.target.value })}
            >
              <option value="">-- None --</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
`;
if (!content.includes('value={formData.sales_person_id')) {
  content = content.replace(
    '<div>\n            <label className="label">Valid Days</label>',
    dpHtml + '\n          <div>\n            <label className="label">Valid Days</label>'
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('SalesOrderForm updated');

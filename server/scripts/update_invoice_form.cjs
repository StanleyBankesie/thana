const fs = require('fs');
const path = 'client/src/pages/modules/sales/invoices/InvoiceForm.jsx';
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
  // It fetches /sales/price-types somewhere, check what it fetches
  if (content.includes('api.get("/sales/price-types")')) {
    content = content.replace(
      'api.get("/sales/price-types"),',
      'api.get("/sales/price-types"),\n        api.get("/sales/sales-persons"),'
    );
    // Promise.all variables might be [tc, tp] or something
    content = content.replace(
      'const [tc, tp] = await Promise.all([',
      'const [tc, tp, ts] = await Promise.all(['
    );
    content = content.replace(
      'setPriceTypes(tp.data?.items || []);',
      'setPriceTypes(tp.data?.items || []);\n      setSalespersons(ts.data?.items || []);'
    );
  } else {
    // maybe it just fetches customers
    content = content.replace(
      'api.get("/sales/customers"),',
      'api.get("/sales/customers"),\n        api.get("/sales/sales-persons"),'
    );
    content = content.replace(
      'const [tc] = await Promise.all([',
      'const [tc, ts] = await Promise.all(['
    );
    content = content.replace(
      'setCustomers(tc.data?.items || []);',
      'setCustomers(tc.data?.items || []);\n      setSalespersons(ts.data?.items || []);'
    );
  }
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
  // Find a good place to insert.
  if (content.includes('<div>\n            <label className="label">Due Date</label>')) {
    content = content.replace(
      '<div>\n            <label className="label">Due Date</label>',
      dpHtml + '\n          <div>\n            <label className="label">Due Date</label>'
    );
  } else if (content.includes('<div>\n            <label className="label">Date</label>')) {
    content = content.replace(
      '<div>\n            <label className="label">Date</label>',
      dpHtml + '\n          <div>\n            <label className="label">Date</label>'
    );
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('InvoiceForm updated');

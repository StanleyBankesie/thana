const fs = require('fs');
const p = 'client/src/pages/modules/sales/invoices/InvoiceForm.jsx';
let c = fs.readFileSync(p, 'utf8');

const s = `<label className="label">Salesperson</label>
                <select
                  className="input w-56"
                  value={form.salesperson || ""}
                  onChange={(e) => update("salesperson", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select Salesperson</option>
                  {salespersons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Order</label>`;

if (c.includes('<label className="label">Order</label>')) {
  c = c.replace('<label className="label">Order</label>', s);
  fs.writeFileSync(p, c);
  console.log('SUCCESS');
} else {
  console.log('FAILED to find order label');
}

const fs = require('fs');
let c = fs.readFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', 'utf8');

const s = `              <div>
                <label className="label">Salesperson</label>
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

c = c.replace(`              <div>\n                <label className="label">Order</label>`, s);

fs.writeFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', c);
console.log('Dropdown added');

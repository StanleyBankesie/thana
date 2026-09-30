import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Vehicle Option replacement
content = content.replace(
  /\{vehicles\.map\(p => <option key=\{p\.id\} value=\{p\.id\}>\{p\.reg_number \|\| p\.registration_number\}<\/option>\)\}/g,
  `{vehicles.map(p => <option key={p.id} value={p.id}>{p.make} {p.model} - {p.reg_number || p.registration_number}</option>)}`
);

// 2. Deposit Account Replacement
content = content.replace(
  /\{accounts\.map\(a => <option key=\{a\.id\} value=\{a\.id\}>\{a\.code\} - \{a\.name\}<\/option>\)\}/g,
  `{accounts.filter(a => {
                      const gc = String(a.group_code || "").toUpperCase();
                      const gn = String(a.group_name || "").toUpperCase();
                      return gc === "AST_BANK" || gn === "BANK ACCOUNTS" || gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
                    }).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}`
);

// 3. Select w-full for Trip, Vehicle, Cost Center, Payment Method, Deposit Account
content = content.replace(/className="select select-bordered"/g, 'className="select select-bordered w-full"');
// and for description
content = content.replace(/className="textarea textarea-bordered h-24"/g, 'className="textarea textarea-bordered w-full h-24"');

// 4. Payment Method & Cheque Date/Reference
const paymentMethodBlock = `<div className="form-control">
                  <label className="label"><span className="label-text">Payment Method *</span></label>
                  <select className="select select-bordered w-full" required value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option><option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>`;

const newPaymentMethodBlock = `<div className="form-control">
                  <label className="label"><span className="label-text">Payment Method *</span></label>
                  <select className="select select-bordered w-full" required value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option><option value="Credit Card">Credit Card</option><option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>`;

const referenceBlock = `<div className="form-control">
                  <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} />
                </div>`;

const newReferenceBlock = `{['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method) && (
                  <>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                      <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} placeholder="Reference Number or Cheque Number" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Cheque Date</span></label>
                      <input type="date" className="input input-bordered w-full" value={form.cheque_date} onChange={e => setForm({...form, cheque_date: e.target.value})} />
                    </div>
                  </>
                )}`;

if (content.includes(paymentMethodBlock)) {
  content = content.replace(paymentMethodBlock, newPaymentMethodBlock);
}
if (content.includes(referenceBlock)) {
  content = content.replace(referenceBlock, newReferenceBlock);
}

// 5. Client Search block
const clientSearchBlock = `<div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Client / Organization *</span></label>
                  <div className="relative">
                    <input type="text" placeholder="Search Client..." className="input input-bordered w-full" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onClick={() => setCustomerSearch(form.customer_name || " ")} />
                    {customerSearchResults.length > 0 && (
                      <ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto">
                        {customerSearchResults.map(c => (
                          <li key={c.id}>
                            <button type="button" className="w-full text-left px-4 py-2 hover:bg-base-200" onClick={() => { setForm({...form, customer_id: c.id, customer_name: c.customer_name}); setCustomerSearch(""); }}>
                              {c.customer_name} ({c.customer_code})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {form.customer_id && <div className="text-sm text-green-600 mt-1">Selected: {form.customer_name}</div>}
                </div>`;

const newClientSearchBlock = `<div className="form-control">
                  <label className="label"><span className="label-text text-red-500 font-bold">Client / Organization *</span></label>
                  <div className="relative">
                    <input type="text" placeholder="Search Client..." className="input input-bordered w-full text-slate-900 font-medium" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); if(!e.target.value) setForm({...form, customer_id: "", customer_name: ""}); }} onClick={() => setCustomerSearch(form.customer_name || " ")} />
                    {customerSearchResults.length > 0 && (
                      <ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto border border-gray-200">
                        {customerSearchResults.map(c => (
                          <li key={c.id}>
                            <button type="button" className="w-full text-left px-4 py-2 hover:bg-base-200" onClick={() => { setForm({...form, customer_id: c.id, customer_name: c.customer_name}); setCustomerSearch(c.customer_name); }}>
                              {c.customer_name} ({c.customer_code})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>`;

if (content.includes(clientSearchBlock)) {
  content = content.replace(clientSearchBlock, newClientSearchBlock);
}

fs.writeFileSync(filePath, content);
console.log("Successfully updated TransportIncomeList.jsx with UI tweaks.");

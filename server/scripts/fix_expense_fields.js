import fs from 'fs';

let content = fs.readFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', 'utf8');

// 1. Change all <select className="select select-bordered" to <select className="input input-bordered w-full"
content = content.replace(/<select className="select select-bordered"/g, '<select className="input input-bordered w-full"');

// 2. Fix Supplier search logic & styling
content = content.replace(
  /<input type="text" placeholder="Search Supplier\.\.\." className="input input-bordered w-full" value=\{supplierSearch\} onChange=\{e => setSupplierSearch\(e\.target\.value\)\} onClick=\{\(\) => setSupplierSearch\(form\.supplier_name \|\| " "\)\} \/>/,
  `<input type="text" placeholder="Search Supplier..." className="input input-bordered w-full text-slate-900 font-medium" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); if(!e.target.value) setForm({...form, supplier_id: "", supplier_name: ""}); }} onClick={() => setSupplierSearch(form.supplier_name || " ")} />`
);

// 3. Description field required label
content = content.replace(
  /<label className="label"><span className="label-text">Description<\/span><\/label>/,
  `<label className="label"><span className="label-text font-bold">Description <span className="text-error">*</span></span></label>`
);

// 4. Inject Tax Block AFTER Cost Center
const costCenterBlock = `<div className="form-control">
                  <label className="label"><span className="label-text">Cost Center</span></label>
                  <select className="input input-bordered w-full" value={form.cost_center_id} onChange={e => setForm({...form, cost_center_id: e.target.value})}>
                    <option value="">-- No Cost Center --</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>`;

const taxBlock = `<div className="form-control">
                  <label className="inline-flex items-center gap-2 text-sm pt-8 cursor-pointer">
                    <input type="checkbox" className="checkbox checkbox-primary" checked={form.is_tax_included} onChange={e => {
                        const checked = Boolean(e.target.checked);
                        setForm({...form, is_tax_included: checked, tax_code_id: checked ? form.tax_code_id : ""});
                      }} />
                    <span className="font-medium text-slate-700">Is Tax Included</span>
                  </label>
                  {form.is_tax_included && (
                    <select className="input input-bordered w-full mt-2" value={form.tax_code_id || ""} onChange={e => setForm({...form, tax_code_id: e.target.value})}>
                      <option value="">Select tax code</option>
                      {taxCodes.map(t => <option key={t.id} value={t.id}>{t.name || t.tax_name || t.code}</option>)}
                    </select>
                  )}
                </div>`;

if (content.includes(costCenterBlock)) {
  content = content.replace(costCenterBlock, costCenterBlock + '\n                ' + taxBlock);
} else {
  console.error("Could not find Cost Center block to inject Tax Block.");
}

// 5. Replace Reference Block with Conditional Cheque Block
const oldRefBlock = `<div className="form-control">
                  <label className="label"><span className="label-text">Reference / Cheque No</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} />
                </div>`;

const newRefBlock = `{['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method) && (
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

if (content.includes(oldRefBlock)) {
  content = content.replace(oldRefBlock, newRefBlock);
} else {
  console.error("Could not find Reference block.");
}

fs.writeFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', content);
console.log("Successfully updated TransportExpenseList.jsx");

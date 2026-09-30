import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `<div className="form-control">
                  <label className="label"><span className="label-text">Payment Method *</span></label>`;

const replacementStr = `<div className="form-control">
                  <label className="inline-flex items-center gap-2 text-sm pt-8 cursor-pointer">
                    <input type="checkbox" className="checkbox checkbox-primary" checked={form.is_tax_included} onChange={e => {
                        const checked = Boolean(e.target.checked);
                        setForm({...form, is_tax_included: checked, tax_code_id: checked ? form.tax_code_id : ""});
                      }} />
                    <span className="font-medium text-slate-700">Is Tax Included</span>
                  </label>
                  {form.is_tax_included && (
                    <select className="select select-bordered w-full mt-2" value={form.tax_code_id || ""} onChange={e => setForm({...form, tax_code_id: e.target.value})}>
                      <option value="">Select tax code</option>
                      {taxCodes.map(t => <option key={t.id} value={t.id}>{t.name || t.tax_name || t.code}</option>)}
                    </select>
                  )}
                </div>
                ${targetStr}`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync(filePath, content);
console.log("Successfully injected 'Is Tax Included' UI into TransportIncomeList.jsx.");

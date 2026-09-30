import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/expenses/TransportExpenseList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add z-50 to Supplier form control
content = content.replace(
  /<div className="form-control">\s*<label className="label"><span className="label-text text-red-500 font-bold">Supplier \*<\/span><\/label>\s*<div className="relative">/g,
  `<div className="form-control relative z-50">
                  <label className="label"><span className="label-text font-bold">Supplier <span className="text-error">*</span></span></label>
                  <div className="relative z-50">`
);

// 2. Remove supplier code and apply dropdown styling
content = content.replace(
  /<ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto">/g,
  `<ul className="absolute z-[9999] w-full bg-white opacity-100 shadow-2xl rounded-box mt-1 max-h-48 overflow-y-auto border border-slate-300 isolate">`
);
content = content.replace(
  /\{s\.supplier_name\} \(\{s\.supplier_code\}\)/g,
  `{s.supplier_name}`
);

// 3. Fix Amount field label
content = content.replace(
  /<span className="label-text text-red-500 font-bold">Amount \*<\/span>/g,
  `<span className="label-text font-bold">Amount <span className="text-error">*</span></span>`
);

// 4. Update the Description field
content = content.replace(
  /<textarea className="textarea textarea-bordered h-24" placeholder="Notes or description\.\.\." value=\{form\.description\} onChange=\{e => setForm\(\{\.\.\.form, description: e\.target\.value\}\)\}/g,
  `<textarea required className="textarea textarea-bordered border border-slate-300 rounded-lg w-full h-24 p-3" value={form.description} onChange={e => setForm({...form, description: e.target.value})}`
);

// 5. Inject Is Tax Included right after Payment Source (PV)
const paymentSourceBlockRegex = /(<div className="form-control">\s*<label className="label"><span className="label-text">Payment Source \(PV\) \*<\/span><\/label>\s*<select[^>]+>\s*<option[^>]+>-- Select Account --<\/option>[\s\S]*?<\/select>\s*<\/div>)/;

const taxBlock = `<div className="form-control">
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
                </div>`;

content = content.replace(paymentSourceBlockRegex, `$1\n                ${taxBlock}`);

// 6. Make Cheque No and Cheque Date conditionally rendered on Payment Method
content = content.replace(
  /(<div className="form-control">\s*<label className="label"><span className="label-text">Reference \/ Cheque No<\/span><\/label>\s*<input type="text" className="input input-bordered w-full" value=\{form\.reference_no\}[\s\S]*?<\/div>\s*<div className="form-control">\s*<label className="label"><span className="label-text">Cheque Date<\/span><\/label>\s*<input type="date" className="input input-bordered w-full" value=\{form\.cheque_date\}[\s\S]*?<\/div>)/,
  `{['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method) && (
                  <>
                    $1
                  </>
                )}`
);

// 7. Update Auto-PV Logic
const oldPVLogicRegex = /const pvData = \{[\s\S]*?const pvRes = await api\.post\("\/finance\/vouchers\/payments", pvData\);\s*if \(pvRes\.data\?\.id\) \{\s*await api\.put\(`\/transport\/expenses\/\$\{expId\}\/voucher`, \{ voucher_id: pvRes\.data\.id \}\);\s*toast\.success\("Auto-created Payment Voucher in Finance"\);\s*\}/;

const newPVLogic = `const totalAmount = Number(form.amount);
            let totalTaxAmount = 0;
            const newLines = [];
            const description = form.description || \`Transportation Expense - Trip: \${trip?.trip_no || 'N/A'}, Vehicle: \${vehicle?.registration_number || 'N/A'}\`;
            const currencyCode = form.currency || "GHS";

            // 1. Credit the Supplier Account
            newLines.push({
              accountId: String(suppAcc.id),
              accountName: suppAcc.name || "",
              description: description,
              currencyCode,
              debit: 0,
              credit: totalAmount,
            });

            // 2. Debit Tax Components if applicable
            if (form.is_tax_included && form.tax_code_id) {
              try {
                const resp = await api.get(\`/finance/tax-codes/\${form.tax_code_id}/components\`);
                const comps = Array.isArray(resp.data?.items) ? resp.data.items : [];
                comps.forEach(comp => {
                  const rate = Number(comp.rate_percent || 0);
                  const compTaxAmount = Math.round(totalAmount * rate) / 100;
                  totalTaxAmount += compTaxAmount;
                  if (comp.account_id) {
                    newLines.push({
                      accountId: String(comp.account_id),
                      accountName: comp.account_name || "",
                      description: description || \`Tax - \${comp.component_name || ""}\`,
                      currencyCode,
                      debit: compTaxAmount,
                      credit: 0,
                      taxCodeId: form.tax_code_id
                    });
                  }
                });
              } catch (err) {
                console.error("Failed to load tax components", err);
              }
            }

            // 3. Debit Expense Account (Net Amount)
            const netAmount = totalAmount - totalTaxAmount;
            if (netAmount > 0) {
              const defaultExpAcc = accounts.find(a => String(a.group_code || "").toUpperCase() === "EXP_OPS" || String(a.group_name || "").toUpperCase().includes("EXPENSE"));
              newLines.push({
                accountId: String(defaultExpAcc?.id || suppAcc.id),
                accountName: defaultExpAcc?.name || suppAcc.name || "",
                description: description,
                currencyCode,
                debit: netAmount,
                credit: 0,
                taxCodeId: form.is_tax_included ? form.tax_code_id : undefined
              });
            }

            const voucherPayload = {
              voucherTypeCode: "PAYV",
              voucherDate: form.expense_date,
              isDirectPayment: true,
              status: "POSTED",
              paymentDetails: {
                accountId: suppAcc.id,
                paymentAccountId: form.payment_account_id,
                totalAmount: totalAmount,
                baseAmount: totalAmount,
                baseCurrencyCode: currencyCode,
                currencyCode: currencyCode,
                description: description,
                referenceNo: form.reference_no,
              },
              narration: \`Paid to: \${form.supplier_name} | Method: \${form.payment_method}\${form.reference_no ? \` | Ref: \${form.reference_no}\` : ''} | \${form.description || ''}\`,
              lines: newLines,
              costCenterId: form.cost_center_id
            };
            
            const resVoucher = await api.post("/finance/vouchers", voucherPayload);
            if (resVoucher.data?.id && expId) {
              await api.put(\`/transport/expenses/\${expId}/voucher\`, { voucher_id: resVoucher.data.id });
              toast.success("Payment Voucher auto-generated");
            }`;

content = content.replace(oldPVLogicRegex, newPVLogic);

fs.writeFileSync(filePath, content);
console.log("Updated TransportExpenseList.jsx successfully.");

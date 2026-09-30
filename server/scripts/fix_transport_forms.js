import fs from 'fs';

let content = fs.readFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', 'utf8');

// 1. Z-index for Supplier
content = content.replace(
  /<div className="form-control">\s*<label className="label"><span className="label-text text-red-500 font-bold">Supplier \*<\/span><\/label>\s*<div className="relative">/g,
  `<div className="form-control relative z-50">
                  <label className="label"><span className="label-text font-bold">Supplier <span className="text-error">*</span></span></label>
                  <div className="relative z-50">`
);

// 2. Dropdown styling & remove code
content = content.replace(
  /<ul className="absolute z-10 w-full bg-base-100 shadow-xl rounded-box mt-1 max-h-48 overflow-y-auto">/,
  `<ul className="absolute z-[9999] w-full bg-white opacity-100 shadow-2xl rounded-box mt-1 max-h-48 overflow-y-auto border border-slate-300 isolate">`
);
content = content.replace(
  /\{s\.supplier_name\} \(\{s\.supplier_code\}\)/g,
  `{s.supplier_name}`
);

// 3. Amount label
content = content.replace(
  /<span className="label-text text-red-500 font-bold">Amount \*<\/span>/g,
  `<span className="label-text font-bold">Amount <span className="text-error">*</span></span>`
);

// 4. Description
content = content.replace(
  /<textarea className="textarea textarea-bordered h-24" value=\{form\.description\}/g,
  `<textarea required className="textarea textarea-bordered border border-slate-300 rounded-lg w-full h-24 p-3" value={form.description}`
);

// 5. Cost Center & Tax Included
const costCenterRegex = /(<div className="form-control">\s*<label className="label"><span className="label-text">Cost Center<\/span><\/label>\s*<select className="select select-bordered" value=\{form\.cost_center_id\}[^>]*>\s*<option value="">-- No Cost Center --<\/option>\s*\{costCenters\.map[\s\S]*?<\/select>\s*<\/div>)/;

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

content = content.replace(costCenterRegex, `$1\n                ${taxBlock}`);

// 6. Conditional Cheque info
const chequeBlockRegex = /(<div className="form-control">\s*<label className="label"><span className="label-text">Reference \/ Cheque No<\/span><\/label>\s*<input type="text" className="input input-bordered w-full" value=\{form\.reference_no\}[^>]*>\s*<\/div>)/;

const newChequeBlock = `{['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method) && (
                  <>
                    $1
                    <div className="form-control">
                      <label className="label"><span className="label-text">Cheque Date</span></label>
                      <input type="date" className="input input-bordered w-full" value={form.cheque_date} onChange={e => setForm({...form, cheque_date: e.target.value})} />
                    </div>
                  </>
                )}`;

content = content.replace(chequeBlockRegex, newChequeBlock);

// 7. Auto-PV backend logic
const pvStartStr = 'const pvData = {';
const pvEndStr = 'toast.success("Auto-created Payment Voucher in Finance");\n            }';
const startIdx = content.indexOf(pvStartStr);
const endIdx = content.indexOf(pvEndStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
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
  content = content.substring(0, startIdx) + newPVLogic + content.substring(endIdx + pvEndStr.length);
}

fs.writeFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', content);
console.log("Updated Expense list");

// Now update Income list to move Tax block after Cost Center
let incomeContent = fs.readFileSync('client/src/pages/modules/transport/income/TransportIncomeList.jsx', 'utf8');

const taxBlockIncomeRegex = /(<div className="form-control">\s*<label className="inline-flex items-center gap-2 text-sm pt-8 cursor-pointer">[\s\S]*?<\/select>\s*\)\}\s*<\/div>\s*)/;
const match = incomeContent.match(taxBlockIncomeRegex);
if (match) {
  const taxBlockIncome = match[1];
  incomeContent = incomeContent.replace(taxBlockIncome, '');
  
  const costCenterIncRegex = /(<div className="form-control">\s*<label className="label"><span className="label-text">Cost Center<\/span><\/label>[\s\S]*?<\/select>\s*<\/div>)/;
  
  incomeContent = incomeContent.replace(costCenterIncRegex, `$1\n                ${taxBlockIncome.trim()}`);
  
  fs.writeFileSync('client/src/pages/modules/transport/income/TransportIncomeList.jsx', incomeContent);
  console.log("Updated Income list");
} else {
  console.log("Tax block not found in Income List");
}

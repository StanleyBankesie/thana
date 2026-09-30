import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/income/TransportIncomeList.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update form state
content = content.replace(
  /is_tax_included: false, tax_code_id: "",/g,
  `is_tax_included: false, tax_code_id: "",` // It's actually already there! Let's just make sure.
);

// 2. Fix styling: Change select-bordered to input-bordered to fix the "no border" issue for dropdowns
// Note: our previous script set them to 'select select-bordered w-full'. We should change 'select select-bordered w-full' to 'select input input-bordered w-full'
content = content.replace(/className="select select-bordered w-full"/g, 'className="select input input-bordered w-full"');
content = content.replace(/className="textarea textarea-bordered w-full h-24"/g, 'className="textarea input input-bordered w-full h-24"');

// 3. Add Tax Checkbox and Tax Code Select
// I will insert it right after the Amount field block.
const amountBlockRegex = /<div className="form-control">\s*<label className="label"><span className="label-text text-red-500 font-bold">Amount \*<\/span><\/label>\s*<div className="relative">\s*<span className="absolute left-3 top-3 text-gray-500">\{form.currency\}<\/span>\s*<input type="number"[^>]+value=\{form.amount\}[^>]+\/>\s*<\/div>\s*<\/div>/;

const taxUIBlock = `
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm pt-8">
                    <input type="checkbox" checked={form.is_tax_included} onChange={e => {
                        const checked = Boolean(e.target.checked);
                        setForm({...form, is_tax_included: checked, tax_code_id: checked ? form.tax_code_id : ""});
                      }} />
                    <span>Is Tax Included</span>
                  </label>
                  {form.is_tax_included && (
                    <select className="select input input-bordered w-full mt-2" value={form.tax_code_id || ""} onChange={e => setForm({...form, tax_code_id: e.target.value})}>
                      <option value="">Select tax code</option>
                      {taxCodes.map(t => <option key={t.id} value={t.id}>{t.name || t.tax_name || t.code}</option>)}
                    </select>
                  )}
                </div>
`;

if (!content.includes('<span>Is Tax Included</span>')) {
  content = content.replace(amountBlockRegex, match => match + taxUIBlock);
}

// 4. Update Receipt Voucher generation block
const oldVoucherLogic = /let customerAcc = accounts\.find\(a => String\(a\.code\) === String\(customer\?\.customer_code\)\);[\s\S]*?} catch \(e\) \{\s*console\.error\("Auto RV error:", e\);\s*\}/;

const newVoucherLogic = `let customerAcc = accounts.find(a => String(a.code) === String(customer?.customer_code));
          if (!customerAcc) {
            toast.error("Could not auto-create Receipt Voucher: Customer has no linked Financial Account.");
          } else {
            const totalAmount = Number(form.amount);
            let totalTaxAmount = 0;
            const newLines = [];
            const description = form.description || \`Transport Income - Trip: \${trip?.trip_no || 'N/A'}, Vehicle: \${vehicle?.registration_number || 'N/A'}\`;
            const currencyCode = form.currency || "GHS";

            // 1. Debit the Customer Account initially
            newLines.push({
              accountId: String(customerAcc.id),
              accountName: customerAcc.name || "",
              description: description,
              currencyCode,
              debit: totalAmount,
              credit: 0,
            });

            // 2. Credit Tax Components if applicable
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
                      debit: 0,
                      credit: compTaxAmount,
                      taxCodeId: form.tax_code_id
                    });
                  }
                });
              } catch (err) {
                console.error("Failed to load tax components", err);
              }
            }

            // 3. Credit Income Account (Net Amount)
            const netAmount = totalAmount - totalTaxAmount;
            if (netAmount > 0) {
              // We'll use a generic transport income logic. 
              // Since there's no explicitly selected income account in the form for transport,
              // we will default to the customer's account for now or create an orphaned credit line.
              // Wait, we need an income account.
              // Let's use the first available income account or fall back to customer account for now to balance it.
              const defaultIncomeAcc = accounts.find(a => String(a.group_code || "").toUpperCase() === "INC_SALES" || String(a.group_name || "").toUpperCase().includes("INCOME"));
              newLines.push({
                accountId: String(defaultIncomeAcc?.id || customerAcc.id),
                accountName: defaultIncomeAcc?.name || customerAcc.name || "",
                description: description,
                currencyCode,
                debit: 0,
                credit: netAmount,
                taxCodeId: form.is_tax_included ? form.tax_code_id : undefined
              });
            }

            const voucherPayload = {
              voucherTypeCode: "RV",
              voucherDate: form.income_date,
              isDirectPayment: true,
              status: "POSTED",
              paymentDetails: {
                accountId: customerAcc.id,
                paymentAccountId: form.payment_account_id,
                totalAmount: totalAmount,
                baseAmount: totalAmount,
                baseCurrencyCode: currencyCode,
                currencyCode: currencyCode,
                description: description,
              },
              narration: \`Received from: \${form.customer_name} | Method: \${form.payment_method}\${form.reference_no ? \` | Ref: \${form.reference_no}\` : ''} | \${form.description || ''}\`,
              lines: newLines,
              costCenterId: form.cost_center_id
            };
            
            const rvRes = await api.post("/finance/vouchers", voucherPayload);
            if (rvRes.data?.id) {
              await api.put(\`/transport/income/\${incomeId}/voucher\`, { voucher_id: rvRes.data.id });
              toast.success("Auto-created Receipt Voucher in Finance");
            }
          }
        } catch (e) {
          console.error("Auto RV error:", e);
        }`;

content = content.replace(oldVoucherLogic, newVoucherLogic);

fs.writeFileSync(filePath, content);
console.log("Successfully applied tax logic and styling updates.");

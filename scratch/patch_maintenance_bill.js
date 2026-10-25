import fs from 'fs';

const filePath = './client/src/pages/modules/maintenance/maintenance-bills/MaintenanceBillForm.jsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Ensure TaxPricingModal import
if (!content.includes('TaxPricingModal')) {
  content = content.replace(
    'import { usePermission } from "@/auth/PermissionContext.jsx";',
    'import { usePermission } from "@/auth/PermissionContext.jsx";\nimport TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";'
  );
}

// 2. Add tax_mode and tax_component_name to newItem
if (!content.includes('tax_component_name: ""')) {
  content = content.replace(
    'tax_code_id: "",\n  });\n  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});',
    'tax_code_id: "",\n    tax_mode: "EXCLUSIVE",\n    tax_component_name: "",\n  });\n  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});\n  const [taxModalOpen, setTaxModalOpen] = useState(false);'
  );
}

// 3. Update calcNewItemTaxBreakdown
const oldCalc = `  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const rate = Number(newItem.rate || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * rate;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];

    if (comps.length > 0) {
      comps.forEach((c) => {
        const r = Number(c.rate_percent) || 0;
        const amt = (taxableTotal * r) / 100;
        components.push({ name: c.component_name, rate: r, amount: amt });
        taxTotal += amt;
      });
    } else if (newItem.tax_code_id) {
      const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
      const r = tc ? Number(tc.rate_percent) || 0 : 0;
      const amt = (taxableTotal * r) / 100;
      if (r > 0) {
        components.push({ name: "Tax", rate: r, amount: amt });
        taxTotal = amt;
      }
    }
    return { components, taxTotal, taxableTotal };
  };`;

const newCalc = `  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const rate = Number(newItem.rate || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * rate;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);
    const isInclusive = String(newItem.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
    const singleRate = newItem.tax_rate !== undefined && newItem.tax_rate !== null
      ? Number(newItem.tax_rate)
      : (tc ? Number(tc.rate_percent) || 0 : 0);

    if (isInclusive && singleRate > 0) {
      const net = taxableTotal / (1 + singleRate / 100);
      taxTotal = taxableTotal - net;
      components.push({ name: newItem.tax_component_name || tc?.name || "Tax (Inclusive)", rate: singleRate, amount: taxTotal });
      return { components, taxTotal, taxableTotal };
    }

    if (comps.length > 0) {
      comps.forEach((c) => {
        const r = Number(c.rate_percent) || 0;
        const amt = (taxableTotal * r) / 100;
        components.push({ name: c.component_name, rate: r, amount: amt });
        taxTotal += amt;
      });
    } else if (newItem.tax_code_id) {
      const r = singleRate;
      const amt = (taxableTotal * r) / 100;
      if (r > 0) {
        components.push({ name: newItem.tax_component_name || tc?.name || "Tax", rate: r, amount: amt });
        taxTotal = amt;
      }
    }
    return { components, taxTotal, taxableTotal };
  };`;

if (content.includes(oldCalc)) {
  content = content.replace(oldCalc, newCalc);
}

// 4. Update addItemToLines
const oldAddItem = `  const addItemToLines = () => {
    if (!newItem.description || !newItem.qty) return;
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    setLines((p) => [
      ...p,
      {
        ...newItem,
        id: Date.now(),
        tax_amount: taxTotal,
        amount: taxableTotal + taxTotal,
      },
    ]);
    setNewItem({
      description: "",
      category: "",
      qty: 1,
      rate: 0,
      discount_percent: 0,
      tax_code_id: "",
    });
  };`;

const newAddItem = `  const addItemToLines = () => {
    if (!newItem.description || !newItem.qty) return;
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    const isInclusive = String(newItem.tax_mode || '').toUpperCase() === 'INCLUSIVE';
    setLines((p) => [
      ...p,
      {
        ...newItem,
        id: Date.now(),
        tax_amount: taxTotal,
        amount: isInclusive ? taxableTotal : (taxableTotal + taxTotal),
      },
    ]);
    setNewItem({
      description: "",
      category: "",
      qty: 1,
      rate: 0,
      discount_percent: 0,
      tax_code_id: "",
      tax_mode: "EXCLUSIVE",
      tax_component_name: "",
    });
  };`;

if (content.includes(oldAddItem)) {
  content = content.replace(oldAddItem, newAddItem);
}

// 5. Update totals useMemo
const oldTotals = `  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    const compTotals = {};
    for (const r of lines) {
      const base = Number(r.qty || 0) * Number(r.rate || 0);
      sub += base;
      const d = base * (Number(r.discount_percent || 0) / 100);
      disc += d;
      const taxable = base - d;

      const taxCodeId = r.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = (taxable * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) {
            compTotals[name] = {
              amount: 0,
              rate,
              sort_order: c.sort_order || 0,
            };
          }
          compTotals[name].amount += amt;
        });
      } else {
        const txRate = Number(
          (taxCodes.find((t) => String(t.id) === String(taxCodeId)) || {})
            .rate_percent || 0,
        );
        const taxVal = taxable * (txRate / 100);
        if (txRate > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: txRate, sort_order: 99 };
          }
          compTotals[name].amount += taxVal;
        }
      }
    }
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const other = Number(form.other_charges || 0);
    return {
      subtotal: sub,
      discountAmount: disc,
      taxAmount: taxTotal,
      otherCharges: other,
      total: sub - disc + taxTotal + other,
      components,
    };
  }, [lines, taxCodes, form.other_charges, taxComponentsByCode]);`;

const newTotals = `  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    const compTotals = {};
    for (const r of lines) {
      const base = Number(r.qty || 0) * Number(r.rate || 0);
      sub += base;
      const d = base * (Number(r.discount_percent || 0) / 100);
      disc += d;
      const taxable = base - d;
      const isInclusive = String(r.tax_mode || '').toUpperCase() === 'INCLUSIVE';

      const taxCodeId = r.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      const tc = taxCodes.find((t) => String(t.id) === String(taxCodeId));
      const singleRate = r.tax_rate !== undefined && r.tax_rate !== null
        ? Number(r.tax_rate)
        : (tc ? Number(tc.rate_percent) || 0 : 0);

      if (isInclusive && singleRate > 0) {
        const net = taxable / (1 + singleRate / 100);
        const taxVal = taxable - net;
        const name = r.tax_component_name || tc?.name || "Tax (Inclusive)";
        if (!compTotals[name]) {
          compTotals[name] = { amount: 0, rate: singleRate, sort_order: 99 };
        }
        compTotals[name].amount += taxVal;
      } else if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = (taxable * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) {
            compTotals[name] = {
              amount: 0,
              rate,
              sort_order: c.sort_order || 0,
            };
          }
          compTotals[name].amount += amt;
        });
      } else {
        const txRate = singleRate;
        const taxVal = taxable * (txRate / 100);
        if (txRate > 0) {
          const name = r.tax_component_name || tc?.name || "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: txRate, sort_order: 99 };
          }
          compTotals[name].amount += taxVal;
        }
      }
    }
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const other = Number(form.other_charges || 0);
    const grandTotal = lines.reduce((acc, l) => acc + Number(l.amount || 0), 0) + other;
    return {
      subtotal: sub,
      discountAmount: disc,
      taxAmount: taxTotal,
      otherCharges: other,
      total: grandTotal,
      components,
    };
  }, [lines, taxCodes, form.other_charges, taxComponentsByCode]);`;

if (content.includes(oldTotals)) {
  content = content.replace(oldTotals, newTotals);
}

// 6. Update Rate input with TaxModeRadioSelector
const oldRateInput = `                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rate</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                </div>`;

const newRateInput = `                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rate / Price</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                  <TaxModeRadioSelector
                    price={newItem.rate}
                    taxMode={newItem.tax_mode}
                    onModeChange={(m) => setNewItem((p) => ({ ...p, tax_mode: m }))}
                    onOpenTaxModal={() => setTaxModalOpen(true)}
                    selectedTaxLabel={newItem.tax_component_name}
                    className="mt-1"
                  />
                </div>`;

if (content.includes(oldRateInput)) {
  content = content.replace(oldRateInput, newRateInput);
}

// 7. Update Tax Code dropdown in Add Service Line
const oldTaxSelect = `                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tax Code</label>
                  <select
                    className="input text-sm w-full"
                    value={newItem.tax_code_id}
                    onChange={(e) => setNewItem({ ...newItem, tax_code_id: e.target.value })}
                  >
                    <option value="">No Tax</option>
                    {taxCodes.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>`;

const newTaxSelect = `                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tax Component</label>
                  <div
                    onClick={() => setTaxModalOpen(true)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between hover:border-brand-500 transition-colors shadow-sm min-h-[38px]"
                    title="Click to select tax component"
                  >
                    <span className="truncate text-slate-800 dark:text-slate-200">
                      {newItem.tax_component_name || (newItem.tax_code_id ? taxCodes.find(t => String(t.id) === String(newItem.tax_code_id))?.name : '-- Select Component --')}
                    </span>
                    {newItem.tax_rate !== undefined && (
                      <span className="text-[11px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0 ml-1">
                        {Number(newItem.tax_rate)}%
                      </span>
                    )}
                  </div>
                </div>`;

if (content.includes(oldTaxSelect)) {
  content = content.replace(oldTaxSelect, newTaxSelect);
}

// 8. Add TaxPricingModal before final closing tags
const modalCode = `      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        onClose={() => setTaxModalOpen(false)}
        taxMode={newItem.tax_mode || 'EXCLUSIVE'}
        selectedComponent={{
          name: newItem.tax_component_name,
          rate: newItem.tax_rate,
          id: newItem.tax_code_id,
        }}
        onSelectComponent={(comp) => {
          const compLabel = \`\${comp.name}\${comp.rate !== undefined ? \` (\${comp.rate}%)\` : ''}\`;
          setNewItem((prev) => ({
            ...prev,
            tax_code_id: comp.tax_code_id || comp.id,
            tax_rate: comp.rate,
            tax_component_name: compLabel,
            tax_mode: comp.tax_mode || prev.tax_mode || 'EXCLUSIVE',
          }));
          setTaxModalOpen(false);
        }}
      />
    </div>
  );
}`;

if (!content.includes('Universal Tax Pricing & Components Modal')) {
  content = content.replace(/<\/div>\s*\);\s*}\s*$/, modalCode);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('MaintenanceBillForm successfully patched!');

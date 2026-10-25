import fs from 'fs';

// Helper for Bill Forms (ServiceBillForm, ServiceBillingForm, TransportationBillForm, FuelBillForm, MaintenanceBillForm)
export function patchBillForm(filePath) {
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  // 1. Ensure import
  if (!content.includes('TaxPricingModal')) {
    const importMarker = content.includes('import { usePermission }')
      ? 'import { usePermission }'
      : 'import React,';
    content = content.replace(
      importMarker,
      `import TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";\n${importMarker}`
    );
  }

  // 2. Add tax_mode and tax_component_name to newItem
  if (!content.includes('tax_component_name: ""')) {
    content = content.replace(
      'tax_code_id: "",',
      'tax_code_id: "",\n    tax_mode: "EXCLUSIVE",\n    tax_component_name: "",'
    );
  }

  // 3. Add modal state
  if (!content.includes('editingLineId') && !content.includes('taxModalOpen')) {
    content = content.replace(
      'const [lines, setLines] = useState([]);',
      'const [lines, setLines] = useState([]);\n  const [taxModalOpen, setTaxModalOpen] = useState(false);\n  const [editingLineId, setEditingLineId] = useState(null);'
    );
  }

  // 4. Update calcNewItemTaxBreakdown to handle Inclusive
  const targetFnOld = `    const taxableTotal = Math.max(0, gross - disc);

    const components = [];
    let taxTotal = 0;`;

  const targetFnNew = `    const taxableTotal = Math.max(0, gross - disc);
    const isInclusive = String(newItem.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    const components = [];
    let taxTotal = 0;`;

  if (!content.includes('const isInclusive = String(newItem.tax_mode') && content.includes(targetFnOld)) {
    content = content.replace(targetFnOld, targetFnNew);
  }

  // 5. Update Rate input with TaxModeRadioSelector
  const rateInputOld = `                        name="rate"
                        step="0.01"
                        className="input w-full text-xs text-right"
                        value={newItem.rate}
                        onChange={handleNewItemChange}
                      />`;

  const rateInputNew = `                        name="rate"
                        step="0.01"
                        className="input w-full text-xs text-right"
                        value={newItem.rate}
                        onChange={handleNewItemChange}
                      />
                      <TaxModeRadioSelector
                        price={newItem.rate}
                        taxMode={newItem.tax_mode}
                        onModeChange={(m) => setNewItem((p) => ({ ...p, tax_mode: m }))}
                        onOpenTaxModal={() => {
                          setEditingLineId(null);
                          setTaxModalOpen(true);
                        }}
                        selectedTaxLabel={newItem.tax_component_name}
                        className="mt-1"
                      />`;

  if (content.includes(rateInputOld) && !content.includes('onModeChange={(m) => setNewItem')) {
    content = content.replace(rateInputOld, rateInputNew);
  }

  // 6. Alternative Rate input format (for transport bills)
  const rateInputAltOld = `<input type="number" name="rate" className="input text-sm w-full" value={newItem.rate} onChange={handleNewItemChange} />`;
  const rateInputAltNew = `<input type="number" name="rate" className="input text-sm w-full" value={newItem.rate} onChange={handleNewItemChange} />
                      <TaxModeRadioSelector
                        price={newItem.rate}
                        taxMode={newItem.tax_mode}
                        onModeChange={(m) => setNewItem((p) => ({ ...p, tax_mode: m }))}
                        onOpenTaxModal={() => {
                          setEditingLineId(null);
                          setTaxModalOpen(true);
                        }}
                        selectedTaxLabel={newItem.tax_component_name}
                        className="mt-1"
                      />`;

  if (content.includes(rateInputAltOld) && !content.includes('onModeChange={(m) => setNewItem')) {
    content = content.replace(rateInputAltOld, rateInputAltNew);
  }

  // 7. Update Tax Code dropdown in Add Item section
  const taxCodeSelectOld = `                      <select
                        name="tax_code_id"
                        className="input w-full text-xs"
                        value={newItem.tax_code_id}
                        onChange={handleNewItemChange}
                      >
                        <option value="">No Tax</option>
                        {taxCodes.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.name}
                          </option>
                        ))}
                      </select>`;

  const taxCodeSelectNew = `                      <div
                        onClick={() => {
                          setEditingLineId(null);
                          setTaxModalOpen(true);
                        }}
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
                      </div>`;

  if (content.includes(taxCodeSelectOld)) {
    content = content.replace(taxCodeSelectOld, taxCodeSelectNew);
  }

  // 8. Update recalcLine
  const oldRecalcLine = `  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    const gross = qty * rate;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    let taxAmount = 0;
    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(line.tax_code_id));
    const isNoTax = /no\\s*tax/i.test(String(tc?.name || ""));`;

  const newRecalcLine = `  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    const gross = qty * rate;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    const isInclusive = String(line.tax_mode || '').toUpperCase() === 'INCLUSIVE';
    let taxAmount = 0;
    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(line.tax_code_id));
    const tcRate = line.tax_rate !== undefined && line.tax_rate !== null ? Number(line.tax_rate) : (tc ? Number(tc.rate_percent) || 0 : 0);
    const isNoTax = /no\\s*tax/i.test(String(tc?.name || ""));

    if (isInclusive && tcRate > 0) {
      const net = taxable / (1 + tcRate / 100);
      taxAmount = taxable - net;
      return { ...line, tax_amount: taxAmount, line_total: taxable, tax_rate: tcRate, tax_mode: 'INCLUSIVE' };
    }`;

  if (!content.includes('if (isInclusive && tcRate > 0)') && content.includes(oldRecalcLine)) {
    content = content.replace(oldRecalcLine, newRecalcLine);
  }

  // 9. Add TaxPricingModal before closing tag
  const modalSnippet = `
      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        onClose={() => {
          setTaxModalOpen(false);
          setEditingLineId(null);
        }}
        taxMode={
          editingLineId
            ? (lines.find(l => l.id === editingLineId)?.tax_mode || 'EXCLUSIVE')
            : (newItem.tax_mode || 'EXCLUSIVE')
        }
        selectedComponent={
          editingLineId
            ? {
                name: lines.find(l => l.id === editingLineId)?.tax_component_name,
                rate: lines.find(l => l.id === editingLineId)?.tax_rate,
                id: lines.find(l => l.id === editingLineId)?.tax_code_id,
              }
            : {
                name: newItem.tax_component_name,
                rate: newItem.tax_rate,
                id: newItem.tax_code_id,
              }
        }
        onSelectComponent={(comp) => {
          const compLabel = \`\${comp.name}\${comp.rate !== undefined ? \` (\${comp.rate}%)\` : ''}\`;
          if (editingLineId) {
            setLines(prev => prev.map(l => {
              if (l.id !== editingLineId) return l;
              const updated = {
                ...l,
                tax_code_id: comp.tax_code_id || comp.id,
                tax_rate: comp.rate,
                tax_component_name: compLabel,
                tax_mode: comp.tax_mode || l.tax_mode || 'EXCLUSIVE',
              };
              return typeof recalcLine === 'function' ? recalcLine(updated) : updated;
            }));
          } else {
            setNewItem((prev) => ({
              ...prev,
              tax_code_id: comp.tax_code_id || comp.id,
              tax_rate: comp.rate,
              tax_component_name: compLabel,
              tax_mode: comp.tax_mode || prev.tax_mode || 'EXCLUSIVE',
            }));
          }
          setTaxModalOpen(false);
          setEditingLineId(null);
        }}
      />
    </div>
  );
}`;

  if (!content.includes('Universal Tax Pricing & Components Modal')) {
    if (content.endsWith('</div>\n  );\n}')) {
      content = content.slice(0, -('</div>\n  );\n}'.length)) + modalSnippet;
    } else if (content.endsWith('</div>\r\n  );\r\n}')) {
      content = content.slice(0, -('</div>\r\n  );\r\n}'.length)) + modalSnippet;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully patched', filePath);
}

patchBillForm('./client/src/pages/modules/service-management/service-bills/ServiceBillForm.jsx');
patchBillForm('./client/src/pages/modules/facilities/servicebilling/ServiceBillingForm.jsx');
patchBillForm('./client/src/pages/modules/transport/transportation-bills/TransportationBillForm.jsx');
patchBillForm('./client/src/pages/modules/transport/fuel-bills/FuelBillForm.jsx');

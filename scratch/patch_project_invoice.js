import fs from 'fs';

const filePath = './client/src/pages/modules/project-management/project-invoices/ProjectInvoiceForm.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure import
if (!content.includes('TaxPricingModal')) {
  content = content.replace(
    'import { usePermission } from "../../../../auth/PermissionContext.jsx";',
    'import { usePermission } from "../../../../auth/PermissionContext.jsx";\nimport TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";'
  );
}

// 2. Add state to newItem
const oldNewItem = `  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: "",
    tax_type: "",
    tax_rate: undefined,
    remarks: "",
    uom: "",
  });`;

const newNewItem = `  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: "",
    tax_type: "",
    tax_rate: undefined,
    tax_mode: "EXCLUSIVE",
    tax_component_name: "",
    remarks: "",
    uom: "",
  });
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingLineTaxIdx, setEditingLineTaxIdx] = useState(null);`;

if (content.replace(/\r\n/g, '\n').includes(oldNewItem.replace(/\r\n/g, '\n'))) {
  content = content.replace(/\r\n/g, '\n').replace(oldNewItem.replace(/\r\n/g, '\n'), newNewItem);
}

// 3. Update calcItemTotals
const oldCalcItemTotals = `  function calcItemTotals(itm) {
    const qty = Math.round(Number(itm.qty || 0) * 100) / 100;
    const price = Math.round(Number(itm.unit_price || 0) * 100) / 100;
    const disc = Math.round(Number(itm.discount_percent || 0) * 100) / 100;
    const sub = Math.round(qty * price * 100) / 100;
    const discAmt = Math.round(((sub * disc) / 100) * 100) / 100;
    const net = Math.round((sub - discAmt) * 100) / 100;
    const taxRate =
      taxes.find((t) => String(t.value) === String(itm.tax_type))?.rate || 0;
    const taxAmt = Math.round(((net * taxRate) / 100) * 100) / 100;
    const total = Math.round((net + taxAmt) * 100) / 100;
    return { sub, discAmt, net, taxAmt, total, line_total: total };
  }`;

const newCalcItemTotals = `  function calcItemTotals(itm) {
    const qty = Math.round(Number(itm.qty || 0) * 100) / 100;
    const price = Math.round(Number(itm.unit_price || 0) * 100) / 100;
    const disc = Math.round(Number(itm.discount_percent || 0) * 100) / 100;
    const sub = Math.round(qty * price * 100) / 100;
    const discAmt = Math.round(((sub * disc) / 100) * 100) / 100;
    const discountedGross = Math.round((sub - discAmt) * 100) / 100;

    const taxRate =
      itm.tax_rate !== undefined && itm.tax_rate !== null
        ? Number(itm.tax_rate)
        : taxes.find((t) => String(t.value) === String(itm.tax_type))?.rate || 0;
    const isInclusive = String(itm.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    let net = discountedGross;
    let taxAmt = 0;
    let total = discountedGross;

    if (taxRate > 0) {
      if (isInclusive) {
        total = discountedGross;
        net = Math.round((total / (1 + taxRate / 100)) * 100) / 100;
        taxAmt = Math.round((total - net) * 100) / 100;
      } else {
        net = discountedGross;
        taxAmt = Math.round(((net * taxRate) / 100) * 100) / 100;
        total = Math.round((net + taxAmt) * 100) / 100;
      }
    }

    return { sub, discAmt, net, taxAmt, total, line_total: total, tax_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE', isInclusive };
  }`;

if (content.includes(oldCalcItemTotals)) {
  content = content.replace(oldCalcItemTotals, newCalcItemTotals);
}

// 4. Update Price input to add TaxModeRadioSelector
const priceFieldPattern = `<input
                      type="number"
                      name="unit_price"
                      value={
                        newItem.unit_price === "" ? "" : newItem.unit_price
                      }
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      step="1"
                    />`;

const newPriceField = `<input
                      type="number"
                      name="unit_price"
                      value={
                        newItem.unit_price === "" ? "" : newItem.unit_price
                      }
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      step="1"
                    />
                    <TaxModeRadioSelector
                      price={newItem.unit_price}
                      taxMode={newItem.tax_mode}
                      onModeChange={(m) => setNewItem((p) => ({ ...p, tax_mode: m }))}
                      onOpenTaxModal={() => {
                        setEditingLineTaxIdx(null);
                        setTaxModalOpen(true);
                      }}
                      selectedTaxLabel={newItem.tax_component_name}
                      className="mt-1.5"
                    />`;

if (content.includes(priceFieldPattern)) {
  content = content.replace(priceFieldPattern, newPriceField);
}

// 5. Update Tax dropdown to clickable component box
const taxSelectPattern = `                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tax
                    </label>
                    <select
                      name="tax_type"
                      value={newItem.tax_type}
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    >
                      {taxes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>`;

const newTaxSelect = `                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tax Component
                    </label>
                    <div
                      onClick={() => {
                        setEditingLineTaxIdx(null);
                        setTaxModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between hover:border-brand-500 transition-colors shadow-sm min-h-[38px]"
                      title="Click to select tax component"
                    >
                      <span className="truncate text-xs text-slate-800 dark:text-slate-200">
                        {newItem.tax_component_name || (newItem.tax_type ? taxes.find(t => String(t.value) === String(newItem.tax_type))?.label : '-- Select Component --')}
                      </span>
                      {newItem.tax_rate !== undefined && (
                        <span className="text-[11px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0 ml-1">
                          {Number(newItem.tax_rate)}%
                        </span>
                      )}
                    </div>
                  </div>`;

if (content.includes(taxSelectPattern)) {
  content = content.replace(taxSelectPattern, newTaxSelect);
}

// 6. Update Table Tax cell to show component and mode
const tableTaxCellPattern = `                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <select
                                className="input w-full min-w-[9rem]"
                                value={i.tax_type}
                                onChange={(e) =>
                                  updateLine(idx, { tax_type: e.target.value })
                                }
                              >
                                {taxes.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              taxes.find(
                                (t) => String(t.value) === String(i.tax_type),
                              )?.label || ""
                            )}
                          </td>`;

const newTableTaxCell = `                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <div
                                onClick={() => {
                                  setEditingLineTaxIdx(idx);
                                  setTaxModalOpen(true);
                                }}
                                className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs hover:border-brand-500 bg-slate-50 dark:bg-slate-800/50 transition-colors"
                                title="Click to change tax component or mode"
                              >
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {i.tax_component_name || (taxes.find((t) => String(t.value) === String(i.tax_type))?.label) || 'Select Tax'}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center justify-between gap-1 mt-0.5">
                                  <span className={\`px-1 rounded text-[9px] font-bold \${i.tax_mode === 'INCLUSIVE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}\`}>
                                    {i.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}
                                  </span>
                                  <span className="font-bold text-brand-600">{Number(i.tax_rate !== undefined ? i.tax_rate : (taxes.find((t) => String(t.value) === String(i.tax_type))?.rate || 0))}%</span>
                                </div>
                              </div>
                            ) : (
                              <span>
                                {i.tax_component_name || (taxes.find((t) => String(t.value) === String(i.tax_type))?.label) || ''}
                                {i.tax_mode ? \` [\${i.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}]\` : ''}
                              </span>
                            )}
                          </td>`;

if (content.includes(tableTaxCellPattern)) {
  content = content.replace(tableTaxCellPattern, newTableTaxCell);
}

// 7. Insert TaxPricingModal right before return's closing tag
const modalSnippet = `
      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        onClose={() => {
          setTaxModalOpen(false);
          setEditingLineTaxIdx(null);
        }}
        taxMode={
          editingLineTaxIdx !== null
            ? (lines[editingLineTaxIdx]?.tax_mode || 'EXCLUSIVE')
            : (newItem.tax_mode || 'EXCLUSIVE')
        }
        selectedComponent={
          editingLineTaxIdx !== null
            ? { name: lines[editingLineTaxIdx]?.tax_component_name, rate: lines[editingLineTaxIdx]?.tax_rate, id: lines[editingLineTaxIdx]?.tax_type }
            : { name: newItem.tax_component_name, rate: newItem.tax_rate, id: newItem.tax_type }
        }
        onSelectComponent={(comp) => {
          const compLabel = \`\${comp.name}\${comp.rate !== undefined ? \` (\${comp.rate}%)\` : ''}\`;
          if (editingLineTaxIdx !== null) {
            updateLine(editingLineTaxIdx, {
              tax_type: comp.tax_type || comp.tax_code_id || comp.id,
              tax_rate: comp.rate,
              tax_component_name: compLabel,
              tax_mode: comp.tax_mode || 'EXCLUSIVE',
            });
          } else {
            setNewItem((prev) => ({
              ...prev,
              tax_type: comp.tax_type || comp.tax_code_id || comp.id,
              tax_rate: comp.rate,
              tax_component_name: compLabel,
              tax_mode: comp.tax_mode || prev.tax_mode || 'EXCLUSIVE',
            }));
          }
          setTaxModalOpen(false);
          setEditingLineTaxIdx(null);
        }}
      />
    </div>
  );
}`;

if (content.endsWith('</div>\n  );\n}')) {
  content = content.slice(0, -('</div>\n  );\n}'.length)) + modalSnippet;
} else if (content.endsWith('</div>\r\n  );\r\n}')) {
  content = content.slice(0, -('</div>\r\n  );\r\n}'.length)) + modalSnippet;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ProjectInvoiceForm.jsx');

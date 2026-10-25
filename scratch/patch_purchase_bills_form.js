import fs from 'fs';

const filePath = './client/src/pages/modules/purchase/purchase-bills/PurchaseBillsForm.jsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import
if (!content.includes('TaxPricingModal')) {
  content = content.replace(
    'import { usePermission } from "../../../../auth/PermissionContext.jsx";',
    'import { usePermission } from "../../../../auth/PermissionContext.jsx";\nimport TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";'
  );
}

// 2. Add state
const oldStateTarget = `  const [lines, setLines] = useState([]);`;
const newStateTarget = `  const [lines, setLines] = useState([]);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState(null);`;

if (!content.includes('editingLineId') && content.includes(oldStateTarget)) {
  content = content.replace(oldStateTarget, newStateTarget);
}

// 3. Update recalcLine
const oldRecalcLine = `  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    let taxAmount = 0;

    const gross = qty * unitPrice;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    if (comps.length > 0) {
      comps.forEach((c) => {
        taxAmount += (taxable * (Number(c.rate_percent) || 0)) / 100;
      });
    } else if (line.tax_code_id) {
      const tc = taxCodes.find(
        (t) => String(t.id) === String(line.tax_code_id),
      );
      const rate = tc ? Number(tc.rate_percent) || 0 : 0;
      taxAmount = taxable * (rate / 100);
    }
    const lineTotal = taxable + taxAmount;

    return { ...line, tax_amount: taxAmount, line_total: lineTotal };
  };`;

const newRecalcLine = `  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    let taxAmount = 0;

    const gross = qty * unitPrice;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    const tc = taxCodes.find(
      (t) => String(t.id) === String(line.tax_code_id),
    );
    const tcRate = line.tax_rate !== undefined && line.tax_rate !== null
      ? Number(line.tax_rate)
      : (tc ? Number(tc.rate_percent) || 0 : 0);
    const isInclusive = String(line.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    let lineTotal = taxable;
    if (isInclusive) {
      if (tcRate > 0) {
        const net = taxable / (1 + tcRate / 100);
        taxAmount = taxable - net;
      }
      lineTotal = taxable;
    } else {
      if (comps.length > 0) {
        comps.forEach((c) => {
          taxAmount += (taxable * (Number(c.rate_percent) || 0)) / 100;
        });
      } else if (line.tax_code_id) {
        taxAmount = taxable * (tcRate / 100);
      }
      lineTotal = taxable + taxAmount;
    }

    return { ...line, tax_amount: taxAmount, line_total: lineTotal, tax_rate: tcRate, tax_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE' };
  };`;

if (content.includes(oldRecalcLine)) {
  content = content.replace(oldRecalcLine, newRecalcLine);
}

// 4. Update unit_price table cell to add TaxModeRadioSelector
const oldPriceCell = `{isNew ? (
                          <input
                            type="number"
                            className="input text-right text-xs w-24 ml-auto"
                            value={l.unit_price}
                            onChange={(e) =>
                              handleLineChange(
                                l.id,
                                "unit_price",
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          Number(l.unit_price).toFixed(2)
                        )}`;

const newPriceCell = `{isNew ? (
                          <div className="flex flex-col items-end">
                            <input
                              type="number"
                              className="input text-right text-xs w-24 ml-auto"
                              value={l.unit_price}
                              onChange={(e) =>
                                handleLineChange(
                                  l.id,
                                  "unit_price",
                                  e.target.value,
                                )
                              }
                            />
                            <TaxModeRadioSelector
                              price={l.unit_price}
                              taxMode={l.tax_mode}
                              onModeChange={(m) => handleLineChange(l.id, "tax_mode", m)}
                              onOpenTaxModal={() => {
                                setEditingLineId(l.id);
                                setTaxModalOpen(true);
                              }}
                              selectedTaxLabel={l.tax_component_name}
                              className="mt-1"
                            />
                          </div>
                        ) : (
                          <div>
                            <div>{Number(l.unit_price).toFixed(2)}</div>
                            {l.tax_mode ? (
                              <span className={\`text-[9px] font-bold px-1 rounded \${l.tax_mode === 'INCLUSIVE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}\`}>
                                {l.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}
                              </span>
                            ) : null}
                          </div>
                        )}`;

if (content.includes(oldPriceCell)) {
  content = content.replace(oldPriceCell, newPriceCell);
}

// 5. Update Tax table cell
const oldTaxCell = `                      <td>
                        {isNew ? (
                          <select
                            className="input text-xs w-full min-w-[7rem]"
                            value={l.tax_code_id || ""}
                            onChange={(e) =>
                              handleLineChange(l.id, "tax_code_id", e.target.value)
                            }
                          >
                            <option value="">No Tax</option>
                            {taxCodes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({Number(t.rate_percent || 0)}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {taxCodes.find((t) => String(t.id) === String(l.tax_code_id))?.name || ""}
                          </span>
                        )}
                      </td>`;

const newTaxCell = `                      <td>
                        {isNew ? (
                          <div
                            onClick={() => {
                              setEditingLineId(l.id);
                              setTaxModalOpen(true);
                            }}
                            className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs hover:border-brand-500 bg-slate-50 dark:bg-slate-800/50 transition-colors"
                            title="Click to select tax component or mode"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[12rem]">
                              {l.tax_component_name || (taxCodes.find((t) => String(t.id) === String(l.tax_code_id))?.name) || 'Select Tax'}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center justify-between gap-1 mt-0.5">
                              <span className={\`px-1 rounded text-[9px] font-bold \${l.tax_mode === 'INCLUSIVE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}\`}>
                                {l.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}
                              </span>
                              <span className="font-bold text-brand-600">
                                {Number(l.tax_rate !== undefined ? l.tax_rate : (taxCodes.find((t) => String(t.id) === String(l.tax_code_id))?.rate_percent || 0))}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {l.tax_component_name || (taxCodes.find((t) => String(t.id) === String(l.tax_code_id))?.name) || ""}
                            {l.tax_mode ? \` [\${l.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}]\` : ''}
                          </span>
                        )}
                      </td>`;

if (content.includes(oldTaxCell)) {
  content = content.replace(oldTaxCell, newTaxCell);
}

// 6. Modal at bottom
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
            : 'EXCLUSIVE'
        }
        selectedComponent={
          editingLineId
            ? {
                name: lines.find(l => l.id === editingLineId)?.tax_component_name,
                rate: lines.find(l => l.id === editingLineId)?.tax_rate,
                id: lines.find(l => l.id === editingLineId)?.tax_code_id,
              }
            : null
        }
        onSelectComponent={(comp) => {
          if (editingLineId) {
            const compLabel = \`\${comp.name}\${comp.rate !== undefined ? \` (\${comp.rate}%)\` : ''}\`;
            setLines(prev => prev.map(l => {
              if (l.id !== editingLineId) return l;
              const updated = {
                ...l,
                tax_code_id: comp.tax_code_id || comp.id,
                tax_rate: comp.rate,
                tax_component_name: compLabel,
                tax_mode: comp.tax_mode || l.tax_mode || 'EXCLUSIVE',
              };
              return recalcLine(updated);
            }));
          }
          setTaxModalOpen(false);
          setEditingLineId(null);
        }}
      />
    </div>
  );
}`;

if (content.endsWith('</div>\n  );\n}')) {
  content = content.slice(0, -('</div>\n  );\n}'.length)) + modalSnippet;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched PurchaseBillsForm.jsx');

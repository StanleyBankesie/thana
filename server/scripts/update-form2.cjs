const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx');
let c = fs.readFileSync(file, 'utf8');

// Replace bottom buttons
c = c.replace(
  /<div className="flex justify-end gap-2">\s*<Link\s*to="\/service-management\/service-confirmation"\s*className="btn-secondary"\s*>\s*Cancel\s*<\/Link>[\s\S]*?<\/div>/,
  `<div className="flex justify-end gap-2">
            <Link
              to="/service-management/service-confirmation"
              className="btn-secondary px-4 py-2"
            >
              Back
            </Link>
            {formData.status !== 'APPROVED' && (
              <button
                type="button"
                className="btn-success px-4 py-2"
                onClick={handleSubmit}
                disabled={saving || !readyToConfirm}
              >
                {saving ? "Confirming..." : "Confirm"}
              </button>
            )}
          </div>`
);

// Add service items section where "{/* Select Services section removed */}" is
c = c.replace(
  /\{\/\* Select Services section removed \*\/\}/,
  `<div className="card">
                <div className="card-header bg-brand text-white rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">Service Items to Confirm</div>
                    {!isView && (
                      <button
                        type="button"
                        className="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                        onClick={addLine}
                      >
                        + Add Item
                      </button>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  {!formData.details?.length ? (
                    <div className="text-center text-slate-500 py-4">
                      No service items found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-slate-200">
                            <th className="py-2 px-3 font-semibold text-sm">Description</th>
                            <th className="py-2 px-3 font-semibold text-sm w-24">Qty</th>
                            <th className="py-2 px-3 font-semibold text-sm w-32">Unit Price</th>
                            <th className="py-2 px-3 font-semibold text-sm w-32">Total</th>
                            {!isView && <th className="py-2 px-3 w-16"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {formData.details.map((d, idx) => (
                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3">
                                {isView ? (
                                  <div className="font-medium">{d.description}</div>
                                ) : (
                                  <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="Service description"
                                    value={d.description}
                                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                                  />
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {isView ? (
                                  <div>{d.qty}</div>
                                ) : (
                                  <input
                                    type="number"
                                    className="input w-full text-right"
                                    min="1"
                                    value={d.qty}
                                    onChange={(e) => updateLine(idx, { qty: e.target.value })}
                                  />
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {isView ? (
                                  <div>{Number(d.unit_price || 0).toFixed(2)}</div>
                                ) : (
                                  <input
                                    type="number"
                                    className="input w-full text-right"
                                    min="0"
                                    step="0.01"
                                    value={d.unit_price}
                                    onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                                  />
                                )}
                              </td>
                              <td className="py-2 px-3 font-medium text-right">
                                {(Number(d.qty || 0) * Number(d.unit_price || 0)).toFixed(2)}
                              </td>
                              {!isView && (
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                    onClick={() => removeLine(idx)}
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>`
);


// In handleSubmit, update status to "APPROVED" instead of "CONFIRMED"
c = c.replace(
  /status: "CONFIRMED",/g,
  `status: "APPROVED",`
);

// Fix "navigate("/purchase/service-confirmation")" to point to the correct route which is "/service-management/service-confirmation" (actually the route is probably `/service-management/service-confirmation` judging from the Link component but the submit says navigate("/purchase/service-confirmation"))
c = c.replace(
  /navigate\("\/purchase\/service-confirmation"\);/g,
  `navigate("/service-management/service-confirmation");`
);


fs.writeFileSync(file, c);
console.log("Updated ServiceConfirmationForm.jsx again");

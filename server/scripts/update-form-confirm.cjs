const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /const isNew = id === "new";\n\s*const mode =\n\s*new URLSearchParams\(search\)\.get\("mode"\) \|\| \(isNew \? "edit" : "view"\);/g,
  `const isNew = id === "new";
  const urlParams = new URLSearchParams(search);
  const qOrderId = urlParams.get("order_id");
  const qExecutionId = urlParams.get("execution_id");
  let mode = urlParams.get("mode") || (isNew ? "edit" : "view");
  if (formData?.status === "APPROVED") mode = "view";`
);

// We need to fetch order details if qOrderId is provided
c = c.replace(
  /const \[formData, setFormData\] = useState\(\{/g,
  `const [formData, setFormData] = useState({
    order_id: "",
    execution_id: "",`
);

// Replace the formData init in useEffect:
c = c.replace(
  /supplier_id: c\.supplier_id \? String\(c\.supplier_id\) : "",\n\s*status: c\.status \|\| "DRAFT",/g,
  `supplier_id: c.supplier_id ? String(c.supplier_id) : "",
          order_id: c.order_id ? String(c.order_id) : "",
          execution_id: c.execution_id ? String(c.execution_id) : "",
          status: c.status || "DRAFT",`
);

// Wait, I need to auto-populate from the order when isNew and qOrderId is present.
c = c.replace(
  /return \(\) => \{\n\s*mounted = false;\n\s*\};\n\s*\}, \[id, isNew\]\);/g,
  `return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) return;
    if (qOrderId) {
      setLoading(true);
      api.get(\`/purchase/service-orders/\${qOrderId}\`)
        .then(res => {
          const o = res.data?.item;
          const details = res.data?.details || [];
          if (o) {
            setFormData(prev => ({
              ...prev,
              order_id: String(o.id),
              supplier_id: o.customer_id ? String(o.customer_id) : prev.supplier_id, // Orders use customer_id as supplier_id if it's external, or maybe we need to find supplier? Actually service orders have customer_id. For confirmation, it expects supplier_id. The list page shows "customer_name" for orders. But the schema says supplier_id.
              details: details.map(d => ({
                description: d.description || d.item_name || "",
                qty: d.qty || "",
                unit_price: d.unit_price || "",
              })),
            }));
          }
        })
        .finally(() => setLoading(false));
    } else if (qExecutionId) {
      setLoading(true);
      api.get(\`/purchase/service-executions/\${qExecutionId}\`)
        .then(res => {
           const e = res.data?.item;
           const materials = res.data?.materials || [];
           if (e) {
             setFormData(prev => ({
               ...prev,
               execution_id: String(e.id),
               order_id: e.order_id ? String(e.order_id) : "",
               details: materials.map(m => ({
                 description: m.name || m.note || "",
                 qty: m.qty || "",
                 unit_price: "",
               }))
             }));
           }
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, qOrderId, qExecutionId]);
`
);

// Update Save logic
c = c.replace(
  /const payload = \{\n\s*sc_no: formData\.sc_no \|\| "",\n\s*sc_date: formData\.sc_date \|\| null,\n\s*supplier_id: formData\.supplier_id \|\| null,\n\s*status: formData\.status \|\| "DRAFT",/g,
  `const payload = {
      sc_no: formData.sc_no || "",
      sc_date: formData.sc_date || null,
      supplier_id: formData.supplier_id || null,
      order_id: formData.order_id || null,
      execution_id: formData.execution_id || selectedExecutionId || null,
      status: formData.status || "DRAFT",`
);

// Update buttons
c = c.replace(
  /<button\n\s*type="button"\n\s*className="btn-success min-w-\[140px\]"\n\s*onClick=\{handleSave\}\n\s*disabled=\{!readyToConfirm \|\| saving\}\n\s*>\n\s*\{saving \? "Saving\.\.\." : "Save & Confirm"\}\n\s*<\/button>/g,
  `{formData.status !== 'APPROVED' && (
              <button
                type="button"
                className="btn-secondary min-w-[140px]"
                onClick={() => {
                  setFormData(prev => ({ ...prev, status: 'DRAFT' }));
                  setTimeout(handleSave, 0);
                }}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save as Draft"}
              </button>
            )}
            {formData.status !== 'APPROVED' && (
              <button
                type="button"
                className="btn-success min-w-[140px]"
                onClick={() => {
                  setFormData(prev => ({ ...prev, status: 'APPROVED' }));
                  setTimeout(handleSave, 0);
                }}
                disabled={!readyToConfirm || saving}
              >
                {saving ? "Saving..." : "Confirm"}
              </button>
            )}`
);

// Fix the display logic to view mode
c = c.replace(
  /let mode = urlParams\.get\("mode"\) \|\| \(isNew \? "edit" : "view"\);\n\s*if \(formData\?\.status === "APPROVED"\) mode = "view";/g,
  `const [modeOverride, setModeOverride] = useState(null);
  const actualMode = modeOverride || urlParams.get("mode") || (isNew ? "edit" : "view");
  const isView = actualMode === "view" || formData?.status === "APPROVED";`
);

// Update all uses of mode === "view"
c = c.replace(/mode === "view"/g, 'isView');


fs.writeFileSync(file, c);
console.log("Updated ServiceConfirmationForm.jsx");

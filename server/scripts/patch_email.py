import re

with open('server/controllers/maintenance.controller.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
if 'sendMail' not in code:
    code = code.replace(
        'import { recordMovementTx } from "../services/stock.service.js";',
        'import { recordMovementTx } from "../services/stock.service.js";\nimport { sendMail } from "../utils/mailer.js";'
    )

new_func = """
export const sendRFQEmail = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR", "Invalid RFQ ID");

    // 1. Get RFQ details
    const [rfq] = await query(`SELECT * FROM maint_rfqs WHERE id = :id AND company_id = :companyId`, { id, companyId });
    if (!rfq) throw httpError(404, "NOT_FOUND", "RFQ not found");

    // 2. Get invited suppliers
    const suppliers = await query(`SELECT supplier_name FROM maint_rfq_suppliers WHERE rfq_id = :id`, { id });
    if (!suppliers.length) throw httpError(400, "BAD_REQUEST", "No suppliers invited to this RFQ");

    const names = suppliers.map(s => s.supplier_name);

    // 3. Match with setup items
    const setupItems = await query(
      `SELECT item_name, email FROM maint_setup_items WHERE company_id = :companyId AND item_type = 'SERVICE_PROVIDER' AND item_name IN (:names)`,
      { companyId, names }
    );

    const emails = setupItems.filter(s => s.email).map(s => s.email);
    if (!emails.length) {
      throw httpError(400, "BAD_REQUEST", "None of the selected suppliers have an email configured in Setup > Service Providers");
    }

    // 4. Send email
    await sendMail({
      to: emails.join(','),
      subject: `Maintenance RFQ: ${rfq.rfq_no}`,
      text: `Dear Service Provider,\\n\\nPlease find the details for RFQ ${rfq.rfq_no}.\\n\\nScope of Work:\\n${rfq.scope_of_work}\\n\\nResponse Deadline: ${rfq.response_deadline || 'N/A'}\\n\\nBest Regards.`,
      html: `<p>Dear Service Provider,</p><p>Please find the details for RFQ <b>${rfq.rfq_no}</b>.</p><p><b>Scope of Work:</b><br/>${String(rfq.scope_of_work).replace(/\\n/g, '<br/>')}</p><p><b>Response Deadline:</b> ${rfq.response_deadline || 'N/A'}</p><p>Best Regards.</p>`,
    });

    res.json({ ok: true, message: "Emails sent successfully to: " + emails.join(', ') });
  } catch (err) {
    next(err);
  }
};
"""

if 'sendRFQEmail' not in code:
    code += "\n" + new_func

with open('server/controllers/maintenance.controller.js', 'w', encoding='utf-8') as f:
    f.write(code)

with open('server/routes/maintenance.routes.js', 'r', encoding='utf-8') as f:
    r_code = f.read()

if 'sendRFQEmail' not in r_code:
    r_code = r_code.replace(
        'router.put("/rfqs/:id", ...auth, mc.updateRFQ);',
        'router.put("/rfqs/:id", ...auth, mc.updateRFQ);\nrouter.post("/rfqs/:id/send-email", ...auth, mc.sendRFQEmail);'
    )
    with open('server/routes/maintenance.routes.js', 'w', encoding='utf-8') as f:
        f.write(r_code)

print("Patch applied")


export async function getInvoiceTemplate(req, res) {
  try {
    const templates = await query("SELECT html_content, template FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_INVOICE' LIMIT 1");
    if (templates && templates.length > 0) {
      res.json({ html_content: templates[0].html_content || templates[0].template || "" });
    } else {
      res.json({ html_content: "" });
    }
  } catch (error) {
    console.error("[License Controller] getInvoiceTemplate Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function saveInvoiceTemplate(req, res) {
  try {
    const { html_content } = req.body;
    const templates = await query("SELECT id FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_INVOICE' LIMIT 1");
    if (templates && templates.length > 0) {
      await query("UPDATE adm_document_templates SET html_content = ?, template = ? WHERE id = ?", [html_content, html_content, templates[0].id]);
    } else {
      await query("INSERT INTO adm_document_templates (doc_type, template_name, html_content, template, company_id) VALUES ('LICENSE_RENEWAL_INVOICE', 'License Renewal Invoice', ?, ?, 1)", [html_content, html_content]);
    }
    res.json({ success: true, message: "Template saved successfully" });
  } catch (error) {
    console.error("[License Controller] saveInvoiceTemplate Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

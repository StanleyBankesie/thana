const fs = require('fs');

const file = './server/controllers/license.controller.js';
const content = fs.readFileSync(file, 'utf8');

const targetIndex = content.indexOf('  } catch (error) {\r\n    console.error("[License Controller] verifyPaystackPayment Error:", error);');

if (targetIndex !== -1) {
  const newTail = `  } catch (error) {
    console.error("[License Controller] verifyPaystackPayment Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getInvoiceTemplate(req, res) {
  try {
    const templates = await query("SELECT html_content, template FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_INVOICE' LIMIT 1");
    if (templates && templates.length > 0 && (templates[0].html_content || templates[0].template)) {
      res.json({ html_content: templates[0].html_content || templates[0].template || "" });
    } else {
      const defaultTemplate = \`<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
  .invoice-box { max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
  .logo-placeholder { width: 150px; height: 60px; background-color: #f3f4f6; border: 1px dashed #9ca3af; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: bold; border-radius: 4px; }
  .company-info { text-align: right; color: #4b5563; }
  .company-info h2 { margin: 0 0 5px 0; color: #111827; font-size: 24px; }
  .invoice-title { font-size: 32px; color: #2563eb; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px; }
  .details-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .billed-to h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; text-transform: uppercase; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .info-table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; padding: 12px; color: #475569; font-weight: 600; }
  .info-table td { padding: 15px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
  .total-row { font-weight: bold; font-size: 18px; }
  .total-row td { border-top: 2px solid #e2e8f0; }
  .total-amount { color: #2563eb; }
  .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 12px; background-color: #dcfce7; color: #166534; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 15px; }
</style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <div class="logo-placeholder">
        [Insert Logo Here]
      </div>
      <div class="company-info">
        <h2>OmniSuite Inc.</h2>
        <p>123 Business Avenue<br>Tech District, 10001<br>contact@omnisuite.com<br>+1 (555) 123-4567</p>
      </div>
    </div>
    
    <h1 class="invoice-title">Invoice</h1>
    <div class="status-badge">PAID</div>
    
    <div class="details-section">
      <div class="billed-to">
        <h3>Billed To:</h3>
        <p><strong>{{name}}</strong><br>{{email}}</p>
      </div>
      <div class="invoice-details">
        <p><strong>Date:</strong> {{date}}</p>
        <p><strong>Invoice #:</strong> {{invoice_number}}</p>
        <p><strong>New Expiry:</strong> {{new_expiry_date}}</p>
      </div>
    </div>

    <table class="info-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>License Renewal - <strong>{{plan_name}}</strong></td>
          <td style="text-align: right;">{{amount}}</td>
        </tr>
        <tr class="total-row">
          <td style="text-align: right;">Total Paid</td>
          <td class="total-amount" style="text-align: right;">{{amount}}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Thank you for your business!<br>If you have any questions about this invoice, please contact our support team.</p>
    </div>
  </div>
</body>
</html>\`;
      res.json({ html_content: defaultTemplate });
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
`;
  const fixedContent = content.substring(0, targetIndex) + newTail;
  fs.writeFileSync(file, fixedContent, 'utf8');
  console.log("Fixed successfully.");
} else {
  // try without \r
  const targetIndex2 = content.indexOf('  } catch (error) {\n    console.error("[License Controller] verifyPaystackPayment Error:", error);');
  if (targetIndex2 !== -1) {
    const newTail = `  } catch (error) {
    console.error("[License Controller] verifyPaystackPayment Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getInvoiceTemplate(req, res) {
  try {
    const templates = await query("SELECT html_content, template FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_INVOICE' LIMIT 1");
    if (templates && templates.length > 0 && (templates[0].html_content || templates[0].template)) {
      res.json({ html_content: templates[0].html_content || templates[0].template || "" });
    } else {
      const defaultTemplate = \`<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
  .invoice-box { max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
  .logo-placeholder { width: 150px; height: 60px; background-color: #f3f4f6; border: 1px dashed #9ca3af; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: bold; border-radius: 4px; }
  .company-info { text-align: right; color: #4b5563; }
  .company-info h2 { margin: 0 0 5px 0; color: #111827; font-size: 24px; }
  .invoice-title { font-size: 32px; color: #2563eb; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px; }
  .details-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .billed-to h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; text-transform: uppercase; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .info-table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; padding: 12px; color: #475569; font-weight: 600; }
  .info-table td { padding: 15px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
  .total-row { font-weight: bold; font-size: 18px; }
  .total-row td { border-top: 2px solid #e2e8f0; }
  .total-amount { color: #2563eb; }
  .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 12px; background-color: #dcfce7; color: #166534; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 15px; }
</style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <div class="logo-placeholder">
        [Insert Logo Here]
      </div>
      <div class="company-info">
        <h2>OmniSuite Inc.</h2>
        <p>123 Business Avenue<br>Tech District, 10001<br>contact@omnisuite.com<br>+1 (555) 123-4567</p>
      </div>
    </div>
    
    <h1 class="invoice-title">Invoice</h1>
    <div class="status-badge">PAID</div>
    
    <div class="details-section">
      <div class="billed-to">
        <h3>Billed To:</h3>
        <p><strong>{{name}}</strong><br>{{email}}</p>
      </div>
      <div class="invoice-details">
        <p><strong>Date:</strong> {{date}}</p>
        <p><strong>Invoice #:</strong> {{invoice_number}}</p>
        <p><strong>New Expiry:</strong> {{new_expiry_date}}</p>
      </div>
    </div>

    <table class="info-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>License Renewal - <strong>{{plan_name}}</strong></td>
          <td style="text-align: right;">{{amount}}</td>
        </tr>
        <tr class="total-row">
          <td style="text-align: right;">Total Paid</td>
          <td class="total-amount" style="text-align: right;">{{amount}}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Thank you for your business!<br>If you have any questions about this invoice, please contact our support team.</p>
    </div>
  </div>
</body>
</html>\`;
      res.json({ html_content: defaultTemplate });
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
`;
    const fixedContent = content.substring(0, targetIndex2) + newTail;
    fs.writeFileSync(file, fixedContent, 'utf8');
    console.log("Fixed successfully.");
  } else {
    console.log("Could not find target index.");
  }
}

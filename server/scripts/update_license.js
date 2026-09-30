const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers', 'license.controller.js');
let code = fs.readFileSync(filePath, 'utf8');

const defaultTemplateStr = `<!DOCTYPE html>
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
      <p>Thank you for choosing OmniSuite. If you have any questions, contact our support team.</p>
    </div>
  </div>
</body>
</html>`;

const replacement = \`
    // Payment is successful! Update license
    const companyId = data.data.metadata?.companyId;
    if (!companyId) {
      return res
        .status(400)
        .json({ error: "Invalid metadata in transaction." });
    }

    const paystackMobile = data.data.customer?.phone || null;

    // Generate Invoice Number
    const companyRow = await query(\\\`SELECT code FROM adm_companies WHERE id = ?\\\`, [companyId]);
    const companyCode = companyRow?.[0]?.code || 'INV';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = \\\`\${companyCode}\${dd}\${mm}\\\`;
    
    const lastInvoiceRow = await query(
      \\\`SELECT invoice_no FROM adm_license_renewals WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1\\\`,
      [\\\`\${prefix}%%\\\`]
    );
    
    let seq = 1;
    if (lastInvoiceRow && lastInvoiceRow.length > 0 && lastInvoiceRow[0].invoice_no) {
      const lastSeq = parseInt(lastInvoiceRow[0].invoice_no.slice(-3), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }
    const invoiceNo = \\\`\${prefix}\${String(seq).padStart(3, '0')}\\\`;

    if (paystackMobile) {
      await query(\\\`UPDATE adm_license_renewals SET status = 'SUCCESS', initiator_mobile = ?, invoice_no = ? WHERE reference = ?\\\`, [paystackMobile, invoiceNo, reference]);
    } else {
      await query(\\\`UPDATE adm_license_renewals SET status = 'SUCCESS', invoice_no = ? WHERE reference = ?\\\`, [invoiceNo, reference]);
    }

    // Fetch the renewal entry to get initiator_name, initiator_email, amount, and plan_name
    const renewalEntryRow = await query(\\\`SELECT initiator_name, initiator_email, amount, plan_name FROM adm_license_renewals WHERE reference = ?\\\`, [reference]);
    
    let durationMonths = parseInt(data.data.metadata?.duration) || 1;
    let renewalEntry = null;

    if (renewalEntryRow && renewalEntryRow.length > 0) {
      renewalEntry = renewalEntryRow[0];
      if (renewalEntry.plan_name) {
        const pkgRow = await query(\\\`SELECT duration_months FROM adm_payment_packages WHERE plan_name = ? LIMIT 1\\\`, [renewalEntry.plan_name]);
        if (pkgRow && pkgRow.length > 0 && pkgRow[0].duration_months) {
          durationMonths = parseInt(pkgRow[0].duration_months) || durationMonths;
        }
      }
    }
    
    // Calculate new expiry date using duration_months
    const licenseInfoRow = await query(\\\`SELECT expiry_date FROM adm_company_licenses WHERE company_id = ?\\\`, [companyId]);
    
    let newExpiryDateStr = "";
    if (licenseInfoRow && licenseInfoRow.length > 0) {
      
      const updateRes = await query(
        \\\`UPDATE adm_company_licenses 
              SET expiry_date = DATE_ADD(IF(expiry_date > NOW(), expiry_date, NOW()), INTERVAL ? MONTH), 
                  status = 'ACTIVE'
              WHERE company_id = ?\\\`,
        [durationMonths, companyId],
      );

      const fetchUpdated = await query(\\\`SELECT expiry_date FROM adm_company_licenses WHERE company_id = ?\\\`, [companyId]);
      newExpiryDateStr = fetchUpdated[0].expiry_date;
      await invalidateLicenseCache(companyId);
    }

    // Generate Invoice HTML and Email it
    if (renewalEntry && renewalEntry.initiator_email) {
      const templates = await query("SELECT html_content, template FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_INVOICE' LIMIT 1");
      let htmlTemplate = \\\`${defaultTemplateStr.replace(/`/g, '\\`')}\\\`;
      if (templates && templates.length > 0 && (templates[0].html_content || templates[0].template)) {
        htmlTemplate = templates[0].html_content || templates[0].template;
      }
      
      const formattedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const newExpiryFormatted = newExpiryDateStr ? new Date(newExpiryDateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
      
      const finalHtml = htmlTemplate
        .replace(/\\{\\{name\\}\\}/g, renewalEntry.initiator_name || 'Customer')
        .replace(/\\{\\{email\\}\\}/g, renewalEntry.initiator_email)
        .replace(/\\{\\{date\\}\\}/g, formattedDate)
        .replace(/\\{\\{invoice_number\\}\\}/g, invoiceNo)
        .replace(/\\{\\{new_expiry_date\\}\\}/g, newExpiryFormatted)
        .replace(/\\{\\{plan_name\\}\\}/g, renewalEntry.plan_name || 'Renewal')
        .replace(/\\{\\{amount\\}\\}/g, \\\`GHS \${renewalEntry.amount || 0}\\\`);
        
      sendMail({
        to: renewalEntry.initiator_email,
        subject: \\\`License Renewal Invoice - \${invoiceNo}\\\`,
        html: finalHtml
      }).catch(err => console.error("Failed to send invoice email", err));
    }

    return res.json({
      success: true,
      message: "License renewed successfully!",
      newExpiryDate: newExpiryDateStr
    });
\`;

const startTarget = \`    // Payment is successful! Update license
    const companyId = data.data.metadata?.companyId;
    if (!companyId) {
      return res
        .status(400)
        .json({ error: "Invalid metadata in transaction." });
    }

    const paystackMobile = data.data.customer?.phone || null;\`;

const endTarget = \`      await invalidateLicenseCache(companyId);
    }

    return res.json({
      success: true,
      message: "License renewed successfully!",
      newExpiryDate: newExpiryDateStr
    });\`;

const startIndex = code.indexOf(startTarget);
const endIndex = code.indexOf(endTarget) + endTarget.length;

if (startIndex === -1 || endIndex < endTarget.length) {
  console.log("Could not find targets");
  process.exit(1);
}

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync(filePath, code, 'utf8');
console.log("Updated license.controller.js");

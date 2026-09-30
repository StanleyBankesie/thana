import { query } from "../db/pool.js";
import { sendMail } from "../utils/mailer.js";
import puppeteer from "puppeteer";
import {
  getCompanyLicense,
  generateLicenseKey,
  invalidateLicenseCache,
} from "../services/license.service.js";

/**
 * Get company license details
 */
export async function getLicense(req, res) {
  try {
    const { companyId } = req.params;
    const license = await getCompanyLicense(companyId);

    if (!license || !license.exists) {
      return res
        .status(404)
        .json({ error: "No license found for this company." });
    }

    res.json(license);
  } catch (error) {
    console.error("[License Controller] getLicense Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get global license status for the primary company (Publicly Accessible)
 */
export async function getGlobalLicenseStatus(req, res) {
  try {
    const license = await getCompanyLicense(1); // Assuming companyId 1 is the primary/only tenant
    if (!license || !license.exists) {
      return res.json({ exists: false, status: "UNKNOWN" });
    }
    
    res.json({
      exists: true,
      status: license.status,
      message: license.status === "EXPIRED" ? "Your company license has expired." : "License is active."
    });
  } catch (error) {
    console.error("[License Controller] getGlobalLicenseStatus Error:", error);
    res.json({ exists: false, status: "UNKNOWN", message: "License check bypass" });
  }
}

/**
 * Get all companies for license management (Super Admin only)
 */
export async function getCompaniesForLicense(req, res) {
  try {
    const companies = await query(
      "SELECT id, name FROM adm_companies ORDER BY name ASC",
    );
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error("[License Controller] getCompaniesForLicense Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Create or update a company license
 */
export async function saveLicense(req, res) {
  try {
    const {
      companyId,
      licenseType = "STANDARD",
      maxUsers = 5,
      startDate,
      expiryDate,
      graceDays = 15,
      alertDays = 30,
      status = "ACTIVE",
      notes = "",
      allow_login_renewal = true,
    } = req.body;

    if (!companyId || !startDate || !expiryDate) {
      return res
        .status(400)
        .json({ error: "companyId, startDate, and expiryDate are required." });
    }

    // Check if license exists - query() returns the rows array directly
    const existing = await query(
      `SELECT id, license_key FROM adm_company_licenses WHERE company_id = ?`,
      [companyId],
    );

    let licenseId;

    if (existing && existing.length > 0) {
      licenseId = existing[0].id;
      await query(
        `UPDATE adm_company_licenses 
              SET license_type = ?, max_users = ?, start_date = ?, expiry_date = ?, grace_days = ?, alert_days = ?, status = ?, notes = ?, allow_login_renewal = ?
              WHERE id = ?`,
        [
          licenseType,
          maxUsers,
          startDate,
          expiryDate,
          graceDays,
          alertDays,
          status,
          notes,
          allow_login_renewal,
          licenseId,
        ],
      );
    } else {
      const licenseKey = generateLicenseKey();
      const result = await query(
        `INSERT INTO adm_company_licenses (company_id, license_key, license_type, max_users, start_date, expiry_date, grace_days, alert_days, status, notes, allow_login_renewal)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          licenseKey,
          licenseType,
          maxUsers,
          startDate,
          expiryDate,
          graceDays,
          alertDays,
          status,
          notes,
          allow_login_renewal,
        ],
      );
      licenseId = result.insertId;
    }

    await invalidateLicenseCache(companyId);
    res.json({ success: true, message: "License saved successfully." });
  } catch (error) {
    console.error("[License Controller] saveLicense Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Set licensed modules for a company
 */
export async function saveModules(req, res) {
  try {
    const { companyId } = req.params;
    const { modules } = req.body; // Array of module codes

    if (!Array.isArray(modules)) {
      return res.status(400).json({ error: "modules must be an array." });
    }

    const licenses = await query(
      `SELECT id FROM adm_company_licenses WHERE company_id = ?`,
      [companyId],
    );

    if (!licenses || licenses.length === 0) {
      return res
        .status(404)
        .json({ error: "No license found for this company." });
    }

    const licenseId = licenses[0].id;

    // Find modules that are actually being removed
    const oldModulesRow = await query(`SELECT module_code FROM adm_license_modules WHERE license_id = ?`, [licenseId]);
    const oldModules = oldModulesRow.map(m => m.module_code);
    const removedModules = oldModules.filter(m => !modules.includes(m));

    // Clean up role assignments for removed modules to prevent unauthorized access
    if (removedModules.length > 0) {
      const removedPlaceholders = removedModules.map(() => "?").join(",");
      await query(
        `DELETE arm FROM adm_role_modules arm
         JOIN adm_roles r ON arm.role_id = r.id
         WHERE r.company_id = ? AND arm.module_key IN (${removedPlaceholders})`,
        [companyId, ...removedModules]
      );
    }

    await query(`DELETE FROM adm_license_modules WHERE license_id = ?`, [
      licenseId,
    ]);

    if (modules.length > 0) {
      const placeholders = modules.map(() => "(?, ?)").join(", ");
      const values = modules.flatMap((m) => [licenseId, m]);

      await query(
        `INSERT INTO adm_license_modules (license_id, module_code) VALUES ${placeholders}`,
        values,
      );
    }

    await invalidateLicenseCache(companyId);
    res.json({ success: true, message: "Modules updated successfully." });
  } catch (error) {
    console.error("[License Controller] saveModules Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Initialize a Paystack transaction for license renewal
 */
export async function initializePaystackPayment(req, res) {
  try {
    const { amount, name, email, mobile, plan, duration, companyId: bodyCompanyId } = req.body;
    
    const companyId = req.user?.company_id || req.user?.companyIds?.[0] || bodyCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: "No company context found for this payment." });
    }

    // Determine values to use
    let finalName = name || req.user?.username || "Unknown User";
    if (req.user?.id && !name) {
      const userRow = await query(`SELECT full_name FROM adm_users WHERE id = ? LIMIT 1`, [req.user.id]);
      if (userRow && userRow.length > 0 && userRow[0].full_name) {
        finalName = userRow[0].full_name;
      }
    }
    
    const finalEmail = email || req.user?.email || "stanlebankesie@gmail.com";
    const finalMobile = mobile || req.user?.mobile || "0000000000";
    const finalPlan = plan || "Unknown Plan";
    const finalAmount = amount || 240; // GHS
    const amountInSubunits = finalAmount * 100; // to pesewas/kobo

    const secretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_key_for_testing";

    const customReference = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: finalEmail,
        amount: amountInSubunits,
        currency: "GHS",
        reference: customReference,
        metadata: {
          companyId,
          plan: finalPlan,
          duration: duration || 1,
          mobile: finalMobile,
          name: finalName
        }
      })
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      console.error("[Paystack] Initialization failed:", data);
      return res.status(400).json({ error: data.message || "Failed to initialize payment with Paystack." });
    }

    const reference = data.data.reference;

    const finalSubtotal = Number(req.body.subtotal) || finalAmount;
    const finalTaxRate = Number(req.body.tax_rate) || 0;
    const finalDiscount = Number(req.body.discount) || 0;
    const finalTax = Number(req.body.tax) || ((finalSubtotal - finalDiscount) * (finalTaxRate / 100));

    // Insert into adm_license_renewals
    await query(
      `INSERT INTO adm_license_renewals 
        (company_id, initiator_name, initiator_email, initiator_mobile, amount, subtotal, tax, discount, tax_rate, plan_name, status, reference, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 'Online Payment')`,
      [companyId, finalName, finalEmail, finalMobile, finalAmount, finalSubtotal, finalTax, finalDiscount, finalTaxRate, finalPlan, reference]
    );

    return res.json({ 
      success: true,
      access_code: data.data.access_code,
      reference: reference
    });
  } catch (error) {
    console.error(
      "[License Controller] initializePaystackPayment Error:",
      error,
    );
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Verify a Paystack transaction and renew the license
 */
export async function verifyPaystackPayment(req, res) {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res
        .status(400)
        .json({ error: "Transaction reference is required." });
    }

    const secretKey =
      process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_key_for_testing";

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const data = await response.json();
    if (!response.ok || !data.status) {
      return res.status(400).json({ error: "Failed to verify transaction." });
    }

    if (data.data.status !== "success") {
      return res
        .status(400)
        .json({ error: `Transaction status is: ${data.data.status}` });
    }

    // Payment is successful! Update license
    const companyId = data.data.metadata?.companyId;
    if (!companyId) {
      return res
        .status(400)
        .json({ error: "Invalid metadata in transaction." });
    }

    const auth = data.data.authorization || {};
    const customer = data.data.customer || {};
    const meta = data.data.metadata || {};

    // Try to extract the mobile number used during the transaction
    let paystackMobile = 
      auth.mobile_money_number || 
      auth.sender_phone ||
      auth.sender ||
      customer.phone || 
      meta.mobile || 
      null;

    // Fallback for mobile money if stored in bin+last4 (some Paystack channels do this for Momo)
    if (!paystackMobile && auth.channel === 'mobile_money' && auth.bin && auth.last4) {
      paystackMobile = auth.bin + auth.last4;
    }

    const paystackChannelName = auth.channel === 'card' ? 'Card' : auth.channel === 'mobile_money' ? 'Mobile Money' : (auth.channel || 'Online Payment');

    // Generate Invoice Number
    const companyRow = await query(`SELECT code FROM adm_companies WHERE id = ?`, [companyId]);
    const companyCode = companyRow?.[0]?.code || 'INV';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${companyCode}${dd}${mm}`;
    
    const lastInvoiceRow = await query(
      `SELECT invoice_no FROM adm_license_renewals WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    
    let seq = 1;
    if (lastInvoiceRow && lastInvoiceRow.length > 0 && lastInvoiceRow[0].invoice_no) {
      const lastSeq = parseInt(lastInvoiceRow[0].invoice_no.slice(-3), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }
    const invoiceNo = `${prefix}${String(seq).padStart(3, '0')}`;

    if (paystackMobile && paystackMobile !== '0000000000') {
      await query(`UPDATE adm_license_renewals SET status = 'SUCCESS', initiator_mobile = ?, invoice_no = ?, payment_method = ? WHERE reference = ?`, [paystackMobile, invoiceNo, paystackChannelName, reference]);
    } else {
      await query(`UPDATE adm_license_renewals SET status = 'SUCCESS', invoice_no = ?, payment_method = ? WHERE reference = ?`, [invoiceNo, paystackChannelName, reference]);
    }

    // Fetch full renewal entry (including created_at, subtotal, tax, discount, payment_method)
    const renewalEntryRow = await query(`SELECT *, created_at FROM adm_license_renewals WHERE reference = ?`, [reference]);
    
    let durationMonths = parseInt(data.data.metadata?.duration) || 1;
    let renewalEntry = null;

    if (renewalEntryRow && renewalEntryRow.length > 0) {
      renewalEntry = renewalEntryRow[0];
      if (renewalEntry.plan_name) {
        const pkgRow = await query(`SELECT duration_months FROM adm_payment_packages WHERE plan_name = ? LIMIT 1`, [renewalEntry.plan_name]);
        if (pkgRow && pkgRow.length > 0 && pkgRow[0].duration_months) {
          durationMonths = parseInt(pkgRow[0].duration_months) || durationMonths;
        }
      }
    }
    
    // Calculate new expiry date using duration_months
    const licenseInfoRow = await query(`SELECT id, license_key, license_type, max_users, start_date, expiry_date FROM adm_company_licenses WHERE company_id = ?`, [companyId]);
    const licenseData = licenseInfoRow?.[0] || {};
    
    let newExpiryDateStr = "";
    if (licenseInfoRow && licenseInfoRow.length > 0) {
      
      const updateRes = await query(
        `UPDATE adm_company_licenses 
              SET expiry_date = DATE_ADD(IF(expiry_date > NOW(), expiry_date, NOW()), INTERVAL ? MONTH), 
                  status = 'ACTIVE'
              WHERE company_id = ?`,
        [durationMonths, companyId],
      );

      const fetchUpdated = await query(`SELECT expiry_date FROM adm_company_licenses WHERE company_id = ?`, [companyId]);
      newExpiryDateStr = fetchUpdated[0].expiry_date;
      await invalidateLicenseCache(companyId);
    }

    // Generate Receipt HTML and Email it
    if (renewalEntry && renewalEntry.initiator_email) {
      const templates = await query("SELECT html_content, template FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_RECEIPT' LIMIT 1");
      let htmlTemplate = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
  .receipt-box { max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
  .logo-placeholder { width: 150px; height: 60px; background-color: #f3f4f6; border: 1px dashed #9ca3af; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: bold; border-radius: 4px; }
  .company-info { text-align: right; color: #4b5563; }
  .company-info h2 { margin: 0 0 5px 0; color: #111827; font-size: 24px; }
  .receipt-title { font-size: 32px; color: #16a34a; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px; }
  .details-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .billed-to h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; text-transform: uppercase; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .info-table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; padding: 12px; color: #475569; font-weight: 600; }
  .info-table td { padding: 15px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
  .total-row { font-weight: bold; font-size: 18px; }
  .total-row td { border-top: 2px solid #e2e8f0; }
  .total-amount { color: #16a34a; }
  .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 12px; background-color: #dcfce7; color: #166534; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 15px; }
</style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <div class="logo-placeholder">
        [Insert Logo Here]
      </div>
      <div class="company-info">
        <h2>{{company_name}}</h2>
        <p>OmniSuite ERP Services<br>contact@omnisuite-erp.com</p>
      </div>
    </div>
    
    <h1 class="receipt-title">Payment Receipt</h1>
    <div class="status-badge">PAID</div>
    
    <div class="details-section">
      <div class="billed-to">
        <h3>Payment From:</h3>
        <p><strong>{{name}}</strong><br>{{email}}</p>
      </div>
      <div class="receipt-details">
        <p><strong>Date:</strong> {{payment_date}}</p>
        <p><strong>Receipt #:</strong> {{receipt_number}}</p>
        <p><strong>License Key:</strong> {{license_key}}</p>
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
          <td>License Renewal - <strong>{{plan_name}}</strong> (Max Users: {{max_users}})</td>
          <td style="text-align: right;">{{unit_price}}</td>
        </tr>
        <tr class="total-row">
          <td style="text-align: right;">Subtotal</td>
          <td style="text-align: right;">{{subtotal}}</td>
        </tr>
        <tr>
          <td style="text-align: right;">Tax ({{tax_rate}}%)</td>
          <td style="text-align: right;">{{tax_amount}}</td>
        </tr>
        <tr>
          <td style="text-align: right;">Discount</td>
          <td style="text-align: right;">{{discount_amount}}</td>
        </tr>
        <tr class="total-row">
          <td style="text-align: right;">Total Paid</td>
          <td class="total-amount" style="text-align: right;">{{amount_paid}}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Thank you for choosing {{company_name}}. If you have any questions, contact support.</p>
    </div>
  </div>
</body>
</html>`;
      if (templates && templates.length > 0 && (templates[0].html_content || templates[0].template)) {
        htmlTemplate = templates[0].html_content || templates[0].template;
      }

      // Calculations:
      // subtotal = sum(amount)
      // tax = calculated tax
      // amount_paid = (subtotal - discount) + tax
      const subtotalVal = Number(renewalEntry?.subtotal || renewalEntry?.amount || 0);
      const taxRateVal = Number(renewalEntry?.tax_rate || 0);
      const discountVal = Number(renewalEntry?.discount || 0);
      const taxVal = Number(renewalEntry?.tax || ((subtotalVal - discountVal) * (taxRateVal / 100)));
      const amountPaidVal = (subtotalVal - discountVal) + taxVal;
      const balanceDueVal = 0.0;

      const paymentDateFormatted = renewalEntry?.created_at
        ? new Date(renewalEntry.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

      const newExpiryFormatted = newExpiryDateStr ? new Date(newExpiryDateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
      const startDateFormatted = licenseData.start_date ? new Date(licenseData.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
      
      const paymentMethodStr = renewalEntry?.payment_method || paystackChannelName || 'Online Payment';
      const transactionIdStr = reference;

      let companyName = "OmniSuite";
      let companyLogoImg = "";
      try {
        const companyRowLogo = await query(`SELECT name, logo FROM adm_companies WHERE id = ? LIMIT 1`, [companyId]);
        if (companyRowLogo && companyRowLogo.length > 0) {
          if (companyRowLogo[0].name) companyName = companyRowLogo[0].name;
          if (companyRowLogo[0].logo) {
            const base64Logo = Buffer.from(companyRowLogo[0].logo).toString('base64');
            companyLogoImg = `<img src="data:image/png;base64,${base64Logo}" alt="Company Logo" style="max-height: 60px; max-width: 150px;" />`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch company details for receipt:", err);
      }

      let finalHtml = htmlTemplate
        .replace(/\{\{payment_date\}\}/g, paymentDateFormatted)
        .replace(/\{\{payment_method\}\}/g, paymentMethodStr)
        .replace(/\{\{transaction_id\}\}/g, transactionIdStr)
        .replace(/\{\{quantity\}\}/g, String(durationMonths || 1))
        .replace(/\{\{unit_price\}\}/g, `GHS ${subtotalVal.toFixed(2)}`)
        .replace(/\{\{line_amount\}\}/g, `GHS ${subtotalVal.toFixed(2)}`)
        .replace(/\{\{subtotal\}\}/g, `GHS ${subtotalVal.toFixed(2)}`)
        .replace(/\{\{tax_rate\}\}/g, taxRateVal.toFixed(2))
        .replace(/\{\{tax_amount\}\}/g, `GHS ${taxVal.toFixed(2)}`)
        .replace(/\{\{discount_amount\}\}/g, `GHS ${discountVal.toFixed(2)}`)
        .replace(/\{\{amount_paid\}\}/g, `GHS ${amountPaidVal.toFixed(2)}`)
        .replace(/\{\{balance_due\}\}/g, `GHS ${balanceDueVal.toFixed(2)}`)
        .replace(/\{\{name\}\}/g, renewalEntry?.initiator_name || 'Customer')
        .replace(/\{\{email\}\}/g, renewalEntry?.initiator_email || '')
        .replace(/\{\{date\}\}/g, paymentDateFormatted)
        .replace(/\{\{invoice_number\}\}/g, invoiceNo)
        .replace(/\{\{receipt_number\}\}/g, invoiceNo)
        .replace(/\{\{new_expiry_date\}\}/g, newExpiryFormatted)
        .replace(/\{\{expiry_date\}\}/g, newExpiryFormatted)
        .replace(/\{\{start_date\}\}/g, startDateFormatted)
        .replace(/\{\{license_key\}\}/g, licenseData.license_key || 'N/A')
        .replace(/\{\{license_type\}\}/g, licenseData.license_type || 'STANDARD')
        .replace(/\{\{max_users\}\}/g, String(licenseData.max_users || 5))
        .replace(/\{\{company_name\}\}/g, companyName)
        .replace(/\{\{plan_name\}\}/g, renewalEntry?.plan_name || licenseData.license_type || 'Renewal')
        .replace(/\{\{amount\}\}/g, `GHS ${amountPaidVal.toFixed(2)}`)
        .replace(/\[Insert Logo Here\]/g, companyLogoImg)
        .replace(/\{\{company_logo\}\}/g, companyLogoImg);

      console.log(`[Receipt Mail] Preparing receipt email for: ${renewalEntry.initiator_email} (Ref: ${invoiceNo})`);
      try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        const mailResult = await sendMail({
          to: renewalEntry.initiator_email,
          subject: `License Renewal Receipt - ${invoiceNo}`,
          html: finalHtml,
          attachments: [
            {
              filename: `Receipt_${invoiceNo}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            }
          ]
        });
        console.log(`[Receipt Mail] Sent receipt with PDF to ${renewalEntry.initiator_email}. Result:`, mailResult);
      } catch (pdfErr) {
        console.error("[Receipt Mail] Failed to generate receipt PDF or send with PDF:", pdfErr);
        try {
          const mailResult = await sendMail({
            to: renewalEntry.initiator_email,
            subject: `License Renewal Receipt - ${invoiceNo}`,
            html: finalHtml
          });
          console.log(`[Receipt Mail] Sent fallback HTML receipt without PDF to ${renewalEntry.initiator_email}. Result:`, mailResult);
        } catch (mailErr) {
          console.error(`[Receipt Mail] Failed to send HTML receipt to ${renewalEntry.initiator_email}:`, mailErr);
        }
      }
    } else {
      console.warn("[Receipt Mail] Skipped sending receipt: renewalEntry or initiator_email is missing.", renewalEntry);
    }

    res.json({
      success: true,
      message: "License renewed successfully!",
      newExpiryDate: newExpiryDateStr
    });
  } catch (error) {
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

export async function getReceiptTemplate(req, res) {
  try {
    const templates = await query("SELECT html_content FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_RECEIPT' LIMIT 1");
    if (templates && templates.length > 0 && templates[0].html_content) {
      res.json({ html_content: templates[0].html_content });
    } else {
      res.json({ html_content: "" });
    }
  } catch (error) {
    console.error("[License Controller] getReceiptTemplate Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function saveReceiptTemplate(req, res) {
  try {
    const { html_content } = req.body;
    const templates = await query("SELECT id FROM adm_document_templates WHERE doc_type = 'LICENSE_RENEWAL_RECEIPT' LIMIT 1");
    if (templates && templates.length > 0) {
      await query("UPDATE adm_document_templates SET html_content = ?, template = ? WHERE id = ?", [html_content, html_content, templates[0].id]);
    } else {
      await query("INSERT INTO adm_document_templates (doc_type, template_name, html_content, template, company_id) VALUES ('LICENSE_RENEWAL_RECEIPT', 'License Renewal Receipt', ?, ?, 1)", [html_content, html_content]);
    }
    res.json({ success: true, message: "Template saved successfully" });
  } catch (error) {
    console.error("[License Controller] saveReceiptTemplate Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}


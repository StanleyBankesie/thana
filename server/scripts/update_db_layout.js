/**
 * @file update_db_layout.js
 * @description Script to update the database with default HTML templates for printable documents.
 * Injects predefined HTML string literals for 'sales-order' and 'invoice'
 * into the `document_templates` table.
 */

import { pool } from "../db/pool.js";

const commonHead = `
<style>
  :root { --text: #000; }
  body { font-family: Arial, sans-serif; color: var(--text); font-size: 11px; margin: 0; padding: 0; }
  .doc { width: 19cm; margin: 0 auto; padding: 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .logo { height: 90px; object-fit: contain; }
  .company { font-size: 10px; line-height: 1.4; text-align: right; }
  .company .name { font-weight: bold; font-size: 18px; margin-bottom: 4px; }
  .titlebar { display: flex; align-items: center; justify-content: space-between; margin: 12px 0 16px; }
  .line { flex-grow: 1; border-top: 2px solid #000; height: 0; }
  .title { font-weight: bold; font-size: 16px; margin: 0 16px; white-space: nowrap; }
  .info { display: flex; justify-content: space-between; margin-bottom: 16px; }
  .info-left, .info-mid { flex: 1; }
  .info-right { display: flex; flex-direction: column; align-items: flex-end; width: 100px; }
  .kv { font-size: 11px; line-height: 1.4; display: table; }
  .kv-row { display: table-row; }
  .kv-label { display: table-cell; font-weight: bold; padding-right: 8px; white-space: nowrap; vertical-align: top; }
  .kv-sep { display: table-cell; padding-right: 8px; vertical-align: top; }
  .kv-val { display: table-cell; vertical-align: top; text-transform: uppercase; }
  .qr-box { width: 80px; height: 80px; }
  .qr-box img { width: 100%; height: 100%; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
  thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; vertical-align: bottom; }
  thead th.left { text-align: left; }
  thead th.center { text-align: center; }
  tbody td { padding: 4px; border-bottom: 1px dashed #000; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 2px solid #000; }
  td.num { text-align: right; }
  td.center { text-align: center; }
  .bottom-section { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 40px; }
  .bottom-left { flex: 1; padding-right: 16px; }
  .bottom-right { width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #000; }
  .summary-row:last-child { border-bottom: 2px dashed #000; }
  .summary-row .s-label { font-weight: bold; }
  .summary-row .s-val { text-align: right; }
  .footer-prepared { margin-top: 24px; font-size: 11px; padding-top: 8px; border-top: 2px solid #000; }
  .footer-prepared .lbl { font-weight: bold; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0 !important; padding: 0 !important; }
    .doc { max-width: 19cm; margin: 0 auto; }
  }
</style>
`;

const salesOrderHtml = commonHead + `
<div class="doc">
  <div class="header">
    <div><img class="logo" src="{{company.logo}}" alt="Logo"/></div>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div>Contact No: {{company.phone}}</div>
      <div>Email: {{company.email}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Order *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Customer Name</div><div class="kv-sep">:</div><div class="kv-val">{{customer.name}}</div></div>
        <div class="kv-row"><div class="kv-label">Address</div><div class="kv-sep">:</div><div class="kv-val">{{customer.address}}<br/>{{customer.address2}}</div></div>
        <div class="kv-row"><div class="kv-label">City</div><div class="kv-sep">:</div><div class="kv-val">{{customer.city}}</div></div>
        <div class="kv-row"><div class="kv-label">State</div><div class="kv-sep">:</div><div class="kv-val">{{customer.state}}</div></div>
        <div class="kv-row"><div class="kv-label">Country</div><div class="kv-sep">:</div><div class="kv-val">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="info-mid">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Order No.</div><div class="kv-sep">:</div><div class="kv-val">{{sales_order.number}}</div></div>
        <div class="kv-row"><div class="kv-label">Order Date</div><div class="kv-sep">:</div><div class="kv-val">{{formatDate sales_order.date}}</div></div>
        <div class="kv-row"><div class="kv-label">Payment Term</div><div class="kv-sep">:</div><div class="kv-val">{{sales_order.payment_terms}}</div></div>
      </div>
    </div>
    <div class="info-right">
      <div class="qr-box"><img src="{{sales_order.qr_code}}" alt="QR"/></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center">Sr.<br/>No.</th>
        <th class="left">Product<br/>Code</th>
        <th class="left">Product Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Discount</th>
        <th>Tax</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {{#each sales_order.items}}
      <tr>
        <td class="center">{{inc @index}}</td>
        <td>{{code}}</td>
        <td>{{name}}</td>
        <td class="num">{{quantity}}</td>
        <td class="num">{{price}}</td>
        <td class="num">{{discount}}</td>
        <td class="num">{{tax}}</td>
        <td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="bottom-section">
    <div class="bottom-left">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 40px; margin-bottom: 8px;">
        <div><span style="font-weight: bold;">Item Count :</span> {{sales_order.item_count}}</div>
        <div><span style="font-weight: bold;">Total Quantity :</span> {{sales_order.total_quantity}}</div>
      </div>
      <div style="display: flex; margin-bottom: 16px;">
        <div style="font-weight: bold; white-space: nowrap; margin-right: 8px;">Amount in Words :</div>
        <div style="text-transform: uppercase;">{{sales_order.amount_in_words}}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <span style="font-weight: bold;">Remarks :</span> <br/>
        {{sales_order.remarks}}
      </div>
      <div>
        <span style="font-weight: bold;">Terms and Condition :</span> <br/>
        {{sales_order.terms_and_conditions}}
      </div>
    </div>
    <div class="bottom-right">
      <div class="summary-row"><div class="s-label">Sales Account</div><div class="s-val">{{sales_order.sub_total}}</div></div>
      <div class="summary-row"><div class="s-label">Discount</div><div class="s-val">{{sales_order.discount_amount}}</div></div>
      <div class="summary-row"><div class="s-label">Tax</div><div class="s-val">{{sales_order.tax_amount}}</div></div>
      <div class="summary-row"><div class="s-label">Net Order Value</div><div class="s-val" style="font-weight: bold;">{{sales_order.total}}</div></div>
    </div>
  </div>
  <div class="footer-prepared">
    <span class="lbl">Prepared By :</span> {{prepared_by}}
  </div>
</div>
`;

const invoiceHtml = commonHead + `
<div class="doc">
  <div class="header">
    <div><img class="logo" src="{{company.logo}}" alt="Logo"/></div>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div>Contact No: {{company.phone}}</div>
      <div>Email: {{company.email}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Invoice *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Customer Name</div><div class="kv-sep">:</div><div class="kv-val">{{customer.name}}</div></div>
        <div class="kv-row"><div class="kv-label">Address</div><div class="kv-sep">:</div><div class="kv-val">{{customer.address}}<br/>{{customer.address2}}</div></div>
        <div class="kv-row"><div class="kv-label">City</div><div class="kv-sep">:</div><div class="kv-val">{{customer.city}}</div></div>
        <div class="kv-row"><div class="kv-label">State</div><div class="kv-sep">:</div><div class="kv-val">{{customer.state}}</div></div>
        <div class="kv-row"><div class="kv-label">Country</div><div class="kv-sep">:</div><div class="kv-val">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="info-mid">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Invoice No.</div><div class="kv-sep">:</div><div class="kv-val">{{invoice.number}}</div></div>
        <div class="kv-row"><div class="kv-label">Invoice Date</div><div class="kv-sep">:</div><div class="kv-val">{{formatDate invoice.date}}</div></div>
        <div class="kv-row"><div class="kv-label">Payment Term</div><div class="kv-sep">:</div><div class="kv-val">{{invoice.payment_term}}</div></div>
      </div>
    </div>
    <div class="info-right">
      <div class="qr-box"><img src="{{invoice.qr_code}}" alt="QR"/></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center">Sr.<br/>No.</th>
        <th class="left">Product<br/>Code</th>
        <th class="left">Product Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Discount</th>
        <th>Tax</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {{#each invoice.items}}
      <tr>
        <td class="center">{{inc @index}}</td>
        <td>{{code}}</td>
        <td>{{name}}</td>
        <td class="num">{{quantity}}</td>
        <td class="num">{{price}}</td>
        <td class="num">{{discount}}</td>
        <td class="num">{{tax}}</td>
        <td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="bottom-section">
    <div class="bottom-left">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 40px; margin-bottom: 8px;">
        <div><span style="font-weight: bold;">Item Count :</span> {{invoice.item_count}}</div>
        <div><span style="font-weight: bold;">Total Quantity :</span> {{invoice.total_quantity}}</div>
      </div>
      <div style="display: flex; margin-bottom: 16px;">
        <div style="font-weight: bold; white-space: nowrap; margin-right: 8px;">Amount in Words :</div>
        <div style="text-transform: uppercase;">{{invoice.amount_in_words}}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <span style="font-weight: bold;">Remarks :</span> <br/>
        {{invoice.remarks}}
      </div>
      <div>
        <span style="font-weight: bold;">Terms and Condition :</span> <br/>
        {{invoice.terms_and_conditions}}
      </div>
    </div>
    <div class="bottom-right">
      <div class="summary-row"><div class="s-label">Sales Account</div><div class="s-val">{{invoice.net_total}}</div></div>
      <div class="summary-row"><div class="s-label">NHIL [2.5%]</div><div class="s-val">{{invoice.nhil}}</div></div>
      <div class="summary-row"><div class="s-label">GET FUND 2.5% ON<br/>SALES</div><div class="s-val">{{invoice.get_fund}}</div></div>
      <div class="summary-row"><div class="s-label">VAT 15%</div><div class="s-val">{{invoice.vat}}</div></div>
      <div class="summary-row"><div class="s-label">Net Invoice Value</div><div class="s-val" style="font-weight: bold;">{{invoice.total}}</div></div>
    </div>
  </div>
  <div class="footer-prepared">
    <span class="lbl">Prepared By :</span> {{prepared_by}}
  </div>
</div>
`;

/**
 * Main execution function.
 * Updates the `html_content` of default templates for sales orders and invoices.
 * 
 * @returns {Promise<void>} Resolves when the database update is complete.
 */
async function run() {
  await pool.query('UPDATE document_templates SET html_content = ? WHERE document_type = "sales-order" AND is_default = 1', [salesOrderHtml]);
  await pool.query('UPDATE document_templates SET html_content = ? WHERE document_type = "invoice" AND is_default = 1', [invoiceHtml]);
  console.log('Database templates updated successfully.');
  process.exit(0);
}
run();

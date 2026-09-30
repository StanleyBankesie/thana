import { query } from "../db/pool.js";

// Default HTML template for generating sales invoices
const DEFAULT_INVOICE_TEMPLATE = `<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Invoice</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;600&amp;display=swap" rel="stylesheet" />
  <style>
    :root {
      --text: #111111;
      --text-muted: #555555;
      --border-heavy: 2px solid #111111;
      --border-light: 1px solid #cccccc;
      --border-dashed: 1px dashed #999999;
      --accent: #1a1a1a;
      --bg: #ffffff;
      --row-alt: #f9f9f9;
      --font-body: 'IBM Plex Sans', sans-serif;
      --font-mono: 'IBM Plex Mono', monospace;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 21cm;
      height: 29.7cm;
      margin: 0 auto;
      font-family: var(--font-body);
      color: var(--text);
      background: #e8e8e8;
      font-size: 11px;
      line-height: 1.4;
    }

    .page-wrap {
      width: 21cm;
      height: 29.7cm;
      overflow: hidden;
      background: var(--bg);
      box-shadow: 0 4px 32px rgba(0,0,0,0.18);
    }

    .doc {
      width: 21cm;
      height: 29.7cm;
      padding: 10px 10px 10px;
      overflow: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: var(--border-heavy);
    }

    .logo {
      height: 140px;
      object-fit: contain;
    }

    .company {
      text-align: right;
      max-width: 320px;
    }

    .company .name {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      color: var(--accent);
    }

    .company p {
      font-size: 17px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    .titlebar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .titlebar .line {
      flex: 1;
      height: 2px;
      background: var(--text);
    }

    .titlebar .title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--accent);
    }

    .info {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 24px;
      margin-bottom: 28px;
      padding: 20px 24px;
      border: var(--border-light);
      background: #fafafa;
    }

    .kv-table {
      display: table;
      width: 100%;
    }

    .kv-row {
      display: table-row;
    }

    .kv-label {
      display: table-cell;
      font-weight: 600;
      font-size: 15px;
      padding: 3px 10px 3px 0;
      white-space: nowrap;
      vertical-align: top;
      color: var(--text);
    }

    .kv-sep {
      display: table-cell;
      padding: 3px 10px 3px 0;
      color: var(--text-muted);
      vertical-align: top;
    }

    .kv-val {
      display: table-cell;
      font-size: 15px;
      vertical-align: top;
      text-transform: uppercase;
      color: var(--text);
      font-weight: 500;
    }

    .info-right {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    .qr-box {
      width: 80px;
      height: 80px;
    }

    .qr-box img { width: 100%; height: 100%; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
      margin-bottom: 24px;
    }

    .items-table thead th {
      border-top: var(--border-heavy);
      border-bottom: var(--border-heavy);
      padding: 10px 8px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      background: #fff;
    }

    .items-table thead th.left { text-align: left; }
    .items-table thead th.right { text-align: right; }
    .items-table thead th.center { text-align: center; }

    .items-table tbody td {
      padding: 9px 8px;
      border-bottom: var(--border-dashed);
      vertical-align: top;
      color: var(--text);
    }

    .items-table tbody tr:nth-child(even) td { background: var(--row-alt); }
    .items-table tbody tr:last-child td { border-bottom: var(--border-heavy); }

    .items-table td.num {
      text-align: right;
      font-family: var(--font-mono);
      font-size: 15px;
    }

    .items-table td.center { text-align: center; }
    .items-table td.sr { color: var(--text-muted); font-weight: 600; }

    .bottom-section {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-bottom: 36px;
    }

    .bottom-left {
      flex: 1;
      font-size: 15px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .meta-row {
      display: flex;
      gap: 40px;
    }

    .meta-item .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 2px;
    }

    .meta-item .val {
      font-size: 15px;
      font-weight: 600;
    }

    .amount-words .lbl,
    .remarks .lbl,
    .terms .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 4px;
    }

    .amount-words .val {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--accent);
      font-family: var(--font-mono);
    }

    .remarks .val,
    .terms .val {
      font-size: 14px;
      color: var(--text);
      line-height: 1.6;
    }

    .summary {
      width: 260px;
      flex-shrink: 0;
      font-size: 15px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: var(--border-dashed);
      gap: 12px;
    }

    .summary-row:last-child {
      border-bottom: var(--border-heavy);
      padding-top: 10px;
      padding-bottom: 10px;
      border-top: var(--border-heavy);
      margin-top: 4px;
    }

    .s-label {
      font-weight: 600;
      color: var(--text);
      font-size: 15px;
    }

    .s-val {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
    }

    .summary-row:last-child .s-label,
    .summary-row:last-child .s-val {
      font-size: 18px;
      font-weight: 700;
    }

    .footer-prepared {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 16px;
      border-top: var(--border-heavy);
      font-size: 15px;
    }

    .footer-prepared .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .footer-prepared .val {
      font-weight: 600;
    }

    @media print {
      @page { size: 21cm 29.7cm; margin: 0; }
      html, body { background: #fff; width: 21cm; height: 29.7cm; }
      .page-wrap { box-shadow: none; width: 21cm; height: 29.7cm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="doc">
    <div class="header">
      <img class="logo" src="{{company.logo}}" alt="Logo" />
      <div class="company">
        <div class="name">{{company.name}}</div>
        <p>{{company.address}}</p>
        <p>{{company.address2}}</p>
        <p>Contact No: {{company.phone}}</p>
        <p>Email: {{company.email}}</p>
      </div>
    </div>

    <div class="titlebar">
      <div class="line"></div>
      <div class="title">Sales Invoice</div>
      <div class="line"></div>
    </div>

    <div class="info">
      <div class="info-left">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Customer Name</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.name}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Address</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.address}}<br />{{customer.address2}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">City</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.city}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">State</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.state}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Country</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.country}}</div>
          </div>
        </div>
      </div>

      <div class="info-mid">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Invoice No.</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{invoice.number}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Invoice Date</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{formatDate invoice.date}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Payment Term</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{invoice.payment_term}}</div>
          </div>
        </div>
      </div>

      <div class="info-right">
        <div class="qr-box"><img src="{{invoice.qr_code}}" alt="QR" /></div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="center">Sr.<br />No.</th>
          <th class="left">Product<br />Code</th>
          <th class="left">Product Description</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Discount</th>
          <th class="right">Tax</th>
          <th class="right">Value</th>
        </tr>
      </thead>
      <tbody>
        {{#each invoice.items}}
        <tr>
          <td class="center sr">{{inc @index}}</td>
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
        <div class="meta-row">
          <div class="meta-item">
            <span class="lbl">Item Count</span>
            <span class="val">{{invoice.item_count}}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Total Quantity</span>
            <span class="val">{{invoice.total_quantity}}</span>
          </div>
        </div>
        <div class="amount-words">
          <span class="lbl">Amount in Words</span>
          <span class="val">{{invoice.amount_in_words}}</span>
        </div>
        <div class="remarks">
          <span class="lbl">Remarks</span>
          <span class="val">{{invoice.remarks}}</span>
        </div>
        <div class="terms">
          <span class="lbl">Terms and Conditions</span>
          <span class="val">{{invoice.terms_and_conditions}}</span>
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="s-label">Sales Account</span>
          <span class="s-val">{{invoice.net_total}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">NHIL [2.5%]</span>
          <span class="s-val">{{invoice.nhil}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">GET FUND [2.5% on Sales]</span>
          <span class="s-val">{{invoice.get_fund}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">VAT [15%]</span>
          <span class="s-val">{{invoice.vat}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Net Invoice Value</span>
          <span class="s-val">{{invoice.total}}</span>
        </div>
      </div>
    </div>

    <div class="footer-prepared">
      <span class="lbl">Prepared By :</span>
      <span class="val">{{prepared_by}}</span>
    </div>
  </div>
</div>
</body>
</html>`;

// Default HTML template for generating sales orders
const DEFAULT_SALES_ORDER_TEMPLATE = `<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Order</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --text: #111111;
      --text-muted: #555555;
      --border-heavy: 2px solid #111111;
      --border-light: 1px solid #cccccc;
      --border-dashed: 1px dashed #999999;
      --accent: #1a1a1a;
      --bg: #ffffff;
      --row-alt: #f9f9f9;
      --font-body: 'IBM Plex Sans', sans-serif;
      --font-mono: 'IBM Plex Mono', monospace;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 21cm;
      height: 29.7cm;
      margin: 0 auto;
      font-family: var(--font-body);
      color: var(--text);
      background: #e8e8e8;
      font-size: 11px;
      line-height: 1.4;
    }

    .page-wrap {
      width: 21cm;
      height: 29.7cm;
      overflow: hidden;
      background: var(--bg);
      box-shadow: 0 4px 32px rgba(0,0,0,0.18);
    }

    .doc {
      width: 21cm;
      height: 29.7cm;
      padding: 10px 10px 10px;
      overflow: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: var(--border-heavy);
    }

    .logo {
      height: 140px;
      object-fit: contain;
    }

    .company {
      text-align: right;
      max-width: 320px;
    }

    .company .name {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      color: var(--accent);
    }

    .company p {
      font-size: 17px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    .titlebar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .titlebar .line {
      flex: 1;
      height: 2px;
      background: var(--text);
    }

    .titlebar .title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--accent);
    }

    .info {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 24px;
      margin-bottom: 28px;
      padding: 20px 24px;
      border: var(--border-light);
      background: #fafafa;
    }

    .kv-table {
      display: table;
      width: 100%;
    }

    .kv-row {
      display: table-row;
    }

    .kv-label {
      display: table-cell;
      font-weight: 600;
      font-size: 15px;
      padding: 3px 10px 3px 0;
      white-space: nowrap;
      vertical-align: top;
      color: var(--text);
    }

    .kv-sep {
      display: table-cell;
      padding: 3px 10px 3px 0;
      color: var(--text-muted);
      vertical-align: top;
    }

    .kv-val {
      display: table-cell;
      font-size: 15px;
      vertical-align: top;
      text-transform: uppercase;
      color: var(--text);
      font-weight: 500;
    }

    .info-right {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    .qr-box {
      width: 80px;
      height: 80px;
    }

    .qr-box img { width: 100%; height: 100%; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
      margin-bottom: 24px;
    }

    .items-table thead th {
      border-top: var(--border-heavy);
      border-bottom: var(--border-heavy);
      padding: 10px 8px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      background: #fff;
    }

    .items-table thead th.left { text-align: left; }
    .items-table thead th.right { text-align: right; }
    .items-table thead th.center { text-align: center; }

    .items-table th:nth-child(1) { width: 30px; }
    .items-table th:nth-child(2) { width: 80px; }
    .items-table th:nth-child(4) { width: 45px; }
    .items-table th:nth-child(5) { width: 65px; }
    .items-table th:nth-child(6) { width: 65px; }
    .items-table th:nth-child(7) { width: 55px; }
    .items-table th:nth-child(8) { width: 75px; }

    .items-table tbody td {
      padding: 9px 8px;
      border-bottom: var(--border-dashed);
      vertical-align: top;
      color: var(--text);
    }

    .items-table tbody tr:nth-child(even) td { background: var(--row-alt); }
    .items-table tbody tr:last-child td { border-bottom: var(--border-heavy); }

    .items-table td.num {
      text-align: right;
      font-family: var(--font-mono);
      font-size: 15px;
    }

    .items-table td.center { text-align: center; }
    .items-table td.sr { color: var(--text-muted); font-weight: 600; }

    .bottom-section {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-bottom: 36px;
    }

    .bottom-left {
      flex: 1;
      font-size: 15px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .meta-row {
      display: flex;
      gap: 40px;
    }

    .meta-item .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 2px;
    }

    .meta-item .val {
      font-size: 15px;
      font-weight: 600;
    }

    .amount-words .lbl,
    .remarks .lbl,
    .terms .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 4px;
    }

    .amount-words .val {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--accent);
      font-family: var(--font-mono);
    }

    .remarks .val,
    .terms .val {
      font-size: 14px;
      color: var(--text);
      line-height: 1.6;
    }

    .summary {
      width: 260px;
      flex-shrink: 0;
      font-size: 15px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: var(--border-dashed);
      gap: 12px;
    }

    .summary-row:last-child {
      border-bottom: var(--border-heavy);
      padding-top: 10px;
      padding-bottom: 10px;
      border-top: var(--border-heavy);
      margin-top: 4px;
    }

    .s-label {
      font-weight: 600;
      color: var(--text);
      font-size: 15px;
    }

    .s-val {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
    }

    .summary-row:last-child .s-label,
    .summary-row:last-child .s-val {
      font-size: 18px;
      font-weight: 700;
    }

    .footer-prepared {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 16px;
      border-top: var(--border-heavy);
      font-size: 15px;
    }

    .footer-prepared .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .footer-prepared .val {
      font-weight: 600;
    }

    @media print {
      @page { size: 21cm 29.7cm; margin: 0; }
      html, body { background: #fff; width: 21cm; height: 29.7cm; }
      .page-wrap { box-shadow: none; width: 21cm; height: 29.7cm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="doc">
    <div class="header">
      <img class="logo" src="{{company.logo}}" alt="Logo" />
      <div class="company">
        <div class="name">{{company.name}}</div>
        <p>{{company.address}}</p>
        <p>{{company.address2}}</p>
        <p>Contact No: {{company.phone}}</p>
        <p>Email: {{company.email}}</p>
      </div>
    </div>

    <div class="titlebar">
      <div class="line"></div>
      <div class="title">Sales Order</div>
      <div class="line"></div>
    </div>

    <div class="info">
      <div class="info-left">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Customer Name</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.name}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Address</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.address}}<br />{{customer.address2}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">City</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.city}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">State</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.state}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Country</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{customer.country}}</div>
          </div>
        </div>
      </div>

      <div class="info-mid">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Order No.</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{sales_order.number}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Order Date</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{formatDate sales_order.date}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Payment Term</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{sales_order.payment_terms}}</div>
          </div>
        </div>
      </div>

      <div class="info-right">
        <div class="qr-box"><img src="{{sales_order.qr_code}}" alt="QR" /></div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="center">Sr.<br />No.</th>
          <th class="left">Product<br />Code</th>
          <th class="left">Product Description</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Discount</th>
          <th class="right">Tax</th>
          <th class="right">Value</th>
        </tr>
      </thead>
      <tbody>
        {{#each sales_order.items}}
        <tr>
          <td class="center sr">{{inc @index}}</td>
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
        <div class="meta-row">
          <div class="meta-item">
            <span class="lbl">Item Count</span>
            <span class="val">{{sales_order.item_count}}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Total Quantity</span>
            <span class="val">{{sales_order.total_quantity}}</span>
          </div>
        </div>
        <div class="amount-words">
          <span class="lbl">Amount in Words</span>
          <span class="val">{{sales_order.amount_in_words}}</span>
        </div>
        <div class="remarks">
          <span class="lbl">Remarks</span>
          <span class="val">{{sales_order.remarks}}</span>
        </div>
        <div class="terms">
          <span class="lbl">Terms and Conditions</span>
          <span class="val">{{sales_order.terms_and_conditions}}</span>
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="s-label">Sales Account</span>
          <span class="s-val">{{sales_order.sub_total}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Discount</span>
          <span class="s-val">{{sales_order.discount_amount}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Tax</span>
          <span class="s-val">{{sales_order.tax_amount}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Net Order Value</span>
          <span class="s-val">{{sales_order.total}}</span>
        </div>
      </div>
    </div>

    <div class="footer-prepared">
      <span class="lbl">Prepared By :</span>
      <span class="val">{{prepared_by}}</span>
    </div>
  </div>
</div>
</body>
</html>`;

/**
 * Seed default document templates to database.
 * Called during server startup to ensure templates exist.
 * Handles: invoice, sales-order, and other document types.
 *
 * @returns {Promise<void>}
 */
export async function seedDefaultTemplates() {
  try {
    // Create table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS document_templates (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(150) NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        html_content MEDIUMTEXT NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company_type (company_id, document_type),
        KEY idx_company_branch (company_id, branch_id),
        KEY idx_default (company_id, document_type, is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    // Define default templates to seed
    const templates = [
      {
        type: "invoice",
        name: "Default Invoice Template",
        template: DEFAULT_INVOICE_TEMPLATE,
      },
      {
        type: "sales-order",
        name: "Default Sales Order Template",
        template: DEFAULT_SALES_ORDER_TEMPLATE,
      },
    ];

    // Loop through each template type and insert/update it in the database
    for (const { type, name, template } of templates) {
      try {
        // Check if system template exists (company_id = 0)
        const [existing] = await query(
          `SELECT id FROM document_templates 
           WHERE company_id = 0 AND document_type = ?
           LIMIT 1`,
          [type],
        ).catch(() => []);

        if (existing) {
          // Update existing template
          await query(
            `UPDATE document_templates 
             SET html_content = ?, name = ?, is_default = 1, updated_at = NOW()
             WHERE id = ?`,
            [template, name, existing.id],
          ).catch(() => {});
          // console.log(`✅ Default ${type} template updated`);
        } else {
          // Create new template
          await query(
            `INSERT INTO document_templates 
             (company_id, branch_id, name, document_type, html_content, is_default, created_by) 
             VALUES (0, 1, ?, ?, ?, 1, 1)`,
            [name, type, template],
          ).catch(() => {});
          // console.log(`✅ Default ${type} template created`);
        }
      } catch (err) {
        console.error(`⚠️ Error seeding ${type} template:`, err.message);
      }
    }
  } catch (err) {
    console.error("⚠️ Error seeding templates:", err.message);
  }
}

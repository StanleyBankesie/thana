const pool = require('../server/db/pool');

const PAGE_ID_MAP = {
  DIRECT_PURCHASE: 1,
  INVOICE: 2,
  PURCHASE_BILL_LOCAL: 3,
  PURCHASE_BILL_IMPORT: 4,
  LOCAL_PURCHASE_ORDER: 5,
  IMPORT_PURCHASE_ORDER: 6,
  MAINTENANCE_BILL: 7,
  SERVICE_BILL: 8,
  SALES_ORDER: 9,
  QUOTATION: 10,
  SUPPLIER_QUOTATION: 11,
  PAYMENT_VOUCHER: 12,
  RECEIPT_VOUCHER: 13,
  JOURNAL_VOUCHER: 14,
  CONTRA_VOUCHER: 15,
  DEBIT_NOTE: 16,
  CREDIT_NOTE: 17,
  SALES_VOUCHER: 18,
  SALES_RETURN: 19,
  PURCHASE_RETURN: 20,
  DELIVERY_NOTE: 21,
  TRANSPORT_EXPENSES: 22,
  TRANSPORT_INCOME: 23,
  ASSET_INVOICE: 24,
  FACILITIES_SERVICE_BILLING: 25,
  PROJECT_INVOICE: 26,
  SERVICE_INVOICE: 27,
  TRANSPORT_BILLING: 28,
};

async function testPage(formName) {
  const pageId = PAGE_ID_MAP[formName];
  const rows = await pool.query(
    `SELECT id, code, name FROM fin_tax_codes 
     WHERE is_active = 1 
       AND FIND_IN_SET(?, REPLACE(COALESCE(valid_pages, ''), ' ', '')) > 0`,
    [pageId]
  );
  console.log(`\n=== Form: ${formName} (pageId: ${pageId}) ===`);
  console.log(rows.map(r => `${r.code} (${r.name})`).join(', '));
}

async function run() {
  await testPage('INVOICE');
  await testPage('PROJECT_INVOICE');
  await testPage('FACILITIES_SERVICE_BILLING');
  await testPage('ASSET_INVOICE');
  await testPage('PURCHASE_BILL_LOCAL');
  await testPage('SERVICE_BILL');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

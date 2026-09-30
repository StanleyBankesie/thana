import { query } from './server/db/pool.js';
async function test() {
  console.time('invoices');
  await query(`SELECT COUNT(*) AS total FROM sal_invoices i WHERE i.company_id = 1`, []);
  console.timeEnd('invoices');

  console.time('invoices_data');
  await query(`SELECT i.id, i.invoice_no, i.invoice_date, i.customer_id, COALESCE(c.customer_name, '') AS customer_name, i.payment_status, i.status, i.net_amount, i.balance_amount, i.tax_amount, i.price_type, i.payment_type, i.warehouse_id, i.sales_order_id, i.service_execution_id, i.remarks, i.created_at, u.username AS created_by_name, (SELECT MAX(it.vat_on_sales_id) FROM sal_invoice_details d JOIN inv_items it ON it.id = d.item_id WHERE d.invoice_id = i.id AND it.company_id = i.company_id) AS tax_code_id FROM sal_invoices i LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id LEFT JOIN adm_users u ON u.id = i.created_by WHERE i.company_id = 1 ORDER BY i.created_at DESC LIMIT 50`, []);
  console.timeEnd('invoices_data');
  process.exit(0);
}
test();

import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { query } from "../db/pool.js";
import app from "../index.js";
import jwt from "jsonwebtoken";

test("Direct Purchase auto_payment creates payment voucher into fin_vouchers", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Setup test setting: ensure direct purchase payment account is configured
  const cashAccounts = await query(
    `SELECT id, code, name FROM fin_accounts 
     WHERE company_id = 1 AND is_active = 1 AND is_postable = 1 AND (code = '1021' OR LOWER(name) LIKE '%cash%')
     LIMIT 1`
  );
  assert.ok(cashAccounts.length > 0, "A cash account should exist in fin_accounts");
  const testPaymentAccountId = cashAccounts[0].id;

  // 2. Fetch suppliers, warehouses, items
  const suppliers = await query(`SELECT id, supplier_name FROM pur_suppliers WHERE company_id = 1 AND is_active = 1 LIMIT 1`);
  assert.ok(suppliers.length > 0, "Supplier should exist");
  const supplierId = suppliers[0].id;

  const warehouses = await query(`SELECT id FROM inv_warehouses WHERE company_id = 1 AND is_active = 1 LIMIT 1`);
  assert.ok(warehouses.length > 0, "Warehouse should exist");
  const warehouseId = warehouses[0].id;

  const items = await query(`SELECT id FROM inv_items WHERE company_id = 1 AND is_active = 1 LIMIT 1`);
  assert.ok(items.length > 0, "Item should exist");
  const itemId = items[0].id;

  // Sign test token
  const jwtSecret = process.env.JWT_SECRET || "omnisuite-super-secret-key-change-in-production";
  const token = jwt.sign(
    { sub: 1, username: "admin", companyId: 1, branchId: 1 },
    jwtSecret,
    { expiresIn: "1h" }
  );

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-company-id": "1",
    "x-branch-id": "1",
    "x-module": "pos",
  };

  // 3. Test POS General Settings endpoints
  const putSettingsRes = await fetch(`${baseUrl}/pos/general-settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      directPurchasePaymentAccountId: String(testPaymentAccountId),
      directPurchasePaymentMethod: "Cash",
    }),
  });
  assert.equal(putSettingsRes.status, 200, "PUT /pos/general-settings should succeed");

  const getSettingsRes = await fetch(`${baseUrl}/pos/general-settings`, {
    method: "GET",
    headers,
  });
  assert.equal(getSettingsRes.status, 200, "GET /pos/general-settings should succeed");
  const getSettingsData = await getSettingsRes.json();
  assert.equal(
    String(getSettingsData.settings?.directPurchasePaymentAccountId),
    String(testPaymentAccountId),
    "General settings must return configured payment account ID"
  );

  // 4. Test Creating Direct Purchase with auto_payment = true
  const dpPayload = {
    is_pos: true,
    purchase_date: new Date().toISOString().slice(0, 10),
    supplier_id: supplierId,
    warehouse_id: warehouseId,
    payment_type: "CASH",
    payment_method: "Cash",
    payment_account_id: testPaymentAccountId,
    auto_payment: true,
    paid_amount: 25,
    details: [
      {
        item_id: itemId,
        qty: 1,
        unit_price: 25,
        discount_percent: 0,
        tax_percent: 0,
        uom: "PCS",
      },
    ],
  };

  const createDpRes = await fetch(`${baseUrl}/purchase/direct-purchases`, {
    method: "POST",
    headers,
    body: JSON.stringify(dpPayload),
  });

  const createdDp = await createDpRes.json();
  assert.equal(createDpRes.status, 201, `Failed to create DP: ${JSON.stringify(createdDp)}`);
  assert.ok(createdDp.id, "Direct Purchase id must be returned");
  assert.ok(createdDp.payment_voucher_id, "payment_voucher_id must be populated upon auto_payment");

  // 5. Verify Payment Voucher in fin_vouchers
  const voucherRows = await query(
    `SELECT * FROM fin_vouchers WHERE id = :vid`,
    { vid: createdDp.payment_voucher_id }
  );
  assert.equal(voucherRows.length, 1, "Voucher must exist in fin_vouchers");
  const voucher = voucherRows[0];
  assert.equal(Number(voucher.total_debit), 25, "Voucher total_debit must match paid_amount");
  assert.equal(Number(voucher.total_credit), 25, "Voucher total_credit must match paid_amount");
  assert.ok(voucher.voucher_no.startsWith("PV"), "Voucher number must be a payment voucher PV");

  // 6. Verify Voucher Lines in fin_voucher_lines
  const voucherLines = await query(
    `SELECT * FROM fin_voucher_lines WHERE voucher_id = :vid ORDER BY line_no ASC`,
    { vid: createdDp.payment_voucher_id }
  );
  assert.equal(voucherLines.length, 2, "There must be 2 voucher lines (Supplier AP debit, Payment account credit)");

  // Line 1: Supplier AP Debit
  assert.equal(Number(voucherLines[0].debit), 25);
  assert.equal(Number(voucherLines[0].credit), 0);

  // Line 2: Payment Account Credit
  assert.equal(voucherLines[1].account_id, testPaymentAccountId);
  assert.equal(Number(voucherLines[1].debit), 0);
  assert.equal(Number(voucherLines[1].credit), 25);
  assert.equal(voucherLines[1].payment_method, "Cash");

  // 7. Clean up test records
  await query(`DELETE FROM fin_voucher_lines WHERE voucher_id = :vid`, { vid: createdDp.payment_voucher_id }).catch(() => null);
  await query(`DELETE FROM fin_vouchers WHERE id = :vid`, { vid: createdDp.payment_voucher_id }).catch(() => null);
  await query(`DELETE FROM pur_direct_purchase_dtl WHERE hdr_id = :dpid`, { dpid: createdDp.id }).catch(() => null);
  await query(`DELETE FROM pur_direct_purchase_hdr WHERE id = :dpid`, { dpid: createdDp.id }).catch(() => null);
  if (createdDp.bill_id) {
    await query(`DELETE FROM pur_bill_details WHERE bill_id = :bid`, { bid: createdDp.bill_id }).catch(() => null);
    await query(`DELETE FROM pur_bills WHERE id = :bid`, { bid: createdDp.bill_id }).catch(() => null);
  }
  if (createdDp.grn_id) {
    await query(`DELETE FROM inv_grn_dtl WHERE grn_id = :gid`, { gid: createdDp.grn_id }).catch(() => null);
    await query(`DELETE FROM inv_grn_hdr WHERE id = :gid`, { gid: createdDp.grn_id }).catch(() => null);
  }

  console.log("ALL DIRECT PURCHASE TESTS PASSED!");
});

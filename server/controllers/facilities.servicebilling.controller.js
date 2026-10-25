import { pool, query } from "../db/pool.js";

function getScope(req) {
  const companyId = req.scope?.companyId || req.user?.company_id || 1;
  const branchId = req.scope?.branchId || req.user?.branch_id || null;
  return { companyId, branchId };
}

/**
 * Generate sequential bill number starting with "FB-"
 * Format: FB-YYYY-XXXX (e.g. FB-2026-0001)
 */
export async function getNextFMBillNumber(companyId) {
  const year = new Date().getFullYear();
  const prefix = `FB-${year}-`;
  const [rows] = await pool.query(
    `SELECT bill_no FROM fm_service_bills 
     WHERE company_id = ? AND bill_no LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [companyId, `${prefix}%`]
  );
  if (rows.length > 0 && rows[0].bill_no) {
    const lastNumStr = rows[0].bill_no.replace(prefix, "");
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
    }
  }
  return `${prefix}0001`;
}

export async function getNextFMBillNo(req, res) {
  try {
    const { companyId } = getScope(req);
    const nextNo = await getNextFMBillNumber(companyId);
    res.json({ success: true, bill_no: nextNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listFMServiceBills(req, res) {
  try {
    const { companyId } = getScope(req);
    const { status, search, property_id, client_id } = req.query;

    let sql = `
      SELECT b.*, p.property_name,
        (SELECT COUNT(*) FROM fm_service_bill_details WHERE bill_id = b.id) AS item_count
      FROM fm_service_bills b
      LEFT JOIN fm_properties p ON p.id = b.property_id
      WHERE b.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += " AND b.status = ?";
      params.push(status);
    }
    if (property_id) {
      sql += " AND b.property_id = ?";
      params.push(property_id);
    }
    if (client_id) {
      sql += " AND b.client_id = ?";
      params.push(client_id);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += " AND (b.bill_no LIKE ? OR b.client_name LIKE ? OR b.notes LIKE ?)";
      params.push(term, term, term);
    }

    sql += " ORDER BY b.bill_date DESC, b.id DESC LIMIT 200";

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFMServiceBillById(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);

    const [bills] = await pool.query(
      `SELECT b.*, p.property_name 
       FROM fm_service_bills b 
       LEFT JOIN fm_properties p ON p.id = b.property_id
       WHERE b.id = ? AND b.company_id = ?`,
      [id, companyId]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, message: "Facilities service bill not found" });
    }

    const bill = bills[0];
    const [details] = await pool.query(
      `SELECT * FROM fm_service_bill_details WHERE bill_id = ? ORDER BY item_seq ASC`,
      [id]
    );

    bill.items = details;
    res.json({ success: true, data: bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createFMServiceBill(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId } = getScope(req);
    const b = req.body;

    let billNo = b.bill_no;
    if (!billNo || !billNo.startsWith("FB-")) {
      billNo = await getNextFMBillNumber(companyId);
    }

    const subtotal = parseFloat(b.subtotal) || 0;
    const taxAmount = parseFloat(b.tax_amount) || 0;
    const discountAmount = parseFloat(b.discount_amount) || 0;
    const totalAmount = parseFloat(b.total_amount) || (subtotal + taxAmount - discountAmount);
    const paidAmount = parseFloat(b.paid_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    let paymentStatus = "UNPAID";
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIALLY_PAID";
    }

    const [headerResult] = await conn.query(
      `INSERT INTO fm_service_bills (
        company_id, branch_id, bill_no, bill_date, due_date, property_id,
        client_id, client_name, contract_id, contract_no, currency_id, exchange_rate,
        subtotal, tax_amount, discount_amount, total_amount, paid_amount, balance_due,
        status, payment_status, payment_method, payment_terms, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId,
        billNo,
        b.bill_date || new Date().toISOString().slice(0, 10),
        b.due_date || null,
        b.property_id || null,
        b.client_id || null,
        b.client_name || null,
        b.contract_id || null,
        b.contract_no || null,
        b.currency_id || null,
        parseFloat(b.exchange_rate) || 1.0,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paidAmount,
        balanceDue,
        b.status || "POSTED",
        paymentStatus,
        b.payment_method || "Bank Transfer",
        b.payment_terms || "Net 30",
        b.notes || null,
        b.created_by || req.user?.username || "Admin",
      ]
    );

    const billId = headerResult.insertId;

    if (Array.isArray(b.items) && b.items.length > 0) {
      for (let i = 0; i < b.items.length; i++) {
        const it = b.items[i];
        const lineQty = parseFloat(it.quantity || it.qty) || 1;
        const linePrice = parseFloat(it.unit_price) || 0;
        const lineDiscount = parseFloat(it.discount_percent) || 0;
        const lineTaxRate = parseFloat(it.tax_rate) || 0;
        const baseLine = lineQty * linePrice * (1 - lineDiscount / 100);
        const lineTax = baseLine * (lineTaxRate / 100);
        const lineTotal = parseFloat(it.total_amount) || (baseLine + lineTax);

        await conn.query(
          `INSERT INTO fm_service_bill_details (
            bill_id, item_seq, service_id, description, quantity, uom,
            unit_price, discount_percent, tax_code_id, tax_rate, tax_amount, total_amount, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            billId,
            i + 1,
            it.service_id || null,
            it.description || it.item_name || "Facility Service Line",
            lineQty,
            it.uom || "Lot",
            linePrice,
            lineDiscount,
            it.tax_code_id || null,
            lineTaxRate,
            lineTax,
            lineTotal,
            it.notes || null,
          ]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, message: "Facilities service bill created successfully", id: billId, bill_no: billNo });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
}

export async function updateFMServiceBill(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { companyId } = getScope(req);
    const b = req.body;

    const subtotal = parseFloat(b.subtotal) || 0;
    const taxAmount = parseFloat(b.tax_amount) || 0;
    const discountAmount = parseFloat(b.discount_amount) || 0;
    const totalAmount = parseFloat(b.total_amount) || (subtotal + taxAmount - discountAmount);
    const paidAmount = parseFloat(b.paid_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    let paymentStatus = b.payment_status || "UNPAID";
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIALLY_PAID";
    }

    await conn.query(
      `UPDATE fm_service_bills SET
        bill_date = ?, due_date = ?, property_id = ?, client_id = ?, client_name = ?,
        currency_id = ?, exchange_rate = ?, subtotal = ?, tax_amount = ?, discount_amount = ?,
        total_amount = ?, paid_amount = ?, balance_due = ?, status = ?, payment_status = ?,
        payment_method = ?, payment_terms = ?, notes = ?
      WHERE id = ? AND company_id = ?`,
      [
        b.bill_date,
        b.due_date || null,
        b.property_id || null,
        b.client_id || null,
        b.client_name || null,
        b.currency_id || null,
        parseFloat(b.exchange_rate) || 1.0,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paidAmount,
        balanceDue,
        b.status || "POSTED",
        paymentStatus,
        b.payment_method || "Bank Transfer",
        b.payment_terms || "Net 30",
        b.notes || null,
        id,
        companyId,
      ]
    );

    if (Array.isArray(b.items)) {
      await conn.query("DELETE FROM fm_service_bill_details WHERE bill_id = ?", [id]);
      for (let i = 0; i < b.items.length; i++) {
        const it = b.items[i];
        const lineQty = parseFloat(it.quantity || it.qty) || 1;
        const linePrice = parseFloat(it.unit_price) || 0;
        const lineDiscount = parseFloat(it.discount_percent) || 0;
        const lineTaxRate = parseFloat(it.tax_rate) || 0;
        const baseLine = lineQty * linePrice * (1 - lineDiscount / 100);
        const lineTax = baseLine * (lineTaxRate / 100);
        const lineTotal = parseFloat(it.total_amount) || (baseLine + lineTax);

        await conn.query(
          `INSERT INTO fm_service_bill_details (
            bill_id, item_seq, service_id, description, quantity, uom,
            unit_price, discount_percent, tax_code_id, tax_rate, tax_amount, total_amount, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            i + 1,
            it.service_id || null,
            it.description || it.item_name || "Facility Service Line",
            lineQty,
            it.uom || "Lot",
            linePrice,
            lineDiscount,
            it.tax_code_id || null,
            lineTaxRate,
            lineTax,
            lineTotal,
            it.notes || null,
          ]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Facilities service bill updated successfully" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
}

export async function deleteFMServiceBill(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    await pool.query("DELETE FROM fm_service_bill_details WHERE bill_id = ?", [id]);
    const [result] = await pool.query(
      "DELETE FROM fm_service_bills WHERE id = ? AND company_id = ?",
      [id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }
    res.json({ success: true, message: "Facilities service bill deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

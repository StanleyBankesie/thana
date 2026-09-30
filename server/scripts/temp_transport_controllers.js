// ===== INCOME =====
export const listTransportIncome = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    let sql = `SELECT i.*, v.registration_number AS vehicle_reg, t.trip_no, u.username AS created_by_name,
      c_cust.customer_name, cc.name AS cost_center_name,
      CASE 
        WHEN fv.status IN ('DRAFT', 'SUBMITTED') THEN 'PENDING'
        WHEN fv.status IS NOT NULL THEN fv.status
        ELSE i.status 
      END AS status
      FROM trn_transport_income i
      LEFT JOIN trn_vehicles v ON i.vehicle_id = v.id
      LEFT JOIN trn_trips t ON i.trip_id = t.id
      LEFT JOIN adm_users u ON i.recorded_by = u.username
      LEFT JOIN sal_customers c_cust ON i.customer_id = c_cust.id
      LEFT JOIN fin_cost_centers cc ON i.cost_center_id = cc.id
      LEFT JOIN fin_vouchers fv ON i.voucher_id = fv.id
      WHERE i.company_id = :companyId
      ORDER BY i.income_date DESC`;
    const rows = await query(sql, { companyId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createTransportIncome = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const b = req.body;
    if (!b.amount) throw httpError(400, "VALIDATION_ERROR", "amount required");
    const r = await query(`INSERT INTO trn_transport_income (company_id, branch_id, trip_id, vehicle_id, income_date, category, amount, currency, description, recorded_by, status, customer_id, payment_method, payment_account_id, is_tax_included, tax_code_id, reference_no, cheque_date, cost_center_id)
      VALUES (:companyId, :branchId, :tripId, :vehicleId, :incomeDate, :category, :amount, :currency, :description, :recordedBy, :status, :customerId, :paymentMethod, :paymentAccountId, :isTaxIncluded, :taxCodeId, :referenceNo, :chequeDate, :costCenterId)`, {
      companyId, branchId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      incomeDate: b.income_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING',
      customerId: toNumber(b.customer_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateTransportIncome = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body;
    await query(`UPDATE trn_transport_income SET
      trip_id = :tripId, vehicle_id = :vehicleId, income_date = :incomeDate, category = :category, amount = :amount, currency = :currency,
      description = :description, status = :status, customer_id = :customerId, payment_method = :paymentMethod,
      payment_account_id = :paymentAccountId, is_tax_included = :isTaxIncluded, tax_code_id = :taxCodeId,
      reference_no = :referenceNo, cheque_date = :chequeDate, cost_center_id = :costCenterId
      WHERE id = :id AND company_id = :companyId`, {
      id, companyId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      incomeDate: b.income_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      status: b.status || 'PENDING',
      customerId: toNumber(b.customer_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTransportIncome = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM trn_transport_income WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const updateTransportIncomeVoucherId = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const voucherId = toNumber(req.body.voucher_id);
    if (!id || !voucherId) throw httpError(400, "VALIDATION_ERROR", "Invalid id or voucher_id");
    await query(`UPDATE trn_transport_income SET voucher_id = :voucherId WHERE id = :id AND company_id = :companyId`, { id, voucherId, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== EXPENSES =====
export const listTransportExpenses = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    let sql = `SELECT i.*, v.registration_number AS vehicle_reg, t.trip_no, u.username AS created_by_name,
      s.supplier_name, cc.name AS cost_center_name,
      CASE 
        WHEN fv.status IN ('DRAFT', 'SUBMITTED') THEN 'PENDING'
        WHEN fv.status IS NOT NULL THEN fv.status
        ELSE i.status 
      END AS status
      FROM trn_transport_expenses i
      LEFT JOIN trn_vehicles v ON i.vehicle_id = v.id
      LEFT JOIN trn_trips t ON i.trip_id = t.id
      LEFT JOIN adm_users u ON i.recorded_by = u.username
      LEFT JOIN pur_suppliers s ON i.supplier_id = s.id
      LEFT JOIN fin_cost_centers cc ON i.cost_center_id = cc.id
      LEFT JOIN fin_vouchers fv ON i.voucher_id = fv.id
      WHERE i.company_id = :companyId
      ORDER BY i.expense_date DESC`;
    const rows = await query(sql, { companyId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createTransportExpense = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const b = req.body;
    if (!b.amount) throw httpError(400, "VALIDATION_ERROR", "amount required");
    const r = await query(`INSERT INTO trn_transport_expenses (company_id, branch_id, trip_id, vehicle_id, expense_date, category, amount, currency, description, recorded_by, status, supplier_id, payment_method, payment_account_id, is_tax_included, tax_code_id, reference_no, cheque_date, cost_center_id)
      VALUES (:companyId, :branchId, :tripId, :vehicleId, :expenseDate, :category, :amount, :currency, :description, :recordedBy, :status, :supplierId, :paymentMethod, :paymentAccountId, :isTaxIncluded, :taxCodeId, :referenceNo, :chequeDate, :costCenterId)`, {
      companyId, branchId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING',
      supplierId: toNumber(b.supplier_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateTransportExpense = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body;
    await query(`UPDATE trn_transport_expenses SET
      trip_id = :tripId, vehicle_id = :vehicleId, expense_date = :expenseDate, category = :category, amount = :amount, currency = :currency,
      description = :description, status = :status, supplier_id = :supplierId, payment_method = :paymentMethod,
      payment_account_id = :paymentAccountId, is_tax_included = :isTaxIncluded, tax_code_id = :taxCodeId,
      reference_no = :referenceNo, cheque_date = :chequeDate, cost_center_id = :costCenterId
      WHERE id = :id AND company_id = :companyId`, {
      id, companyId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      status: b.status || 'PENDING',
      supplierId: toNumber(b.supplier_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTransportExpense = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM trn_transport_expenses WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const updateTransportExpenseVoucherId = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const voucherId = toNumber(req.body.voucher_id);
    if (!id || !voucherId) throw httpError(400, "VALIDATION_ERROR", "Invalid id or voucher_id");
    await query(`UPDATE trn_transport_expenses SET voucher_id = :voucherId WHERE id = :id AND company_id = :companyId`, { id, voucherId, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

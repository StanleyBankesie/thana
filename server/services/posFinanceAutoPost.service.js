import { pool, query } from "../db/pool.js";

function roundTo2(val) {
  return Math.round(Number(val || 0) * 100) / 100;
}

function toYmd(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function resolveOpenFiscalYearId(conn, { companyId }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND is_open = 1 ORDER BY start_date DESC LIMIT 1",
    { companyId }
  );
  const id = Number(rows?.[0]?.id || 0);
  if (id) return id;

  const today = new Date();
  const todayYmd = toYmd(today);
  if (!todayYmd) return 0;

  const [inRangeRows] = await conn.execute(
    `SELECT id, is_open FROM fin_fiscal_years
     WHERE company_id = :companyId AND :todayYmd >= start_date AND :todayYmd <= end_date
     ORDER BY start_date DESC LIMIT 1`,
    { companyId, todayYmd }
  );
  const inRange = inRangeRows?.[0] || null;
  const inRangeId = Number(inRange?.id || 0) || 0;
  if (inRangeId) {
    if (Number(inRange?.is_open) !== 1) {
      await conn.execute(
        "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
        { companyId, id: inRangeId }
      );
    }
    return inRangeId;
  }

  const [companyRows] = await conn.execute(
    "SELECT fiscal_year_start_month FROM adm_companies WHERE id = :companyId LIMIT 1",
    { companyId }
  );
  let startMonth = Number(companyRows?.[0]?.fiscal_year_start_month || 1);
  if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) {
    startMonth = 1;
  }

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const startYear = currentMonth >= startMonth ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  const startDateObj = new Date(startYear, startMonth - 1, 1);
  const nextStartObj = new Date(endYear, startMonth - 1, 1);
  const endDateObj = new Date(nextStartObj);
  endDateObj.setDate(endDateObj.getDate() - 1);

  const startDate = toYmd(startDateObj);
  const endDate = toYmd(endDateObj);
  if (!startDate || !endDate) return 0;

  const codeBase =
    startMonth === 1
      ? `FY${startYear}`
      : `FY${startYear}/${String(endYear).slice(-2)}`;
  let code = codeBase;
  for (let i = 0; i < 5; i += 1) {
    const [existsRows] = await conn.execute(
      "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code }
    );
    if (!existsRows?.length) break;
    code = `${codeBase}-${i + 1}`;
  }

  const [ins] = await conn.execute(
    `INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
     VALUES (:companyId, :code, :startDate, :endDate, 1)`,
    { companyId, code, startDate, endDate }
  );
  return Number(ins?.insertId || 0) || 0;
}

async function resolveFinAccountId(conn, { companyId, accountRef }) {
  const raw = String(accountRef || "").trim();
  if (!raw) return 0;

  const asId = Number(raw);
  if (Number.isFinite(asId) && asId > 0) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: asId }
    );
    if (rows && rows.length) return Number(rows[0].id);
  }

  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: raw }
  );
  if (rows && rows.length) return Number(rows[0].id);
  return 0;
}

async function ensureFinAccountExistsTx(conn, { companyId, code, name, nature }) {
  const codeStr = String(code || "").trim();
  const nameStr = String(name || "").trim() || codeStr;
  const nat = String(nature || "").trim().toUpperCase();
  if (!codeStr) return 0;

  const [exists] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: codeStr }
  );
  const exId = Number(exists?.[0]?.id || 0) || 0;
  if (exId) return exId;

  const [grpRows] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND nature = :nature LIMIT 1",
    { companyId, nature: nat || "ASSET" }
  );
  let groupId = Number(grpRows?.[0]?.id || 0) || 0;
  if (!groupId) {
    const [gIns] = await conn.execute(
      `INSERT INTO fin_account_groups (company_id, code, name, nature, is_active)
       VALUES (:companyId, :code, :name, :nature, 1)`,
      {
        companyId,
        code: nat || "ASSET",
        name: nat || "ASSET",
        nature: nat || "ASSET",
      }
    );
    groupId = Number(gIns?.insertId || 0) || 0;
  }

  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts (company_id, group_id, code, name, is_control_account, is_postable, is_active)
     VALUES (:companyId, :groupId, :code, :name, 0, 1, 1)`,
    { companyId, groupId, code: codeStr, name: nameStr }
  );
  return Number(ins?.insertId || 0) || 0;
}

async function ensureSalesVoucherTypeIdTx(conn, { companyId }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = 'SV' LIMIT 1",
    { companyId }
  );
  const id = Number(rows?.[0]?.id || 0);
  if (id) return id;

  const [ins] = await conn.execute(
    `INSERT INTO fin_voucher_types (company_id, code, name, is_active)
     VALUES (:companyId, 'SV', 'Sales Voucher', 1)`,
    { companyId }
  );
  return Number(ins?.insertId || 0) || 0;
}

async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [typeRows] = await conn.execute(
    "SELECT code FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId LIMIT 1",
    { companyId, voucherTypeId }
  );
  const code = String(typeRows?.[0]?.code || "SV").trim() || "SV";
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${code}-${yyyy}${mm}-`;

  const [vRows] = await conn.execute(
    `SELECT voucher_no FROM fin_vouchers
     WHERE company_id = :companyId AND voucher_type_id = :voucherTypeId AND voucher_no LIKE :likePattern
     ORDER BY id DESC LIMIT 1`,
    { companyId, voucherTypeId, likePattern: `${prefix}%` }
  );
  let nextSeq = 1;
  const lastNo = String(vRows?.[0]?.voucher_no || "");
  if (lastNo && lastNo.startsWith(prefix)) {
    const tail = lastNo.slice(prefix.length);
    const n = Number(tail);
    if (Number.isFinite(n) && n > 0) nextSeq = n + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

async function resolveDefaultSalesAccountId(conn, { companyId }) {
  // 1. Check custom configured setting in adm_system_settings
  const [cfgRows] = await conn.execute(
    `SELECT setting_value FROM adm_system_settings
     WHERE (company_id = :companyId OR company_id IS NULL)
       AND setting_key = 'POS_AUTO_FINANCE_SALES_ACCOUNT_ID'
     ORDER BY company_id DESC LIMIT 1`,
    { companyId }
  ).catch(() => [[]]);
  const cfgVal = cfgRows?.[0]?.setting_value;
  if (cfgVal) {
    const accId = await resolveFinAccountId(conn, { companyId, accountRef: cfgVal });
    if (accId) return accId;
  }

  // 2. Fall back to standard sales account (4000 or Sales Revenue)
  const [rows] = await conn.execute(
    `SELECT a.id FROM fin_accounts a
     LEFT JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId AND a.is_active = 1 AND a.is_postable = 1
       AND (g.nature = 'INCOME' OR a.code LIKE '4%')
     ORDER BY
       CASE
         WHEN a.code IN ('4000', '400000') THEN 0
         WHEN LOWER(a.name) LIKE '%sales revenue%' THEN 1
         WHEN LOWER(a.name) LIKE '%sales%' THEN 2
         WHEN LOWER(a.code) LIKE '4%' THEN 3
         ELSE 4
       END, a.code
     LIMIT 1`,
    { companyId }
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

/**
 * Automatically posts daily POS sales to Finance at 11:59 PM (23:59)
 * for companies/branches where Day Open & Day Close is inactivated (POS_ENABLE_DAY_OPEN_CLOSE = '0').
 *
 * Rules per specification:
 * 1. Only runs when Day Open & Close is unchecked / inactivated (setting value '0').
 * 2. ONLY posts if sales WERE made on that business day. If 0 sales, skip.
 * 3. Uses configured finance accounts (Payment modes accounts from pos_payment_modes,
 *    Sales Revenue account, Tax output account from pos_tax_settings).
 * 4. Prevents duplicate posting if already posted for that business day.
 */
export async function autoPostMidnightPosSalesToFinance({
  targetDate,
  specificCompanyId = null,
  specificBranchId = null,
  isManualTest = false,
} = {}) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);
  const startTime = new Date(`${dateStr}T00:00:00`);
  const endTime = new Date(`${dateStr}T23:59:59`);

  const results = {
    targetDate: dateStr,
    checkedCompanies: 0,
    postedCount: 0,
    skippedNoSales: 0,
    skippedAlreadyPosted: 0,
    skippedDayOpenActive: 0,
    details: [],
  };

  try {
    // 1. Find all active companies
    let compSql = `SELECT id, name FROM adm_companies WHERE 1=1`;
    const compParams = {};
    if (specificCompanyId) {
      compSql += ` AND id = :specificCompanyId`;
      compParams.specificCompanyId = specificCompanyId;
    }
    const companies = await query(compSql, compParams);

    for (const comp of companies) {
      const companyId = Number(comp.id);
      results.checkedCompanies++;

      // Check setting: POS_ENABLE_DAY_OPEN_CLOSE
      // If setting is '1' (or not set), Day Open/Close is ACTIVE -> skip automatic posting
      // If setting is '0', Day Open/Close is INACTIVE -> proceed with automatic posting
      const [settingRows] = await query(
        `SELECT setting_value FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
           AND setting_key = 'POS_ENABLE_DAY_OPEN_CLOSE'
         ORDER BY company_id DESC LIMIT 1`,
        { companyId }
      ).catch(() => []);

      const settingVal = Array.isArray(settingRows)
        ? settingRows[0]?.setting_value
        : settingRows?.setting_value;
      const isDayControlEnabled = settingVal === undefined || settingVal === null || settingVal === "1" || settingVal === "true";

      if (isDayControlEnabled && !isManualTest) {
        results.skippedDayOpenActive++;
        results.details.push({
          companyId,
          companyName: comp.name,
          status: "SKIPPED_DAY_CONTROL_ACTIVE",
          message: "Day Open & Day Close is active for this company. Manual closing and posting applies.",
        });
        continue;
      }

      // Find branches for this company
      let branchSql = `SELECT id, name FROM adm_branches WHERE company_id = :companyId AND is_active = 1`;
      const branchParams = { companyId };
      if (specificBranchId) {
        branchSql += ` AND id = :specificBranchId`;
        branchParams.specificBranchId = specificBranchId;
      }
      const branches = await query(branchSql, branchParams).catch(() => []);
      const targetBranches = branches.length > 0 ? branches : [{ id: null, name: "Main / Head Office" }];

      for (const br of targetBranches) {
        const branchId = br.id ? Number(br.id) : null;
        const branchName = br.name || "Main";

        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          // 2. Query completed sales for targetDate
          const [aggRows] = await conn.execute(
            `SELECT
               COUNT(p.id) AS sales_count,
               SUM(CASE WHEN COALESCE(p.payment_method, '')='CASH' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS cash_total,
               SUM(CASE WHEN COALESCE(p.payment_method, '')='CARD' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS card_total,
               SUM(CASE WHEN COALESCE(p.payment_method, '')='MOBILE' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS mobile_total,
               SUM(CASE WHEN COALESCE(p.payment_method, '')='CREDIT' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS credit_total,
               SUM(p.tax_amount) AS tax_total,
               SUM(p.discount_amount) AS discount_total,
               SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) AS net_total
             FROM pos_sales p
             WHERE p.company_id = :companyId
               AND (:branchId IS NULL OR p.branch_id = :branchId)
               AND p.status = 'COMPLETED'
               AND p.sale_datetime BETWEEN :startTime AND :endTime`,
            { companyId, branchId, startTime, endTime }
          );

          const salesAgg = aggRows?.[0] || {};
          const salesCount = Number(salesAgg.sales_count || 0);

          // Rule: "if only there where sales made on that day, but if there was no sales that day automatic finance posting shouldnt work"
          if (salesCount <= 0) {
            await conn.rollback();
            results.skippedNoSales++;
            results.details.push({
              companyId,
              branchId,
              branchName,
              status: "SKIPPED_NO_SALES",
              message: `No completed POS sales found for ${dateStr}. Finance posting skipped per rule.`,
            });
            continue;
          }

          // 3. Query returns for targetDate
          const [retRows] = await conn.execute(
            `SELECT
               COUNT(r.id) AS returns_count,
               SUM(CASE WHEN r.refund_method='CASH' THEN r.total_refund ELSE 0 END) AS cash_return,
               SUM(CASE WHEN r.refund_method='CARD' THEN r.total_refund ELSE 0 END) AS card_return,
               SUM(CASE WHEN r.refund_method='MOBILE' THEN r.total_refund ELSE 0 END) AS mobile_return,
               SUM(CASE WHEN r.refund_method='CREDIT' THEN r.total_refund ELSE 0 END) AS credit_return,
               SUM(r.total_refund) AS return_total
             FROM pos_returns r
             JOIN pos_sales ps ON ps.id = r.sale_id
             WHERE r.company_id = :companyId
               AND (:branchId IS NULL OR r.branch_id = :branchId)
               AND r.return_datetime BETWEEN :startTime AND :endTime`,
            { companyId, branchId, startTime, endTime }
          );
          const returnsAgg = retRows?.[0] || {};

          // Calculate net breakdown
          const cashTotal = roundTo2((salesAgg.cash_total || 0) - (returnsAgg.cash_return || 0));
          const cardTotal = roundTo2((salesAgg.card_total || 0) - (returnsAgg.card_return || 0));
          const mobileTotal = roundTo2((salesAgg.mobile_total || 0) - (returnsAgg.mobile_return || 0));
          const creditTotal = roundTo2((salesAgg.credit_total || 0) - (returnsAgg.credit_return || 0));

          const rawNetTotal = roundTo2(salesAgg.net_total || 0);
          const rawTaxTotal = roundTo2(salesAgg.tax_total || 0);
          const returnTotal = roundTo2(returnsAgg.return_total || 0);

          const netTotal = roundTo2(rawNetTotal - returnTotal);
          const taxRatio = rawNetTotal > 0 ? rawTaxTotal / rawNetTotal : 0;
          const taxTotal = Math.max(0, roundTo2(rawTaxTotal - returnTotal * taxRatio));
          const baseSales = roundTo2(netTotal - taxTotal);

          if (netTotal <= 0) {
            await conn.rollback();
            results.skippedNoSales++;
            results.details.push({
              companyId,
              branchId,
              branchName,
              status: "SKIPPED_NET_ZERO",
              message: `Net sales for ${dateStr} is 0.00 after returns. Skipping finance posting.`,
            });
            continue;
          }

          // 4. Prevent duplicate posting
          const narration = `Auto POS Aggregated Sales for Day ${dateStr} - Branch: ${branchName}`;
          const [existingV] = await conn.execute(
            `SELECT id, voucher_no FROM fin_vouchers
             WHERE company_id = :companyId
               AND (:branchId IS NULL OR branch_id = :branchId)
               AND voucher_date = DATE(:voucherDate)
               AND narration = :narration
             LIMIT 1`,
            { companyId, branchId, voucherDate: startTime, narration }
          );

          if (existingV?.length) {
            await conn.rollback();
            results.skippedAlreadyPosted++;
            results.details.push({
              companyId,
              branchId,
              branchName,
              status: "SKIPPED_ALREADY_POSTED",
              voucherNo: existingV[0].voucher_no,
              message: `Sales for ${dateStr} already posted to Finance (Voucher: ${existingV[0].voucher_no}).`,
            });
            continue;
          }

          // 5. Resolve required Finance accounts
          const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
          if (!fiscalYearId) {
            await conn.rollback();
            results.details.push({
              companyId,
              branchId,
              branchName,
              status: "ERROR_FISCAL_YEAR",
              message: "No open fiscal year found in Finance for this company.",
            });
            continue;
          }

          const voucherTypeId = await ensureSalesVoucherTypeIdTx(conn, { companyId });

          // Payment mode accounts from pos_payment_modes
          const [pModes] = await conn.execute(
            `SELECT id, name, type, account FROM pos_payment_modes
             WHERE company_id = :companyId AND (:branchId IS NULL OR branch_id = :branchId OR branch_id IS NULL)
               AND is_active = 1`,
            { companyId, branchId }
          );

          const findModeAccount = async (preferredType, fallbackCode) => {
            const m = (pModes || []).find(
              (x) => String(x.type || "").toUpperCase() === preferredType.toUpperCase() ||
                     String(x.name || "").toLowerCase().includes(preferredType.toLowerCase())
            );
            if (m?.account) {
              const accId = await resolveFinAccountId(conn, { companyId, accountRef: m.account });
              if (accId) return accId;
            }
            return (
              (await resolveFinAccountId(conn, { companyId, accountRef: fallbackCode })) ||
              (await ensureFinAccountExistsTx(conn, {
                companyId,
                code: fallbackCode,
                name: fallbackCode === "1100" ? "Accounts Receivable" : "Cash/Bank",
                nature: "ASSET",
              }))
            );
          };

          const cashAccId = await findModeAccount("CASH", "1000");
          const cardAccId = await findModeAccount("CARD", "1000");
          const mobileAccId = await findModeAccount("MOBILE", "1000");
          const creditAccId = await findModeAccount("CREDIT", "1100");

          // Sales Revenue Account
          let salesAccId = await resolveDefaultSalesAccountId(conn, { companyId });
          if (!salesAccId) {
            salesAccId = await ensureFinAccountExistsTx(conn, {
              companyId,
              code: "4000",
              name: "Sales Revenue",
              nature: "INCOME",
            });
          }

          // Tax Output Account
          const [taxSettingsRows] = await conn.execute(
            `SELECT tax_account_id FROM pos_tax_settings
             WHERE company_id = :companyId AND (:branchId IS NULL OR branch_id = :branchId OR branch_id IS NULL)
             LIMIT 1`,
            { companyId, branchId }
          ).catch(() => [[]]);
          const configuredTaxAcc = taxSettingsRows?.[0]?.tax_account_id;
          let vatOutputAccId = 0;
          if (configuredTaxAcc) {
            vatOutputAccId = await resolveFinAccountId(conn, { companyId, accountRef: configuredTaxAcc });
          }
          if (!vatOutputAccId && taxTotal > 0) {
            vatOutputAccId =
              (await resolveFinAccountId(conn, { companyId, accountRef: "1310" })) ||
              (await ensureFinAccountExistsTx(conn, {
                companyId,
                code: "1310",
                name: "VAT Output",
                nature: "LIABILITY",
              }));
          }

          // Currency
          const [curRows] = await conn.execute(
            `SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1`,
            { companyId }
          );
          const baseCurrencyId = Number(curRows?.[0]?.id || 0) || null;

          // Compute total debits and credits
          const debitLines = [];
          if (cashTotal > 0) debitLines.push({ accountId: cashAccId, amount: cashTotal, desc: "Cash collections" });
          if (cardTotal > 0) debitLines.push({ accountId: cardAccId, amount: cardTotal, desc: "Card collections" });
          if (mobileTotal > 0) debitLines.push({ accountId: mobileAccId, amount: mobileTotal, desc: "Mobile Money collections" });
          if (creditTotal > 0) debitLines.push({ accountId: creditAccId, amount: creditTotal, desc: "Credit / AR sales" });

          const totalDebit = roundTo2(debitLines.reduce((s, l) => s + l.amount, 0));
          const totalCredit = roundTo2(baseSales + taxTotal);

          // If debitLines is empty (e.g., all 0 or net zero), fallback to single debit
          if (debitLines.length === 0 && totalCredit > 0) {
            debitLines.push({ accountId: cashAccId, amount: totalCredit, desc: "Aggregated sales collections" });
          }

          const finalDebitTotal = roundTo2(debitLines.reduce((s, l) => s + l.amount, 0));

          // 6. Insert fin_vouchers
          const voucherNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId });
          const [vIns] = await conn.execute(
            `INSERT INTO fin_vouchers
              (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
             VALUES
              (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, 1, :totalDebit, :totalCredit, 'POSTED', NULL, NULL, NULL)`,
            {
              companyId,
              branchId,
              fiscalYearId,
              voucherTypeId,
              voucherNo,
              voucherDate: dateStr,
              narration,
              currencyId: baseCurrencyId,
              totalDebit: finalDebitTotal,
              totalCredit,
            }
          );
          const voucherId = Number(vIns.insertId || 0);

          // 7. Insert fin_voucher_lines
          let lineNo = 1;
          const lineDesc = `Auto POS sales for ${dateStr} (${branchName})`;

          // Debit lines (assets / payments)
          for (const dLine of debitLines) {
            await conn.execute(
              `INSERT INTO fin_voucher_lines
                (company_id, voucher_id, line_no, account_id, description, debit, credit)
               VALUES
                (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0)`,
              {
                companyId,
                voucherId,
                lineNo: lineNo++,
                accountId: dLine.accountId,
                description: `${lineDesc} - ${dLine.desc}`,
                debit: dLine.amount,
              }
            );
          }

          // Credit line (Sales Revenue)
          if (baseSales > 0) {
            await conn.execute(
              `INSERT INTO fin_voucher_lines
                (company_id, voucher_id, line_no, account_id, description, debit, credit)
               VALUES
                (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit)`,
              {
                companyId,
                voucherId,
                lineNo: lineNo++,
                accountId: salesAccId,
                description: `${lineDesc} - Sales Revenue`,
                credit: baseSales,
              }
            );
          }

          // Credit line (Tax / VAT Output)
          if (taxTotal > 0 && vatOutputAccId) {
            await conn.execute(
              `INSERT INTO fin_voucher_lines
                (company_id, voucher_id, line_no, account_id, description, debit, credit)
               VALUES
                (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit)`,
              {
                companyId,
                voucherId,
                lineNo: lineNo++,
                accountId: vatOutputAccId,
                description: `${lineDesc} - Tax/VAT Output`,
                credit: taxTotal,
              }
            );
          }

          await conn.commit();
          results.postedCount++;
          results.details.push({
            companyId,
            branchId,
            branchName,
            status: "SUCCESS_POSTED",
            voucherNo,
            voucherId,
            salesCount,
            netTotal,
            totalDebit: finalDebitTotal,
            totalCredit,
            message: `Successfully posted ${salesCount} sales totaling GH₵${netTotal.toFixed(2)} to Finance as Voucher #${voucherNo}.`,
          });
          console.log(`[POS Auto-Post 11:59PM] Successfully posted sales for ${comp.name} (${branchName}). Voucher: ${voucherNo}`);
        } catch (branchErr) {
          try {
            await conn.rollback();
          } catch {}
          console.error(`[POS Auto-Post 11:59PM] Error posting sales for company #${companyId} branch #${branchId}:`, branchErr);
          results.details.push({
            companyId,
            branchId,
            branchName,
            status: "ERROR",
            message: branchErr?.message || "Internal error during auto-post",
          });
        } finally {
          conn.release();
        }
      }
    }
  } catch (err) {
    console.error("[POS Auto-Post 11:59PM] Top-level failure:", err);
  }

  return results;
}

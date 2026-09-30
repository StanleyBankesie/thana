/**
 * @file seed_fin_coa_sample.js
 * @description Script to seed a sample Chart of Accounts (COA) for the finance module.
 * Populates account groups (Assets, Liabilities, Equity, Income, Expenses), 
 * standard general ledger (GL) accounts, and maps sample bank accounts to them.
 */

import { pool } from "../db/pool.js";

/**
 * Main execution function to seed the Chart of Accounts.
 * Iterates through all existing companies, discovers the base currency,
 * inserts hierarchical account groups, inserts specific GL accounts,
 * and sets up sample branch-level bank accounts. Uses a transaction
 * to ensure atomic operation.
 * 
 * @returns {Promise<void>} Resolves when the COA is fully seeded.
 */
async function seedCoa() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.query(
      "SELECT id FROM adm_companies"
    );
    const companyIds =
      Array.isArray(companyRows) && companyRows.length
        ? companyRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
        : [1];

    for (const companyId of companyIds) {
      const [baseCurrencyRows] = await connection.query(
        "SELECT id FROM fin_currencies WHERE company_id = ? AND is_base = 1 LIMIT 1",
        [companyId]
      );
      const baseCurrencyId = baseCurrencyRows?.[0]?.id
        ? Number(baseCurrencyRows[0].id)
        : null;
      if (!baseCurrencyId) {
        continue;
      }

      const groupDefs = [
        { code: "AST", name: "Assets", nature: "ASSET", parentCode: null },
        {
          code: "LIAB",
          name: "Liabilities",
          nature: "LIABILITY",
          parentCode: null,
        },
        { code: "EQ", name: "Equity", nature: "EQUITY", parentCode: null },
        { code: "INC", name: "Income", nature: "INCOME", parentCode: null },
        { code: "EXP", name: "Expenses", nature: "EXPENSE", parentCode: null },
        {
          code: "AST_CURR",
          name: "Current Assets",
          nature: "ASSET",
          parentCode: "AST",
        },
        {
          code: "AST_NONCURR",
          name: "Non-Current Assets",
          nature: "ASSET",
          parentCode: "AST",
        },
        {
          code: "AST_CASH",
          name: "Cash and Cash Equivalents",
          nature: "ASSET",
          parentCode: "AST_CURR",
        },
        {
          code: "AST_BANK",
          name: "Bank Accounts",
          nature: "ASSET",
          parentCode: "AST_CURR",
        },
        {
          code: "AST_AR",
          name: "Trade Receivables",
          nature: "ASSET",
          parentCode: "AST_CURR",
        },
        {
          code: "AST_INV",
          name: "Inventory",
          nature: "ASSET",
          parentCode: "AST_CURR",
        },
        {
          code: "AST_PPE",
          name: "Property, Plant and Equipment",
          nature: "ASSET",
          parentCode: "AST_NONCURR",
        },
        {
          code: "AST_TAX",
          name: "Tax Recoverable",
          nature: "ASSET",
          parentCode: "AST_CURR",
        },
        {
          code: "LIAB_CURR",
          name: "Current Liabilities",
          nature: "LIABILITY",
          parentCode: "LIAB",
        },
        {
          code: "LIAB_NONCURR",
          name: "Non-Current Liabilities",
          nature: "LIABILITY",
          parentCode: "LIAB",
        },
        {
          code: "LIAB_AP",
          name: "Trade Payables",
          nature: "LIABILITY",
          parentCode: "LIAB_CURR",
        },
        {
          code: "LIAB_STLOAN",
          name: "Short-Term Loans",
          nature: "LIABILITY",
          parentCode: "LIAB_CURR",
        },
        {
          code: "LIAB_LTLOAN",
          name: "Long-Term Loans",
          nature: "LIABILITY",
          parentCode: "LIAB_NONCURR",
        },
        {
          code: "LIAB_TAX",
          name: "Tax Payables",
          nature: "LIABILITY",
          parentCode: "LIAB_CURR",
        },
        {
          code: "EQ_SHARE",
          name: "Share Capital",
          nature: "EQUITY",
          parentCode: "EQ",
        },
        {
          code: "EQ_RE",
          name: "Retained Earnings",
          nature: "EQUITY",
          parentCode: "EQ",
        },
        {
          code: "INC_SALES",
          name: "Sales Revenue",
          nature: "INCOME",
          parentCode: "INC",
        },
        {
          code: "INC_OTHER",
          name: "Other Income",
          nature: "INCOME",
          parentCode: "INC",
        },
        {
          code: "EXP_COGS",
          name: "Cost of Goods Sold",
          nature: "EXPENSE",
          parentCode: "EXP",
        },
        {
          code: "EXP_ADMIN",
          name: "Administrative Expenses",
          nature: "EXPENSE",
          parentCode: "EXP",
        },
        {
          code: "EXP_SELL",
          name: "Selling and Distribution",
          nature: "EXPENSE",
          parentCode: "EXP",
        },
        {
          code: "EXP_FIN",
          name: "Finance Costs",
          nature: "EXPENSE",
          parentCode: "EXP",
        },
      ];

      const groupIdByCode = new Map();

      for (const def of groupDefs) {
        const [existingRows] = await connection.query(
          "SELECT id FROM fin_account_groups WHERE company_id = ? AND code = ?",
          [companyId, def.code]
        );
        if (Array.isArray(existingRows) && existingRows.length) {
          groupIdByCode.set(def.code, Number(existingRows[0].id));
          continue;
        }
        let parentId = null;
        if (def.parentCode) {
          const parentIdCached = groupIdByCode.get(def.parentCode);
          if (parentIdCached) {
            parentId = parentIdCached;
          } else {
            const [parentRows] = await connection.query(
              "SELECT id FROM fin_account_groups WHERE company_id = ? AND code = ?",
              [companyId, def.parentCode]
            );
            if (Array.isArray(parentRows) && parentRows.length) {
              parentId = Number(parentRows[0].id);
              groupIdByCode.set(def.parentCode, parentId);
            }
          }
        }
        const [result] = await connection.query(
          "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
          [companyId, def.code, def.name, def.nature, parentId]
        );
        const newId = Number(result.insertId);
        groupIdByCode.set(def.code, newId);
      }

      const accountDefs = [
        {
          code: "100000",
          name: "Cash on Hand",
          groupCode: "AST_CASH",
        },
        {
          code: "100100",
          name: "Petty Cash",
          groupCode: "AST_CASH",
        },
        {
          code: "100200",
          name: "Cash Account",
          groupCode: "AST_CASH",
        },
        {
          code: "110000",
          name: "Bank - Main Account",
          groupCode: "AST_BANK",
        },
        {
          code: "110100",
          name: "Bank - Savings Account",
          groupCode: "AST_BANK",
        },
        {
          code: "110200",
          name: "Mobile Money",
          groupCode: "AST_BANK",
        },
        {
          code: "120000",
          name: "Accounts Receivable - Trade",
          groupCode: "AST_AR",
        },
        {
          code: "130000",
          name: "Inventory - Finished Goods",
          groupCode: "AST_INV",
        },
        {
          code: "130100",
          name: "Inventory - Raw Materials",
          groupCode: "AST_INV",
        },
        {
          code: "140000",
          name: "Office Equipment",
          groupCode: "AST_PPE",
        },
        {
          code: "140100",
          name: "Motor Vehicles",
          groupCode: "AST_PPE",
        },
        {
          code: "130900",
          name: "VAT on Purchases",
          groupCode: "AST_TAX",
        },
        {
          code: "200000",
          name: "Accounts Payable - Trade",
          groupCode: "LIAB_AP",
        },
        {
          code: "210000",
          name: "Short-Term Bank Loan",
          groupCode: "LIAB_STLOAN",
        },
        {
          code: "220000",
          name: "Long-Term Bank Loan",
          groupCode: "LIAB_LTLOAN",
        },
        {
          code: "210100",
          name: "VAT on Sales",
          groupCode: "LIAB_TAX",
        },
        {
          code: "300000",
          name: "Share Capital",
          groupCode: "EQ_SHARE",
        },
        {
          code: "310000",
          name: "Retained Earnings",
          groupCode: "EQ_RE",
        },
        {
          code: "400000",
          name: "Sales Revenue - Local",
          groupCode: "INC_SALES",
        },
        {
          code: "400100",
          name: "Sales Revenue - Export",
          groupCode: "INC_SALES",
        },
        {
          code: "410000",
          name: "Other Operating Income",
          groupCode: "INC_OTHER",
        },
        {
          code: "500000",
          name: "Cost of Goods Sold",
          groupCode: "EXP_COGS",
        },
        {
          code: "510000",
          name: "Salaries and Wages",
          groupCode: "EXP_ADMIN",
        },
        {
          code: "510100",
          name: "Office Rent",
          groupCode: "EXP_ADMIN",
        },
        {
          code: "510200",
          name: "Utilities Expense",
          groupCode: "EXP_ADMIN",
        },
        {
          code: "520000",
          name: "Marketing and Advertising",
          groupCode: "EXP_SELL",
        },
        {
          code: "530000",
          name: "Bank Charges",
          groupCode: "EXP_FIN",
        },
        {
          code: "530100",
          name: "Interest Expense",
          groupCode: "EXP_FIN",
        },
      ];

      const accountIdByCode = new Map();

      for (const def of accountDefs) {
        const [existingRows] = await connection.query(
          "SELECT id FROM fin_accounts WHERE company_id = ? AND code = ?",
          [companyId, def.code]
        );
        if (Array.isArray(existingRows) && existingRows.length) {
          accountIdByCode.set(def.code, Number(existingRows[0].id));
          continue;
        }
        const groupId =
          groupIdByCode.get(def.groupCode) ||
          (await (async () => {
            const [gRows] = await connection.query(
              "SELECT id FROM fin_account_groups WHERE company_id = ? AND code = ?",
              [companyId, def.groupCode]
            );
            if (Array.isArray(gRows) && gRows.length) {
              const id = Number(gRows[0].id);
              groupIdByCode.set(def.groupCode, id);
              return id;
            }
            return null;
          })());
        if (!groupId) {
          continue;
        }
        const [result] = await connection.query(
          "INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active) VALUES (?, ?, ?, ?, ?, 0, 1, 1)",
          [companyId, groupId, def.code, def.name, baseCurrencyId]
        );
        const newId = Number(result.insertId);
        accountIdByCode.set(def.code, newId);
      }

      const bankDefs = [
        {
          name: "Main Bank Account",
          bankName: "First National Bank",
          accountNumber: "1234567890",
          glCode: "110000",
        },
        {
          name: "Savings Bank Account",
          bankName: "First National Bank",
          accountNumber: "9876543210",
          glCode: "110100",
        },
      ];

      const [branchRows] = await connection.query(
        "SELECT id FROM adm_branches WHERE company_id = ? ORDER BY id ASC LIMIT 1",
        [companyId]
      );
      const branchId = branchRows?.[0]?.id ? Number(branchRows[0].id) : null;
      if (!branchId) {
        continue;
      }

      for (const def of bankDefs) {
        const glId =
          accountIdByCode.get(def.glCode) ||
          (await (async () => {
            const [aRows] = await connection.query(
              "SELECT id FROM fin_accounts WHERE company_id = ? AND code = ?",
              [companyId, def.glCode]
            );
            if (Array.isArray(aRows) && aRows.length) {
              const id = Number(aRows[0].id);
              accountIdByCode.set(def.glCode, id);
              return id;
            }
            return null;
          })());
        if (!glId) {
          continue;
        }
        const [existingRows] = await connection.query(
          "SELECT id FROM fin_bank_accounts WHERE company_id = ? AND branch_id = ? AND name = ?",
          [companyId, branchId, def.name]
        );
        if (Array.isArray(existingRows) && existingRows.length) {
          continue;
        }
        await connection.query(
          "INSERT INTO fin_bank_accounts (company_id, branch_id, name, bank_name, account_number, gl_account_id, currency_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
          [
            companyId,
            branchId,
            def.name,
            def.bankName,
            def.accountNumber,
            glId,
            baseCurrencyId,
          ]
        );
      }
    }

    await connection.commit();
    console.log("Sample finance chart of accounts seeded successfully.");
  } catch (err) {
    await connection.rollback();
    console.error("Error seeding finance chart of accounts:", err);
    process.exitCode = 1;
  } finally {
    connection.release();
    process.exit();
  }
}

seedCoa();

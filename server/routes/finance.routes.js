/**
 * @file finance.routes.js
 * @description Defines the Express routes for the Finance module, including 
 * endpoints for accounts, vouchers, taxes, and financial reporting.
 */
import express from "express";
import { cacheListResponse } from "../middleware/cache.middleware.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as financeController from "../controllers/finance.controller.js";

const router = express.Router();

// Accounts & COA (Moved to top to avoid shadowing)
/**
 * Retrieves the full Chart of Accounts.
 * @route GET /chart-of-accounts
 */
router.get(
  "/chart-of-accounts",
  requireAuth,
  requireCompanyScope,
  financeController.listChartOfAccounts,
);

router.get(
  "/accounts",
  requireAuth,
  requireCompanyScope,
  financeController.listChartOfAccounts,
);

// Expense accounts endpoint
/**
 * Retrieves only expense accounts.
 * @route GET /expense-accounts
 */
router.get(
  "/expense-accounts",
  requireAuth,
  requireCompanyScope,
  financeController.listExpenseAccounts,
);

router.post(
  "/accounts/sync",
  requireAuth,
  requireCompanyScope,
  financeController.syncAccounts,
);

router.put(
  "/accounts/force-postable",
  requireAuth,
  requireCompanyScope,
  financeController.forcePostableAccounts,
);

router.post(
  "/accounts",
  requireAuth,
  requireCompanyScope,
  financeController.createAccount,
);

router.put(
  "/accounts/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateAccount,
);

router.put(
  "/accounts/:id/active",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateAccountActiveStatus,
);

router.delete(
  "/accounts/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.deleteAccount,
);

router.get(
  "/accounts/:id/balance",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.getAccountBalance,
);

// Voucher types and numbers
router.get(
  "/voucher-types",
  requireAuth,
  requireCompanyScope,
  financeController.listVoucherTypes,
);

router.post(
  "/voucher-types",
  requireAuth,
  requireCompanyScope,
  financeController.createVoucherType,
);

/**
 * Lists financial vouchers based on query parameters.
 * @route GET /vouchers
 */
router.get(
  "/vouchers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  financeController.listVouchers,
);

router.get(
  "/vouchers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.requireIdParam("id"),
  financeController.getVoucherById,
);

router.post(
  "/vouchers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.createVoucher,
);

router.put(
  "/vouchers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.requireIdParam("id"),
  financeController.updateVoucher,
);

router.post(
  "/vouchers/:id/reverse",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.requireIdParam("id"),
  financeController.reverseVoucher,
);

router.post(
  "/vouchers/backfill/tax-split",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.backfillVoucherTaxSplit,
);

router.get(
  "/vouchers/next-no",
  requireAuth,
  requireCompanyScope,
  financeController.getNextVoucherNo,
);

router.post(
  "/vouchers/:voucherId/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.submitVoucher,
);

router.post(
  "/vouchers/bulk-import",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.bulkImportVouchers,
);

// Account Groups
router.get(
  "/account-groups",
  requireAuth,
  requireCompanyScope,
  financeController.listAccountGroups,
);

router.get(
  "/account-groups/tree",
  requireAuth,
  requireCompanyScope,
  financeController.getAccountGroupsTree,
);

router.post(
  "/account-groups",
  requireAuth,
  requireCompanyScope,
  financeController.createAccountGroup,
);

router.put(
  "/account-groups/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateAccountGroup,
);

router.put(
  "/account-groups/:id/active",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.setAccountGroupActive,
);

router.patch(
  "/account-groups/:id/active",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.setAccountGroupActive,
);

router.delete(
  "/account-groups/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.deleteAccountGroup,
);

// Tax Codes

router.post(
  "/sync-accounts",
  requireAuth,
  requireCompanyScope,
  financeController.syncAccounts,
);

// Tax Codes
router.get(
  "/tax-codes",
  requireAuth,
  requireCompanyScope,
  financeController.listTaxCodes,
);

router.get(
  "/tax-codes/by-page/:pageId",
  requireAuth,
  requireCompanyScope,
  financeController.getTaxCodesByPageId,
);

router.get(
  "/item-tax/:itemId",
  requireAuth,
  requireCompanyScope,
  financeController.getItemPurchaseTax,
);

router.post(
  "/tax-codes",
  requireAuth,
  requireCompanyScope,
  financeController.createTaxCode,
);

router.put(
  "/tax-codes/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateTaxCode,
);

router.post(
  "/tax-codes/rectify/pages",
  requireAuth,
  requireCompanyScope,
  financeController.rectifyTaxCodePages,
);

router.post(
  "/tax-codes/:id/components",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.createTaxCodeComponent,
);

router.get(
  "/tax-codes/:id/components",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.listTaxCodeComponents,
);

router.put(
  "/tax-components/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateTaxCodeComponent,
);

router.delete(
  "/tax-components/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.deleteTaxCodeComponent,
);

// Currencies
router.get(
  "/currencies",
  requireAuth,
  requireCompanyScope,
  financeController.listCurrencies,
);

router.post(
  "/currencies",
  requireAuth,
  requireCompanyScope,
  financeController.createCurrency,
);

router.put(
  "/currencies/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateCurrency,
);

router.get(
  "/currencies/:id/rates",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.listCurrencyRates,
);

router.post(
  "/currencies/:id/rates",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.createCurrencyRate,
);

router.get(
  "/currency-rates",
  requireAuth,
  requireCompanyScope,
  financeController.listCurrencyRates,
);

router.post(
  "/currency-rates",
  requireAuth,
  requireCompanyScope,
  financeController.createCurrencyRate,
);

router.get(
  "/currency-rates/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateCurrencyRate,
);

router.put(
  "/currency-rates/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.updateCurrencyRate,
);

router.delete(
  "/currency-rates/:id",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.deleteCurrencyRate,
);

// Exchange rate cache endpoint (Redis-backed, 1-hour TTL)
import { getExchangeRates } from "../utils/exchangeRateCache.js";

router.get(
  "/exchange-rates/:base",
  requireAuth,
  async (req, res) => {
    try {
      const { base } = req.params;
      const result = await getExchangeRates(base);
      if (!result) {
        return res.status(502).json({ error: "EXCHANGE_RATE_FETCH_FAILED", message: "Failed to fetch exchange rates" });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "EXCHANGE_RATE_ERROR", message: err.message });
    }
  }
);

// Supplier Bills by Account
router.get(
  "/supplier-bills-by-account",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getSupplierBillsByAccount,
);

// Fiscal Years
router.get(
  "/fiscal-years",
  requireAuth,
  requireCompanyScope,
  financeController.listFiscalYears,
);

router.post(
  "/fiscal-years",
  requireAuth,
  requireCompanyScope,
  financeController.createFiscalYear,
);

router.post(
  "/fiscal-years/:id/open",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.openFiscalYear,
);

router.post(
  "/fiscal-years/:id/close",
  requireAuth,
  requireCompanyScope,
  financeController.requireIdParam("id"),
  financeController.closeFiscalYear,
);

// Cost Centers
router.get(
  "/cost-centers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.listCostCenters,
);

router.post(
  "/cost-centers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.createCostCenter,
);

router.put(
  "/cost-centers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.updateCostCenter,
);

// Opening Balances
router.get(
  "/opening-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.listOpeningBalances,
);

router.post(
  "/opening-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.upsertOpeningBalance,
);

router.post(
  "/opening-balances/bulk",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.bulkUpsertOpeningBalances,
);

router.get(
  "/reports/voucher-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.voucherRegisterReport,
);

router.get(
  "/reports/payment-due",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.paymentDueReport,
);

router.get(
  "/reports/outstanding-receivable",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.outstandingReceivableReport,
);

router.get(
  "/reports/customer-outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.customerOutstandingReport,
);

router.get(
  "/reports/trial-balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.trialBalanceReport,
);

router.get(
  "/reports/audit-trail",
  requireAuth,
  requireCompanyScope,
  financeController.auditTrailReport,
);

router.get(
  "/reports/journals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.journalsReport,
);

// Financial Reports
router.get(
  "/reports/cash-flow",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.cashFlowReport,
);

router.get(
  "/reports/balance-sheet",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.balanceSheetReport,
);

router.get(
  "/reports/profit-and-loss",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.profitAndLossReport,
);

router.get(
  "/reports/profit-loss-oci",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.statementOfProfitOrLossAndOCIReport,
);

router.get(
  "/reports/statement-reconciliation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.reconcileFinancialStatement,
);

router.get(
  "/reports/ratio-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.ratioAnalysisReport,
);

router.get(
  "/reports/supplier-outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.supplierOutstandingReport,
);

router.get(
  "/reports/creditors-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.creditorsLedgerReport,
);

router.get(
  "/reports/debtors-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.debtorsLedgerReport,
);

router.get(
  "/reports/general-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.generalLedgerReport,
);

router.get(
  "/reports/chart-of-accounts",
  requireAuth,
  requireCompanyScope,
  financeController.chartOfAccountsReport,
);

router.get(
  "/reports/bank-reconciliation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.bankReconciliationReport,
);

router.get(
  "/reports/chart-of-accounts-graphical",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.chartOfAccountsGraphical,
);

// Banking & PDC Management
router.get(
  "/bank-accounts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.listBankAccounts,
);

router.post(
  "/bank-accounts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.createBankAccount,
);

router.get(
  "/pdc-postings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.listPdcPostings,
);

router.post(
  "/pdc-postings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.createPdcPosting,
);

router.get(
  "/bank-reconciliations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.listBankReconciliations,
);

router.post(
  "/bank-reconciliations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.createBankReconciliation,
);

router.get(
  "/bank-reconciliations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getBankReconciliation,
);

router.put(
  "/bank-reconciliations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.updateBankReconciliation,
);

router.get(
  "/bank-reconciliations/:id/summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getBankReconciliationSummary,
);

router.get(
  "/bank-reconciliations/:id/transactions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getBankReconciliationTransactions,
);

router.post(
  "/bank-reconciliations/:id/lines",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.addBankReconciliationLine,
);

router.delete(
  "/bank-reconciliation-lines/:lineId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.deleteBankReconciliationLine,
);

router.post(
  "/bank-reconciliations/:id/confirm",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.confirmBankReconciliation,
);

router.get(
  "/dashboard/metrics",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getDashboardMetrics,
);

router.get(
  "/dashboard-stats",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  financeController.getFinanceDashboardStats,
);

export default router;

/**
 * @fileoverview FinanceRoutes component.
 * Provides functionality for FinanceRoutes.
 */

import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import FinanceHome, { financeSections } from "./FinanceHome.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import JournalVoucherList from "./vouchers/JournalVoucherList.jsx";
import JournalVoucherForm from "./vouchers/JournalVoucherForm.jsx";
import ReceiptVoucherList from "./vouchers/ReceiptVoucherList.jsx";
import ReceiptVoucherForm from "./vouchers/ReceiptVoucherForm.jsx";
import PaymentVoucherList from "./vouchers/PaymentVoucherList.jsx";
import PaymentVoucherForm from "./vouchers/PaymentVoucherForm.jsx";
import ContraVoucherList from "./vouchers/ContraVoucherList.jsx";
import ContraVoucherForm from "./vouchers/ContraVoucherForm.jsx";
import SalesVoucherList from "./vouchers/SalesVoucherList.jsx";
import SalesVoucherForm from "./vouchers/SalesVoucherForm.jsx";
import PurchaseVoucherList from "./vouchers/PurchaseVoucherList.jsx";
import PurchaseVoucherForm from "./vouchers/PurchaseVoucherForm.jsx";
import DebitNoteList from "./vouchers/DebitNoteList.jsx";
import DebitNoteForm from "./vouchers/DebitNoteForm.jsx";
import CreditNoteList from "./vouchers/CreditNoteList.jsx";
import CreditNoteForm from "./vouchers/CreditNoteForm.jsx";
import VoucherImportPage from "./vouchers/VoucherImportPage.jsx";
import VoucherRegisterReportPage from "./reports/VoucherRegisterReportPage.jsx";
import TrialBalanceReportPage from "./reports/TrialBalanceReportPage.jsx";
import JournalReportPage from "./reports/JournalReportPage.jsx";
import GeneralLedgerReportPage from "./reports/GeneralLedgerReportPage.jsx";
import CreditorsLedgerReportPage from "./reports/CreditorsLedgerReportPage.jsx";
import SupplierOutstandingReportPage from "./reports/SupplierOutstandingReportPage.jsx";
import ProfitAndLossReportPage from "./reports/ProfitAndLossReportPage.jsx";
import StatementOfProfitLossOCIReportPage from "./reports/StatementOfProfitLossOCIReportPage.jsx";
import BalanceSheetReportPage from "./reports/BalanceSheetReportPage.jsx";
import ChartOfAccountsReportPage from "./reports/ChartOfAccountsReportPage.jsx";
import CashFlowReportPage from "./reports/CashFlowReportPage.jsx";
import PaymentDueReportPage from "./reports/PaymentDueReportPage.jsx";
import OutstandingReceivableReportPage from "./reports/OutstandingReceivableReportPage.jsx";
import CustomerOutstandingReportPage from "./reports/CustomerOutstandingReportPage.jsx";
import AuditTrailReportPage from "./reports/AuditTrailReportPage.jsx";
import DebtorsLedgerReportPage from "./reports/DebtorsLedgerReportPage.jsx";
import RatioAnalysisReportPage from "./reports/RatioAnalysisReportPage.jsx";
import GraphicalChartOfAccountsPage from "./reports/GraphicalChartOfAccountsPage.jsx";
import AccountGroupsPage from "./setup/AccountGroupsPage.jsx";
import AccountsPage from "./setup/AccountsPage.jsx";
import TaxCodesPage from "./setup/TaxCodesPage.jsx";
import CurrenciesPage from "./setup/CurrenciesPage.jsx";
import FiscalYearsPage from "./setup/FiscalYearsPage.jsx";
import CostCentersPage from "./setup/CostCentersPage.jsx";
import OpeningBalancesPage from "./setup/OpeningBalancesPage.jsx";
import BankReconciliationList from "./banking/BankReconciliationList.jsx";
import BankReconciliationForm from "./banking/BankReconciliationForm.jsx";
import PdcPostingsList from "./banking/PdcPostingsList.jsx";
import PdcPostingForm from "./banking/PdcPostingForm.jsx";
import FinanceDashboardPage from "./FinanceDashboardPage.jsx";
import BankReconciliationsReportPage from "./banking/reports/BankReconciliationsReportPage.jsx";
import BankReconciliationTransactionReportPage from "./banking/reports/BankReconciliationTransactionReportPage.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function FinanceRoutes() {
  return (
    <ModuleLayout sections={financeSections} moduleKey="finance">
      <Routes>
        <Route index element={<FinanceHome />} />
        <Route path="dashboard" element={<FinanceDashboardPage />} />

        <Route
          path="journal-voucher"
          element={<JournalVoucherList />}
        />
        <Route
          path="journal-voucher/create"
          element={
            <JournalVoucherForm />
          }
        />
        <Route
          path="journal-voucher/:id"
          element={<JournalVoucherForm />}
        />

        <Route
          path="payment-voucher"
          element={<PaymentVoucherList />}
        />
        <Route
          path="payment-voucher/create"
          element={
            <PaymentVoucherForm />
          }
        />
        <Route
          path="payment-voucher/:id"
          element={<PaymentVoucherForm />}
        />

        <Route
          path="receipt-voucher"
          element={<ReceiptVoucherList />}
        />
        <Route
          path="receipt-voucher/create"
          element={
            <ReceiptVoucherForm />
          }
        />
        <Route
          path="receipt-voucher/:id"
          element={<ReceiptVoucherForm />}
        />

        <Route path="contra-voucher" element={<ContraVoucherList />} />
        <Route
          path="contra-voucher/create"
          element={<ContraVoucherForm />}
        />
        <Route
          path="contra-voucher/:id"
          element={<ContraVoucherForm />}
        />

        <Route path="sales-voucher" element={<SalesVoucherList />} />
        <Route
          path="sales-voucher/create"
          element={<SalesVoucherForm />}
        />
        <Route
          path="sales-voucher/:id"
          element={<SalesVoucherForm />}
        />

        <Route path="purchase-voucher" element={<PurchaseVoucherList />} />
        <Route
          path="purchase-voucher/create"
          element={<PurchaseVoucherForm />}
        />
        <Route
          path="purchase-voucher/:id"
          element={<PurchaseVoucherForm />}
        />

        <Route path="debit-note" element={<DebitNoteList />} />
        <Route path="debit-note/create" element={<DebitNoteForm />} />
        <Route path="debit-note/:id" element={<DebitNoteForm />} />

        <Route path="credit-note" element={<CreditNoteList />} />
        <Route path="credit-note/create" element={<CreditNoteForm />} />
        <Route path="credit-note/:id" element={<CreditNoteForm />} />

        <Route path="vouchers/import" element={<VoucherImportPage />} />
        <Route path="import" element={<VoucherImportPage />} />
        <Route path="import/create" element={<VoucherImportPage />} />
        <Route path="import-vouchers" element={<VoucherImportPage />} />

        {/* Setup & Master Data */}
        <Route path="setup/account-groups" element={<AccountGroupsPage />} />
        <Route path="setup/accounts" element={<AccountsPage />} />
        <Route path="setup/tax-codes" element={<TaxCodesPage />} />
        <Route path="setup/currencies" element={<CurrenciesPage />} />
        <Route path="setup/fiscal-years" element={<FiscalYearsPage />} />
        <Route path="setup/cost-centers" element={<CostCentersPage />} />
        <Route
          path="setup/opening-balances"
          element={<OpeningBalancesPage />}
        />
        <Route
          path="opening-balances"
          element={<OpeningBalancesPage />}
        />
        <Route path="accounts" element={<AccountsPage />} />

        {/* Banking */}
        <Route path="bank-reconciliation" element={<BankReconciliationList />} />
        <Route path="bank-reconciliation/new" element={<BankReconciliationForm />} />
        <Route path="bank-reconciliation/create" element={<BankReconciliationForm />} />
        <Route path="bank-reconciliation/:id" element={<BankReconciliationForm />} />
        <Route path="pdc-postings" element={<PdcPostingsList />} />
        <Route path="pdc-postings/new" element={<PdcPostingForm />} />
        <Route path="pdc-postings/create" element={<PdcPostingForm />} />
        <Route path="pdc-postings/:id" element={<PdcPostingForm />} />
        <Route path="reports/bank-reconciliations" element={<BankReconciliationsReportPage />} />
        <Route path="reports/bank-reconciliation-transactions" element={<BankReconciliationTransactionReportPage />} />

        {/* Reports */}
        <Route
          path="reports/voucher-register"
          element={<VoucherRegisterReportPage />}
        />
        <Route
          path="reports/voucher-register-report"
          element={<VoucherRegisterReportPage />}
        />
        <Route
          path="voucher-register"
          element={<VoucherRegisterReportPage />}
        />
        <Route
          path="reports"
          element={<VoucherRegisterReportPage />}
        />
        <Route
          path="reports/trial-balance"
          element={<TrialBalanceReportPage />}
        />
        <Route path="reports/journal" element={<JournalReportPage />} />
        <Route path="reports/journals" element={<JournalReportPage />} />
        <Route
          path="reports/general-ledger"
          element={<GeneralLedgerReportPage />}
        />
        <Route
          path="reports/creditors-ledger"
          element={<CreditorsLedgerReportPage />}
        />
        <Route
          path="reports/debtors-ledger"
          element={<DebtorsLedgerReportPage />}
        />
        <Route
          path="reports/supplier-outstanding"
          element={<SupplierOutstandingReportPage />}
        />
        <Route
          path="reports/customer-outstanding"
          element={<CustomerOutstandingReportPage />}
        />
        <Route
          path="reports/outstanding-receivables"
          element={<OutstandingReceivableReportPage />}
        />
        <Route
          path="reports/outstanding-receivable"
          element={<OutstandingReceivableReportPage />}
        />
        <Route
          path="reports/payment-due"
          element={<PaymentDueReportPage />}
        />
        <Route path="reports/audit-trail" element={<AuditTrailReportPage />} />
        <Route
          path="reports/ratio-analysis"
          element={<RatioAnalysisReportPage />}
        />
        <Route
          path="reports/profit-and-loss"
          element={<ProfitAndLossReportPage />}
        />
        <Route
          path="reports/profit-loss-oci"
          element={<StatementOfProfitLossOCIReportPage />}
        />
        <Route
          path="reports/balance-sheet"
          element={<BalanceSheetReportPage />}
        />
        <Route path="reports/cash-flow" element={<CashFlowReportPage />} />
        <Route
          path="reports/chart-of-accounts"
          element={<ChartOfAccountsReportPage />}
        />
        <Route
          path="reports/chart-of-accounts-graphical"
          element={<GraphicalChartOfAccountsPage />}
        />

        <Route path="*" element={<Navigate to="/finance?section=Voucher%20Management" replace />} />
      </Routes>
    </ModuleLayout>
  );
}

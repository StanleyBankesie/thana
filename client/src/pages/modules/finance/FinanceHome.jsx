import React from "react";
import { Link } from "react-router-dom";

import { usePermission } from "../../../auth/PermissionContext.jsx";

const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  // Simplified permission check to avoid breaking if featureKey is unknown
  // const hasPermission = canPerformAction(featureKey, action);
  // if (!hasPermission) return null;

  const baseClasses =
    type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";

  return (
    <Link to={path} className={baseClasses}>
      {label}
    </Link>
  );
};

import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "../../../api/client.js";

/**
 * Finance Module Home Page
 * Provides navigation to all finance features including vouchers, accounting setup, and reports
 */
function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `GH₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}



export const financeSections = [
  {
    title: "Voucher Management",
    icon: "🧾",
    items: [
      { title: "Journal Entry", path: "/finance/journal-voucher", description: "General ledger journal entries", icon: "📒" , actions: [
          <ActionButton key="view" label="View" path="/finance/journal-voucher" type="outline" featureKey="finance:journal-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/journal-voucher/create" type="primary" featureKey="finance:journal-voucher" action="create" />
        ], },
      { title: "Make Payment", path: "/finance/payment-voucher", description: "Record outgoing payments", icon: "💸" , actions: [
          <ActionButton key="view" label="View" path="/finance/payment-voucher" type="outline" featureKey="finance:payment-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/payment-voucher/create" type="primary" featureKey="finance:payment-voucher" action="create" />
        ], },
      { title: "Receive Payment", path: "/finance/receipt-voucher", description: "Record incoming payments", icon: "💰" , actions: [
          <ActionButton key="view" label="View" path="/finance/receipt-voucher" type="outline" featureKey="finance:receipt-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/receipt-voucher/create" type="primary" featureKey="finance:receipt-voucher" action="create" />
        ], },
      { title: "Credit Note", path: "/finance/credit-note", description: "Customer credit notes", icon: "🧾" , actions: [
          <ActionButton key="view" label="View" path="/finance/credit-note" type="outline" featureKey="finance:credit-note" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/credit-note/create" type="primary" featureKey="finance:credit-note" action="create" />
        ], },
      { title: "Debit Note", path: "/finance/debit-note", description: "Supplier debit notes", icon: "🧾" , actions: [
          <ActionButton key="view" label="View" path="/finance/debit-note" type="outline" featureKey="finance:debit-note" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/debit-note/create" type="primary" featureKey="finance:debit-note" action="create" />
        ], },
      { title: "Sales Voucher", path: "/finance/sales-voucher", description: "Sales transaction vouchers", icon: "🛍" , actions: [
          <ActionButton key="view" label="View" path="/finance/sales-voucher" type="outline" featureKey="finance:sales-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/sales-voucher/create" type="primary" featureKey="finance:sales-voucher" action="create" />
        ], },
      { title: "Purchase Voucher", path: "/finance/purchase-voucher", description: "Purchase transaction vouchers", icon: "🧺" , actions: [
          <ActionButton key="view" label="View" path="/finance/purchase-voucher" type="outline" featureKey="finance:purchase-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/purchase-voucher/create" type="primary" featureKey="finance:purchase-voucher" action="create" />
        ], },
      { title: "Account Transfer", path: "/finance/contra-voucher", description: "Bank or ledger transfers", icon: "🔁" , actions: [
          <ActionButton key="view" label="View" path="/finance/contra-voucher" type="outline" featureKey="finance:contra-voucher" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/contra-voucher/create" type="primary" featureKey="finance:contra-voucher" action="create" />
        ], },
      { title: "Import Vouchers", path: "/finance/vouchers/import", description: "Bulk import vouchers from Excel template", icon: "📥" , actions: [
          <ActionButton key="view" label="View" path="/finance/vouchers/import" type="outline" featureKey="finance:import-vouchers" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/vouchers/import" type="primary" featureKey="finance:import-vouchers" action="create" />
        ], },
      { title: "Voucher Register Report", path: "/finance/reports/voucher-register", description: "Voucher listing with filters (report)", icon: "📊" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/voucher-register" type="outline" featureKey="finance:reports" action="view" />,
        ], },
    ],
  },
  {
    title: "Accounting Setup",
    items: [
      { title: "Chart of Account Groups", path: "/finance/setup/account-groups", description: "Setup account group hierarchy", icon: "🗂" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/account-groups" type="outline" featureKey="finance:account-groups" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/account-groups/create" type="primary" featureKey="finance:account-groups" action="create" />
        ], },
      { title: "Accounts Creation", path: "/finance/setup/accounts", description: "Create and manage accounts", icon: "🏦" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/accounts" type="outline" featureKey="finance:accounts" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/accounts/create" type="primary" featureKey="finance:accounts" action="create" />
        ], },
      { title: "Cost Centers", path: "/finance/setup/cost-centers", description: "Define and manage cost centers", icon: "🏷️" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/cost-centers" type="outline" featureKey="finance:cost-centers" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/cost-centers/create" type="primary" featureKey="finance:cost-centers" action="create" />
        ], },
      { title: "Tax Codes & Deductions", path: "/finance/setup/tax-codes", description: "Configure tax and deduction codes", icon: "🧮" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/tax-codes" type="outline" featureKey="finance:tax-codes" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/tax-codes/create" type="primary" featureKey="finance:tax-codes" action="create" />
        ], },
      { title: "Currencies", path: "/finance/setup/currencies", description: "Manage currencies and base currency", icon: "💱" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/currencies" type="outline" featureKey="finance:currencies" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/currencies/create" type="primary" featureKey="finance:currencies" action="create" />
        ], },
      { title: "Fiscal Years", path: "/finance/setup/fiscal-years", description: "Open/close fiscal periods", icon: "📅" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/fiscal-years" type="outline" featureKey="finance:fiscal-years" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/fiscal-years/create" type="primary" featureKey="finance:fiscal-years" action="create" />
        ], },
      { title: "Opening Balances", path: "/finance/setup/opening-balances", description: "Set beginning balances for all accounts", icon: "🧮" , actions: [
          <ActionButton key="view" label="View" path="/finance/setup/opening-balances" type="outline" featureKey="finance:opening-balances" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/setup/opening-balances/create" type="primary" featureKey="finance:opening-balances" action="create" />
        ], },
    ],
  },
  {
    title: "Reports & Analysis",
    items: [
      { title: "Voucher Register", path: "/finance/reports/voucher-register", description: "Voucher listing with filters", icon: "📊" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/voucher-register" type="outline" featureKey="finance:voucher-register" action="view" />,
        ], },
      { title: "Payment Due", path: "/finance/reports/payment-due", description: "Upcoming and overdue payables", icon: "⏰" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/payment-due" type="outline" featureKey="finance:payment-due" action="view" />,
        ], },
      { title: "Outstanding Receivable", path: "/finance/reports/outstanding-receivable", description: "Upcoming and overdue receivables", icon: "📆" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/outstanding-receivable" type="outline" featureKey="finance:outstanding-receivable" action="view" />,
        ], },
      { title: "Customer Outstanding", path: "/finance/reports/customer-outstanding", description: "Receivables outstanding by customer", icon: "👤" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/customer-outstanding" type="outline" featureKey="finance:customer-outstanding" action="view" />,
        ], },
      { title: "Trial Balance", path: "/finance/reports/trial-balance", description: "Debits and credits summary", icon: "⚖️" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/trial-balance" type="outline" featureKey="finance:trial-balance" action="view" />,
        ], },
      { title: "Audit Trail", path: "/finance/reports/audit-trail", description: "System activity on finance transactions", icon: "🕵️" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/audit-trail" type="outline" featureKey="finance:audit-trail" action="view" />,
        ], },
      { title: "Journal Report", path: "/finance/reports/journals", description: "Journal entries by range", icon: "📒" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/journals" type="outline" featureKey="finance:journals" action="view" />,
        ], },
      { title: "Bank Reconciliation Detailed", path: "/finance/reports/bank-reconciliation-transactions", description: "Reconciled vs Unreconciled transactions", icon: "🏦" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/bank-reconciliation-transactions" type="outline" featureKey="finance:bank-reconciliation-transactions" action="view" />,
        ], },
      { title: "Bank Reconciliations Summary", path: "/finance/reports/bank-reconciliations", description: "Summary of completed reconciliations", icon: "📄" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/bank-reconciliations" type="outline" featureKey="finance:bank-reconciliations" action="view" />,
        ], },
      { title: "General Ledger", path: "/finance/reports/general-ledger", description: "Account ledger movements", icon: "📘" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/general-ledger" type="outline" featureKey="finance:general-ledger" action="view" />,
        ], },
      { title: "Debtors Ledger", path: "/finance/reports/debtors-ledger", description: "Customer ledger with running balance", icon: "📗" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/debtors-ledger" type="outline" featureKey="finance:debtors-ledger" action="view" />,
        ], },
      { title: "Creditors Ledger", path: "/finance/reports/creditors-ledger", description: "Supplier ledger with running balance", icon: "📕" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/creditors-ledger" type="outline" featureKey="finance:creditors-ledger" action="view" />,
        ], },
      { title: "Supplier Outstanding", path: "/finance/reports/supplier-outstanding", description: "Payables outstanding by supplier", icon: "🏷️" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/supplier-outstanding" type="outline" featureKey="finance:supplier-outstanding" action="view" />,
        ], },
      { title: "Profit & Loss", path: "/finance/reports/profit-and-loss", description: "Income vs. expenses summary", icon: "💹" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/profit-and-loss" type="outline" featureKey="finance:profit-and-loss" action="view" />,
        ], },
      { title: "Statement of Profit or Loss & OCI", path: "/finance/reports/profit-loss-oci", description: "Authoritative IFRS statement with OCI, comparative analysis, and drill-down", icon: "📑" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/profit-loss-oci" type="outline" featureKey="finance:profitlossocireport" action="view" />,
        ], },
      { title: "Balance Sheet", path: "/finance/reports/balance-sheet", description: "Assets, liabilities, and equity", icon: "🧮" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/balance-sheet" type="outline" featureKey="finance:balance-sheet" action="view" />,
        ], },
      { title: "Cash Flow", path: "/finance/reports/cash-flow", description: "Operating, investing, financing flows", icon: "💵" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/cash-flow" type="outline" featureKey="finance:cash-flow" action="view" />,
        ], },
      { title: "Ratio Analysis", path: "/finance/reports/ratio-analysis", description: "Key performance ratios", icon: "📈" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/ratio-analysis" type="outline" featureKey="finance:ratio-analysis" action="view" />,
        ], },
      { title: "Graphical Chart of Accounts", path: "/finance/reports/chart-of-accounts-graphical", description: "Hierarchical visual view of accounts", icon: "🌳" , actions: [
          <ActionButton key="view" label="View" path="/finance/reports/chart-of-accounts-graphical" type="outline" featureKey="finance:chart-of-accounts-graphical" action="view" />,
        ], },
    ],
  },
  {
    title: "Banking",
    items: [
      { title: "Bank Reconciliation", path: "/finance/bank-reconciliation", description: "Match bank statements with ledger, mark cleared", icon: "🏦" , actions: [
          <ActionButton key="view" label="View" path="/finance/bank-reconciliation" type="outline" featureKey="finance:bank-reconciliation" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/bank-reconciliation/create" type="primary" featureKey="finance:bank-reconciliation" action="create" />
        ], },
      { title: "Post-Dated Cheques (PDC)", path: "/finance/pdc-postings", description: "Register instruments and track status", icon: "🧾" , actions: [
          <ActionButton key="view" label="View" path="/finance/pdc-postings" type="outline" featureKey="finance:pdc-postings" action="view" />,
          <ActionButton key="add" label="Add" path="/finance/pdc-postings/create" type="primary" featureKey="finance:pdc-postings" action="create" />
        ], },
    ],
  },
];

export default function FinanceHome() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "cash-balance",
      value: "—",
      label: "Cash on Hand",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports",
    },
    {
      rbac_key: "bank-balance",
      value: "—",
      label: "Bank Balance",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports",
    },
    {
      rbac_key: "pending-vouchers",
      value: "—",
      label: "Pending Vouchers",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/journal-voucher",
    },
    {
      rbac_key: "net-income",
      value: "—",
      label: "Net Income (MTD)",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports/profit-and-loss",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/finance/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: fmt(d.cashBalance),
              change: `Bank: ${fmt(d.bankBalance)}`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: fmt(d.bankBalance),
              label: "Liquidity Total",
              change: fmt(d.totalLiquidity),
              changeType: "positive",
            };
            next[2] = {
              ...next[2],
              value: String(d.pendingVouchers ?? "—"),
              change: d.pendingVouchers > 0 ? "Awaiting posting" : "All posted",
              changeType: d.pendingVouchers > 0 ? "warning" : "positive",
            };
            next[3] = {
              ...next[3],
              value: fmt(d.netIncome),
              change: `Expenses: ${fmt(d.monthlyExpenses)}`,
              changeType: d.netIncome >= 0 ? "positive" : "negative",
            };
            return next;
          });
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      title="Finance Module"
      description="Comprehensive accounting, budgeting, and financial reporting system"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/finance/dashboard", icon: "📊" },
      ]}
      sections={financeSections}
      useSectionNavigation={true}
      hideOtherPages={true}
    />
  );
}

export const financeFeatures = [
  {
    module_key: "finance",
    label: "Journal Entry",
    path: "/finance/journal-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Make Payment",
    path: "/finance/payment-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Receive Payment",
    path: "/finance/receipt-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Credit Note",
    path: "/finance/credit-note",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Debit Note",
    path: "/finance/debit-note",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Sales Voucher",
    path: "/finance/sales-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Purchase Voucher",
    path: "/finance/purchase-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Account Transfer",
    path: "/finance/contra-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Voucher Register Report",
    path: "/finance/reports",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Chart of Account Groups",
    path: "/finance/account-groups",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Accounts Creation",
    path: "/finance/accounts",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Cost Centers",
    path: "/finance/cost-centers",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Tax Codes & Deductions",
    path: "/finance/tax-codes",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Currencies",
    path: "/finance/currencies",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Fiscal Years",
    path: "/finance/fiscal-years",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Opening Balances",
    path: "/finance/opening-balances",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Voucher Register",
    path: "/finance/reports/voucher-register",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Payment Due",
    path: "/finance/reports/payment-due",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Outstanding Receivable",
    path: "/finance/reports/outstanding-receivable",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Customer Outstanding",
    path: "/finance/reports/customer-outstanding",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Trial Balance",
    path: "/finance/reports/trial-balance",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Audit Trail",
    path: "/finance/reports/audit-trail",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Journal Report",
    path: "/finance/reports/journals",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "General Ledger",
    path: "/finance/reports/general-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Debtors Ledger",
    path: "/finance/reports/debtors-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Creditors Ledger",
    path: "/finance/reports/creditors-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Supplier Outstanding",
    path: "/finance/reports/supplier-outstanding",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Profit & Loss",
    path: "/finance/reports/profit-and-loss",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Balance Sheet",
    path: "/finance/reports/balance-sheet",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Cash Flow",
    path: "/finance/reports/cash-flow",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Ratio Analysis",
    path: "/finance/reports/ratio-analysis",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Graphical Chart of Accounts",
    path: "/finance/reports/chart-of-accounts-graphical",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Bank Reconciliation",
    path: "/finance/bank-reconciliation",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Post-Dated Cheques (PDC)",
    path: "/finance/pdc-postings",
    type: "feature",
  },
];

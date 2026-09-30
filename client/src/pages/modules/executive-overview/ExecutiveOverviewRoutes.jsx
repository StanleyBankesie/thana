/**
 * @fileoverview ExecutiveOverviewRoutes component.
 * Provides functionality for ExecutiveOverviewRoutes.
 */

import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ExecutiveOverviewHome from "./ExecutiveOverviewHome.jsx";
import ExecOutstandingReceivablesPage from "./reports/ExecOutstandingReceivablesPage.jsx";
import ExecOutstandingPayablesPage from "./reports/ExecOutstandingPayablesPage.jsx";
import ExecFastMovingItemsPage from "./reports/ExecFastMovingItemsPage.jsx";
import ExecSlowMovingItemsPage from "./reports/ExecSlowMovingItemsPage.jsx";
import ExecSalesTodayPage from "./reports/ExecSalesTodayPage.jsx";
import ExecSalesThisMonthPage from "./reports/ExecSalesThisMonthPage.jsx";
import ExecSalesThisWeekPage from "./reports/ExecSalesThisWeekPage.jsx";
import ExecSupplierOutstandingPage from "./reports/ExecSupplierOutstandingPage.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExecutiveOverviewRoutes() {
  return (
    <Routes>
      <Route index element={<ExecutiveOverviewHome />} />
      <Route path="outstanding-receivables" element={<ExecOutstandingReceivablesPage />} />
      <Route path="outstanding-payables" element={<ExecOutstandingPayablesPage />} />
      <Route path="fast-moving-items" element={<ExecFastMovingItemsPage />} />
      <Route path="slow-moving-items" element={<ExecSlowMovingItemsPage />} />
      <Route path="sales-today" element={<ExecSalesTodayPage />} />
      <Route path="sales-this-month" element={<ExecSalesThisMonthPage />} />
      <Route path="sales-this-week" element={<ExecSalesThisWeekPage />} />
      <Route path="supplier-outstanding" element={<ExecSupplierOutstandingPage />} />
      <Route path="*" element={<Navigate to="/executive-overview" replace />} />
    </Routes>
  );
}

export const executiveOverviewFeatures = [
  { module_key: "executive-overview", label: "Executive Overview", path: "/executive-overview", type: "dashboard" },
  { module_key: "executive-overview", label: "Outstanding Receivables", path: "/executive-overview/outstanding-receivables", type: "dashboard" },
  { module_key: "executive-overview", label: "Outstanding Payables", path: "/executive-overview/outstanding-payables", type: "dashboard" },
  { module_key: "executive-overview", label: "Fast Moving Items", path: "/executive-overview/fast-moving-items", type: "dashboard" },
  { module_key: "executive-overview", label: "Slow Moving Items", path: "/executive-overview/slow-moving-items", type: "dashboard" },
  { module_key: "executive-overview", label: "Today Sales", path: "/executive-overview/sales-today", type: "dashboard" },
  { module_key: "executive-overview", label: "Month Sales", path: "/executive-overview/sales-this-month", type: "dashboard" },
  { module_key: "executive-overview", label: "Week Sales", path: "/executive-overview/sales-this-week", type: "dashboard" },
  { module_key: "executive-overview", label: "Supplier Outstanding", path: "/executive-overview/supplier-outstanding", type: "dashboard" },
];

/**
 * @fileoverview ExecSupplierOutstandingPage component.
 * Provides functionality for ExecSupplierOutstandingPage.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import SupplierOutstandingReportPage from "../../finance/reports/SupplierOutstandingReportPage.jsx";

// Independent copy of the Supplier Outstanding Analysis for Executive Overview
/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExecSupplierOutstandingPage() {
  return (
    <SupplierOutstandingReportPage
      backPath="/executive-overview"
      backLabel="Back to Executive Overview"
    />
  );
}

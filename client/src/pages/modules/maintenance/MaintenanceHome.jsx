/**
 * @fileoverview MaintenanceHome component.
 * Main entry point and router for Maintenance Module.
 */

import React from "react";
import { Route, Routes, Link } from "react-router-dom";

import AssetList from "./assets/AssetList.jsx";
import AssetForm from "./assets/AssetForm.jsx";
import PmScheduleList from "./pm-schedules/PmScheduleList.jsx";
import PmScheduleForm from "./pm-schedules/PmScheduleForm.jsx";
import MaintenanceReports from "./reports/MaintenanceReports.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import MaintenanceRequestsList from "./maintenance-requests/MaintenanceRequestsList.jsx";
import MaintenanceRequestForm from "./maintenance-requests/MaintenanceRequestForm.jsx";
import MaintenanceJobOrdersList from "./job-orders/MaintenanceJobOrdersList.jsx";
import MaintenanceJobOrderForm from "./job-orders/MaintenanceJobOrderForm.jsx";
import JobExecutionList from "./job-execution/JobExecutionList.jsx";
import JobExecutionForm from "./job-execution/JobExecutionForm.jsx";
import MaintenanceRFQList from "./rfq/MaintenanceRFQList.jsx";
import MaintenanceRFQForm from "./rfq/MaintenanceRFQForm.jsx";
import SupplierQuotationsList from "./supplier-quotations/SupplierQuotationsList.jsx";
import SupplierQuotationForm from "./supplier-quotations/SupplierQuotationForm.jsx";
import MaintenanceBillList from "./maintenance-bills/MaintenanceBillList.jsx";
import MaintenanceBillForm from "./maintenance-bills/MaintenanceBillForm.jsx";
import MaintenanceScheduleList from "./schedules/MaintenanceScheduleList.jsx";
import MaintenanceScheduleForm from "./schedules/MaintenanceScheduleForm.jsx";
import MaintenanceRosterList from "./rosters/MaintenanceRosterList.jsx";
import MaintenanceRosterForm from "./rosters/MaintenanceRosterForm.jsx";
import EquipmentList from "./equipment/EquipmentList.jsx";
import EquipmentForm from "./equipment/EquipmentForm.jsx";
import MaintenanceContractList from "./contracts/MaintenanceContractList.jsx";
import MaintenanceContractForm from "./contracts/MaintenanceContractForm.jsx";
import MaintenanceSetupPage from "./setup/MaintenanceSetupPage";
import DowntimeAnalysisReport from "./reports/DowntimeAnalysisReport.jsx";
import MaintenanceMaterialRequisitionList from "./material-requisitions/MaintenanceMaterialRequisitionList.jsx";
import MaintenanceMaterialRequisitionForm from "./material-requisitions/MaintenanceMaterialRequisitionForm.jsx";
import MaterialReceiptList from "./material-receipt/MaterialReceiptList.jsx";
import MaterialReceiptForm from "./material-receipt/MaterialReceiptForm.jsx";
import MaintenanceDashboardPage from "./MaintenanceDashboardPage.jsx";
import { usePermission } from "../../../auth/PermissionContext.jsx";

const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  const hasPermission = featureKey ? canPerformAction(featureKey, action) : true;
  if (!hasPermission) return null;

  const baseClasses = type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";
  return (
    <Link to={path} className={baseClasses}>{label}</Link>
  );
};

const buildFeature = (title, path, description, icon) => {
  const isReport = path.includes('/reports');
  const isSetup = path.includes('/setup');
  const featureKey = `maintenance:${path.split('/').pop()}`;
  return {
    title,
    path,
    description,
    icon,
    actions: [
      <ActionButton key="view" label="View" path={path} type="outline" featureKey={featureKey} action="view" />,
      (!isReport && !isSetup) ? <ActionButton key="add" label="Add" path={`${path}/new`} type="primary" featureKey={featureKey} action="create" /> : null
    ].filter(Boolean)
  };
};

export const maintenanceSections = [
  {
    title: "Equipment & Assets",
    icon: "🏗️",
    items: [
      buildFeature("Maintenance Assets", "/maintenance/assets", "Manage assets and equipment details", "🏢"),
      buildFeature("Equipment", "/maintenance/equipment", "Equipment setup", "🚜"),
      buildFeature("Maintenance Contracts", "/maintenance/contracts", "Contract management", "📜"),
    ],
  },
  {
    title: "Maintenance Operations",
    icon: "🛠️",
    items: [
      buildFeature("Maintenance Requests", "/maintenance/maintenance-requests", "Service/repair requests", "📬"),
      buildFeature("Job Orders", "/maintenance/job-orders", "Job orders and work tickets", "📋"),
      buildFeature("Job Execution", "/maintenance/job-executions", "Track active job execution", "🔧"),
      buildFeature("PM Schedules", "/maintenance/pm-schedules", "Preventive maintenance schedules", "📅"),
      buildFeature("Maintenance Schedules", "/maintenance/schedules", "Master calendar for maintenance", "📆"),
    ],
  },
  {
    title: "Resource Management",
    icon: "👥",
    items: [
      buildFeature("Maintenance Rosters", "/maintenance/rosters", "Technician rosters and shift schedules", "📅"),
      buildFeature("Material Requisition", "/maintenance/material-requisitions", "Requisition spare parts from main inventory", "📝"),
      buildFeature("Material Receipt", "/maintenance/material-receipts", "Confirm arrival of spare parts at maintenance site", "📥"),
    ],
  },
  {
    title: "Procurement & Billing",
    icon: "💳",
    items: [
      buildFeature("Maintenance RFQ", "/maintenance/rfqs", "Request for quotation for maintenance items/services", "✉️"),
      buildFeature("Supplier Quotations", "/maintenance/supplier-quotations", "Quotations received from suppliers", "🏷️"),
      buildFeature("Maintenance Bills", "/maintenance/maintenance-bills", "Vendor bills for maintenance services", "🧾"),
    ],
  },
  {
    title: "Setup & Reports",
    icon: "⚙️",
    items: [
      buildFeature("Maintenance Reports", "/maintenance/reports", "Asset performance and cost reports", "📊"),
      buildFeature("Downtime Analysis", "/maintenance/reports/downtime", "Analyze MTBF, MTTR, and asset downtime", "📉"),
      buildFeature("Maintenance Setup", "/maintenance/setup", "Configure maintenance categories, work centers, and parameters", "⚙️"),
    ],
  },
];

function MaintenanceLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: "open-requests", value: "—", label: "New Requests", change: "Loading…", changeType: "neutral", path: "/maintenance/maintenance-requests", actions: [{ label: "View", path: "/maintenance/maintenance-requests", type: "outline" }] },
    { rbac_key: "in-progress-jobs", value: "—", label: "Active Job Orders", change: "Loading…", changeType: "neutral", path: "/maintenance/job-orders", actions: [{ label: "View", path: "/maintenance/job-orders", type: "outline" }] },
    { rbac_key: "overdue-pm", value: "—", label: "Overdue PM Tasks", change: "Loading…", changeType: "neutral", path: "/maintenance/pm-schedules", actions: [{ label: "View", path: "/maintenance/pm-schedules", type: "outline" }] },
    { rbac_key: "total-assets", value: "—", label: "Total Assets", change: "Loading…", changeType: "neutral", path: "/maintenance/assets", actions: [{ label: "View", path: "/maintenance/assets", type: "outline" }] },
  ]);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/maintenance/requests").catch(() => ({ data: [] })),
      api.get("/maintenance/work-orders").catch(() => ({ data: [] })),
      api.get("/maintenance/pm-schedules").catch(() => ({ data: [] })),
      api.get("/maintenance/assets").catch(() => ({ data: [] })),
    ]).then(([reqRes, woRes, pmRes, assetRes]) => {
      if (!mounted) return;
      const reqs = Array.isArray(reqRes.data) ? reqRes.data : reqRes.data?.items || reqRes.data?.data || [];
      const wos = Array.isArray(woRes.data) ? woRes.data : woRes.data?.items || woRes.data?.data || [];
      const pms = Array.isArray(pmRes.data) ? pmRes.data : pmRes.data?.items || pmRes.data?.data || [];
      const assets = Array.isArray(assetRes.data) ? assetRes.data : assetRes.data?.items || assetRes.data?.data || [];
      const openReqs = reqs.filter(r => r.status === "NEW" || r.status === "OPEN" || r.status === "PENDING");
      const activeWos = wos.filter(w => w.status === "IN_PROGRESS" || w.status === "ASSIGNED" || w.status === "OPEN");
      const overduePms = pms.filter(p => p.status === "OVERDUE");
      setStats([
        { rbac_key: "open-requests", value: openReqs.length.toString(), label: "New Requests", change: "Requires Action", changeType: openReqs.length > 0 ? "negative" : "positive", path: "/maintenance/maintenance-requests", actions: [{ label: "View", path: "/maintenance/maintenance-requests", type: "outline" }] },
        { rbac_key: "in-progress-jobs", value: activeWos.length.toString(), label: "Active Job Orders", change: "In Progress", changeType: "neutral", path: "/maintenance/job-orders", actions: [{ label: "View", path: "/maintenance/job-orders", type: "outline" }] },
        { rbac_key: "overdue-pm", value: overduePms.length.toString(), label: "Overdue PM Tasks", change: "Action Required", changeType: overduePms.length > 0 ? "negative" : "positive", path: "/maintenance/pm-schedules", actions: [{ label: "View", path: "/maintenance/pm-schedules", type: "outline" }] },
        { rbac_key: "total-assets", value: assets.length.toString(), label: "Total Assets", change: "Managed", changeType: "positive", path: "/maintenance/assets", actions: [{ label: "View", path: "/maintenance/assets", type: "outline" }] },
      ]);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <ModuleDashboard
      moduleTitle="Maintenance & Equipment Management"
      moduleDescription="Manage equipment, asset maintenance, work orders, PM schedules, rosters, and spare parts procurement."
      stats={stats}
      headerActions={[{ label: "Dashboard", path: "/maintenance/dashboard", actions: [{ label: "View", path: "/maintenance/dashboard", type: "outline" }], icon: "📊" }]}
      sections={maintenanceSections}
      useSectionNavigation={true}
    />
  );
}

export default function MaintenanceHome() {
  return (
    <ModuleLayout sections={maintenanceSections} moduleKey="maintenance">
      <Routes>
        <Route path="/" element={<MaintenanceLanding />} />
        <Route path="/dashboard" element={<MaintenanceDashboardPage />} />
        <Route path="/assets" element={<AssetList />} />
        <Route path="/assets/new" element={<AssetForm />} />
        <Route path="/assets/:id" element={<AssetForm />} />
        <Route path="/maintenance-requests" element={<MaintenanceRequestsList />} />
        <Route path="/maintenance-requests/new" element={<MaintenanceRequestForm />} />
        <Route path="/maintenance-requests/:id" element={<MaintenanceRequestForm />} />
        <Route path="/job-orders" element={<MaintenanceJobOrdersList />} />
        <Route path="/job-orders/new" element={<MaintenanceJobOrderForm />} />
        <Route path="/job-orders/:id" element={<MaintenanceJobOrderForm />} />
        <Route path="/job-executions" element={<JobExecutionList />} />
        <Route path="/job-executions/new" element={<JobExecutionForm />} />
        <Route path="/job-executions/:id" element={<JobExecutionForm />} />
        <Route path="/rfq" element={<MaintenanceRFQList />} />
        <Route path="/rfq/new" element={<MaintenanceRFQForm />} />
        <Route path="/rfq/:id" element={<MaintenanceRFQForm />} />
        <Route path="/supplier-quotations" element={<SupplierQuotationsList />} />
        <Route path="/supplier-quotations/new" element={<SupplierQuotationForm />} />
        <Route path="/supplier-quotations/:id" element={<SupplierQuotationForm />} />
        <Route path="/bills" element={<MaintenanceBillList />} />
        <Route path="/bills/new" element={<MaintenanceBillForm />} />
        <Route path="/bills/:id" element={<MaintenanceBillForm />} />
        <Route path="/schedules" element={<MaintenanceScheduleList />} />
        <Route path="/schedules/new" element={<MaintenanceScheduleForm />} />
        <Route path="/schedules/:id" element={<MaintenanceScheduleForm />} />
        <Route path="/rosters" element={<MaintenanceRosterList />} />
        <Route path="/rosters/new" element={<MaintenanceRosterForm />} />
        <Route path="/rosters/:id" element={<MaintenanceRosterForm />} />
        <Route path="/equipment" element={<EquipmentList />} />
        <Route path="/equipment/new" element={<EquipmentForm />} />
        <Route path="/equipment/:id" element={<EquipmentForm />} />
        <Route path="/contracts" element={<MaintenanceContractList />} />
        <Route path="/contracts/new" element={<MaintenanceContractForm />} />
        <Route path="/contracts/:id" element={<MaintenanceContractForm />} />
        <Route path="/material-requisitions" element={<MaintenanceMaterialRequisitionList />} />
        <Route path="/material-requisitions/new" element={<MaintenanceMaterialRequisitionForm />} />
        <Route path="/material-requisitions/:id" element={<MaintenanceMaterialRequisitionForm />} />
        <Route path="/material-requisition" element={<MaintenanceMaterialRequisitionList />} />
        <Route path="/material-requisition/new" element={<MaintenanceMaterialRequisitionForm />} />
        <Route path="/material-requisition/:id" element={<MaintenanceMaterialRequisitionForm />} />
        <Route path="/material-receipts" element={<MaterialReceiptList />} />
        <Route path="/material-receipts/new" element={<MaterialReceiptForm />} />
        <Route path="/material-receipts/:id" element={<MaterialReceiptForm />} />
        <Route path="/material-receipt" element={<MaterialReceiptList />} />
        <Route path="/material-receipt/new" element={<MaterialReceiptForm />} />
        <Route path="/material-receipt/:id" element={<MaterialReceiptForm />} />
        <Route path="/pm-schedules" element={<PmScheduleList />} />
        <Route path="/pm-schedules/new" element={<PmScheduleForm />} />
        <Route path="/pm-schedules/:id" element={<PmScheduleForm />} />
        <Route path="/setup" element={<MaintenanceSetupPage />} />
        <Route path="/reports" element={<MaintenanceReports />} />
        <Route path="/reports/downtime" element={<DowntimeAnalysisReport />} />
      </Routes>
    </ModuleLayout>
  );
}

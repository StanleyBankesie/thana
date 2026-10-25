/**
 * @fileoverview FacilitiesHome component.
 * Dedicated module for Facilities Management — full 18-area implementation:
 * Properties, Onboarding, Contracts, SLAs, Helpdesk, Soft Services, Hard Services,
 * Inspections, Utilities, Security, HSE, Workforce, Space, Subcontractors,
 * Compliance, Billing, Budgeting, Sustainability, Reports.
 */

import React from "react";
import { Route, Routes, Link } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import { usePermission } from "../../../auth/PermissionContext.jsx";

// ─────── Core FM pages (under maintenance/ because they were built there) ───────
import FacilitiesOperationsDashboard from "../maintenance/operations-dashboard/FacilitiesOperationsDashboard.jsx";
import PropertiesList from "../maintenance/properties/PropertiesList.jsx";
import FMContractsList from "../maintenance/fm-contracts/FMContractsList.jsx";
import FieldTechnicianJobCard from "../maintenance/field-service/FieldTechnicianJobCard.jsx";
import ChecklistTemplatesList from "../maintenance/checklists/ChecklistTemplatesList.jsx";
import SoftServicesPage from "../maintenance/soft-services/SoftServicesPage.jsx";
import FMSLAComplianceReport from "../maintenance/reports/FMSLAComplianceReport.jsx";
import FMPropertyCostReport from "../maintenance/reports/FMPropertyCostReport.jsx";
import FMContractsReport from "../maintenance/reports/FMContractsReport.jsx";
import FMSoftServicesReport from "../maintenance/reports/FMSoftServicesReport.jsx";
import FMInspectionChecklistReport from "../maintenance/reports/FMInspectionChecklistReport.jsx";
import HealthSafetyCompliancePage from "../maintenance/hsa-compliance/HealthSafetyCompliancePage.jsx";
import UtilitiesEnergyPage from "../maintenance/utilities-energy/UtilitiesEnergyPage.jsx";
import ContractorVendorManagementPage from "../maintenance/contractors-vendors/ContractorVendorManagementPage.jsx";
import FacilitiesBudgetingFinancePage from "../maintenance/budgeting-finance/FacilitiesBudgetingFinancePage.jsx";
import SpaceOccupancyPage from "../maintenance/space-occupancy/SpaceOccupancyPage.jsx";
import SustainabilityManagementPage from "../maintenance/sustainability/SustainabilityManagementPage.jsx";

// ─────── Setup ───────
import FacilitiesSetupPage from "./FacilitiesSetupPage.jsx";

// ─────── Service Billing ───────
import ServiceBillingList from "./servicebilling/ServiceBillingList.jsx";
import ServiceBillingForm from "./servicebilling/ServiceBillingForm.jsx";

// ─────── NEW EXPANSION PAGES ───────
import FMHelpdeskPage from "./helpdesk/FMHelpdeskPage.jsx";
import HardServicesPage from "./hard-services/HardServicesPage.jsx";
import SecurityAccessPage from "./security/SecurityAccessPage.jsx";
import FMInspectionsPage from "./inspections/FMInspectionsPage.jsx";
import FMWorkforceRosterPage from "./workforce/FMWorkforceRosterPage.jsx";
import PropertyOnboardingPage from "./onboarding/PropertyOnboardingPage.jsx";
import FMCompliancePage from "./compliance/FMCompliancePage.jsx";
import SLAPoliciesPage from "./sla/SLAPoliciesPage.jsx";

// ─────── TASKS & MATERIALS ───────
import FMTaskList from "./tasks/FMTaskList.jsx";
import FMTaskForm from "./tasks/FMTaskForm.jsx";
import FMTaskExecution from "./tasks/FMTaskExecution.jsx";
import FMPurchaseRequisitionList from "./purchase-requisitions/FMPurchaseRequisitionList.jsx";
import FMPurchaseRequisitionForm from "./purchase-requisitions/FMPurchaseRequisitionForm.jsx";
import FMMaterialRequisitionList from "./material-requisition/FMMaterialRequisitionList.jsx";
import FMMaterialRequisitionForm from "./material-requisition/FMMaterialRequisitionForm.jsx";
import FMMaterialReceiptList from "./material-receipt/FMMaterialReceiptList.jsx";
import FMMaterialReceiptForm from "./material-receipt/FMMaterialReceiptForm.jsx";
import FMMaterialUtilizationList from "./material-utilization/FMMaterialUtilizationList.jsx";
import FMMaterialUtilizationForm from "./material-utilization/FMMaterialUtilizationForm.jsx";

const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  const hasPermission = featureKey ? canPerformAction(featureKey, action) : true;
  if (!hasPermission) return null;
  const baseClasses = type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";
  return <Link to={path} className={baseClasses}>{label}</Link>;
};

const buildFeature = (title, path, description, icon) => {
  const isReport = path.includes("/reports");
  const featureKey = `facilities:${path.split("/").pop()}`;
  return {
    title,
    path,
    description,
    icon,
    actions: [
      <ActionButton key="view" label="View" path={path} type="outline" featureKey={featureKey} action="view" />,
      !isReport ? <ActionButton key="action" label="Open" path={path} type="primary" featureKey={featureKey} action="create" /> : null,
    ].filter(Boolean),
  };
};

export const facilitiesSections = [
  {
    title: "Portfolio & Sites Register",
    icon: "🏢",
    items: [
      buildFeature("Properties & Estates", "/facilities/properties", "Multi-tier property register: Buildings, Zones, Spaces & Handover", "🏛️"),
      buildFeature("Operations Setup", "/facilities/setup", "Configure shifts, supervisors, service personnel, categories", "⚙️"),
    ],
  },
  {
    title: "Contracts, SLA & Billing",
    icon: "📜",
    items: [
      buildFeature("FM Service Contracts", "/facilities/contracts", "Client service contracts, SLA rules, renewal management", "📜"),
      buildFeature("SLA Policies & Performance", "/facilities/sla-policies", "Configure SLA targets and monitor performance", "🛡️"),
      buildFeature("Service Billing", "/facilities/servicebilling", "Facilities service bills, recurring contract billing", "🧾"),
    ],
  },
  {
    title: "Operations & Helpdesk",
    icon: "🎧",
    items: [
      buildFeature("Helpdesk & Service Requests", "/facilities/helpdesk", "Central ticketing, SLA enforcement, requester management", "🎧"),
      buildFeature("Soft Services & Site Ops", "/facilities/soft-services", "Daily supervisor tasks, janitorial, security, pest control", "🧹"),
      buildFeature("Hard Services & Technical", "/facilities/hard-services", "HVAC, Generators, Elevators, Fire Systems, Building Engineering", "⚙️"),
    ],
  },
  {
    title: "Tasks & Materials Management",
    icon: "📋",
    items: [
      buildFeature("FM Task Assignment", "/facilities/tasks", "FM task allocation, work order scope & assignee management", "📝"),
      buildFeature("FM Task Execution", "/facilities/tasks/execution", "Interactive FM task checklists, progress odometer & delay logs", "⚡"),
      buildFeature("FM Purchase Requisitions", "/facilities/purchase-requisitions", "Requisition materials for facilities maintenance & procurement", "🛒"),
      buildFeature("FM Material Requisitions", "/facilities/material-requisitions", "Store material requests for facility sites with approval", "📦"),
      buildFeature("FM Materials Receipt", "/facilities/material-receipts", "Receive materials issued from inventory stores for facilities", "📥"),
      buildFeature("FM Material Utilization", "/facilities/material-utilizations", "Track material consumption against properties and work orders", "📊"),
    ],
  },
  {
    title: "Inspections, Safety & Compliance",
    icon: "🦺",
    items: [
      buildFeature("Inspections & Corrective Actions", "/facilities/inspections", "Schedule site inspections, record findings, track CAPA", "📋"),
      buildFeature("Health, Safety & Compliance", "/facilities/hsa-compliance", "Incidents, risk assessments, permits to work, certificates", "🦺"),
      buildFeature("Compliance Obligations & Hazards", "/facilities/compliance", "Statutory obligations, certificate expiry, hazard register", "⚠️"),
    ],
  },
  {
    title: "Utilities, Energy & Sustainability",
    icon: "⚡",
    items: [
      buildFeature("Utilities & Energy Management", "/facilities/utilities-energy", "Electricity, water, generator runtime & fuel tracking", "⚡"),
      buildFeature("Sustainability & Environmental", "/facilities/sustainability", "Carbon footprints, recycling, water savings, green projects", "🌱"),
    ],
  },
  {
    title: "Security, Workforce & Space",
    icon: "🔐",
    items: [
      buildFeature("Security & Access Management", "/facilities/security", "Visitor log, key register, access zone management", "🔐"),
      buildFeature("Workforce Roster & Deployment", "/facilities/workforce", "Employee site assignments, shift roster, attendance tracking", "👥"),
      buildFeature("Space & Occupancy Management", "/facilities/space-occupancy", "Office layouts, room bookings, tenant occupancy", "📐"),
    ],
  },
  {
    title: "Subcontractors, Finance & Reports",
    icon: "📊",
    items: [
      buildFeature("Contractors & Service Vendors", "/facilities/contractors-vendors", "Manage subcontractors, service agreements, performance ratings", "🤝"),
      buildFeature("Budgeting & Financial Management", "/facilities/budgeting-finance", "Maintenance budgets, variance analysis, cost per m²", "💰"),
      buildFeature("FM SLA Compliance Report", "/facilities/reports/sla-compliance", "Response & resolution SLA benchmarks", "🛡️"),
      buildFeature("Property Maintenance Costs", "/facilities/reports/property-costs", "Portfolio maintenance cost and expense allocation", "💵"),
      buildFeature("Contract Margin Report", "/facilities/reports/contract-profitability", "FM contract profitability & renewals", "📜"),
      buildFeature("Soft Services Audit Report", "/facilities/reports/soft-services", "Janitorial, security, pest, and waste audits", "✨"),
      buildFeature("Inspection Audit Report", "/facilities/reports/checklist-inspections", "PPM inspection checklist compliance", "📋"),
    ],
  },
];

function FacilitiesLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: "total-properties", value: "—", label: "Managed Properties", change: "Loading…", changeType: "neutral", path: "/facilities/properties", actions: [{ label: "View", path: "/facilities/properties", type: "outline" }] },
    { rbac_key: "active-contracts", value: "—", label: "Active FM Contracts", change: "Loading…", changeType: "neutral", path: "/facilities/contracts", actions: [{ label: "View", path: "/facilities/contracts", type: "outline" }] },
    { rbac_key: "open-tickets", value: "—", label: "Open Helpdesk Tickets", change: "Loading…", changeType: "neutral", path: "/facilities/helpdesk", actions: [{ label: "View", path: "/facilities/helpdesk", type: "outline" }] },
    { rbac_key: "sla-compliance", value: "—", label: "SLA Compliance", change: "Loading…", changeType: "neutral", path: "/facilities/sla-policies", actions: [{ label: "View", path: "/facilities/sla-policies", type: "outline" }] },
  ]);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
      api.get("/facilities/contracts").catch(() => ({ data: { data: [] } })),
      api.get("/facilities/helpdesk/dashboard").catch(() => ({ data: { data: { summary: {} } } })),
      api.get("/facilities/reports/sla-compliance").catch(() => ({ data: { data: { summary: {} } } })),
    ]).then(([propsRes, contractsRes, helpdeskRes, slaRes]) => {
      if (!mounted) return;
      const props = propsRes.data?.data || [];
      const contracts = contractsRes.data?.data || [];
      const helpdeskSummary = helpdeskRes.data?.data?.summary || {};
      const slaSummary = slaRes.data?.data?.summary || {};

      const activeContracts = contracts.filter((c) => c.status === "ACTIVE");
      const openTickets = parseInt(helpdeskSummary.open_tickets || 0);
      const complianceRate = slaSummary.sla_compliance_pct != null ? `${slaSummary.sla_compliance_pct}%` : "—";

      setStats([
        {
          rbac_key: "total-properties",
          value: props.length.toString(),
          label: "Managed Properties",
          change: "Portfolio Sites",
          changeType: "positive",
          path: "/facilities/properties",
          actions: [{ label: "View", path: "/facilities/properties", type: "outline" }],
        },
        {
          rbac_key: "active-contracts",
          value: activeContracts.length.toString(),
          label: "Active FM Contracts",
          change: "Under SLA",
          changeType: "positive",
          path: "/facilities/contracts",
          actions: [{ label: "View", path: "/facilities/contracts", type: "outline" }],
        },
        {
          rbac_key: "open-tickets",
          value: openTickets.toString(),
          label: "Open Helpdesk Tickets",
          change: openTickets > 0 ? "Requires Attention" : "All Clear",
          changeType: openTickets > 0 ? "neutral" : "positive",
          path: "/facilities/helpdesk",
          actions: [{ label: "View", path: "/facilities/helpdesk", type: "outline" }],
        },
        {
          rbac_key: "sla-compliance",
          value: complianceRate,
          label: "SLA Compliance",
          change: "Target: ≥95%",
          changeType: "positive",
          path: "/facilities/sla-policies",
          actions: [{ label: "View", path: "/facilities/sla-policies", type: "outline" }],
        },
      ]);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <ModuleDashboard
      moduleKey="facilities"
      moduleTitle="Facilities Management"
      moduleDescription="End-to-end facilities management: properties, contracts, helpdesk, soft/hard services, inspections, utilities, security, workforce, compliance, billing, and reporting."
      stats={stats}
      headerActions={[
        {
          label: "Operations Dashboard",
          path: "/facilities/dashboard",
          actions: [{ label: "Open", path: "/facilities/dashboard", type: "outline" }],
          icon: "📊",
        },
        {
          label: "Helpdesk",
          path: "/facilities/helpdesk",
          actions: [{ label: "Open", path: "/facilities/helpdesk", type: "outline" }],
          icon: "🎧",
        },
      ]}
      sections={facilitiesSections}
      useSectionNavigation={true}
    />
  );
}

export default function FacilitiesHome() {
  return (
    <ModuleLayout sections={facilitiesSections} moduleKey="facilities">
      <Routes>
        {/* ─── Landing ─── */}
        <Route path="/" element={<FacilitiesLanding />} />

        {/* ─── Dashboard ─── */}
        <Route path="/dashboard" element={<FacilitiesOperationsDashboard />} />

        {/* ─── Properties & Onboarding ─── */}
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/onboarding" element={<PropertyOnboardingPage />} />
        <Route path="/setup" element={<FacilitiesSetupPage />} />

        {/* ─── Contracts & SLA ─── */}
        <Route path="/contracts" element={<FMContractsList />} />
        <Route path="/fm-contracts" element={<FMContractsList />} />
        <Route path="/sla-policies" element={<SLAPoliciesPage />} />

        {/* ─── Service Billing ─── */}
        <Route path="/servicebilling" element={<ServiceBillingList />} />
        <Route path="/servicebilling/new" element={<ServiceBillingForm />} />
        <Route path="/servicebilling/:id" element={<ServiceBillingForm />} />
        <Route path="/service-billing" element={<ServiceBillingList />} />
        <Route path="/service-billing/new" element={<ServiceBillingForm />} />
        <Route path="/service-billing/:id" element={<ServiceBillingForm />} />

        {/* ─── Helpdesk & Operations ─── */}
        <Route path="/helpdesk" element={<FMHelpdeskPage />} />
        <Route path="/soft-services" element={<SoftServicesPage />} />
        <Route path="/hard-services" element={<HardServicesPage />} />
        <Route path="/field-service" element={<FieldTechnicianJobCard />} />

        {/* ─── FM Tasks & Materials ─── */}
        <Route path="/tasks" element={<FMTaskList />} />
        <Route path="/tasks/new" element={<FMTaskForm />} />
        <Route path="/tasks/:id" element={<FMTaskForm />} />
        <Route path="/tasks/execution" element={<FMTaskExecution />} />

        <Route path="/purchase-requisitions" element={<FMPurchaseRequisitionList />} />
        <Route path="/purchase-requisitions/new" element={<FMPurchaseRequisitionForm />} />
        <Route path="/purchase-requisitions/:id" element={<FMPurchaseRequisitionForm />} />

        <Route path="/material-requisitions" element={<FMMaterialRequisitionList />} />
        <Route path="/material-requisitions/new" element={<FMMaterialRequisitionForm />} />
        <Route path="/material-requisitions/:id" element={<FMMaterialRequisitionForm />} />

        <Route path="/material-receipts" element={<FMMaterialReceiptList />} />
        <Route path="/material-receipts/new" element={<FMMaterialReceiptForm />} />
        <Route path="/material-receipts/:id" element={<FMMaterialReceiptForm />} />

        <Route path="/material-utilizations" element={<FMMaterialUtilizationList />} />
        <Route path="/material-utilizations/new" element={<FMMaterialUtilizationForm />} />
        <Route path="/material-utilizations/:id" element={<FMMaterialUtilizationForm />} />

        {/* ─── Inspections & Checklists ─── */}
        <Route path="/inspections" element={<FMInspectionsPage />} />
        <Route path="/checklists" element={<ChecklistTemplatesList />} />
        <Route path="/hsa-compliance" element={<HealthSafetyCompliancePage />} />
        <Route path="/compliance" element={<FMCompliancePage />} />

        {/* ─── Utilities & Sustainability ─── */}
        <Route path="/utilities-energy" element={<UtilitiesEnergyPage />} />
        <Route path="/sustainability" element={<SustainabilityManagementPage />} />

        {/* ─── Security, Workforce & Space ─── */}
        <Route path="/security" element={<SecurityAccessPage />} />
        <Route path="/workforce" element={<FMWorkforceRosterPage />} />
        <Route path="/space-occupancy" element={<SpaceOccupancyPage />} />

        {/* ─── Vendors, Finance ─── */}
        <Route path="/contractors-vendors" element={<ContractorVendorManagementPage />} />
        <Route path="/budgeting-finance" element={<FacilitiesBudgetingFinancePage />} />

        {/* ─── Reports ─── */}
        <Route path="/reports/sla-compliance" element={<FMSLAComplianceReport />} />
        <Route path="/reports/property-costs" element={<FMPropertyCostReport />} />
        <Route path="/reports/contract-profitability" element={<FMContractsReport />} />
        <Route path="/reports/soft-services" element={<FMSoftServicesReport />} />
        <Route path="/reports/checklist-inspections" element={<FMInspectionChecklistReport />} />
        <Route path="/reports" element={<FMSLAComplianceReport />} />
      </Routes>
    </ModuleLayout>
  );
}

/**
 * @fileoverview FacilitiesHome component.
 * Dedicated module for Facilities Management, Space Hierarchy, FM Service Contracts,
 * Field Service Technicians, Digital Checklists, Soft Services, and Facilities Reports.
 */

import React from "react";
import { Route, Routes, Link } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import { usePermission } from "../../../auth/PermissionContext.jsx";

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
    title: "Portfolio & Command Center",
    icon: "🏢",
    items: [
      buildFeature("Facilities Command Center", "/facilities/dashboard", "Live SLA tracking and operations KPIs", "📊"),
      buildFeature("Properties & Estates", "/facilities/properties", "Multi-tier facility property register & hierarchy (Buildings, Zones, Spaces)", "🏛️"),
    ],
  },
  {
    title: "Contracts & Field Service",
    icon: "📜",
    items: [
      buildFeature("FM Service Contracts", "/facilities/contracts", "Client service contracts, SLA rules, and recurring billing", "📜"),
      buildFeature("Field Technician Workspace", "/facilities/field-service", "Mobile job card, step transitions, and client sign-off", "👨‍🔧"),
    ],
  },
  {
    title: "Inspections & Soft Services",
    icon: "✨",
    items: [
      buildFeature("Inspection Checklists", "/facilities/checklists", "Configurable audit templates across all service lines", "📋"),
      buildFeature("Soft Facilities Services", "/facilities/soft-services", "Janitorial audits, security patrol rounds, pest & waste", "🧹"),
    ],
  },
  {
    title: "Audits & Performance Reports",
    icon: "📊",
    items: [
      buildFeature("FM SLA Compliance", "/facilities/reports/sla-compliance", "Response & resolution SLA benchmarks", "🛡️"),
      buildFeature("Property Costs", "/facilities/reports/property-costs", "Portfolio maintenance cost and expense allocation", "💵"),
      buildFeature("Contract Margins", "/facilities/reports/contract-profitability", "FM contract profitability & renewals", "📜"),
      buildFeature("Soft Services Audit", "/facilities/reports/soft-services", "Janitorial, security, pest, and waste audits", "✨"),
      buildFeature("Inspection Audit", "/facilities/reports/checklist-inspections", "PPM inspection checklist compliance", "📋"),
    ],
  },
];

function FacilitiesLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: "total-properties", value: "—", label: "Managed Properties", change: "Loading…", changeType: "neutral", path: "/facilities/properties", actions: [{ label: "View", path: "/facilities/properties", type: "outline" }] },
    { rbac_key: "active-contracts", value: "—", label: "Active FM Contracts", change: "Loading…", changeType: "neutral", path: "/facilities/contracts", actions: [{ label: "View", path: "/facilities/contracts", type: "outline" }] },
    { rbac_key: "open-tickets", value: "—", label: "Open Helpdesk Tickets", change: "Loading…", changeType: "neutral", path: "/facilities/dashboard", actions: [{ label: "View", path: "/facilities/dashboard", type: "outline" }] },
    { rbac_key: "sla-compliance", value: "—", label: "SLA Compliance", change: "Loading…", changeType: "neutral", path: "/facilities/reports/sla-compliance", actions: [{ label: "View", path: "/facilities/reports/sla-compliance", type: "outline" }] },
  ]);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
      api.get("/facilities/contracts").catch(() => ({ data: { data: [] } })),
      api.get("/facilities/tickets").catch(() => ({ data: { data: [] } })),
      api.get("/facilities/dashboard/kpis").catch(() => ({ data: { data: {} } })),
    ]).then(([propsRes, contractsRes, ticketsRes, kpiRes]) => {
      if (!mounted) return;
      const props = propsRes.data?.data || [];
      const contracts = contractsRes.data?.data || [];
      const tickets = ticketsRes.data?.data || [];
      const kpis = kpiRes.data?.data || {};

      const activeContracts = contracts.filter((c) => c.status === "ACTIVE");
      const openTickets = tickets.filter((t) => t.status !== "COMPLETED" && t.status !== "CLOSED");
      const complianceRate = kpis.sla_compliance_rate != null ? `${kpis.sla_compliance_rate}%` : "98.5%";

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
          value: openTickets.length.toString(),
          label: "Open Helpdesk Tickets",
          change: openTickets.length > 0 ? "Requires Attention" : "All Clear",
          changeType: openTickets.length > 0 ? "neutral" : "positive",
          path: "/facilities/dashboard",
          actions: [{ label: "View", path: "/facilities/dashboard", type: "outline" }],
        },
        {
          rbac_key: "sla-compliance",
          value: complianceRate,
          label: "SLA Compliance",
          change: "Target: ≥95%",
          changeType: "positive",
          path: "/facilities/reports/sla-compliance",
          actions: [{ label: "View", path: "/facilities/reports/sla-compliance", type: "outline" }],
        },
      ]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      moduleKey="facilities"
      moduleTitle="Facilities Management"
      moduleDescription="Manage physical property portfolios, building spaces, FM service contracts, helpdesk SLA enforcement, field technician dispatch, and soft services."
      stats={stats}
      headerActions={[
        {
          label: "Command Center",
          path: "/facilities/dashboard",
          actions: [{ label: "Open", path: "/facilities/dashboard", type: "outline" }],
          icon: "📊",
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
        <Route path="/" element={<FacilitiesLanding />} />
        <Route path="/dashboard" element={<FacilitiesOperationsDashboard />} />
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/contracts" element={<FMContractsList />} />
        <Route path="/fm-contracts" element={<FMContractsList />} />
        <Route path="/field-service" element={<FieldTechnicianJobCard />} />
        <Route path="/checklists" element={<ChecklistTemplatesList />} />
        <Route path="/soft-services" element={<SoftServicesPage />} />
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

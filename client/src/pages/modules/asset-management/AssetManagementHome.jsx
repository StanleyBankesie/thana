/**
 * @fileoverview AssetManagementHome component.
 * Fixed Asset Register, Depreciation Engine, Asset Transfers, Disposals, and Statutory Reports.
 */

import React from "react";
import { Route, Routes, Link } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import { usePermission } from "../../../auth/PermissionContext.jsx";

import AssetRegisterList from "./AssetRegisterList.jsx";
import AssetRegisterForm from "./AssetRegisterForm.jsx";
import AssetCategoriesPage from "./AssetCategoriesPage.jsx";
import DepreciationRunPage from "./DepreciationRunPage.jsx";
import AssetTransfersPage from "./AssetTransfersPage.jsx";
import AssetDisposalsPage from "./AssetDisposalsPage.jsx";
import AssetRevaluationPage from "./AssetRevaluationPage.jsx";
import AssetSetupPage from "./AssetSetupPage.jsx";
import FixedAssetScheduleReport from "./FixedAssetScheduleReport.jsx";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const featureKey = `assets:${path.split("/").pop()}`;
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

export const assetSections = [
  {
    title: "Asset Register & Master Data",
    icon: "🏛️",
    items: [
      buildFeature("Fixed Asset Register", "/assets/register", "Complete list of capitalized assets, tags, serials, and NBV", "📋"),
      buildFeature("Asset Categories", "/assets/categories", "Configure asset classes, depreciation methods, and GL accounts", "🏷️"),
      buildFeature("Master Setup & Tagging Rules", "/assets/setup", "Configure tagging nomenclature rules, facilities & sites, and manufacturer brands", "⚙️"),
    ],
  },
  {
    title: "Financial Depreciation & General Ledger",
    icon: "🧮",
    items: [
      buildFeature("Asset Depreciation Engine", "/assets/depreciation", "Execute periodic (annual, half-yearly, quarterly, monthly) depreciation runs and post GL Journal Vouchers", "⚡"),
      buildFeature("Fixed Asset Schedule Report", "/assets/reports/schedule", "Statutory IFRS/GAAP fixed asset movement schedule & audit trail", "📊"),
    ],
  },
  {
    title: "Custody & Lifecycle Movements",
    icon: "🔄",
    items: [
      buildFeature("Asset Value Adjustments", "/assets/revaluations", "Manage upward revaluation surplus, impairment losses, and book value adjustments", "📈"),
      buildFeature("Asset Transfers", "/assets/transfers", "Track custody, facility property, space, and branch movements", "🚚"),
      buildFeature("Asset Disposals", "/assets/disposals", "Process asset sales, write-offs, scrap, and gain/loss on disposal", "🗑️"),
    ],
  },
];

function AssetLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: "total-assets", value: "—", label: "Active Assets", change: "Loading…", changeType: "neutral", path: "/assets/register", actions: [{ label: "View", path: "/assets/register", type: "outline" }] },
    { rbac_key: "gross-cost", value: "—", label: "Gross Asset Cost", change: "Loading…", changeType: "neutral", path: "/assets/register", actions: [{ label: "View", path: "/assets/register", type: "outline" }] },
    { rbac_key: "accum-dep", value: "—", label: "Accumulated Depreciation", change: "Loading…", changeType: "neutral", path: "/assets/depreciation", actions: [{ label: "View", path: "/assets/depreciation", type: "outline" }] },
    { rbac_key: "total-nbv", value: "—", label: "Net Book Value (NBV)", change: "Loading…", changeType: "neutral", path: "/assets/reports/schedule", actions: [{ label: "View", path: "/assets/reports/schedule", type: "outline" }] },
  ]);

  React.useEffect(() => {
    let mounted = true;
    api.get("/assets/stats").then((res) => {
      if (!mounted) return;
      const s = res.data?.stats || {};
      setStats([
        {
          rbac_key: "total-assets",
          value: String(s.active_count ?? s.total_assets ?? 0),
          label: "Active Capitalized Assets",
          change: `${s.total_assets ?? 0} total registered`,
          changeType: "positive",
          path: "/assets/register",
          actions: [{ label: "View", path: "/assets/register", type: "outline" }],
        },
        {
          rbac_key: "gross-cost",
          value: formatCurrency(s.total_cost ?? 0),
          label: "Gross Historical Cost",
          change: "Capitalized Assets",
          changeType: "positive",
          path: "/assets/register",
          actions: [{ label: "View", path: "/assets/register", type: "outline" }],
        },
        {
          rbac_key: "accum-dep",
          value: formatCurrency(s.total_accum_dep ?? 0),
          label: "Accumulated Depreciation",
          change: "Period Amortization",
          changeType: "neutral",
          path: "/assets/depreciation",
          actions: [{ label: "View", path: "/assets/depreciation", type: "outline" }],
        },
        {
          rbac_key: "total-nbv",
          value: formatCurrency(s.total_nbv ?? 0),
          label: "Portfolio Net Book Value (NBV)",
          change: "Balance Sheet Carrying Value",
          changeType: "positive",
          path: "/assets/reports/schedule",
          actions: [{ label: "View", path: "/assets/reports/schedule", type: "outline" }],
        },
      ]);
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      moduleKey="assets"
      moduleTitle="Fixed Asset Management"
      moduleDescription="Manage fixed asset registers, capitalization, straight-line & reducing balance depreciation, automated GL journal vouchers, transfers, and disposals."
      stats={stats}
      headerActions={[]}
      sections={assetSections}
      useSectionNavigation={true}
    />
  );
}

export default function AssetManagementHome() {
  return (
    <ModuleLayout sections={assetSections} moduleKey="assets">
      <Routes>
        <Route path="/" element={<AssetLanding />} />
        <Route path="/register" element={<AssetRegisterList />} />
        <Route path="/list" element={<AssetRegisterList />} />
        <Route path="/new" element={<AssetRegisterForm />} />
        <Route path="/categories" element={<AssetCategoriesPage />} />
        <Route path="/depreciation" element={<DepreciationRunPage />} />
        <Route path="/transfers" element={<AssetTransfersPage />} />
        <Route path="/disposals" element={<AssetDisposalsPage />} />
        <Route path="/revaluations" element={<AssetRevaluationPage />} />
        <Route path="/setup" element={<AssetSetupPage />} />
        <Route path="/reports/schedule" element={<FixedAssetScheduleReport />} />
        <Route path="/reports" element={<FixedAssetScheduleReport />} />
        <Route path="/:id" element={<AssetRegisterForm />} />
      </Routes>
    </ModuleLayout>
  );
}

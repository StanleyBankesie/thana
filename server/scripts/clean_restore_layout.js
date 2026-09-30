import fs from 'fs';

const content = `import React, { useEffect, useState } from "react";
import { Link, Route, Routes, Navigate } from "react-router-dom";
import api from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import TransportDashboard from "./dashboard/TransportDashboard.jsx";
import TransportRequests from "./requests/TransportRequests.jsx";
import TransportRequestForm from "./requests/TransportRequestForm.jsx";
import VehiclesList from "./vehicles/VehiclesList.jsx";
import VehicleForm from "./vehicles/VehicleForm.jsx";
import TripsList from "./trips/TripsList.jsx";
import TripReturnList from "./trips/TripReturnList.jsx";
import TripHistoryReport from "./reports/TripHistoryReport.jsx";
import TripForm from "./trips/TripForm.jsx";
import TripTrackingPage from "./trips/TripTrackingPage.jsx";
import DriversList from "./drivers/DriversList.jsx";
import DriverForm from "./drivers/DriverForm.jsx";
import FuelLogsList from "./fuel/FuelLogsList.jsx";
import FuelLogForm from "./fuel/FuelLogForm.jsx";
import BillingList from "./billing/BillingList.jsx";
import BillingForm from "./billing/BillingForm.jsx";
import RoutesList from "./routes/RoutesList.jsx";
import RouteForm from "./routes/RouteForm.jsx";
import InspectionsList from "./inspections/InspectionsList.jsx";
import InspectionForm from "./inspections/InspectionForm.jsx";
import MaintenanceList from "./maintenance/MaintenanceList.jsx";
import MaintenanceForm from "./maintenance/MaintenanceForm.jsx";
import TransportSettings from "./settings/TransportSettings.jsx";
import TransportReports from "./reports/TransportReports.jsx";
import TransportIncomeList from "./income/TransportIncomeList.jsx";
import TransportExpenseList from "./expenses/TransportExpenseList.jsx";
import FuelExpenseList from "./fuel-expenses/FuelExpenseList.jsx";
import FuelBillsList from "./fuel-bills/FuelBillsList.jsx";
import FuelBillForm from "./fuel-bills/FuelBillForm.jsx";

const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  const hasPermission = canPerformAction(featureKey, action);

  if (!hasPermission) return null;

  const baseClasses =
    type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";

  return (
    <Link to={path} className={baseClasses}>
      {label}
    </Link>
  );
};

function TransportLanding() {
  const [stats, setStats] = useState(null);
  const [now, setNow] = useState(new Date());
  const { token } = useAuth();

  useEffect(() => {
    let cancelled = false;
    api.get("/transport/dashboard")
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setStats(res.data.data);
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (n) =>
    \`GH₵\${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}\`;

  const dashboardStats = [
    {
      rbac_key: "active-trips",
      icon: "🚚",
      value: String(stats?.activeTrips || 0),
      label: "Active Trips",
      path: "/transport/trips",
    },
    {
      rbac_key: "total-vehicles",
      icon: "🚛",
      value: String(stats?.totalVehicles || 0),
      label: "Total Vehicles",
      path: "/transport/vehicles",
    },
    {
      rbac_key: "total-drivers",
      icon: "🧑‍✈️",
      value: String(stats?.totalDrivers || 0),
      label: "Total Drivers",
      path: "/transport/drivers",
    },
    {
      rbac_key: "total-fuel-cost",
      icon: "⛽",
      value: fmt(stats?.totalFuelCost || 0),
      label: "Total Fuel Cost",
      path: "/transport/fuel",
    },
  ];

  const sections = [
    {
      title: "Operations",
      items: [
        { 
          title: "Transport Requests", 
          path: "/transport/requests", 
          feature_key: "requests", 
          description: "Manage internal and external transport requests",
          icon: "📋",
          actions: [
            <ActionButton key="view" label="View" path="/transport/requests" type="outline" featureKey="transport:requests" action="view" />,
            <ActionButton key="new" label="New" path="/transport/requests/new" type="primary" featureKey="transport:requests" action="create" />
          ]
        },
        { 
          title: "Trips & Dispatch", 
          path: "/transport/trips", 
          feature_key: "trips", 
          description: "Dispatch vehicles and track live trips",
          icon: "🗺️",
          actions: [
            <ActionButton key="view" label="View" path="/transport/trips" type="outline" featureKey="transport:trips" action="view" />,
            <ActionButton key="new" label="New" path="/transport/trips/new" type="primary" featureKey="transport:trips" action="create" />
          ]
        },
        { 
          title: "Trip & Dispatch Returns", 
          path: "/transport/trip-returns", 
          feature_key: "trips", 
          description: "Confirm returning trips and log vehicle metrics",
          icon: "🔙",
          actions: [
            <ActionButton key="view" label="Manage Returns" path="/transport/trip-returns" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "Trip History & Tracking", 
          path: "/transport/reports/trip-history", 
          feature_key: "trips", 
          description: "Detailed history logs and tracking of fleet trips",
          icon: "📜",
          actions: [
            <ActionButton key="view" label="View Report" path="/transport/reports/trip-history" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "GPS Tracking", 
          path: "/transport/trips", 
          feature_key: "tracking", 
          description: "Monitor live vehicle locations via GPS",
          icon: "📍",
          actions: [
            <ActionButton key="view" label="View Map" path="/transport/trips" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "Routes", 
          path: "/transport/routes", 
          feature_key: "routes", 
          description: "Manage standard transport routes and distances",
          icon: "🛣️",
          actions: [
            <ActionButton key="view" label="View" path="/transport/routes" type="outline" featureKey="transport:routes" action="view" />,
            <ActionButton key="new" label="New" path="/transport/routes/new" type="primary" featureKey="transport:routes" action="create" />
          ]
        },
      ],
    },
    {
      title: "Fleet Management",
      items: [
        { 
          title: "Inspections", 
          path: "/transport/inspections", 
          feature_key: "inspections", 
          description: "Record pre-trip and post-trip vehicle inspections",
          icon: "📋",
          actions: [
            <ActionButton key="view" label="View" path="/transport/inspections" type="outline" featureKey="transport:inspections" action="view" />,
            <ActionButton key="new" label="New" path="/transport/inspections/new" type="primary" featureKey="transport:inspections" action="create" />
          ]
        },
      ],
    },
    {
      title: "Costing & Billing",
      items: [
        { 
          title: "Refuelling", 
          path: "/transport/fuel", 
          feature_key: "fuel", 
          description: "Log all information of fuel purchased and refuelling events",
          icon: "⛽",
          actions: [
            <ActionButton key="view" label="View" path="/transport/fuel" type="outline" featureKey="transport:fuel" action="view" />,
            <ActionButton key="new" label="New" path="/transport/fuel/new" type="primary" featureKey="transport:fuel" action="create" />
          ]
        },
        { 
          title: "Billing", 
          path: "/transport/billing", 
          feature_key: "billing", 
          description: "Manage transport invoices and billing",
          icon: "🧾",
          actions: [
            <ActionButton key="view" label="View" path="/transport/billing" type="outline" featureKey="transport:billing" action="view" />
          ]
        },
        { 
          title: "Transportation Income", 
          path: "/transport/income", 
          feature_key: "income", 
          description: "Manage income records",
          icon: "💵",
          actions: [
            <ActionButton key="view" label="View" path="/transport/income" type="outline" featureKey="transport:income" action="view" />
          ]
        },
        { 
          title: "Transportation Expenses", 
          path: "/transport/expenses", 
          feature_key: "expenses", 
          description: "Manage expense records",
          icon: "💸",
          actions: [
            <ActionButton key="view" label="View" path="/transport/expenses" type="outline" featureKey="transport:expenses" action="view" />
          ]
        },
      ],
    },
    {
      title: "Configuration",
      items: [
        { 
          title: "Settings", 
          path: "/transport/settings", 
          feature_key: "settings", 
          description: "Configure pricing, types, and module behaviors",
          icon: "⚙️",
          actions: [
            <ActionButton key="view" label="Manage" path="/transport/settings" type="primary" featureKey="transport:settings" action="view" />
          ]
        },
      ],
    }
  ];

  return (
    <ModuleDashboard
      moduleKey="transport"
      title="Transport Management"
      stats={dashboardStats}
      sections={sections}
      now={now}
    />
  );
}

export default function TransportLayout() {
  return (
    <Routes>
      <Route path="/" element={<TransportLanding />} />
      <Route path="dashboard" element={<TransportDashboard />} />
      <Route path="requests" element={<TransportRequests />} />
      <Route path="requests/new" element={<TransportRequestForm />} />
      <Route path="requests/:id" element={<TransportRequestForm />} />
      <Route path="vehicles" element={<VehiclesList />} />
      <Route path="vehicles/new" element={<VehicleForm />} />
      <Route path="vehicles/:id" element={<VehicleForm />} />
      <Route path="drivers" element={<DriversList />} />
      <Route path="drivers/new" element={<DriverForm />} />
      <Route path="drivers/:id" element={<DriverForm />} />
      <Route path="trips" element={<TripsList />} />
      <Route path="trip-returns" element={<TripReturnList />} />
      <Route path="reports/trip-history" element={<TripHistoryReport />} />
      <Route path="trips/new" element={<TripForm />} />
      <Route path="trips/:id" element={<TripForm />} />
      <Route path="tracking/:id" element={<TripTrackingPage />} />
      <Route path="tracking" element={<Navigate to="/transport/trips" replace />} />
      <Route path="fuel" element={<FuelLogsList />} />
      <Route path="fuel/new" element={<FuelLogForm />} />
      <Route path="fuel/:id" element={<FuelLogForm />} />
      <Route path="fuel-expenses" element={<FuelExpenseList />} />
      <Route path="fuel-bills" element={<FuelBillsList />} />
      <Route path="fuel-bills/new" element={<FuelBillForm />} />
      <Route path="fuel-bills/:id" element={<FuelBillForm />} />
      <Route path="billing" element={<BillingList />} />
      <Route path="billing/new" element={<BillingForm />} />
      <Route path="billing/:id" element={<BillingForm />} />
      <Route path="routes" element={<RoutesList />} />
      <Route path="routes/new" element={<RouteForm />} />
      <Route path="routes/:id" element={<RouteForm />} />
      <Route path="inspections" element={<InspectionsList />} />
      <Route path="inspections/new" element={<InspectionForm />} />
      <Route path="inspections/:id" element={<InspectionForm />} />
      <Route path="maintenance" element={<MaintenanceList />} />
      <Route path="maintenance/new" element={<MaintenanceForm />} />
      <Route path="maintenance/:id" element={<MaintenanceForm />} />
      <Route path="settings" element={<TransportSettings />} />
      <Route path="reports" element={<TransportReports />} />
      <Route path="income" element={<TransportIncomeList />} />
      <Route path="expenses" element={<TransportExpenseList />} />
    </Routes>
  );
}
`;

fs.writeFileSync('client/src/pages/modules/transport/TransportLayout.jsx', content);
console.log('Restored TransportLayout.jsx cleanly!');

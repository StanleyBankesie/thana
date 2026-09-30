/**
 * @fileoverview ServiceManagementHome component.
 * Provides functionality for ServiceManagementHome.
 */

import React from "react";
import { Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";

import CustomerServiceRequestsList from "./service-requests/CustomerServiceRequestsList.jsx";
import SupplierServiceRequestsList from "./service-requests/SupplierServiceRequestsList.jsx";
import CustomerServiceRequestForm from "./service-requests/CustomerServiceRequestForm.jsx";
import SupplierServiceRequestForm from "./service-requests/SupplierServiceRequestForm.jsx";
import ServiceOrderForm from "./service-orders/ServiceOrderForm.jsx";
import ServiceOrdersList from "./service-orders/ServiceOrdersList.jsx";
import ServiceExecutionForm from "./service-execution/ServiceExecutionForm.jsx";
import ServiceExecutionsList from "./service-execution/ServiceExecutionsList.jsx";
import ServiceExecutionView from "./service-execution/ServiceExecutionView.jsx";
import ServiceBillForm from "./service-bills/ServiceBillForm.jsx";
import ServiceBillsList from "./service-bills/ServiceBillsList.jsx";
import ServiceConfirmationsList from "./service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "./service-confirmations/ServiceConfirmationForm.jsx";
import ServiceInvoiceList from "./service-invoices/ServiceInvoiceList.jsx";
import ServiceInvoiceForm from "./service-invoices/ServiceInvoiceForm.jsx";
import ServiceParametersPage from "./setup/ServiceParametersPage.jsx";
import ServiceReportsPage from "./reports/ServiceReportsPage.jsx";

export const serviceManagementSections = [
  {
    title: "Service Requests",
    items: [
      {
        title: "Service Requests",
        desc: "Manage customer service requests.",
        path: "/service-management/customer-service-requests",
        permission: "SERVICE.MANAGE",
        icon: "📋",
        actions: [
          { label: "View", path: "/service-management/customer-service-requests", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/customer-service-requests/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Service Invoices",
        description: "Issue invoices to customers for completed services.",
        path: "/service-management/service-invoices",
        icon: "🧾",
        actions: [
          { label: "View", path: "/service-management/service-invoices", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/service-invoices/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Supplier Service Requests",
        desc: "Manage vendor service requests.",
        path: "/service-management/supplier-service-requests",
        permission: "SERVICE.MANAGE",
        icon: "📝",
        actions: [
          { label: "View", path: "/service-management/supplier-service-requests", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/supplier-service-requests/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
    ],
  },
  {
    title: "Service Orders & Execution",
    items: [
      {
        title: "Service Orders",
        desc: "View and process service orders.",
        path: "/service-management/service-orders",
        permission: "SERVICE.MANAGE",
        icon: "🛠️",
        actions: [
          { label: "View", path: "/service-management/service-orders", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/service-orders/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Service Executions",
        desc: "Track execution of service orders.",
        path: "/service-management/service-executions",
        permission: "SERVICE.MANAGE",
        icon: "⚙️",
        actions: [
          { label: "View", path: "/service-management/service-executions", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Confirmations",
        desc: "Review and approve service confirmations.",
        path: "/service-management/service-confirmations",
        permission: "SERVICE.MANAGE",
        icon: "✅",
        actions: [
          { label: "View", path: "/service-management/service-confirmations", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Bills",
        desc: "Manage supplier service bills.",
        path: "/service-management/service-bills",
        permission: "SERVICE.MANAGE",
        icon: "🧾",
        actions: [
          { label: "View", path: "/service-management/service-bills", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
    ],
  },
  {
    title: "Visitors Log",
    items: [
      {
        title: "Visitors Log",
        description: "Record and manage site visitors",
        path: "/service-management/visitors-log",
        icon: "📇",
        actions: [
          { label: "View", path: "/service-management/visitors-log", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      }
    ],
  },
  {
    title: "Reports & Parameters",
    items: [
      {
        title: "Service Delivery Report",
        description: "Detailed report of completed service deliveries",
        path: "/service-management/reports/delivery",
        icon: "📊",
        actions: [
          { label: "View Report", path: "/service-management/reports/delivery", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "SLA Performance Report",
        description: "Track service level agreement compliance",
        path: "/service-management/reports/sla",
        icon: "📈",
        actions: [
          { label: "View Report", path: "/service-management/reports/sla", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Technician Utilization",
        description: "Analyze technician workloads and efficiency",
        path: "/service-management/reports/technician-utilization",
        icon: "👨‍🔧",
        actions: [
          { label: "View Report", path: "/service-management/reports/technician-utilization", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Cost Analysis",
        description: "Cost breakdown of service operations",
        path: "/service-management/reports/service-cost-analysis",
        icon: "💰",
        actions: [
          { label: "View Report", path: "/service-management/reports/service-cost-analysis", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Repeat Requests Analysis",
        description: "Identify recurring service issues",
        path: "/service-management/reports/repeat-requests",
        icon: "🔄",
        actions: [
          { label: "View Report", path: "/service-management/reports/repeat-requests", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Type Performance",
        description: "Performance metrics by service type",
        path: "/service-management/reports/service-type-performance",
        icon: "📊",
        actions: [
          { label: "View Report", path: "/service-management/reports/service-type-performance", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Visitors Log Report",
        description: "Summary of visitor activity and statistics",
        path: "/service-management/reports/visitors-log",
        icon: "📋",
        actions: [
          { label: "View Report", path: "/service-management/reports/visitors-log", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Parameters",
        description: "Configure SLAs, categories, and service settings",
        path: "/service-management/setup/parameters",
        icon: "⚙️",
        actions: [
          { label: "Manage", path: "/service-management/setup/parameters", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      }
    ],
  },
];

function ServiceManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "service-requests",
      value: "—",
      label: "Customer Service Requests",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/customer-service-requests",
    },
    {
      rbac_key: "open-orders",
      value: "—",
      label: "Open Service Orders",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-orders",
    },
    {
      rbac_key: "executions",
      value: "—",
      label: "Service Executions",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-executions",
    },
    {
      rbac_key: "confirmations",
      value: "—",
      label: "Confirmations",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-confirmations",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/service-management/dashboard-stats");
        const c = resp?.data?.data;
        if (c && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(c.open_requests ?? "—"),
              change: `${c.mtd_requests ?? 0} this month`,
              changeType: c.mtd_requests > 0 ? "positive" : "neutral",
            };
            next[1] = {
              ...next[1],
              value: String(c.open_orders ?? "—"),
              change: `${c.mtd_orders ?? 0} this month`,
              changeType: c.mtd_orders > 0 ? "positive" : "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(c.ytd_executions ?? "—"),
              change: `${c.mtd_executions ?? 0} this month`,
              changeType: c.ytd_executions > 0 ? "positive" : "neutral",
            };
            next[3] = {
              ...next[3],
              value: String(c.ytd_confirmations ?? "—"),
              change: `${c.mtd_confirmations ?? 0} this month`,
              changeType: c.ytd_confirmations > 0 ? "positive" : "neutral",
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
      title="Service Management"
      description="End-to-end service request, confirmation, and billing"
      stats={stats}
      moduleKey="service-management"
      useSectionNavigation={true}
      headerActions={[
        {
          label: "Dashboard",
          path: "/service-management/dashboard",
          icon: "📊",
        },
      ]}
      sections={serviceManagementSections}
      features={serviceManagementFeatures}
    />
  );
}

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceManagementHome() {
  return (
    <ModuleLayout
      sections={serviceManagementSections}
      moduleKey="service-management"
    >
      <Routes>
        <Route path="/" element={<ServiceManagementLanding />} />
        <Route
          path="dashboard"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./ServiceDashboardPage.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="customer-service-requests"
          element={<CustomerServiceRequestsList />}
        />
        <Route
          path="customer-service-requests/new"
          element={<CustomerServiceRequestForm />}
        />
        <Route
          path="customer-service-requests/:id"
          element={<CustomerServiceRequestForm />}
        />
        <Route
          path="supplier-service-requests"
          element={<SupplierServiceRequestsList />}
        />
        <Route
          path="supplier-service-requests/new"
          element={<SupplierServiceRequestForm />}
        />
        <Route
          path="supplier-service-requests/:id"
          element={<SupplierServiceRequestForm />}
        />
        <Route path="service-orders" element={<ServiceOrdersList />} />
        <Route path="service-orders/new" element={<ServiceOrderForm />} />
        <Route path="service-orders/:id" element={<ServiceOrderForm />} />
        <Route path="service-executions" element={<ServiceExecutionsList />} />
        <Route
          path="service-executions/:id"
          element={<ServiceExecutionView />}
        />
        <Route path="service-execution" element={<ServiceExecutionForm />} />
        <Route
          path="service-confirmation"
          element={<ServiceConfirmationsList />}
        />
        <Route
          path="service-confirmation/new"
          element={<ServiceConfirmationForm />}
        />
        <Route
          path="service-confirmation/:id"
          element={<ServiceConfirmationForm />}
        />
        <Route path="service-invoices" element={<ServiceInvoiceList />} />
        <Route path="service-invoices/new" element={<ServiceInvoiceForm />} />
        <Route path="service-invoices/:id" element={<ServiceInvoiceForm />} />
        <Route path="service-bills" element={<ServiceBillsList />} />
        <Route path="service-bills/new" element={<ServiceBillForm />} />
        <Route path="service-bills/:id" element={<ServiceBillForm />} />
        <Route path="setup/parameters" element={<ServiceParametersPage />} />
        <Route
          path="visitors-log"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./visitors-log/VisitorsLogList.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="visitors-log/new"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./visitors-log/VisitorLogForm.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="visitors-log/:id/edit"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./visitors-log/VisitorLogForm.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route path="reports" element={<ServiceReportsPage />} />
        <Route
          path="reports/service-request-summary"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/ServiceRequestSummaryReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/service-order-status"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/ServiceOrderStatusReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/execution-performance"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () =>
                    import("./reports/ServiceExecutionPerformanceReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/sla"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./reports/SLAComplianceReport.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/service-revenue"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./reports/ServiceRevenueReport.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/outstanding-bills"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/OutstandingServiceBillsReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/service-confirmation"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/ServiceConfirmationReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/technician-utilization"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/TechnicianUtilizationReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/service-cost-analysis"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/ServiceCostAnalysisReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/repeat-requests"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/RepeatServiceRequestReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/service-type-performance"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/ServiceTypePerformanceReport.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="reports/visitors-log"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./reports/VisitorsLogReport.jsx")),
              )}
            </React.Suspense>
          }
        />
      </Routes>
    </ModuleLayout>
  );
}

export const serviceManagementFeatures = [
  {
    module_key: "service-management",
    label: "Customer Service Requests",
    path: "/service-management/customer-service-requests",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Supplier Service Requests",
    path: "/service-management/supplier-service-requests",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Orders",
    path: "/service-management/service-orders",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Execution",
    path: "/service-management/service-executions",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Confirmation",
    path: "/service-management/service-confirmation",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Bills",
    path: "/service-management/service-bills",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Setup",
    path: "/service-management/setup",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Visitors Log Book",
    path: "/service-management/visitors-log",
    type: "feature",
  },
];

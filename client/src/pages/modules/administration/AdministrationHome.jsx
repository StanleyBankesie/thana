/**
 * @fileoverview AdministrationHome component.
 * Provides functionality for AdministrationHome.
 */

import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";
import UserList from "./users/UserList.jsx";
import UserForm from "./users/UserForm.jsx";
import WorkflowList from "./workflows/WorkflowList.jsx";
import WorkflowForm from "./workflows/WorkflowForm.jsx";
import MyApprovals from "./workflows/MyApprovals.jsx";
import ApprovedDocuments from "./workflows/ApprovedDocuments.jsx";
import DocumentReview from "./workflows/DocumentReview.jsx";
import SystemLogBookPage from "./reports/SystemLogBookPage.jsx";
import UserLoginActivityReportPage from "./reports/UserLoginActivityReportPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import DiagnosticsPage from "./DiagnosticsPage.jsx";
import DocumentTemplatesPage from "./templates/DocumentTemplatesPage.jsx";
import RoleManagement from "./access-control/RoleManagementNew.jsx";
import UserOverrides from "./access-control/UserOverrides.jsx";
import ExceptionalPermissionsList from "./access-control/ExceptionalPermissionsList.jsx";
import UserPermissions from "./access-control/UserPermissionsNew.jsx";
import DashboardPermissions from "../../../pages/admin/DashboardPermissions.jsx";
import NotificationSettings from "./notifications/NotificationSettings.jsx";
import AdminAnalytics from "../business-intelligence/AdminAnalytics.jsx";

export const administrationSections = [
  {
    icon: "🖥️",
    title: "System Health & Settings",
    badge: "Core",
    items: [
      {
        title: "Settings",
        description: "Push notifications and document templates",
        path: "/administration/settings",
        
        icon: "⚙️",
        actions: [
          { label: "View", path: "/administration/settings",
        actions: [
          { label: "View", path: "/administration/settings", type: "outline" }
        ], type: "outline" }
        ],
      },
      {
        title: "Diagnostics",
        description: "Health checks, database, and system diagnostics",
        path: "/administration/diagnostics",
        
        icon: "🩺",
        actions: [
          { label: "View", path: "/administration/diagnostics",
        actions: [
          { label: "View", path: "/administration/diagnostics", type: "outline" }
        ], type: "outline" }
        ],
      },
    ],
  },
  {
    icon: "🔒",
    title: "User Management & Access Control",
    badge: "Security",
    items: [
      {
        title: "User Accounts",
        description: "Add, edit, or deactivate system users",
        path: "/administration/users",
        
        icon: "👤",
        actions: [
          {
            label: "Add User",
            path: "/administration/users/new",
        actions: [
          { label: "View", path: "/administration/users/new", type: "outline" },
          { label: "New", path: "/administration/users/new/new", type: "primary" }
        ],
            type: "primary",
          },
        ],
      },
      {
        title: "Role Setup",
        description: "Manage system roles and feature permissions",
        path: "/administration/access/roles",
        
        icon: "🛡️",
        actions: [
          { label: "View", path: "/administration/users",
        actions: [
          { label: "View", path: "/administration/users", type: "outline" },
          { label: "New", path: "/administration/users/new", type: "primary" }
        ], type: "outline" },
          { label: "New", path: "/administration/users/new",
        actions: [
          { label: "View", path: "/administration/users/new", type: "outline" },
          { label: "New", path: "/administration/users/new/new", type: "primary" }
        ], type: "primary" }
        ],
      },
      {
        title: "User Permissions Matrix",
        description: "Configure direct feature permissions per user",
        path: "/administration/access/user-permissions",
        
        icon: "🔐",
        actions: [
          { label: "View", path: "/administration/access/user-permissions",
        actions: [
          { label: "View", path: "/administration/access/user-permissions", type: "outline" }
        ], type: "outline" }
        ],
      },
      {
        title: "Exceptional Permissions",
        description: "Review special permission overrides",
        path: "/administration/access/user-overrides",
        
        icon: "⭐",
        actions: [
          { label: "View", path: "/administration/access/user-overrides",
        actions: [
          { label: "View", path: "/administration/access/user-overrides", type: "outline" },
          { label: "New", path: "/administration/access/user-overrides/new", type: "primary" }
        ], type: "outline" },
          { label: "New", path: "/administration/access/user-overrides/new",
        actions: [
          { label: "View", path: "/administration/access/user-overrides/new", type: "outline" },
          { label: "New", path: "/administration/access/user-overrides/new/new", type: "primary" }
        ], type: "primary" }
        ],
      },
      {
        title: "Dashboard Permissions",
        description: "Configure role and user access to dashboard analytics",
        path: "/administration/access/dashboard-permissions",
        
        icon: "📊",
        actions: [
          { label: "View", path: "/administration/access/dashboard-permissions",
        actions: [
          { label: "View", path: "/administration/access/dashboard-permissions", type: "outline" }
        ], type: "outline" }
        ],
      },
    ],
  },
  {
    icon: "🔄",
    title: "Workflow Engine",
    badge: "Automation",
    items: [
      {
        title: "My Approvals",
        description: "View and process pending approval requests",
        path: "/administration/workflows/approvals",
        
        icon: "✅",
        actions: [
          { label: "View", path: "/administration/workflows/approvals",
        actions: [
          { label: "View", path: "/administration/workflows/approvals", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new", type: "primary" }
        ], type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new",
        actions: [
          { label: "View", path: "/administration/workflows/approvals/new", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new/new", type: "primary" }
        ], type: "primary" }
        ],
      },
      {
        title: "Approved Documents",
        description: "History of fully approved workflows",
        path: "/administration/workflows/approved",
        
        icon: "📁",
        actions: [
          { label: "View", path: "/administration/workflows/approved",
        actions: [
          { label: "View", path: "/administration/workflows/approved", type: "outline" },
          { label: "New", path: "/administration/workflows/approved/new", type: "primary" }
        ], type: "outline" },
          { label: "New", path: "/administration/workflows/approved/new",
        actions: [
          { label: "View", path: "/administration/workflows/approved/new", type: "outline" },
          { label: "New", path: "/administration/workflows/approved/new/new", type: "primary" }
        ], type: "primary" }
        ],
      },
      {
        title: "Workflow Configurations",
        description: "Define multi-stage approval rules and triggers",
        path: "/administration/workflows",
        
        icon: "🔀",
        actions: [
          {
            label: "Create Workflow",
            path: "/administration/workflows/new",
        actions: [
          { label: "View", path: "/administration/workflows/new", type: "outline" },
          { label: "New", path: "/administration/workflows/new/new", type: "primary" }
        ],
            type: "primary",
          },
        ],
      },
    ],
  },
  {
    icon: "📜",
    title: "Audit & Logs",
    badge: "Compliance",
    items: [
      {
        title: "System Log Book",
        description: "Complete audit trail of system events",
        path: "/administration/reports/system-log-book",
        
        icon: "📖",
        actions: [
          { label: "View", path: "/administration/workflows",
        actions: [
          { label: "View", path: "/administration/workflows", type: "outline" },
          { label: "New", path: "/administration/workflows/new", type: "primary" }
        ], type: "outline" },
          { label: "New", path: "/administration/workflows/new",
        actions: [
          { label: "View", path: "/administration/workflows/new", type: "outline" },
          { label: "New", path: "/administration/workflows/new/new", type: "primary" }
        ], type: "primary" }
        ],
      },
      {
        title: "User Login Activity",
        description: "Track user login sessions and IP addresses",
        path: "/administration/reports/user-login-activity",
        
        icon: "📊",
        actions: [
          { label: "View", path: "/administration/reports/user-login-activity",
        actions: [
          { label: "View", path: "/administration/reports/user-login-activity", type: "outline" }
        ], type: "outline" }
        ],
      },
    ],
  },
];

function AdministrationLanding() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState([
    {
      rbac_key: "total-users",
      value: "—",
      label: "Total Users",
      change: "Loading…",
      changeType: "neutral",
      path: "/administration/users",
        actions: [
          { label: "View", path: "/administration/users", type: "outline" },
          { label: "New", path: "/administration/users/new", type: "primary" }
        ],
    },
    {
      rbac_key: "active-roles",
      value: "—",
      label: "Active Roles",
      change: "Loading…",
      changeType: "neutral",
      path: "/administration/access/roles",
        actions: [
          { label: "View", path: "/administration/access/roles", type: "outline" },
          { label: "New", path: "/administration/access/roles/new", type: "primary" }
        ],
    },
    {
      rbac_key: "pending-approvals",
      value: "—",
      label: "Pending Approvals",
      change: "Loading…",
      changeType: "neutral",
      path: "/administration/workflows/approvals",
        actions: [
          { label: "View", path: "/administration/workflows/approvals", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new", type: "primary" }
        ],
    },
  ]);

  const quickActions = [
    {
      label: "Settings",
      path: "/administration/settings",
        
      icon: "⚙️",
    },
    {
      label: "Diagnostics",
      path: "/administration/diagnostics",
        
      icon: "🩺",
    },
  ];

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/admin/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.usersCount ?? "—"),
              change: `${d.assignmentsCount ?? 0} with roles`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: String(d.rolesCount ?? "—"),
              change: "System roles",
              changeType: "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(d.pendingWorkflows ?? "—"),
              change:
                d.pendingWorkflows > 0 ? "Requires approval" : "All clear",
              changeType: d.pendingWorkflows > 0 ? "warning" : "positive",
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
      useSectionNavigation={true}
      title="Administration"
      description="System configuration and user management"
      headerActions={[
        { label: "Dashboard", path: "/administration/dashboard",
         icon: "📊" }
      ]}
      stats={stats}
      quickActions={quickActions}
      sections={administrationSections}
      features={administrationFeatures}
    />
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AdministrationHome() {
  return (
    <ModuleLayout sections={administrationSections} moduleKey="administration">
      <Routes>
        <Route path="/" element={<AdministrationLanding />} />
        <Route path="/dashboard" element={<div className="p-6"><AdminAnalytics /></div>} />
      <Route path="/users" element={<UserList />} />
      <Route path="/users/new" element={<UserForm />} />
      <Route path="/users/:id" element={<UserForm />} />
      <Route path="/workflows" element={<WorkflowList />} />
      <Route path="/workflows/new" element={<WorkflowForm />} />
      <Route path="/workflows/:id" element={<WorkflowForm />} />
      <Route path="/workflows/approvals" element={<MyApprovals />} />
      <Route path="/notifications" element={<NotificationSettings />} />
      <Route path="/workflows/approved" element={<ApprovedDocuments />} />
      <Route
        path="/workflows/approvals/:instanceId"
        element={<DocumentReview />}
      />

      <Route path="/reports/system-log-book" element={<SystemLogBookPage />} />
      <Route
        path="/reports/user-login-activity"
        element={<UserLoginActivityReportPage />}
      />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/diagnostics" element={<DiagnosticsPage />} />
      <Route path="/settings/templates" element={<DocumentTemplatesPage />} />
      <Route path="/access/roles" element={<RoleManagement />} />
      <Route path="/access/user-permissions" element={<UserPermissions />} />
      <Route
        path="/access/user-permissions/:id"
        element={<UserPermissions />}
      />
      <Route path="/access/dashboard-permissions" element={<DashboardPermissions />} />
      <Route path="/access/user-overrides" element={<UserOverrides />} />
      <Route
        path="/exceptional-permissions"
        element={<ExceptionalPermissionsList />}
      />
      </Routes>
    </ModuleLayout>
  );
}

export const administrationFeatures = [
  {
    module_key: "administration",
    label: "Role Setup",
    path: "/administration/access/roles",
        actions: [
          { label: "View", path: "/administration/access/roles", type: "outline" },
          { label: "New", path: "/administration/access/roles/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "User Permissions",
    path: "/administration/access/user-permissions",
        actions: [
          { label: "View", path: "/administration/access/user-permissions", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Exceptional Permissions",
    path: "/administration/access/user-overrides",
        actions: [
          { label: "View", path: "/administration/access/user-overrides", type: "outline" },
          { label: "New", path: "/administration/access/user-overrides/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Dashboard Permissions",
    path: "/administration/access/dashboard-permissions",
        actions: [
          { label: "View", path: "/administration/access/dashboard-permissions", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "User Management",
    path: "/administration/users",
        actions: [
          { label: "View", path: "/administration/users", type: "outline" },
          { label: "New", path: "/administration/users/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Settings",
    path: "/administration/settings",
        actions: [
          { label: "View", path: "/administration/settings", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Diagnostics",
    path: "/administration/diagnostics",
        actions: [
          { label: "View", path: "/administration/diagnostics", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Workflow Configuration",
    path: "/administration/workflows",
        actions: [
          { label: "View", path: "/administration/workflows", type: "outline" },
          { label: "New", path: "/administration/workflows/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Workflow Approvals",
    path: "/administration/workflows/approvals",
        actions: [
          { label: "View", path: "/administration/workflows/approvals", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Document Review",
    path: "/administration/workflows/approvals",
        actions: [
          { label: "View", path: "/administration/workflows/approvals", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "administration",
    label: "System Log Book Report",
    path: "/administration/reports/system-log-book",
        actions: [
          { label: "View", path: "/administration/reports/system-log-book", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "administration",
    label: "User Login Activity Report",
    path: "/administration/reports/user-login-activity",
        actions: [
          { label: "View", path: "/administration/reports/user-login-activity", type: "outline" }
        ],
    type: "dashboard",
  },
];

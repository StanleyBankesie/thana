/**
 * @fileoverview Sidebar component.
 * Provides the main navigation menu, filtering items based on module permissions.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePermission } from "../auth/PermissionContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";

/**
 * Sidebar component
 * Renders the left navigation menu containing all available modules and sub-pages.
 * Automatically filters links based on the active user's permissions.
 * 
 * @returns {JSX.Element} The rendered sidebar.
 */
export default function Sidebar() {
  const location = useLocation();
  const { canViewModule, canAccessPath, canAccessFeatureKey } = usePermission();
  const { user } = useAuth();
  const [rbacTick, setRbacTick] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const bump = () => setRbacTick((t) => t + 1);
    window.addEventListener("rbac:updated", bump);
    window.addEventListener("rbac:changed", bump);
    return () => {
      window.removeEventListener("rbac:updated", bump);
      window.removeEventListener("rbac:changed", bump);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (user?.companyIds?.[0]) {
      api.get(`/licenses/company/${user.companyIds[0]}`).then(res => {
        if (mounted && res.data) {
          if (!res.data.exists || res.data.status === 'EXPIRED' || res.data.status === 'INACTIVE' || res.data.status === 'SUSPENDED' || res.data.status === 'CANCELLED') {
            setIsExpired(true);
          }
        }
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [user]);

  let menuItems = [
    {
      key: "sales",
      label: "Sales Management",
      icon: "💰",
      path: "/sales",
      children: [
        {
          key: "create-invoice",
          label: "Create Invoice",
          path: "/sales/invoices/new",
        },
        {
          key: "view-invoices",
          label: "View Invoices",
          path: "/sales/invoices",
        },
        { key: "customer-list", label: "Customers", path: "/sales/customers" },
        { key: "sales-reports", label: "Reports", path: "/sales/reports" },
      ],
    },
    {
      key: "pos",
      label: "POS",
      icon: "🏪",
      path: "/pos",
      children: [
        { key: "sales-entry", label: "Sales Entry", path: "/pos/sales-entry" },
        {
          key: "day-management",
          label: "Day Management",
          path: "/pos/day-management",
        },
        {
          key: "cash-collection",
          label: "Cash Collection",
          path: "/pos/cash-collection",
        },
        { key: "pos-invoices", label: "POS Invoices", path: "/pos/invoices" },
        { key: "pos-reports", label: "Reports", path: "/pos/reports" },
      ],
    },
    {
      key: "inventory",
      label: "Inventory Management",
      icon: "📦",
      path: "/inventory",
      children: [
        {
          key: "stock-management",
          label: "Items Setup",
          path: "/inventory/items",
        },

        {
          key: "stock-adjustments",
          label: "Stock Adjustments",
          path: "/inventory/stock-adjustments",
        },
        {
          key: "stock-transfers",
          label: "Stock Transfers",
          path: "/inventory/stock-transfers",
        },
        {
          key: "item-batches",
          label: "Item Batches Tracking",
          path: "/inventory/batches",
        },
      ],
    },
    {
      key: "purchase",
      label: "Procurement",
      icon: "🛒",
      path: "/purchase",
      children: [
        {
          key: "purchase-orders",
          label: "Purchase Orders",
          path: "/purchase/orders",
        },
        {
          key: "supplier-management",
          label: "Suppliers",
          path: "/purchase/suppliers",
        },
        {
          key: "goods-receipt",
          label: "Goods Receipt",
          path: "/purchase/receipt",
        },
        {
          key: "purchase-returns",
          label: "Returns",
          path: "/purchase/returns",
        },
        {
          key: "purchase-setup",
          label: "Setup",
          path: "/purchase/setup",
        },
      ],
    },
    {
      key: "finance",
      label: "Finance",
      icon: "💳",
      path: "/finance",
      children: [
        {
          key: "chart-of-accounts",
          label: "Chart of Accounts",
          path: "/finance/accounts",
        },
        {
          key: "journal-entries",
          label: "Journal Entries",
          path: "/finance/journal",
        },
        {
          key: "trial-balance",
          label: "Trial Balance",
          path: "/finance/trial-balance",
        },
        {
          key: "financial-reports",
          label: "Financial Reports",
          path: "/finance/reports",
        },
      ],
    },
    {
      key: "administration",
      label: "System Admin",
      icon: "⚙️",
      path: "/administration",
      children: [
        {
          key: "user-management",
          label: "User Management",
          path: "/administration/users",
        },
        { key: "role-setup", label: "Role Setup", path: "/admin/roles" },
        {
          key: "company-setup",
          label: "Company Setup",
          path: "/administration/companies",
        },
        {
          key: "branch-setup",
          label: "Branch Setup",
          path: "/administration/branches",
        },
        {
          key: "user-permissions",
          label: "User Permissions",
          path: "/admin/user-permissions",
        },
      ],
    },
    {
      key: "business-intelligence",
      label: "Business Intelligence",
      icon: "📊",
      path: "/bi",
      children: [
        { key: "report-builder", label: "Report Builder", path: "/bi/reports" },
        {
          key: "data-visualization",
          label: "Data Visualization",
          path: "/bi/visualization",
        },
        { key: "custom-reports", label: "Custom Reports", path: "/bi/custom" },
      ],
    },
  ];

  if (isExpired || user?.licenseExpired) {
    menuItems = menuItems.filter((item) => item.key === "administration");
  }

  // Filter menu items based on module configuration AND RBAC rules
  const visibleMenuItems = menuItems.filter((item) =>
    canViewModule(item.key),
  );

  /**
   * Recursively renders a menu item and its children.
   * @param {Object} item - The menu item configuration.
   * @param {number} [level=0] - The nesting level of the item.
   * @returns {JSX.Element|null} The rendered menu item.
   */
  function renderMenuItem(item, level = 0) {
    const isActive = location.pathname.startsWith(item.path);
    const hasChildren = item.children && item.children.length > 0;

    // Filter children based on permissions
    const visibleChildren = hasChildren
      ? item.children.filter((child) => {
          if ((child.key === "company-setup" || child.key === "branch-setup") && Number(user?.id) !== 1) {
            return false;
          }
          if (child.key) {
            return canAccessFeatureKey(item.key, child.key);
          }
          return canAccessPath(child.path, "view");
        })
      : [];

    // Don't render item if no children are visible
    if (hasChildren && visibleChildren.length === 0) {
      return null;
    }

    return (
      <div key={item.key} className="mb-1">
        <Link
          to={item.path}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            isActive
              ? "bg-blue-100 text-blue-700 font-medium"
              : "hover:bg-slate-100 text-slate-700"
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span>{item.label}</span>
        </Link>

        {hasChildren && visibleChildren.length > 0 && (
          <div className="ml-6 mt-1 space-y-1">
            {visibleChildren.map((child) => (
              <Link
                key={child.key}
                to={child.path}
                className={`block px-3 py-1 rounded text-sm transition-colors ${
                  location.pathname === child.path
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "hover:bg-slate-50 text-slate-600"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Navigation</h2>
        <nav className="space-y-2">
          {visibleMenuItems.map((item) => renderMenuItem(item))}
        </nav>
      </div>
    </div>
  );
}

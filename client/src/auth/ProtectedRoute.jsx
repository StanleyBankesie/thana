/**
 * @fileoverview Protected route wrapper component.
 * Ensures that only authenticated users with correct permissions can access certain routes.
 */

import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext.jsx";
import { usePermission } from "./PermissionContext.jsx";

/**
 * ProtectedRoute component
 * Verifies user authentication and branch/module permissions before rendering children.
 * Redirects to /login or /select-branch if access is denied.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The protected component to render.
 * @returns {JSX.Element|null} The component or a redirect element.
 */
export default function ProtectedRoute({ children }) {
  const { token, initialized, user, scope, setScope } = useAuth();
  const { loading, canAccessPath } = usePermission();
  const location = useLocation();
  const allowedBranches = Array.isArray(user?.branchIds)
    ? user.branchIds.map(Number).filter((n) => Number.isFinite(n))
    : [];
  const currentBranch = Number(scope?.branchId);

  useEffect(() => {
    if (!initialized || !token) return;
    if (allowedBranches.length > 1) return;
    const single = allowedBranches[0];
    if (!Number.isFinite(single) || currentBranch === single) return;
    const companies = Array.isArray(user?.companyIds)
      ? user.companyIds.map(Number).filter((n) => Number.isFinite(n))
      : [];
    const companyId = companies.length === 1 ? companies[0] : scope?.companyId || 1;
    setScope((prev) => ({ ...prev, companyId, branchId: single }));
  }, [
    initialized,
    token,
    allowedBranches,
    currentBranch,
    user?.companyIds,
    scope?.companyId,
    setScope,
  ]);

  if (!initialized) return null;
  if (typeof loading !== "undefined" && loading) return null;
  if (!token)
    return <Navigate to="/login" replace state={{ from: location }} />;

  if (allowedBranches.length <= 1) {
    if (location.pathname === "/select-branch") {
      const last =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("last_path")
          : null;
      const target = last && last !== "/login" ? last : "/";
      return <Navigate to={target} replace />;
    }
  } else {
    if (location.pathname === "/select-branch") return children;
    if (!allowedBranches.length) return children;
    if (!allowedBranches.includes(currentBranch)) {
      return <Navigate to="/select-branch" replace />;
    }
  }
  const path = location.pathname;
  if (path === "/" || path === "/dashboard") return children;
  if (!canAccessPath(path)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Your current role does not have permission to view this page. If you believe this is a mistake, please contact your administrator.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => window.history.back()} 
            className="btn btn-primary w-full py-2.5"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return children;
}

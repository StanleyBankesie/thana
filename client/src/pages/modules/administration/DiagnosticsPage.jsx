/**
 * @fileoverview DiagnosticsPage component.
 * Provides functionality for DiagnosticsPage.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";

function severityClass(level) {
  if (level === "high") return "text-red-700 bg-red-50 border-red-200";
  if (level === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function errorStatus(err) {
  return Number(err?.response?.status || 0);
}

function statusDetail(err) {
  const status = errorStatus(err);
  if (status) return `status ${status}`;
  if (String(err?.code || "").trim()) return String(err.code).trim();
  return "no response";
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DiagnosticsPage() {
  const [running, setRunning] = React.useState(false);
  const [ranAt, setRanAt] = React.useState(null);
  const [issues, setIssues] = React.useState([]);
  const [summary, setSummary] = React.useState({
    health: "Not checked",
    permissions: "Not checked",
  });

  const runDiagnostics = React.useCallback(async () => {
    setRunning(true);
    try {
      const [healthRes, permRes] = await Promise.allSettled([
        api.get("/access/diagnostics/status"),
        api.get("/access/diagnostics/permissions"),
      ]);

      const nextIssues = [];
      const nextSummary = {
        health: "Unknown",
        permissions: "Unknown",
      };

      if (healthRes.status === "fulfilled") {
        const data = healthRes.value?.data || {};
        const healthy = data.ok === true && data.status === "healthy";
        nextSummary.health = healthy
          ? "Backend is healthy"
          : "Backend is degraded";
        if (!healthy) {
          nextIssues.push({
            level: "high",
            title: "Server health is degraded",
            message:
              "The API reported a degraded status. Users may see random failures or slow pages until backend services recover.",
          });
        }
        if (data?.checks?.database?.ok !== true) {
          nextIssues.push({
            level: "high",
            title: "Database connectivity issue",
            message:
              "The database check failed. Permission loading and most transactions will fail until the DB is reachable.",
          });
        }
        if (data?.checks?.rbac_tables?.ok !== true) {
          nextIssues.push({
            level: "high",
            title: "RBAC tables are not accessible",
            message:
              "Permission tables are unavailable or failing. Role/permission actions can fail until this is fixed.",
          });
        }
        if (data?.checks?.current_user_role?.ok !== true) {
          nextIssues.push({
            level: "medium",
            title: "Current user role issue",
            message:
              "Current user has no valid role assignment, so access checks may deny pages/actions.",
          });
        }
      } else {
        const status = errorStatus(healthRes.reason);
        nextSummary.health = "Health check failed";
        nextIssues.push({
          level: "high",
          title: "Health endpoint failed",
          message:
            status === 503
              ? "Diagnostics status returned 503. Backend is reachable but currently degraded/unavailable (often DB/downstream outage)."
              : `Could not complete diagnostics status check (${statusDetail(healthRes.reason)}). This can be backend downtime, proxy/network blockage, or service overload.`,
        });
      }

      if (permRes.status === "fulfilled") {
        const data = permRes.value?.data || {};
        const roleId = Number(data?.user?.role_id || 0);
        const moduleCount = Number(data?.counts?.modules || 0);
        const permCount = Number(data?.counts?.permissions || 0);
        nextSummary.permissions =
          roleId > 0
            ? `Role assigned (#${roleId}), ${moduleCount} modules, ${permCount} permission rows`
            : "No role assigned";

        if (!roleId) {
          nextIssues.push({
            level: "high",
            title: "User has no role assigned",
            message:
              "The current user does not have a role ID. Role-based access cannot work until a role is assigned.",
          });
        } else if (moduleCount === 0) {
          nextIssues.push({
            level: "high",
            title: "Role has no modules",
            message:
              "The assigned role has zero module mappings. The user may be blocked from most sections.",
          });
        } else if (permCount === 0) {
          nextIssues.push({
            level: "medium",
            title: "Role has no permission rows",
            message:
              "The role has modules but no permission entries. Some pages may still fail access checks or hide actions.",
          });
        }
      } else {
        const status = Number(permRes.reason?.response?.status || 0);
        if (status === 403) {
          nextSummary.permissions = "Permission diagnostics blocked";
          nextIssues.push({
            level: "medium",
            title: "Diagnostics endpoint is restricted",
            message:
              "Permission diagnostics is only available to super admins. Sign in as a super admin to inspect RBAC assignments.",
          });
        } else {
          nextSummary.permissions = "Permission diagnostics failed";
          nextIssues.push({
            level: "high",
            title: "Failed to load permission diagnostics",
            message:
              status === 503
                ? "Permission diagnostics returned status 503. RBAC check could not run because backend services are currently degraded."
                : `RBAC diagnostics request failed (${statusDetail(permRes.reason)}). This can indicate backend instability, route/proxy issues, or RBAC query/schema errors.`,
          });
        }
      }

      if (nextIssues.length === 0) {
        nextIssues.push({
          level: "low",
          title: "No critical issues detected",
          message:
            "Core service and permission checks passed. If users still report issues, investigate specific page-level permission mappings.",
        });
      }

      setSummary(nextSummary);
      setIssues(nextIssues);
      setRanAt(new Date());
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Diagnostics</h1>
          <p className="text-sm text-slate-600">
            Run checks and view issues in plain language.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn" style={{ padding: "8px 16px", background: "#6b7280", color: "white", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }}>
            ← Return to Menu
          </button>
          <button className="btn-primary" onClick={runDiagnostics} disabled={running}>
            {running ? "Running..." : "Run Diagnostics"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Service Health</div>
          <div className="font-semibold mt-1">{summary.health}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Permission System</div>
          <div className="font-semibold mt-1">{summary.permissions}</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Detected Issues</h2>
          <span className="text-xs text-slate-500">
            {ranAt ? `Last run: ${ranAt.toLocaleString()}` : "Not run yet"}
          </span>
        </div>
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="text-sm text-slate-500">
              Click <strong>Run Diagnostics</strong> to analyze the system.
            </div>
          ) : (
            issues.map((issue, idx) => (
              <div
                key={`${issue.title}-${idx}`}
                className={`border rounded p-3 ${severityClass(issue.level)}`}
              >
                <div className="font-semibold">{issue.title}</div>
                <div className="text-sm mt-1">{issue.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


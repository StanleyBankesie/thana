/**
 * @fileoverview UserOverrides component.
 * Provides functionality for UserOverrides.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function UserOverrides() {
  const navigate = useNavigate();
  const STANDARD_EXCEPTIONS = [
    { code: "SALES.DISCOUNT.ALLOW", label: "Permission to give discount" },
    { code: "WORKFLOW.APPROVAL.REVERSE", label: "Reversal of approval" },
    {
      code: "WORKFLOW.PENDING_APPROVAL.REVERSE",
      label: "Reversal of pending approval document to draft",
    },
    { code: "SALES.ORDER.CANCEL", label: "Sales Order Cancellations" },
    { code: "SALES.QUOTATION.CANCEL", label: "Sales Quotation Cancellation" },
    { code: "PURCHASE.ORDER.CANCEL", label: "Purchase Order Cancellations" },
    { code: "SALES.INVOICE.CANCEL", label: "Invoice Cancellations" },
    {
      code: "PURCHASE.DIRECT_PURCHASE.AUTO_PAYMENT",
      label: "Direct Purchase - Paid Upon Purchase (Immediate Settlement)",
    },
    {
      code: "SALES.INVOICE.AUTO_RECEIPT",
      label: "Sales Invoice - Paid Upon Invoicing (Immediate Settlement)",
    },
    {
      code: "SALES.CREDIT_LIMIT.OVERRIDE",
      label: "Sales Invoice - Override / Increase Customer Credit Limit for Today",
    },
    { code: "PURCHASE.GRN.REVERSE", label: "GRN Reversal" },
    { code: "PURCHASE.BILL.CANCEL", label: "Purchase Bill Cancellation" },
    { code: "MAINTENANCE.BILL.CANCEL", label: "Maintenance Bill Cancellation" },
    { code: "SERVICE.BILL.CANCEL", label: "Service Bill Cancellation" },
    {
      code: "PURCHASE.SHIPPING_ADVICE.CANCEL",
      label: "Cancel Shipping Advice",
    },
    {
      code: "PURCHASE.CLEARING_AT_PORT.CANCEL",
      label: "Cancel Clearing at Port",
    },
    {
      code: "INVENTORY.MATERIAL_REQUISITION.CANCEL",
      label: "Material Requisition Cancellations",
    },
    {
      code: "PURCHASE.GENERAL_REQUISITION.CANCEL",
      label: "General Requisition Cancellations",
    },
    {
      code: "PM.PR.CANCEL",
      label: "Project Purchase Requisition Cancellations",
    },
    {
      code: "POS.EXPECTED_CASH.VIEW",
      label: "POS Day Management - View Expected Cash",
    },
    {
      code: "POS.CASH_VARIANCE.VIEW",
      label: "POS Day Management - View Cash Variance",
    },
    {
      code: "DOCUMENT.EDIT_DATE",
      label: "Edit Document Date in Edit Mode (All Modules)",
    },
    {
      code: "TASK.REASSIGN",
      label: "Task Management - Reassign Task to Users",
    },
    {
      code: "TRANSPORT.TRIP.REASSIGN",
      label: "Trip Management - Reassign Trip to Drivers / Users",
    },
  ];
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [exPerms, setExPerms] = useState({});
  const [exSaving, setExSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items = res?.data?.data?.items || res?.data?.items || [];
        setUsers(items);
      } catch {}
    }
    loadUsers();
  }, []);

  async function loadContext(userId) {
    setSelectedUser(userId);
    setLoading(true);
    setError("");
    try {
      const userRes = await api.get(`/admin/users/${userId}`);
      const u = userRes?.data?.data?.item || userRes?.data?.item || null;
      setRole(u && u.role ? u.role : null);

      const roleId = Number(u?.role_id || u?.role?.id || 0);
      if (roleId) {
        try {
          const modsRes = await api
            .get(`/access/roles/${roleId}/modules`)
            .catch(() => ({ data: { modules: [] } }));
          const permsRes = await api
            .get(`/access/roles/${roleId}/permissions`)
            .catch(() => ({ data: { permissions: [] } }));
          const mods = modsRes?.data?.modules || [];
          setRoleModules(mods);
          const permList = permsRes?.data?.permissions || [];
          const byModule = {};
          for (const p of permList) {
            byModule[p.module_key] = {
              can_view: !!p.can_view,
              can_create: !!p.can_create,
              can_edit: !!p.can_edit,
              can_delete: !!p.can_delete,
            };
          }
          setRolePermissions(byModule);
        } catch {}
      } else {
        setRoleModules([]);
        setRolePermissions({});
      }
      // Load exceptional permissions for user
      try {
        const exRes = await api.get(
          `/admin/users/${userId}/exceptional-permissions`,
        );
        const items = Array.isArray(exRes?.data?.data?.items)
          ? exRes.data.data.items
          : Array.isArray(exRes?.data?.items)
            ? exRes.data.items
            : [];
        const map = {};
        for (const { permission_code, effect, is_active } of items) {
          const code = String(permission_code || "").toUpperCase();
          const active = Number(is_active) === 1;
          const allow = String(effect || "ALLOW").toUpperCase() === "ALLOW";
          map[code] = active && allow;
        }
        const init = {};
        for (const def of STANDARD_EXCEPTIONS) {
          init[def.code] = !!map[def.code];
        }
        setExPerms(init);
      } catch {}
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to load user context. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleExceptional(code) {
    const k = String(code || "");
    if (!k) return;
    setExPerms((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function saveExceptional() {
    if (!selectedUser) return;
    try {
      setExSaving(true);
      const permissions = STANDARD_EXCEPTIONS.map((e) => ({
        permission_code: e.code,
        effect: exPerms[e.code] ? "ALLOW" : "DENY",
        is_active: 1,
        exception_type: "STANDARD",
      }));
      await api.put(`/admin/users/${selectedUser}/exceptional-permissions`, {
        permissions,
      });
      toast.success("Exceptional permissions saved");
      navigate("/administration/exceptional-permissions", {
        state: {
          afterSave: {
            entity: "exceptional-permissions",
            id: Number(selectedUser) || null,
            ts: Date.now(),
          },
        },
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to save exceptional permissions",
      );
    } finally {
      setExSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Overrides</h1>
          <p className="text-sm text-slate-600">
            Set exceptional overrides per user
          </p>
        </div>
        <button onClick={() => window.history.back()} className="btn btn-secondary">
          Back to Menu
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">Select User</label>
            <select
              className="input"
              value={selectedUser || ""}
              onChange={(e) => loadContext(Number(e.target.value))}
            >
              <option value="">Choose user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
          {selectedUser ? (
            <div className="space-y-3 border rounded p-3">
              <div className="text-sm font-semibold">
                ERP Standard Exceptional Permissions
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {STANDARD_EXCEPTIONS.map((e) => (
                  <label
                    key={e.code}
                    className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={!!exPerms[e.code]}
                      onChange={() => toggleExceptional(e.code)}
                      disabled={exSaving}
                    />
                    <span>{e.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  className="btn btn-success"
                  onClick={saveExceptional}
                  disabled={exSaving}
                >
                  {exSaving ? "Saving..." : "Save Exceptional Permissions"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

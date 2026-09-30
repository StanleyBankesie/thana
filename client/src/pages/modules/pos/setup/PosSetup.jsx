/**
 * @fileoverview PosSetup component.
 * Provides functionality for PosSetup.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

const POS_TAX_SETTINGS_KEY = "pos_tax_settings";
const POS_PAYMENT_SETTINGS_KEY = "pos_payment_settings";
const POS_GENERAL_SETTINGS_KEY = "pos_general_settings";

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-md border ${
      active
        ? "bg-slate-100 border-slate-300 text-slate-900"
        : "bg-white border-slate-200 text-slate-600"
    }`}
  >
    {children}
  </button>
);

function SectionHeader({ emoji, title, subtitle }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {emoji} {title}
        </h1>
        {subtitle ? <p className="text-sm mt-1">{subtitle}</p> : null}
      </div>
      <div className="flex gap-2">
        <Link to="/pos?section=Reports" className="btn btn-secondary">
          Return to Menu
        </Link>
      </div>
    </div>
  );
}

function InfoBox({ title, children }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
      <div className="font-semibold text-blue-900 mb-1">{title}</div>
      <div className="text-blue-800">{children}</div>
    </div>
  );
}

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "Select..."}</option>
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TerminalsTab() {
  const { scope } = useAuth();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [warehouses, setWarehouses] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTerminal, setUserModalTerminal] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSaving, setUsersSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [assignedUserIds, setAssignedUserIds] = useState([]);
  const [assignedUsernamesById, setAssignedUsernamesById] = useState({});
  const [addUserId, setAddUserId] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    code: "AUTO",
    warehouse: "",
    warehouse_id: "",
    ip_address: "",
    active: true,
    enable_vfd: false,
    vfd_type: "generic",
    vfd_port: "9100",
  });

  function getNextTerminalCode() {
    const maxExisting = items.reduce((max, t) => {
      const match = String(t.code || "").match(/^T(\d{3})$/);
      if (!match) return max;
      const num = parseInt(match[1], 10);
      if (!Number.isFinite(num)) return max;
      return num > max ? num : max;
    }, 0);
    const nextNum = maxExisting + 1;
    return `T${String(nextNum).padStart(3, "0")}`;
  }

  function refresh() {
    setLoading(true);
    api
      .get("/pos/terminals")
      .then((res) => {
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        setItems(rows.map((t) => ({ ...t, active: !!t.is_active })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    let mounted = true;
    api
      .get("/inventory/warehouses")
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (!mounted) return;
        setWarehouses([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function openAdd() {
    setEditingIndex(-1);
    setDraft({
      name: "",
      code: getNextTerminalCode(),
      warehouse: "",
      warehouse_id: "",
      ip_address: "",
      active: true,
      enable_vfd: false,
      vfd_type: "generic",
      vfd_port: "9100",
    });
    setShowModal(true);
  }

  function openEdit(idx) {
    const t = items[idx];
    setEditingIndex(idx);
    let wId = t?.warehouse_id || "";
    if (!wId && t?.warehouse && warehouses.length) {
      const match = warehouses.find(
        (w) =>
          `${w.warehouse_code ? `${w.warehouse_code} - ` : ""}${
            w.warehouse_name || ""
          }` === t.warehouse || w.warehouse_name === t.warehouse,
      );
      if (match) wId = String(match.id);
    }

    setDraft({
      name: t?.name || "",
      code: t?.code || "AUTO",
      warehouse: t?.warehouse || "",
      warehouse_id: wId,
      ip_address: t?.ip_address || "",
      active: !!t?.active,
      enable_vfd: !!t?.enable_vfd,
      vfd_type: t?.vfd_type || "generic",
      vfd_port: String(t?.vfd_port || "9100"),
    });
    setShowModal(true);
  }

  async function saveTerminal() {
    const name = String(draft.name || "").trim();
    let code = String(draft.code || "").trim();
    if (!name) {
      toast.warn("Provide terminal name");
      return;
    }
    if (!draft.warehouse_id) {
      toast.warn("Please select a warehouse for this terminal");
      return;
    }
    if (!code || code === "AUTO") {
      code = getNextTerminalCode();
    }
    try {
      if (editingIndex >= 0) {
        const current = items[editingIndex];
        if (!current || !current.id) {
          toast.error("Terminal id is missing");
          return;
        }
        await api.put(`/pos/terminals/${current.id}`, {
          code,
          name,
          warehouse: draft.warehouse || null,
          warehouse_id: draft.warehouse_id || null,
          counter_no: current.counter_no || null,
          ip_address: draft.ip_address || null,
          active: !!draft.active,
          enable_vfd: !!draft.enable_vfd,
          vfd_type: draft.vfd_type || "generic",
          vfd_port: draft.vfd_port ? Number(draft.vfd_port) : 9100,
        });
      } else {
        await api.post("/pos/terminals", {
          code,
          name,
          warehouse: draft.warehouse || null,
          warehouse_id: draft.warehouse_id || null,
          counter_no: null,
          ip_address: draft.ip_address || null,
          active: !!draft.active,
          enable_vfd: !!draft.enable_vfd,
          vfd_type: draft.vfd_type || "generic",
          vfd_port: draft.vfd_port ? Number(draft.vfd_port) : 9100,
        });
      }
      setShowModal(false);
      setEditingIndex(-1);
      refresh();
      toast.success("Terminal saved");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to save terminal";
      toast.error(message);
    }
  }

  async function deleteTerminal(idx) {
    const current = items[idx];
    if (!current || !current.id) {
      setItems((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    try {
      await api.put(`/pos/terminals/${current.id}`, {
        code: current.code,
        name: current.name,
        warehouse: current.warehouse || null,
        counter_no: current.counter_no || null,
        ip_address: current.ip_address || null,
        active: false,
        enable_vfd: !!current.enable_vfd,
        vfd_type: current.vfd_type || "generic",
        vfd_port: current.vfd_port ? Number(current.vfd_port) : 9100,
      });
      refresh();
      toast.success("Terminal deactivated");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to deactivate terminal";
      toast.error(message);
    }
  }

  async function loadUsersForTerminal(terminalId) {
    const companyId = Number(scope?.companyId || 0) || undefined;
    const branchId = Number(scope?.branchId || 0) || undefined;
    setUsersLoading(true);
    try {
      const [usersRes, assignedRes] = await Promise.all([
        api.get("/admin/users", {
          params: {
            ...(companyId ? { company_id: companyId } : {}),
            ...(branchId ? { branch_id: branchId } : {}),
            active: 1,
            limit: 100,
          },
        }),
        api.get("/pos/terminal-users", {
          params: { terminalId },
        }),
      ]);
      const allUsers = Array.isArray(usersRes.data?.data?.items)
        ? usersRes.data.data.items
        : [];
      const assigned = Array.isArray(assignedRes.data?.items)
        ? assignedRes.data.items
        : [];
      setUsers(allUsers);
      setAssignedUsernamesById(
        assigned.reduce((acc, x) => {
          const id = String(x.user_id);
          acc[id] = String(x.username || id);
          return acc;
        }, {}),
      );
      setAssignedUserIds(
        assigned
          .map((x) => Number(x.user_id))
          .filter((n) => Number.isFinite(n) && n > 0)
          .map(String),
      );
      setAddUserId("");
    } catch (err) {
      setUsers([]);
      setAssignedUserIds([]);
      setAssignedUsernamesById({});
      setAddUserId("");
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to load users for terminal";
      toast.error(message);
    } finally {
      setUsersLoading(false);
    }
  }

  function openUserModal(terminal) {
    if (!terminal?.id) return;
    setUserModalTerminal(terminal);
    setUserModalOpen(true);
    setAddUserId("");
    loadUsersForTerminal(terminal.id);
  }

  async function saveTerminalUsers() {
    const terminalId = userModalTerminal?.id;
    if (!terminalId) return;
    const pending = String(addUserId || "").trim();
    const baseIds = pending ? [...assignedUserIds, pending] : assignedUserIds;
    const cleanUserIds = Array.from(new Set(baseIds))
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    setUsersSaving(true);
    try {
      await api.put("/pos/terminal-users", {
        terminalId,
        userIds: cleanUserIds,
      });
      toast.success("Terminal users updated");
      setUserModalOpen(false);
      setUserModalTerminal(null);
      setAssignedUserIds([]);
      setAddUserId("");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to update terminal users";
      toast.error(message);
    } finally {
      setUsersSaving(false);
    }
  }

  const userById = useMemo(() => {
    const m = new Map();
    for (const u of users) {
      if (!u?.id) continue;
      m.set(String(u.id), u);
    }
    return m;
  }, [users]);

  const assignedSet = useMemo(
    () => new Set(assignedUserIds),
    [assignedUserIds],
  );

  const availableUsers = useMemo(
    () => users.filter((u) => u?.id && !assignedSet.has(String(u.id))),
    [users, assignedSet],
  );

  return (
    <div className="space-y-4">
      <InfoBox title="About POS Terminals">
        Configure and manage point-of-sale terminals. Each terminal represents a
        physical checkout counter or device in your store.
      </InfoBox>
      <div className="flex gap-2">
        <button type="button" className="btn-success" onClick={openAdd}>
          + Add Terminal
        </button>
        <button type="button" className="btn btn-secondary" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="text-sm mb-3">
            Manage register identifiers, warehouse/location binding, printer/IP,
            and activation status.
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Terminal Name</th>
                  <th>Terminal ID</th>
                  <th>Warehouse</th>
                  <th>Receipt Printer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">Loading...</td>
                  </tr>
                ) : !items.length ? (
                  <tr>
                    <td colSpan="6">
                      <div className="text-center text-slate-600 py-4">
                        No terminals found
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.code}</td>
                      <td>{t.warehouse || "-"}</td>
                      <td>{t.ip_address || "Not configured"}</td>
                      <td>
                        <span
                          className={
                            t.active ? "badge-success" : "badge-secondary"
                          }
                        >
                          {t.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openEdit(items.indexOf(t))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openUserModal(t)}
                          >
                            Users
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => deleteTerminal(items.indexOf(t))}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-brand text-white">
              <div className="text-lg font-bold">
                {editingIndex >= 0 ? "Edit Terminal" : "Add Terminal"}
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Terminal Name</label>
                  <input
                    className="input"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Terminal ID</label>
                  <input
                    className="input"
                    value={draft.code}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, code: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Warehouse</label>
                  <FilterableSelect
                    value={draft.warehouse_id}
                    onChange={(val) => {
                      const w = warehouses.find((x) => String(x.id) === String(val));
                      const label = w
                        ? `${w.warehouse_code ? `${w.warehouse_code} - ` : ""}${
                            w.warehouse_name || ""
                          }`
                        : "";
                      setDraft((p) => ({
                        ...p,
                        warehouse_id: val,
                        warehouse: label,
                      }));
                    }}
                    options={warehouses.map((w) => {
                      const label = `${
                        w.warehouse_code ? `${w.warehouse_code} - ` : ""
                      }${w.warehouse_name || ""}`;
                      return { value: String(w.id), label };
                    })}
                    placeholder="Select warehouse"
                    filterPlaceholder="Filter warehouses..."
                  />
                </div>
                <div>
                  <label className="label">Receipt Printer / IP</label>
                  <input
                    className="input"
                    value={draft.ip_address}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, ip_address: e.target.value }))
                    }
                    placeholder="Printer name or IP"
                  />
                </div>
                <div className="border-t border-slate-200 pt-3 col-span-1 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Customer Display (VFD)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!draft.enable_vfd}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, enable_vfd: e.target.checked }))
                        }
                      />
                      <span>Enable VFD</span>
                    </label>
                    <div>
                      <label className="label text-xs">Display Type</label>
                      <select
                        className="input text-sm"
                        value={draft.vfd_type}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, vfd_type: e.target.value }))
                        }
                      >
                        <option value="generic">Generic</option>
                        <option value="epson-dm-d">Epson DM-D</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Port</label>
                      <input
                        className="input text-sm"
                        value={draft.vfd_port}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, vfd_port: e.target.value }))
                        }
                        placeholder="9100"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!draft.active}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, active: e.target.checked }))
                    }
                  />
                  <span className="text-sm">Active</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setEditingIndex(-1);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveTerminal}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {userModalOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-brand text-white">
              <div className="text-lg font-bold">Assign Users</div>
              <div className="text-sm opacity-90">
                {userModalTerminal?.name} ({userModalTerminal?.code})
              </div>
            </div>
            <div className="p-4 space-y-4">
              {usersLoading ? (
                <div className="py-8 text-center text-slate-600">
                  Loading users...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label className="label">Add User</label>
                      <FilterableSelect
                        value={addUserId}
                        onChange={(val) => setAddUserId(String(val))}
                        options={availableUsers.map((u) => ({
                          value: String(u.id),
                          label: String(u.username || ""),
                        }))}
                        placeholder="Select user"
                        filterPlaceholder="Filter users..."
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!addUserId || usersSaving}
                      onClick={() => {
                        const next = String(addUserId || "").trim();
                        if (!next) return;
                        setAssignedUserIds((prev) =>
                          prev.includes(next) ? prev : [...prev, next],
                        );
                        setAddUserId("");
                      }}
                    >
                      Add
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">
                        Assigned Users
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!assignedUserIds.length || usersSaving}
                        onClick={() => setAssignedUserIds([])}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 text-xs uppercase text-slate-600">
                              Username
                            </th>
                            <th className="text-right p-2 text-xs uppercase text-slate-600">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {!assignedUserIds.length ? (
                            <tr>
                              <td
                                colSpan="2"
                                className="p-4 text-center text-slate-500"
                              >
                                No users assigned
                              </td>
                            </tr>
                          ) : (
                            assignedUserIds.map((id) => {
                              const username =
                                userById.get(String(id))?.username ||
                                assignedUsernamesById[String(id)] ||
                                String(id);
                              return (
                                <tr key={id} className="border-t">
                                  <td className="p-2">{username}</td>
                                  <td className="p-2 text-right">
                                    <button
                                      type="button"
                                      className="btn btn-danger"
                                      disabled={usersSaving}
                                      onClick={() =>
                                        setAssignedUserIds((prev) =>
                                          prev.filter((x) => x !== String(id)),
                                        )
                                      }
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={usersSaving}
                  onClick={() => {
                    setUserModalOpen(false);
                    setUserModalTerminal(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={usersLoading || usersSaving}
                  onClick={saveTerminalUsers}
                >
                  {usersSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionsTab() {
  const [shifts, setShifts] = useState([
    {
      id: 1,
      name: "Morning Shift",
      terminal: "TERM-001",
      cashier: "John Doe",
      startTime: new Date().toISOString(),
      endTime: null,
      openingBalance: 500,
      status: "open",
    },
  ]);
  const [terminals] = useState([
    { id: "TERM-001", name: "Front Counter 1", active: true },
    { id: "TERM-002", name: "Front Counter 2", active: true },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [draft, setDraft] = useState({
    name: "",
    terminal: "",
    cashier: "",
    openingBalance: "",
  });

  function openShiftModal() {
    setEditingIndex(-1);
    setDraft({
      name: "",
      terminal: "",
      cashier: "",
      openingBalance: "",
    });
    setShowModal(true);
  }

  function saveShift() {
    const newShift = {
      id: editingIndex >= 0 ? shifts[editingIndex].id : Date.now(),
      name: draft.name,
      terminal: draft.terminal,
      cashier: draft.cashier,
      startTime: new Date().toISOString(),
      endTime: null,
      openingBalance: Number(draft.openingBalance) || 0,
      status: "open",
    };
    setShifts((prev) =>
      editingIndex >= 0
        ? prev.map((s, i) => (i === editingIndex ? newShift : s))
        : [...prev, newShift],
    );
    setShowModal(false);
    setEditingIndex(-1);
  }

  function closeShift(idx) {
    setShifts((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, status: "closed", endTime: new Date().toISOString() }
          : s,
      ),
    );
  }

  function deleteShift(idx) {
    setShifts((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-slate-900">
              Shift Management
            </div>
            <button
              type="button"
              className="btn-success"
              onClick={openShiftModal}
            >
              + New Shift
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Shift Name</th>
                  <th>Terminal</th>
                  <th>Cashier</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Opening Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!shifts.length ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
                      No shifts found
                    </td>
                  </tr>
                ) : (
                  shifts.map((s, idx) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.terminal || "N/A"}</td>
                      <td>{s.cashier}</td>
                      <td>{new Date(s.startTime).toLocaleString()}</td>
                      <td>
                        {s.endTime
                          ? new Date(s.endTime).toLocaleString()
                          : "Open"}
                      </td>
                      <td>${Number(s.openingBalance).toFixed(2)}</td>
                      <td>
                        <span
                          className={`badge ${
                            s.status === "open"
                              ? "badge-success"
                              : "badge-error"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {s.status === "open" ? (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => closeShift(idx)}
                            >
                              Close
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => deleteShift(idx)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-brand text-white">
              <div className="text-lg font-bold">New Shift</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label">Shift Name</label>
                  <input
                    className="input"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g., Morning Shift"
                  />
                </div>
                <div>
                  <label className="label">Terminal</label>
                  <FilterableSelect
                    value={draft.terminal}
                    onChange={(val) =>
                      setDraft((p) => ({ ...p, terminal: val }))
                    }
                    options={terminals
                      .filter((t) => t.active)
                      .map((t) => ({
                        value: String(t.id),
                        label: String(t.name || ""),
                      }))}
                    placeholder="Select Terminal"
                    filterPlaceholder="Filter terminals..."
                  />
                </div>
                <div>
                  <label className="label">Cashier</label>
                  <input
                    className="input"
                    value={draft.cashier}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, cashier: e.target.value }))
                    }
                    placeholder="Cashier name"
                  />
                </div>
                <div>
                  <label className="label">Opening Balance</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={draft.openingBalance}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        openingBalance: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setEditingIndex(-1);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveShift}
                >
                  Start Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentMethodsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPaymentIdx, setEditingPaymentIdx] = useState(-1);
  const [accounts, setAccounts] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState({
    name: "",
    type: "cash",
    account: "",
    requireReference: false,
    active: true,
  });
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [cashAccountId, setCashAccountId] = useState("");
  const [maxCashAmount, setMaxCashAmount] = useState("10000");
  const [requireChangeCalc, setRequireChangeCalc] = useState(true);
  const [cardBankAccountId, setCardBankAccountId] = useState("");
  const [cardProcessingFee, setCardProcessingFee] = useState("2.5");
  const [requireCardLast4, setRequireCardLast4] = useState(true);

  const accountLabelById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) {
      if (!a || a.id === undefined || a.id === null) continue;
      const id = String(a.id);
      const name = String(a.name || "").trim();
      m.set(id, name || id);
    }
    return m;
  }, [accounts]);

  function refreshPayments() {
    setLoading(true);
    api
      .get("/pos/payment-modes")
      .then((res) => {
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = rows.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          account: p.account || "",
          requireReference: !!p.require_reference,
          active: !!p.is_active,
        }));
        setPayments(mapped);
      })
      .catch(() => {
        setPayments([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshPayments();
  }, []);

  useEffect(() => {
    let mounted = true;
    api
      .get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      })
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setAccounts(items);
      })
      .catch(() => {
        if (!mounted) return;
        setAccounts([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_PAYMENT_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.cashEnabled === "boolean")
        setCashEnabled(parsed.cashEnabled);
      if (typeof parsed.cardEnabled === "boolean")
        setCardEnabled(parsed.cardEnabled);
      if (parsed.cashAccountId) setCashAccountId(String(parsed.cashAccountId));
      if (parsed.maxCashAmount !== undefined)
        setMaxCashAmount(String(parsed.maxCashAmount));
      if (typeof parsed.requireChangeCalc === "boolean")
        setRequireChangeCalc(parsed.requireChangeCalc);
      if (parsed.cardBankAccountId)
        setCardBankAccountId(String(parsed.cardBankAccountId));
      if (parsed.cardProcessingFee !== undefined)
        setCardProcessingFee(String(parsed.cardProcessingFee));
      if (typeof parsed.requireCardLast4 === "boolean")
        setRequireCardLast4(parsed.requireCardLast4);
    } catch {}
  }, []);

  function openPaymentModal() {
    setEditingPaymentIdx(-1);
    setPaymentDraft({
      name: "",
      type: "cash",
      account: "",
      requireReference: false,
      active: true,
    });
    setShowPaymentModal(true);
  }

  function editPayment(idx) {
    const p = payments[idx];
    setEditingPaymentIdx(idx);
    setPaymentDraft({
      name: p?.name || "",
      type: p?.type || "cash",
      account: p?.account || "",
      requireReference: !!p?.requireReference,
      active: !!p?.active,
    });
    setShowPaymentModal(true);
  }

  async function deletePayment(idx) {
    const current = payments[idx];
    if (!current || !current.id) {
      setPayments((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    try {
      await api.put(`/pos/payment-modes/${current.id}`, {
        name: current.name,
        type: current.type,
        account: current.account || "",
        requireReference: current.requireReference || false,
        active: false,
      });
      refreshPayments();
      toast.success("Payment mode deactivated");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to deactivate payment mode";
      toast.error(message);
    }
  }

  async function savePayment() {
    const name = String(paymentDraft.name || "").trim();
    const type = String(paymentDraft.type || "").trim();
    if (!name || !type) {
      toast.warn("Provide payment name and type");
      return;
    }
    try {
      if (editingPaymentIdx >= 0) {
        const current = payments[editingPaymentIdx];
        if (!current || !current.id) {
          toast.error("Payment mode id is missing");
          return;
        }
        await api.put(`/pos/payment-modes/${current.id}`, {
          name,
          type,
          account: paymentDraft.account || "",
          requireReference: !!paymentDraft.requireReference,
          active: !!paymentDraft.active,
        });
      } else {
        await api.post("/pos/payment-modes", {
          name,
          type,
          account: paymentDraft.account || "",
          requireReference: !!paymentDraft.requireReference,
          active: !!paymentDraft.active,
        });
      }
      setShowPaymentModal(false);
      setEditingPaymentIdx(-1);
      refreshPayments();
      toast.success("Payment mode saved");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to save payment mode";
      toast.error(message);
    }
  }

  function savePaymentSettings() {
    const payload = {
      cashEnabled: !!cashEnabled,
      cardEnabled: !!cardEnabled,
      cashAccountId: cashAccountId || "",
      maxCashAmount:
        maxCashAmount === "" ? "" : Number(maxCashAmount || 0).toString(),
      requireChangeCalc: !!requireChangeCalc,
      cardBankAccountId: cardBankAccountId || "",
      cardProcessingFee:
        cardProcessingFee === ""
          ? ""
          : Number(cardProcessingFee || 0).toString(),
      requireCardLast4: !!requireCardLast4,
    };
    try {
      localStorage.setItem(POS_PAYMENT_SETTINGS_KEY, JSON.stringify(payload));
      toast.success("Payment settings saved");
    } catch {
      toast.error("Failed to save payment settings");
    }
  }

  return (
    <div className="space-y-6">
      <InfoBox title="About Payment Methods">
        Configure available payment methods for your POS system. Enable or
        disable payment options and set processing preferences.
      </InfoBox>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-slate-900">
              Payment Methods
            </div>
            <button
              type="button"
              className="btn-success"
              onClick={openPaymentModal}
            >
              + Add Payment Mode
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment Name</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th>Require Reference</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : !payments.length ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
                      No payment modes configured
                    </td>
                  </tr>
                ) : (
                  payments.map((p, idx) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        <span className="badge badge-success">{p.type}</span>
                      </td>
                      <td>
                        {p.account
                          ? accountLabelById.get(String(p.account)) ||
                            String(p.account)
                          : "N/A"}
                      </td>
                      <td>{p.requireReference ? "Yes" : "No"}</td>
                      <td>
                        <span
                          className={
                            p.active
                              ? "badge-success badge"
                              : "badge-secondary badge"
                          }
                        >
                          {p.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => editPayment(idx)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => deletePayment(idx)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
{/* Hiding Cash and Card sections as per request */}
      <div className="hidden grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-body space-y-4">
            <div className="text-lg font-semibold text-slate-900">
              Cash Payment
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cashEnabled}
                onChange={(e) => setCashEnabled(e.target.checked)}
              />
              <span className="text-sm">Enable Cash Payments</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Cash Account</label>
                <select
                  className="input"
                  value={cashAccountId}
                  onChange={(e) => setCashAccountId(e.target.value)}
                >
                  <option value="">Select cash account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Max Cash Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={maxCashAmount}
                  onChange={(e) => setMaxCashAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Require Change Calculation</label>
                <select
                  className="input"
                  value={requireChangeCalc ? "YES" : "NO"}
                  onChange={(e) =>
                    setRequireChangeCalc(e.target.value === "YES")
                  }
                >
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="text-lg font-semibold text-slate-900">
              Card Payment
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cardEnabled}
                onChange={(e) => setCardEnabled(e.target.checked)}
              />
              <span className="text-sm">Enable Card Payments</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Bank Account</label>
                <select
                  className="input"
                  value={cardBankAccountId}
                  onChange={(e) => setCardBankAccountId(e.target.value)}
                >
                  <option value="">Select bank account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Processing Fee %</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={cardProcessingFee}
                  onChange={(e) => setCardProcessingFee(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Require Card Last 4 Digits</label>
                <select
                  className="input"
                  value={requireCardLast4 ? "YES" : "NO"}
                  onChange={(e) =>
                    setRequireCardLast4(e.target.value === "YES")
                  }
                >
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Card Types Accepted</label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Visa</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Mastercard</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">American Express</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={savePaymentSettings}
        >
          Save Payment Settings
        </button>
      </div>
      {showPaymentModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-brand text-white">
              <div className="text-lg font-bold">
                {editingPaymentIdx >= 0
                  ? "Edit Payment Mode"
                  : "Add Payment Mode"}
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label">Payment Name</label>
                  <input
                    className="input"
                    value={paymentDraft.name}
                    onChange={(e) =>
                      setPaymentDraft((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g., Cash, Credit Card"
                  />
                </div>
                <div>
                  <label className="label">Payment Type</label>
                  <select
                    className="input"
                    value={paymentDraft.type}
                    onChange={(e) =>
                      setPaymentDraft((p) => ({ ...p, type: e.target.value }))
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile Money</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="credit">Credit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Account</label>
                  <select
                    className="input"
                    value={paymentDraft.account}
                    onChange={(e) =>
                      setPaymentDraft((p) => ({
                        ...p,
                        account: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={paymentDraft.requireReference}
                    onChange={(e) =>
                      setPaymentDraft((p) => ({
                        ...p,
                        requireReference: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm">Require Reference Number</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={paymentDraft.active}
                    onChange={(e) =>
                      setPaymentDraft((p) => ({
                        ...p,
                        active: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm">Active</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setEditingPaymentIdx(-1);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={savePayment}
                >
                  Save Payment Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WarehousesTab() {
  const [rows] = useState([
    {
      code: "WH-001",
      name: "Main Warehouse",
      type: "Retail",
      location: "Downtown",
      locations: 12,
      status: "Active",
    },
    {
      code: "WH-002",
      name: "Front Store",
      type: "Retail",
      location: "Uptown",
      locations: 4,
      status: "Active",
    },
  ]);
  return (
    <div className="space-y-4">
      <InfoBox title="About Warehouses">
        Configure warehouses/stores for inventory management. Each terminal must
        be linked to a warehouse for stock operations.
      </InfoBox>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary">
          + Add New Warehouse
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="text-left p-2 text-xs uppercase">
                Warehouse Code
              </th>
              <th className="text-left p-2 text-xs uppercase">
                Warehouse Name
              </th>
              <th className="text-left p-2 text-xs uppercase">Type</th>
              <th className="text-left p-2 text-xs uppercase">Location</th>
              <th className="text-left p-2 text-xs uppercase">
                Total Locations
              </th>
              <th className="text-left p-2 text-xs uppercase">Status</th>
              <th className="text-left p-2 text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{r.code}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.location}</td>
                <td className="p-2">{r.locations}</td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      r.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-info">
                      View
                    </button>
                    <button type="button" className="btn btn-secondary">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxSettingsTab() {
  const [taxCodes, setTaxCodes] = useState([]);
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [loading, setLoading] = useState(true);
  const [taxType, setTaxType] = useState("Inclusive");
  const [taxActive, setTaxActive] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [taxComponents, setTaxComponents] = useState([]);
  const [componentMappings, setComponentMappings] = useState({});
  const [componentsLoading, setComponentsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/finance/tax-codes")
      .then((res) => {
        if (mounted) {
          setTaxCodes(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      })
      .catch(() => {
        if (mounted) setTaxCodes([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    api
      .get("/pos/tax-settings")
      .then((res) => {
        if (!mounted) return;
        const item = res.data?.item || null;
        if (!item) return;
        if (item.tax_code_id) setSelectedTaxId(String(item.tax_code_id));
        if (item.tax_account_id)
          setSelectedAccountId(String(item.tax_account_id));
        if (item.tax_type) setTaxType(String(item.tax_type));
        if (item.is_active !== undefined) setTaxActive(Boolean(item.is_active));
        if (item.component_mappings) {
          try {
            const parsed =
              typeof item.component_mappings === "string"
                ? JSON.parse(item.component_mappings)
                : item.component_mappings;
            setComponentMappings(parsed || {});
          } catch (e) {
            setComponentMappings({});
          }
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTaxId) {
      setTaxComponents([]);
      return;
    }
    let mounted = true;
    setComponentsLoading(true);
    api
      .get(`/finance/tax-codes/${selectedTaxId}/components`)
      .then((res) => {
        if (mounted) {
          setTaxComponents(
            Array.isArray(res.data?.items) ? res.data.items : [],
          );
        }
      })
      .catch(() => {
        if (mounted) setTaxComponents([]);
      })
      .finally(() => {
        if (mounted) setComponentsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedTaxId]);

  async function saveTaxSettings() {
    const payload = {
      taxCodeId: selectedTaxId || "",
      taxAccountId: selectedAccountId || "",
      taxType: taxType || "",
      isActive: !!taxActive,
      componentMappings,
    };
    try {
      await api.put("/pos/tax-settings", payload);
      toast.success("Tax settings saved");
    } catch {
      toast.error("Failed to save tax settings");
    }
  }

  useEffect(() => {
    let mounted = true;
    api
      .get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      })
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setAccounts(items);
      })
      .catch(() => {
        if (!mounted) return;
        setAccounts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setAccountsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-4">
          <div className="text-lg font-semibold text-slate-900">
            Tax Settings
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Default Tax Code</label>
              <select
                className="input"
                value={selectedTaxId}
                onChange={(e) => setSelectedTaxId(e.target.value)}
                disabled={loading}
              >
                <option value="">Select tax code</option>
                {taxCodes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tax Type</label>
              <select
                className="input"
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
              >
                <option value="Inclusive">Inclusive</option>
                <option value="Exclusive">Exclusive</option>
              </select>
            </div>
            <div>
              <label className="label">Tax Account</label>
              <select
                className="input"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={accountsLoading}
              >
                <option value="">Select tax account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedTaxId && (
            <div className="mt-4">
              <label className="label mb-2">
                Tax Component Account Mappings
              </label>
              {componentsLoading ? (
                <div className="text-sm text-slate-500">
                  Loading components...
                </div>
              ) : taxComponents.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No components found for this tax code.
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-slate-50 rounded border">
                  {taxComponents.map((comp) => (
                    <div key={comp.id} className="flex items-center gap-4">
                      <div className="w-1/3 text-sm font-medium">
                        {comp.component_name ||
                          comp.detail_name ||
                          `Component ${comp.id}`}
                      </div>
                      <div className="flex-1">
                        <select
                          className="input"
                          value={componentMappings[comp.id] || ""}
                          onChange={(e) => {
                            setComponentMappings((prev) => ({
                              ...prev,
                              [comp.id]: e.target.value,
                            }));
                          }}
                        >
                          <option value="">Select account for component</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={taxActive}
              onChange={(e) => setTaxActive(e.target.checked)}
            />
            <label className="label mb-0">Tax Active</label>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveTaxSettings}
            >
              Save Tax Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptSettingsTab() {
  const [companyName, setCompanyName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [showLogo, setShowLogo] = useState(false);
  const [showBarcodeOnReceipt, setShowBarcodeOnReceipt] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: defaultLogo,
  });
  const [companyLoading, setCompanyLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get("/pos/receipt-settings");
        const item = res.data?.item || null;
        if (!mounted) return;
        if (item) {
          if (item.company_name) setCompanyName(String(item.company_name));
          if (item.header_text) setHeaderText(String(item.header_text));
          if (item.footer_text) setFooterText(String(item.footer_text));
          if (item.contact_number)
            setContactNumber(String(item.contact_number));
          if (item.address_line1) setAddressLine1(String(item.address_line1));
          if (item.address_line2) setAddressLine2(String(item.address_line2));
          setShowLogo(
            item.show_logo === 1 ||
              item.show_logo === true ||
              String(item.show_logo).toLowerCase() === "true",
          );
          setShowBarcodeOnReceipt(
            item.show_barcode === 1 ||
              item.show_barcode === true ||
              String(item.show_barcode).toLowerCase() === "true",
          );
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchCompany() {
      try {
        setCompanyLoading(true);
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) {
          if (!mounted) return;
          setCompanyInfo((prev) => ({
            ...prev,
            logoUrl: prev.logoUrl || defaultLogo,
          }));
          return;
        }
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : prev.logoUrl || defaultLogo,
        }));
      } catch {
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || defaultLogo,
        }));
      } finally {
        if (mounted) setCompanyLoading(false);
      }
    }
    fetchCompany();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings() {
    const payload = {
      companyName: companyName.trim(),
      contactNumber: contactNumber.trim(),
      headerText: headerText.trim(),
      footerText: footerText.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      logoUrl: companyInfo.logoUrl || "",
      showLogo: !!showLogo,
      showBarcode: !!showBarcodeOnReceipt,
    };
    try {
      await api.put("/pos/receipt-settings", payload);
      toast.success("Receipt settings saved");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to save receipt settings";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-4">
          <div className="text-lg font-semibold text-slate-900">
            Receipt Settings
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 border rounded bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={companyInfo.logoUrl}
                  alt={companyInfo.name || "Company Logo"}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="text-xs text-slate-700">
                <div className="font-semibold text-sm">
                  {companyInfo.name || "Company Name"}
                </div>
                <div>
                  {companyInfo.address}
                  {companyInfo.city ? `, ${companyInfo.city}` : ""}
                  {companyInfo.country ? `, ${companyInfo.country}` : ""}
                </div>
                <div>
                  {companyInfo.phone
                    ? `Mobile: ${companyInfo.phone}`
                    : companyInfo.email || ""}
                </div>
                <div>
                  {companyInfo.taxId ? `TIN: ${companyInfo.taxId}` : ""}
                </div>
              </div>
            </div>
            <div className="md:col-span-2 text-xs text-slate-500">
              {companyLoading
                ? "Loading company information from profile..."
                : "Company details are loaded from the company profile (adm_companies)."}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-3">
              <div>
                <label className="label">Upload Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const form = new FormData();
                      form.append("logo", file);
                      const resp = await api.post(
                        `/pos/receipt-settings/logo`,
                        form,
                        { headers: { "Content-Type": "multipart/form-data" } },
                      );
                      const url =
                        resp?.data?.logoUrl || companyInfo.logoUrl || "";
                      setCompanyInfo((prev) => ({
                        ...prev,
                        logoUrl: url,
                      }));
                      setShowLogo(true);
                      toast.success("Logo uploaded and linked to receipts");
                    } catch (err) {
                      const message =
                        err?.response?.data?.message ||
                        err?.response?.data?.error ||
                        "Failed to upload logo";
                      toast.error(message);
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name</label>
              <input
                className="input"
                type="text"
                placeholder="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Contact Number</label>
              <input
                className="input"
                type="text"
                placeholder="+1234567890"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Receipt Header Text</label>
              <textarea
                className="input h-28"
                placeholder="Thank you for your purchase"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Receipt Footer Text</label>
              <textarea
                className="input h-28"
                placeholder="Please visit again"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Address Line 1</label>
              <input
                className="input"
                type="text"
                placeholder="Street address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Address Line 2</label>
              <input
                className="input"
                type="text"
                placeholder="City, State, ZIP"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
              />
              <span className="text-sm">Show Logo on Receipt</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showBarcodeOnReceipt}
                onChange={(e) => setShowBarcodeOnReceipt(e.target.checked)}
              />
              <span className="text-sm">Show QR code on Receipt</span>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSettings}
            >
              Save Receipt Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralSettingsTab() {
  const [defaultCurrency, setDefaultCurrency] = useState("GHS - Ghana Cedi");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] = useState("12 Hour");
  const [allowDiscounts, setAllowDiscounts] = useState(false);
  const [requireCustomer, setRequireCustomer] = useState(false);
  const [autoLogoutAfterShiftClose, setAutoLogoutAfterShiftClose] =
    useState(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [returnReasons, setReturnReasons] = useState([]);
  const [returnReasonsLoading, setReturnReasonsLoading] = useState(false);
  const [newReturnReason, setNewReturnReason] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_GENERAL_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.defaultCurrency)
        setDefaultCurrency(String(parsed.defaultCurrency));
      if (parsed.decimalPlaces !== undefined)
        setDecimalPlaces(String(parsed.decimalPlaces));
      if (parsed.dateFormat) setDateFormat(String(parsed.dateFormat));
      if (parsed.timeFormat) setTimeFormat(String(parsed.timeFormat));
      if (typeof parsed.allowDiscounts === "boolean")
        setAllowDiscounts(parsed.allowDiscounts);
      if (typeof parsed.requireCustomer === "boolean")
        setRequireCustomer(parsed.requireCustomer);
      if (typeof parsed.autoLogoutAfterShiftClose === "boolean")
        setAutoLogoutAfterShiftClose(parsed.autoLogoutAfterShiftClose);
      if (typeof parsed.autoPrintReceipt === "boolean")
        setAutoPrintReceipt(parsed.autoPrintReceipt);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    setReturnReasonsLoading(true);
    api
      .get("/pos/return-reasons")
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const list = rows
          .map((r) => String(r.reason || "").trim())
          .filter(Boolean);
        setReturnReasons(list);
      })
      .catch(() => {
        if (!mounted) return;
        setReturnReasons(["Defective", "Wrong Item", "Damaged", "Unwanted", "Other"]);
      })
      .finally(() => {
        if (!mounted) return;
        setReturnReasonsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function saveGeneralSettings() {
    const payload = {
      defaultCurrency,
      decimalPlaces: decimalPlaces || "2",
      dateFormat,
      timeFormat,
      allowDiscounts: !!allowDiscounts,
      requireCustomer: !!requireCustomer,
      autoLogoutAfterShiftClose: !!autoLogoutAfterShiftClose,
      autoPrintReceipt: !!autoPrintReceipt,
    };
    try {
      localStorage.setItem(POS_GENERAL_SETTINGS_KEY, JSON.stringify(payload));
      toast.success("General settings saved");
    } catch {
      toast.error("Failed to save general settings");
    }
  }

  function addReturnReason() {
    const r = String(newReturnReason || "").trim();
    if (!r) return;
    setReturnReasons((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      if (!next.some((x) => String(x).toLowerCase() === r.toLowerCase())) {
        next.push(r);
      }
      next.sort((a, b) => String(a).localeCompare(String(b)));
      return next;
    });
    setNewReturnReason("");
  }

  function removeReturnReason(reason) {
    const r = String(reason || "");
    setReturnReasons((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x) !== r) : []));
  }

  async function saveReturnReasons() {
    const list = Array.isArray(returnReasons) ? returnReasons : [];
    const cleaned = Array.from(
      new Set(list.map((r) => String(r || "").trim()).filter(Boolean)),
    );
    if (!cleaned.length) {
      toast.warn("Add at least one return reason");
      return;
    }
    try {
      setReturnReasonsLoading(true);
      await api.put("/pos/return-reasons", { reasons: cleaned });
      toast.success("Return reasons saved");
      setReturnReasons(cleaned.sort((a, b) => String(a).localeCompare(String(b))));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save return reasons");
    } finally {
      setReturnReasonsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-4">
          <div className="text-lg font-semibold text-slate-900">
            General Settings
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Default Currency</label>
              <select
                className="input"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
              >
                <option value="USD - US Dollar">USD - US Dollar</option>
                <option value="EUR - Euro">EUR - Euro</option>
                <option value="GBP - British Pound">GBP - British Pound</option>
                <option value="GHS - Ghana Cedi">GHS - Ghana Cedi</option>
              </select>
            </div>
            <div>
              <label className="label">Decimal Places</label>
              <select
                className="input"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
              >
                <option value="0">0</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div>
              <label className="label">Date Format</label>
              <select
                className="input"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="label">Time Format</label>
              <select
                className="input"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
              >
                <option value="12 Hour">12 Hour</option>
                <option value="24 Hour">24 Hour</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowDiscounts}
                onChange={(e) => setAllowDiscounts(e.target.checked)}
              />
              <span className="text-sm">Allow Discounts</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireCustomer}
                onChange={(e) => setRequireCustomer(e.target.checked)}
              />
              <span className="text-sm">Require Customer for Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoLogoutAfterShiftClose}
                onChange={(e) => setAutoLogoutAfterShiftClose(e.target.checked)}
              />
              <span className="text-sm">Auto Logout After Shift Close</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoPrintReceipt}
                onChange={(e) => setAutoPrintReceipt(e.target.checked)}
              />
              <span className="text-sm">Auto Print Receipt</span>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveGeneralSettings}
            >
              Save General Settings
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="text-lg font-semibold text-slate-900">
            Return Reasons
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Add Reason</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={newReturnReason}
                  onChange={(e) => setNewReturnReason(e.target.value)}
                  placeholder="e.g., Expired, Incorrect Price"
                  disabled={returnReasonsLoading}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addReturnReason}
                  disabled={returnReasonsLoading}
                >
                  Add
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(Array.isArray(returnReasons) ? returnReasons : []).map((r) => (
                  <div
                    key={r}
                    className="flex items-center justify-between gap-2 p-2 rounded border border-slate-200 bg-white"
                  >
                    <div className="text-sm text-slate-800">{r}</div>
                    <button
                      type="button"
                      className="btn btn-xs btn-danger"
                      onClick={() => removeReturnReason(r)}
                      disabled={returnReasonsLoading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!returnReasonsLoading &&
                  (!Array.isArray(returnReasons) || returnReasons.length === 0) && (
                    <div className="text-sm text-slate-500">
                      No reasons yet. Add at least one.
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveReturnReasons}
              disabled={returnReasonsLoading}
            >
              Save Return Reasons
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  const reports = useMemo(
    () => [
      { title: "Daily Sales Summary", description: "Total sales by date" },
      {
        title: "Payment Method Breakdown",
        description: "Cash/Card/Mobile totals",
      },
      { title: "Top Selling Items", description: "Best performing items" },
    ],
    [],
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, idx) => (
          <div
            key={idx}
            className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {r.title}
            </div>
            <div className="text-sm mt-1">{r.description}</div>
          </div>
        ))}
      </div>
      <div>
        <Link to="/pos/reports" className="btn btn-primary">
          Open POS Reports
        </Link>
      </div>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosSetup() {
  const [tab, setTab] = useState("terminals");
  const tabs = [
    { key: "terminals", label: "🖥️ Terminals" },
    { key: "payment", label: "💳 Payment Modes" },
    { key: "taxes", label: "🧾 Tax Settings" },
    { key: "receipts", label: "🧾 Receipt Settings" },
    { key: "general", label: "⚙️ General Settings" },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        emoji="⚙️"
        title="POS Setup & Configuration"
        subtitle="Configure terminals, payment methods, and system settings"
      />
      <div className="flex gap-2">
        {tabs.map((t) => (
          <TabButton
            key={t.key}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </TabButton>
        ))}
      </div>
      {tab === "terminals" && <TerminalsTab />}
      {tab === "payment" && <PaymentMethodsTab />}
      {tab === "taxes" && <TaxSettingsTab />}
      {tab === "receipts" && <ReceiptSettingsTab />}
      {tab === "general" && <GeneralSettingsTab />}
    </div>
  );
}

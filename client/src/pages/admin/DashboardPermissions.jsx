/**
 * @fileoverview DashboardPermissions component.
 * Allows administrators to manage user permissions for viewing specific dashboards, cards, and tickers.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../api/client.js";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";
import { DASHBOARD_CARDS, getAllCardAliases } from "../../data/dashboardCards.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { usePermission } from "../../auth/PermissionContext.jsx";

/**
 * Helper to generate a unique key for a permission combination.
 * 
 * @param {string} module_key 
 * @param {string} dashboard_key 
 * @param {string} card_key 
 * @param {string} ticker_key 
 * @returns {string} The formatted permission key.
 */
function permKey(module_key, dashboard_key, card_key, ticker_key) {
  return `${module_key}|${dashboard_key || ""}|${card_key || ""}|${ticker_key || ""}`;
}

/**
 * DashboardPermissions component
 * Main interface for configuring dashboard visibility per user.
 * 
 * @returns {JSX.Element} The dashboard permissions view.
 */
export default function DashboardPermissions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshPermissions } = usePermission();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [perms, setPerms] = useState([]);
  const [userToggles, setUserToggles] = useState({});
  const [togglesInitialized, setTogglesInitialized] = useState(false);
  const [licensedModules, setLicensedModules] = useState(null);

  useEffect(() => {
    setUserToggles({});
    setTogglesInitialized(false);
  }, [selectedUserId]);

  useEffect(() => {
    if (togglesInitialized || perms.length === 0) return;
    const map = {};
    for (const p of perms) {
      const key = permKey(p.module_key, p.dashboard_key, p.card_key, p.ticker_key);
      map[key] = Number(p.can_view) === 1;
    }
    setUserToggles(map);
    setTogglesInitialized(true);
  }, [perms, togglesInitialized]);

  useEffect(() => {
    async function fetchLicense() {
      if (!selectedUserId || users.length === 0) {
        setLicensedModules(null);
        return;
      }
      const selectedUser = users.find((u) => String(u.id) === String(selectedUserId));
      if (!selectedUser || !selectedUser.company_id) {
        setLicensedModules(null);
        return;
      }
      try {
        const res = await api.get(`/licenses/company/${selectedUser.company_id}`);
        setLicensedModules(res.data?.modules || []);
      } catch (err) {
        setLicensedModules([]);
      }
    }
    fetchLicense();
  }, [selectedUserId, users]);

  const modules = useMemo(() => {
    const base = Object.entries(MODULES_REGISTRY).map(([key, val]) => {
      const fromRegistry = Array.isArray(val.dashboards) ? val.dashboards : [];
      const existing = new Set(fromRegistry.map((d) => String(d.key || "")));
      const modulesWithDashboard = new Set([
        "sales",
        "purchase",
        "inventory",
        "finance",
        "human-resources",
        "maintenance",
        "pos",
        "project-management",
        "service-management",
        "business-intelligence",
        "executive-overview",
        "transport"
      ]);
      const extras = modulesWithDashboard.has(key) ? [{ key: "dashboard", name: "Dashboard" }] : [];
      if (key === "business-intelligence") {
        extras.unshift({ key: "dashboards", name: "Dashboards" });
      }
      const excludeDashboards = new Set([
        "System Overview Dashboard",
        "User Activity Dashboard",
        "Sales Overview Dashboard",
        "Revenue Analytics Dashboard",
        "Customer Analytics Dashboard",
        "Procurement Overview Dashboard",
        "Supplier Analytics Dashboard",
        "Inventory Overview Dashboard",
        "Stock Analytics Dashboard",
        "Financial Overview Dashboard",
        "Cash Flow Dashboard",
        "Budget Analysis Dashboard",
        "Maintenance Overview Dashboard",
        "Asset Analytics Dashboard",
        "Production Overview Dashboard",
        "Efficiency Analytics Dashboard",
        "Project Overview Dashboard",
        "Resource Utilization Dashboard",
        "Service Overview Dashboard",
        "Billing Analytics Dashboard",
        "BI Overview Dashboard",
        "Executive Dashboard",
        "HR Overview Dashboard",
        "Attendance Dashboard",
        "Payroll Dashboard",
      ]);
      const dashboards = [
        ...extras.filter((d) => !existing.has(String(d.key || ""))),
        ...fromRegistry,
      ].filter((d) => {
        const name = d.name || d.label || "";
        return !excludeDashboards.has(name);
      });
      return {
        key,
        name: val.name,
        icon: val.icon,
        dashboards,
      };
    });
    base.unshift({ key: "home", name: "Home", icon: "🏠", dashboards: [] });
    return base;
  }, []);

  const KNOWN_CARDS = useMemo(() => {
    const aliasMap = {
      "human-resources": "hr",
      "project-management": "projects",
      "service-management": "service",
      "business-intelligence": "bi",
      "executive-overview": "executive",
      "administration": "admin",
    };

    const cardsMap = {
      home: Object.entries(DASHBOARD_CARDS).flatMap(([modKey, list]) =>
        (list || []).map((c) => ({
          ...c,
          moduleGroup: aliasMap[modKey] || modKey,
        }))
      ),
    };

    for (const [modKey, list] of Object.entries(DASHBOARD_CARDS)) {
      cardsMap[modKey] = list || [];
      for (const [canonical, short] of Object.entries(aliasMap)) {
        if (short === modKey) {
          cardsMap[canonical] = list || [];
        }
      }
    }
    return cardsMap;
  }, []);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
        setUsers(items);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadPerms() {
      if (!selectedUserId) {
        setPerms([]);
        return;
      }
      try {
        const res = await api.get(
          `/access/dashboard-permissions?user_id=${selectedUserId}`,
        );
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
        setPerms(items);
      } catch {
        setPerms([]);
      }
    }
    loadPerms();
  }, [selectedUserId]);

  function makeToggleHandler(module_key, dashboard_key, card_key, ticker_key, onChange) {
    return (e) => {
      const key = permKey(module_key, dashboard_key, card_key, ticker_key);
      setUserToggles((prev) => ({ ...prev, [key]: e.target.checked }));
      onChange(e.target.checked);
    };
  }

  const getView = (
    module_key,
    dashboard_key,
    card_key = null,
    ticker_key = null,
  ) => {
    const key = permKey(module_key, dashboard_key, card_key, ticker_key);
    if (key in userToggles) return userToggles[key];
    const match = perms.filter(
      (p) =>
        String(p.module_key) === String(module_key) &&
        String(p.dashboard_key || "") === String(dashboard_key || "") &&
        String(p.card_key || "") === String(card_key || "") &&
        String(p.ticker_key || "") === String(ticker_key || ""),
    );
    if (match.length === 0) {
      if (module_key === "home" && card_key) {
        const defaultCards = [
          "sales-total-revenue",
          "sales-pending-orders",
          "sales-active-customers",
          "purchase-total-value",
        ];
        return defaultCards.includes(card_key);
      }
      return true;
    }
    return match.some((p) => Number(p.can_view) === 1);
  };
  const setView = (module_key, dashboard_key, card_key, ticker_key, value) => {
    setPerms((prev) => {
      const matched = prev.filter(
        (p) =>
          String(p.module_key) === String(module_key) &&
          String(p.dashboard_key || "") === String(dashboard_key || "") &&
          String(p.card_key || "") === String(card_key || "") &&
          String(p.ticker_key || "") === String(ticker_key || ""),
      );
      if (matched.length > 0) {
        // Update ALL matching records (handles duplicates)
        return prev.map((p) =>
          String(p.module_key) === String(module_key) &&
          String(p.dashboard_key || "") === String(dashboard_key || "") &&
          String(p.card_key || "") === String(card_key || "") &&
          String(p.ticker_key || "") === String(ticker_key || "")
            ? { ...p, can_view: value ? 1 : 0 }
            : p,
        );
      }
      return [
        ...prev,
        {
          user_id: Number(selectedUserId),
          module_key,
          dashboard_key: dashboard_key || null,
          card_key: card_key || null,
          ticker_key: ticker_key || null,
          can_view: value ? 1 : 0,
        },
      ];
    });
  };

  const persistPermission = async (module_key, type, key, allow) => {
    if (!selectedUserId) return;
    const dashboard_key = type === "dashboard" ? key : null;
    const card_key = type === "card" ? key : null;
    const ticker_key = type === "ticker" ? key : null;
    setView(module_key, dashboard_key, card_key, ticker_key, allow);

    const permissionsToSave = [
      {
        module_key,
        dashboard_key,
        card_key,
        ticker_key,
        can_view: allow ? 1 : 0,
      },
    ];

    // If card has recognized aliases, sync them as well
    if (type === "card" && card_key) {
      const aliases = getAllCardAliases(card_key);
      for (const alias of aliases) {
        if (alias !== card_key) {
          setView(module_key, null, alias, null, allow);
          permissionsToSave.push({
            module_key,
            dashboard_key: null,
            card_key: alias,
            ticker_key: null,
            can_view: allow ? 1 : 0,
          });
        }
      }
    }

    // If customizing Home for the first time, preserve the other default cards
    if (module_key === "home" && type === "card") {
      const existingHomeCards = perms.filter(
        (p) => String(p.module_key) === "home" && p.card_key
      );
      if (existingHomeCards.length === 0) {
        const defaultCards = [
          "sales-total-revenue",
          "sales-pending-orders",
          "sales-active-customers",
          "purchase-total-value",
        ];
        defaultCards.forEach((dc) => {
          if (dc !== key) {
            setView("home", null, dc, null, true);
            permissionsToSave.push({
              module_key: "home",
              dashboard_key: null,
              card_key: dc,
              ticker_key: null,
              can_view: 1,
            });
          }
        });
      }
    }

    try {
      await api.put("/access/dashboard-permissions", {
        user_id: Number(selectedUserId),
        permissions: permissionsToSave,
      });
      await refreshPermissions();
      try {
        localStorage.setItem("rbac:bump", String(Date.now()));
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      toast.success(
        `${allow ? "✅" : "🚫"} ${String(type === "dashboard" ? key : type === "card" ? key : key)
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())} ${
          type === "dashboard" ? "dashboard" : type === "card" ? "card" : "ticker"
        } ${allow ? "enabled" : "disabled"}`,
        { autoClose: 2000 }
      );
    } catch (err) {
      // Revert optimistic update on failure
      setView(module_key, dashboard_key, card_key, ticker_key, !allow);
      toast.error(err.response?.data?.message || "Failed to save");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Permissions</h1>
          <p className="text-sm text-slate-600">
            Control which dashboards/cards/tickers a user can view
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/administration")}
        >
          Back to Admin
        </button>
      </div>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="max-w-md">
            <label className="label">User</label>
            <select
              className="input w-full"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username || u.full_name || `User #${u.id}`}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && (
            <div className="space-y-6">
              {modules.map((m) => {
                let cards = KNOWN_CARDS[m.key] || [];
                if (m.key === "home") {
                  if (licensedModules && Array.isArray(licensedModules) && licensedModules.length > 0) {
                    cards = cards.filter((c) => {
                      const mod = c.moduleGroup;
                      return licensedModules.includes(mod) || licensedModules.includes(m.key);
                    });
                  }
                }
                const hasDashboards = m.dashboards.length > 0;
                const hasCards = cards.length > 0;
                if (!hasDashboards && !hasCards && m.key !== "home")
                  return null;

                return (
                  <div key={m.key} className="border rounded-lg">
                    <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="font-semibold">
                        {m.icon} {m.name}
                      </div>
                      {(hasDashboards || hasCards) && m.key !== "home" && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={
                              (hasDashboards || hasCards) &&
                              (!hasDashboards ||
                                m.dashboards.every((d) =>
                                  getView(m.key, d.key),
                                )) &&
                              (!hasCards ||
                                cards.every((c) =>
                                  getView(m.key, null, c.key, null),
                                ))
                            }
                            onChange={async (e) => {
                              const val = e.target.checked;
                              const updates = {};
                              const permsList = [];
                              m.dashboards.forEach((d) => {
                                const k = permKey(m.key, d.key, null, null);
                                updates[k] = val;
                                setView(m.key, d.key, null, null, val);
                                permsList.push({
                                  module_key: m.key,
                                  dashboard_key: d.key,
                                  card_key: null,
                                  ticker_key: null,
                                  can_view: val ? 1 : 0,
                                });
                              });

                              if (hasDashboards && m.key !== "home") {
                                const k1 = permKey(m.key, "dashboard", null, null);
                                const k2 = permKey(m.key, "dashboards", null, null);
                                updates[k1] = val;
                                updates[k2] = val;
                                setView(m.key, "dashboard", null, null, val);
                                setView(m.key, "dashboards", null, null, val);
                                permsList.push({
                                  module_key: m.key,
                                  dashboard_key: "dashboard",
                                  card_key: null,
                                  ticker_key: null,
                                  can_view: val ? 1 : 0,
                                });
                                permsList.push({
                                  module_key: m.key,
                                  dashboard_key: "dashboards",
                                  card_key: null,
                                  ticker_key: null,
                                  can_view: val ? 1 : 0,
                                });
                              }

                              cards.forEach((c) => {
                                const k = permKey(m.key, null, c.key, null);
                                updates[k] = val;
                                setView(m.key, null, c.key, null, val);
                                permsList.push({
                                  module_key: m.key,
                                  dashboard_key: null,
                                  card_key: c.key,
                                  ticker_key: null,
                                  can_view: val ? 1 : 0,
                                });
                              });
                              setUserToggles((prev) => ({ ...prev, ...updates }));
                              if (permsList.length > 0 && selectedUserId) {
                                try {
                                  await api.put("/access/dashboard-permissions", {
                                    user_id: Number(selectedUserId),
                                    permissions: permsList,
                                  });
                                  await refreshPermissions();
                                  try {
                                    window.dispatchEvent(new Event("rbac:changed"));
                                  } catch {}
                                  const label =
                                    m.name ||
                                    String(m.key || "")
                                      .replace(/-/g, " ")
                                      .replace(/\b\w/g, (c) => c.toUpperCase());
                                  toast.success(
                                    `${val ? "✅" : "🚫"} ${label} — all permissions ${
                                      val ? "enabled" : "disabled"
                                    }`,
                                    { autoClose: 2000 }
                                  );
                                } catch {
                                  toast.error("Failed to save permissions");
                                }
                              }
                            }}
                          />
                          <span>Select All</span>
                        </label>
                      )}
                    </div>
                    <div className="p-4 space-y-4">
                      {hasDashboards && m.key !== "home" && (
                        <div className="mb-2">
                          <label className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={getView(m.key, "dashboard") || getView(m.key, "dashboards")}
                              onChange={(e) => {
                                const val = e.target.checked;
                                const handler = makeToggleHandler(m.key, "dashboard", null, null, (newVal) => {
                                  setView(m.key, "dashboard", null, null, newVal);
                                  setView(m.key, "dashboards", null, null, newVal);
                                  persistPermission(m.key, "dashboard", "dashboard", newVal);
                                  persistPermission(m.key, "dashboard", "dashboards", newVal);
                                });
                                handler(e);
                              }}
                            />
                            <span>📊 Dashboard</span>
                          </label>
                        </div>
                      )}
                      {cards.length > 0 && (
                        <div className="">
                          {m.key === "home" ? (
                            <div className="space-y-4">
                              {Array.from(new Set(cards.map((c) => c.moduleGroup))).map((modGroup) => {
                                const groupCards = cards.filter((c) => c.moduleGroup === modGroup);
                                if (groupCards.length === 0) return null;
                                return (
                                  <div key={modGroup} className="border-b border-slate-100 pb-3 last:border-0">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                      {modGroup}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                      {groupCards.map((c) => (
                                        <label key={c.key} className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={getView(m.key, null, c.key, null)}
                                            onChange={(e) => {
                                              const val = e.target.checked;
                                              if (val) {
                                                let checkedCount = 0;
                                                cards.forEach((hc) => {
                                                  if (getView("home", null, hc.key, null)) checkedCount++;
                                                });
                                                if (checkedCount >= 8) {
                                                  toast.error(
                                                    "You can only select up to 8 cards for the Home dashboard."
                                                  );
                                                  return;
                                                }
                                              }
                                              const handler = makeToggleHandler(m.key, null, c.key, null, (newVal) => {
                                                setView(m.key, null, c.key, null, newVal);
                                                persistPermission(m.key, "card", c.key, newVal);
                                              });
                                              handler(e);
                                            }}
                                          />
                                          <span className="text-sm">{c.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                              {cards.map((c) => (
                                <label
                                  key={c.key}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={getView(m.key, null, c.key, null)}
                                    onChange={makeToggleHandler(m.key, null, c.key, null, (val) => {
                                      setView(m.key, null, c.key, null, val);
                                      persistPermission(m.key, "card", c.key, val);
                                    })}
                                  />
                                  <span className="text-sm">
                                    {c.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardTickerEditor({ entries = [], onChange }) {
  const [value, setValue] = useState("");
  const list = entries
    .filter((e) => e.can_view)
    .map((e) => e.card_key || e.ticker_key)
    .filter(Boolean);
  const remove = (k) => {
    const next = list.filter((x) => String(x) !== String(k));
    onChange(next);
  };
  const add = () => {
    const k = value.trim();
    if (!k) return;
    if (!list.includes(k)) onChange([...list, k]);
    setValue("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Enter key (e.g., total-sales)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className="btn" onClick={add}>
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((k) => (
          <span
            key={k}
            className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center gap-2"
          >
            {k}
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={() => remove(k)}
              title="Remove"
            >
              ✕
            </button>
          </span>
        ))}
        {!list.length && (
          <span className="text-xs text-slate-500">
            No entries. Add keys to allow viewing.
          </span>
        )}
      </div>
    </div>
  );
}

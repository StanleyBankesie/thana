/**
 * @fileoverview HomePage component.
 * Serves as the main landing dashboard for users, displaying metrics, pending approvals, and notifications.
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { usePermission } from "../../auth/PermissionContext.jsx";
import client from "../../api/client";
import CompanyFeed from "../../components/CompanyFeed/CompanyFeed";
import { toast } from "react-toastify";
import { getModuleDashboards } from "../../data/modulesRegistry.js";
import { DASHBOARD_CARDS } from "../../data/dashboardCards.js";

/**
 * HomePage component
 * Main overview page aggregating data from across the system based on user permissions.
 * 
 * @returns {JSX.Element} The home page view.
 */
export default function HomePage() {
  const { user, token, scope } = useAuth();
  const {
    canAccessPath,
    hasRoleFeature,
    canViewDashboardElement,
    canReverseApproval,
    getEnabledModules,
    isModuleEnabled,
  } = usePermission();
  const navigate = useNavigate();
  const [pendingItems, setPendingItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showPostAlerts, setShowPostAlerts] = useState(false);
  const [postAlerts, setPostAlerts] = useState([]);
  const [postAlertsLoading, setPostAlertsLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [modalInstanceId, setModalInstanceId] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalComment, setModalComment] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProcessing, setModalProcessing] = useState(false);
  const [modalNextUser, setModalNextUser] = useState(null);
  // legacy chat widget removed
  const postRef = useRef(null);
  const pendingHeaderRef = useRef(null);
  const [pendingHeight, setPendingHeight] = useState(null);
  const [reportsModules, setReportsModules] = useState([]);
  const [roleFeatures, setRoleFeatures] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [userBranches, setUserBranches] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const photoInputRef = useRef(null);
  const moduleReportsMap = useMemo(
    () => ({
      inventory: [
        { label: "Stock Balances", path: "/inventory/reports/stock-balances" },
        { label: "Issue Register", path: "/inventory/reports/issue-register" },
        {
          label: "Stock Summary",
          path: "/inventory/reports/periodical-stock-summary",
        },
        {
          label: "Stock Statement",
          path: "/inventory/reports/periodical-stock-statement",
        },
        {
          label: "Stock Transfer Register",
          path: "/inventory/reports/stock-transfer-register",
        },
        {
          label: "Stock Verification",
          path: "/inventory/reports/stock-verification",
        },
        {
          label: "Stock Aging Analysis",
          path: "/inventory/reports/stock-aging-analysis",
        },
        { label: "Slow Moving Items", path: "/inventory/reports/slow-moving" },
        { label: "Fast Moving Items", path: "/inventory/reports/fast-moving" },
        { label: "Non Moving Items", path: "/inventory/reports/non-moving" },
      ],
      purchase: [
        {
          label: "Supplier Quotation Analysis",
          path: "/purchase/reports/supplier-quotation-analysis",
        },
        {
          label: "Import Purchase Order Tracking",
          path: "/purchase/reports/import-order-tracking",
        },
        {
          label: "Local Purchase Order Tracking",
          path: "/purchase/reports/local-order-tracking",
        },
        {
          label: "Pending GRN → Bill (Local)",
          path: "/purchase/reports/pending-grn-to-bill-local",
        },
        {
          label: "Pending GRN → Bill (Import)",
          path: "/purchase/reports/pending-grn-to-bill-import",
        },
        {
          label: "Import Order List",
          path: "/purchase/reports/import-order-list",
        },
        {
          label: "Pending Shipment Details",
          path: "/purchase/reports/pending-shipments",
        },
        {
          label: "Purchase Register",
          path: "/purchase/reports/purchase-register",
        },
      ],
      sales: [
        { label: "Debtors Balance", path: "/sales/reports/debtors-balance" },
        {
          label: "Sales Profitability",
          path: "/sales/reports/sales-profitability",
        },
        { label: "Sales Tracking", path: "/sales/reports/sales-tracking" },
      ],
      finance: [
        {
          label: "Voucher Register",
          path: "/finance/reports/voucher-register",
        },
        { label: "Payment Due", path: "/finance/reports/payment-due" },
        {
          label: "Customer Outstanding",
          path: "/finance/reports/customer-outstanding",
        },
        { label: "Trial Balance", path: "/finance/reports/trial-balance" },
        { label: "Audit Trail", path: "/finance/reports/audit-trail" },
        { label: "Journal Report", path: "/finance/reports/journals" },
        { label: "General Ledger", path: "/finance/reports/general-ledger" },
        { label: "Debtors Ledger", path: "/finance/reports/debtors-ledger" },
        {
          label: "Creditors Ledger",
          path: "/finance/reports/creditors-ledger",
        },
        {
          label: "Supplier Outstanding",
          path: "/finance/reports/supplier-outstanding",
        },
        { label: "Profit & Loss", path: "/finance/reports/profit-and-loss" },
        { label: "Balance Sheet", path: "/finance/reports/balance-sheet" },
        { label: "Cash Flow", path: "/finance/reports/cash-flow" },
        { label: "Ratio Analysis", path: "/finance/reports/ratio-analysis" },
      ],
      "service-management": [
        {
          label: "Service Request Summary",
          path: "/service-management/reports/service-request-summary",
        },
        {
          label: "Service Order Status",
          path: "/service-management/reports/service-order-status",
        },
        {
          label: "Execution Performance",
          path: "/service-management/reports/execution-performance",
        },
        {
          label: "SLA Compliance",
          path: "/service-management/reports/sla-compliance",
        },
        {
          label: "Service Revenue",
          path: "/service-management/reports/service-revenue",
        },
        {
          label: "Outstanding Service Bills",
          path: "/service-management/reports/outstanding-bills",
        },
        {
          label: "Service Confirmation",
          path: "/service-management/reports/service-confirmation",
        },
        {
          label: "Technician Utilization",
          path: "/service-management/reports/technician-utilization",
        },
        {
          label: "Service Cost Analysis",
          path: "/service-management/reports/service-cost-analysis",
        },
        {
          label: "Repeat Service Requests",
          path: "/service-management/reports/repeat-requests",
        },
        {
          label: "Service Type Performance",
          path: "/service-management/reports/service-type-performance",
        },
      ],
      administration: [
        {
          label: "System Log Book Report",
          path: "/administration/reports/system-log-book",
        },
        {
          label: "User Login Activity",
          path: "/administration/reports/user-login-activity",
        },
      ],
    }),
    [],
  );
  const moduleDashboardPath = useMemo(
    () => ({
      sales: "/sales/dashboard",
      purchase: "/purchase/dashboard",
      finance: "/finance/dashboard",
      "human-resources": "/human-resources/dashboard",
      "service-management": "/service-management/dashboard",
      pos: "/pos/dashboard",
      inventory: "/inventory/dashboard",
      "business-intelligence": "/business-intelligence/analytics",
      production: "/production/dashboard",
      maintenance: "/maintenance/dashboard",
      "project-management": "/project-management/dashboard",
    }),
    [],
  );

  useEffect(() => {
    function measure() {
      try {
        const root = postRef.current;
        if (!root) return;
        const card = root.parentElement;
        const h = card ? card.offsetHeight : 0;
        if (h && Math.abs(h - (pendingHeight || 0)) > 8) {
          setPendingHeight(h);
        }
      } catch {}
    }
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const t = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 250);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [pendingHeight]);

  useEffect(() => {
    let cancelled = false;
    async function loadPerms() {
      try {
        const [upRes, featRes] = await Promise.all([
          client.get("/admin/user-permissions"),
          client.get("/access/features"),
        ]);
        const up = upRes?.data || {};
        const fr = featRes?.data || {};
        if (!cancelled) {
          setReportsModules(Array.isArray(up?.modules) ? up.modules : []);
          setRoleFeatures(
            Array.isArray(up?.role_features) ? up.role_features : [],
          );
          setAllFeatures(Array.isArray(fr?.features) ? fr.features : []);
        }
      } catch {
        if (!cancelled) {
          setReportsModules([]);
          setRoleFeatures([]);
          setAllFeatures([]);
        }
      }
    }
    loadPerms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    client
      .get("/workflows/approvals/pending")
      .then((res) => {
        if (cancelled) return;
        setPendingItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingItems([]);
      });

    client
      .get("/workflows/notifications")
      .then((res) => {
        if (cancelled) return;
        setNotifications(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setNotifications([]);
      });

    client
      .get("/bi/home-overview")
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        setProfileData(res.data?.user || null);
      })
      .catch(() => {
        if (cancelled) return;
        setProfileData(null);
      });
    client
      .get("/auth/user-branches")
      .then((res) => {
        if (cancelled) return;
        setUserBranches(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setUserBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBranch = useMemo(() => {
    if (!Array.isArray(userBranches) || userBranches.length === 0) return null;
    const targetId = Number(scope?.branchId);
    if (targetId) {
      return userBranches.find((b) => Number(b.id) === targetId) || null;
    }
    return userBranches[0] || null;
  }, [userBranches, scope?.branchId]);

  const displayCompanyName = activeBranch?.company_name || profileData?.company_name || user?.companyName || "";
  const displayBranchName = activeBranch?.name || profileData?.branch_name || user?.branchName || "";

  const normalizeType = (s) =>
    String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  const displayType = (s) => {
    const t = normalizeType(s);
    if (t === "MATERIAL_REQUISITION") return "Material Requisition";
    if (t === "RETURN_TO_STORES") return "Return to Stores";
    if (t === "SALES_ORDER") return "Sales Order";
    if (t === "JOURNAL_VOUCHER" || t === "JV") return "Journal Voucher";
    if (t === "PAYMENT_VOUCHER" || t === "PV") return "Payment Voucher";
    if (t === "RECEIPT_VOUCHER" || t === "RV") return "Receipt Voucher";
    if (t === "CONTRA_VOUCHER" || t === "CV") return "Contra Voucher";
    if (t.startsWith("PURCHASE_ORDER:")) {
      const sub = t.split(":")[1];
      if (sub === "LOCAL") return "Purchase Order - Local";
      if (sub === "IMPORT") return "Purchase Order - Import";
      return "Purchase Order";
    }
    if (t === "GOODS_RECEIPT") return "GRN";
    if (t === "GRN") return "GRN";
    if (t === "GOODS_RECEIPT_NOTE") return "GRN";
    if (
      t === "GOODS_RECEIPT:LOCAL" ||
      t === "GRN:LOCAL" ||
      t === "GOODS_RECEIPT_NOTE:LOCAL"
    )
      return "GRN Local";
    if (
      t === "GOODS_RECEIPT:IMPORT" ||
      t === "GRN:IMPORT" ||
      t === "GOODS_RECEIPT_NOTE:IMPORT"
    )
      return "GRN Import";
    return String(s || "Document");
  };
  const typeKey = (it) => {
    const base = normalizeType(it.document_type);
    if (base === "PURCHASE_ORDER") {
      const sub = normalizeType(it.po_type);
      return sub ? `${base}:${sub}` : base;
    }
    if (
      base === "GOODS_RECEIPT" ||
      base === "GRN" ||
      base === "GOODS_RECEIPT_NOTE"
    ) {
      const ref = String(it.doc_ref || "");
      const sub = ref.startsWith("GL-")
        ? "LOCAL"
        : ref.startsWith("GI-")
          ? "IMPORT"
          : "";
      return sub ? `${base}:${sub}` : base;
    }
    return base;
  };
  const uniquePending = useMemo(() => {
    const m = new Map();
    for (const it of pendingItems) {
      const key = String(
        it.workflow_instance_id ||
          `${normalizeType(it.document_type)}-${it.document_id}`,
      );
      if (!m.has(key)) m.set(key, it);
    }
    return Array.from(m.values());
  }, [pendingItems]);
  const filteredPending = useMemo(() => {
    const uid = Number(user?.sub || user?.id);
    return uniquePending.filter((it) => {
      const candidates = [
        Number(it.approver_user_id),
        Number(it.assigned_user_id),
        Number(it.target_user_id),
        Number(it.approver_id),
        Number(it.user_id),
      ];
      const aid = candidates.find((x) => Number.isFinite(x) && x > 0) ?? null;
      if (!Number.isFinite(uid) || uid <= 0) return true;
      // Exclude documents where current user is an authorized approver
      return aid == null || aid !== uid;
    });
  }, [uniquePending, user?.sub, user?.id]);
  const groupedPending = useMemo(() => {
    const out = {};
    for (const it of filteredPending) {
      const k = typeKey(it);
      if (!out[k]) out[k] = [];
      out[k].push(it);
    }
    return out;
  }, [filteredPending]);
  const orderedGroups = useMemo(() => {
    const keys = Object.keys(groupedPending);
    const order = [
      "MATERIAL_REQUISITION",
      "RETURN_TO_STORES",
      "STOCK_ADJUSTMENT",
    ];
    const head = order.filter((k) => keys.includes(k));
    const tail = keys.filter((k) => !order.includes(k)).sort();
    return [...head, ...tail];
  }, [groupedPending]);
  const docLabel = (it) => {
    const t = displayType(typeKey(it));
    const ref = it.doc_ref ? String(it.doc_ref) : `#${it.document_id}`;
    return `${t} ${ref}`;
  };

  const openApprovalModal = async (id) => {
    setShowApprovalModal(true);
    setModalInstanceId(id);
    setModalLoading(true);
    setModalData(null);
    setModalComment("");
    try {
      const res = await client.get(`/workflows/approvals/instance/${id}`);
      const item = res.data?.item || null;
      setModalData(item);
      if (
        item &&
        !item.is_last_step &&
        Array.isArray(item.next_step_approvers)
      ) {
        const first = item.next_step_approvers[0];
        setModalNextUser(first ? first.id : null);
      } else {
        setModalNextUser(null);
      }
    } catch (e) {
      setModalData(null);
    } finally {
      setModalLoading(false);
    }
  };

  const extractInstanceIdFromLink = (link) => {
    const s = String(link || "");
    const m = s.match(/approvals\/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const markNotificationRead = async (id) => {
    try {
      await client.put(`/workflows/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
    } catch {
      // ignore
    }
  };

  const closeApprovalModal = () => {
    setShowApprovalModal(false);
    setModalInstanceId(null);
    setModalData(null);
    setModalComment("");
    setModalLoading(false);
    setModalProcessing(false);
    setModalNextUser(null);
  };

  const handleModalAction = async (action) => {
    if (!modalInstanceId) return;
    if (!modalComment && (action === "REJECT" || action === "RETURN")) {
      toast.warning("Please provide a comment for rejection/return");
      return;
    }
    if (action === "APPROVE" && modalData && !modalData.is_last_step) {
      if (!modalNextUser) {
        toast.warning("Please select the next approver");
        return;
      }
    }
    setModalProcessing(true);
    try {
      await client.post(`/workflows/${modalInstanceId}/action`, {
        action,
        comments: modalComment,
        target_user_id:
          modalData && !modalData.is_last_step ? modalNextUser : null,
      });
      try {
        const status =
          action === "APPROVE"
            ? modalData && modalData.is_last_step
              ? "APPROVED"
              : "PENDING_APPROVAL"
            : action === "RETURN"
              ? "DRAFT"
              : action;
        const evt = new CustomEvent("omni.workflow.status", {
          detail: {
            status,
            documentType: modalData?.document_type,
            documentId: modalData?.document_id,
            instanceId: modalInstanceId,
            action: action,
          },
        });
        window.dispatchEvent(evt);
      } catch {}
      setPendingItems((items) =>
        items.filter((i) => i.workflow_instance_id !== modalInstanceId),
      );
      try {
        const msg =
          action === "APPROVE"
            ? modalData && !modalData.is_last_step
              ? (() => {
                  const name =
                    Array.isArray(modalData?.next_step_approvers) &&
                    modalData.next_step_approvers.find(
                      (u) => Number(u.id) === Number(modalNextUser),
                    )?.username;
                  return `Forwarded to ${name || "next approver"}`;
                })()
              : "Document approved successfully"
            : action === "REJECT"
              ? "Document rejected successfully"
              : action === "RETURN"
                ? "Document returned successfully"
                : "Action completed successfully";
        toast.success(msg);
      } catch {}
      closeApprovalModal();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Action failed");
    } finally {
      setModalProcessing(false);
    }
  };

  function fmtCurrency(n) {
    const num = Number(n || 0);
    return `GH₵${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const allPossibleMetrics = React.useMemo(() => {
    const defaultIcons = {
      sales: "💰", purchase: "🛒", inventory: "📦", finance: "🏦", hr: "👔",
      maintenance: "🛠️", production: "🏭", projects: "📌", pos: "💳",
      bi: "📈", executive: "👔", service: "📨", transport: "🚚", admin: "👤", system: "⚙️"
    };
    const defaultPaths = {
      sales: "/sales", purchase: "/purchase", inventory: "/inventory", finance: "/finance", hr: "/human-resources",
      maintenance: "/maintenance", production: "/production", projects: "/project-management", pos: "/pos",
      bi: "/reports", executive: "/reports", service: "/service-management", transport: "/transport", admin: "/administration", system: "/system-configuration"
    };
    const modAlias = {
      hr: "human-resources",
      projects: "project-management",
      service: "service-management",
      bi: "business-intelligence",
      executive: "executive-overview",
      admin: "administration"
    };

    const metrics = [];
    Object.entries(DASHBOARD_CARDS).forEach(([rawModKey, cards]) => {
      const canonicalMod = modAlias[rawModKey] || rawModKey;
      const modAllowed = isModuleEnabled(canonicalMod) || isModuleEnabled(rawModKey);
      
      cards.forEach(card => {
        // Check if card is forbidden in its parent module
        if (canViewDashboardElement(rawModKey, "card", card.key) === false) {
          return;
        }
        // Check if card is permitted on Home
        const cardAllowedForHome = canViewDashboardElement("home", "card", card.key);
        if (cardAllowedForHome === false) {
          return;
        }
        if (!modAllowed && !cardAllowedForHome) {
          return;
        }

        let val = 0;
        
        // Comprehensive mapping for values:
        if (card.key === "pos-today-sales") val = overview?.todaySales || 0;
        else if (card.key === "pos-total-transactions") val = overview?.totalTransactions || 0;
        else if (card.key === "pos-avg-order") val = overview?.averageOrder || 0;
        else if (card.key === "pos-monthly-revenue") val = overview?.monthlyRevenue || 0;
        else if (card.key === "sales-active-customers") val = overview?.totalCustomers || 0;
        else if (card.key === "bi-company-revenue") val = overview?.monthlyRevenue || 0;
        else if (card.key === "bi-profit-margin") val = overview?.profitMargin || "24%";
        else if (card.key === "bi-top-product") val = overview?.topProduct || "Best Seller";
        else if (card.key === "sales-pending-orders") val = overview?.openQuotations || 0;
        else if (card.key === "sales-total-revenue") val = overview?.monthlyRevenue || 0;
        else if (card.key === "purchase-total-value") val = overview?.totalPurchases || 0;
        else if (card.key === "purchase-pending-pos") val = overview?.activePOs || 0;
        else if (card.key === "purchase-active-suppliers") val = overview?.activeSuppliers || 0;
        else if (card.key === "inventory-total-items") val = overview?.itemsTracked || overview?.totalItems || 0;
        else if (card.key === "inventory-lowStock" || card.key === "inventory-low-stock") val = overview?.lowStockItems || 0;
        else if (card.key === "inventory-warehouses") val = overview?.totalWarehouses || 1;
        else if (card.key === "finance-cash-balance") val = overview?.cashBalance || 0;
        else if (card.key === "finance-ar") val = overview?.arOutstanding || 0;
        else if (card.key === "finance-ap") val = overview?.apOutstanding || 0;
        else if (card.key === "hr-total-employees") val = overview?.activeEmployees || 0;
        else if (card.key === "hr-on-leave") val = overview?.onLeave || 0;
        else if (card.key === "hr-new-hires") val = overview?.newHires || 0;
        else if (card.key === "maint-open-work-orders") val = overview?.openRequests || overview?.openWorkOrders || 0;
        else if (card.key === "maint-assets-in-maint") val = overview?.activeJobs || 0;
        else if (card.key === "maint-total-assets") val = overview?.totalAssets || 0;
        else if (card.key === "prod-active-orders") val = overview?.activeProductionOrders || 0;
        else if (card.key === "prod-completed-orders") val = overview?.completedOrders || 0;
        else if (card.key === "prod-yield") val = overview?.productionYield || "98%";
        else if (card.key === "pm-active-projects") val = overview?.activeProjects || 0;
        else if (card.key === "pm-overdue-tasks") val = overview?.overdueTasks || 0;
        else if (card.key === "pm-total-milestones") val = overview?.totalMilestones || 0;
        else if (card.key === "exec-gross-profit") val = overview?.grossProfit || overview?.monthlyRevenue || 0;
        else if (card.key === "exec-net-income") val = overview?.netIncome || 0;
        else if (card.key === "exec-total-expenses") val = overview?.totalExpenses || 0;
        else if (card.key === "sm-active-contracts") val = overview?.serviceRequests || 0;
        else if (card.key === "sm-pending-invoices") val = overview?.pendingServiceInvoices || 0;
        else if (card.key === "sm-total-revenue") val = overview?.totalServiceRevenue || 0;
        else if (card.key === "trans-ongoing-trips") val = overview?.activeTrips || 0;
        else if (card.key === "trans-active-vehicles") val = overview?.totalVehicles || 0;
        else if (card.key === "trans-pending-maint") val = overview?.pendingMaintenance || 0;
        else if (card.key === "admin-active-users") val = overview?.activeUsers || 0;
        else if (card.key === "admin-role-count") val = overview?.roleCount || 0;
        else if (card.key === "admin-recent-logins") val = overview?.recentLogins || 0;
        else if (card.key === "sys-cpu-usage") val = overview?.cpuUsage || "12%";
        else if (card.key === "sys-memory-usage") val = overview?.memoryUsage || "45%";
        else if (card.key === "sys-active-sessions") val = overview?.activeSessions || 1;
        
        // Currency formatting for known monetary values
        const isMonetary = ["sales-total-revenue", "pos-today-sales", "pos-avg-order", "pos-monthly-revenue", "bi-company-revenue", "purchase-total-value", "finance-cash-balance", "finance-ar", "finance-ap", "exec-gross-profit", "exec-net-income", "exec-total-expenses", "sm-total-revenue"].includes(card.key);
        const finalValue = isMonetary ? fmtCurrency(val) : String(val);

        metrics.push({
          key: card.key,
          moduleKey: rawModKey,
          label: card.label,
          value: finalValue,
          badge: overview?.badges?.[card.key]?.text || "",
          icon: defaultIcons[rawModKey] || "📊",
          path: defaultPaths[rawModKey] || "/"
        });
      });
    });
    
    return metrics;
  }, [overview, fmtCurrency, isModuleEnabled, canViewDashboardElement]);

  const visibleMetrics = React.useMemo(() => {
    const checked = allPossibleMetrics.filter((m) => {
      if (!m.key) return false;
      if (m.moduleKey && canViewDashboardElement(m.moduleKey, "card", m.key) === false) {
        return false;
      }
      return canViewDashboardElement("home", "card", m.key) === true;
    });

    return checked.slice(0, 8);
  }, [allPossibleMetrics, canViewDashboardElement]);

  // Quick Actions section removed per request

  const approvedNotifications = useMemo(() => {
    const uid = Number(user?.sub || user?.id);
    const filtered = notifications.filter((n) => {
      const msg = String(n?.message || "").toLowerCase();
      const isApproved = msg.includes("approved");
      const candidates = [
        Number(n.user_id),
        Number(n.target_user_id),
        Number(n.recipient_id),
        Number(n.assigned_user_id),
        Number(n.request_user_id),
      ];
      const rid = candidates.find((x) => Number.isFinite(x) && x > 0) ?? null;
      const belongs =
        Number.isFinite(uid) && uid > 0 ? rid == null || rid === uid : true;
      return isApproved && belongs;
    });
    return filtered;
  }, [notifications, user?.sub, user?.id]);
  const postNotificationsUnread = useMemo(
    () =>
      notifications.filter(
        (n) =>
          Number(n.is_read) !== 1 &&
          String(n.link || "").startsWith("/social-feed"),
      ),
    [notifications],
  );
  const postNotificationsAll = useMemo(
    () =>
      notifications.filter((n) =>
        String(n.link || "").startsWith("/social-feed")
      ),
    [notifications],
  );
  const otherNotificationsUnread = useMemo(
    () =>
      notifications.filter(
        (n) =>
          Number(n.is_read) !== 1 &&
          !String(n.link || "").startsWith("/social-feed"),
      ),
    [notifications],
  );
  const loadPostAlerts = async () => {
    try {
      setPostAlertsLoading(true);
      const res = await client.get(`/social-feed?offset=0&limit=200`);
      const data = res?.data || {};
      const items = Array.isArray(data.data) ? data.data : [];
      setPostAlerts(items);
    } catch {
      setPostAlerts([]);
    } finally {
      setPostAlertsLoading(false);
    }
  };

  const fullName = user?.full_name || user?.name || user?.username || "User";

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await client.put("/auth/me/photo", {
        profile_picture: base64,
      });
      setProfileData(data.user || null);
      toast.success("Photo updated");
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setProfileData((prev) =>
      prev ? { ...prev, profile_picture_url: null } : prev,
    );
  };

  return (
    <div className="min-h-screen p-2 md:p-3 font-sans text-slate-900 bg-slate-50 dark:bg-transparent">
      <div className="max-w-7xl mx-auto space-y-4 fullbleed-sm">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 to-brand-800 p-8 shadow-erp text-white">
          <div className="relative z-10 flex items-start gap-5">
            <div className="relative shrink-0">
              <div
                className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-white/30 cursor-pointer"
                onClick={() => setShowPhotoMenu((v) => !v)}
              >
                {profileData?.profile_picture_url ? (
                  <img
                    src={profileData.profile_picture_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-white/70">
                    {fullName.charAt(0).toUpperCase()}
                  </span>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <span className="text-white text-xs">...</span>
                  </div>
                )}
              </div>
              {showPhotoMenu && (
                <div className="absolute top-full mt-2 left-0 flex flex-col gap-1 min-w-[140px] z-50">
                  <button
                    type="button"
                    className="text-left text-sm text-white/90 hover:text-white"
                    onClick={() => {
                      setShowPhotoMenu(false);
                      photoInputRef.current?.click();
                    }}
                  >
                    {profileData?.profile_picture_url ? "Replace" : "Upload"}
                  </button>
                  <button
                    type="button"
                    className="text-left text-sm text-red-300 hover:text-red-200"
                    onClick={() => {
                      setShowPhotoMenu(false);
                      handlePhotoRemove();
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                ref={photoInputRef}
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {fullName}!
              </h1>
              {profileData?.role_name && (
                <p className="hidden sm:block mt-1 text-brand-200 text-sm font-medium">
                  {profileData.role_name}
                </p>
              )}
              {(displayCompanyName || displayBranchName) && (
                <p className="hidden sm:block mt-1 text-brand-200 text-sm">
                  {[displayCompanyName, displayBranchName]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
              <p className="hidden sm:block mt-2 text-brand-100 text-lg max-w-2xl">
                Here's an overview of your business performance and pending
                tasks today.
              </p>
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-20" />
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="hidden md:flex absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-2 items-center gap-2"
          >
            <span>🔔</span>
            <span className="relative inline-flex items-center">
              <span className="sr-only">Unread</span>
              <span className="ml-1 text-sm">Notifications</span>
              {notifications.filter((n) => Number(n.is_read) !== 1).length >
                0 && (
                <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {notifications.filter((n) => Number(n.is_read) !== 1).length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Tickers / Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-3 md:px-0">
          {visibleMetrics.map((metric, index) => {
            const cardType = index % 4;
            if (cardType === 0) {
              // Card 1: Amber Gold
              return (
                <div
                  key={index}

                  className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(178,110,23,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(178,110,23,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#b26e17] text-white"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex justify-end min-h-[22px]">
                      {metric.badge ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] leading-none flex items-center gap-1">
                          {metric.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-6">
                      <div
                        className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
                        style={{
                          textShadow: "0 0 12px rgba(255, 255, 255, 0.45)",
                        }}
                      >
                        {metric.value}
                      </div>
                      <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                        {metric.label}
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </div>
              );
            } else if (cardType === 1) {
              // Card 2: Steel Blue
              return (
                <div
                  key={index}

                  className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(36,82,109,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(36,82,109,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#24526d] text-white"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex justify-end min-h-[22px]">
                      {metric.badge ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-200 border border-amber-400/20 shadow-sm leading-none flex items-center gap-1">
                          {metric.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-6">
                      <div className="text-3xl font-extrabold text-white tracking-tight">
                        {metric.value}
                      </div>
                      <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none flex items-center">
                        <span>{metric.label}</span>
                        <svg
                          className="w-8 h-4 text-white/20 ml-2 group-hover:text-white/40 transition-colors"
                          viewBox="0 0 50 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            d="M0 15 L10 12 L20 18 L30 8 L40 10 L50 2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </div>
              );
            } else if (cardType === 2) {
              // Card 3: Teal Green
              return (
                <div
                  key={index}

                  className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(24,117,92,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(24,117,92,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#18755c] text-white"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex justify-end min-h-[22px]">
                      {metric.badge ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-sm leading-none flex items-center gap-1">
                          {metric.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-6">
                      <div className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                        <span>{metric.value}</span>
                        <svg
                          className="w-5 h-5 text-white/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                          />
                        </svg>
                      </div>
                      <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                        {metric.label}
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </div>
              );
            } else {
              // Card 4: Carbon Dark Gray
              return (
                <div
                  key={index}

                  className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.2)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/15 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#1d1f22] bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:8px_8px] text-white"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex justify-end min-h-[22px]">
                      {metric.badge ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-sm leading-none flex items-center gap-1">
                          {metric.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-6">
                      <div className="text-3xl font-extrabold text-white tracking-tight">
                        {metric.value}
                      </div>
                      <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                        {metric.label}
                      </div>
                    </div>
                  </div>
                  <svg
                    className="w-4.5 h-4.5 text-white/20 absolute right-5 bottom-5 group-hover:scale-110 group-hover:text-white/40 transition-all duration-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </div>
              );
            }
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-700/80 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)] transition-all duration-300 relative overflow-hidden ">
              <button
                type="button"
                onClick={() => navigate("/social-feed")}
                className="absolute top-4 left-4 bg-brand text-white rounded-full px-3 py-2 text-xs hover:bg-brand-700"
              >
                Post History
              </button>
              <button
                type="button"
                onClick={async () => {
                  const next = !showPostAlerts;
                  setShowPostAlerts(next);
                  if (next) await loadPostAlerts();
                }}
                className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full px-3 py-2 flex items-center gap-2"
              >
                <span>🔔</span>
                <span className="relative inline-flex items-center">
                  <span className="sr-only">Post alerts</span>
                  <span className="ml-1 text-sm">Posts</span>
                  {postNotificationsUnread.length > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {postNotificationsUnread.length}
                    </span>
                  )}
                </span>
              </button>
              {showPostAlerts && (
                <div className="absolute top-14 right-4 z-30 w-96 max-w-[calc(100%-2rem)] rounded-lg border border-slate-200 bg-white shadow-erp-lg">
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">
                      Post Notifications
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPostAlerts(false)}
                      className="text-slate-600 hover:text-slate-900 text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {postAlertsLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading…</div>
                    ) : postAlerts.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">
                        No post alerts found.
                      </div>
                    ) : (
                      postAlerts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={async () => {
                            setShowPostAlerts(false);
                            try {
                              const related = notifications.filter(
                                (n) =>
                                  Number(n.is_read) !== 1 &&
                                  String(n.link || "").startsWith(
                                    `/social-feed/${p.id}`,
                                  ),
                              );
                              for (const n of related) {
                                try {
                                  await client.put(
                                    `/workflows/notifications/${n.id}/read`,
                                  );
                                } catch {}
                              }
                              setNotifications((prev) =>
                                prev.map((n) =>
                                  String(n.link || "").startsWith(
                                    `/social-feed/${p.id}`,
                                  )
                                    ? { ...n, is_read: 1 }
                                    : n,
                                ),
                              );
                            } catch {}
                            navigate(`/social-feed/${p.id}`);
                          }}
                          className="w-full text-left px-4 py-3 mb-2 last:mb-0 rounded-lg bg-gradient-to-r from-brand-800 to-brand-700 text-white shadow-erp-sm hover:shadow-erp-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                p.profile_picture_url || "/default-avatar.png"
                              }
                              alt={String(p.full_name || "User")}
                              className="w-8 h-8 rounded-full border border-white/40"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-semibold">
                                {String(p.full_name || p.username || "User")}
                              </div>
                              <div className="text-xs text-white/90">
                                {String(p.content || "")
                                  .replace(/\s+/g, " ")
                                  .trim()
                                  .slice(0, 100)}
                                {String(p.content || "").length > 100
                                  ? "…"
                                  : ""}
                              </div>
                              <div className="text-[11px] text-white/70 mt-1">
                                {p.created_at
                                  ? new Date(p.created_at).toLocaleString()
                                  : ""}
                              </div>
                            </div>
                            <div className="text-white/80 text-sm">View →</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div ref={postRef}>
                <CompanyFeed compact />
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div
              className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-700/80 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)] transition-all duration-300 relative overflow-hidden "
              style={{
                height: pendingHeight ? `${pendingHeight}px` : undefined,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-blue-500">✅</span> Pending Approvals
                </h2>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                  {filteredPending.length} Pending
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {uniquePending.length > 0 ? (
                  <div className="space-y-4">
                    {orderedGroups.map((key) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-bold text-slate-700">
                            {displayType(key)}
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                            {groupedPending[key].length}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {groupedPending[key].map((item) => (
                            <div
                              key={item.workflow_instance_id}
                              className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-lg px-2 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                                  {item.initiator
                                    ? item.initiator.charAt(0)
                                    : "U"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {docLabel(item)}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {item.submitted_at
                                      ? new Date(
                                          item.submitted_at,
                                        ).toLocaleString()
                                      : "Just now"}{" "}
                                    •{" "}
                                    {item.workflow_name || "Approval Required"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    openApprovalModal(item.workflow_instance_id)
                                  }
                                  className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() =>
                                    navigate(
                                      `/administration/workflows/approvals/${item.workflow_instance_id}`,
                                    )
                                  }
                                  className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                >
                                  Review
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    No pending approvals found. You're all caught up! 🎉
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-700/80 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)] transition-all duration-300 relative overflow-visible ">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-purple-500">📑</span> Reports
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(getEnabledModules() || reportsModules).map((mk) => {
                const label = String(mk)
                  .split("-")
                  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                  .join(" ");
                const colors = [
                  "bg-emerald-500",
                  "bg-blue-500",
                  "bg-purple-500",
                  "bg-orange-500",
                  "bg-pink-500",
                  "bg-teal-500",
                  "bg-rose-500",
                ];
                const idx =
                  Math.abs(
                    mk.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
                  ) % colors.length;
                return (
                  <div
                    key={mk}
                    className="relative"
                    onMouseEnter={() => setActiveModule(mk)}
                    onMouseLeave={() =>
                      setActiveModule((curr) => (curr === mk ? null : curr))
                    }
                  >
                    <button
                      type="button"
                      className={`rounded-xl px-4 py-3 text-left text-white hover:opacity-90 transition ${colors[idx]} h-20 w-full flex flex-col justify-center`}
                      title={`Show ${label} reports and dashboards`}
                      onClick={() =>
                        setActiveModule((curr) => (curr === mk ? null : mk))
                      }
                    >
                      <div className="text-sm font-semibold truncate tracking-tight">
                        {label}
                      </div>
                      <div className="text-xs text-white/90 mt-0.5 truncate">
                        Reports
                      </div>
                    </button>
                    {activeModule === mk
                      ? (() => {
                          const modKey = String(activeModule);
                          const reportsFromFeatures = allFeatures
                            .filter((f) => {
                              const sameModule =
                                String(f.module_key) === modKey;
                              const p = String(f.path || "");
                              const isReportPath = p.startsWith(
                                `/${modKey}/reports`,
                              );
                              const isDashboardType =
                                String(f.type || "").toLowerCase() ===
                                "dashboard";
                              return (
                                sameModule && (isReportPath || isDashboardType)
                              );
                            })
                            .map((f) => ({
                              label: f.label || "Entry",
                              path: f.path || "/",
                            }));
                          const curated =
                            Array.isArray(moduleReportsMap?.[mk]) &&
                            moduleReportsMap[mk].map((r) => ({
                              label: r.label || r.name || "Report",
                              path: r.path || "/",
                            }));
                          const regDash = Array.isArray(
                            getModuleDashboards?.(mk),
                          )
                            ? getModuleDashboards(mk).map((d) => ({
                                label: d.label,
                                path: d.path,
                              }))
                            : [];
                          const preferredDash =
                            moduleDashboardPath[mk] ||
                            (Array.isArray(getModuleDashboards?.(mk)) &&
                              getModuleDashboards(mk)[0]?.path) ||
                            null;
                          const dashEntry =
                            preferredDash && canAccessPath(preferredDash)
                              ? [{ label: "Dashboard", path: preferredDash }]
                              : [];
                          const byPath = new Map();
                          [
                            ...dashEntry,
                            ...reportsFromFeatures,
                            ...(curated || []),
                            ...regDash,
                          ].forEach((e) => {
                            const p = String(e.path || "");
                            if (!p) return;
                            if (!byPath.has(p)) byPath.set(p, e);
                          });
                          const hiddenPaths = new Set([
                            "/administration/reports",
                            "/administration/system-overview",
                            "/administration/user-activity",
                            "/sales/reports",
                            "/sales/revenue-analytics",
                            "/sales/sales-overview",
                            "/sales/customer-analytics",
                            "/purchase/procurement-overview",
                            "/purchase/supplier-analytics",
                            "/inventory/inventory-overview",
                            "/inventory/stock-analytics",
                            "/finance/financial-overview",
                            "/finance/cash-flow",
                            "/finance/budget-analysis",
                            "/human-resources/hr-overview",
                            "/human-resources/attendance-dashboard",
                            "/human-resources/payroll-dashboard",
                            "/production/production-overview",
                            "/production/efficiency-analytics",
                            "/maintenance/maintenance-overview",
                            "/maintenance/asset-analytics",
                            "/project-management/project-overview",
                            "/project-management/resource-utilization",
                          ]);
                          const entries = Array.from(byPath.values()).filter(
                            (e) => {
                              const p = e?.path || "";
                              if (!p || hiddenPaths.has(p)) return false;
                              if (canAccessPath(p)) return true;
                              const dashboards = getModuleDashboards?.(mk) || [];
                              return dashboards.some((d) => d.path === p);
                            },
                          );
                          return (
                            <div className="absolute left-0 top-full mt-2 sm:left-full sm:top-0 sm:ml-2 z-50 w-56 max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-2xl p-1 transition-all duration-200 scale-100 opacity-80">
                              {entries.map((e) => (
                                <button
                                  key={e.path || e.label}
                                  type="button"
                                  onClick={() => navigate(e.path)}
                                  className="block w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition rounded-lg"
                                  title={e.path}
                                >
                                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    {e.label}
                                  </div>
                                </button>
                              ))}
                              {entries.length === 0 ? (
                                <div className="p-3 text-sm text-slate-600">
                                  No entries available for your role.
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-700/80 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)] transition-all duration-300 relative overflow-hidden ">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-brand-500">🔔</span> Notifications
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Approved Documents
                  </div>
                  <div className="text-xs text-slate-500">
                    {approvedNotifications.length} Approved
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate("/administration/workflows/approved")}
                >
                  View Details
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Pending Documents
                  </div>
                  <div className="text-xs text-slate-500">
                    {filteredPending.length} Pending
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    navigate("/administration/workflows/approvals")
                  }
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-lg overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Approval</h2>
              <button
                onClick={closeApprovalModal}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              {modalLoading ? (
                <div className="text-sm">Loading...</div>
              ) : modalData ? (
                <>
                  <div className="text-sm text-slate-700">
                    Document:{" "}
                    <span className="font-semibold">
                      {modalData.document_type} #{modalData.document_id}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">
                    Current Step:{" "}
                    <span className="font-semibold">{modalData.step_name}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-500">
                      Amount
                    </label>
                    <span className="font-semibold text-lg text-slate-800">
                      {modalData.amount != null
                        ? Number(modalData.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "N/A"}
                    </span>
                  </div>

                  {(() => {
                    const previousCommentLog = (modalData.logs || [])
                      .slice()
                      .reverse()
                      .find(log => log.comments && log.comments.trim() !== "" && log.comments !== "Workflow started");
                    return previousCommentLog ? (
                      <div className="mb-2">
                        <label className="block text-sm font-medium mb-1">
                          Previous Comment (from {previousCommentLog.actor_name || "Unknown"})
                        </label>
                        <div className="p-3 bg-amber-50 text-amber-800 rounded border border-amber-200 text-sm">
                          "{previousCommentLog.comments}"
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Comments
                    </label>
                    <textarea
                      className="input w-full h-24"
                      placeholder="Enter comments..."
                      value={modalComment}
                      onChange={(e) => setModalComment(e.target.value)}
                    />
                  </div>
                  {!modalData.is_last_step &&
                    Array.isArray(modalData.next_step_approvers) && (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Forward To
                        </label>
                        <select
                          className="input w-full"
                          value={modalNextUser || ""}
                          onChange={(e) =>
                            setModalNextUser(Number(e.target.value))
                          }
                        >
                          <option value="">Select user</option>
                          {modalData.next_step_approvers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </>
              ) : (
                <div className="text-sm text-red-600">
                  Failed to load approval
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={closeApprovalModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700 disabled:opacity-50"
                onClick={() => handleModalAction("APPROVE")}
                disabled={modalProcessing}
              >
                {modalData && modalData.is_last_step
                  ? "Final Approve"
                  : "Forward"}
              </button>
              {/* Reverse Approval intentionally removed per requirements */}
              <button
                type="button"
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                onClick={() => handleModalAction("RETURN")}
                disabled={modalProcessing}
              >
                Return
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => handleModalAction("REJECT")}
                disabled={modalProcessing}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      {/* chat v2 floating widget is mounted globally in AppShell */}
    </div>
  );
}

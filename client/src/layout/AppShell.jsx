/**
 * @fileoverview Main AppShell layout component.
 * Responsible for the overall layout, navigation sidebar, header, global state,
 * notification polling, and service worker push integrations.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import Swal from "sweetalert2";

import { useAuth } from "../auth/AuthContext.jsx";
import {
  getLastActivity,
  getInactivityTimeoutMs,
  readStoredAuth,
  writeStoredAuth,
  touchLastActivity,
} from "../auth/authStorage.js";
import { usePermission } from "../auth/PermissionContext.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import DashboardPage from "../pages/dashboard/DashboardPage.jsx";
import HomePage from "../pages/home/HomePage.jsx";
import AdministrationHome from "../pages/modules/administration/AdministrationHome.jsx";
import SalesHome from "../pages/modules/sales/SalesHome.jsx";
import InventoryHome from "../pages/modules/inventory/InventoryHome.jsx";
import PurchaseHome from "../pages/modules/purchase/PurchaseHome.jsx";
import FinanceRoutes from "../pages/modules/finance/FinanceRoutes.jsx";
import HumanResourcesHome from "../pages/modules/human-resources/HumanResourcesHome.jsx";
import MaintenanceHome from "../pages/modules/maintenance/MaintenanceHome.jsx";
import ProjectManagementHome from "../pages/modules/project-management/ProjectManagementHome.jsx";
import ProductionHome from "../pages/modules/production/ProductionHome.jsx";
import PosHome from "../pages/modules/pos/PosHome.jsx";
import BusinessIntelligenceHome from "../pages/modules/business-intelligence/BusinessIntelligenceHome.jsx";
import ServiceManagementHome from "../pages/modules/service-management/ServiceManagementHome.jsx";
import TransportLayout from "../pages/modules/transport/TransportLayout.jsx";
import ExecutiveOverviewRoutes from "../pages/modules/executive-overview/ExecutiveOverviewRoutes.jsx";
import SystemConfigurationHome from "../pages/modules/system-configuration/SystemConfigurationHome.jsx";
import NotificationsPage from "../pages/NotificationsPage.jsx";
import SocialFeedPage from "../pages/social/SocialFeedPage.jsx";
import RoleSetup from "../pages/admin/RoleSetup.jsx";
import UserPermissions from "../pages/admin/UserPermissions.jsx";
import SocialFeedNotification from "../components/CompanyFeed/SocialFeedNotification.jsx";
import DashboardPermissions from "../pages/admin/DashboardPermissions.jsx";
import addNotification from "../utils/addNotification.js";

import logoDark from "../assets/resources/OMNISUITE_WHITE_LOGO.png";
import logoLight from "../assets/resources/OMNISUITE_LOGO_FILL.png";
import clearIcon from "../assets/resources/OMNISUITE_ICON_CLEAR.png";
import PaymentPackageModal from "../components/PaymentPackageModal.jsx";
import { api } from "../api/client.js";
import useOfflineQueue from "../offline/useOfflineQueue.js";
import FloatingInstallButton from "../components/FloatingInstallButton.jsx";
import { toast } from "react-toastify";
import {
  Bell,
  Menu,
  Settings,
  Banknote,
  Archive,
  ShoppingCart,
  Landmark,
  Users,
  Wrench,
  Blocks,
  Factory,
  ShoppingBasket,
  AreaChart,
  Headset,
  Presentation,
  Truck,
  Home,
} from "lucide-react";
import FloatingChat from "../components/chat/FloatingChat.jsx";
import BanksAiFloating from "../components/ai/BanksAiFloating.jsx";
import FloatingCreateButton from "../components/FloatingCreateButton.jsx";
import useSocket from "../hooks/useSocket.js";

const AppRoutes = React.memo(function AppRoutes({ user }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/administration/*" element={<AdministrationHome />} />
      <Route path="/sales/*" element={<SalesHome />} />
      <Route path="/inventory/*" element={<InventoryHome />} />
      <Route path="/purchase/*" element={<PurchaseHome />} />
      <Route path="/finance/*" element={<FinanceRoutes />} />
      <Route path="/human-resources/*" element={<HumanResourcesHome />} />
      <Route path="/maintenance/*" element={<MaintenanceHome />} />
      <Route path="/project-management/*" element={<ProjectManagementHome />} />
      <Route path="/production/*" element={<ProductionHome />} />
      <Route path="/pos/*" element={<PosHome />} />
      <Route path="/business-intelligence/*" element={<BusinessIntelligenceHome />} />
      <Route path="/service-management/*" element={<ServiceManagementHome />} />
      <Route path="/transport/*" element={<TransportLayout />} />
      <Route path="/executive-overview/*" element={<ExecutiveOverviewRoutes />} />
      <Route path="/administration/access/dashboard-permissions" element={<DashboardPermissions />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/social-feed" element={<SocialFeedPage />} />
      <Route path="/social-feed/:id" element={<SocialFeedPage />} />
      <Route path="/admin/roles" element={<RoleSetup />} />
      <Route path="/admin/user-permissions" element={<UserPermissions />} />
      <Route 
        path="/system-configuration/*" 
        element={(user?.id === 1 || user?.id === 2) ? <SystemConfigurationHome /> : <Navigate to="/" replace />} 
      />
    </Routes>
  );
});

const modules = [
  {
    key: "system-configuration",
    label: "System Configuration",
    path: "/system-configuration",
    icon: <Settings />,
  },
  {
    key: "administration",
    label: "Administration",
    path: "/administration",
    icon: <Settings />,
  },
  { key: "sales", label: "Sales", path: "/sales", icon: <Banknote /> },
  { key: "inventory", label: "Inventory", path: "/inventory", icon: <Archive /> },
  { key: "purchase", label: "Purchase", path: "/purchase", icon: <ShoppingCart /> },
  { key: "finance", label: "Finance", path: "/finance", icon: <Landmark /> },
  {
    key: "human-resources",
    label: "Human Resources",
    path: "/human-resources",
    icon: <Users />,
  },
  {
    key: "maintenance",
    label: "Maintenance",
    path: "/maintenance",
    icon: <Wrench />,
  },
  {
    key: "project-management",
    label: "Project Management",
    path: "/project-management",
    icon: <Blocks />,
  },
  { key: "production", label: "Production", path: "/production", icon: <Factory /> },
  { key: "pos", label: "POS", path: "/pos", icon: <ShoppingBasket /> },
  {
    key: "business-intelligence",
    label: "Business Intelligence",
    path: "/business-intelligence",
    icon: <AreaChart />,
  },
  {
    key: "service-management",
    label: "Service Management",
    path: "/service-management",
    icon: <Headset />,
  },
  {
    key: "executive-overview",
    label: "Executive Overview",
    path: "/executive-overview",
    icon: <Presentation />,
  },
  {
    key: "transport",
    label: "Transport",
    path: "/transport",
    icon: <Truck />,
  },
];

const BACKGROUND_GET_CONFIG = { __background: true };

function scheduleDeferredTask(task, delayMs = 200) {
  let settled = false;
  let timeoutId = null;
  let idleId = null;

  const run = () => {
    if (settled) return;
    settled = true;
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (
      idleId !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleId);
    }
    Promise.resolve()
      .then(task)
      .catch(() => {});
  };

  if (typeof window !== "undefined") {
    timeoutId = window.setTimeout(run, delayMs);
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: delayMs + 300 });
    }
  } else {
    run();
  }

  return () => {
    settled = true;
    if (timeoutId !== null && typeof window !== "undefined") {
      window.clearTimeout(timeoutId);
    }
    if (
      idleId !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleId);
    }
  };
}

/**
 * AppShell component
 * Acts as the primary shell around all authenticated routes.
 * Initializes real-time sockets, manages offline queue state, and handles user session inactivity.
 * 
 * @returns {JSX.Element} The rendered application shell.
 */
export default function AppShell() {
  const { token, user, scope, setScope, logout } = useAuth();
  const {
    isModuleEnabled,
    canViewModule,
    canPerformAction,
    globalOverrides,
    canPerformPageAction,
    ensurePagePerms,
    basePathFrom,
    canAccessFeatureKey,
  } = usePermission();
  const { theme } = useTheme();
  const { pending, failed, completed, items, lastEvent } = useOfflineQueue();
  const navigate = useNavigate();
  const location = useLocation();
  const [queueOpen, setQueueOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const lastChatToneAtRef = useRef(0);
  useEffect(() => {
    if (lastEvent === "queued") {
      setSavedToast(true);
      const t = setTimeout(() => setSavedToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  useEffect(() => {
    if (sessionStorage.getItem("triggerRenewal") === "true") {
      sessionStorage.removeItem("triggerRenewal");
      setShowPaymentModal(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkLicense() {
      if (Number(user?.id) === 1) return;
      const companyId = user?.company_id || user?.companyIds?.[0];
      if (!companyId) return;

      try {
        const res = await api.get(`/licenses/company/${companyId}`);
        if (mounted && res?.data) {
          const l = res.data;
          console.log("License Data:", l);
          if (["ACTIVE", "EXPIRED", "INACTIVE", "SUSPENDED", "CANCELLED"].includes(l.status)) {
            const exp = new Date(l.expiry_date);
            const graceDays = l.grace_days || 0;
            const finalExp = new Date(
              exp.getTime() + graceDays * 24 * 60 * 60 * 1000,
            );
            const now = new Date();
            let daysRemaining = Math.max(
              0,
              Math.ceil((finalExp - now) / (1000 * 60 * 60 * 24)),
            );

            const alertDays = l.alert_days !== undefined && l.alert_days !== null ? l.alert_days : 30;
            console.log("License Expiry:", { daysRemaining, alertDays, finalExp, now, status: l.status });
            
            const shouldAlert = l.status !== "ACTIVE" || daysRemaining <= alertDays || isNaN(daysRemaining);

            if (shouldAlert) {
              const formattedDate = new Date(l.expiry_date).toLocaleDateString();
              let title = "";
              let text = "";

              if (l.status === "INACTIVE") {
                title = "License Inactive";
                text = "Your license is currently INACTIVE. Please renew.";
              } else if (l.status === "SUSPENDED") {
                title = "License Suspended";
                text = "Your license is suspended. Please renew.";
              } else if (l.status === "CANCELLED") {
                title = "License Cancelled";
                text = "Your license is cancelled. Please renew.";
              } else {
                title = daysRemaining === 0 ? "License Expired" : "License Expiring Soon";
                text = daysRemaining === 0 
                  ? `Your license expired on ${formattedDate} (including ${graceDays} days grace).`
                  : `Your license expires on ${formattedDate} + ${graceDays} days grace period.`;
              }
              
              // Temporarily ignore the dismissal check to guarantee it shows during our testing
              const isDismissed = false; // sessionStorage.getItem("licenseAlertDismissed") === "true";
              const canDismiss = (l.status === "ACTIVE" && daysRemaining > 0);
              const canRenew = canAccessFeatureKey("system", "license-renewal");

              if (!isDismissed || !canDismiss) {
                Swal.fire({
                  toast: true,
                  position: "bottom-end",
                  title,
                  iconHtml: `<img src="${clearIcon}" style="height: 64px; width: auto; object-fit: contain;" />`,
                  text,
                  showCancelButton: canDismiss,
                  showConfirmButton: canRenew,
                  confirmButtonColor: "#2563eb",
                  cancelButtonColor: "#64748b",
                  confirmButtonText: "Renew",
                  cancelButtonText: "Dismiss",
                  width: "20em",
                  padding: "0.5em",
                  customClass: {
                    container: 'z-[999999]',
                    title: 'text-sm m-0 p-0',
                    htmlContainer: 'text-xs m-1 p-0',
                    actions: 'm-0 p-0 scale-75',
                    icon: 'border-0 m-0 mr-2'
                  },
                  timerProgressBar: true,
                  showCloseButton: canDismiss,
                  background: "rgba(255, 255, 255, 1)",
                }).then((result) => {
                  if (result.isConfirmed) {
                    setShowPaymentModal(true);
                  } else if (result.isDismissed) {
                    sessionStorage.setItem("licenseAlertDismissed", "true");
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("License check error:", err);
      }
    }

    checkLicense();
    return () => {
      mounted = false;
    };
  }, [user]);

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine !== false : true,
  );
  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  useEffect(() => {
    try {
      if ("serviceWorker" in navigator) {
        function playChatTone() {
          try {
            const now = Date.now();
            if (now - Number(lastChatToneAtRef.current || 0) < 800) return;
            lastChatToneAtRef.current = now;
            const AudioCtx =
              window.AudioContext || window.webkitAudioContext || null;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle";
            o.frequency.setValueAtTime(880, ctx.currentTime);
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
            o.connect(g).connect(ctx.destination);
            o.start();
            setTimeout(() => {
              o.frequency.setValueAtTime(660, ctx.currentTime);
            }, 150);
            setTimeout(() => {
              g.gain.exponentialRampToValueAtTime(
                0.0001,
                ctx.currentTime + 0.01,
              );
              o.stop();
              ctx.close();
            }, 700);
          } catch {}
        }
        const handler = (e) => {
          const data = e?.data || {};
          if (data.type === "navigate" && typeof data.url === "string") {
            const url = data.url;
            setTimeout(() => {
              if (url.startsWith("/chat?cid=")) {
                try {
                  const m = url.match(/cid=(\d+)/);
                  const cid = m ? Number(m[1]) : null;
                  if (cid) {
                    localStorage.setItem(
                      "omni.chat.lastConversationId",
                      String(cid),
                    );
                    window.dispatchEvent(new Event("omni.chat.open"));
                  }
                } catch {}
                navigate("/");
              } else {
                navigate(url);
              }
            }, 0);
          }
          if (data.type === "chat_push") {
            if (
              typeof document !== "undefined" &&
              document.visibilityState === "visible"
            ) {
              const run =
                typeof window !== "undefined" &&
                typeof window.requestIdleCallback === "function"
                  ? window.requestIdleCallback
                  : (fn) => setTimeout(fn, 0);
              run(() => playChatTone());
            }
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        return () =>
          navigator.serviceWorker.removeEventListener("message", handler);
      }
    } catch {}
  }, [navigate]);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined") {
        const path = location.pathname + (location.search || "");
        sessionStorage.setItem("last_path", path);
      }
    } catch {}
  }, [location.pathname, location.search]);
  useEffect(() => {
    async function logPageView() {
      try {
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          return;
        }
        const path = location.pathname || "/";
        const seg = path.split("/").filter(Boolean)[0] || "dashboard";
        const moduleName = seg
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        try {
          await api.post("/admin/activity/log", {
            module_name: moduleName,
            action: "VIEW",
            ref_no: String(user?.username || ""),
            message: "Page View",
            url_path: path,
            event_time: new Date().toISOString(),
          });
        } catch {}
      } catch {}
    }
    logPageView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(min-width: 768px)").matches;
    }
    return false;
  });
  const sidebarTouchStart = useRef(null);
  const handleSidebarTouchStart = (e) => {
    sidebarTouchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const handleSidebarTouchEnd = (e) => {
    if (!sidebarTouchStart.current) return;
    const dx = e.changedTouches[0].clientX - sidebarTouchStart.current.x;
    const dy = e.changedTouches[0].clientY - sidebarTouchStart.current.y;
    sidebarTouchStart.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dx < 0) {
      setSidebarOpen(false);
    }
  };
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);
  const [lowStockPrompted, setLowStockPrompted] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [changePwModalOpen, setChangePwModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  useEffect(() => {
    if (user?.status === "N") {
      setWelcomeModalOpen(true);
    }
  }, [user?.status]);
  useEffect(() => {
    try {
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("omni.unread_notification_count")
          : null;
      if (raw != null && raw !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) {
          setUnreadCount(n);
        }
      }
    } catch {}
  }, []);
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    function onNewNotif(payload) {
      try {
        setUnreadCount((n) => {
          const next = (n || 0) + 1;
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(
                "omni.unread_notification_count",
                String(next),
              );
            }
          } catch {}
          return next;
        });
      } catch {}
    }
    socket.on("notifications:new", onNewNotif);
    return () => {
      socket.off("notifications:new", onNewNotif);
    };
  }, [socket]);

  const [pushPromptVisible, setPushPromptVisible] = useState(false);
  useEffect(() => {
    try {
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("push_enabled")
          : null;
      const enabled = raw === "1";
      const perm =
        typeof window !== "undefined" && "Notification" in window
          ? window.Notification.permission
          : "denied";
      const canPrompt =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setPushPromptVisible(canPrompt && !enabled && perm !== "granted");
    } catch {
      setPushPromptVisible(false);
    }
  }, [token]);

  async function enablePushNow() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("push_enabled", "1");
      }
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setPushPromptVisible(false);
        return;
      }
      if (window.Notification.permission === "denied") {
        setPushPromptVisible(false);
        return;
      }
      if (window.Notification.permission !== "granted") {
        try {
          const perm = await window.Notification.requestPermission();
          if (perm !== "granted") {
            setPushPromptVisible(false);
            return;
          }
        } catch {
          setPushPromptVisible(false);
          return;
        }
      }
      const reg = await navigator.serviceWorker.ready;
      let publicKey = "";
      try {
        const res = await api.get("/push/public-key");
        publicKey = String(res.data?.publicKey || "");
      } catch {
        publicKey = "";
      }
      if (!publicKey) {
        setPushPromptVisible(false);
        return;
      }
      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        try {
          await api.post("/push/subscribe", {
            subscription: existing.toJSON(),
          });
        } catch {}
        setPushPromptVisible(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      try {
        await api.post("/push/subscribe", { subscription: sub.toJSON() });
      } catch {}
      setPushPromptVisible(false);
    } catch {
      setPushPromptVisible(false);
    }
  }

  const [branchOptions, setBranchOptions] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(() => scope?.branchId || null);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (scope?.branchId) {
      setSelectedBranchId(scope.branchId);
    }
  }, [scope?.branchId]);

  const profile = useMemo(() => {
    const username = user?.username || user?.name || "Guest";
    const role =
      user?.role ||
      (Array.isArray(user?.roles) ? user.roles[0] : null) ||
      "Developer";

    // Resolve the active branch from the branchOptions list so the name
    // reflects the currently switched branch, not the JWT default.
    const activeBranch = Array.isArray(branchOptions)
      ? branchOptions.find((b) => Number(b.id) === Number(scope?.branchId))
      : null;
    const companyName =
      activeBranch?.company_name ||
      user?.companyName ||
      `Company #${scope?.companyId ?? "-"}`;
    const branchName =
      activeBranch?.name ||
      user?.branchName ||
      `Branch #${scope?.branchId ?? "-"}`;

    return { username, role, companyName, branchName };
  }, [scope?.branchId, scope?.companyId, user, branchOptions]);

  const roleOptions = useMemo(
    () =>
      Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [],
    [user?.roles, user?.role],
  );
  const [selectedRole, setSelectedRole] = useState(() =>
    Array.isArray(user?.roles) ? user.roles[0] : user?.role || null,
  );
  const [dbRoles, setDbRoles] = useState([]);
  const [dbRolesLoading, setDbRolesLoading] = useState(false);
  useEffect(() => {
    const userId = Number(user?.sub || user?.id);
    if (!Number.isFinite(userId)) {
      setDbRoles([]);
      return;
    }
    let mounted = true;
    async function loadRoles() {
      setDbRolesLoading(true);
      try {
        const res = await api.get(`/admin/users/${userId}/roles`);
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
        if (mounted) setDbRoles(items);
        if (mounted && items.length > 0 && !selectedRole) {
          setSelectedRole(items[0]?.name || items[0]?.code || null);
        }
      } catch {
        if (mounted) setDbRoles([]);
      } finally {
        if (mounted) setDbRolesLoading(false);
      }
    }
    loadRoles();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLowStockPrompted(false);
    setLowStockCount(0);
    setUnreadCount(0);
  }, [scope?.companyId, scope?.branchId]);

  useEffect(() => {
    let cancelled = false;
    async function subscribePush() {
      try {
        const raw =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("push_enabled")
            : null;
        const enabled = raw === null ? true : String(raw) === "1";
        if (!enabled) return;
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;
        if (!("PushManager" in window)) return;
        if (!("Notification" in window)) return;
        if (window.Notification.permission !== "granted") {
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        let publicKey = "";
        try {
          const res = await api.get("/push/public-key");
          publicKey = String(res.data?.publicKey || "");
        } catch {
          publicKey = "";
        }
        if (!publicKey) return;
        function urlBase64ToUint8Array(base64String) {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        }
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const existing = await reg.pushManager.getSubscription();
        if (existing && existing.endpoint) {
          try {
            await api.post("/push/subscribe", {
              subscription: existing.toJSON(),
            });
          } catch {}
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        if (cancelled) return;
        try {
          await api.post("/push/subscribe", { subscription: sub.toJSON() });
        } catch {}
      } catch {}
    }
    subscribePush();
    return () => {
      cancelled = true;
    };
  }, [token]);
  const authFailedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function loadUnread() {
      try {
        if (!token || !online || authFailedRef.current) return;
        const res = await api.get(
          "/workflows/notifications",
          BACKGROUND_GET_CONFIG,
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const unread = items.filter((n) => Number(n.is_read) !== 1).length;
        setUnreadCount(unread);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              "omni.unread_notification_count",
              String(unread),
            );
          }
        } catch {}
        if (typeof window !== "undefined") {
          try {
            const storeKey = "notified_notification_ids";
            const prevRaw = localStorage.getItem(storeKey);
            const prev = prevRaw ? JSON.parse(prevRaw) : [];
            const prevSet = new Set(Array.isArray(prev) ? prev : []);
            const nativeAllowed =
              "Notification" in window &&
              window.Notification?.permission === "granted";
            const icon =
              theme === "dark"
                ? "/OMNISUITE_ICON_CLEAR.png"
                : "/OMNISUITE_ICON_CLEAR.png";
            for (const n of items) {
              const id = Number(n.id);
              const isUnread = Number(n.is_read) !== 1;
              if (isUnread && !prevSet.has(id)) {
                try {
                  addNotification({
                    title: String(n.title || "Notification"),
                    message: String(n.message || ""),
                    native: nativeAllowed,
                    icon,
                    onClick: () => {
                      if (n.link) navigate(String(n.link));
                      else navigate("/notifications");
                    },
                  });
                } catch {}
                prevSet.add(id);
              }
            }
            localStorage.setItem(storeKey, JSON.stringify(Array.from(prevSet)));
          } catch {}
        }
      } catch (err) {
        if (err?.response?.status === 401) authFailedRef.current = true;
      }
    }

    async function checkLowStock() {
      try {
        if (lowStockPrompted) return;
        const res = await api.get(
          "/inventory/alerts/low-stock",
          BACKGROUND_GET_CONFIG,
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!items.length) return;
        setLowStockPrompted(true);
        setLowStockCount(items.length);
        const count = items.length;
        const nativeAllowed =
          typeof window !== "undefined" &&
          "Notification" in window &&
          window.Notification?.permission === "granted";
        const icon =
          theme === "dark"
            ? "/OMNISUITE_ICON_CLEAR.png"
            : "/OMNISUITE_ICON_CLEAR.png";
        // Suppress inline/pop-up messages completely per requirement
      } catch {}
    }
    if (token && online) {
      const cancelLowStock = scheduleDeferredTask(checkLowStock, 250);
      const cancelUnread = scheduleDeferredTask(loadUnread, 350);
      return () => {
        cancelled = true;
        cancelLowStock();
        cancelUnread();
      };
    }
    return () => {
      cancelled = true;
    };
  }, [scope?.companyId, scope?.branchId, lowStockPrompted, token, online]);

  useEffect(() => {
    if (!token) return;
    let throttleTimer = null;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        touchLastActivity();
        throttleTimer = null;
      }, 5000); // Throttle activity updates to once every 5 seconds
    };
    
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const inactivityTimer = setInterval(() => {
      const timeoutMs = getInactivityTimeoutMs();
      if (timeoutMs <= 0) return;
      const lastActivity = getLastActivity();
      if (lastActivity > 0 && Date.now() - lastActivity > timeoutMs) {
        logout({ redirect: false });
      }
    }, 30000);
    return () => clearInterval(inactivityTimer);
  }, [token, logout]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onSwMessage(ev) {
      try {
        const t = String(ev?.data?.type || "");
        if (t === "workflow_push") {
          if (!window.__omniSocketConnected) {
            setUnreadCount((n) => {
              const next = (n || 0) + 1;
              try {
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(
                    "omni.unread_notification_count",
                    String(next),
                  );
                }
              } catch {}
              return next;
            });
          }
        }
      } catch {}
    }
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, []);

  useEffect(() => {
    const roles = Array.isArray(user?.roles)
      ? user.roles
      : user?.role
        ? [user.role]
        : [];
    if (roles.length && !roles.includes(selectedRole)) {
      setSelectedRole(roles[0]);
    }
  }, [user?.roles, user?.role, selectedRole]);

  useEffect(() => {
    let mounted = true;
    async function loadUserBranches() {
      try {
        const res = await api.get("/auth/user-branches", BACKGROUND_GET_CONFIG);
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) {
          setBranchOptions(items);
          if (!selectedBranchId && !scope?.branchId && items.length > 0) {
            setSelectedBranchId(Number(items[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
        setBranchOptions([]);
      }
    }
    const cancelLoad = scheduleDeferredTask(loadUserBranches, 250);
    return () => {
      mounted = false;
      cancelLoad();
    };
  }, [scope?.branchId]);
  useEffect(() => {
    let mounted = true;
    async function loadCompanies() {
      try {
        const res = await api.get("/admin/companies", BACKGROUND_GET_CONFIG);
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setCompanies(items);
      } catch {
        if (mounted) setCompanies([]);
      }
    }
    const cancelLoad = scheduleDeferredTask(loadCompanies, 300);
    return () => {
      mounted = false;
      cancelLoad();
    };
  }, []);
  const currentBranchName = useMemo(() => {
    const targetId = Number(scope?.branchId ?? selectedBranchId);
    let found = null;
    if (targetId) {
      found = branchOptions.find((b) => Number(b.id) === targetId);
    }
    if (!found) {
      found = branchOptions.find((b) => b.name === profile.branchName) || (branchOptions.length ? branchOptions[0] : null);
    }
    if (found) {
      const comp = found.company_name || `Company #${found.company_id}`;
      return `${found.name} (${comp})`;
    }
    return profile.branchName;
  }, [branchOptions, scope?.branchId, selectedBranchId, profile.branchName]);
  const currentCompanyName = useMemo(() => {
    const found = branchOptions.find(
      (b) => Number(b.id) === Number(scope?.branchId),
    );
    if (found) {
      return found.company_name || `Company #${found.company_id}`;
    }
    if (branchOptions.length === 1) {
      const b = branchOptions[0];
      return b.company_name || `Company #${b.company_id}`;
    }
    const mapped = companies.find(
      (c) => Number(c.id) === Number(scope?.companyId),
    );
    if (mapped) return mapped.name;
    return user?.companyName || `Company #${scope?.companyId ?? "-"}`;
  }, [
    branchOptions,
    scope?.branchId,
    user?.companyName,
    scope?.companyId,
    companies,
  ]);
  useEffect(() => {
    const hasMultipleRoles =
      (Array.isArray(dbRoles) && dbRoles.length > 1) ||
      (Array.isArray(roleOptions) && roleOptions.length > 1);
    const hasMultipleBranches = Array.isArray(branchOptions)
      ? branchOptions.length > 1
      : false;
    if (hasMultipleRoles && hasMultipleBranches) {
      setContextModalOpen(true);
    }
  }, [dbRoles, roleOptions, branchOptions]);

  const isRootPage = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/dashboard") return true;
    return modules.some((m) => m.path === path);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setSidebarOpen(isRootPage);
      } else {
        setSidebarOpen(false);
      }
    }
  }, [location.pathname, isRootPage]);

  useEffect(() => {
    function onDocClick(e) {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target)) setProfileOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    // Proactively prefetch page-level permissions on route change
    try {
      if (ensurePagePerms && typeof location?.pathname === "string") {
        const path = location.pathname || "/";
        const cancelPrefetch = scheduleDeferredTask(
          () => ensurePagePerms(path),
          300,
        );
        return () => cancelPrefetch();
      }
    } catch {}
  }, [location.pathname, ensurePagePerms]);

  useEffect(() => {
    let raf = 0;
    const labels = {
      create: ["+", "new", "create", "generate", "add"],
      delete: ["delete", "deactivate", "remove"],
      edit: ["edit", "update"],
      view: ["view", "open", "details", "preview"],
    };
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const matches = (t, group) => {
      if (!t) return false;
      if (group.includes("+") && t.includes("+")) return true;
      for (const w of group) {
        if (w === "+") continue;
        const re = new RegExp(
          `\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`,
          "i",
        );
        if (re.test(t)) return true;
      }
      return false;
    };
    const resolveFeatureKey = () => {
      const path = (window.location && window.location.pathname) || "/";
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
      return null;
    };
    const resolveBasePath = () => {
      const path = (window.location && window.location.pathname) || "/";
      try {
        return basePathFrom(path);
      } catch {
        const parts = path.split("/").filter(Boolean);
        if (parts.length >= 2) return `/${parts[0]}/${parts[1]}`;
        if (parts.length === 1) return `/${parts[0]}`;
        return "/";
      }
    };
    const apply = () => {
      const fk = resolveFeatureKey();
      const go = globalOverrides || {
        view: false,
        create: false,
        edit: false,
        delete: false,
      };
      const base = resolveBasePath();
      const pageAllow = {
        view: canPerformPageAction ? canPerformPageAction(base, "view") : null,
        create: canPerformPageAction
          ? canPerformPageAction(base, "create")
          : null,
        edit: canPerformPageAction ? canPerformPageAction(base, "edit") : null,
        delete: canPerformPageAction
          ? canPerformPageAction(base, "delete")
          : null,
      };
      if (
        (pageAllow.view === null ||
          pageAllow.create === null ||
          pageAllow.edit === null ||
          pageAllow.delete === null) &&
        ensurePagePerms
      ) {
        try {
          ensurePagePerms(base);
        } catch {}
      }
      const allow = {
        view: pageAllow.view !== null ? pageAllow.view : (fk ? canPerformAction(fk, "view") : true),
        create: pageAllow.create !== null ? pageAllow.create : (fk ? canPerformAction(fk, "create") : true),
        edit: pageAllow.edit !== null ? pageAllow.edit : (fk ? canPerformAction(fk, "edit") : true),
        delete: pageAllow.delete !== null ? pageAllow.delete : (fk ? canPerformAction(fk, "delete") : true),
      };
      const nodes = Array.from(
        document.querySelectorAll(
          'button, a, [role="button"], input[type="button"], input[type="submit"]',
        ),
      );
      const attrNames = [
        "aria-label",
        "title",
        "data-label",
        "data-title",
        "data-tooltip",
        "name",
        "alt",
        "value",
      ];
      const extractTitle = (el) => {
        for (const n of attrNames) {
          const v = el.getAttribute && el.getAttribute(n);
          if (v && String(v).trim()) return String(v);
        }
        // Try dataset fallbacks
        try {
          const ds = el.dataset || {};
          for (const k of Object.keys(ds || {})) {
            const v = ds[k];
            if (v && String(v).trim()) return String(v);
          }
        } catch {}
        // Fall back to text content
        return el.textContent || "";
      };
      for (const el of nodes) {
        try {
          if (
            (el.getAttribute && (el.getAttribute("data-rbac-exempt") === "" || el.getAttribute("data-rbac-exempt") === "true")) ||
            (el.closest && (
              el.closest("[data-rbac-exempt='true']") ||
              el.closest("[data-rbac-exempt]") ||
              el.closest("form") ||
              el.closest(".form-section") ||
              el.closest("[data-form]")
            ))
          ) {
            continue;
          }
        } catch {}
        const titleRaw = extractTitle(el);
        const t = norm(titleRaw);
        let action = null;
        // Prefer explicit data-action or similar hints
        try {
          const ds = el.dataset || {};
          const da = String(ds.action || ds.permission || ds.permAction || "")
            .toLowerCase()
            .trim();
          if (
            da === "view" ||
            da === "create" ||
            da === "edit" ||
            da === "delete"
          ) {
            action = da;
          }
        } catch {}
        if (matches(t, labels.create)) {
          action = "create";
        } else if (matches(t, labels.delete)) {
          action = "delete";
        } else if (matches(t, labels.edit)) {
          action = "edit";
        } else if (matches(t, labels.view)) {
          action = "view";
        }
        if (!action) continue;
        const allowed = allow[action];
        if (allowed) {
          el.hidden = false;
          el.style.display = "";
          el.style.pointerEvents = "";
          el.style.opacity = "";
          el.setAttribute("aria-disabled", "false");
          if ("disabled" in el) el.disabled = false;
        } else {
          el.hidden = true;
          el.style.pointerEvents = "none";
          el.style.opacity = "0.6";
          el.setAttribute("aria-disabled", "true");
          if ("disabled" in el) el.disabled = true;
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const mo = new MutationObserver(() => schedule());
    mo.observe(document.body, { childList: true, subtree: true });
    schedule();
    const onRbac = () => schedule();
    const onStorage = (e) => {
      try {
        const k = String(e?.key || "");
        if (
          k === "rbac_allow_all_view" ||
          k === "rbac_allow_all_create" ||
          k === "rbac_allow_all_edit" ||
          k === "rbac_allow_all_delete"
        ) {
          schedule();
        }
      } catch {
        schedule();
      }
    };
    window.addEventListener("rbac:changed", onRbac);
    window.addEventListener("rbac:updated", onRbac);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("rbac:changed", onRbac);
      window.removeEventListener("rbac:updated", onRbac);
      window.removeEventListener("storage", onStorage);
    };
  }, [location.pathname, canPerformAction, globalOverrides]);

  return (
    <div className="min-h-screen  bg-slate-50 (#f8fafc)  text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col">
      {!sidebarOpen && (
        <button
          type="button"
          aria-label="Open menu"
          className="lg:hidden fixed left-3 top-3 z-[90] inline-flex items-center justify-center w-12 h-12 rounded-full shadow-erp bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
          onClick={() => setSidebarOpen(true)}
          data-rbac-exempt="true"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
      {/* Floating Social Feed Notification - Always Visible */}
      <SocialFeedNotification />

      <header className="flex justify-between items-center px-6 py-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-3 flex-nowrap">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            className="inline-flex items-center"
            aria-label="Go to Home"
          >
            <img
              src={theme === "dark" ? logoDark : logoLight}
              alt="OmniSuite"
              className="h-8 w-auto"
            />
          </Link>
        </div>
        <div className="flex items-center gap-3 flex-nowrap">
          {/* <div className="badge bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-200 border border-brand-300 dark:border-brand-700">
            Role-based + Branch-based
          </div> */}
          <FloatingInstallButton />
          <ThemeToggle />
          <Link
            to="/notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <svg
                className="w-5 h-5 sm:hidden"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="hidden sm:inline text-sm font-semibold">
                User Profile
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-erp-lg overflow-hidden z-50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {profile.username}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Branch
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {currentBranchName}
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setContextModalOpen(true)}
                      className="w-full text-sm font-semibold text-white px-4 py-2 rounded-lg bg-ticker-blue hover:opacity-90 transition-opacity"
                      disabled={
                        (dbRoles.length > 1 || roleOptions.length > 1) &&
                        branchOptions.length > 1
                      }
                    >
                      Switch Branch
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setChangePwModalOpen(true);
                        setPwCurrent("");
                        setPwNew("");
                        setPwConfirm("");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-ticker-green hover:opacity-90 transition-opacity"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span className="flex-1 text-left">Change Password</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await logout({ redirect: true });
                      }}
                      className="btn-secondary text-red-500"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {savedToast && (
        <div className="px-6 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-b border-green-300 dark:border-green-800 text-sm">
          Saved Offline
        </div>
      )}
      {!online && (
        <div className="px-6 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-b border-yellow-300 dark:border-yellow-800 text-sm">
          Offline mode enabled. Pages and assets are cached. Actions queue for
          sync.
        </div>
      )}
      {queueOpen && (
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="text-sm">
            Pending {pending} â€¢ Failed {failed} â€¢ Completed {completed}
          </div>
          <div className="mt-3">
            <div className="grid grid-cols-1 gap-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between px-3 py-2 rounded border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-xs">
                    <span className="font-semibold">
                      {it.method.toUpperCase()}
                    </span>{" "}
                    <span className="text-slate-500">{it.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        it.status === "pending"
                          ? "badge bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
                          : it.status === "failed"
                            ? "badge bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-800"
                            : "badge bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-800"
                      }
                    >
                      {it.status}
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-xs text-slate-500">No queued items</div>
              )}
            </div>
          </div>
        </div>
      )}
      {contextModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md card p-6 shadow-erp-lg bg-white dark:bg-slate-900">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Switch Role & Branch</h2>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => setContextModalOpen(false)}
                aria-label="Close"
              >
                âœ•
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {/* <div>
                <label className="label">Company</label>
                <div className="input">{currentCompanyName}</div>
              </div> */}
              <div>
                <label className="label">Role</label>
                {dbRoles.length > 1 || roleOptions.length > 1 ? (
                  <select
                    className="input w-full"
                    value={selectedRole || ""}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={dbRolesLoading}
                  >
                    {(dbRoles.length ? dbRoles : roleOptions).map((r) => {
                      const name = typeof r === "string" ? r : r.name || r.code;
                      const key = typeof r === "string" ? r : r.id;
                      return (
                        <option key={key} value={name}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="input">{selectedRole || profile.role}</div>
                )}
              </div>
              <div>
                <label className="label">Branch</label>
                {branchOptions.length > 1 ? (
                  <select
                    className="input w-full"
                    value={String(selectedBranchId || scope?.branchId || "")}
                    onChange={(e) =>
                      setSelectedBranchId(Number(e.target.value))
                    }
                  >
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.company_name || `Company #${b.company_id}`}
                        )
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="input">{currentBranchName}</div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setContextModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  ((dbRoles.length > 1 || roleOptions.length > 1) &&
                    !selectedRole) ||
                  (branchOptions.length > 1 && !selectedBranchId)
                }
                onClick={() => {
                  const chosen = branchOptions.find(
                    (b) =>
                      Number(b.id) ===
                      Number(selectedBranchId || scope?.branchId),
                  );
                  setScope((prev) => ({
                    ...prev,
                    companyId: chosen
                      ? Number(chosen.company_id)
                      : prev.companyId,
                    branchId: chosen ? Number(chosen.id) : prev.branchId,
                  }));
                  setContextModalOpen(false);
                  setProfileOpen(false);
                  navigate("/");
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {welcomeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-6">
          <div className="w-full max-w-sm sm:max-w-md card p-5 sm:p-6 shadow-erp-lg bg-white dark:bg-slate-900 text-center max-h-[90vh] overflow-y-auto">
            <div className="mx-auto w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3 sm:mb-4">
              <svg
                className="w-6 sm:w-7 h-6 sm:h-7 text-blue-600 dark:text-blue-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Welcome!
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              To keep your account secure, please change your password before
              proceeding
            </p>
            <button
              type="button"
              className="btn-primary w-full mt-5 sm:mt-6"
              onClick={() => {
                setWelcomeModalOpen(false);
                setChangePwModalOpen(true);
                setPwCurrent("");
                setPwNew("");
                setPwConfirm("");
              }}
            >
              Change Password
            </button>
          </div>
        </div>
      )}
      {changePwModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-6">
          <div className="w-full max-w-sm sm:max-w-md card shadow-erp-2xl bg-white dark:bg-slate-900 flex flex-col max-h-[90vh]">
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base sm:text-lg font-bold">
                  Change Password
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwCurrent ? "text" : "password"}
                      placeholder="Enter current password"
                      className="input w-full pr-10"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwCurrent((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPwCurrent ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwNew ? "text" : "password"}
                      placeholder="Enter new password"
                      className="input w-full pr-10"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPwNew ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Verify Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      className="input w-full pr-10"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPwConfirm ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                className="btn-primary w-full py-2.5 text-base shadow-md"
                data-rbac-exempt="true"
                disabled={pwChanging}
                onClick={async () => {
                  if (!pwCurrent || !pwNew || !pwConfirm) {
                    toast.error("Fill in all password fields");
                    return;
                  }
                  if (pwNew.length < 6) {
                    toast.error("New password must be at least 6 characters");
                    return;
                  }
                  if (pwNew !== pwConfirm) {
                    toast.error("New password and confirmation do not match");
                    return;
                  }
                  setPwChanging(true);
                  try {
                    await api.post("/auth/change-password", {
                      currentPassword: pwCurrent,
                      newPassword: pwNew,
                      confirmNewPassword: pwConfirm,
                    });
                    toast.success("Password changed successfully");
                    setPwCurrent("");
                    setPwNew("");
                    setPwConfirm("");
                    setChangePwModalOpen(false);
                    const stored = readStoredAuth();
                    if (stored?.user) {
                      stored.user.status = "Y";
                      writeStoredAuth(stored);
                    }
                  } catch (err) {
                    const msg =
                      err?.response?.data?.message ||
                      err?.message ||
                      "Failed to change password";
                    toast.error(msg);
                  } finally {
                    setPwChanging(false);
                  }
                }}
              >
                {pwChanging ? "Saving..." : "Update Password Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={
          "flex-1 " +
          (sidebarOpen ? "grid md:grid-cols-[280px_1fr]" : "grid grid-cols-1")
        }
      >
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 md:hidden transition-opacity duration-300 animate-in fade-in"
          />
        )}

        <aside
          onTouchStart={handleSidebarTouchStart}
          onTouchEnd={handleSidebarTouchEnd}
          className={
            "md:sticky md:top-[45px] md:h-[calc(100vh-45px)] border-b md:border-b-0 md:border-r border-slate-800 dark:border-slate-800 p-5 bg-brand-950 dark:bg-slate-950 shadow-lg overflow-y-auto no-scrollbar z-[60] transition-all duration-300 ease-in-out " +
            (sidebarOpen
              ? "fixed inset-y-0 left-0 w-[280px] top-[45px] translate-x-0 md:static md:translate-x-0"
              : "fixed inset-y-0 left-0 w-[280px] top-[45px] -translate-x-full md:static md:translate-x-0 md:hidden")
          }
        >
          <nav className="space-y-1 pb-6">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-200 group ` +
                (isActive
                  ? "bg-brand-800 text-white shadow-lg border-l-4 border-secondary"
                  : "text-brand-200 hover:bg-brand-800 hover:text-white border-l-4 border-transparent")
              }
            >
              <span
                className="w-6 text-lg leading-none opacity-80 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              >
                <Home />
              </span>
              <span>Home</span>
            </NavLink>
            {modules
              .filter((m) => {
                if (m.key === "system-configuration") {
                  return user?.id === 1 || user?.id === 2;
                }
                // Use PermissionContext to check if module should appear in sidebar
                return canViewModule(m.key);
              })
              .map((m) => (
                <NavLink
                  key={m.key}
                  to={m.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-200 group ` +
                    (isActive
                      ? "bg-brand-800 text-white shadow-lg border-l-4 border-secondary"
                      : "text-brand-200 hover:bg-brand-800 hover:text-white border-l-4 border-transparent")
                  }
                >
                  <span
                    className="w-6 text-lg leading-none opacity-80 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  >
                    {m.icon}
                  </span>
                  <span className="ml-3">{m.label}</span>
                </NavLink>
              ))}
          </nav>
        </aside>

        <main className=" bg-slate-50 (#f8fafc)  dark:bg-slate-900 overflow-x-hidden min-w-0">
          <div className="w-full max-w-full 2xl:max-w-[1600px] mx-auto p-2 md:p-2 lg:p-3">
            {pushPromptVisible ? (
              <div className="mb-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm">
                  Enable push notifications to receive approval alerts.
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={enablePushNow}>
                    Enable Push
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setPushPromptVisible(false)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            {!online && !isRootPage && !location.pathname.startsWith("/pos") ? (
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-w-lg w-full text-center">
                  <div className="text-4xl mb-2">ðŸ“¡</div>
                  <div className="text-lg font-semibold mb-1">Offline</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    This module requires a network connection. Return to Home or
                    reconnect to continue.
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Link to="/" className="btn">
                      Home
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <React.Suspense fallback={<div>Loading...</div>}>
                <AppRoutes user={user} />
              </React.Suspense>
            )}
          </div>
        </main>
      </div>
      {location.pathname &&
      location.pathname.startsWith("/inventory/stock-verification") ? (
        <FloatingCreateButton
          to="/inventory/stock-verification/new"
          title="New Verification"
        />
      ) : null}
      <PaymentPackageModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} companyId={user?.company_id || user?.companyIds?.[0]} />
      <FloatingChat />
      <BanksAiFloating />
    </div>
  );
}

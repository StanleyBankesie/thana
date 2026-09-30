/**
 * @fileoverview SettingsPage component.
 * Provides functionality for SettingsPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Bell, Mail, MessageSquare, Smartphone, Trash2, Edit2, Users } from "lucide-react";
import NotificationSettings from "./notifications/NotificationSettings.jsx";

const TABS = [
  { key: "general", label: "General" },
  { key: "notifications", label: "Notifications" },
  { key: "templates", label: "Templates" },
  { key: "departments", label: "Departments" },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [pushEnabled, setPushEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("push_enabled");
      if (raw === null) return true;
      return String(raw) === "1";
    } catch { return true; }
  });
  const [permissionStatus, setPermissionStatus] = useState(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        return String(window.Notification.permission || "default");
      }
    } catch {}
    return "default";
  });
  const [cloud, setCloud] = useState({ cloud_name: "", api_key: "", api_secret: "", folder: "", has_secret: false });
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [emailTestTo, setEmailTestTo] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  const [loginHeroImageUrl, setloginHeroImageUrl] = useState("");
  const [loginHeroImageVersion, setloginHeroImageVersion] = useState("");
  const [loginHeroImageSaving, setloginHeroImageSaving] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("omnisuite.inactivityTimeout");
        if (val !== null) return val;
      }
    } catch {}
    return "60";
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermissionStatus(String(window.Notification.permission || "default"));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("push_enabled", pushEnabled ? "1" : "0"); } catch {}
  }, [pushEnabled]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCloudLoading(true);
        const res = await api.get("/admin/settings/cloudinary");
        const d = res?.data?.data || {};
        if (!mounted) return;
        setCloud(p => ({ ...p, cloud_name: d.cloud_name || "", api_key: d.api_key || "", folder: d.folder || "", has_secret: !!d.has_secret }));
      } catch {} finally { if (mounted) setCloudLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  async function saveCloudinary() {
    try {
      setCloudSaving(true);
      await api.post("/admin/settings/cloudinary", {
        cloud_name: cloud.cloud_name, api_key: cloud.api_key,
        api_secret: cloud.api_secret || undefined, folder: cloud.folder || undefined,
      });
      toast.success("Cloudinary settings saved");
      setCloud(p => ({ ...p, has_secret: true, api_secret: "" }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally { setCloudSaving(false); }
  }

  async function sendTestEmail() {
    try {
      setEmailTesting(true);
      const res = await api.post("/admin/email/test", { to: emailTestTo || undefined });
      const configured = !!res?.data?.configured;
      const sent = !!res?.data?.sent;
      if (!configured) toast.error("Mailer not configured");
      else if (sent) toast.success("Test email sent");
      else toast.error("Mailer configured but send failed");
    } catch { toast.error("Failed to send test email"); }
    finally { setEmailTesting(false); }
  }

  async function loadloginHeroImageMeta() {
    try {
      const res = await api.get("/admin/settings/login-hero-bg-info");
      if (res.data) {
        const hasBackground = !!res?.data?.hasBackground;
        const version = res?.data?.updatedAt || Date.now();
        setloginHeroImageVersion(String(version || ""));
        setloginHeroImageUrl(hasBackground ? `/api/admin/settings/login-hero-background?v=${encodeURIComponent(String(version))}` : "");
      }
    } catch {
      setloginHeroImageUrl("");
      setloginHeroImageVersion("");
    }
  }

  useEffect(() => { loadloginHeroImageMeta(); }, []);

  async function uploadloginHeroImage(file) {
    if (!file) return;
    try {
      setloginHeroImageSaving(true);
      let uploadFile = file;
      if (file.size > 300 * 1024) {
        const compressed = await new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            const maxDim = 1920;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = (h / w) * maxDim; w = maxDim; }
              else { w = (w / h) * maxDim; h = maxDim; }
            }
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            c.toBlob(blob => resolve(blob), "image/jpeg", 0.8);
          };
          img.src = url;
        });
        uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      }
      const fd = new FormData();
      fd.append("background", uploadFile);
      await api.post("/admin/settings/login-hero-background", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Login hero image updated");
      await loadloginHeroImageMeta();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to update Login hero image");
    } finally { setloginHeroImageSaving(false); }
  }

  async function clearloginHeroImage() {
    try {
      setloginHeroImageSaving(true);
      await api.delete("/admin/settings/login-hero-background");
      setloginHeroImageUrl("");
      setloginHeroImageVersion("");
      toast.success("Login hero image reset");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to reset Login hero image");
    } finally { setloginHeroImageSaving(false); }
  }

  async function requestPushPermission() {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const res = await window.Notification.requestPermission();
      setPermissionStatus(String(res || "default"));
      toast[res === "granted" ? "success" : "info"](res === "granted" ? "Notifications enabled" : "Notifications permission denied or dismissed");
    } catch {}
  }

  async function subscribePushNow() {
    try {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      if (window.Notification.permission !== "granted") { toast.info("Grant notification permission first"); return; }
      const reg = await navigator.serviceWorker.ready;
      const res = await api.get("/push/public-key");
      const publicKey = String(res.data?.publicKey || "");
      if (!publicKey) { toast.error("Missing VAPID public key"); return; }
      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        await api.post("/push/subscribe", { subscription: existing.toJSON() });
        toast.success("Push subscription saved"); return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      toast.success("Subscribed to push notifications");
    } catch { toast.error("Failed to subscribe"); }
  }

  async function unsubscribePushNow() {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        try { await api.delete("/push/unsubscribe", { data: { subscription: existing.toJSON() } }); } catch {}
        try { await existing.unsubscribe(); } catch {}
        toast.success("Unsubscribed");
      } else toast.info("No active subscription");
    } catch { toast.error("Failed to unsubscribe"); }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">Administration Settings</h1>
              <p className="text-sm mt-1">Notifications, branding, and document setup</p>
            </div>
            <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
          </div>
        </div>
      </div>

      <div className="flex border-b mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${activeTab === tab.key ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-lg font-semibold">Login Hero Image</div>
                  <div className="text-sm text-slate-500">Change the image shown behind the login form.</div>
                </div>
                {loginHeroImageUrl ? (
                  <div className="w-44 h-28 rounded-lg border border-slate-200 bg-slate-900 overflow-hidden flex items-center justify-center p-1 shadow-inner">
                    <img src={loginHeroImageUrl} alt="Hero Background Preview" className="w-full h-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="w-44 h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500 font-medium">Default image</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn-primary cursor-pointer">
                  {loginHeroImageSaving ? "Saving..." : "Upload Background"}
                  <input type="file" accept="image/*" className="hidden" disabled={loginHeroImageSaving} onChange={e => { const file = e.target.files?.[0] || null; e.target.value = ""; uploadloginHeroImage(file); }} />
                </label>
                <button type="button" className="btn-outline" disabled={loginHeroImageSaving || !loginHeroImageUrl} onClick={clearloginHeroImage}>Reset to Default</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3">
              <div className="text-lg font-semibold">Upcoming Events & Announcements</div>
              <div className="text-sm text-slate-500">Configure multiple event topics to be displayed on the login page carousel.</div>
              <AnnouncementsSection />
            </div>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-semibold">Push Notifications</div>
                  <div className="text-sm text-slate-500">Permission: {permissionStatus}</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm">Enabled</span>
                  <input type="checkbox" className="toggle" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} />
                </label>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 w-1/3">
                  <button type="button" className="btn-secondary" onClick={requestPushPermission}>Request Permission</button>
                </div>
                <div className="flex flex-col gap-1 w-1/3">
                  <button type="button" className="btn-primary" onClick={subscribePushNow} disabled={!pushEnabled}>Subscribe Now</button>
                </div>
                <div className="flex flex-col gap-1 w-1/3">
                  <button type="button" className="btn-outline" onClick={unsubscribePushNow}>Unsubscribe</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body p-0">
              <NotificationSettings />
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3">
              <div className="text-lg font-semibold">Low Stock Notifications</div>
              <div className="text-sm text-slate-500">Configure how users receive low stock alerts</div>
              <LowStockNotificationSection />
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Document Templates</div>
            <div className="text-sm text-slate-500">Manage print and PDF templates for Sales Order, Invoice, and more.</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Link to="/administration/settings/templates?type=general-template" className="btn-outline">Report Header</Link>
              <Link to="/administration/settings/templates?type=sales-order" className="btn-outline">Sales Order</Link>
              <Link to="/administration/settings/templates?type=invoice" className="btn-outline">Invoice</Link>
              <Link to="/administration/settings/templates?type=delivery-note" className="btn-outline">Delivery Note</Link>
              <Link to="/administration/settings/templates?type=payment-voucher" className="btn-outline">Payment Voucher</Link>
              <Link to="/administration/settings/templates?type=salary-slip" className="btn-outline">Salary Slip</Link>
              <Link to="/administration/settings/templates?type=receipt-voucher" className="btn-outline">Receipt Voucher</Link>
              <Link to="/administration/settings/templates?type=quotation" className="btn-outline">Quotation</Link>
              <Link to="/administration/settings/templates?type=purchase-order" className="btn-outline">Purchase Order</Link>
              <Link to="/administration/settings/templates?type=grn" className="btn-outline">GRN</Link>
              <Link to="/administration/settings/templates?type=purchase-bill" className="btn-outline">Purchase Bill</Link>
              <Link to="/administration/settings/templates?type=direct-purchase" className="btn-outline">Direct Purchase</Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === "departments" && <DepartmentsSection />}
      
    </div>
  );
}

function LowStockNotificationSection() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignedRecipients, setAssignedRecipients] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      const items = res?.data?.data?.items || res?.data?.items || [];
      setUsers(items);
    } catch {}
  };

  const loadAssigned = async () => {
    try {
      setLoadingAssigned(true);
      const res = await api.get("/access/notification-prefs?key=low-stock");
      const items = res?.data?.items || [];
      setAssignedRecipients(items);
    } catch {
      setAssignedRecipients([]);
    } finally {
      setLoadingAssigned(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAssigned();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setPushEnabled(false);
      setEmailEnabled(false);
      setSmsEnabled(false);
      setWhatsappEnabled(false);
      return;
    }
    async function loadPref() {
      try {
        setLoading(true);
        const res = await api.get(`/access/notification-prefs?key=low-stock&user_id=${selectedUserId}`);
        const item = res?.data?.item || null;
        setPushEnabled(Boolean(item?.push_enabled));
        setEmailEnabled(Boolean(item?.email_enabled));
        setSmsEnabled(Boolean(item?.sms_enabled));
        setWhatsappEnabled(Boolean(item?.whatsapp_enabled));
      } catch { 
        setPushEnabled(false); 
        setEmailEnabled(false); 
        setSmsEnabled(false); 
        setWhatsappEnabled(false); 
      } finally {
        setLoading(false);
      }
    }
    loadPref();
  }, [selectedUserId]);

  async function save() {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      await api.put(`/access/notification-prefs/low-stock`, { 
        user_id: Number(selectedUserId), 
        push_enabled: pushEnabled ? 1 : 0, 
        email_enabled: emailEnabled ? 1 : 0,
        sms_enabled: smsEnabled ? 1 : 0,
        whatsapp_enabled: whatsappEnabled ? 1 : 0
      });
      toast.success("Low stock alert preferences updated successfully");
      await loadAssigned();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipient(userId) {
    try {
      await api.delete(`/access/notification-prefs/low-stock/${userId}`);
      toast.success("User removed from low stock alert recipients");
      if (Number(selectedUserId) === Number(userId)) {
        setPushEnabled(false);
        setEmailEnabled(false);
        setSmsEnabled(false);
        setWhatsappEnabled(false);
      }
      await loadAssigned();
    } catch (e) {
      // Fallback to update with 0s if delete endpoint fails
      try {
        await api.put(`/access/notification-prefs/low-stock`, {
          user_id: Number(userId),
          push_enabled: 0,
          email_enabled: 0,
          sms_enabled: 0,
          whatsapp_enabled: 0,
        });
        toast.success("User removed from low stock alert recipients");
        await loadAssigned();
      } catch {
        toast.error("Failed to remove recipient");
      }
    }
  }

  const selectedUserObj = users.find(u => Number(u.id) === Number(selectedUserId));

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Select User (By Username)
          </label>
          <select 
            className="input w-full bg-white dark:bg-slate-800" 
            value={selectedUserId} 
            onChange={e => setSelectedUserId(e.target.value)}
          >
            <option value="">-- Choose a user by username --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.username} {u.full_name ? `(${u.full_name})` : u.email ? `(${u.email})` : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
            {loading ? (
              <div className="text-sm text-slate-500 py-3 flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
                Loading preferences for @{selectedUserObj?.username || selectedUserId}...
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Configure active alert channels for <span className="text-brand font-bold">@{selectedUserObj?.username || selectedUserId}</span>:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand/40 transition-colors">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-sm toggle-primary" 
                      checked={pushEnabled} 
                      onChange={e => setPushEnabled(e.target.checked)} 
                    />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Bell size={16} className="text-blue-500" />
                      <span>In-App Push</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand/40 transition-colors">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-sm toggle-primary" 
                      checked={emailEnabled} 
                      onChange={e => setEmailEnabled(e.target.checked)} 
                    />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Mail size={16} className="text-emerald-500" />
                      <span>Email Notification</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand/40 transition-colors">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-sm toggle-primary" 
                      checked={smsEnabled} 
                      onChange={e => setSmsEnabled(e.target.checked)} 
                    />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare size={16} className="text-amber-500" />
                      <span>SMS Alert</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand/40 transition-colors">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-sm toggle-primary" 
                      checked={whatsappEnabled} 
                      onChange={e => setWhatsappEnabled(e.target.checked)} 
                    />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Smartphone size={16} className="text-green-600" />
                      <span>WhatsApp Alert</span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button 
                    type="button" 
                    className="btn btn-secondary text-xs"
                    onClick={() => setSelectedUserId("")}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="btn btn-primary text-xs px-4" 
                    onClick={save} 
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Assigned Recipients Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-brand" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Users Assigned to Receive Low Stock Alerts
            </h4>
            <span className="text-xs px-2 py-0.5 bg-brand/10 text-brand font-extrabold rounded-full">
              {assignedRecipients.length}
            </span>
          </div>
          <button 
            type="button"
            onClick={loadAssigned} 
            className="text-xs text-brand hover:underline font-semibold"
          >
            Refresh List
          </button>
        </div>

        {loadingAssigned ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading assigned recipients...</div>
        ) : assignedRecipients.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            No users are currently configured to receive automatic low stock alerts. Select a user above to assign alert channels.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5">Username</th>
                  <th className="px-4 py-2.5">Name / Contact</th>
                  <th className="px-4 py-2.5">Branch</th>
                  <th className="px-4 py-2.5">Active Channels</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {assignedRecipients.map((rec) => (
                  <tr key={rec.user_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-brand font-extrabold">@{rec.username || `user_${rec.user_id}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-medium">{rec.full_name || "—"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {rec.email} {rec.telephone ? `· ${rec.telephone}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">
                      {rec.branch_name || "All Branches"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Boolean(rec.push_enabled) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                            <Bell size={10} /> Push
                          </span>
                        )}
                        {Boolean(rec.email_enabled) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            <Mail size={10} /> Email
                          </span>
                        )}
                        {Boolean(rec.sms_enabled) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                            <MessageSquare size={10} /> SMS
                          </span>
                        )}
                        {Boolean(rec.whatsapp_enabled) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300">
                            <Smartphone size={10} /> WhatsApp
                          </span>
                        )}
                        {!rec.push_enabled && !rec.email_enabled && !rec.sms_enabled && !rec.whatsapp_enabled && (
                          <span className="text-[10px] text-slate-400 italic">None active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(String(rec.user_id))}
                          className="p-1.5 rounded-lg text-brand hover:bg-brand/10 transition-colors"
                          title="Edit user alert preferences"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecipient(rec.user_id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Remove alert subscription"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DepartmentsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", is_active: 1 });
  const [editingId, setEditingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/departments");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch { toast.error("Failed to load departments"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => { setForm({ name: "", code: "", is_active: 1 }); setEditingId(null); };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/departments/${editingId}`, form);
        toast.success("Department updated");
      } else {
        await api.post("/admin/departments", form);
        toast.success("Department created");
      }
      resetForm();
      loadData();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleEdit = (item) => {
    setForm({ name: item.name, code: item.code, is_active: item.is_active });
    setEditingId(item.id);
  };

  const handleCancel = () => resetForm();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="card p-4">
          <h3 className="font-medium mb-4">{editingId ? "Edit Department" : "Add Department"}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Code</label>
              <input className="input w-full" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="checkbox" checked={form.is_active === 1 || form.is_active === true} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              {editingId && (
                <button className="btn-outline" onClick={handleCancel}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold text-slate-500 uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : items.length > 0 ? items.map(item => (
                  <tr key={item.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.code}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(item)} className="text-brand hover:text-brand-700 text-sm font-medium">Edit</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No departments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsSection() {
  const [topics, setTopics] = useState([""]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/admin/settings/announcements");
        let loaded = res?.data?.announcements || [];
        if (!Array.isArray(loaded)) {
          loaded = loaded ? [String(loaded)] : [];
        }
        if (loaded.length === 0) loaded = [""];
        setTopics(loaded);
      } catch {
        toast.error("Failed to load announcements");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (idx, val) => {
    const newTopics = [...topics];
    newTopics[idx] = val;
    setTopics(newTopics);
  };

  const handleAdd = () => {
    setTopics([...topics, ""]);
  };

  const handleRemove = (idx) => {
    const newTopics = topics.filter((_, i) => i !== idx);
    if (newTopics.length === 0) newTopics.push("");
    setTopics(newTopics);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validTopics = topics.filter(t => t.trim() !== "");
      await api.post("/admin/settings/announcements", { announcements: validTopics });
      toast.success("Announcements saved successfully");
      if (validTopics.length === 0) setTopics([""]);
      else setTopics(validTopics);
    } catch {
      toast.error("Failed to save announcements");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 py-2">Loading...</div>;

  return (
    <div className="space-y-4">
      {topics.map((topic, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. Annual Company Retreat - Nov 15th"
            className="input flex-1"
            value={topic}
            onChange={(e) => handleChange(idx, e.target.value)}
          />
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="btn-outline px-3 text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
            title="Remove topic"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={handleAdd} className="btn-outline">
          + Add Topic
        </button>
        <button type="button" onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Topics"}
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  X, Share2, Users, Shield, Copy, Check, Lock, Eye, Filter, Edit3
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client.js";

export default function BIShareModal({
  isOpen,
  onClose,
  title = "Analysis View",
  moduleKey = "general",
  filters = {},
}) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [shareType, setShareType] = useState("USER"); // USER | ROLE
  const [targetId, setTargetId] = useState("");
  const [permissionLevel, setPermissionLevel] = useState("VIEW_FILTER");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get("/admin/users").then(res => setUsers(res.data?.items || res.data?.data || [])).catch(() => {});
      api.get("/admin/roles").then(res => setRoles(res.data?.items || res.data?.data || [])).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!targetId) {
      toast.error("Please select a target user or role to share with");
      return;
    }
    setLoading(true);
    try {
      // 1. Save analysis first if not already saved
      const saveRes = await api.post("/bi/saved-analyses", {
        title,
        module_key: moduleKey,
        filters,
      });
      const analysisId = saveRes.data?.id;

      // 2. Share with target
      await api.post("/bi/share-analysis", {
        analysis_id: analysisId,
        share_type: shareType,
        target_id: Number(targetId),
        permission_level: permissionLevel,
      });

      toast.success("Analysis shared successfully!");
      onClose();
    } catch {
      toast.error("Failed to share analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.info("Filtered analysis link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-erp-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Share Analysis</h3>
              <p className="text-xs text-slate-400">Share this filtered report with colleagues or teams</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Quick Copy Link */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Direct Filtered Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="input w-full text-xs font-mono bg-white dark:bg-slate-900 text-slate-500 py-1.5 px-2.5"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-secondary text-xs px-3 py-1.5 gap-1 whitespace-nowrap"
              >
                {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Internal User/Role Sharing */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShareType("USER"); setTargetId(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  shareType === "USER"
                    ? "bg-brand-900 text-white border-brand-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent"
                }`}
              >
                Share with User
              </button>
              <button
                type="button"
                onClick={() => { setShareType("ROLE"); setTargetId(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  shareType === "ROLE"
                    ? "bg-brand-900 text-white border-brand-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent"
                }`}
              >
                Share with Role
              </button>
            </div>

            {shareType === "USER" ? (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Select User *</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="input w-full text-xs"
                >
                  <option value="">Select a user...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.username} ({u.email || "No Email"})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Select Role *</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="input w-full text-xs"
                >
                  <option value="">Select a role...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Access Level</label>
              <select
                value={permissionLevel}
                onChange={(e) => setPermissionLevel(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="VIEW">View Only</option>
                <option value="VIEW_FILTER">View & Adjust Filters</option>
                <option value="VIEW_ANALYZE">View, Filter & Drill Down</option>
                <option value="FULL">Full Access (Analyze & Export)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-xs px-3.5 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={loading}
            className="btn-primary text-xs px-5 py-1.5 gap-1.5"
          >
            <Share2 size={13} />
            <span>{loading ? "Sharing..." : "Grant Access"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

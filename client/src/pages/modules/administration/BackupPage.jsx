import React, { useState, useEffect } from "react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function BackupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [superAdminId, setSuperAdminId] = useState(1);
  const [settings, setSettings] = useState({
    s3: { bucket: "", region: "", endpoint: "", access_key: "", secret_key: "", has_secret: false },
    gdrive: { client_email: "", folder_id: "", private_key: "", has_private_key: false },
    b2: { bucket: "", endpoint: "", access_key: "", secret_key: "", has_secret: false },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const adminRes = await api.get("/licenses/super-admin").catch(() => null);
        if (adminRes?.data?.superAdminId && mounted) {
          setSuperAdminId(adminRes.data.superAdminId);
        }

        setLoading(true);
        const res = await api.get("/admin/settings/backups");
        const d = res?.data?.data;
        if (d && mounted) {
          setSettings({
            s3: { ...d.s3, secret_key: "" },
            gdrive: { ...d.gdrive, private_key: "" },
            b2: { ...d.b2, secret_key: "" },
          });
        }
      } catch (err) {
        toast.error("Failed to load backup settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/admin/settings/backups", settings);
      toast.success("Backup settings saved successfully");
      setSettings(prev => ({
        s3: { ...prev.s3, secret_key: "", has_secret: true },
        gdrive: { ...prev.gdrive, private_key: "", has_private_key: true },
        b2: { ...prev.b2, secret_key: "", has_secret: true },
      }));
    } catch (err) {
      toast.error(err.message || "Failed to save backup settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (provider, field, value) => {
    setSettings(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }));
  };

  if (Number(user?.id) !== Number(superAdminId)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to view the Backup Settings page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Backup Settings</h1>
          <p className="text-slate-500 text-sm">Configure automated backup integrations.</p>
        </div>
        <button 
          onClick={() => navigate("/administration?section=System%20Health%20%26%20Settings")} 
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded shadow-sm transition"
        >
          Back to Menu
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading backup settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 mb-4">AWS S3 Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bucket Name</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.bucket} onChange={e => handleChange('s3', 'bucket', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.region} onChange={e => handleChange('s3', 'region', e.target.value)} placeholder="e.g. us-east-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint (Optional)</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.endpoint} onChange={e => handleChange('s3', 'endpoint', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Key ID</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.access_key} onChange={e => handleChange('s3', 'access_key', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Access Key {settings.s3.has_secret && <span className="text-green-600 text-xs">(Saved)</span>}</label>
                <input type="password" className="w-full px-3 py-2 border rounded-md" value={settings.s3.secret_key} onChange={e => handleChange('s3', 'secret_key', e.target.value)} placeholder={settings.s3.has_secret ? "Leave blank to keep existing" : ""} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Google Drive Configuration</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Email</label>
                <input type="email" className="w-full px-3 py-2 border rounded-md" value={settings.gdrive.client_email} onChange={e => handleChange('gdrive', 'client_email', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Folder ID</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.gdrive.folder_id} onChange={e => handleChange('gdrive', 'folder_id', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Private Key {settings.gdrive.has_private_key && <span className="text-green-600 text-xs">(Saved)</span>}</label>
                <textarea className="w-full px-3 py-2 border rounded-md" rows="3" value={settings.gdrive.private_key} onChange={e => handleChange('gdrive', 'private_key', e.target.value)} placeholder={settings.gdrive.has_private_key ? "Leave blank to keep existing" : ""}></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Backblaze B2 Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bucket Name</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.bucket} onChange={e => handleChange('b2', 'bucket', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.endpoint} onChange={e => handleChange('b2', 'endpoint', e.target.value)} placeholder="e.g. https://s3.us-west-004.backblazeb2.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application Key ID</label>
                <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.access_key} onChange={e => handleChange('b2', 'access_key', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application Key {settings.b2.has_secret && <span className="text-green-600 text-xs">(Saved)</span>}</label>
                <input type="password" className="w-full px-3 py-2 border rounded-md" value={settings.b2.secret_key} onChange={e => handleChange('b2', 'secret_key', e.target.value)} placeholder={settings.b2.has_secret ? "Leave blank to keep existing" : ""} />
              </div>
            </div>
          </div>

          <div>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-white rounded-md font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Backup Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

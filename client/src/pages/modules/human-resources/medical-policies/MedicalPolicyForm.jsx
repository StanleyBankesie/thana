/**
 * @fileoverview MedicalPolicyForm component.
 * Provides functionality for MedicalPolicyForm.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MedicalPolicyForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [policyFile, setPolicyFile] = useState(null);
  const [form, setForm] = useState({
    policy_code: '',
    policy_name: '',
    provider: '',
    description: '',
    coverage_details: '',
    premium_amount: 0,
    renewal_date: '',
    attachment_url: '',
    attachment_name: '',
    is_active: true
  });

  function getNextMedicalPolicyCode(items = []) {
    const maxCode = items.reduce((max, item) => {
      const code = String(item?.policy_code || "");
      if (!/^MP\d{6}$/.test(code)) return max;
      const value = Number(code.slice(2));
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    return `MP${String(maxCode + 1).padStart(6, "0")}`;
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!isEdit) {
          const res = await api.get("/hr/medical-policies");
          const items = res.data.items || [];
          setForm((prev) => ({
            ...prev,
            policy_code: getNextMedicalPolicyCode(items),
          }));
        } else {
          const res = await api.get(`/hr/medical-policies/${id}`);
          const item = res.data.item;
          setForm({
            ...item,
            renewal_date: item.renewal_date ? item.renewal_date.slice(0, 10) : '',
            is_active: !!item.is_active
          });
        }
      } catch {
        toast.error(isEdit ? "Failed to load policy" : "Failed to prepare policy code");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function uploadMedicalFileIfNeeded() {
    if (!policyFile) return null;
    const formData = new FormData();
    formData.append("file", policyFile);
    formData.append("folder", "hr_medical_policies");
    setUploadingFile(true);
    try {
      const res = await api.post("/upload", formData);
      return {
        url: res?.data?.url || "",
        name: res?.data?.filename || policyFile.name || "",
      };
    } finally {
      setUploadingFile(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      const uploaded = await uploadMedicalFileIfNeeded();
      if (uploaded?.url) {
        payload.attachment_url = uploaded.url;
        payload.attachment_name = uploaded.name;
      }
      if (!payload.attachment_url) {
        toast.error("Medical policy document upload is required");
        setLoading(false);
        return;
      }
      await api.post('/hr/medical-policies', payload);
      toast.success(isEdit ? "Policy updated" : "Policy created");
      navigate('/human-resources/medical-policies');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Medical Policy' : 'New Medical Policy'}</h1>
        <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <input type="hidden" name="policy_code" value={form.policy_code} readOnly />
          <div>
            <label className="label">Policy Name *</label>
            <input 
              className="input" 
              value={form.policy_name} 
              onChange={(e) => update('policy_name', e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Provider *</label>
            <input 
              className="input" 
              value={form.provider} 
              onChange={(e) => update('provider', e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Renewal Date</label>
            <input 
              className="input" 
              type="date" 
              value={form.renewal_date} 
              onChange={(e) => update('renewal_date', e.target.value)} 
            
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            />
          </div>
          <div>
            <label className="label">Premium Amount</label>
            <input 
              className="input" 
              type="number" 
              step="0.01"
              value={form.premium_amount} 
              onChange={(e) => update('premium_amount', e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select 
              className="input" 
              value={form.is_active ? '1' : '0'} 
              onChange={(e) => update('is_active', e.target.value === '1')}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea 
            className="input h-24" 
            value={form.description || ''} 
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Coverage Details</label>
          <textarea 
            className="input h-32" 
            value={form.coverage_details || ''} 
            onChange={(e) => update('coverage_details', e.target.value)}
            placeholder="List covered services, limits, etc."
          />
        </div>

        <div>
          <label className="label">Policy Document Upload *</label>
          <input
            type="file"
            className="input"
            onChange={(e) => setPolicyFile(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,image/*"
            required={!form.attachment_url}
          />
          {form.attachment_url && (
            <a
              href={form.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand hover:underline inline-block mt-2"
            >
              View current uploaded file
            </a>
          )}
          {policyFile && (
            <p className="text-xs text-slate-500 mt-1">
              Selected: {policyFile.name}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
          <button className="btn-primary" disabled={loading || uploadingFile}>
            {loading || uploadingFile ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}








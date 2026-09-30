/**
 * @fileoverview PolicyForm component.
 * Provides functionality for PolicyForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PolicyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [policyFile, setPolicyFile] = useState(null);
  const [form, setForm] = useState({
    code: "",
    title: "",
    content: "",
    attachment_url: "",
    attachment_name: "",
    is_active: true,
  });

  function getNextPolicyCode(items = []) {
    const maxCode = items.reduce((max, item) => {
      const code = String(item?.code || "");
      if (!/^CP\d{6}$/.test(code)) return max;
      const value = Number(code.slice(2));
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    return `CP${String(maxCode + 1).padStart(6, "0")}`;
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/policies");
        const items = res.data.items || [];
        if (!isEdit) {
          setForm((prev) => ({ ...prev, code: getNextPolicyCode(items) }));
        } else {
          const item = items.find((i) => String(i.id) === String(id));
          if (item) {
            setForm({
              ...item,
              is_active: !!item.is_active,
            });
          }
        }
      } catch {
        toast.error(
          isEdit ? "Failed to load policy" : "Failed to prepare policy code",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function uploadPolicyFileIfNeeded() {
    if (!policyFile) return null;
    const formData = new FormData();
    formData.append("file", policyFile);
    formData.append("folder", "hr_policies");
    setUploadingFile(true);
    try {
      const res = await api.post("/upload", formData);
      return {
        url: res?.data?.url || "",
        name: res?.data?.filename || policyFile.name || "",
      };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "File upload failed (may be too large)";
      toast.error(msg);
      throw err;
    } finally {
      setUploadingFile(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      const uploaded = await uploadPolicyFileIfNeeded();
      if (uploaded?.url) {
        payload.attachment_url = uploaded.url;
        payload.attachment_name = uploaded.name;
      }
      if (!payload.attachment_url) {
        toast.error("Policy file upload is required");
        setLoading(false);
        return;
      }
      await api.post("/hr/policies", payload);
      toast.success(isEdit ? "Policy updated" : "Policy created");
      navigate("/human-resources/policies");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Policy" : "New Policy"}
          </h1>
          <div className="flex gap-2">
            <Link
              to="/human-resources/medical-policies/new"
              className="btn-primary"
            >
              Medical Policy Form
            </Link>
            <button onClick={() => window.history.back()} className="btn-secondary">
              Back
            </button>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="hidden" name="code" value={form.code} readOnly />
            <div>
              <label className="label">Title *</label>
              <input
                className="input w-full"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
                placeholder="e.g. Leave Policy"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.is_active ? "1" : "0"}
                onChange={(e) => update("is_active", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Policy Content *</label>
            <textarea
              className="input h-48 w-full font-sans"
              value={form.content || ""}
              onChange={(e) => update("content", e.target.value)}
              required
              placeholder="Enter full policy text here..."
            />
          </div>

          <div>
            <label className="label">Policy File Upload *</label>
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
            <button onClick={() => window.history.back()} className="btn-secondary">
              Cancel
            </button>
            <button className="btn-primary" disabled={loading || uploadingFile}>
              {loading || uploadingFile ? "Saving..." : "Save Policy"}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}

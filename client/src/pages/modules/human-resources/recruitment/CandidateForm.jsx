/**
 * @fileoverview CandidateForm component.
 * Provides functionality for CandidateForm.
 */

import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CandidateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    resume_url: "",
    source: "",
    requisition_id: "",
    status: "NEW",
    position_applied: "",
    recruitment_type: "",
  });
  const [requisitions, setRequisitions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function loadDeps() {
      try {
        const res = await api.get("/hr/requisitions");
        if (mounted) setRequisitions(res?.data?.items || []);
      } catch {}
    }
    loadDeps();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    async function loadItem() {
      if (!id) return;
      try {
        const res = await api.get(`/hr/candidates/${id}`);
        const item = res?.data?.item || {};
        if (mounted) {
          setForm({
            id: item.id,
            first_name: item.first_name || "",
            last_name: item.last_name || "",
            email: item.email || "",
            phone: item.phone || "",
            resume_url: item.resume_url || "",
            source: item.source || "",
            requisition_id: item.requisition_id || "",
            status: item.status || "NEW",
            position_applied: item.pos_name || "",
            recruitment_type: item.recruitment_type || "",
          });
        }
      } catch {}
    }
    loadItem();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onRequisitionChange = async (reqId) => {
    if (!reqId) {
      setForm(s => ({ ...s, requisition_id: "", position_applied: "", recruitment_type: "" }));
      return;
    }
    try {
      const res = await api.get(`/hr/requisitions/${reqId}`);
      const req = res?.data?.item || {};
      setForm(s => ({
        ...s,
        requisition_id: reqId,
        position_applied: req.pos_name || "",
        recruitment_type: req.recruitment_type || "",
      }));
    } catch {
      setForm(s => ({ ...s, requisition_id: reqId }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "hr_resumes");
    
    setUploading(true);
    try {
      const res = await api.post("/upload", formData);
      setForm(s => ({ ...s, resume_url: res.data.url }));
      toast.success("Resume uploaded successfully");
    } catch (err) {
      toast.error("Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/candidates", { ...form });
      toast.success(form.id ? "Updated" : "Created");
      navigate("/human-resources/candidates");
    } catch {
      toast.error("Failed to save candidate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back
          </button>
          <h2 className="text-lg font-semibold">
            {id ? "Edit Candidate" : "New Candidate"}
          </h2>
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name *</label>
            <input
              className="input"
              value={form.first_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, first_name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name *</label>
            <input
              className="input"
              value={form.last_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, last_name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) =>
                setForm((s) => ({ ...s, email: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) =>
                setForm((s) => ({ ...s, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job Requisition</label>
            <select
              className="input"
              value={form.requisition_id}
              onChange={(e) => onRequisitionChange(e.target.value)}
            >
              <option value="">Select Requisition</option>
              {requisitions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.req_no} - {r.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Position Applied For</label>
            <input
              className="input bg-slate-50 dark:bg-slate-700/50"
              value={form.position_applied}
              readOnly
              placeholder="Select requisition first"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recruitment Type</label>
            <input
              className="input bg-slate-50 dark:bg-slate-700/50"
              value={form.recruitment_type}
              readOnly
              placeholder="Select requisition first"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input
              className="input"
              value={form.source}
              onChange={(e) =>
                setForm((s) => ({ ...s, source: e.target.value }))
              }
              placeholder="e.g. LinkedIn, Referral"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Upload Resume</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                className="input flex-1"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx"
              />
              {uploading && <span className="text-sm text-slate-500">Uploading...</span>}
            </div>
            {form.resume_url && (
              <div className="mt-2 text-sm">
                <a href={form.resume_url} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1">
                  View Uploaded Resume ↗
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm((s) => ({ ...s, status: e.target.value }))
              }
            >
              <option value="NEW">New</option>
              <option value="SCREENING">Screening</option>
              <option value="INTERVIEW">Interviewing</option>
              <option value="OFFER">Offer Sent</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/human-resources/candidates")}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || uploading}>
            {loading ? "Saving..." : "Save Candidate"}
          </button>
        </div>
      </form>
    </div>
  );
}

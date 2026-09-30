/**
 * @fileoverview RequisitionForm component.
 * Provides functionality for RequisitionForm.
 */

import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RequisitionForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    req_no: "",
    title: "",
    dept_id: "",
    pos_id: "",
    vacancies: 1,
    employment_type: "FULL_TIME",
    recruitment_type: "EXTERNAL",
    from_date: "",
    to_date: "",
    reason: "",
    requirements: "",
    status: "DRAFT",
  });
  const [depts, setDepts] = React.useState([]);
  const [positions, setPositions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function loadDeps() {
      try {
        const [d, p] = await Promise.all([
          api.get("/hr/departments").catch(() => ({ data: { items: [] } })),
          api.get("/hr/positions").catch(() => ({ data: { items: [] } })),
        ]);
        if (mounted) {
          setDepts(d?.data?.items || []);
          setPositions(p?.data?.items || []);
        }
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
      if (!id) {
        // Auto-generate Req No for new requisition
        try {
          const res = await api.get("/hr/requisitions/next-req-no");
          if (mounted) {
            setForm(s => ({ ...s, req_no: res?.data?.nextReqNo || "000001" }));
          }
        } catch {
          if (mounted) setForm(s => ({ ...s, req_no: "000001" }));
        }
        return;
      }
      try {
        const res = await api.get(`/hr/requisitions/${id}`);
        const item = res?.data?.item || {};
        if (mounted) {
          setForm({
            req_no: item.req_no || "",
            title: item.title || "",
            dept_id: item.dept_id || "",
            pos_id: item.pos_id || "",
            vacancies: item.vacancies || 1,
            employment_type: item.employment_type || "FULL_TIME",
            recruitment_type: item.recruitment_type || "EXTERNAL",
            from_date: item.from_date ? item.from_date.slice(0, 10) : "",
            to_date: item.to_date ? item.to_date.slice(0, 10) : "",
            reason: item.reason || "",
            requirements: item.requirements || "",
            status: item.status || "DRAFT",
            id: item.id,
          });
        }
      } catch {}
    }
    loadItem();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      await api.post("/hr/requisitions", payload);
      toast.success(form.id ? "Updated" : "Created");
      navigate("/human-resources/requisitions");
    } catch {
      toast.error("Failed to save requisition");
    } finally {
      setLoading(false);
    }
  };

  const showDateRange = ["PART_TIME", "CONTRACT", "INTERN"].includes(form.employment_type);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back
          </button>
          <h2 className="text-lg font-semibold">
            {id ? "Edit Requisition" : "New Requisition"}
          </h2>
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Req No</label>
            <input
              className="input bg-slate-50 dark:bg-slate-700/50 font-mono"
              value={form.req_no}
              readOnly
              placeholder="Auto-generated"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) =>
                setForm((s) => ({ ...s, title: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select
              className="input"
              value={form.dept_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, dept_id: e.target.value }))
              }
              required
            >
              <option value="">Select Department</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dept_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Position</label>
            <select
              className="input"
              value={form.pos_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, pos_id: e.target.value }))
              }
              required
            >
              <option value="">Select Position</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pos_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vacancies</label>
            <input
              type="number"
              className="input"
              value={form.vacancies}
              onChange={(e) =>
                setForm((s) => ({ ...s, vacancies: Number(e.target.value) }))
              }
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employment Type</label>
            <select
              className="input"
              value={form.employment_type}
              onChange={(e) =>
                setForm((s) => ({ ...s, employment_type: e.target.value }))
              }
            >
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recruitment Type</label>
            <select
              className="input"
              value={form.recruitment_type}
              onChange={(e) =>
                setForm((s) => ({ ...s, recruitment_type: e.target.value }))
              }
            >
              <option value="INTERNAL">Internal Recruitment</option>
              <option value="EXTERNAL">External Recruitment</option>
            </select>
          </div>
          {showDateRange && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">From Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.from_date}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, from_date: e.target.value }))
                  }
                  required
                
                  disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.to_date}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, to_date: e.target.value }))
                  }
                  required
                
                  disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              className="input"
              rows={4}
              value={form.reason}
              onChange={(e) =>
                setForm((s) => ({ ...s, reason: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requirements</label>
            <textarea
              className="input"
              rows={4}
              value={form.requirements}
              onChange={(e) =>
                setForm((s) => ({ ...s, requirements: e.target.value }))
              }
            />
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
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/human-resources/requisitions")}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save Requisition"}
          </button>
        </div>
      </form>
    </div>
  );
}

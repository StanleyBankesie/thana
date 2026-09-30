/**
 * @fileoverview InterviewForm component.
 * Provides functionality for InterviewForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function InterviewForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    requisition_id: "",
    candidate_id: "",
    interviewer_user_id: "",
    scheduled_at: "",
    status: "SCHEDULED",
    feedback: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [reqRes, candRes, userRes] = await Promise.all([
          api.get("/hr/requisitions").catch(() => ({ data: { items: [] } })),
          api.get("/hr/candidates").catch(() => ({ data: { items: [] } })),
          api.get("/admin/users").catch(() => ({ data: { items: [] } })),
        ]);
        setRequisitions(reqRes?.data?.items || []);
        setCandidates(candRes?.data?.items || []);
        setUsers(userRes?.data?.items || []);
      } catch {}
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/interviews/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : "",
        });
      } catch {
        toast.error("Failed to fetch interview details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/interviews", form);
      toast.success("Interview saved successfully");
      navigate("/human-resources/interviews");
    } catch {
      toast.error("Failed to save interview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back
        </button>
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Interview" : "Schedule Interview"}</h2>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Job Requisition *</label>
            <select
              className="input"
              value={form.requisition_id}
              onChange={(e) => setForm({ ...form, requisition_id: e.target.value })}
              required
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
            <label className="label">Candidate *</label>
            <select
              className="input"
              value={form.candidate_id}
              onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
              required
            >
              <option value="">Select Candidate</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Interviewer</label>
            <select
              className="input"
              value={form.interviewer_user_id}
              onChange={(e) => setForm({ ...form, interviewer_user_id: e.target.value })}
            >
              <option value="">Select Interviewer</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Scheduled At *</label>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Feedback / Notes</label>
            <textarea
              className="input"
              rows={3}
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={() => navigate("/human-resources/interviews")}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save Interview"}
          </button>
        </div>
      </form>
    </div>
  );
}

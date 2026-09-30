/**
 * @fileoverview OfferForm component.
 * Provides functionality for OfferForm.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function OfferForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allAllowances, setAllAllowances] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [form, setForm] = useState({
    offer_no: "",
    offer_date: new Date().toISOString().split("T")[0],
    requisition_id: "",
    candidate_id: "",
    position_id: "",
    gross_salary: 0,
    status: "DRAFT",
    remarks: "",
    selected_allowances: [],
    selected_taxes: [],
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [reqRes, candRes, posRes, allowRes, taxRes] = await Promise.all([
          api.get("/hr/requisitions").catch(() => ({ data: { items: [] } })),
          api.get("/hr/candidates").catch(() => ({ data: { items: [] } })),
          api.get("/hr/positions").catch(() => ({ data: { items: [] } })),
          api.get("/hr/allowances").catch(() => ({ data: { items: [] } })),
          api.get("/hr/tax-configs").catch(() => ({ data: { items: [] } })),
        ]);
        setRequisitions(reqRes?.data?.items || []);
        setCandidates(candRes?.data?.items || []);
        setPositions(posRes?.data?.items || []);
        setAllAllowances(allowRes?.data?.items || []);
        setAllTaxes(taxRes?.data?.items || []);
      } catch {}
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setForm(s => ({ ...s, offer_no: "OFF-" + Date.now().toString().slice(-6) }));
      return;
    }
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/offers/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          offer_date: item.offer_date ? item.offer_date.slice(0, 10) : "",
          selected_allowances: item.selected_allowances || [],
          selected_taxes: item.selected_taxes || [],
        });
      } catch {
        toast.error("Failed to fetch offer details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  const onCandidateChange = (candId) => {
    const cand = candidates.find(c => String(c.id) === String(candId));
    if (cand) {
      // Find requisition to get position if not directly on candidate
      const req = requisitions.find(r => String(r.id) === String(cand.requisition_id));
      setForm(s => ({
        ...s,
        candidate_id: candId,
        requisition_id: cand.requisition_id || "",
        position_id: cand.position_id || req?.pos_id || "",
      }));
    } else {
      setForm(s => ({ ...s, candidate_id: candId }));
    }
  };

  const netSalary = useMemo(() => {
    const gross = Number(form.gross_salary || 0);
    let totalAllow = 0;
    let totalDed = 0;

    form.selected_allowances.forEach(id => {
      const a = allAllowances.find(al => String(al.id) === String(id));
      if (a) {
        if (a.amount_type === 'FIXED') totalAllow += Number(a.amount);
        else totalAllow += gross * (Number(a.amount) / 100);
      }
    });

    form.selected_taxes.forEach(id => {
      const t = allTaxes.find(tx => String(tx.id) === String(id));
      if (t) {
        if (t.tax_type === 'INCOME_TAX') {
          totalDed += (gross + totalAllow) * (Number(t.tax_rate) / 100) + Number(t.fixed_amount);
        } else {
          totalDed += gross * (Number(t.employee_contribution_rate) / 100);
        }
      }
    });

    return gross + totalAllow - totalDed;
  }, [form.gross_salary, form.selected_allowances, form.selected_taxes, allAllowances, allTaxes]);

  const toggleItem = (listName, id) => {
    setForm(s => {
      const current = s[listName] || [];
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...s, [listName]: next };
    });
  };

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/offers", { ...form, net_salary: netSalary });
      toast.success("Offer saved successfully");
      navigate("/human-resources/offers");
    } catch {
      toast.error("Failed to save offer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Offer" : "New Job Offer"}</h1>
        <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label font-semibold">Candidate *</label>
              <select className="input" value={form.candidate_id} onChange={e => onCandidateChange(e.target.value)} required>
                <option value="">Select Candidate</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label font-semibold">Job Requisition</label>
              <select className="input bg-slate-50" value={form.requisition_id} disabled>
                <option value="">Linked from Candidate</option>
                {requisitions.map(r => <option key={r.id} value={r.id}>{r.req_no} - {r.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label font-semibold">Position</label>
              <select className="input bg-slate-50" value={form.position_id} disabled>
                <option value="">Auto-populated</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.pos_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label font-semibold">Offer Date *</label>
              <input type="date" className="input" value={form.offer_date} onChange={e => setForm({...form, offer_date: e.target.value})} required 
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label font-semibold">Gross Salary *</label>
              <input type="number" className="input font-mono" value={form.gross_salary} onChange={e => setForm({...form, gross_salary: e.target.value})} required />
            </div>
            <div>
              <label className="label font-semibold">Remark</label>
              <input className="input" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Internal notes..." />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold border-b pb-2 mb-4 flex justify-between">
              Allowances
              <span className="text-[10px] text-brand uppercase tracking-widest">Included in Offer</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {allAllowances.map(a => (
                <label key={a.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-transparent hover:border-slate-200 transition-all cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={form.selected_allowances.includes(a.id)} onChange={() => toggleItem('selected_allowances', a.id)} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{a.allowance_name}</div>
                    <div className="text-xs text-slate-500">{a.amount_type === 'FIXED' ? 'GHS' : ''}{a.amount}{a.amount_type === 'PERCENTAGE' ? '%' : ''}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold border-b pb-2 mb-4 flex justify-between">
              Statutory Contributions
              <span className="text-[10px] text-red-500 uppercase tracking-widest">Deductions</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {allTaxes.map(t => (
                <label key={t.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-transparent hover:border-slate-200 transition-all cursor-pointer">
                  <input type="checkbox" className="checkbox" checked={form.selected_taxes.includes(t.id)} onChange={() => toggleItem('selected_taxes', t.id)} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t.tax_name}</div>
                    <div className="text-xs text-slate-500">{t.tax_type} - {t.tax_rate}%</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-brand/5 border border-brand/20 p-6 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="text-sm text-slate-500 font-medium">Estimated Monthly Net Salary</div>
            <div className="text-3xl font-bold text-brand font-mono">GHS {Number(netSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary px-8" onClick={() => navigate("/human-resources/offers")}>Cancel</button>
            <button type="submit" className="btn-primary px-12" disabled={loading}>
              {loading ? "Saving..." : "Create Offer"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

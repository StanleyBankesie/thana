/**
 * @fileoverview PayslipForm component.
 * Provides functionality for PayslipForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PayslipForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    period: "",
    employee: "",
    netPay: 0,
    status: "GENERATED",
  });
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({
        period: "2025-01",
        employee: "John Doe",
        netPay: 2500,
        status: "GENERATED",
      });
      setLoading(false);
    }, 150);
  }, [isEdit]);

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: String(item.name || ""),
          address: String(item.address || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const sampleData = useMemo(() => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${String(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    return {
      company: {
        name: companyInfo.name || "OmniSuite Ltd",
        address: companyInfo.address || "123 Business Rd",
        logoUrl,
        logoHtml,
      },
      payslip: {
        period: String(form.period || ""),
        employee: String(form.employee || ""),
        netPay: Number(form.netPay || 0).toFixed(2),
        status: String(form.status || ""),
      },
    };
  }, [form, companyInfo]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate("/human-resources/payslips");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit ? "Edit Payslip" : "New Payslip"}
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn-success">
              Back
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Period *</label>
                <input
                  className="input"
                  value={form.period}
                  onChange={(e) => update("period", e.target.value)}
                  required
                  placeholder="YYYY-MM"
                />
              </div>
              <div>
                <label className="label">Employee *</label>
                <input
                  className="input"
                  value={form.employee}
                  onChange={(e) => update("employee", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Net Pay</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.netPay}
                  onChange={(e) => update("netPay", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="GENERATED">Generated</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => window.history.back()} className="btn-success">
                Cancel
              </button>
              <button className="btn-success" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

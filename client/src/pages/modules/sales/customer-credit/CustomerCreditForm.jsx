/**
 * @fileoverview CustomerCreditForm component.
 * Provides functionality for CustomerCreditForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerCreditForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer: "",
    creditLimit: 0,
    currency: "GHS",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchCustomerCredit();
  }, [id]);

  async function fetchCustomerCredit() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/sales/customer-credit/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error fetching customer credit"
      );
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isEdit) {
        await api.put(`/sales/customer-credit/${id}`, form);
      } else {
        await api.post("/sales/customer-credit", form);
      }
      navigate("/sales/customer-credit");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving customer credit");
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
              {isEdit ? "Edit Credit Limit" : "New Credit Limit"}
            </h1>
          </div>
          <button onClick={() => window.history.back()} className="btn-success">
            Back
          </button>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Customer *</label>
                <input
                  className="input"
                  value={form.customer}
                  onChange={(e) => update("customer", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Credit Limit</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) =>
                    update("creditLimit", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <input
                  className="input"
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value)}
                />
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








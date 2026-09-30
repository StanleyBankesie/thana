/**
 * @fileoverview TransferAcceptanceForm component.
 * Provides functionality for TransferAcceptanceForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TransferAcceptanceForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [transfer, setTransfer] = useState(null);
  const [details, setDetails] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/transfer-acceptance/${id}`)
      .then((res) => {
        if (!mounted) return;
        setTransfer(res.data?.item || null);
        const fetchedDetails = Array.isArray(res.data?.details)
          ? res.data.details
          : [];

        setDetails(
          fetchedDetails.map((d) => {
            const transferable = Number(d.remaining_qty ?? d.qty);
            return {
              ...d,
              received_qty: transferable,
              rejected_now: 0,
              variance: 0,
              remarks: "",
            };
          }),
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load transfer");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleReceivedQtyChange = (detailId, value) => {
    const received = parseFloat(value);
    setDetails((prev) =>
      prev.map((d) => {
        if (d.id === detailId) {
          const transferable = Number(d.remaining_qty ?? d.qty);
          const rejected = Math.max(0, transferable - received);
          return {
            ...d,
            received_qty: received,
            rejected_now: rejected,
            variance: 0,
          };
        }
        return d;
      }),
    );
  };

  const handleRejectedQtyChange = (detailId, value) => {
    const rejected = parseFloat(value);
    setDetails((prev) =>
      prev.map((d) => {
        if (d.id === detailId) {
          const transferable = Number(d.remaining_qty ?? d.qty);
          const received = Math.max(0, transferable - rejected);
          return {
            ...d,
            rejected_now: rejected,
            received_qty: received,
            variance: 0,
          };
        }
        return d;
      }),
    );
  };

  const handleRemarksChange = (detailId, value) => {
    setDetails((prev) =>
      prev.map((d) => (d.id === detailId ? { ...d, remarks: value } : d)),
    );
  };

  const confirmTransfer = async () => {
    setSaving(true);
    setError("");

    try {
      const payload = {
        details: details.map((d) => {
          const accepted = Math.max(0, Number(d.received_qty || 0));
          const rejected = Math.max(0, Number(d.rejected_now || 0));

          return {
            id: d.id,
            item_id: d.item_id,
            qty: Number(d.qty),
            received_qty: Number(d.qty),
            accepted_qty: accepted,
            rejected_qty: rejected,
            acceptance_remarks: d.remarks,
          };
        }),
      };

      await api.put(`/inventory/transfer-acceptance/${id}`, payload);
      toast.success("Transfer confirmed successfully!");
      navigate("/inventory/transfer-acceptance");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to confirm transfer");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      DRAFT: "badge-info",
      IN_TRANSIT: "badge-warning",
      "IN TRANSIT": "badge-warning",
      PARTIALLY_RECEIVED: "badge-warning",
      TRANSFERRED: "badge-success",
      RECEIVED: "badge-success",
      CANCELLED: "badge-error",
    };
    return map[status] || "badge-info";
  };

  const isConfirmed = transfer?.status === "TRANSFERRED" || transfer?.status === "RECEIVED";

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Transfer Acceptance
              </h1>
              <p className="text-sm mt-1">
                Review items and confirm inbound transfer
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success">
              Back to List
            </button>
          </div>
        </div>

        <div className="card-body space-y-6">
          {loading ? <div className="text-sm">Loading...</div> : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {transfer ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Transfer No</div>
                <div className="font-semibold">{transfer.transfer_no}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Date</div>
                <div className="font-semibold">
                  {transfer.transfer_date
                    ? String(transfer.transfer_date).slice(0, 10)
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">From Warehouse</div>
                <div className="font-semibold">
                  {transfer.from_warehouse_name ||
                    transfer.from_warehouse_id ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">To Warehouse</div>
                <div className="font-semibold">
                  {transfer.to_warehouse_name ||
                    transfer.to_warehouse_id ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div>
                  <span className={`badge ${getStatusBadge(transfer.status)}`}>
                    {transfer.status}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">
                Items Verification
              </h2>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th className="w-24">Transferred</th>
                      <th className="w-24">Remaining</th>
                      <th className="w-28">Receive Now</th>
                      <th className="w-28">Reject Now</th>
                      <th className="w-24">Variance</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!details.length ? (
                      <tr>
                        <td
                          colSpan="8"
                          className="text-center py-6 text-slate-500 dark:text-slate-400"
                        >
                          No items
                        </td>
                      </tr>
                    ) : null}
                    {details.map((d) => (
                      <tr key={d.id}>
                        <td className="font-medium text-brand-700 dark:text-brand-300">
                          {d.item_code}
                        </td>
                        <td>{d.item_name}</td>
                        <td>{d.qty}</td>
                        <td>{Number(d.remaining_qty ?? d.qty)}</td>
                        <td>
                          <input
                            type="number"
                            className="input h-8"
                            value={d.received_qty}
                            onChange={(e) =>
                              handleReceivedQtyChange(d.id, e.target.value)
                            }
                            min=""
                            step="1"
                            max={Number(d.remaining_qty ?? d.qty)}
                            disabled={isConfirmed}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input h-8"
                            value={d.rejected_now}
                            onChange={(e) =>
                              handleRejectedQtyChange(d.id, e.target.value)
                            }
                            min=""
                            step="1"
                            max={Number(d.remaining_qty ?? d.qty)}
                            disabled={isConfirmed}
                          />
                        </td>
                        <td>
                          <span
                            className={`font-semibold ${
                              d.variance < 0
                                ? "text-red-600"
                                : d.variance > 0
                                  ? "text-blue-600"
                                  : "text-green-600"
                            }`}
                          >
                            {d.variance > 0 ? "+" : ""}
                            {d.variance}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input h-8"
                            value={d.remarks}
                            onChange={(e) =>
                              handleRemarksChange(d.id, e.target.value)
                            }
                            placeholder="Variance reason..."
                            disabled={isConfirmed}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Link to="/inventory/transfer-acceptance" className="btn-success">
              Close
            </Link>
            {!isConfirmed ? (
              <button
                type="button"
                className="btn-success"
                onClick={confirmTransfer}
                disabled={saving || !transfer}
              >
                {saving ? "Confirming..." : "Confirm Transfer"}
              </button>
            ) : (
              <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                ✓ Transfer Confirmed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

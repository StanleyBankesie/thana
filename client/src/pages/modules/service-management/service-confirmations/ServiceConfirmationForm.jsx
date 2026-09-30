import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { Trash2 } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function parseLegacyRemarks(remarks) {
  const text = String(remarks || "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const followUpLine = lines.find((line) =>
    line.toLowerCase().startsWith("follow-up:"),
  );

  return {
    warrantyProvided: lines.some(
      (line) => line.toLowerCase() === "warranty provided",
    ),
    followUpRequired: !!followUpLine,
    followUpNotes: followUpLine
      ? followUpLine.replace(/^follow-up:\s*/i, "")
      : "",
  };
}

export default function ServiceConfirmationForm() {
  const { hasExceptional } = usePermission();
  const { id: routeId } = useParams();
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const queryConfirmationId = searchParams.get("confirmation_id") || "";
  const confirmationId = (routeId && routeId !== "new") ? routeId : queryConfirmationId;
  const isNew = !confirmationId;
  const mode = searchParams.get("mode") || (isNew ? "edit" : "view");
  const preselectedOrderId = searchParams.get("order_id") || "";
  const preselectedExecutionId = searchParams.get("execution_id") || "";

  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState("");
  const selectedExecution = useMemo(
    () => executions.find((x) => String(x.id) === String(selectedExecutionId)),
    [executions, selectedExecutionId],
  );

  const [formData, setFormData] = useState({
    sc_no: "",
    sc_date: toISODate(new Date()),
    supplier_id: "",
    order_id: "",
    order_no: "",
    status: "DRAFT",
    remarks: "",
    details: [],
  });
  const [appointmentTime, setAppointmentTime] = useState("");
  const [depositPercent, setDepositPercent] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [accept1, setAccept1] = useState(false);
  const [accept2, setAccept2] = useState(false);
  const [accept3, setAccept3] = useState(false);
  const [accept4, setAccept4] = useState(false);
  const [accept5, setAccept5] = useState(false);
  const [satisfaction, setSatisfaction] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [warrantyProvided, setWarrantyProvided] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [orderLines, setOrderLines] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [workLocation, setWorkLocation] = useState("");
  const [serviceItemsCatalog, setServiceItemsCatalog] = useState([]);

  const readyToConfirm = useMemo(() => {
    const checksOk = accept1 && accept2 && accept3 && accept4 && accept5;
    const hasSatisfaction = !!satisfaction;
    const hasExec = !!selectedExecutionId;
    const hasSupplier = !!formData.supplier_id;
    const hasDate = !!formData.sc_date;
    return (
      checksOk &&
      hasSatisfaction &&
      hasExec &&
      hasSupplier &&
      hasDate
    );
  }, [
    accept1,
    accept2,
    accept3,
    accept4,
    accept5,
    satisfaction,
    selectedExecutionId,
    formData.supplier_id,
    formData.sc_date,
  ]);

  useEffect(() => {
    let mounted = true;
    api
      .get("/purchase/suppliers", { params: { contractor: "Y" } })
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const filtered = rows.filter(
          (s) => String(s.service_contractor || "").toUpperCase() === "Y",
        );
        setSuppliers(filtered);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
      });

    api
      .get("/purchase/service-orders", { params: { type: "EXTERNAL" } })
      .then((res) => {
        if (!mounted) return;
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = arr.map((x) => ({
          id: x.id,
          order_no: x.order_no,
          status: x.status || "",
          assigned_supervisor_username: x.assigned_supervisor_username || "",
          order_date: x.order_date || "",
        }));
        setExecutions(mapped);
      })
      .catch(() => {
        if (!mounted) return;
        setExecutions([]);
      });

    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const filtered = rows.filter((i) => {
          const t = String(i.item_type || "").toUpperCase();
          const tn = String(i.item_type_name || "").toLowerCase();
          const si = String(i.service_item || "").toUpperCase();
          return (
            t === "SERVICE" ||
            tn.includes("service") ||
            si === "Y" ||
            Number(i.service_item) === 1
          );
        });
        setServiceItemsCatalog(filtered);
      })
      .catch(() => {
        if (!mounted) return;
        setServiceItemsCatalog([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (preselectedOrderId && !selectedExecutionId) {
      setSelectedExecutionId(preselectedOrderId);
    } else if (preselectedExecutionId && !selectedExecutionId) {
      api
        .get(`/purchase/service-executions/${preselectedExecutionId}`)
        .then((res) => {
          const ex = res.data?.item || res.data || {};
          if (ex.order_id) {
            setSelectedExecutionId(String(ex.order_id));
          }
        })
        .catch(() => {});
    }
  }, [preselectedOrderId, preselectedExecutionId]);

  useEffect(() => {
    if (!selectedExecutionId) {
      if (isNew) {
        setOrderLines([]);
        setCheckedItems({});
      }
      setWorkLocation("");
      return;
    }
    let mounted = true;
    api
      .get(`/purchase/service-orders/${selectedExecutionId}`)
      .then((res) => {
        if (!mounted) return;
        const order = res.data?.item || {};
        const lines = Array.isArray(res.data?.lines) ? res.data.lines : [];
        setWorkLocation(order.work_location || "");
        if (isNew) {
          setOrderLines(lines);
          setCheckedItems((prev) => {
            const next = {};
            for (const ln of lines) {
              next[ln.line_no || ln.description] =
                prev[ln.line_no || ln.description] || false;
            }
            return next;
          });
        }
        if (order.supplier_id) {
          setFormData((prev) =>
            prev.supplier_id
              ? prev
              : {
                  ...prev,
                  supplier_id: String(order.supplier_id),
                  order_id: String(order.id),
                  order_no: order.order_no || "",
                },
          );
        } else if (order.contractor_name) {
          const matched = suppliers.find(
            (s) =>
              String(s.supplier_name || "").toLowerCase() ===
              String(order.contractor_name).toLowerCase(),
          );
          if (matched) {
            setFormData((prev) =>
              prev.supplier_id
                ? prev
                : {
                    ...prev,
                    supplier_id: String(matched.id),
                    order_id: String(order.id),
                    order_no: order.order_no || "",
                  },
            );
          }
        }
      })
      .catch(() => {
        if (!mounted) return;
        if (isNew) {
          setOrderLines([]);
          setCheckedItems({});
        }
      });
    return () => {
      mounted = false;
    };
  }, [isNew, selectedExecutionId, suppliers]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/service-confirmations/${confirmationId}`)
      .then((res) => {
        if (!mounted) return;
        const c = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!c) return;
        const legacyRemarks = parseLegacyRemarks(c.remarks);
        const normalizedDetails = details.map((d) => ({
          item_id: d.item_id || "",
          description: d.description || "",
          qty: d.qty ?? "",
          unit_price: d.unit_price ?? "",
          line_total:
            d.line_total ?? Number(d.qty || 0) * Number(d.unit_price || 0),
          is_confirmed: !!d.is_confirmed,
        }));

        setFormData({
          sc_no: c.sc_no || "",
          sc_date: toISODate(c.sc_date),
          supplier_id: c.supplier_id ? String(c.supplier_id) : "",
          order_id: c.order_id ? String(c.order_id) : "",
          order_no: c.order_no || "",
          status: c.status || "DRAFT",
          remarks: c.remarks || "",
          details: normalizedDetails,
        });
        setSelectedExecutionId(c.order_id ? String(c.order_id) : "");
        setAppointmentTime(
          c.service_time ? String(c.service_time).slice(0, 5) : "",
        );
        setAccept1(!!Number(c.acceptance_1));
        setAccept2(!!Number(c.acceptance_2));
        setAccept3(!!Number(c.acceptance_3));
        setAccept4(!!Number(c.acceptance_4));
        setAccept5(!!Number(c.acceptance_5));
        setSatisfaction(
          c.satisfaction == null || c.satisfaction === ""
            ? ""
            : String(c.satisfaction),
        );
        setCustomerFeedback(c.customer_feedback || "");
        setWarrantyProvided(
          c.warranty_provided == null
            ? legacyRemarks.warrantyProvided
            : !!Number(c.warranty_provided),
        );
        setFollowUpRequired(
          c.follow_up_required == null
            ? legacyRemarks.followUpRequired
            : !!Number(c.follow_up_required),
        );
        setFollowUpNotes(c.follow_up_notes || legacyRemarks.followUpNotes);
        setOrderLines(
          normalizedDetails.map((d, idx) => ({
            line_no: idx + 1,
            item_id: d.item_id || "",
            description: d.description,
            item_name: d.description,
            qty: d.qty,
            unit_price: d.unit_price,
            line_total: d.line_total,
          })),
        );
        setCheckedItems(
          normalizedDetails.reduce((acc, d, idx) => {
            acc[d.description || idx] = !!d.is_confirmed;
            return acc;
          }, {}),
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load service confirmation",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [confirmationId, isNew]);

  const servicesCatalog = useMemo(
    () => [
      { key: "diagnosis", name: "Diagnosis", icon: "🔎", price: 50 },
      { key: "repair", name: "Repair", icon: "🛠️", price: 150 },
      { key: "maintenance", name: "Maintenance", icon: "🔧", price: 100 },
      { key: "installation", name: "Installation", icon: "⚙️", price: 200 },
      { key: "consultation", name: "Consultation", icon: "💬", price: 75 },
      { key: "upgrade", name: "Upgrade", icon: "⬆️", price: 220 },
    ],
    [],
  );

  const computedTotal = useMemo(() => {
    const lines = orderLines.length > 0 ? orderLines : formData.details || [];
    let total = 0;
    for (const d of lines) {
      const qty = Number(d.qty);
      const unitPrice = Number(d.unit_price ?? d.unitPrice);
      const lineTotal = Number(d.line_total);
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
      total += Number.isFinite(lineTotal) ? lineTotal : qty * unitPrice;
    }
    return total;
  }, [formData.details, orderLines]);

  const tax = useMemo(() => computedTotal * 0.125, [computedTotal]);
  const grandTotal = useMemo(() => computedTotal + tax, [computedTotal, tax]);
  const depositAmount = useMemo(
    () => grandTotal * (Number(depositPercent) / 100),
    [grandTotal, depositPercent],
  );

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    alert("Downloading confirmation PDF (demo)");
  }
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard");
    } catch {
      alert("Unable to copy link");
    }
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, { description: "", qty: "", unit_price: "" }],
    }));
  };

  const removeLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, patch) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };

  function addServiceItem() {
    setOrderLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), item_id: "", description: "", qty: 1, unit_price: 0, line_total: 0 },
    ]);
  }
  function updateServiceItem(id, key, value) {
    setOrderLines((prev) =>
      prev.map((it) => {
        if ((it.id || it.line_no) !== id) return it;
        const next = { ...it, [key]: value };
        if (key === "item_id") {
          const selected = serviceItemsCatalog.find((s) => String(s.id) === String(value)) || null;
          if (selected) {
            next.description = selected.item_name || "";
            next.item_name = selected.item_name || "";
            const sp = Number(selected.selling_price || 0);
            if (Number.isFinite(sp)) next.unit_price = sp;
          }
        }
        const qty = parseFloat(next.qty || 0);
        const price = parseFloat(next.unit_price || 0);
        next.line_total = qty * price;
        return next;
      }),
    );
  }
  function removeServiceItem(id) {
    setOrderLines((prev) => prev.filter((it) => (it.id || it.line_no) !== id));
  }

  const toggleService = (svc) => {
    const existsIdx = formData.details.findIndex(
      (d) => String(d.description || "").trim() === svc.name,
    );
    if (existsIdx >= 0) {
      removeLine(existsIdx);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      details: [
        ...prev.details,
        { description: svc.name, qty: 1, unit_price: svc.price },
      ],
    }));
  };

  const isServiceSelected = (svc) => {
    return formData.details.some(
      (d) => String(d.description || "").trim() === svc.name,
    );
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!selectedExecutionId) {
        throw new Error("Select completed external service order");
      }
      if (!(accept1 && accept2 && accept3 && accept4 && accept5)) {
        throw new Error("Check all acceptance items");
      }
      if (!satisfaction) {
        throw new Error("Select satisfaction rating");
      }
      const payload = {
        sc_no:
          formData.sc_no ||
          `SC-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        service_time: appointmentTime || null,
        status: "CONFIRMED",
        remarks: formData.remarks || null,
        details: confirmationDetails.map((d) => ({
          item_id: d.item_id || null,
          description: d.description,
          qty: d.qty,
          unit_price: d.unit_price,
          line_total: d.line_total,
          is_confirmed: d.is_confirmed,
        })),
        acceptance_1: accept1,
        acceptance_2: accept2,
        acceptance_3: accept3,
        acceptance_4: accept4,
        acceptance_5: accept5,
        satisfaction: Number(satisfaction),
        customer_feedback: customerFeedback || null,
        warranty_provided: warrantyProvided,
        follow_up_required: followUpRequired,
        follow_up_notes: followUpNotes || null,
        order_id: selectedExecutionId ? Number(selectedExecutionId) : null,
        order_no: formData.order_no || null,
        execution_id: preselectedExecutionId
          ? Number(preselectedExecutionId)
          : null,
      };

      if (!payload.sc_date || !payload.supplier_id) {
        throw new Error("Date and supplier are required");
      }

      if (isNew) {
        await api.post("/purchase/service-confirmations", payload);
      } else {
        await api.put(
          `/purchase/service-confirmations/${confirmationId}`,
          payload,
        );
      }

      navigate(backPath);
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to save service confirmation",
      );
    } finally {
      setSaving(false);
    }
  };

  const supplierName = useMemo(() => {
    const sid = formData.supplier_id ? Number(formData.supplier_id) : null;
    if (!sid) return "";
    const s = suppliers.find((x) => Number(x.id) === sid);
    return s ? s.supplier_name || "" : "";
  }, [formData.supplier_id, suppliers]);

  const confirmationDetails = useMemo(() => {
    if (orderLines.length > 0) {
      return orderLines.map((ln, idx) => {
        const key = ln.id || ln.line_no || ln.description || idx;
        const qty = Number(ln.qty || 0);
        const unitPrice = Number(ln.unit_price || 0);
        const lineTotal = Number(ln.line_total);
        return {
          item_id: ln.item_id || null,
          description: String(ln.description || ln.item_name || "").trim(),
          qty,
          unit_price: unitPrice,
          line_total: Number.isFinite(lineTotal) ? lineTotal : qty * unitPrice,
          is_confirmed: !!checkedItems[key],
        };
      });
    }

    return (formData.details || []).map((d, idx) => ({
      item_id: d.item_id || null,
      description: String(d.description || "").trim(),
      qty: Number(d.qty || 0),
      unit_price: Number(d.unit_price || 0),
      line_total: Number.isFinite(Number(d.line_total))
        ? Number(d.line_total)
        : Number(d.qty || 0) * Number(d.unit_price || 0),
      is_confirmed: !!d.is_confirmed || !!checkedItems[d.description || idx],
    }));
  }, [checkedItems, formData.details, orderLines]);

  const resetForm = () => {
    setFormData({
      sc_no: "",
      sc_date: toISODate(new Date()),
      supplier_id: "",
      status: "DRAFT",
      remarks: "",
      details: [],
    });
    setAppointmentTime("");
    setDepositPercent(0);
  };

  const isViewMode = mode === "view";
  const readonlyClass = isViewMode
    ? "input bg-sky-50 border-sky-200 text-slate-700 cursor-not-allowed disabled:bg-sky-50 disabled:border-sky-200 disabled:text-slate-700"
    : "input";
  const readonlySurfaceClass = isViewMode
    ? "bg-sky-50 border-sky-200"
    : "bg-white border-slate-200 hover:border-slate-300";
  const readonlyStaticFieldClass = isViewMode
    ? "input bg-sky-50 border-sky-200 text-slate-700"
    : "input bg-slate-50";
  const backPath = location.pathname.startsWith("/purchase")
    ? "/purchase/service-confirmation"
    : "/service-management/service-confirmation";
  const formEntryPath = `${backPath}/new`;

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 45px)" }}>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <Link
                    to={backPath}
                    className="px-3 py-1 rounded bg-white text-brand hover:bg-slate-100"
                  >
                    ← Back
                  </Link>
                  <h1 className="text-2xl font-bold dark:text-brand-300">
                    {isViewMode
                      ? "View Service Confirmation"
                      : isNew
                        ? "New Service Confirmation"
                        : "Edit Service Confirmation"}
                  </h1>
                  <p className="text-sm mt-1">Confirm service receipts</p>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {now.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-sm font-semibold">
                    {now.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <div className="card">
                    <div className="card-body space-y-4">
                      <div className="text-lg font-semibold">
                        Service Order Reference
                      </div>
                      <div>
                        <label className="label">
                          Completed Service Order *
                        </label>
                        <select
                          className={readonlyClass}
                          value={selectedExecutionId}
                          onChange={(e) =>
                            !isViewMode &&
                            setSelectedExecutionId(e.target.value)
                          }
                          disabled={isViewMode}
                          required
                        >
                          <option value="">
                            Select external service order...
                          </option>
                          {executions.map((ex) => (
                            <option key={ex.id} value={String(ex.id)}>
                              {ex.order_no || ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedExecution ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded p-3">
                          <div>
                            <div className="text-xs text-slate-500">Order</div>
                            <div className="font-semibold">
                              {selectedExecution.order_no || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Status</div>
                            <div className="font-semibold">
                              {selectedExecution.status || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">
                              Supervisor
                            </div>
                            <div className="font-semibold">
                              {selectedExecution.assigned_supervisor_username ||
                                "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Date</div>
                            <div className="font-semibold">
                              {selectedExecution.order_date || "-"}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="card md:col-span-3 mb-4">
                    <div className="card-body">
                      <h4
                        style={{ color: "var(--primary)", marginBottom: 10 }}
                      >
                        📋 Service Items
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 100px 120px 40px",
                          gap: 12,
                          marginBottom: 8,
                          padding: "4px 10px",
                          background: "var(--white)",
                          border: "2px solid var(--border)",
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        <div>Item</div>
                        <div>Qty</div>
                        <div>Rate</div>
                        <div>Amount</div>
                        <div />
                      </div>
                      <div>
                        {orderLines.map((ln) => {
                          const rowKey = ln.id || ln.line_no;
                          return (
                            <div
                              key={rowKey}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "2fr 1fr 100px 120px 40px",
                                gap: 12,
                                marginBottom: 10,
                                padding: 10,
                                background: "var(--white)",
                                border: "2px solid var(--border)",
                                borderRadius: 6,
                              }}
                            >
                              <select
                                className="input"
                                value={ln.item_id || ""}
                                onChange={(e) =>
                                  updateServiceItem(rowKey, "item_id", e.target.value)
                                }
                                disabled={isViewMode}
                              >
                                <option value="">
                                  -- Select Service Item --
                                </option>
                                {serviceItemsCatalog.map((si) => (
                                  <option key={si.id} value={si.id}>
                                    {si.item_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input"
                                type="number"
                                min="1"
                                value={ln.qty}
                                onChange={(e) =>
                                  updateServiceItem(rowKey, "qty", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={ln.unit_price}
                                onChange={(e) =>
                                  updateServiceItem(rowKey, "unit_price", e.target.value)
                                }
                                placeholder="0.00"
                                disabled={isViewMode}
                              />
                              <input
                                className="input"
                                readOnly
                                value={(
                                  parseFloat(ln.qty || 0) *
                                  parseFloat(ln.unit_price || 0)
                                ).toFixed(2)}
                              />
                              {!isViewMode && (
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                  onClick={() => removeServiceItem(rowKey)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {!isViewMode && (
                        <button
                          type="button"
                          className="btn-primary mt-2"
                          onClick={addServiceItem}
                        >
                          + Add Service Item
                        </button>
                      )}
                      <div
                        className="flex justify-between mt-2 pt-2 border-t border-slate-200 text-sm font-semibold"
                      >
                        <span>Total</span>
                        <span>
                          GH₵{" "}
                          {orderLines
                            .reduce(
                              (sum, ln) =>
                                sum +
                                parseFloat(ln.qty || 0) *
                                  parseFloat(ln.unit_price || 0),
                              0,
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Service Items - Confirmation Checklist (commented out)
                  {orderLines.length > 0 && (
                    <div className="card">
                      <div className="card-body space-y-4">
                        <div className="text-lg font-semibold">
                          Service Items - Confirmation Checklist
                        </div>
                        <p className="text-sm text-slate-500">
                          Confirm each service item from the order has been
                          completed
                        </p>
                        <div className="space-y-2">
                          {orderLines.map((ln, idx) => {
                            const key = ln.id || ln.line_no || ln.description || idx;
                            const isChecked = !!checkedItems[key];
                            return (
                              <label
                                key={key}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                  isViewMode
                                    ? "bg-sky-50 border-sky-200 cursor-default"
                                    : isChecked
                                      ? "bg-green-50 border-green-300 cursor-pointer"
                                      : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-5 w-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                  checked={isChecked}
                                  disabled={isViewMode}
                                  onChange={(e) =>
                                    !isViewMode &&
                                    setCheckedItems((prev) => ({
                                      ...prev,
                                      [key]: e.target.checked,
                                    }))
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`text-sm font-medium ${isChecked ? "text-green-700" : "text-slate-700"}`}
                                    >
                                      {ln.description ||
                                        ln.item_name ||
                                        "Service Item"}
                                    </span>
                                    {isChecked && (
                                      <span className="text-green-600 text-xs font-semibold flex-shrink-0">
                                        ✓ Completed
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Qty: {ln.qty || 0}
                                    {ln.unit_price
                                      ? ` • Rate: GH₵ ${Number(ln.unit_price).toFixed(2)}`
                                      : ""}
                                    {ln.line_total
                                      ? ` • Total: GH₵ ${Number(ln.line_total).toFixed(2)}`
                                      : ""}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          <span className="text-sm text-slate-500">
                            {Object.values(checkedItems).filter(Boolean).length}{" "}
                            of {orderLines.length} items confirmed
                          </span>
                          {Object.values(checkedItems).filter(Boolean)
                            .length === orderLines.length &&
                            orderLines.length > 0 && (
                              <span className="text-sm font-semibold text-green-600">
                                All items confirmed ✓
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                  */}
                  <div className="card">
                    <div className="card-body space-y-4">
                      <div className="text-lg font-semibold">
                        {isViewMode
                          ? "View Service Confirmation"
                          : "Service Details"}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="label">Date *</label>
                          <input
                            type="date"
                            className={readonlyClass}
                            value={formData.sc_date}
                            onChange={(e) =>
                              !isViewMode &&
                              setFormData({
                                ...formData,
                                sc_date: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Supplier *</label>
                          <select
                            className={readonlyClass}
                            value={formData.supplier_id}
                            onChange={(e) =>
                              !isViewMode &&
                              setFormData({
                                ...formData,
                                supplier_id: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            required
                          >
                            <option value="">Select supplier...</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {(s.supplier_code
                                  ? `${s.supplier_code} - `
                                  : "") + s.supplier_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Time</label>
                          <input
                            type="time"
                            className={readonlyClass}
                            value={appointmentTime}
                            onChange={(e) =>
                              !isViewMode && setAppointmentTime(e.target.value)
                            }
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Select Services section removed */}

                  <div className="card">
                    <div className="card-body space-y-4">
                      <div className="text-lg font-semibold">
                        Service Acceptance
                      </div>
                      <div className="space-y-3">
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg border ${readonlySurfaceClass} ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={accept1}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setAccept1(e.target.checked)
                            }
                          />
                          <span>
                            All services listed were completed as specified
                          </span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg border ${readonlySurfaceClass} ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={accept2}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setAccept2(e.target.checked)
                            }
                          />
                          <span>Work quality meets agreed standards</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg border ${readonlySurfaceClass} ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={accept3}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setAccept3(e.target.checked)
                            }
                          />
                          <span>
                            Materials used were as specified or approved
                          </span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg border ${readonlySurfaceClass} ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={accept4}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setAccept4(e.target.checked)
                            }
                          />
                          <span>Service location was left clean and tidy</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg border ${readonlySurfaceClass} ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={accept5}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setAccept5(e.target.checked)
                            }
                          />
                          <span>
                            All documentation, warranties, and instructions
                            received
                          </span>
                        </label>
                      </div>
                      <div>
                        <label className="label">Overall Satisfaction *</label>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {[5, 4, 3, 2, 1].map((n) => (
                            <label
                              key={n}
                              className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                                isViewMode
                                  ? "bg-sky-50 border-sky-200"
                                  : satisfaction === String(n)
                                    ? "bg-amber-50 border-amber-300"
                                    : "bg-white border-slate-200"
                              }`}
                            >
                              <input
                                type="radio"
                                name="satisfaction"
                                value={String(n)}
                                checked={satisfaction === String(n)}
                                disabled={isViewMode}
                                onChange={(e) =>
                                  !isViewMode && setSatisfaction(e.target.value)
                                }
                              />
                              {Array.from({ length: n })
                                .map(() => "⭐")
                                .join("")}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label">
                          Customer Feedback{" "}
                          <span className="text-slate-500">(Optional)</span>
                        </label>
                        <textarea
                          className={`${readonlyClass} w-1/2`}
                          rows="6"
                          value={customerFeedback}
                          onChange={(e) =>
                            !isViewMode && setCustomerFeedback(e.target.value)
                          }
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        Additional Information
                      </div>
                      <div>
                        <label className="label">Remarks</label>
                        <textarea
                          className={`${readonlyClass} w-1/2`}
                          rows="6"
                          value={formData.remarks}
                          onChange={(e) =>
                            !isViewMode &&
                            setFormData({
                              ...formData,
                              remarks: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${readonlySurfaceClass} ${isViewMode ? "pointer-events-none" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={warrantyProvided}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode &&
                              setWarrantyProvided(e.target.checked)
                            }
                          />
                          <span>Warranty documentation provided</span>
                        </label>
                        <label
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${readonlySurfaceClass} ${isViewMode ? "pointer-events-none" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={followUpRequired}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode &&
                              setFollowUpRequired(e.target.checked)
                            }
                          />
                          <span>Follow-up visit required</span>
                        </label>
                      </div>
                      {followUpRequired ? (
                        <div>
                          <label className="label">Follow-up Details</label>
                          <textarea
                            className={`${readonlyClass} w-1/2`}
                            rows="6"
                            value={followUpNotes}
                            disabled={isViewMode}
                            onChange={(e) =>
                              !isViewMode && setFollowUpNotes(e.target.value)
                            }
                          />
                        </div>
                      ) : null}
                      <div></div>
                    </div>
                    {/* end additional-info card-body */}
                  </div>
                  {/* end additional-info card */}
                </div>
                {/* end space-y-4 */}
              </div>
              {/* end grid */}
            </div>
            {/* end outer card-body */}
          </div>
          {/* end outer card */}
        </div>
        {/* end space-y-6 */}
      </div>
      {/* end flex-1 */}

      <div className="shrink-0 bg-white border-t-2 border-slate-200 shadow-lg px-6 py-3">
        <div className="flex justify-end items-center gap-3">
          <Link
            to={backPath}
            className="btn-secondary px-6 py-2.5 text-sm font-semibold"
          >
            {isViewMode ? "Back to List" : "Cancel"}
          </Link>
          {isViewMode ? (
            <button
              type="button"
              className="btn-primary px-6 py-2.5 text-sm font-semibold"
              onClick={() => {
                const nextParams = new URLSearchParams();
                if (confirmationId)
                  nextParams.set("confirmation_id", confirmationId);
                if (preselectedOrderId)
                  nextParams.set("order_id", preselectedOrderId);
                if (preselectedExecutionId)
                  nextParams.set("execution_id", preselectedExecutionId);
                if (
                  !confirmationId &&
                  selectedExecutionId &&
                  !preselectedOrderId
                ) {
                  nextParams.set("order_id", selectedExecutionId);
                }
                nextParams.set("mode", "edit");
                navigate(`${formEntryPath}?${nextParams.toString()}`);
              }}
            >
              Edit Confirmation
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-danger px-6 py-2.5 text-sm font-semibold"
                onClick={() => {
                  setRejectionReason("");
                  setShowRejectModal(true);
                }}
              >
                Reject Service
              </button>
              <button
                type="button"
                className="btn-success px-6 py-2.5 text-sm font-semibold"
                onClick={handleSubmit}
                disabled={saving || !readyToConfirm}
              >
                Confirm Service Completion
              </button>
            </>
          )}
        </div>
        {error ? (
          <div className="text-sm text-red-600 mt-2 text-right">{error}</div>
        ) : null}
      </div>
      {showRejectModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Service Rejection</div>
            </div>
            <div className="card-body space-y-3">
              <div>
                <label className="label">Reason for Rejection *</label>
                <textarea
                  className="input"
                  rows="4"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    if (!rejectionReason.trim()) {
                      alert("Please provide a reason for rejection.");
                      return;
                    }
                    try {
                      setSaving(true);
                      await api.put(
                        `/purchase/service-confirmations/${confirmationId}`,
                        {
                          ...formData,
                          status: "CANCELLED",
                          remarks: rejectionReason,
                          order_id: selectedExecutionId
                            ? Number(selectedExecutionId)
                            : formData.order_id || null,
                        },
                      );
                      alert("Service rejection has been recorded.");
                      setShowRejectModal(false);
                      navigate(backPath, {
                        state: { success: "Service confirmation rejected" },
                      });
                    } catch (err) {
                      alert(err?.response?.data?.message || err?.message || "Failed to reject service confirmation");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Submit Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

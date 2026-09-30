/**
 * @fileoverview ServiceOrderForm component.
 * Provides functionality for ServiceOrderForm.
 */

import React, { useState, useEffect } from "react";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

function toYmd(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceOrderForm() {
  const { hasExceptional } = usePermission();

  const navigate = useNavigate();
  const params = useParams();
  const editId = params.id ? String(params.id) : "";
  const [activeTab, setActiveTab] = useState("internal");
  const [orderNo, setOrderNo] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [serviceRequests, setServiceRequests] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [intCustType, setIntCustType] = useState("");
  const [intExisting, setIntExisting] = useState({ custId: "", accEmail: "" });
  const [intPerson, setIntPerson] = useState({
    customer: "",
    email: "",
    phone: "",
  });
  const [intService, setIntService] = useState({
    servCat: "",
    servType: "",
    items: [],
  });
  const [intSchedule, setIntSchedule] = useState({
    addr: "",
    date: "",
    time: "",
  });

  const [extDept, setExtDept] = useState({ dept: "", project: "" });
  const [extRequestor, setExtRequestor] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
  });

  const { user } = useAuth();
  React.useEffect(() => {
    if (user) {
      setExtRequestor((p) => ({
        ...p,
        name: p.name || user.full_name || user.username || "",
      }));
    }
  }, [user]);
  const [extContractor, setExtContractor] = useState({
    name: "",
    id: "",
    email: "",
    phone: "",
  });
  const [approvedServiceRequisitions, setApprovedServiceRequisitions] =
    useState([]);
  const [selectedServiceRequisitionId, setSelectedServiceRequisitionId] =
    useState("");
  const [contractors, setContractors] = useState([]);
  
  const [extService, setExtService] = useState({ items: [] });
  function addExtServiceItem() {
    setExtService((p) => ({
      ...p,
      items: [
        ...p.items,
        { id: crypto.randomUUID(), item_id: "", desc: "", qty: 1, price: 0, sub: 0 },
      ],
    }));
  }
  function updateExtItem(id, key, value) {
    setExtService((p) => {
      const items = p.items.map((it) => {
        if (it.id === id) {
          const next = { ...it, [key]: value };
          if (key === "item_id") {
            const selected = serviceItems.find((s) => String(s.id) === String(value)) || null;
            if (selected) {
              next.desc = selected.item_name || next.desc;
              const sp = Number(selected.selling_price || 0);
              if (Number.isFinite(sp)) next.price = sp;
            }
          }
          const qty = parseFloat(next.qty || 0);
          const price = parseFloat(next.price || 0);
          next.sub = qty * price;
          return next;
        }
        return it;
      });
      return { ...p, items };
    });
  }
  function removeExtItem(id) {
    setExtService((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
  }

  const [extReqs, setExtReqs] = useState({
    cat: "",
    type: "",
    scope: "",
  });
  const [extTimeline, setExtTimeline] = useState({
    loc: "",
    start: "",
    end: "",
  });
  const [extBudget, setExtBudget] = useState({
    estCost: "",
    currency: "USD",
  });
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");



  function generateOrderNo() {
    return `ORD-${Date.now().toString().slice(-8)}`;
  }

  useEffect(() => {
    let mounted = true;
    async function fetchServiceRequests() {
      try {
        const resp = await api.get("/purchase/service-requests");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setServiceRequests(rows);
      } catch {
        if (mounted) setServiceRequests([]);
      }
    }
    async function fetchApprovedServiceRequisitions() {
      try {
        const resp = await api.get("/purchase/general-requisitions", {
          params: { status: "APPROVED", requisition_type: "SERVICE" },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setApprovedServiceRequisitions(rows);
      } catch {
        if (mounted) setApprovedServiceRequisitions([]);
      }
    }
    async function fetchServiceItems() {
      try {
        const resp = await api.get("/inventory/items");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
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
        if (mounted) setServiceItems(filtered);
      } catch {
        if (mounted) setServiceItems([]);
      }
    }
    fetchServiceRequests();
    fetchApprovedServiceRequisitions();
    fetchServiceItems();
    async function fetchContractors() {
      try {
        const resp = await api.get("/purchase/suppliers", {
          params: { contractor: "Y" },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        setContractors(rows);
      } catch {
        setContractors([]);
      }
    }
    fetchContractors();
    async function fetchDepartments() {
      try {
        const resp = await api.get("/admin/departments");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setDepartments(rows);
      } catch {
        if (mounted) setDepartments([]);
      }
    }
    async function fetchProjects() {
      try {
        const resp = await api.get("/projects/projects");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setProjects(rows);
      } catch {
        if (mounted) setProjects([]);
      }
    }
    async function fetchServiceCategories() {
      try {
        const resp = await api.get("/purchase/service-setup/categories");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setServiceCategories(rows);
      } catch {
        if (mounted) setServiceCategories([]);
      }
    }
    async function fetchWorkLocations() {
      try {
        const resp = await api.get("/purchase/service-setup/work-locations");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setWorkLocations(rows);
      } catch {
        if (mounted) setWorkLocations([]);
      }
    }
    async function fetchCurrencies() {
      try {
        const resp = await api.get("/finance/currencies");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setCurrencies(rows);
      } catch {
        if (mounted) setCurrencies([]);
      }
    }
    fetchDepartments();
    fetchProjects();
    fetchServiceCategories();
    fetchWorkLocations();
    fetchCurrencies();
    async function fetchTimeSlots() {
      try {
        const resp = await api.get("/purchase/service-setup/time-slots");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setTimeSlots(rows);
      } catch {
        if (mounted) setTimeSlots([]);
      }
    }
    fetchTimeSlots();
    async function fetchSupervisors() {
      try {
        const resp = await api.get("/purchase/service-setup/supervisors");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setSupervisors(rows);
      } catch {
        if (mounted) setSupervisors([]);
      }
    }
    fetchSupervisors();
    async function fetchCustomers() {
      try {
        const resp = await api.get("/sales/customers", { params: { service_customer: "Y" } });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setCustomers(rows);
      } catch {
        if (mounted) setCustomers([]);
      }
    }
    fetchCustomers();
    async function fetchForEdit() {
      if (!editId) return;
      try {
        const resp = await api.get(`/purchase/service-orders/${editId}`);
        const item = resp?.data?.item || {};
        const lines = Array.isArray(resp?.data?.lines) ? resp.data.lines : [];
        const type = String(item.order_type || "INTERNAL").toUpperCase();
        setActiveTab(type === "EXTERNAL" ? "external" : "internal");
        setOrderNo(item.order_no || "");
        if (type === "INTERNAL") {
          setIntPerson({
            customer: item.customer_name || "",
            email: item.customer_email || "",
            phone: item.customer_phone || "",
          });
          setIntService({
            servCat: item.service_category || "",
            servType: item.service_type || "",
            items: lines.map((ln) => ({
              id: crypto.randomUUID(),
              item_id: ln.item_id || "",
              desc: ln.description || "",
              qty: Number(ln.qty || 0),
              price: Number(ln.unit_price || 0),
              sub: Number(ln.line_total || 0),
            })),
          });
          setIntSchedule({
            addr: item.schedule_address || item.work_location || "",
            date: toYmd(item.schedule_date || item.order_date || ""),
            time: item.schedule_time || "",
          });
        } else {
          setExtDept({
            dept: item.department || "",
            project: item.project_id || "",
          });
          setExtRequestor({
            name: item.requestor_name || "",
            title: item.requestor_title || "",
            email: item.requestor_email || "",
            phone: item.requestor_phone || "",
          });
          setExtContractor({
            name: item.contractor_name || "",
            id: item.contractor_code || "",
            email: item.contractor_email || "",
            phone: item.contractor_phone || "",
          });
          setExtReqs({
            cat: item.ext_category || "",
            scope: item.scope_of_work || "",
          });
          setExtTimeline({
            loc: item.work_location || "",
            start: toYmd(item.start_date || ""),
            end: toYmd(item.end_date || ""),
          });
          setExtBudget({
            estCost: item.estimated_cost || "",
            currency: item.currency_code || "USD",
          });
        }
        if (item.assigned_supervisor_user_id) {
          setSelectedSupervisorId(String(item.assigned_supervisor_user_id));
        }
      } catch {
        // ignore edit load errors
      }
    }
    fetchForEdit();
    if (!editId) {
      // ensure at least one blank item row for new orders
      setIntService((p) =>
        Array.isArray(p.items) && p.items.length
          ? p
          : {
              ...p,
              items: [
                {
                  id: crypto.randomUUID(),
                  item_id: "",
                  desc: "",
                  qty: 1,
                  price: 0,
                  sub: 0,
                },
              ],
            },
      );
    }
    return () => {
      mounted = false;
    };
  }, []);

  async function loadServiceRequest(id) {
    const sid = Number(id);
    if (!Number.isFinite(sid) || sid <= 0) return;
    try {
      const resp = await api.get(`/purchase/service-requests/${sid}`);
      const it = resp.data?.item || {};
      const customer = String(it.requester_full_name || "").trim();
      setIntPerson({
        customer,
        email: it.requester_email || "",
        phone: it.requester_phone || "",
      });
      const catRaw = String(it.service_type || "").toLowerCase();
      const catMap = {
        consultation: "consulting",
        consulting: "consulting",
        installation: "installation",
        maintenance: "maintenance",
        repair: "repair",
        general: "custom",
      };
      setIntService((p) => ({
        ...p,
        servCat: catMap[catRaw] || p.servCat || "",
        servType: it.service_type || "",
      }));
      setIntSchedule((p) => ({
        ...p,
        date: it.preferred_date || "",
        time: it.preferred_time || "",
      }));
    } catch {
      // ignore
    }
  }

  function addServiceItem() {
    setIntService((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: crypto.randomUUID(),
          item_id: "",
          desc: "",
          qty: 1,
          price: 0,
          sub: 0,
        },
      ],
    }));
  }

  function updateItem(id, key, value) {
    setIntService((p) => {
      const items = p.items.map((it) => {
        if (it.id === id) {
          const next = { ...it, [key]: value };
          if (key === "item_id") {
            const selected =
              serviceItems.find((s) => String(s.id) === String(value)) || null;
            if (selected) {
              next.desc = selected.item_name || next.desc;
              const sp = Number(selected.selling_price || 0);
              if (Number.isFinite(sp)) next.price = sp;
            }
          }
          const qty = parseFloat(next.qty || 0);
          const price = parseFloat(next.price || 0);
          next.sub = qty * price;
          return next;
        }
        return it;
      });
      return { ...p, items };
    });
  }

  function removeItem(id) {
    setIntService((p) => ({
      ...p,
      items: p.items.filter((it) => it.id !== id),
    }));
  }

  function resetInternal() {
    setIntCustType("");
    setIntExisting({ custId: "", accEmail: "" });
    setIntPerson({ customer: "", email: "", phone: "" });
    setIntService({ servCat: "", servType: "", items: [] });
    setIntSchedule({ addr: "", date: "", time: "" });
  }

  function resetExternal() {
    setExtDept({ dept: "", project: "" });
    setExtRequestor({ name: "", title: "", email: "", phone: "" });
    setExtContractor({ name: "", id: "", email: "", phone: "" });
    setExtReqs({ cat: "", scope: "" });
    setExtTimeline({ loc: "", start: "", end: "" });
    setExtBudget({ estCost: "", currency: "USD" });
  }

  function submitInternal(e) {
    e.preventDefault();
    const lines = (intService.items || []).map((it) => {
      const qty = parseFloat(it.qty || 0);
      const price = parseFloat(it.price || 0);
      return {
        item_id: it.item_id || null,
        item_name:
          serviceItems.find((s) => String(s.id) === String(it.item_id))
            ?.item_name || null,
        description: it.desc || null,
        qty,
        unit_price: price,
        line_total: qty * price,
      };
    });
    const total = lines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
    const payload = {
      order_type: "INTERNAL",
      customer_name: intPerson.customer || null,
      customer_email: intPerson.email || null,
      customer_phone: intPerson.phone || null,
      service_category: intService.servCat || null,
      service_type: intService.servType || null,
      schedule_address: intSchedule.addr || null,
      schedule_date: intSchedule.date || null,
      schedule_time: intSchedule.time || null,
      lines,
      total_amount: total,
      assigned_supervisor_user_id: selectedSupervisorId
        ? Number(selectedSupervisorId)
        : null,
      assigned_supervisor_username:
        supervisors.find(
          (s) => String(s.user_id) === String(selectedSupervisorId),
        )?.username || null,
    };
    const req =
      editId && editId !== ""
        ? api.put(`/purchase/service-orders/${editId}`, payload)
        : api.post("/purchase/service-orders", payload);
    req
      .then((resp) => {
        const num =
          resp?.data?.order_no ||
          orderNo ||
          (editId ? `ORD-${editId}` : generateOrderNo());
        setOrderNo(num);
        toast.success(
          num
            ? `Service order ${num} saved successfully`
            : "Service order saved successfully",
        );
        navigate("/service-management/service-orders");
      })
      .catch(() => {
        toast.error("Failed to submit service order");
      });
  }

  function submitExternal(e) {
      e.preventDefault();
      const lines = (extService.items || []).map((it) => {
        const qty = parseFloat(it.qty || 0);
        const price = parseFloat(it.price || 0);
        return {
          item_id: it.item_id || null,
          item_name: serviceItems.find((s) => String(s.id) === String(it.item_id))?.item_name || null,
          description: it.desc || null,
          qty,
          unit_price: price,
          line_total: qty * price,
        };
      });
      const total = lines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
      const payload = {
        lines,
      order_type: "EXTERNAL",
      department: extDept.dept || null,
      project_id: extDept.project ? Number(extDept.project) : null,
      requestor_name: extRequestor.name || null,
      requestor_title: extRequestor.title || null,
      requestor_email: extRequestor.email || null,
      requestor_phone: extRequestor.phone || null,
      contractor_name: extContractor.name || null,
      contractor_code: extContractor.id || null,
      contractor_email: extContractor.email || null,
        customer_name: extContractor.name || null,
        customer_email: extContractor.email || null,
        service_category: extReqs.cat || null,
      contractor_phone: extContractor.phone || null,
      ext_category: extReqs.cat || null,
        service_type: extReqs.type || null,
      scope_of_work: extReqs.scope || null,
      work_location: extTimeline.loc || null,
      start_date: extTimeline.start || null,
      end_date: extTimeline.end || null,
      estimated_cost: extBudget.estCost || null,
      currency_code: extBudget.currency || null,
      total_amount: total || Number(extBudget.estCost || 0),
      assigned_supervisor_user_id: selectedSupervisorId
        ? Number(selectedSupervisorId)
        : null,
      assigned_supervisor_username:
        supervisors.find(
          (s) => String(s.user_id) === String(selectedSupervisorId),
        )?.username || null,
    };
    const req =
      editId && editId !== ""
        ? api.put(`/purchase/service-orders/${editId}`, payload)
        : api.post("/purchase/service-orders", payload);
    req
      .then((resp) => {
        const createdId = resp?.data?.id || null;
        if (createdId && selectedServiceRequisitionId) {
          const [src, rid] = String(selectedServiceRequisitionId).split(":");
          const numId = Number(rid);
          if (src === "gr" && Number.isFinite(numId) && numId > 0) {
            api
              .post(
                `/purchase/general-requisitions/${numId}/link`,
                { ref_type: "SERVICE_ORDER", ref_id: Number(createdId) },
              )
              .catch(() => {});
          }
        }
        const num =
          resp?.data?.order_no ||
          orderNo ||
          (editId ? `ORD-${editId}` : generateOrderNo());
        setOrderNo(num);
        toast.success(
          num
            ? `Service order ${num} saved successfully`
            : "Service order saved successfully",
        );
        navigate("/service-management/service-orders");
      })
      .catch(() => {
        toast.error("Failed to submit service order");
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Service Order List
          </button>
          <h1 className="text-2xl font-bold mt-2">Service Order Management</h1>
          <p className="text-sm mt-1">
            Comprehensive order system for internal services and external
            contractors
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h2 className="text-xl font-semibold dark:text-brand-300">
                Service Orders
              </h2>
              <p className="text-sm mt-1">
                Internal services and external contractor orders
              </p>
            </div>
          </div>
        </div>

        <div className="card-body">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              className={`p-4 rounded-lg border-2 text-left transition ${
                activeTab === "internal"
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                  : "border-slate-200 hover:border-brand-300 dark:border-slate-700"
              }`}
              onClick={() => setActiveTab("internal")}
            >
              <div className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                Internal Service
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Process an order for internal services and operations.
              </div>
            </button>
            <button
              type="button"
              className={`p-4 rounded-lg border-2 text-left transition ${
                activeTab === "external"
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                  : "border-slate-200 hover:border-brand-300 dark:border-slate-700"
              }`}
              onClick={() => setActiveTab("external")}
            >
              <div className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                External Contractor
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Process an order for an external contractor or vendor.
              </div>
            </button>
          </div>

          {activeTab === "internal" && (
            <div className="flex flex-col gap-6">
              <div className="w-full">
                <form onSubmit={submitInternal}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="group">
                      <label className="label">
                        Link Service Request <span className="req">*</span>
                      </label>
                      <select
                        className="input w-full"
                        onChange={(e) => loadServiceRequest(e.target.value)}
                      >
                        <option value="">-- Select Service Request --</option>
                        {serviceRequests.map((sr) => (
                          <option key={sr.id} value={sr.id}>
                            {sr.request_no} • {sr.requester_full_name} •{" "}
                            {sr.service_type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="group">
                      <label className="label">
                        Customer <span className="req">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className="input w-full"
                          placeholder="Search customer..."
                          value={intPerson.customer || customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setIntPerson((p) => ({
                              ...p,
                              customer: "",
                              email: "",
                              phone: "",
                            }));
                          }}
                          required
                        />
                        {customerSearch && !intPerson.customer && (
                          (() => {
                            const q = customerSearch.toLowerCase();
                            const matched = customers.filter(
                              (c) =>
                                String(c.customer_name || "").toLowerCase().includes(q) ||
                                String(c.customer_code || "").toLowerCase().includes(q)
                            ).slice(0, 10);
                            return matched.length > 0 ? (
                              <div className="absolute z-30 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                                {matched.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setIntPerson((p) => ({
                                        ...p,
                                        customer: c.customer_name || "",
                                        email: c.email || c.customer_email || "",
                                        phone: c.phone || c.customer_phone || "",
                                      }));
                                      setCustomerSearch("");
                                    }}
                                  >
                                    <div className="font-medium text-slate-800 text-sm">{c.customer_name}</div>
                                    {c.customer_code && <div className="text-xs text-slate-500">{c.customer_code}</div>}
                                  </button>
                                ))}
                              </div>
                            ) : q.length >= 2 ? (
                              <div className="absolute z-30 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1">
                                <div className="p-3 text-sm text-slate-600 text-center">
                                  Customer not found.{" "}
                                  <span className="text-brand-700 font-medium cursor-pointer underline" onClick={() => {
                                    setIntPerson((p) => ({ ...p, customer: customerSearch }));
                                    setCustomerSearch("");
                                  }}>Use as Custom Name</span>
                                </div>
                              </div>
                            ) : null;
                          })()
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="group">
                      <label className="label">
                        Email <span className="req">*</span>
                      </label>
                      <input
                        className="input w-full"
                        type="email"
                        value={intPerson.email}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="customer@example.com"
                        required
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Phone <span className="req">*</span>
                      </label>
                      <input
                        className="input w-full"
                        value={intPerson.phone}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Service Type <span className="req">*</span>
                      </label>
                      <input
                        className="input w-full"
                        value={intService.servType}
                        onChange={(e) =>
                          setIntService((p) => ({
                            ...p,
                            servType: e.target.value,
                          }))
                        }
                        placeholder="e.g., Installation"
                        required
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Service Category <span className="req">*</span>
                      </label>
                      <select
                        className="input w-full"
                        value={intService.servCat}
                        onChange={(e) =>
                          setIntService((p) => ({
                            ...p,
                            servCat: e.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">-- Select Category --</option>
                        {serviceCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="card md:col-span-3">
                    <div className="card-body">
                      <h4 style={{ color: "var(--primary)", marginBottom: 10 }}>
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
                        {intService.items.map((it) => (
                          <div
                            key={it.id}
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
                              value={it.item_id || ""}
                              onChange={(e) =>
                                updateItem(it.id, "item_id", e.target.value)
                              }
                            >
                              <option value="">
                                -- Select Service Item --
                              </option>
                              {serviceItems.map((si) => (
                                <option key={si.id} value={si.id}>
                                  {si.item_name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input"
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(it.id, "qty", e.target.value)
                              }
                            />
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.price}
                              onChange={(e) =>
                                updateItem(it.id, "price", e.target.value)
                              }
                              placeholder="0.00"
                            />
                            <input
                              className="input"
                              readOnly
                              value={(
                                parseFloat(it.qty || 0) *
                                parseFloat(it.price || 0)
                              ).toFixed(2)}
                            />
                            <button
                                type="button"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                onClick={() => removeItem(it.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-primary mt-2"
                        onClick={addServiceItem}
                      >
                        + Add Service Item
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="group">
                    <label className="label">
                      Work Location <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      value={intSchedule.addr}
                      onChange={(e) =>
                        setIntSchedule((p) => ({ ...p, addr: e.target.value }))
                      }
                      required
                    >
                      <option value="">-- Select Work Location --</option>
                      {workLocations.map((wl) => (
                        <option key={wl.id} value={wl.name}>
                          {wl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                    <div className="group">
                      <label className="label">
                        Service Date <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="date"
                        value={intSchedule.date}
                        onChange={(e) =>
                          setIntSchedule((p) => ({
                            ...p,
                            date: e.target.value,
                          }))
                        }
                        min={today}
                        required
                      
                        disabled={!!editId && !hasExceptional("DOCUMENT.EDIT_DATE")}
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Time Slot <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={intSchedule.time}
                        onChange={(e) =>
                          setIntSchedule((p) => ({
                            ...p,
                            time: e.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">-- Select Time --</option>
                        {timeSlots.map((ts) => (
                          <option key={ts.id} value={ts.name}>
                            {ts.name}
                          </option>
                        ))}
                      </select>
                    </div>


                  <div className="group">
                    <label className="label">Assigned Supervisor</label>
                    <select
                      className="input"
                      value={selectedSupervisorId}
                      onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    >
                      <option value="">-- Select Supervisor --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.user_id}>
                          {s.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetInternal}
                    >
                      Clear
                    </button>
                    <button type="submit" className="btn-primary">
                      Submit Order
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "external" && (
            <div className="flex flex-col gap-6">
              <div className="w-full">
                <form onSubmit={submitExternal}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="group">
                      <label className="label">Requisition</label>
                      <select
                        className="input w-56"
                        value={selectedServiceRequisitionId}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setSelectedServiceRequisitionId(val);
                          if (!val) return;
                          const [src, rid] = String(val).split(":");
                          const numId = Number(rid);
                          if (!Number.isFinite(numId) || numId <= 0) return;
                          try {
                            let grItems = [];
                            if (src === "sreq") {
                              const res = await api.get(`/purchase/service-requests/${numId}`);
                              const req = res.data?.item || res.data || {};
                              const desc = req.description || req.request_title || "";
                              const title = req.request_title || "";
                              setExtReqs((p) => ({
                                ...p,
                                scope: desc || title || p.scope,
                                cat: req.service_type || p.cat,
                              }));
                              setExtDept((p) => ({
                                ...p,
                                dept: req.department || p.dept,
                              }));
                              setExtRequestor((p) => ({
                                ...p,
                                name: req.created_by_name || "",
                                email: p.email,
                                phone: p.phone,
                              }));
                              setExtContractor((p) => ({
                                ...p,
                                name: req.requester_full_name || req.customer_name || p.name,
                                id: req.customer_code || p.id,
                                email: req.requester_email || p.email,
                                phone: req.requester_phone || p.phone,
                              }));
                              setExtBudget((p) => ({
                                ...p,
                                estCost: p.estCost,
                              }));
                              return;
                            } else {
                              const res = await api.get(`/purchase/general-requisitions/${numId}`);
                              const req = res.data?.item || res.data || {};
                              grItems = Array.isArray(res.data?.items) ? res.data.items : [];
                              setExtDept((p) => ({
                                ...p,
                                dept: req.department || p.dept,
                              }));
                              setExtRequestor((p) => ({
                                ...p,
                                name: req.requested_by || p.name,
                              }));
                              if (req.work_location) {
                                setExtTimeline((p) => ({
                                  ...p,
                                  loc: req.work_location || p.loc,
                                }));
                              }
                              if (grItems.length > 0) {
                                const mappedItems = grItems.map((ln) => ({
                                  id: crypto.randomUUID(),
                                  item_id: ln.item_id || "",
                                  desc: ln.description || ln.item_name || "",
                                  qty: Number(ln.qty || 1),
                                  price: Number(ln.estimated_unit_cost || 0),
                                  sub: Number(ln.qty || 1) * Number(ln.estimated_unit_cost || 0),
                                }));
                                setExtService({ items: mappedItems });
                              }
                            }
                            const scopeText = grItems
                              .map((ln) => {
                                const desc = ln.description || ln.item_name || "Service";
                                const qty = Number(ln.qty || 0);
                                const uom = String(ln.uom || "").trim();
                                return `- ${desc}${qty ? ` (x${qty}${uom ? " " + uom : ""})` : ""}`;
                              })
                              .join("\n");
                            const est = grItems.reduce(
                              (acc, ln) =>
                                acc +
                                Number(ln.qty || 0) *
                                  Number(ln.estimated_unit_cost || 0),
                              0,
                            );
                            setExtReqs((p) => ({
                              ...p,
                              scope: scopeText || p.scope,
                            }));
                            setExtBudget((p) => ({
                              ...p,
                              estCost: est ? String(est) : p.estCost,
                            }));
                          } catch {}
                        }}
                      >
                        <option value="">
                          -- Select Requisition --
                        </option>
                        {approvedServiceRequisitions.length > 0 && (
                          <optgroup label="Supplier Service Requests">
                            {approvedServiceRequisitions.map((r) => (
                              <option key={`gr:${r.id}`} value={`gr:${r.id}`}>
                                {r.requisition_no} • {r.department || ""} •{" "}
                                {String(r.requisition_date || "").slice(0, 10)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="group">
                      <label className="label">
                        Department 
                      </label>
                      <select
                        className="input w-56"
                        value={extDept.dept}
                        onChange={(e) =>
                          setExtDept((p) => ({ ...p, dept: e.target.value }))
                        }
                        
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="group">
                      <label className="label">
                        Project 
                      </label>
                      <select
                        className="input w-56"
                        value={extDept.project}
                        onChange={(e) =>
                          setExtDept((p) => ({ ...p, project: e.target.value }))
                        }
                        
                      >
                        <option value="">-- Select Project --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_code} • {p.project_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="group">
                      <label className="label">
                        Requestor Name 
                      </label>
                      <input
                        className="input w-56"
                        value={extRequestor.name}
                        onChange={(e) =>
                          setExtRequestor((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Full name"
                        
                      />
                    </div>
                    
                    
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    

                    <div className="group">
                      <label className="label">
                        Contractor Name 
                      </label>
                      <select
                        className="input w-56"
                        value={extContractor.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setExtContractor((p) => ({ ...p, name }));
                          const sup = contractors.find(
                            (c) => String(c.supplier_name) === String(name),
                          );
                          if (sup) {
                            setExtContractor({
                              name: sup.supplier_name || "",
                              id: sup.supplier_code || "",
                              email: sup.email || "",
                              phone: sup.phone || "",
                            });
                            const cur = currencies.find(
                              (x) => Number(x.id) === Number(sup.currency_id),
                            );
                            if (cur?.code) {
                              setExtBudget((p) => ({
                                ...p,
                                currency: cur.code,
                              }));
                            }
                          }
                        }}
                        
                      >
                        <option value="">-- Select Contractor --</option>
                        {contractors.map((c) => (
                          <option key={c.id} value={c.supplier_name}>
                            {c.supplier_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="group">
                      <label className="label">
                        Contractor ID{" "}
                        <span className="text-slate-500">(Optional)</span>
                      </label>
                      <input
                        className="input w-56"
                        value={extContractor.id}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            id: e.target.value,
                          }))
                        }
                        placeholder="CONT-12345"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="group">
                      <label className="label">
                        Contractor Email 
                      </label>
                      <input
                        className="input w-56"
                        type="email"
                        value={extContractor.email}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        placeholder="contractor@company.com"
                        
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Contractor Phone 
                      </label>
                      <input
                        className="input w-56"
                        value={extContractor.phone}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="+1 (555) 987-6543"
                        
                      />
                    </div>

                    <div className="group">
                      <label className="label">
                        Service Category 
                      </label>
                      <select
                        className="input w-56"
                        value={extReqs.cat}
                        onChange={(e) =>
                          setExtReqs((p) => ({ ...p, cat: e.target.value }))
                        }
                        
                      >
                        <option value="">-- Select Category --</option>
                        {serviceCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="group mb-4">
                    <label className="label">
                      Scope of Work 
                    </label>
                    <textarea rows="6"
                      className="input w-full"
                      value={extReqs.scope}
                      onChange={(e) =>
                        setExtReqs((p) => ({ ...p, scope: e.target.value }))
                      }
                      placeholder="Detailed description of work to be performed"
                      
                      />
                    </div>

                    <div className="card md:col-span-3 mb-4">
                      <div className="card-body">
                        <h4 style={{ color: "var(--primary)", marginBottom: 10 }}>
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
                          {extService.items.map((it) => (
                            <div
                              key={it.id}
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
                                value={it.item_id || ""}
                                onChange={(e) =>
                                  updateExtItem(it.id, "item_id", e.target.value)
                                }
                              >
                                <option value="">
                                  -- Select Service Item --
                                </option>
                                {serviceItems.map((si) => (
                                  <option key={si.id} value={si.id}>
                                    {si.item_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input"
                                type="number"
                                min="1"
                                value={it.qty}
                                onChange={(e) =>
                                  updateExtItem(it.id, "qty", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={it.price}
                                onChange={(e) =>
                                  updateExtItem(it.id, "price", e.target.value)
                                }
                                placeholder="0.00"
                              />
                              <input
                                className="input"
                                readOnly
                                value={(
                                  parseFloat(it.qty || 0) *
                                  parseFloat(it.price || 0)
                                ).toFixed(2)}
                              />
                              <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                  onClick={() => removeExtItem(it.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn-primary mt-2"
                          onClick={addExtServiceItem}
                        >
                          + Add Service Item
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="group">
                        <label className="label">
                          Work Location 
                      </label>
                      <select
                        className="input w-56"
                        value={extTimeline.loc}
                        onChange={(e) =>
                          setExtTimeline((p) => ({ ...p, loc: e.target.value }))
                        }
                        
                      >
                        <option value="">-- Select Work Location --</option>
                        {workLocations.map((wl) => (
                          <option key={wl.id} value={wl.name}>
                            {wl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="group">
                      <label className="label">
                        Start Date 
                      </label>
                      <input
                        className="input w-56"
                        type="date"
                        value={extTimeline.start}
                        onChange={(e) =>
                          setExtTimeline((p) => ({
                            ...p,
                            start: e.target.value,
                          }))
                        }
                        min={today}
                        
                      
                        disabled={!!editId && !hasExceptional("DOCUMENT.EDIT_DATE")}
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        End Date 
                      </label>
                      <input
                        className="input w-56"
                        type="date"
                        value={extTimeline.end}
                        onChange={(e) =>
                          setExtTimeline((p) => ({ ...p, end: e.target.value }))
                        }
                        min={today}
                        
                      
                        disabled={!!editId && !hasExceptional("DOCUMENT.EDIT_DATE")}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="group">
                      <label className="label">
                        Estimated Cost 
                      </label>
                      <input
                        className="input w-56"
                        type="number"
                        step="0.01"
                        min="0"
                        value={extBudget.estCost}
                        onChange={(e) =>
                          setExtBudget((p) => ({
                            ...p,
                            estCost: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        
                      />
                    </div>
                    <div className="group">
                      <label className="label">
                        Currency 
                      </label>
                      <select
                        className="input w-56"
                        value={extBudget.currency}
                        onChange={(e) =>
                          setExtBudget((p) => ({
                            ...p,
                            currency: e.target.value,
                          }))
                        }
                        
                      >
                        <option value="">-- Select Currency --</option>
                        {currencies.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>

                  <div className="group">
                    <label className="label">Assigned Supervisor</label>
                    <select
                      className="input w-56"
                      value={selectedSupervisorId}
                      onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    >
                      <option value="">-- Select Supervisor --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.user_id}>
                          {s.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetExternal}
                    >
                      Clear
                    </button>
                    <button type="submit" className="btn-primary">
                      Submit Order
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="card w-full max-w-md">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Order Submitted</div>
            </div>
            <div className="card-body space-y-3 text-center">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-sm">
                Your order has been received and is being processed.
              </div>
              <div className="order-num">Order #: {orderNo}</div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

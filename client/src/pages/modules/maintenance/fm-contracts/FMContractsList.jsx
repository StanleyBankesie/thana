import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FileText, Plus, Search, Calendar, ShieldCheck, 
  Receipt, Clock, CheckCircle, AlertCircle, Building2, X, ArrowLeft,
  Upload, Paperclip, Loader2, File, ExternalLink, Eye, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ViewToggle from "../../../../components/ViewToggle.jsx";

const DEFAULT_SERVICES = [
  "HVAC & Air Conditioning",
  "Generator & Power Systems",
  "Cleaning & Janitorial",
  "Security & Access Control",
  "Fire Safety Systems",
  "Pest Control & Fumigation",
  "Waste Management & Disposal",
  "Plumbing & Water Systems",
  "Landscaping & Grounds Maintenance",
  "Elevator & Escalator Maintenance"
];

const buildHref = (s) => {
  const file = String(s || "");
  if (/^https?:\/\//i.test(file)) return file;
  if (!file.startsWith("/uploads") && !file.startsWith("uploads")) return file;
  const uploadsPath = file.startsWith("/uploads") ? file : `/${file}`;
  const base = String(api.defaults.baseURL || "");
  if (/^https?:\/\//i.test(base)) {
    try {
      const u = new URL(base);
      return `${u.protocol}//${u.host}${uploadsPath}`;
    } catch {
      return uploadsPath;
    }
  }
  return `/api${uploadsPath}`;
};

export default function FMContractsList() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("table");

  // Create / Edit / View Modal
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [viewingContract, setViewingContract] = useState(null);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Billing Modal
  const [billingContract, setBillingContract] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("Current Month Fee");
  const [generatingBill, setGeneratingBill] = useState(false);

  const [formData, setFormData] = useState({
    contract_title: "",
    client_id: "",
    contract_no: "",
    start_date: "",
    end_date: "",
    billing_frequency: "MONTHLY",
    billing_amount: "",
    contract_value: "",
    emergency_callout_included: 1,
    emergency_callout_limit: 10,
    sla_critical_response_hours: 1.0,
    sla_critical_resolution_hours: 4.0,
    sla_standard_response_hours: 4.0,
    sla_standard_resolution_hours: 24.0,
    property_ids: [],
    contract_file_url: "",
    service_lines: []
  });

  useEffect(() => {
    fetchContracts();
    fetchClientsAndProperties();
  }, [statusFilter]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/contracts", {
        params: { status: statusFilter, search: searchTerm }
      });
      setContracts(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load FM service contracts");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientsAndProperties = async () => {
    try {
      const [clientRes, propRes, catRes] = await Promise.all([
        api.get("/sales/customers").catch(() => ({ data: [] })),
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
        api.get("/facilities/setup/categories").catch(() => ({ data: { data: [] } }))
      ]);
      const cList = Array.isArray(clientRes.data)
        ? clientRes.data
        : clientRes.data?.data || clientRes.data?.items || [];
      setClients(cList);
      setProperties(propRes.data?.data || []);
      const cats = catRes.data?.data || [];
      setAvailableServices(cats);
    } catch {
      // Ignore
    }
  };

  const openNewContractModal = () => {
    const serviceNames = availableServices.length > 0
      ? availableServices.map(c => c.category_name || c.category_code)
      : DEFAULT_SERVICES;

    setFormData({
      contract_title: "",
      client_id: "",
      contract_no: "",
      start_date: "",
      end_date: "",
      billing_frequency: "MONTHLY",
      billing_amount: "",
      contract_value: "",
      emergency_callout_included: 1,
      emergency_callout_limit: 10,
      sla_critical_response_hours: 1.0,
      sla_critical_resolution_hours: 4.0,
      sla_standard_response_hours: 4.0,
      sla_standard_resolution_hours: 24.0,
      property_ids: [],
      contract_file_url: "",
      service_lines: serviceNames.map(s => ({
        service_line: s,
        is_covered: true,
        parts_included: false
      }))
    });
    setShowModal(true);
  };

  const handleUploadContractFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDoc(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const url = res.data?.secure_url || res.data?.url || res.data?.path || res.data?.filename;
      if (url) {
        setFormData(prev => ({ ...prev, contract_file_url: url }));
        toast.success("Contract file uploaded successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload contract document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleEditContract = (ctr) => {
    setEditingContract(ctr);
    setFormData({
      contract_title: ctr.contract_title || "",
      client_id: ctr.client_id || "",
      contract_no: ctr.contract_no || "",
      start_date: ctr.start_date ? String(ctr.start_date).slice(0, 10) : "",
      end_date: ctr.end_date ? String(ctr.end_date).slice(0, 10) : "",
      billing_frequency: ctr.billing_frequency || "MONTHLY",
      billing_amount: ctr.billing_amount || "",
      contract_value: ctr.contract_value || "",
      emergency_callout_included: ctr.emergency_callout_included ?? 1,
      emergency_callout_limit: ctr.emergency_callout_limit ?? 10,
      sla_critical_response_hours: ctr.sla_critical_response_hours ?? 1.0,
      sla_critical_resolution_hours: ctr.sla_critical_resolution_hours ?? 4.0,
      sla_standard_response_hours: ctr.sla_standard_response_hours ?? 4.0,
      sla_standard_resolution_hours: ctr.sla_standard_resolution_hours ?? 24.0,
      properties: [],
      service_lines: [],
      contract_file_url: ctr.contract_file_url || "",
    });
    setShowModal(true);
  };

  const handleCreateContract = async (e) => {
    e.preventDefault();
    if (!formData.contract_title || !formData.client_id || !formData.start_date || !formData.end_date) {
      toast.warn("Contract title, client, start date, and end date are required");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/facilities/contracts", formData);
      toast.success("FM Service Contract established successfully");
      setShowModal(false);
      fetchContracts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create contract");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (!billingContract) return;
    try {
      setGeneratingBill(true);
      const res = await api.post(`/facilities/contracts/${billingContract.id}/generate-invoice`, {
        billing_period: billingPeriod
      });
      const billNo = res.data?.bill_no ? `(Service Bill: ${res.data.bill_no})` : "";
      toast.success(`Invoice ${res.data?.invoice_no} created and posted to Service Billing ${billNo}`);
      setBillingContract(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate recurring invoice");
    } finally {
      setGeneratingBill(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Facilities Management Service Contracts & SLAs
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Configure client service coverage, response & resolution SLA matrices, and automate recurring contract billing.
            </p>
          </div>
        </div>
        <button
          onClick={openNewContractModal}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> New Service Contract
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            className="input w-full pl-9 text-sm"
            placeholder="Search by contract title, contract number, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchContracts()}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            className="input text-sm py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Contracts View */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-900 dark:text-white">No Service Contracts Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create an FM service agreement with SLA rules.</p>
          <button
            onClick={openNewContractModal}
            className="btn btn-primary mt-4 text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Create Contract
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contract Details</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Services</th>
                  <th className="py-3 px-4">Recurring Billing</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {contracts.map((ctr) => (
                  <tr key={ctr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{ctr.contract_title}</div>
                      <div className="text-xs font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{ctr.contract_no}</span>
                        <span>•</span>
                        <span>{ctr.property_count || 0} Property(ies)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {ctr.client_name || "Enterprise Client"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        {ctr.start_date?.slice(0, 10)} to {ctr.end_date?.slice(0, 10)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-sans">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(ctr.services_names ? ctr.services_names.split(", ") : []).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                          >
                            {s}
                          </span>
                        ))}
                        {!ctr.services_names && (
                          <span className="text-slate-400 italic text-[11px]">No services selected</span>
                        )}
                      </div>
                      {ctr.contract_file_url && (
                        <div className="mt-1.5">
                          <a
                            href={buildHref(ctr.contract_file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            <Paperclip size={12} /> View Uploaded Contract
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        ₵{Number(ctr.billing_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-400">{ctr.billing_frequency}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        ctr.contract_status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                        {ctr.contract_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingContract(ctr)}
                          className="btn text-xs inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg font-medium shadow-apple-xs transition-all"
                          title="View Contract Details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleEditContract(ctr)}
                          className="btn text-xs inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg font-medium shadow-apple-xs transition-all"
                          title="Edit Contract"
                        >
                          <Edit size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => { setBillingContract(ctr); setBillingPeriod(`Monthly FM Fee (${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})`); }}
                          className="btn text-xs inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg font-semibold shadow-apple-xs transition-all"
                          title="Generate Finance Invoice"
                        >
                          <Receipt size={13} />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Contract Modal */}
      {billingContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                Generate Recurring Contract Invoice
              </h3>
              <button onClick={() => setBillingContract(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerateInvoice} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-bold uppercase block">Contract Title</label>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                  {billingContract.contract_title}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{billingContract.client_name}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Recurring Amount:</span>
                  <p className="font-extrabold text-emerald-600 text-sm">₵{Number(billingContract.billing_amount).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="label mb-1 font-bold text-slate-700 dark:text-slate-200">
                  Billing Period Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. October 2026 Monthly Maintenance"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  This will generate an official invoice in Finance and post a service bill directly to Facilities Service Billing.
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setBillingContract(null)} className="btn btn-secondary text-xs px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={generatingBill} className="btn btn-primary text-xs px-5 py-2 font-bold flex items-center gap-1.5">
                  <Receipt size={14} />
                  {generatingBill ? "Generating..." : "Generate Invoice to Finance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Create Facilities Management Service Contract & SLA
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Establish recurring client agreements, response & resolution SLAs, and covered facilities.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 sm:p-8 space-y-6 text-xs">
              {/* Section 1: Identification & Client */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-500" /> Contract Identification & Client
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Contract Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. Total Facilities Management & SLA Agreement - Tower A"
                      value={formData.contract_title}
                      onChange={(e) => setFormData({ ...formData, contract_title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Contract Reference No</label>
                    <input
                      type="text"
                      className="input w-full text-xs font-mono"
                      placeholder="e.g. FM-CTR-2026-01"
                      value={formData.contract_no}
                      onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Client / Customer Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input w-full text-xs font-medium"
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required
                    >
                      <option value="">Select Client / Landlord Organization...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.customer_name || c.name} {c.company ? `(${c.company})` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Validity Period & Billing Schedules */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" /> Validity Period & Financial Parameters
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Effective Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="input w-full text-xs"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Expiration End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="input w-full text-xs"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Billing Frequency</label>
                    <select
                      className="input w-full text-xs font-medium"
                      value={formData.billing_frequency}
                      onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="SEMI_ANNUALLY">Semi-Annually</option>
                      <option value="ANNUALLY">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Recurring Fee Amount (₵)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full font-mono text-xs"
                      placeholder="e.g. 15000.00"
                      value={formData.billing_amount}
                      onChange={(e) => setFormData({ ...formData, billing_amount: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Covered Properties */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Building2 size={14} className="text-purple-500" /> Property Coverage Scope
                </h4>
                <div>
                  <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Select Properties Covered</label>
                  <select
                    className="input w-full text-xs"
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id && !formData.property_ids.includes(id)) {
                        setFormData({ ...formData, property_ids: [...formData.property_ids, id] });
                      }
                    }}
                  >
                    <option value="">Choose property to add to contract coverage...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name} ({p.property_code})</option>
                    ))}
                  </select>

                  {formData.property_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {formData.property_ids.map((pid) => {
                        const prop = properties.find((p) => p.id === pid);
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium"
                          >
                            🏛️ {prop?.property_name || `Property #${pid}`}
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, property_ids: formData.property_ids.filter((x) => x !== pid) })}
                              className="hover:text-red-500 font-bold p-0.5 ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Service Level Agreements (SLAs) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" /> Service Level Agreements (SLAs)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Critical Response (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="input w-full font-mono text-xs"
                      value={formData.sla_critical_response_hours}
                      onChange={(e) => setFormData({ ...formData, sla_critical_response_hours: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Critical Resolution (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="input w-full font-mono text-xs"
                      value={formData.sla_critical_resolution_hours}
                      onChange={(e) => setFormData({ ...formData, sla_critical_resolution_hours: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Standard Response (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="input w-full font-mono text-xs"
                      value={formData.sla_standard_response_hours}
                      onChange={(e) => setFormData({ ...formData, sla_standard_response_hours: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Standard Resolution (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="input w-full font-mono text-xs"
                      value={formData.sla_standard_resolution_hours}
                      onChange={(e) => setFormData({ ...formData, sla_standard_resolution_hours: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Services Coverage */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500" /> Services
                  </h4>
                  <Link
                    to="/facilities/setup"
                    target="_blank"
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    Configure Services in Operations Setup <ExternalLink size={11} />
                  </Link>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Select the services covered under this contract. These services are defined in Operations Setup:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {formData.service_lines.map((sl, idx) => (
                    <label
                      key={sl.service_line}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sl.is_covered}
                        onChange={(e) => {
                          const updated = [...formData.service_lines];
                          updated[idx].is_covered = e.target.checked;
                          setFormData({ ...formData, service_lines: updated });
                        }}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {sl.service_line.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                  {formData.service_lines.length === 0 && (
                    <div className="col-span-3 text-slate-400 text-xs italic">
                      No services available. Configure them in Facilities Operations Setup.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 6: Contract Document (Cloudinary Upload) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <Paperclip size={14} className="text-blue-500" /> Contract Document / Signed Agreement (Cloudinary)
                </h4>
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Upload Contract Agreement Document (PDF, DOCX, PNG, JPG)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Uploaded document is stored securely in Cloudinary and accessible directly from the contracts register.
                      </p>
                    </div>
                    <div>
                      <label className="btn btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer">
                        {uploadingDoc ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        <span>{uploadingDoc ? "Uploading..." : "Upload Document"}</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={handleUploadContractFile}
                          disabled={uploadingDoc}
                        />
                      </label>
                    </div>
                  </div>
                  {formData.contract_file_url && (
                    <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                        <span className="font-medium truncate">{formData.contract_file_url}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, contract_file_url: "" }))}
                        className="text-red-500 hover:text-red-700 font-bold ml-2 text-xs flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary text-xs px-5 py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs px-6 py-2.5 font-bold"
                >
                  {submitting ? "Establishing..." : "Save Contract & SLAs"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Contract Modal */}
      {viewingContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Contract Details: {viewingContract.contract_title}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">{viewingContract.contract_no}</span>
                </div>
              </div>
              <button
                onClick={() => setViewingContract(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingContract.client_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Billing Amount</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₵{Number(viewingContract.billing_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / {viewingContract.billing_frequency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Start Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {viewingContract.start_date ? String(viewingContract.start_date).slice(0, 10) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">End Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {viewingContract.end_date ? String(viewingContract.end_date).slice(0, 10) : "—"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1.5">Covered Services</span>
                <p className="text-slate-700 dark:text-slate-200 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  {viewingContract.services_names || "No specific service categories registered."}
                </p>
              </div>

              {viewingContract.contract_file_url && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-between border border-blue-200 dark:border-blue-900">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Paperclip size={15} />
                    <span className="font-medium">Uploaded Contract Agreement</span>
                  </div>
                  <a
                    href={buildHref(viewingContract.contract_file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary text-xs px-3 py-1 inline-flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} /> View Document
                  </a>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingContract;
                    setViewingContract(null);
                    handleEditContract(c);
                  }}
                  className="btn btn-primary text-xs px-4 py-2"
                >
                  Edit Contract
                </button>
                <button
                  type="button"
                  onClick={() => setViewingContract(null)}
                  className="btn btn-secondary text-xs px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

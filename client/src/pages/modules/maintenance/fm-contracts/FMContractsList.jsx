import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, Plus, Search, Calendar, ShieldCheck, 
  Receipt, Clock, CheckCircle, AlertCircle, Building2, X, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMContractsList() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
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
    service_lines: [
      { service_line: "HVAC_AIR_CONDITIONING", is_covered: true, parts_included: false },
      { service_line: "GENERATOR_POWER", is_covered: true, parts_included: false },
      { service_line: "CLEANING_JANITORIAL", is_covered: true, parts_included: false },
      { service_line: "SECURITY_PATROL", is_covered: true, parts_included: false },
      { service_line: "FIRE_SAFETY_SYSTEMS", is_covered: true, parts_included: false },
      { service_line: "PEST_CONTROL", is_covered: true, parts_included: false }
    ]
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
      const [clientRes, propRes] = await Promise.all([
        api.get("/sales/customers").catch(() => ({ data: [] })),
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } }))
      ]);
      const cList = Array.isArray(clientRes.data) ? clientRes.data : clientRes.data?.items || [];
      setClients(cList);
      setProperties(propRes.data?.data || []);
    } catch {
      // Ignore
    }
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
      toast.success(`Finance Invoice generated: ${res.data?.invoice_no}`);
      setBillingContract(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate recurring invoice");
    } finally {
      setGeneratingBill(false);
    }
  };

  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c) => c.contract_status === "ACTIVE").length;
  const totalBilling = contracts.reduce((sum, c) => sum + (Number(c.billing_amount) || 0), 0);
  const totalPropertiesCovered = contracts.reduce((sum, c) => sum + (parseInt(c.property_count) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance?section=Facilities Management"
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Back to Facilities Management"
          >
            <ArrowLeft size={16} /> Back
          </Link>
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
          onClick={() => setShowModal(true)}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> New Service Contract
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Service Contracts</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalContracts}</span>
            <span className="badge badge-sm badge-info">Total</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Agreements</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeContracts}</span>
            <span className="badge badge-sm badge-success">SLA Active</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recurring Monthly</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">₵{totalBilling.toLocaleString()}</span>
            <span className="badge badge-sm badge-ghost">Billable</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Covered Sites</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalPropertiesCovered}</span>
            <span className="badge badge-sm badge-primary">Locations</span>
          </div>
        </div>
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

      {/* Contracts Table */}
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
            onClick={() => setShowModal(true)}
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
                  <th className="py-3 px-4">SLA Targets</th>
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
                    <td className="py-3 px-4 text-xs">
                      <div className="text-red-600 dark:text-red-400 font-mono">
                        Critical: {ctr.sla_critical_response_hours}h resp / {ctr.sla_critical_resolution_hours}h res
                      </div>
                      <div className="text-slate-400 font-mono">
                        Standard: {ctr.sla_standard_response_hours}h resp / {ctr.sla_standard_resolution_hours}h res
                      </div>
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
                      <button
                        onClick={() => { setBillingContract(ctr); setBillingPeriod(`Monthly FM Fee (${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})`); }}
                        className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                        title="Generate Finance Invoice"
                      >
                        <Receipt size={13} />
                        Invoice Client
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                Generate Recurring Contract Invoice
              </h3>
              <button onClick={() => setBillingContract(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerateInvoice} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium">Contract Title</label>
                <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm mt-0.5">
                  {billingContract.contract_title}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Client:</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{billingContract.client_name}</p>
                </div>
                <div>
                  <span className="text-slate-400">Recurring Amount:</span>
                  <p className="font-bold text-emerald-600">₵{Number(billingContract.billing_amount).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="label mb-1">Billing Period Description</label>
                <input
                  type="text"
                  className="input w-full"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. October 2026 Monthly Maintenance"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setBillingContract(null)} className="btn btn-secondary text-xs px-3 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={generatingBill} className="btn btn-primary text-xs px-4 py-2 font-medium">
                  {generatingBill ? "Generating..." : "Generate Invoice to Finance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                Create Facilities Management Service Contract
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label mb-1">Contract Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Total Facilities Management & SLA Agreement"
                    value={formData.contract_title}
                    onChange={(e) => setFormData({ ...formData, contract_title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">Client Organization <span className="text-red-500">*</span></label>
                  <select
                    className="input w-full"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    required
                  >
                    <option value="">Select Client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.customer_name || c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label mb-1">Covered Property</label>
                  <select
                    className="input w-full"
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id && !formData.property_ids.includes(id)) {
                        setFormData({ ...formData, property_ids: [...formData.property_ids, id] });
                      }
                    }}
                  >
                    <option value="">Add Property to Coverage...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name} ({p.property_code})</option>
                    ))}
                  </select>
                  {formData.property_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.property_ids.map((pid) => {
                        const prop = properties.find((p) => p.id === pid);
                        return (
                          <span key={pid} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200">
                            {prop?.property_name || `Property #${pid}`}
                            <button type="button" onClick={() => setFormData({ ...formData, property_ids: formData.property_ids.filter((x) => x !== pid) })} className="hover:text-red-500">×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="input w-full"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="input w-full"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">Billing Frequency</label>
                  <select
                    className="input w-full"
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
                  <label className="label mb-1">Recurring Billing Amount (₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full font-mono"
                    placeholder="e.g. 15000.00"
                    value={formData.billing_amount}
                    onChange={(e) => setFormData({ ...formData, billing_amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">Critical Response SLA (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input w-full font-mono"
                    value={formData.sla_critical_response_hours}
                    onChange={(e) => setFormData({ ...formData, sla_critical_response_hours: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">Critical Resolution SLA (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input w-full font-mono"
                    value={formData.sla_critical_resolution_hours}
                    onChange={(e) => setFormData({ ...formData, sla_critical_resolution_hours: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-sm px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-sm px-5 py-2 font-medium">
                  {submitting ? "Creating..." : "Save Contract & SLAs"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

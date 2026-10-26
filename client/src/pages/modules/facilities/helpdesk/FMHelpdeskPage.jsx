import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Headphones, Plus, Filter, RefreshCw, ArrowLeft,
  TicketCheck, AlertCircle, Clock, ShieldOff, MessageSquarePlus,
  ChevronDown, Search, Eye, Edit, X
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// ─── Helpers ────────────────────────────────────────────────────────────────

const SLA_COLORS = {
  BREACHED:  "bg-rose-100   text-rose-700   dark:bg-rose-950   dark:text-rose-300",
  AT_RISK:   "bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300",
  ON_TRACK:  "bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300",
  MET:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const STATUS_COLORS = {
  NEW:         "bg-slate-100  text-slate-700  dark:bg-slate-800 dark:text-slate-300",
  TRIAGED:     "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  ASSIGNED:    "bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300",
  RESOLVED:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED:      "bg-slate-100  text-slate-500  dark:bg-slate-800 dark:text-slate-400",
};

const PRIORITY_COLORS = {
  LOW:       "bg-slate-100  text-slate-600  dark:bg-slate-800 dark:text-slate-300",
  MEDIUM:    "bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300",
  HIGH:      "bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300",
  CRITICAL:  "bg-rose-100   text-rose-700   dark:bg-rose-950   dark:text-rose-300",
  EMERGENCY: "bg-rose-200   text-rose-900   dark:bg-rose-900   dark:text-rose-100",
};

const TAB_STATUSES = {
  all:         [],
  triage:      ["NEW", "TRIAGED"],
  in_progress: ["ASSIGNED", "IN_PROGRESS"],
  resolved:    ["RESOLVED", "CLOSED"],
};

const SERVICE_CATEGORIES = [
  { value: "HVAC_AIR_CONDITIONING",  label: "HVAC / Air Conditioning" },
  { value: "PLUMBING",               label: "Plumbing" },
  { value: "ELECTRICAL",             label: "Electrical" },
  { value: "CLEANING_JANITORIAL",    label: "Cleaning / Janitorial" },
  { value: "SECURITY_PATROL",        label: "Security / Patrol" },
  { value: "FIRE_SAFETY_SYSTEMS",    label: "Fire Safety Systems" },
  { value: "ELEVATORS_ESCALATORS",   label: "Elevators / Escalators" },
  { value: "GENERATOR_POWER",        label: "Generator / Power" },
  { value: "STRUCTURAL_CIVIL",       label: "Structural / Civil Works" },
  { value: "PEST_CONTROL",           label: "Pest Control" },
  { value: "LANDSCAPING",            label: "Landscaping" },
  { value: "GENERAL_FACILITIES",     label: "General Facilities" },
];

// ─── Initial Form States ─────────────────────────────────────────────────────

const getInitialTicketForm = () => ({
  property_id: "",
  service_category: "",
  subject: "",
  description: "",
  priority: "",
  requester_name: "",
  requester_phone: "",
  source_channel: "",
  sla_target_hours: "",
});

const getInitialStatusForm = () => ({
  status: "",
  resolution_notes: "",
});

const getInitialNoteForm = () => ({
  user_name: "",
  note_type: "INTERNAL",
  note_text: "",
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function FMHelpdeskPage() {
  const navigate = useNavigate();

  // Data
  const [properties, setProperties] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState("all");
  const [filterProperty, setFilterProperty] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);

  // Forms
  const [ticketForm, setTicketForm] = useState(getInitialTicketForm());
  const [slaUnit, setSlaUnit] = useState("HOURS"); // "HOURS" | "DAYS"
  const [slaValue, setSlaValue] = useState("");
  const [statusForm, setStatusForm] = useState(getInitialStatusForm());
  const [noteForm, setNoteForm] = useState(getInitialNoteForm());
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteSection, setShowNoteSection] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  }, []);

  const fetchServiceCategories = useCallback(async () => {
    try {
      const res = await api.get("/facilities/setup/categories");
      setServiceCategories(res.data?.data || []);
    } catch {
      setServiceCategories([]);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get("/facilities/helpdesk/dashboard");
      setDashboard(res.data?.data || null);
    } catch {}
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const tabStatuses = TAB_STATUSES[activeTab];
      if (tabStatuses && tabStatuses.length === 1) params.set("status", tabStatuses[0]);
      if (tabStatuses && tabStatuses.length > 1)   params.set("status", tabStatuses.join(","));
      if (filterProperty) params.set("propertyId", filterProperty);
      if (filterPriority) params.set("priority", filterPriority);
      if (searchQuery)    params.set("search", searchQuery);

      const res = await api.get(`/facilities/helpdesk/tickets?${params.toString()}`);
      setTickets(res.data?.data || []);
    } catch {
      toast.error("Failed to load helpdesk tickets");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterProperty, filterPriority, searchQuery]);

  useEffect(() => {
    fetchProperties();
    fetchServiceCategories();
    fetchDashboard();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openViewModal = (ticket) => {
    setActiveTicket(ticket);
    setShowViewModal(true);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/helpdesk/tickets", ticketForm);
      toast.success("Service request raised successfully");
      setShowCreateModal(false);
      setTicketForm(getInitialTicketForm());
      setSlaValue("");
      fetchTickets();
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to raise ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!statusForm.status) {
      toast.warn("Please select a new status");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/facilities/helpdesk/tickets/${activeTicket.id}`, {
        status: statusForm.status,
        resolution_notes: statusForm.resolution_notes,
      });
      toast.success("Ticket status updated");
      setShowStatusModal(false);
      setStatusForm(getInitialStatusForm());
      setShowNoteSection(false);
      fetchTickets();
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteForm.note_text.trim()) {
      toast.warn("Note text cannot be empty");
      return;
    }
    setAddingNote(true);
    try {
      await api.post(`/facilities/helpdesk/tickets/${activeTicket.id}/notes`, noteForm);
      toast.success("Note added to ticket");
      setNoteForm(getInitialNoteForm());
      setShowNoteSection(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const openStatusModal = (ticket) => {
    setActiveTicket(ticket);
    setStatusForm({ status: ticket.status || "", resolution_notes: "" });
    setNoteForm(getInitialNoteForm());
    setShowNoteSection(false);
    setShowStatusModal(true);
  };

  // ── Derived counts ─────────────────────────────────────────────────────────

  const summary = dashboard?.summary || {};

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              FM Helpdesk &amp; Service Requests
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Log, triage, track and resolve all facilities service requests with SLA monitoring.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setTicketForm(getInitialTicketForm());
            setSlaValue("");
            setShowCreateModal(true);
          }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Raise Ticket
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <TicketCheck size={15} className="text-indigo-500" /> Total Tickets
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{summary.total_tickets ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <Clock size={15} className="text-amber-500" /> Open Tickets
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{summary.open_tickets ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <AlertCircle size={15} className="text-rose-500" /> Critical Open
          </div>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{summary.critical_open ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <ShieldOff size={15} className="text-rose-500" /> SLA Breached
          </div>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{summary.sla_breached ?? "—"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto">
        {[
          { key: "all",         label: "All Tickets" },
          { key: "triage",      label: "New & Triaged" },
          { key: "in_progress", label: "In Progress" },
          { key: "resolved",    label: "Resolved" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap text-xs shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Filter size={13} /> Filters:
          </span>
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-44"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setFilterProperty("");
            setFilterPriority("");
            setSearchQuery("");
          }}
          className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-14 text-center space-y-2">
            <TicketCheck size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Tickets Found</p>
            <p className="text-xs text-slate-400">Adjust your filters or raise a new service request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Ticket No</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Requester</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">SLA Status</th>
                  <th className="px-3 py-3">SLA Due</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      {ticket.ticket_no}
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">{ticket.subject}</span>
                      <span className="text-[10px] text-slate-400 block">{ticket.service_category?.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority] || "bg-slate-100 text-slate-600"}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{ticket.property_name || "—"}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-slate-700 dark:text-slate-200 block">{ticket.requester_name}</span>
                      <span className="text-[10px] text-slate-400">{ticket.requester_phone}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[ticket.status] || "bg-slate-100 text-slate-600"}`}>
                        {ticket.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SLA_COLORS[ticket.computed_sla_status] || "bg-slate-100 text-slate-600"}`}>
                        {ticket.computed_sla_status?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className={`px-3 py-3 font-mono text-[11px] whitespace-nowrap ${
                      ticket.computed_sla_status === "BREACHED" ? "text-rose-600 font-bold" : "text-slate-500"
                    }`}>
                      {ticket.sla_due_at ? String(ticket.sla_due_at).slice(0, 16) : "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {ticket.created_at ? String(ticket.created_at).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openViewModal(ticket)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          title="View Ticket Details"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => openStatusModal(ticket)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          title="Update Status & Notes"
                        >
                          <Edit size={12} />
                          Edit / Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Raise Ticket ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-3xl lg:max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-indigo-500" />
                Raise Service Request
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Property */}
                <div>
                  <label className="block font-semibold mb-1">Property <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={ticketForm.property_id}
                    onChange={(e) => setTicketForm({ ...ticketForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="">Select property...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Category (populated from Operations Setup) */}
                <div>
                  <label className="block font-semibold mb-1">Service Category <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={ticketForm.service_category}
                    onChange={(e) => setTicketForm({ ...ticketForm, service_category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="">Select category...</option>
                    {serviceCategories.length > 0 ? (
                      serviceCategories.map((c) => (
                        <option key={c.id || c.category_code} value={c.category_name || c.category_code}>
                          {c.category_name} {c.category_code ? `(${c.category_code})` : ""}
                        </option>
                      ))
                    ) : (
                      SERVICE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block font-semibold mb-1">Subject <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="e.g. AC unit not cooling — Floor 3 Server Room"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold mb-1">Description <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide a detailed description of the issue or request..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Priority & Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Priority <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="">Select priority...</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Source Channel <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={ticketForm.source_channel}
                    onChange={(e) => setTicketForm({ ...ticketForm, source_channel: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="">Select channel...</option>
                    <option value="WEB_PORTAL">Web Portal</option>
                    <option value="PHONE">Phone</option>
                    <option value="EMAIL">Email</option>
                    <option value="WALK_IN">Walk-In</option>
                  </select>
                </div>
              </div>

              {/* Requester Name & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Requester Name <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Kwame Asante"
                    value={ticketForm.requester_name}
                    onChange={(e) => setTicketForm({ ...ticketForm, requester_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Requester Phone <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. +233 24 000 0000"
                    value={ticketForm.requester_phone}
                    onChange={(e) => setTicketForm({ ...ticketForm, requester_phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              {/* SLA Target (Hours or Days) */}
              <div>
                <label className="block font-semibold mb-1">
                  SLA Target Duration <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    type="number"
                    value={slaValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlaValue(val);
                      const num = val === "" ? "" : Number(val);
                      setTicketForm({
                        ...ticketForm,
                        sla_target_hours: num === "" ? "" : (slaUnit === "DAYS" ? num * 24 : num),
                      });
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-mono"
                    placeholder="e.g. 24"
                  />
                  <select
                    value={slaUnit}
                    onChange={(e) => {
                      const unit = e.target.value;
                      setSlaUnit(unit);
                      const num = slaValue === "" ? "" : Number(slaValue);
                      setTicketForm({
                        ...ticketForm,
                        sla_target_hours: num === "" ? "" : (unit === "DAYS" ? num * 24 : num),
                      });
                    }}
                    className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold"
                  >
                    <option value="HOURS">Hours</option>
                    <option value="DAYS">Days</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Total duration: <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">{ticketForm.sla_target_hours || 0} hours</span> {slaValue !== "" ? (slaUnit === "DAYS" ? `(${slaValue} days)` : `(${(!isNaN(Number(slaValue)) ? (Number(slaValue) / 24).toFixed(1) : 0)} days)`) : ""}
                </p>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Raising..." : "Raise Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Update Status (Properties/Asset style centered modal) ──────── */}
      {showStatusModal && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ChevronDown size={18} className="text-indigo-500" />
                Update Ticket — {activeTicket.ticket_no}
              </h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Ticket info strip */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
                <p className="font-bold text-slate-800 dark:text-white">{activeTicket.subject}</p>
                <p className="text-slate-500 dark:text-slate-400">{activeTicket.property_name} · {activeTicket.requester_name}</p>
                <div className="flex gap-2 pt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[activeTicket.priority] || ""}`}>
                    {activeTicket.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SLA_COLORS[activeTicket.computed_sla_status] || ""}`}>
                    SLA: {activeTicket.computed_sla_status?.replace(/_/g, " ") || "—"}
                  </span>
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div>
                  <label className="block font-semibold mb-1">New Status <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={statusForm.status}
                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="">Select status...</option>
                    <option value="NEW">New</option>
                    <option value="TRIAGED">Triaged</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Resolution / Update Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Describe action taken, parts replaced, work done, etc..."
                    value={statusForm.resolution_notes}
                    onChange={(e) => setStatusForm({ ...statusForm, resolution_notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Update Status"}
                  </button>
                </div>
              </form>

              {/* Add Note Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNoteSection((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  <MessageSquarePlus size={14} />
                  {showNoteSection ? "Hide Note Form" : "Add Internal Note"}
                </button>

                {showNoteSection && (
                  <form onSubmit={handleAddNote} className="mt-3 space-y-3">
                    <div>
                      <label className="block font-semibold mb-1">Your Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ama Owusu (Technician)"
                        value={noteForm.user_name}
                        onChange={(e) => setNoteForm({ ...noteForm, user_name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Note <span className="text-rose-500">*</span></label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Internal note visible only to the facilities team..."
                        value={noteForm.note_text}
                        onChange={(e) => setNoteForm({ ...noteForm, note_text: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={addingNote}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60"
                      >
                        {addingNote ? "Posting..." : "Post Note"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Ticket Details (Properties/Asset style centered modal) ─ */}
      {showViewModal && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <TicketCheck size={18} className="text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ticket Details — {activeTicket.ticket_no}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeTicket.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Service Category</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeTicket.service_category?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${STATUS_COLORS[activeTicket.status] || ""}`}>
                    {activeTicket.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Priority</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${PRIORITY_COLORS[activeTicket.priority] || ""}`}>
                    {activeTicket.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">SLA Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${SLA_COLORS[activeTicket.computed_sla_status] || ""}`}>
                    {activeTicket.computed_sla_status?.replace(/_/g, " ") || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">SLA Target Due</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{activeTicket.sla_due_at ? String(activeTicket.sla_due_at).slice(0, 16) : "—"}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Subject</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{activeTicket.subject}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Description</span>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {activeTicket.description || "No description provided."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Requester Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeTicket.requester_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Requester Phone</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{activeTicket.requester_phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Source Channel</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeTicket.source_channel || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Created At</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{activeTicket.created_at ? String(activeTicket.created_at).slice(0, 16) : "—"}</span>
                </div>
              </div>

              {activeTicket.resolution_notes && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Resolution / Work Notes</span>
                  <p className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-xl leading-relaxed">
                    {activeTicket.resolution_notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    openStatusModal(activeTicket);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Update Status / Add Note
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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

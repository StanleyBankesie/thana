import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Calendar, Plus, ArrowLeft,
  Building2, DoorOpen, Clock, CheckCircle, MapPin,
  Eye, FileText, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SpaceOccupancyPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("bookings"); // "bookings" | "tenants" | "spaces"
  const [properties, setProperties] = useState([]);
  const [spaces, setSpaces] = useState([]);

  const [bookings, setBookings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [viewingTenant, setViewingTenant] = useState(null);
  const [viewingSpace, setViewingSpace] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms - clean initial states (no prefilled values)
  const getInitialBookingForm = () => ({
    property_id: "",
    space_or_room_name: "",
    booked_by_name: "",
    department_or_tenant: "",
    booking_date: "",
    start_time: "",
    end_time: "",
    purpose: "",
    attendees_count: "",
  });

  const getInitialTenantForm = () => ({
    property_id: "",
    tenant_name: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    allocated_space_sqm: "",
    occupied_rooms_or_units: "",
    headcount: "",
    lease_start_date: "",
    lease_end_date: "",
    monthly_service_charge: "",
  });

  const [bookingForm, setBookingForm] = useState(getInitialBookingForm());
  const [tenantForm, setTenantForm] = useState(getInitialTenantForm());

  useEffect(() => {
    fetchPropertiesAndSpaces();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchPropertiesAndSpaces = async () => {
    try {
      const [propRes, spaceRes] = await Promise.all([
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
        api.get("/facilities/spaces").catch(() => ({ data: { data: [] } })),
      ]);
      const propList = propRes.data?.data || [];
      const spaceList = spaceRes.data?.data || [];
      setProperties(propList);
      setSpaces(spaceList);

      if (propList.length > 0) {
        setBookingForm((b) => ({ ...b, property_id: propList[0].id }));
        setTenantForm((t) => ({ ...t, property_id: propList[0].id }));
      }
      if (spaceList.length > 0) {
        setBookingForm((b) => ({
          ...b,
          space_or_room_name: `${spaceList[0].space_name} (${spaceList[0].floor_zone || "Main"} - ${spaceList[0].capacity || 0} seats)`,
        }));
      } else {
        setBookingForm((b) => ({
          ...b,
          space_or_room_name: "Executive Boardroom (Floor 3 - 16 seats)",
        }));
      }
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "bookings") {
        const res = await api.get("/facilities/space/room-bookings");
        setBookings(res.data?.data || []);
      } else if (activeTab === "tenants") {
        const res = await api.get("/facilities/space/tenants");
        setTenants(res.data?.data || []);
      } else if (activeTab === "spaces") {
        const res = await api.get("/facilities/spaces");
        setSpaces(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.booked_by_name.trim() || !bookingForm.purpose.trim()) {
      toast.warn("Please enter booker name and meeting purpose.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/facilities/space/room-bookings", bookingForm);
      toast.success("Room reservation confirmed successfully!");
      setShowBookingModal(false);
      setBookingForm(getInitialBookingForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to book room");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!tenantForm.tenant_name.trim()) {
      toast.warn("Tenant company name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/facilities/space/tenants", tenantForm);
      toast.success("Tenant and space allocation registered!");
      setShowTenantModal(false);
      setTenantForm(getInitialTenantForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register tenant");
    } finally {
      setSubmitting(false);
    }
  };

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
              <DoorOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Space and Occupancy Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Managing office layouts, room bookings, tenant or occupant records, occupancy rates, space allocation and utilisation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "bookings" && (
            <button
              onClick={() => {
                setBookingForm(getInitialBookingForm());
                setShowBookingModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Book Meeting Room / Space
            </button>
          )}
          {activeTab === "tenants" && (
            <button
              onClick={() => {
                setTenantForm(getInitialTenantForm());
                setShowTenantModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Register Tenant / Occupant
            </button>
          )}
          {activeTab === "spaces" && (
            <button
              onClick={() => navigate("/facilities/setup")}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Configure Spaces in Operations Setup
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "bookings"
              ? "border-purple-500 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar size={14} />
          Meeting Room & Facility Bookings ({bookings.length})
        </button>

        <button
          onClick={() => setActiveTab("tenants")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "tenants"
              ? "border-purple-500 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users size={14} />
          Tenants, Occupants & Space Allocation ({tenants.length})
        </button>

        <button
          onClick={() => setActiveTab("spaces")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "spaces"
              ? "border-purple-500 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <DoorOpen size={14} />
          Configured Rooms & Spaces ({spaces.length})
        </button>
      </div>

      {/* TAB 1: ROOM BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Room / Space</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Booked By</th>
                  <th className="px-3 py-3">Department / Tenant</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Time Window</th>
                  <th className="px-3 py-3">Purpose</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <DoorOpen size={14} className="text-purple-500" />
                      <span>{b.space_or_room_name}</span>
                    </td>
                    <td className="px-3 py-3">{b.property_name || "Headquarters"}</td>
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">{b.booked_by_name}</td>
                    <td className="px-3 py-3">{b.department_or_tenant}</td>
                    <td className="px-3 py-3 font-mono">{String(b.booking_date).slice(0, 10)}</td>
                    <td className="px-3 py-3 font-mono font-bold text-purple-600">
                      {String(b.start_time).slice(0, 5)} - {String(b.end_time).slice(0, 5)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{b.purpose}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingBooking(b)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Reservation Details"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TENANTS & OCCUPANCY */}
      {activeTab === "tenants" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Tenant / Occupant</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Occupied Units</th>
                  <th className="px-3 py-3">Allocated Area</th>
                  <th className="px-3 py-3">Headcount</th>
                  <th className="px-3 py-3">Lease Window</th>
                  <th className="px-3 py-3">Service Charge</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-white block">{t.tenant_name}</span>
                      <span className="text-[11px] text-slate-400 block">{t.contact_person} ({t.contact_phone || "—"})</span>
                    </td>
                    <td className="px-3 py-3">{t.property_name || "Main Tower"}</td>
                    <td className="px-3 py-3 font-semibold">{t.occupied_rooms_or_units}</td>
                    <td className="px-3 py-3 font-mono font-bold text-emerald-600">{t.allocated_space_sqm} m²</td>
                    <td className="px-3 py-3 font-mono">{t.headcount} people</td>
                    <td className="px-3 py-3 font-mono text-[11px]">
                      {String(t.lease_start_date).slice(0, 10)} to {String(t.lease_end_date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 font-mono font-bold">
                      GHS {parseFloat(t.monthly_service_charge).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {t.occupancy_status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingTenant(t)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Tenant & Lease Allocation"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURABLE ROOMS & SPACES DISPLAY (Set in Operations Setup) */}
      {activeTab === "spaces" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-purple-600" /> Configured Rooms & Spaces
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical layout spaces configured in Facilities Operations Setup. Available for booking and room reservation.
              </p>
            </div>
            <button
              onClick={() => navigate("/facilities/setup")}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Plus size={13} /> Manage in Setup
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[200px]">Room / Space Name</th>
                  <th className="p-3">Space Code</th>
                  <th className="p-3">Property</th>
                  <th className="p-3">Space Type</th>
                  <th className="p-3">Floor / Zone</th>
                  <th className="p-3 text-right">Capacity</th>
                  <th className="p-3 text-right">Area (m²)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {spaces.map((sp, idx) => (
                  <tr key={sp.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <DoorOpen size={14} className="text-purple-500" />
                      <span>{sp.space_name}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">{sp.space_code || "—"}</td>
                    <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                      {sp.property_name || "Portfolio Estate"}
                    </td>
                    <td className="p-3 capitalize">{String(sp.space_type || "MEETING_ROOM").replace(/_/g, " ")}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{sp.floor_zone || "Main Floor"}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {sp.capacity || 0} seats
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {sp.area_sqm ? `${sp.area_sqm} m²` : "—"}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {sp.is_active !== 0 ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setViewingSpace(sp)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Space Configuration"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
                {spaces.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-10 text-slate-400 italic">
                      No rooms or spaces configured in Operations Setup yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: BOOK ROOM (Top Aligned max-w-4xl lg:max-w-5xl) */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-purple-600" />
                Reserve Meeting Room or Space
              </h3>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBooking} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property / Facility</label>
                  <select
                    value={bookingForm.property_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Room / Space Name (Configured in Setup) *</label>
                  <select
                    value={bookingForm.space_or_room_name}
                    onChange={(e) => setBookingForm({ ...bookingForm, space_or_room_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-semibold"
                  >
                    {spaces.length > 0 ? (
                      spaces.map((sp) => (
                        <option
                          key={sp.id}
                          value={`${sp.space_name} (${sp.floor_zone ? `${sp.floor_zone} • ` : ""}${sp.capacity || 0} seats)`}
                        >
                          {sp.space_name} ({sp.floor_zone ? `${sp.floor_zone} • ` : ""}{sp.capacity || 0} seats • {sp.property_name || "Main Estate"})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Executive Boardroom (Floor 3 - 16 seats)">Executive Boardroom (Floor 3 - 16 seats)</option>
                        <option value="Conference Hall A (Ground Floor - 60 seats)">Conference Hall A (Ground Floor - 60 seats)</option>
                        <option value="Innovation Lab / Training Suite (25 seats)">Innovation Lab / Training Suite (25 seats)</option>
                        <option value="Meeting Room B (Floor 4 West - 8 seats)">Meeting Room B (Floor 4 West - 8 seats)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Booked By (Name) *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ama Serwaa"
                    value={bookingForm.booked_by_name}
                    onChange={(e) => setBookingForm({ ...bookingForm, booked_by_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Department / Tenant *</label>
                  <input
                    type="text"
                    placeholder="e.g. PwC Consulting"
                    value={bookingForm.department_or_tenant}
                    onChange={(e) => setBookingForm({ ...bookingForm, department_or_tenant: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Booking Date</label>
                  <input
                    type="date"
                    value={bookingForm.booking_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, booking_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={bookingForm.start_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={bookingForm.end_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Meeting Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Quarterly Client Audit Review"
                  value={bookingForm.purpose}
                  onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Booking..." : "Confirm Reservation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER TENANT (Top Aligned max-w-4xl lg:max-w-5xl) */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-purple-600" />
                Register Tenant & Allocate Space
              </h3>
              <button
                type="button"
                onClick={() => setShowTenantModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property / Facility</label>
                  <select
                    value={tenantForm.property_id}
                    onChange={(e) => setTenantForm({ ...tenantForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tenant Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard Chartered Bank"
                    value={tenantForm.tenant_name}
                    onChange={(e) => setTenantForm({ ...tenantForm, tenant_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Edward Quaye"
                    value={tenantForm.contact_person}
                    onChange={(e) => setTenantForm({ ...tenantForm, contact_person: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 100 2000"
                    value={tenantForm.contact_phone}
                    onChange={(e) => setTenantForm({ ...tenantForm, contact_phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Allocated Space (m²) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tenantForm.allocated_space_sqm}
                    onChange={(e) => setTenantForm({ ...tenantForm, allocated_space_sqm: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Occupied Units / Rooms *</label>
                  <input
                    type="text"
                    placeholder="e.g. Floors 2 & 3"
                    value={tenantForm.occupied_rooms_or_units}
                    onChange={(e) => setTenantForm({ ...tenantForm, occupied_rooms_or_units: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Lease Start Date</label>
                  <input
                    type="date"
                    value={tenantForm.lease_start_date}
                    onChange={(e) => setTenantForm({ ...tenantForm, lease_start_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Monthly Service Charge (GHS)</label>
                  <input
                    type="number"
                    value={tenantForm.monthly_service_charge}
                    onChange={(e) => setTenantForm({ ...tenantForm, monthly_service_charge: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Register Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW BOOKING */}
      {viewingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DoorOpen size={17} className="text-purple-500" />
                Meeting Room Reservation Details
              </h3>
              <button onClick={() => setViewingBooking(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Space / Room</span>
                  <span className="font-bold text-purple-600 text-xs">{viewingBooking.space_or_room_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingBooking.property_name || "Headquarters"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Booked By</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingBooking.booked_by_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Department / Tenant</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{viewingBooking.department_or_tenant || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Reservation Date</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{String(viewingBooking.booking_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Time Window</span>
                  <span className="font-mono font-bold text-purple-600 text-xs">
                    {String(viewingBooking.start_time).slice(0, 5)} - {String(viewingBooking.end_time).slice(0, 5)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Attendees Count</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingBooking.attendees_count || "—"} attendees</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingBooking.status}
                  </span>
                </div>
              </div>

              {viewingBooking.purpose && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Meeting Purpose:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingBooking.purpose}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingBooking(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW TENANT */}
      {viewingTenant && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={17} className="text-purple-500" />
                {viewingTenant.tenant_name}
              </h3>
              <button onClick={() => setViewingTenant(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingTenant.property_name || "Main Tower"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingTenant.occupancy_status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Occupied Units / Rooms</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingTenant.occupied_rooms_or_units}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Allocated Area</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">{viewingTenant.allocated_space_sqm} m²</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Headcount</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingTenant.headcount} people</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Monthly Service Charge</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    GHS {parseFloat(viewingTenant.monthly_service_charge).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Lease Start</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingTenant.lease_start_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Lease End</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingTenant.lease_end_date).slice(0, 10)}</span>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/50 space-y-1">
                <span className="font-bold text-purple-900 dark:text-purple-300 text-xs block">Contact Information</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Contact Person:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingTenant.contact_person || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Phone:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{viewingTenant.contact_phone || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Email:</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingTenant.contact_email || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingTenant(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW SPACE */}
      {viewingSpace && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingSpace.space_code}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DoorOpen size={17} className="text-purple-500" />
                  {viewingSpace.space_name}
                </h3>
              </div>
              <button onClick={() => setViewingSpace(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingSpace.property_name || "Portfolio Estate"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Space Type</span>
                  <span className="font-bold text-purple-600 text-xs capitalize">{String(viewingSpace.space_type || "MEETING_ROOM").replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Floor / Zone</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{viewingSpace.floor_zone || "Main Floor"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Seating Capacity</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingSpace.capacity || 0} seats</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Floor Area</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">{viewingSpace.area_sqm ? `${viewingSpace.area_sqm} m²` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingSpace.is_active !== 0 ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {viewingSpace.description && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Space Description & Amenities:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingSpace.description}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setViewingSpace(null);
                  navigate("/facilities/setup");
                }}
                className="btn btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
              >
                <Edit size={12} /> Edit in Setup
              </button>
              <button
                type="button"
                onClick={() => setViewingSpace(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

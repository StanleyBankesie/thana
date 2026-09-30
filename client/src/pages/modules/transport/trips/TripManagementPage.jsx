import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EnvironmentOutlined, ArrowLeftOutlined, EditOutlined, PlayCircleOutlined, CheckCircleOutlined, UserOutlined, SwapOutlined, CarOutlined, SearchOutlined, CompassOutlined, UnorderedListOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "@/auth/AuthContext.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { useGpsTracking } from "@/context/GpsTrackingContext.jsx";
import GlobalLiveTrackingMap from "./GlobalLiveTrackingMap.jsx";

export default function TripManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasExceptional } = usePermission();

  const [trips, setTrips] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [startTripModal, setStartTripModal] = useState({ open: false, tripId: null, odometer: "" });
  const [endTripModal, setEndTripModal] = useState({ open: false, tripId: null, odometer: "" });
  const [reassignModal, setReassignModal] = useState({ open: false, tripId: null, driverId: "" });
  const [reassigning, setReassigning] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'
  const gps = useGpsTracking();

  // Exceptional permission check for reassigning trips
  const canReassignTrip = Boolean(
    user?.is_super_admin ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.id === 1 ||
    hasExceptional("TRANSPORT.TRIP.REASSIGN") ||
    hasExceptional("TRIP.REASSIGN") ||
    hasExceptional("TRANSPORT.REASSIGN")
  );

  // Auto-start GPS for active trips via global context
  useEffect(() => {
    if (!gps) return;
    trips.forEach(trip => {
      if (['STARTED', 'IN_TRANSIT'].includes(trip.status?.toUpperCase())) {
        if (!gps.isTracking(trip.id)) {
          gps.startTracking(trip.id, trip.vehicle_id);
        }
      }
    });
  }, [trips, gps]);

  const handleStartTrip = async () => {
    if (!startTripModal.odometer) {
      toast.error("Please enter current odometer reading");
      return;
    }
    
    // Attempt to get GPS first
    let lat = null;
    let lng = null;
    
    if (navigator.geolocation) {
      toast.info("Capturing current GPS location...", { autoClose: 1500, toastId: "start-loc" });
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn("Could not capture GPS on start", e);
        toast.warning("Could not capture GPS location. Starting trip anyway.");
      }
    }

    try {
      const tripId = startTripModal.tripId;
      await api.put(`/transport/trips/${tripId}/start`, { 
        start_odometer: startTripModal.odometer,
        latitude: lat,
        longitude: lng
      });
      toast.success("Trip started successfully");
      if (gps) gps.startTracking(tripId, null);
      setStartTripModal({ open: false, tripId: null, odometer: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start trip");
    }
  };

  const handleEndTripSubmit = async () => {
    try {
      const tripId = endTripModal.tripId;
      await api.put(`/transport/trips/${tripId}/return`, { end_time: new Date().toISOString(), end_odometer: endTripModal.odometer });
      toast.success("Trip ended successfully");
      if (gps) gps.stopTracking(tripId);
      setEndTripModal({ open: false, tripId: null, odometer: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to end trip");
    }
  };

  const handleReassignTrip = async () => {
    if (!canReassignTrip) {
      toast.error("Exceptional permission (TRANSPORT.TRIP.REASSIGN) is required to reassign trips.");
      return;
    }
    if (!reassignModal.tripId || !reassignModal.driverId) {
      toast.error("Please select a target driver for trip reassignment");
      return;
    }

    setReassigning(true);
    try {
      await api.put(`/transport/trips/${reassignModal.tripId}`, {
        driver_id: reassignModal.driverId
      });
      toast.success("Trip reassigned successfully");
      setReassignModal({ open: false, tripId: null, driverId: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reassign trip");
    } finally {
      setReassigning(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, driversRes] = await Promise.all([
        api.get("/transport/trips"),
        api.get("/transport/drivers").catch(() => ({ data: { data: { items: [] } } }))
      ]);

      const allTrips = tripsRes.data?.data?.items || tripsRes.data?.items || [];
      const drivers = driversRes.data?.data?.items || driversRes.data?.items || [];
      setDriversList(drivers);
      
      // Filter for active trip statuses
      const activeStatuses = ['SCHEDULED', 'PENDING', 'STARTED', 'IN_TRANSIT'];
      let activeTrips = allTrips.filter(t => activeStatuses.includes(t.status?.toUpperCase() || 'SCHEDULED'));

      // Strict Driver User Isolation: Unless admin/exceptional permission, driver only sees trips assigned to their linked user ID
      const currentUserId = user?.id || user?.sub;
      const isAdmin = Boolean(user?.is_super_admin || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.id === 1);

      if (!isAdmin && !canReassignTrip && currentUserId) {
        activeTrips = activeTrips.filter((t) => {
          return String(t.driver_user_id) === String(currentUserId) || String(t.created_by) === String(currentUserId);
        });
      }
      
      setTrips(activeTrips);
    } catch (err) {
      toast.error("Failed to fetch trips data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  // Compute filtered trips based on status filter and search term
  const filteredTrips = trips.filter((t) => {
    const matchesSearch =
      (t.trip_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.employee_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.reg_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.origin_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.destination_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const st = (t.status || "SCHEDULED").toUpperCase();
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SCHEDULED" && (st === "SCHEDULED" || st === "PENDING")) ||
      (statusFilter === "ACTIVE" && (st === "STARTED" || st === "IN_TRANSIT"));
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
        {/* Responsive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div>
            <button 
              onClick={() => navigate("/transport")}
              className="text-slate-400 hover:text-white flex items-center gap-2 mb-1.5 transition-colors text-xs sm:text-sm font-medium"
            >
              <ArrowLeftOutlined /> Back to Transport Menu
            </button>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <CarOutlined className="text-brand" /> Live Trip Management
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Monitoring active, scheduled, and in-transit trips
            </p>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold">
              Total: {trips.length}
            </span>
            <span className="bg-blue-950 border border-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded-xl font-bold">
              Active: {trips.filter(t => ['STARTED', 'IN_TRANSIT'].includes((t.status || '').toUpperCase())).length}
            </span>
          </div>
        </div>

        {/* Toolbar & Filters (Mobile Responsive) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 sm:p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {[
              { id: "ALL", label: "All Trips" },
              { id: "SCHEDULED", label: "Scheduled" },
              { id: "ACTIVE", label: "In-Transit" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? "bg-brand text-white shadow-md shadow-brand/20"
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              placeholder="Search trip #, driver, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-brand transition-colors placeholder:text-slate-500"
            />
            <SearchOutlined className="absolute left-3 top-2.5 text-slate-500 text-xs" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === "list" ? "bg-brand text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <UnorderedListOutlined /> List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === "map" ? "bg-brand text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <EnvironmentOutlined /> Map
            </button>
          </div>
        </div>

        {/* Trips Cards / Map Area */}
        {loading && trips.length === 0 ? (
          <div className="flex justify-center py-20 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <span className="loading loading-spinner loading-lg text-brand"></span>
              <p className="text-xs">Loading trips...</p>
            </div>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-16 border border-slate-800 rounded-2xl bg-slate-900/40 p-6 space-y-2">
            <CarOutlined className="text-3xl text-slate-600 mb-2" />
            <h3 className="text-base sm:text-lg font-bold text-slate-300">No Trips Found</h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              There are currently no active or scheduled trips matching your selected filter.
            </p>
          </div>
        ) : viewMode === "map" ? (
          <div className="w-full h-[600px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative">
            <GlobalLiveTrackingMap 
              activeTrips={filteredTrips.filter(t => ['SCHEDULED', 'STARTED', 'IN_TRANSIT'].includes(t.status?.toUpperCase()))} 
              height="100%" 
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredTrips.map((trip) => {
              const isActive = ['IN_TRANSIT', 'STARTED'].includes(trip.status?.toUpperCase());
              return (
                <div 
                  key={trip.id} 
                  className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-xl overflow-hidden flex flex-col hover:border-slate-700 transition-all"
                >
                  {/* Card Header */}
                  <div className={`px-4 py-3 border-b flex justify-between items-center ${
                    isActive 
                      ? 'bg-blue-950/40 border-blue-900/60' 
                      : 'bg-amber-950/30 border-amber-900/40'
                  }`}>
                    <span className="font-mono font-bold text-base sm:text-lg text-brand-300">
                      #{trip.trip_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                      isActive 
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' 
                        : 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    }`}>
                      {trip.status || 'SCHEDULED'}
                    </span>
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-4 sm:p-5 flex-1 space-y-4 text-xs sm:text-sm">
                    {/* Route Info */}
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Route Details</p>
                      <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                          <div className="w-0.5 h-7 bg-slate-700 my-0.5"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></div>
                        </div>
                        <div className="flex flex-col justify-between h-14 flex-1 overflow-hidden">
                          <span className="font-medium text-slate-200 truncate" title={trip.origin_name}>
                            {trip.origin_name || "Origin not set"}
                          </span>
                          <span className="font-medium text-slate-200 truncate" title={trip.destination_name}>
                            {trip.destination_name || "Destination not set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Driver & Vehicle Metadata */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                      <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-slate-400 font-medium">Driver</p>
                          {canReassignTrip && (
                            <button
                              onClick={() => setReassignModal({ open: true, tripId: trip.id, driverId: String(trip.driver_id || "") })}
                              className="text-[10px] text-brand hover:underline font-bold flex items-center gap-0.5"
                              title="Reassign Driver"
                            >
                              <SwapOutlined /> Swap
                            </button>
                          )}
                        </div>
                        <p className="font-bold text-slate-200 truncate" title={trip.employee_name}>
                          {trip.employee_name || 'Unassigned'}
                        </p>
                      </div>

                      <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                        <p className="text-[10px] text-slate-400 font-medium mb-1">Vehicle</p>
                        <p className="font-bold text-slate-200 truncate">
                          {trip.reg_number || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons (Responsive Grid) */}
                  <div className="bg-slate-950/80 px-4 py-3 flex flex-wrap gap-2 border-t border-slate-800">
                    {trip.status?.toUpperCase() === 'SCHEDULED' ? (
                      <button 
                        onClick={() => setStartTripModal({ open: true, tripId: trip.id, odometer: "" })}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-xs shadow-md shadow-emerald-950"
                      >
                        <PlayCircleOutlined /> Start Trip
                      </button>
                    ) : (
                      <>
                        <Link 
                          to={`/transport/tracking/${trip.id}`} 
                          className="flex-1 py-2 px-3 bg-brand hover:bg-brand-600 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-xs shadow-md shadow-brand/20 text-center"
                        >
                          <EnvironmentOutlined /> Live Map
                        </Link>
                      </>
                    )}
                    {trip.status?.toUpperCase() !== 'SCHEDULED' && (
                      <button 
                        onClick={() => setEndTripModal({ open: true, tripId: trip.id, odometer: "" })}
                        className="py-2 px-3 border border-rose-800/80 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs shrink-0"
                        title="End Trip"
                      >
                        <CheckCircleOutlined /> End Trip
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Start Trip Modal (Mobile Responsive) */}
      {startTripModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-brand flex items-center gap-2">
              <PlayCircleOutlined /> Start Trip Execution
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Current Odometer Reading <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number" 
                className="input input-bordered w-full bg-slate-950 border-slate-800 text-white text-xs sm:text-sm rounded-xl focus:border-brand focus:outline-none" 
                placeholder="e.g. 154000"
                value={startTripModal.odometer}
                onChange={e => setStartTripModal(prev => ({ ...prev, odometer: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
              <button 
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                onClick={() => setStartTripModal({ open: false, tripId: null, odometer: "" })}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 rounded-xl font-bold text-xs bg-brand text-white hover:bg-brand-600 transition-colors shadow-md"
                onClick={handleStartTrip}
              >
                Confirm & Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Trip Modal */}
      {endTripModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-brand flex items-center gap-2">
              <CheckCircleOutlined /> End Trip Execution
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Ending Odometer Reading <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number" 
                className="input input-bordered w-full bg-slate-950 border-slate-800 text-white text-xs sm:text-sm rounded-xl focus:border-brand focus:outline-none" 
                placeholder="e.g. 154500"
                value={endTripModal.odometer}
                onChange={e => setEndTripModal(prev => ({ ...prev, odometer: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
              <button 
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                onClick={() => setEndTripModal({ open: false, tripId: null, odometer: "" })}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 rounded-xl font-bold text-xs bg-brand text-white hover:bg-brand-600 transition-colors shadow-md"
                onClick={handleEndTripSubmit}
              >
                Confirm & End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Driver Modal (Mobile Responsive & Exceptional Permission Gated) */}
      {reassignModal.open && canReassignTrip && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-brand flex items-center gap-2">
              <SwapOutlined /> Reassign Trip Driver
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Select Target Driver <span className="text-rose-500">*</span>
              </label>
              <select
                className="select select-bordered w-full bg-slate-950 border-slate-800 text-white text-xs rounded-xl focus:border-brand focus:outline-none"
                value={reassignModal.driverId}
                onChange={(e) => setReassignModal(prev => ({ ...prev, driverId: e.target.value }))}
              >
                <option value="">Select Driver...</option>
                {driversList.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.employee_name || d.name || `Driver #${d.id}`} {d.license_number ? `(${d.license_number})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
              <button 
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                onClick={() => setReassignModal({ open: false, tripId: null, driverId: "" })}
              >
                Cancel
              </button>
              <button 
                disabled={reassigning || !reassignModal.driverId}
                className="px-4 py-2 rounded-xl font-bold text-xs bg-brand text-white hover:bg-brand-600 transition-colors shadow-md disabled:opacity-50"
                onClick={handleReassignTrip}
              >
                {reassigning ? "Reassigning..." : "Confirm Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

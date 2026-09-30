import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../../../../api/client.js";
import { io } from "socket.io-client";
import FleetSummaryCards from "../components/FleetSummaryCards";
import FleetListPanel from "../components/FleetListPanel";
import TripDetailsPanel from "../components/TripDetailsPanel";
import EnhancedGoogleMap from "../components/EnhancedGoogleMap";
import { getBackendOrigin } from "../../../../utils/socketConfig";
import { useGpsTracking } from "@/context/GpsTrackingContext.jsx";

export default function TripTrackingPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(id ? Number(id) : null);
  const [isLoading, setIsLoading] = useState(true);
  const gps = useGpsTracking();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [liveRes, statsRes] = await Promise.all([
          api.get('/tracking/live'),
          api.get('/tracking/dashboard')
        ]);
        const liveVehicles = liveRes.data?.data || [];
        
        // If single trip mode and not in live data, fetch it explicitly
        if (id) {
          const numId = Number(id);
          const existing = liveVehicles.find(v => v.trip_id === numId);
          if (!existing) {
            try {
              const tripRes = await api.get(`/transport/trips/${numId}`);
              const rawData = tripRes.data?.data || tripRes.data;
              const tripData = rawData.trip || rawData;
              if (tripData && tripData.id) {
                liveVehicles.push({
                  trip_id: tripData.id,
                  trip_number: tripData.trip_number,
                  driver_name: tripData.driver_name || tripData.driver?.full_name || tripData.employee_name,
                  vehicle_reg: tripData.vehicle_reg_number || tripData.vehicle?.registration_number || tripData.reg_number,
                  vehicle_id: tripData.vehicle_id,
                  driver_id: tripData.driver_id,
                  status: tripData.status,
                  latitude: null,
                  longitude: null,
                  origin_lat: tripData.origin_lat,
                  origin_lng: tripData.origin_lng,
                  destination_lat: tripData.destination_lat,
                  destination_lng: tripData.destination_lng,
                  origin_address: tripData.origin_address || tripData.origin_name,
                  destination_address: tripData.destination_address || tripData.destination_name,
                  origin_name: tripData.origin_name,
                  destination_name: tripData.destination_name
                });
              }
            } catch (err) {
              console.error("Failed to fetch specific trip details", err);
            }
          }

          // Do not automatically start tracking the viewer's location. Tracking should only be started by the driver.
        }

        console.log("DEBUG: Final liveVehicles array before setVehicles:", liveVehicles);
        console.log("DEBUG: ID param is:", id);
        setVehicles(liveVehicles);
        setStats(statsRes.data?.data || null);
      } catch (err) {
        console.error("Failed to fetch tracking data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Setup Socket.IO for receiving supervisor updates
  useEffect(() => {
    const newSocket = io(getBackendOrigin(), {
      withCredentials: true,
      transports: ["polling"],
    });

    newSocket.on("connect", () => console.log("Tracking Socket Connected"));

    // Handle live location updates — also accept NEW trips not yet in the list
    newSocket.on("tracking:location_updated", (data) => {
      setVehicles(prev => {
        const idx = prev.findIndex(v => String(v.trip_id) === String(data.trip_id));
        if (idx === -1) {
          return [...prev, {
            trip_id: data.trip_id,
            vehicle_id: data.vehicle_id,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            accuracy: data.accuracy,
            battery_level: data.battery_level,
            status: 'IN_TRANSIT',
            last_update: data.timestamp,
          }];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...data, last_update: data.timestamp };
        return updated;
      });
    });

    newSocket.on("TRIP_LOCATION_UPDATE", (data) => {
      setVehicles(prev => {
        const idx = prev.findIndex(v => String(v.trip_id) === String(data.tripId));
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { 
          ...updated[idx], 
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          speed: data.location.speed,
          heading: data.location.heading,
          last_update: data.location.recorded_at
        };
        return updated;
      });
    });

    return () => newSocket.disconnect();
  }, []);

  // Determine GPS status from global context
  const gpsStatus = id && gps ? gps.getGpsStatus(Number(id)) : "idle";
  const latestPositions = gps?.latestPositions || {};

  // Merge live GPS positions from context into the vehicles array
  // This ensures the driver sees their own marker immediately
  // Use direct computation (not useMemo) to ensure re-render on every position change
  const vehiclesWithLiveGps = vehicles.map(v => {
    // Try both Number and String key lookups for safety
    const livePos = latestPositions[Number(v.trip_id)] || latestPositions[String(v.trip_id)];
    if (livePos && livePos.latitude != null && livePos.longitude != null) {
      return { ...v, latitude: livePos.latitude, longitude: livePos.longitude, speed: livePos.speed, heading: livePos.heading, last_update: livePos.timestamp };
    }
    return v;
  });

  const selectedVehicle = vehiclesWithLiveGps.find(v => v.trip_id === selectedVehicleId || Number(v.trip_id) === Number(selectedVehicleId));
  const isSingleTripMode = !!id;

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col p-4 pt-16">
      <div className="flex justify-between items-center mb-4">
        {isSingleTripMode ? (
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm px-2 text-slate-500">
              ← Back
            </button>
            Trip Tracking - {selectedVehicle?.trip_number || 'Loading...'}
            {/* GPS Status Indicator */}
            {gpsStatus === "active" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                GPS Active
              </span>
            )}
            {gpsStatus === "error" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                GPS Error
              </span>
            )}
          </h1>
        ) : (
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm px-2 text-slate-500 mb-2">
            ← Back
          </button>
        )}
      </div>

      {!isSingleTripMode && <FleetSummaryCards stats={stats} isLoading={isLoading} />}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Left Panel: List (Hidden in Single Trip Mode) */}
        {!isSingleTripMode && (
          <div className="w-full lg:w-80 h-[40vh] lg:h-full flex-shrink-0">
            <FleetListPanel 
              vehicles={vehiclesWithLiveGps} 
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={(v) => setSelectedVehicleId(v.trip_id)}
            />
          </div>
        )}

        {/* Center: Map */}
        <div className="flex-1 min-h-[300px] lg:min-h-0 rounded-xl overflow-hidden shadow-sm border border-base-200/50 relative">
          <EnhancedGoogleMap 
            vehicles={isSingleTripMode ? vehiclesWithLiveGps.filter(v => Number(v.trip_id) === Number(id)) : vehiclesWithLiveGps} 
            selectedVehicleId={selectedVehicleId} 
            onSelectVehicle={(v) => setSelectedVehicleId(v ? v.trip_id : null)} 
          />
        </div>

        {/* Right Panel: Details (Slide In) */}
        {selectedVehicleId && (
          <div className="w-full lg:w-80 h-auto max-h-[40vh] lg:max-h-none lg:h-full flex-shrink-0 transition-all duration-300">
            <TripDetailsPanel 
              vehicle={selectedVehicle} 
              onClose={() => !isSingleTripMode && setSelectedVehicleId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

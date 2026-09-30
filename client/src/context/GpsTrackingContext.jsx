/**
 * Global GPS Tracking Context
 * Lives at the app root level so GPS tracking persists across page navigation.
 * The driver starts/stops tracking from TripManagementPage, and the GPS watcher
 * runs in this context regardless of which page the driver navigates to.
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import api from "../api/client.js";
import { io } from "socket.io-client";
import { getBackendOrigin } from "../utils/socketConfig";

const GpsTrackingContext = createContext(null);

export function useGpsTracking() {
  return useContext(GpsTrackingContext);
}

export function GpsTrackingProvider({ children }) {
  const [activeTrips, setActiveTrips] = useState({});
  const [latestPositions, setLatestPositions] = useState({}); // { [tripId]: { latitude, longitude, speed, heading, ... } }
  const socketRef = useRef(null);
  const watchersRef = useRef({});

  const ensureSocket = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(getBackendOrigin(), {
        withCredentials: true,
        transports: ["polling"],
      });
    }
    return socketRef.current;
  }, []);

  const startTracking = useCallback((tripId, vehicleId) => {
    if (!tripId) return false;
    const tid = Number(tripId);

    if (watchersRef.current[tid]) {
      console.log(`[GPS] Already tracking trip ${tid}`);
      return true;
    }

    if (!navigator.geolocation) {
      console.error("[GPS] Geolocation not supported");
      setActiveTrips(prev => ({ ...prev, [tid]: { status: "error", vehicleId } }));
      return false;
    }

    console.log(`[GPS] Starting persistent tracking for trip ${tid}`);
    const socket = ensureSocket();

    localStorage.setItem(`gps_tracking_${tid}`, JSON.stringify({ vehicleId, startedAt: new Date().toISOString() }));

    let isFirstPing = true;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const payload = {
          trip_id: tid,
          vehicle_id: vehicleId || null,
          latitude,
          longitude,
          speed: speed ? parseFloat((speed * 3.6).toFixed(2)) : 0,
          heading: heading || 0,
          accuracy: accuracy || null,
          battery_level: null,
          is_offline_point: !navigator.onLine,
          timestamp: new Date().toISOString(),
        };

        if (socket?.connected) {
          socket.emit("tracking:location_updated", payload);
        }

        api.post(`/transport/trips/${tid}/location`, {
          latitude,
          longitude,
          speed: payload.speed,
          heading: payload.heading,
          accuracy: payload.accuracy,
          recorded_at: payload.timestamp,
          is_initial: isFirstPing,
          vehicle_id: vehicleId || null,
          driver_id: null,
          battery_level: null,
          is_offline_point: payload.is_offline_point,
        }).catch((err) => {
          console.warn("[GPS] Failed to post location:", err?.message);
        });

        isFirstPing = false;
        setActiveTrips(prev => ({ ...prev, [tid]: { status: "active", vehicleId } }));
        // Store latest position so the map can read it directly
        setLatestPositions(prev => ({ ...prev, [tid]: { latitude, longitude, speed: payload.speed, heading: payload.heading, accuracy: payload.accuracy, timestamp: payload.timestamp } }));
      },
      (error) => {
        console.error("[GPS] Tracking error:", error.message);
        setActiveTrips(prev => ({ ...prev, [tid]: { status: "error", vehicleId } }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000,
      }
    );

    watchersRef.current[tid] = watchId;
    setActiveTrips(prev => ({ ...prev, [tid]: { status: "active", vehicleId } }));
    return true;
  }, [ensureSocket]);

  const stopTracking = useCallback((tripId) => {
    const tid = Number(tripId);
    if (watchersRef.current[tid] !== undefined) {
      navigator.geolocation.clearWatch(watchersRef.current[tid]);
      delete watchersRef.current[tid];
      console.log(`[GPS] Stopped tracking for trip ${tid}`);
    }
    localStorage.removeItem(`gps_tracking_${tid}`);
    setActiveTrips(prev => {
      const next = { ...prev };
      delete next[tid];
      return next;
    });
    setLatestPositions(prev => {
      const next = { ...prev };
      delete next[tid];
      return next;
    });
  }, []);

  const isTracking = useCallback((tripId) => {
    return !!watchersRef.current[Number(tripId)];
  }, []);

  const getGpsStatus = useCallback((tripId) => {
    return activeTrips[Number(tripId)]?.status || "idle";
  }, [activeTrips]);

  useEffect(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("gps_tracking_"));
    keys.forEach(key => {
      const tripId = Number(key.replace("gps_tracking_", ""));
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && tripId) {
          console.log(`[GPS] Resuming tracking for trip ${tripId} after page reload`);
          startTracking(tripId, data.vehicleId);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    });

    return () => {
      Object.keys(watchersRef.current).forEach(tid => {
        navigator.geolocation.clearWatch(watchersRef.current[tid]);
      });
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getLatestPosition = useCallback((tripId) => {
    return latestPositions[Number(tripId)] || null;
  }, [latestPositions]);

  const value = {
    startTracking,
    stopTracking,
    isTracking,
    getGpsStatus,
    getLatestPosition,
    activeTrips,
    latestPositions,
  };

  return (
    <GpsTrackingContext.Provider value={value}>
      {children}
    </GpsTrackingContext.Provider>
  );
}

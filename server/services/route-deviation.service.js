import { query } from "../db/pool.js";

// Haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

export const checkRouteAnomalies = async (tripId, vehicleId, latitude, longitude, speed) => {
  try {
    // 1. Check Overspeed
    const SPEED_LIMIT = 80; // Example limit in km/h
    if (speed > SPEED_LIMIT) {
      await query(`
        INSERT INTO fleet_alerts (trip_id, vehicle_id, alert_type, message, latitude, longitude, severity)
        VALUES (:tripId, :vehicleId, 'OVERSPEED', :msg, :lat, :lng, 'WARNING')
      `, {
        tripId, vehicleId, 
        msg: `Vehicle overspeeding: ${speed} km/h`,
        lat: latitude, lng: longitude
      });
    }

    // 2. Idle Detection (Check if last 5 pings had speed 0)
    // 3. Route Deviation (Would require fetching planned route polyline and checking distance to polyline segment)
  } catch (error) {
    console.error("Anomaly Check Error:", error);
  }
};

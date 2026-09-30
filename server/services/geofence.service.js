import { query } from "../db/pool.js";

// Basic ray-casting algorithm for point in polygon
function isPointInPolygon(point, polygon) {
  let isInside = false;
  const x = point.longitude, y = point.latitude;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  
  return isInside;
}

export const checkGeofences = async (tripId, vehicleId, latitude, longitude) => {
  try {
    const geofences = await query("SELECT id, name, type, polygon_json FROM fleet_geofences WHERE is_active = TRUE");
    const point = { latitude, longitude };
    
    for (const fence of geofences) {
      let polygon;
      try {
        polygon = typeof fence.polygon_json === 'string' ? JSON.parse(fence.polygon_json) : fence.polygon_json;
      } catch (e) {
        continue;
      }
      
      const inside = isPointInPolygon(point, polygon);
      
      if (inside) {
        // Log alert (throttle this in a real scenario so it doesn't alert every ping)
        await query(`
          INSERT INTO fleet_alerts (trip_id, vehicle_id, alert_type, message, latitude, longitude)
          VALUES (:tripId, :vehicleId, 'GEOFENCE_ENTRY', :msg, :lat, :lng)
        `, {
          tripId, vehicleId, 
          msg: `Vehicle entered geofence: ${fence.name} (${fence.type})`,
          lat: latitude, lng: longitude
        });
      }
    }
  } catch (error) {
    console.error("Geofence Check Error:", error);
  }
};

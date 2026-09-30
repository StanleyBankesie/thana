import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, DirectionsRenderer, PolylineF } from '@react-google-maps/api';
import { Spin } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import api from '../../../../api/client.js';
import useSocket from '../../../../hooks/useSocket.js';

const libraries = ['places'];
const containerStyle = { width: '100%', height: '100%' };

export default function GlobalLiveTrackingMap({ activeTrips = [], height = 400 }) {
  const [apiKey, setApiKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.get("/admin/settings/google-maps")
      .then(res => {
        if (mounted && res?.data?.data?.api_key) setApiKey(res.data.data.api_key);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  if (!apiKey) {
    return (
      <div style={{ height }} className="bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
        <div className="text-slate-400">Loading map configuration...</div>
      </div>
    );
  }

  return <GlobalLiveTrackingMapInner apiKey={apiKey} activeTrips={activeTrips} height={height} />;
}

function GlobalLiveTrackingMapInner({ apiKey, activeTrips, height }) {
  const [livePositions, setLivePositions] = useState({});
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const socket = useSocket();

  // Load initial locations for all active trips
  useEffect(() => {
    activeTrips.forEach(async (trip) => {
      try {
        const res = await api.get(`/transport/trips/${trip.id}/locations`);
        if (res.data?.success) {
          const locs = res.data.data.locations || [];
          if (locs.length > 0) {
            const latest = locs[locs.length - 1];
            setLivePositions(prev => ({
              ...prev,
              [trip.id]: {
                lat: parseFloat(latest.latitude),
                lng: parseFloat(latest.longitude),
                speed: latest.speed || 0,
                updatedAt: latest.recorded_at
              }
            }));
          }
        }
      } catch (err) {
        console.error(`Failed to load locations for trip ${trip.id}`, err);
      }
    });
  }, [activeTrips]);

  // Listen to socket updates for any trip
  useEffect(() => {
    if (!socket) return;
    const handleLocationUpdate = (data) => {
      if (activeTrips.some(t => String(t.id) === String(data.trip_id))) {
        setLivePositions(prev => ({
          ...prev,
          [data.trip_id]: {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            speed: data.speed || 0,
            updatedAt: data.timestamp
          }
        }));
      }
    };

    socket.on("tracking:location_updated", handleLocationUpdate);
    return () => socket.off("tracking:location_updated", handleLocationUpdate);
  }, [socket, activeTrips]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [directions, setDirections] = useState(null);

  // Fetch directions for selected trip
  useEffect(() => {
    if (!selectedTrip || !window.google || !isLoaded) {
      setDirections(null);
      return;
    }
    if (!selectedTrip.origin_lat || !selectedTrip.destination_lat) return;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: { lat: Number(selectedTrip.origin_lat), lng: Number(selectedTrip.origin_lng) },
      destination: { lat: Number(selectedTrip.destination_lat), lng: Number(selectedTrip.destination_lng) },
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        setDirections(result);
      }
    });
  }, [selectedTrip, isLoaded]);

  const mapCenter = Object.values(livePositions).length > 0 
    ? Object.values(livePositions)[0] 
    : (activeTrips.length > 0 && activeTrips[0].origin_lat ? { lat: Number(activeTrips[0].origin_lat), lng: Number(activeTrips[0].origin_lng) } : { lat: 5.6037, lng: -0.1870 }); // Default center (Accra)

  const handleMapLoad = useCallback((map) => {
    setMapInstance(map);
  }, []);

  useEffect(() => {
    if (mapInstance && (Object.keys(livePositions).length > 0 || activeTrips.some(t => t.origin_lat))) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;
      
      Object.values(livePositions).forEach(pos => {
        if (!isNaN(pos.lat) && !isNaN(pos.lng)) {
          bounds.extend(pos);
          hasPoints = true;
        }
      });
      
      if (!hasPoints) {
        activeTrips.forEach(t => {
          if (t.origin_lat && t.origin_lng) {
            bounds.extend({ lat: Number(t.origin_lat), lng: Number(t.origin_lng) });
            hasPoints = true;
          }
        });
      }

      // Ensure the entire trip area (origin to destination) is in view
      activeTrips.forEach(t => {
        if (t.destination_lat && t.destination_lng) {
          bounds.extend({ lat: Number(t.destination_lat), lng: Number(t.destination_lng) });
          hasPoints = true;
        }
      });

      if (hasPoints && !bounds.isEmpty()) {
        mapInstance.fitBounds(bounds);
        // Prevent zooming in too closely if there's only one marker
        if (Object.keys(livePositions).length === 1 || activeTrips.length === 1) {
          const listener = window.google.maps.event.addListener(mapInstance, "idle", () => {
            if (mapInstance.getZoom() > 14) mapInstance.setZoom(14);
            window.google.maps.event.removeListener(listener);
          });
        }
      }
    }
  }, [mapInstance, livePositions, activeTrips]);

  if (!isLoaded) return <div style={{ height }} className="bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800"><Spin /></div>;

  return (
    <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden border border-slate-800 shadow-xl relative">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={handleMapLoad}
        options={{
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
            { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
          ],
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {directions && (
          <DirectionsRenderer 
            directions={directions}
            options={{
              polylineOptions: { strokeColor: '#0ea5e9', strokeWeight: 4, strokeOpacity: 0.8 }
            }} 
          />
        )}

        {activeTrips.map(trip => {
          let lat = null, lng = null;
          const pos = livePositions[trip.id];
          
          if (pos && !isNaN(pos.lat) && !isNaN(pos.lng)) {
            lat = pos.lat;
            lng = pos.lng;
          } else if (trip.origin_lat && trip.origin_lng) {
            lat = Number(trip.origin_lat);
            lng = Number(trip.origin_lng);
          }
          
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

          const tripStatus = (trip.status || '').toUpperCase();
          const isScheduled = tripStatus === 'SCHEDULED';
          const destLat = trip.destination_lat ? Number(trip.destination_lat) : null;
          const destLng = trip.destination_lng ? Number(trip.destination_lng) : null;
          const hasDest = destLat !== null && !isNaN(destLat) && destLng !== null && !isNaN(destLng);

          const elements = [];

          // If scheduled and has destination, draw the destination marker and the polyline
          if (isScheduled && hasDest) {
            elements.push(
              <MarkerF
                key={`dest-${trip.id}`}
                position={{ lat: destLat, lng: destLng }}
              />
            );
          }

          // Main marker (origin or current location)
          elements.push(
            <MarkerF
              key={`origin-${trip.id}`}
              position={{ lat, lng }}
              onClick={() => setSelectedTrip(trip)}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0E3646"><path d="M18.92,6.01C18.72,5.42,18.16,5,17.5,5h-11c-0.66,0-1.21,0.42-1.42,1.01L3,12v8c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-1h12v1c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-8L18.92,6.01z M6.5,16c-0.83,0-1.5-0.67-1.5-1.5S5.67,13,6.5,13s1.5,0.67,1.5,1.5S7.33,16,6.5,16z M17.5,16c-0.83,0-1.5-0.67-1.5-1.5S16.67,13,17.5,13s1.5,0.67,1.5,1.5S18.33,16,17.5,16z M5,11l1.5-4.5h11L19,11H5z"/></svg>`),
                scaledSize: new window.google.maps.Size(36, 36),
                anchor: new window.google.maps.Point(18, 18)
              }}
            >
              {selectedTrip && selectedTrip.id === trip.id && (
                <InfoWindowF onCloseClick={() => setSelectedTrip(null)}>
                  <div className="p-2 min-w-[200px] text-slate-800">
                    <h3 className="font-bold border-b pb-1 mb-2 flex items-center gap-2">
                      <CarOutlined /> {selectedTrip.registration_number || selectedTrip.reg_number || 'Unknown Vehicle'}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500">Driver:</span>
                      <span className="font-medium truncate">{selectedTrip.driver_name || selectedTrip.employee_name || 'N/A'}</span>
                      
                      <span className="text-slate-500">Speed:</span>
                      <span className="font-medium">{livePositions[selectedTrip.id]?.speed || 0} km/h</span>
                      
                      <span className="text-slate-500">Status:</span>
                      <span className={`font-medium ${tripStatus === 'IN_TRANSIT' ? 'text-green-600' : 'text-amber-600'}`}>
                        {trip.status}
                      </span>
                      
                      {livePositions[selectedTrip.id]?.updatedAt && (
                        <>
                          <span className="text-slate-500">Last Update:</span>
                          <span className="font-medium">
                            {new Date(livePositions[selectedTrip.id].updatedAt).toLocaleTimeString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          );

          return elements;
        })}
      </GoogleMap>
    </div>
  );
}

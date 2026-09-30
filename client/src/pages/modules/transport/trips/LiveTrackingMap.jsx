import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import { Spin } from 'antd';
import api from '../../../../api/client.js';
import { useSocket } from '../../../../hooks/useSocket.js';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const libraries = ['places', 'geometry'];

export default function LiveTrackingMap(props) {
  const [apiKey, setApiKey] = useState(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/admin/settings/google-maps");
        if (mounted && res?.data?.data?.api_key) {
          setApiKey(res.data.data.api_key);
        }
      } catch (err) {
        console.error("Failed to load Google Maps API Key", err);
      } finally {
        if (mounted) setApiKeyLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (apiKeyLoading) {
    return <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>;
  }

  if (!apiKey) {
    return (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef3c7', color: '#b45309', padding: 16, borderRadius: 8 }}>
        Google Maps API Key is not configured. Please go to System Configuration &gt; General Settings to set it up.
      </div>
    );
  }

  return <LiveTrackingMapInner apiKey={apiKey} {...props} />;
}

function LiveTrackingMapInner({ apiKey, tripId, trip, height = 400 }) {
  const [locations, setLocations] = useState([]);
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const socket = useSocket();

  const fetchLocations = async () => {
    try {
      const res = await api.get(`/transport/trips/${tripId}/locations`);
      if (res.data?.success) {
        setLocations(res.data.data.locations || []);
      }
    } catch (err) {
      console.error("Failed to fetch GPS data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    // Fallback: poll every 10 seconds in case WebSockets (Socket.io) are disabled in production
    const intervalId = setInterval(fetchLocations, 10000);
    return () => clearInterval(intervalId);
  }, [tripId]);

  useEffect(() => {
    if (!socket || !tripId) return;

    const handleLocationUpdate = (data) => {
      if (String(data.tripId) === String(tripId)) {
        setLocations(prev => [...prev, data.location]);
      }
    };

    socket.on("TRIP_LOCATION_UPDATE", handleLocationUpdate);
    return () => socket.off("TRIP_LOCATION_UPDATE", handleLocationUpdate);
  }, [socket, tripId]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const hasLocations = locations.length > 0;
  const positions = locations.map(loc => ({ lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) })).filter(pos => !isNaN(pos.lat) && !isNaN(pos.lng));
  const validHasLocations = positions.length > 0;
  
  const startLat = validHasLocations ? positions[0].lat : parseFloat(trip?.origin_lat);
  const startLng = validHasLocations ? positions[0].lng : parseFloat(trip?.origin_lng);
  const destLat = parseFloat(trip?.destination_lat);
  const destLng = parseFloat(trip?.destination_lng);

  const hasValidOrigin = !isNaN(startLat) && !isNaN(startLng);
  const hasValidDest = !isNaN(destLat) && !isNaN(destLng);

  const currentPosition = validHasLocations 
    ? positions[positions.length - 1] 
    : (hasValidOrigin ? { lat: startLat, lng: startLng } : { lat: 5.6037, lng: -0.1870 });

  useEffect(() => {
    if (mapInstance) {
      if (!validHasLocations && hasValidOrigin && hasValidDest) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: startLat, lng: startLng });
        bounds.extend({ lat: destLat, lng: destLng });
        mapInstance.fitBounds(bounds);
      } else if (currentPosition && currentPosition.lat && currentPosition.lng) {
        mapInstance.panTo(currentPosition);
      }
    }
  }, [mapInstance, currentPosition?.lat, currentPosition?.lng, validHasLocations, hasValidOrigin, hasValidDest, startLat, startLng, destLat, destLng]);

  useEffect(() => {
    if (isLoaded && window.google && currentPosition && !isNaN(destLat) && !isNaN(destLng)) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: validHasLocations ? { lat: startLat, lng: startLng } : currentPosition,
          destination: { lat: destLat, lng: destLng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
            if (result.routes[0]?.legs[0]) {
              setRouteInfo({
                distance: result.routes[0].legs[0].distance.text,
                duration: result.routes[0].legs[0].duration.text
              });
            }
          } else {
            console.error(`Error fetching directions: ${status}`);
          }
        }
      );
    }
  }, [isLoaded, validHasLocations, startLat, startLng, currentPosition.lat, currentPosition.lng, destLat, destLng]);

  if (loadError) {
    return <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}>Error loading Google Maps.</div>;
  }

  if ((loading && locations.length === 0) || !isLoaded || !window.google) {
    return <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>;
  }



  const darkModeStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
  ];

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <style>{`
        /* Remove extra padding and headers in all Google Maps InfoWindow versions */
        .gm-style .gm-style-iw-c {
          padding: 8px !important;
          border-radius: 6px !important;
        }
        .gm-style .gm-style-iw-d {
          overflow: hidden !important;
          max-height: none !important;
        }
        .gm-style .gm-style-iw-ch {
          display: none !important; /* Hides the new header container */
        }
        .gm-ui-hover-effect {
          display: none !important; /* Hides the close button */
        }
      `}</style>
      {!validHasLocations && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-md border border-amber-200 text-amber-700 font-medium">
          No GPS data available for this trip yet.
        </div>
      )}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentPosition}
        zoom={validHasLocations ? 14 : 10}
        onLoad={map => setMapInstance(map)}
        options={{
          styles: isDarkMode ? darkModeStyles : [],
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: isDarkMode ? "#3b82f6" : "#2563eb",
                strokeWeight: 8,
                strokeOpacity: 0.8,
              }
            }}
          />
        )}

        {hasValidOrigin && (
          <>
            <MarkerF 
              position={{ lat: startLat, lng: startLng }} 
              label={{ text: "A", color: "white", fontWeight: "bold" }}
            />
            <InfoWindowF position={{ lat: startLat, lng: startLng }} options={{ pixelOffset: new window.google.maps.Size(0, -35), headerDisabled: true, disableAutoPan: true }}>
              <div style={{ color: 'black', fontWeight: 'bold', fontSize: '12px', margin: 0, padding: 0 }}>Origin: {trip?.origin_name || 'Start'}</div>
            </InfoWindowF>
          </>
        )}

        {hasValidDest && (
          <>
            <MarkerF 
              position={{ lat: destLat, lng: destLng }} 
              label={{ text: "B", color: "white", fontWeight: "bold" }}
            />
            <InfoWindowF position={{ lat: destLat, lng: destLng }} options={{ pixelOffset: new window.google.maps.Size(0, -35), headerDisabled: true, disableAutoPan: true }}>
              <div style={{ color: 'black', fontWeight: 'bold', fontSize: '12px', margin: 0, padding: 0 }}>Destination: {trip?.destination_name || 'End'}</div>
            </InfoWindowF>
          </>
        )}

        {validHasLocations && (
          <>
            <MarkerF 
              position={currentPosition} 
              zIndex={100}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0E3646"><path d="M18.92,6.01C18.72,5.42,18.16,5,17.5,5h-11c-0.66,0-1.21,0.42-1.42,1.01L3,12v8c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-1h12v1c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-8L18.92,6.01z M6.5,16c-0.83,0-1.5-0.67-1.5-1.5S5.67,13,6.5,13s1.5,0.67,1.5,1.5S7.33,16,6.5,16z M17.5,16c-0.83,0-1.5-0.67-1.5-1.5S16.67,13,17.5,13s1.5,0.67,1.5,1.5S18.33,16,17.5,16z M5,11l1.5-4.5h11L19,11H5z"/></svg>`),
                scaledSize: new window.google.maps.Size(36, 36),
                anchor: new window.google.maps.Point(18, 18)
              }}
            />
            <InfoWindowF position={currentPosition} options={{ pixelOffset: new window.google.maps.Size(0, -20), headerDisabled: true, disableAutoPan: true }}>
              <div style={{ color: 'black', fontSize: '11px', lineHeight: '1.2', margin: 0, padding: 0 }}>
                <strong>Current Location</strong><br/>
                Speed: {locations[locations.length - 1].speed} km/h<br/>
                {routeInfo && <>
                  ETA: {routeInfo.duration} ({routeInfo.distance})<br/>
                </>}
                At: {new Date(locations[locations.length - 1].recorded_at).toLocaleTimeString()}
              </div>
            </InfoWindowF>
          </>
        )}
      </GoogleMap>
    </div>
  );
}

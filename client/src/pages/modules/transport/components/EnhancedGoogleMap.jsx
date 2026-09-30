import React, { useCallback, useState, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF as Marker, InfoWindowF as InfoWindow, MarkerClustererF as MarkerClusterer, DirectionsRenderer, PolylineF as Polyline } from '@react-google-maps/api';
import api from '../../../../api/client.js';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = { lat: 5.6037, lng: -0.1870 }; // Default to Accra

export default function EnhancedGoogleMap({ vehicles, selectedVehicleId, onSelectVehicle, geofences }) {
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
    return <div className="p-4 animate-pulse bg-slate-100 h-full w-full flex items-center justify-center">Loading map...</div>;
  }

  if (!apiKey) {
    return <div className="p-4 bg-amber-100 text-amber-800 m-4 rounded-lg">Google Maps API Key is not configured. Please set it in System Settings.</div>;
  }

  return <EnhancedGoogleMapInner apiKey={apiKey} vehicles={vehicles} selectedVehicleId={selectedVehicleId} onSelectVehicle={onSelectVehicle} geofences={geofences} />;
}

function EnhancedGoogleMapInner({ apiKey, vehicles, selectedVehicleId, onSelectVehicle, geofences }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: ['places', 'geometry']
  });

  const mapRef = useRef(null);
  const [directions, setDirections] = useState(null);

  const onLoad = useCallback(function callback(map) {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const activeVehicleId = vehicles.length === 1 ? vehicles[0].trip_id : selectedVehicleId;

    if (activeVehicleId) {
      const v = vehicles.find(v => Number(v.trip_id) === Number(activeVehicleId));
      if (v) {
        const lat = v.latitude ? Number(v.latitude) : (v.origin_lat ? Number(v.origin_lat) : null);
        const lng = v.longitude ? Number(v.longitude) : (v.origin_lng ? Number(v.origin_lng) : null);
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          // Focus on trip area
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat, lng });
          
          const destLat = v.destination_lat ? Number(v.destination_lat) : null;
          const destLng = v.destination_lng ? Number(v.destination_lng) : null;
          if (destLat && destLng && !isNaN(destLat) && !isNaN(destLng)) {
            bounds.extend({ lat: destLat, lng: destLng });
          }
          
          mapRef.current.fitBounds(bounds);
          mapRef.current.setTilt(0);
          mapRef.current.setHeading(0);
        }
      }
    } else if (vehicles?.length > 0) {
      // Fit bounds to all vehicles
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;
      vehicles.forEach(v => {
        const lat = v.latitude ? Number(v.latitude) : (v.origin_lat ? Number(v.origin_lat) : null);
        const lng = v.longitude ? Number(v.longitude) : (v.origin_lng ? Number(v.origin_lng) : null);
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          bounds.extend({ lat, lng });
          hasValidCoords = true;
        }
      });
      if (hasValidCoords) mapRef.current.fitBounds(bounds);
    }
  }, [selectedVehicleId, vehicles]);

  // Fetch directions for selected vehicle (or the only vehicle if there's only 1)
  useEffect(() => {
    if (!window.google || !isLoaded) return;

    const activeVehicleId = vehicles.length === 1 ? vehicles[0].trip_id : selectedVehicleId;

    if (!activeVehicleId) {
      setDirections(null);
      return;
    }

    const v = vehicles.find(v => Number(v.trip_id) === Number(activeVehicleId));
    if (!v || !v.origin_lat || !v.destination_lat) {
      setDirections(null);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: { lat: Number(v.origin_lat), lng: Number(v.origin_lng) },
      destination: { lat: Number(v.destination_lat), lng: Number(v.destination_lng) },
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        setDirections(result);
      }
    });
  }, [selectedVehicleId, vehicles, isLoaded]);

  if (loadError) return <div className="p-4 text-red-500">Error loading maps</div>;
  if (!isLoaded) return <div className="p-4 animate-pulse bg-slate-100 h-full w-full"></div>;

  const getMarkerIcon = (v) => {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0E3646"><path d="M18.92,6.01C18.72,5.42,18.16,5,17.5,5h-11c-0.66,0-1.21,0.42-1.42,1.01L3,12v8c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-1h12v1c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-8L18.92,6.01z M6.5,16c-0.83,0-1.5-0.67-1.5-1.5S5.67,13,6.5,13s1.5,0.67,1.5,1.5S7.33,16,6.5,16z M17.5,16c-0.83,0-1.5-0.67-1.5-1.5S16.67,13,17.5,13s1.5,0.67,1.5,1.5S18.33,16,17.5,16z M5,11l1.5-4.5h11L19,11H5z"/></svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgStr),
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 18)
    };
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={12}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: true,
        fullscreenControl: true,
        styles: [
          // Add custom map styles here for dark mode if needed
        ]
      }}
    >
      {directions && (
        <DirectionsRenderer 
          directions={directions}
          options={{
            suppressMarkers: true,
            markerOptions: { visible: false, opacity: 0 },
            polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.8 }
          }} 
        />
      )}

      {/* Render Destination Markers and Polylines explicitly outside MarkerClusterer */}
      {vehicles.map(v => {
        const destLat = v.destination_lat ? Number(v.destination_lat) : null;
        const destLng = v.destination_lng ? Number(v.destination_lng) : null;
        const hasDest = destLat !== null && !isNaN(destLat) && destLng !== null && !isNaN(destLng);

        if (!hasDest) return null;

        return [
          <Marker
            key={`dest-${v.trip_id}`}
            position={{ lat: destLat, lng: destLng }}
          />
        ];
      })}

      <>
            {vehicles.map((v) => {
              const lat = v.latitude ? Number(v.latitude) : (v.origin_lat ? Number(v.origin_lat) : null);
              const lng = v.longitude ? Number(v.longitude) : (v.origin_lng ? Number(v.origin_lng) : null);
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
              const isSelected = Number(selectedVehicleId) === Number(v.trip_id);

              return (
                <Marker
                  key={`origin-${v.trip_id}`}
                  position={{ lat, lng }}
                  icon={getMarkerIcon(v)}
                  onClick={() => onSelectVehicle(v)}
                  
                  zIndex={isSelected ? 1000 : 1}
                >
                  {isSelected && (
                    <InfoWindow position={{ lat, lng }} onCloseClick={() => onSelectVehicle(null)}>
                      <div className="p-0.5 min-w-[140px]">
                        <h3 className="font-bold text-sm text-slate-800 leading-tight">{v.registration_number}</h3>
                        <p className="text-[10px] text-slate-500 mb-1">{v.driver_name}</p>
                        <div className="grid grid-cols-2 gap-1 text-[10px] border-t pt-1">
                          <div>
                            <p className="text-slate-400">Speed</p>
                            <p className="font-semibold leading-none mt-0.5">{v.speed || 0} km/h</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Status</p>
                            <p className="font-semibold leading-none mt-0.5">{v.status}</p>
                          </div>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              );
            })}
          </>
      
    </GoogleMap>
  );
}

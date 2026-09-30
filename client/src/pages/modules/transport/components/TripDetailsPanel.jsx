import React from 'react';
import { User, Truck, MapPin, Navigation, Clock, Activity, Flag } from 'lucide-react';
import api from '../../../../api/client.js';
import { message } from 'antd';
import { useGpsTracking } from '../../../../context/GpsTrackingContext.jsx';

export default function TripDetailsPanel({ vehicle, onClose }) {
  const gps = useGpsTracking();

  if (!vehicle) return null;

  const handleAction = async (action) => {
    try {
      await api.post(`/tracking/${action}`, { trip_id: vehicle.trip_id });
      message.success(`Trip ${action} successful`);
      
      if (action === 'start') {
        gps?.startTracking(vehicle.trip_id, vehicle.vehicle_id);
      } else if (action === 'end' || action === 'pause') {
        gps?.stopTracking(vehicle.trip_id);
      }
    } catch (err) {
      message.error(err.response?.data?.message || `Failed to ${action} trip`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-base-100 rounded-xl border border-base-200/50 shadow-lg overflow-hidden animate-slide-in-right">
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-base-200/50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{vehicle.trip_number}</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand uppercase tracking-wide">
            {vehicle.tracking_status || vehicle.status}
          </span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Entities */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Driver</p>
              <p className="font-semibold text-sm">{vehicle.driver_name || 'Unassigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Vehicle</p>
              <p className="font-semibold text-sm">{vehicle.registration_number}</p>
            </div>
          </div>
        </div>

        {/* Live Stats */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Telemetry</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <Activity className="w-4 h-4 text-emerald-500 mb-1" />
              <span className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">{vehicle.speed || 0}</span>
              <span className="text-[10px] text-slate-400 uppercase">km/h</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <Navigation className="w-4 h-4 text-blue-500 mb-1" />
              <span className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">{vehicle.heading || 0}°</span>
              <span className="text-[10px] text-slate-400 uppercase">Heading</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <Clock className="w-4 h-4 text-amber-500 mb-1" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                {vehicle.recorded_at ? new Date(vehicle.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Last Ping</span>
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Route Progress</h4>
          <div className="relative pl-6 pb-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-6 ml-3">
            <div className="relative">
              <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[1.1rem] top-1 border-2 border-white dark:border-base-100"></div>
              <p className="text-xs text-slate-500 uppercase">Origin</p>
              <p className="font-medium text-sm mt-0.5">{vehicle.origin_name || 'N/A'}</p>
            </div>
            <div className="relative">
              <div className="absolute w-3 h-3 bg-brand rounded-full -left-[1.1rem] top-1 border-2 border-white dark:border-base-100 animate-pulse"></div>
              <p className="text-xs text-slate-500 uppercase">Current</p>
              <p className="font-medium text-sm mt-0.5 font-mono">
                {vehicle.latitude ? `${parseFloat(vehicle.latitude).toFixed(4)}, ${parseFloat(vehicle.longitude).toFixed(4)}` : 'Waiting for GPS...'}
              </p>
            </div>
            <div className="relative">
              <div className="absolute w-3 h-3 bg-rose-500 rounded-full -left-[1.1rem] top-1 border-2 border-white dark:border-base-100"></div>
              <p className="text-xs text-slate-500 uppercase">Destination</p>
              <p className="font-medium text-sm mt-0.5">{vehicle.destination_name || 'N/A'}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Dispatcher Controls */}
      <div className="p-4 border-t border-base-200/50 bg-slate-50 dark:bg-slate-900 grid grid-cols-2 gap-2">
        {vehicle.tracking_status !== 'ACTIVE' ? (
          <button onClick={() => handleAction('start')} className="btn btn-sm btn-primary w-full">Start Tracking</button>
        ) : (
          <button onClick={() => handleAction('pause')} className="btn btn-sm btn-warning w-full">Pause Tracking</button>
        )}
        <button onClick={() => handleAction('end')} className="btn btn-sm btn-outline btn-error w-full">End Trip</button>
      </div>
    </div>
  );
}

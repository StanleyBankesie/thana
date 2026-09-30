import React, { useState } from 'react';
import { Search, Navigation, AlertCircle, MapPin } from 'lucide-react';

export default function FleetListPanel({ vehicles, onSelectVehicle, selectedVehicleId }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVehicles = (vehicles || []).filter(v => 
    v.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.trip_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status, speed) => {
    if (status === 'COMPLETED') return 'bg-gray-500';
    if (!speed && status === 'IN_TRANSIT') return 'bg-blue-500'; // Idle
    if (speed > 0) return 'bg-green-500'; // Moving
    if (status === 'SCHEDULED') return 'bg-orange-500'; // Paused/Waiting
    return 'bg-red-500'; // Offline or default
  };

  const getStatusText = (status, speed) => {
    if (status === 'COMPLETED') return 'Completed';
    if (!speed && status === 'IN_TRANSIT') return 'Idle';
    if (speed > 0) return 'Moving';
    if (status === 'SCHEDULED') return 'Paused';
    return 'Offline';
  };

  return (
    <div className="flex flex-col h-full bg-base-100 rounded-xl border border-base-200/50 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-base-200/50">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-brand" />
          Fleet List
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search vehicle, driver, trip..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredVehicles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>No vehicles found</p>
          </div>
        ) : (
          <div className="divide-y divide-base-200/50">
            {filteredVehicles.map(v => (
              <div 
                key={v.trip_id}
                onClick={() => onSelectVehicle(v)}
                className={[
                  "p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col gap-2",
                  selectedVehicleId === v.trip_id ? "bg-brand/5 dark:bg-brand/10 border-l-4 border-brand" : ""
                ].filter(Boolean).join(" ")}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{v.registration_number}</p>
                    <p className="text-xs text-slate-500">{v.driver_name}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span className={["w-2 h-2 rounded-full", getStatusColor(v.status, v.speed)].filter(Boolean).join(" ")}></span>
                      {getStatusText(v.status, v.speed)}
                    </span>
                    <span className="text-xs text-slate-500 mt-1 font-mono">{v.speed || 0} km/h</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {v.origin_name} &rarr; {v.destination_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

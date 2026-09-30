import React from 'react';
import { Truck, Activity, CheckCircle, AlertTriangle, Clock, MapPin } from 'lucide-react';

export default function FleetSummaryCards({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="animate-pulse bg-base-100 rounded-xl h-24 border border-base-300"></div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Vehicles', value: stats?.total_vehicles || 0, icon: <Truck className="w-5 h-5 text-blue-500" /> },
    { label: 'Active Trips', value: stats?.active_trips || 0, icon: <Activity className="w-5 h-5 text-brand" /> },
    { label: 'Moving', value: stats?.moving_vehicles || 0, icon: <Activity className="w-5 h-5 text-emerald-500" /> },
    { label: 'Idle', value: stats?.idle_vehicles || 0, icon: <Clock className="w-5 h-5 text-amber-500" /> },
    { label: 'Offline', value: stats?.offline_vehicles || 0, icon: <AlertTriangle className="w-5 h-5 text-rose-500" /> },
    { label: 'Completed Trips', value: stats?.completed_today || 0, icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
    { label: 'Delayed Trips', value: stats?.delayed_trips || 0, icon: <Clock className="w-5 h-5 text-orange-500" /> },
    { label: 'Alerts', value: stats?.alerts || 0, icon: <MapPin className="w-5 h-5 text-red-500" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-base-100 p-4 rounded-xl border border-base-200/50 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
            {card.icon}
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

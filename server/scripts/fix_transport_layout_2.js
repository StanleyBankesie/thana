import fs from 'fs';

const layoutPath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let fullContent = fs.readFileSync(layoutPath, 'utf8');

const correctSectionsStr = `  const sections = [
    {
      title: "Operations",
      items: [
        { 
          title: "Transport Requests", 
          path: "/transport/requests", 
          feature_key: "requests", 
          description: "Manage internal and external transport requests",
          icon: "📋",
          actions: [
            <ActionButton key="view" label="View" path="/transport/requests" type="outline" featureKey="transport:requests" action="view" />,
            <ActionButton key="new" label="New" path="/transport/requests/new" type="primary" featureKey="transport:requests" action="create" />
          ]
        },
        { 
          title: "Trips & Dispatch", 
          path: "/transport/trips", 
          feature_key: "trips", 
          description: "Dispatch vehicles and track live trips",
          icon: "🗺️",
          actions: [
            <ActionButton key="view" label="View" path="/transport/trips" type="outline" featureKey="transport:trips" action="view" />,
            <ActionButton key="new" label="New" path="/transport/trips/new" type="primary" featureKey="transport:trips" action="create" />
          ]
        },
        { 
          title: "Trip & Dispatch Returns", 
          path: "/transport/trip-returns", 
          feature_key: "trips", 
          description: "Confirm returning trips and log vehicle metrics",
          icon: "🔙",
          actions: [
            <ActionButton key="view" label="Manage Returns" path="/transport/trip-returns" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "Trip History & Tracking", 
          path: "/transport/reports/trip-history", 
          feature_key: "trips", 
          description: "Detailed history logs and tracking of fleet trips",
          icon: "📜",
          actions: [
            <ActionButton key="view" label="View Report" path="/transport/reports/trip-history" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "GPS Tracking", 
          path: "/transport/trips", 
          feature_key: "tracking", 
          description: "Monitor live vehicle locations via GPS",
          icon: "📍",
          actions: [
            <ActionButton key="view" label="View Map" path="/transport/trips" type="primary" featureKey="transport:trips" action="view" />
          ]
        },
        { 
          title: "Routes", 
          path: "/transport/routes", 
          feature_key: "routes", 
          description: "Manage standard transport routes and distances",
          icon: "🛣️",
          actions: [
            <ActionButton key="view" label="View" path="/transport/routes" type="outline" featureKey="transport:routes" action="view" />,
            <ActionButton key="new" label="New" path="/transport/routes/new" type="primary" featureKey="transport:routes" action="create" />
          ]
        },
      ],
    },
    {
      title: "Fleet Management",
      items: [
        { 
          title: "Inspections", 
          path: "/transport/inspections", 
          feature_key: "inspections", 
          description: "Record pre-trip and post-trip vehicle inspections",
          icon: "📋",
          actions: [
            <ActionButton key="view" label="View" path="/transport/inspections" type="outline" featureKey="transport:inspections" action="view" />,
            <ActionButton key="new" label="New" path="/transport/inspections/new" type="primary" featureKey="transport:inspections" action="create" />
          ]
        },
      ],
    },`;

const newFullContent = fullContent.replace(/const dashboardStats = \[[\s\S]*?\];\n\n  return \(\n    <ModuleDashboard/m, 
`const dashboardStats = [
    {
      rbac_key: "active-trips",
      icon: "🚚",
      value: String(stats?.activeTrips || 0),
      label: "Active Trips",
      path: "/transport/trips",
    },
    {
      rbac_key: "total-vehicles",
      icon: "🚛",
      value: String(stats?.totalVehicles || 0),
      label: "Total Vehicles",
      path: "/transport/vehicles",
    },
    {
      rbac_key: "total-drivers",
      icon: "🧑‍✈️",
      value: String(stats?.totalDrivers || 0),
      label: "Total Drivers",
      path: "/transport/drivers",
    },
    {
      rbac_key: "total-fuel-cost",
      icon: "⛽",
      value: fmt(stats?.totalFuelCost || 0),
      label: "Total Fuel Cost",
      path: "/transport/fuel",
    },
  ];

\${correctSectionsStr}
    {
      title: "Costing & Billing",
      items: [
        { 
          title: "Fuel & Expenses", 
          path: "/transport/fuel", 
          feature_key: "fuel", 
          description: "Log fuel consumption and transport expenses",
          icon: "⛽",
          actions: [
            <ActionButton key="view" label="View" path="/transport/fuel" type="outline" featureKey="transport:fuel" action="view" />,
            <ActionButton key="new" label="New" path="/transport/fuel/new" type="primary" featureKey="transport:fuel" action="create" />
          ]
        },
        { 
          title: "Billing", 
          path: "/transport/billing", 
          feature_key: "billing", 
          description: "Manage transport invoices and billing",
          icon: "🧾",
          actions: [
            <ActionButton key="view" label="View" path="/transport/billing" type="outline" featureKey="transport:billing" action="view" />
          ]
        },
        { 
          title: "Transportation Income", 
          path: "/transport/income", 
          feature_key: "income", 
          description: "Manage income records",
          icon: "💵",
          actions: [
            <ActionButton key="view" label="View" path="/transport/income" type="outline" featureKey="transport:income" action="view" />
          ]
        },
        { 
          title: "Transportation Expenses", 
          path: "/transport/expenses", 
          feature_key: "expenses", 
          description: "Manage expense records",
          icon: "💸",
          actions: [
            <ActionButton key="view" label="View" path="/transport/expenses" type="outline" featureKey="transport:expenses" action="view" />
          ]
        },
      ],
    },
    {
      title: "Configuration",
      items: [
        { 
          title: "Settings", 
          path: "/transport/settings", 
          feature_key: "settings", 
          description: "Configure pricing, types, and module behaviors",
          icon: "⚙️",
          actions: [
            <ActionButton key="view" label="Manage" path="/transport/settings" type="primary" featureKey="transport:settings" action="view" />
          ]
        },
      ],
    }
  ];

  return (
    <ModuleDashboard`);

fs.writeFileSync(layoutPath, newFullContent);
console.log("Fixed TransportLayout.jsx");

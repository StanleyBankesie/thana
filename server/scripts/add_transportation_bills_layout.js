const fs = require('fs');
const path = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
if (!content.includes('TransportationBillsList')) {
  content = content.replace(
    'import FuelBillForm from "./fuel-bills/FuelBillForm.jsx";',
    `import FuelBillForm from "./fuel-bills/FuelBillForm.jsx";\nimport TransportationBillsList from "./transportation-bills/TransportationBillsList.jsx";\nimport TransportationBillForm from "./transportation-bills/TransportationBillForm.jsx";`
  );
}

// Add layout menu item
if (!content.includes('title: "Transportation Bills"')) {
  content = content.replace(
    /{\s*title: "Refuelling",[\s\S]*?},/,
    `{ 
          title: "Refuelling", 
          path: "/transport/fuel", 
          feature_key: "fuel", 
          description: "Log all information of fuel purchased and refuelling events",
          icon: "⛽",
          actions: [
            <ActionButton key="view" label="View" path="/transport/fuel" type="outline" featureKey="transport:fuel" action="view" />,
            <ActionButton key="new" label="New" path="/transport/fuel/new" type="primary" featureKey="transport:fuel" action="create" />
          ]
        },
        { 
          title: "Transportation Bills", 
          path: "/transport/transportation-bills", 
          feature_key: "bills", 
          description: "Manage transportation bills and service supplier invoices",
          icon: "📑",
          actions: [
            <ActionButton key="view" label="View" path="/transport/transportation-bills" type="outline" featureKey="transport:bills" action="view" />,
            <ActionButton key="new" label="New" path="/transport/transportation-bills/new" type="primary" featureKey="transport:bills" action="create" />
          ]
        },`
  );
}

// Add React Routes
if (!content.includes('<Route path="transportation-bills"')) {
  content = content.replace(
    '<Route path="fuel-bills/:id" element={<FuelBillForm />} />',
    `<Route path="fuel-bills/:id" element={<FuelBillForm />} />
      <Route path="transportation-bills" element={<TransportationBillsList />} />
      <Route path="transportation-bills/new" element={<TransportationBillForm />} />
      <Route path="transportation-bills/:id" element={<TransportationBillForm />} />`
  );
}

fs.writeFileSync(path, content);
console.log('TransportLayout updated successfully with Transportation Bills');

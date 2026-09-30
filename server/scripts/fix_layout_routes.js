const fs = require('fs');
const path = 'client/src/pages/modules/transport/TransportLayout.jsx';
let c = fs.readFileSync(path, 'utf8');

if (!c.includes('import FuelBillsList')) {
  c = c.replace('import FuelExpenseList from "./fuel-expenses/FuelExpenseList.jsx";', 
    'import FuelExpenseList from "./fuel-expenses/FuelExpenseList.jsx";\nimport FuelBillsList from "./fuel-bills/FuelBillsList.jsx";\nimport FuelBillForm from "./fuel-bills/FuelBillForm.jsx";');
}

c = c.replace(/<Route path="fuel-expenses" element={<FuelExpenseList \/>} \/>[\s\S]*?<Route path="maintenance" element={<MaintenanceList \/>} \/>/m,
`<Route path="fuel-expenses" element={<FuelExpenseList />} />
      <Route path="fuel-bills" element={<FuelBillsList />} />
      <Route path="fuel-bills/new" element={<FuelBillForm />} />
      <Route path="fuel-bills/:id" element={<FuelBillForm />} />
      <Route path="billing" element={<BillingList />} />
      <Route path="billing/new" element={<BillingForm />} />
      <Route path="billing/:id" element={<BillingForm />} />
      <Route path="routes" element={<RoutesList />} />
      <Route path="routes/new" element={<RouteForm />} />
      <Route path="routes/:id" element={<RouteForm />} />
      <Route path="inspections" element={<InspectionsList />} />
      <Route path="inspections/new" element={<InspectionForm />} />
      <Route path="inspections/:id" element={<InspectionForm />} />
      <Route path="maintenance" element={<MaintenanceList />} />`);

fs.writeFileSync(path, c);
console.log('Fixed imports and routes');

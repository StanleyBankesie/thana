import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('TransportIncomeList')) {
  content = content.replace(
    'import BreakdownForm from "./breakdowns/BreakdownForm.jsx";',
    'import BreakdownForm from "./breakdowns/BreakdownForm.jsx";\nimport TransportIncomeList from "./income/TransportIncomeList.jsx";\nimport TransportExpenseList from "./expenses/TransportExpenseList.jsx";\nimport { RoleProtectedRoute } from "../../../auth/RoleProtectedRoute.jsx";'
  );
}

// Ensure the UI cards are added under Billing
if (!content.includes('Transportation Income')) {
  // Replace the entire Billing object block
  content = content.replace(
    /\{\s*title:\s*"Billing",[\s\S]*?\},/,
    `{ 
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
        },`
  );
}

// Add the Routes correctly
const routesAddition = `
      <Route path="reports/*" element={
        <RoleProtectedRoute featureKey="transport:reports" action="view">
          <TransportReports />
        </RoleProtectedRoute>
      } />
      <Route path="income" element={
        <RoleProtectedRoute featureKey="transport:income" action="view">
          <TransportIncomeList />
        </RoleProtectedRoute>
      } />
      <Route path="expenses" element={
        <RoleProtectedRoute featureKey="transport:expenses" action="view">
          <TransportExpenseList />
        </RoleProtectedRoute>
      } />
`;

if (!content.includes('<TransportIncomeList />')) {
  // Replace the old reports route
  content = content.replace(
    '<Route path="reports" element={<TransportReports />} />',
    routesAddition
  );
}

fs.writeFileSync(filePath, content);
console.log("Updated TransportLayout.jsx");
